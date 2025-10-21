import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep, CodeBuildStep, // ManualApprovalStep
} from 'aws-cdk-lib/pipelines';
import { MyCdkAppStage } from './my-cdk-app-stage'; // You must define this file for your app's main stack

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline', // consider adding env/project suffix to avoid collisions
      // If the repo is different, make this value configurable via context or env.
      synth: new ShellStep('Synth', {
        // NOTE: confirm repository name is correct. The repo in this workspace appears to be "AWS-CDK-Deployment-1a".
        input: CodePipelineSource.gitHub('jmetzdorf7/AWS-CDK-Deployment-1a', 'main', {
          authentication: SecretValue.secretsManager('GITHUB_TOKEN_NAME'), // ensure secret exists and pipeline role can read it
        }),
        installCommands: [
          'npm ci',
        ],
        commands: [
          'npm run build',
          'npx cdk synth',
        ],
        // If your cdk.out lives in a subdir (monorepo), set primaryOutputDirectory: 'path/to/output'
      }),
      // you can set selfMutation: true/false explicitly if you want to be explicit about pipeline self-mutation behavior
    });

    // Deploy to Dev
    // Note: MyCdkAppStage currently derives envName from the Stage id (downcased).
    // Ensure the Stage id maps to allowed env names in MainStack (e.g., 'Dev' -> 'dev').
    const devStage = pipeline.addStage(new MyCdkAppStage(this, 'Dev', {
      env: { account: '111111111111', region: 'us-east-1' },
    }));

    // Deploy to Prod (after manual approval)
    const prodStage = pipeline.addStage(new MyCdkAppStage(this, 'Prod', {
      env: { account: '222222222222', region: 'us-east-1' },
    }));
    // Optional: Add manual approval before prod
    // If you enable this, uncomment the ManualApprovalStep import above
    // prodStage.addPre(new ManualApprovalStep('PromoteToProd'));
  }
}
