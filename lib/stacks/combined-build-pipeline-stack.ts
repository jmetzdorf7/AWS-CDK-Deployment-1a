import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface RepoSpec {
  id: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface CombinedBuildPipelineProps extends cdk.StackProps {
  connectionArn: string;
  repos: RepoSpec[]; // will be turned into N source actions / artifacts
}

export class CombinedBuildPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CombinedBuildPipelineProps) {
    super(scope, id, props);

    const pipeline = new codepipeline.Pipeline(this, 'CombinedBuildPipeline', {
      pipelineName: 'combined-build-pipeline',
    });

    // Create source artifacts for all repos
    const artifacts = new Map<string, codepipeline.Artifact>();
    const sourceActions: cpactions.Action[] = [];

    for (const r of props.repos) {
      const art = new codepipeline.Artifact(`${r.id}Source`);
      artifacts.set(r.id, art);

      const sourceAction = new cpactions.CodeStarConnectionsSourceAction({
        actionName: `${r.id}-Source`,
        connectionArn: props.connectionArn,
        owner: r.owner,
        repo: r.repo,
        branch: r.branch ?? 'main',
        output: art,
      });

      sourceActions.push(sourceAction);
    }

    pipeline.addStage({
      stageName: 'Source',
      actions: sourceActions,
    });

    // Single CodeBuild project that receives multiple input artifacts and runs a combined build
    const combinedProject = new codebuild.PipelineProject(this, 'CombinedBuildProject', {
      projectName: 'combined-build',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      // For the combined build we expect combined-buildspec.yml to exist in the primary artifact
      buildSpec: codebuild.BuildSpec.fromSourceFilename('combined-buildspec.yml'),
    });

    combinedProject.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:*', 'cloudformation:*', 'iam:*', 'sts:AssumeRole'],
      resources: ['*'],
    }));

    // Primary artifact is the first repo; additional artifacts are passed in additionalInputs
    const repoList = Array.from(artifacts.entries());
    if (repoList.length === 0) {
      throw new Error('At least one repo must be provided');
    }

    const primary = repoList[0][1];
    const additionalInputs = repoList.slice(1).map(([k, art]) => art);

    const combinedBuildAction = new cpactions.CodeBuildAction({
      actionName: 'Combined-Build',
      project: combinedProject,
      input: primary,
      additionalInputs, // <-- multiple artifacts available to the single build job
      outputs: [new codepipeline.Artifact('CombinedBuildOutput')],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [combinedBuildAction],
    });

    // downstream stages can use CombinedBuildOutput
  }
}