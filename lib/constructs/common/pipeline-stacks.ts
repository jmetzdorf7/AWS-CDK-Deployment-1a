import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep, CodeBuildStep } from 'aws-cdk-lib/pipelines';
import { MyCdkAppStage } from './my-cdk-app-stage'; // You must define this file for your app's main stack

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.gitHub('jmetzdorf7/AWS-CDK-Deployment', 'main', {
          authentication: SecretValue.secretsManager('GITHUB_TOKEN_NAME'),
        }),
        installCommands: [
          'npm ci',
        ],
        commands: [
          'npm run build',
          'npx cdk synth',
        ],
      }),
    });

    // Deploy to Dev
    const devStage = pipeline.addStage(new MyCdkAppStage(this, 'Dev', {
      env: { account: '111111111111', region: 'us-east-1' },
    }));

    // Deploy to Prod (after manual approval)
    const prodStage = pipeline.addStage(new MyCdkAppStage(this, 'Prod', {
      env: { account: '222222222222', region: 'us-east-1' },
    }));
    // Optional: Add manual approval before prod
    // prodStage.addPre(new ManualApprovalStep('PromoteToProd'));
  }
}