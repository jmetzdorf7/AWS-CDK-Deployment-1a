import { Construct } from 'constructs';
import { 
  aws_logs as logs, 
  Tags, 
  CfnOutput, 
  RemovalPolicy 
} from 'aws-cdk-lib';

export interface LoggingConstructProps {
  envName: string;
  retentionDays?: logs.RetentionDays;
}

export class LoggingConstruct extends Construct {
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: LoggingConstructProps) {
    super(scope, id);

    // Validation
    if (!props.envName) {
      throw new Error('envName is required for LoggingConstruct');
    }

    this.logGroup = new logs.LogGroup(this, `LogGroup-${props.envName}`, {
      logGroupName: `/cdk/${props.envName}/network`,
      retention: props.retentionDays ?? logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Tagging
    Tags.of(this.logGroup).add('Environment', props.envName);
    Tags.of(this.logGroup).add('Name', `LogGroup-${props.envName}`);

    // Outputs
    new CfnOutput(this, `LogGroupNameOutput-${props.envName}`, {
      value: this.logGroup.logGroupName,
      description: `The log group name for environment ${props.envName}`,
    });
  }
}