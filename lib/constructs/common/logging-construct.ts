import { Construct } from 'constructs';
import {
  aws_logs as logs,
  Tags,
  CfnOutput,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib';

/**
 * LoggingConstructProps
 *
 * - envName: environment indicator (dev/staging/prod)
 * - retentionDays: optional explicit retention; if omitted, a sensible default is chosen based on envName
 * - createOutput: if true the construct will create a CfnOutput for the log group name (disabled by default)
 * - logGroupNamePrefix: optional override for the log group physical name prefix
 */
export interface LoggingConstructProps {
  readonly envName: string;
  readonly retentionDays?: logs.RetentionDays;
  readonly createOutput?: boolean;
  readonly logGroupNamePrefix?: string;
}

export class LoggingConstruct extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LoggingConstructProps) {
    super(scope, id);

    // Basic validation
    if (!props || !props.envName) {
      throw new Error('envName is required for LoggingConstruct');
    }

    // Determine sensible defaults by environment
    const envName = props.envName;
    const defaultRetention =
      props.retentionDays ??
      (envName === 'prod' ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_WEEK);

    const removalPolicy = envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Build a safer log group name to avoid collisions across stacks/apps.
    // If logGroupNamePrefix is provided it will be used, otherwise include the stack name.
    // Example: /cdk/<stack-name>/<env>/network
    const stackName = Stack.of(this).stackName;
    const logGroupName =
      props.logGroupNamePrefix ?? `/cdk/${stackName}/${envName}/network`;

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName,
      retention: defaultRetention,
      removalPolicy,
    });

    // Tags -- keep keys consistent with other stacks/constructs
    Tags.of(this.logGroup).add('Project', 'your-project'); // replace with real project id
    Tags.of(this.logGroup).add('Environment', envName);
    Tags.of(this.logGroup).add('Name', `${stackName}-network-${envName}`);

    // Output creation is optional. Prefer creating outputs at the stack-level (in Stack classes)
    // to avoid duplicated exports when constructs are reused. If you enable output here we make the
    // export name unique by including env + stackName.
    if (props.createOutput) {
      new CfnOutput(this, 'LogGroupNameOutput', {
        value: this.logGroup.logGroupName,
        description: `The log group name for environment ${envName}`,
        exportName: `${envName}-${stackName}-LogGroupName`,
      });
    }
  }
}
