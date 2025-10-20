import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface RepoSpec {
  id: string; // logical id / identifier for artifact names (no spaces)
  owner: string;
  repo: string;
  branch?: string;
}

export interface MultiRepoPipelineProps extends cdk.StackProps {
  connectionArn: string; // CodeStar Connection ARN for GitHub
  repos: RepoSpec[];     // list of repos to include in pipeline
}

export class MultiRepoPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MultiRepoPipelineProps) {
    super(scope, id, props);

    const pipeline = new codepipeline.Pipeline(this, 'MultiRepoPipeline', {
      pipelineName: 'multi-repo-pipeline',
      restartExecutionOnUpdate: true,
    });

    // Create artifacts and source actions
    const sourceArtifacts = new Map<string, codepipeline.Artifact>();
    const sourceActions: cpactions.Action[] = [];

    for (const r of props.repos) {
      const artifact = new codepipeline.Artifact(`${r.id}Source`);
      sourceArtifacts.set(r.id, artifact);

      const sourceAction = new cpactions.CodeStarConnectionsSourceAction({
        actionName: `${r.id}-Source`,
        connectionArn: props.connectionArn,
        owner: r.owner,
        repo: r.repo,
        branch: r.branch ?? 'main',
        output: artifact,
      });

      sourceActions.push(sourceAction);
    }

    // Add source stage with multiple source actions (parallel)
    pipeline.addStage({
      stageName: 'Source',
      actions: sourceActions,
    });

    // Build stage: create a CodeBuild project and action per repo
    const buildActions: cpactions.Action[] = [];

    for (const r of props.repos) {
      const inputArtifact = sourceArtifacts.get(r.id)!;

      const project = new codebuild.PipelineProject(this, `${r.id}BuildProject`, {
        projectName: `${r.id}-build`,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          privileged: false,
        },
        environmentVariables: {
          REPO_ID: { value: r.id },
        },
        // Each repo should include a buildspec.yml at its root; alternatively use BuildSpec.fromObject({...})
        buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      });

      // Minimal broad permissions for examples; tighten for production
      project.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'cloudformation:*',
          's3:*',
          'iam:*',
          'lambda:*',
          'sts:AssumeRole',
        ],
        resources: ['*'],
      }));

      const buildAction = new cpactions.CodeBuildAction({
        actionName: `${r.id}-Build`,
        project,
        input: inputArtifact,
        outputs: [new codepipeline.Artifact(`${r.id}BuildOutput`)],
      });

      buildActions.push(buildAction);
    }

    pipeline.addStage({
      stageName: 'Build',
      actions: buildActions,
    });

    // Add further stages (Test, Deploy) as you need, consuming the per-repo build outputs
  }
}