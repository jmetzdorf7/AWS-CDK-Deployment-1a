import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MainStack, MainStackProps } from './main-stack';

export class MyCdkAppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps & Partial<MainStackProps>) {
    super(scope, id, props);

    // You can pass environment-specific parameters here if needed
    new MainStack(this, 'MainStack', {
      envName: id.toLowerCase(),
      env: props?.env,
      stackName: `MainStack-${id.toLowerCase()}`,
      description: `Main infrastructure stack for ${id.toLowerCase()} environment`,
    });
  }
}