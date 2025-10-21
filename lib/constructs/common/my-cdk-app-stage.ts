import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { MainStack, MainStackProps } from './main-stack';

export class MyCdkAppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps & Partial<MainStackProps>) {
    super(scope, id, props);

    // Prefer an explicit envName from props, otherwise derive from the Stage id.
    // Sanitize to lower-case alphanumerics and dashes to avoid invalid characters.
    const derivedEnvName = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const envName = (props as Partial<MainStackProps>)?.envName ?? derivedEnvName;

    // Build main stack props explicitly to avoid passing StageProps fields accidentally.
    const mainStackProps: Partial<MainStackProps> = {
      ...(props as Partial<MainStackProps>), // allow overriding other MainStackProps if provided
      envName,
      env: props?.env, // stage env -> stack env (account/region). Keep this explicit.
      description: `Main infrastructure stack for ${envName} environment`,
    };

    // Only set a fixed stackName if it's explicitly provided in props; otherwise let CDK generate it.
    if ((props as any)?.stackName) {
      (mainStackProps as any).stackName = (props as any).stackName;
    }

    new MainStack(this, 'MainStack', mainStackProps as MainStackProps);
  }
}
