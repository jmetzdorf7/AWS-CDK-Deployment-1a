import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface GsiDefinition {
  readonly indexName: string;
  readonly partitionKey: { name: string; type: dynamodb.AttributeType };
  readonly sortKey?: { name: string; type: dynamodb.AttributeType };
  readonly projectionType?: dynamodb.ProjectionType;
  readonly readCapacity?: number;
  readonly writeCapacity?: number;
}

export interface DatabaseStackProps extends StackProps {
  /**
   * Logical table name. If not provided CDK will generate one.
   */
  readonly tableName?: string;
  /**
   * Partition key name and type (defaults to 'pk' / STRING)
   */
  readonly partitionKeyName?: string;
  readonly partitionKeyType?: dynamodb.AttributeType;
  /**
   * Optional sort key
   */
  readonly sortKeyName?: string;
  readonly sortKeyType?: dynamodb.AttributeType;
  /**
   * Billing mode, default PAY_PER_REQUEST for serverless workloads.
   */
  readonly billingMode?: dynamodb.BillingMode;
  /**
   * If using PROVISIONED, configure initial capacities (defaults shown).
   */
  readonly readCapacity?: number;
  readonly writeCapacity?: number;
  /**
   * Optional TTL attribute name to enable time-to-live.
   */
  readonly ttlAttribute?: string;
  /**
   * Whether to enable PITR (point-in-time restore).
   */
  readonly pointInTimeRecovery?: boolean;
  /**
   * Optional CMK to encrypt the table (if not provided uses AWS-managed key).
   */
  readonly encryptionKey?: kms.IKey;
  /**
   * Removal policy for non-production use (default DESTROY for convenience).
   * For production use RETAIN.
   */
  readonly removalPolicy?: RemovalPolicy;
  /**
   * Any global secondary indexes to create.
   */
  readonly globalSecondaryIndexes?: GsiDefinition[];
}

/**
 * DatabaseStack
 *
 * Creates a DynamoDB table with sensible defaults for serverless use:
 * - PAY_PER_REQUEST billing by default (no capacity management required)
 * - Optional PROVISIONED mode with autoscaling support
 * - Optional TTL, PITR, encryption and GSIs
 * - Exposes outputs for table name and ARN
 */
export class DatabaseStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps = {}) {
    super(scope, id, props);

    const tableName = props.tableName;
    const partitionKeyName = props.partitionKeyName ?? 'pk';
    const partitionKeyType = props.partitionKeyType ?? dynamodb.AttributeType.STRING;
    const sortKeyName = props.sortKeyName;
    const sortKeyType = props.sortKeyType ?? dynamodb.AttributeType.STRING;
    const billingMode = props.billingMode ?? dynamodb.BillingMode.PAY_PER_REQUEST;
    const readCapacity = props.readCapacity ?? 5;
    const writeCapacity = props.writeCapacity ?? 5;
    const ttlAttr = props.ttlAttribute;
    const pitRecovery = props.pointInTimeRecovery ?? false;
    const rmPolicy = props.removalPolicy ?? RemovalPolicy.DESTROY;
    const encryptionKey = props.encryptionKey;

    // Build attribute definitions
    const partitionKey: dynamodb.Attribute = { name: partitionKeyName, type: partitionKeyType };
    const sortKey: dynamodb.Attribute | undefined = sortKeyName ? { name: sortKeyName, type: sortKeyType } : undefined;

    // Create the table
    this.table = new dynamodb.Table(this, 'AppTable', {
      tableName,
      partitionKey,
      sortKey,
      billingMode,
      encryption: encryptionKey ? dynamodb.TableEncryption.CUSTOMER_MANAGED : dynamodb.TableEncryption.AWS_MANAGED,
      encryptionKey,
      pointInTimeRecovery: pitRecovery,
      timeToLiveAttribute: ttlAttr,
      removalPolicy: rmPolicy,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES, // enable if needed for triggers / CDC
    });

    // If PROVISIONED, configure autoscaling for read/write capacity
    if (billingMode === dynamodb.BillingMode.PROVISIONED) {
      const readScaling = this.table.autoScaleReadCapacity({
        minCapacity: Math.max(1, Math.floor(readCapacity / 2)),
        maxCapacity: Math.max(2, readCapacity * 10),
      });
      readScaling.scaleOnUtilization('ReadScalingPolicy', {
        targetUtilizationPercent: 70,
        scaleInCooldown: Duration.seconds(60),
        scaleOutCooldown: Duration.seconds(60),
      });

      const writeScaling = this.table.autoScaleWriteCapacity({
        minCapacity: Math.max(1, Math.floor(writeCapacity / 2)),
        maxCapacity: Math.max(2, writeCapacity * 10),
      });
      writeScaling.scaleOnUtilization('WriteScalingPolicy', {
        targetUtilizationPercent: 70,
        scaleInCooldown: Duration.seconds(60),
        scaleOutCooldown: Duration.seconds(60),
      });
    }

    // Add any provided GSIs
    if (props.globalSecondaryIndexes) {
      for (const gsi of props.globalSecondaryIndexes) {
        this.table.addGlobalSecondaryIndex({
          indexName: gsi.indexName,
          partitionKey: { name: gsi.partitionKey.name, type: gsi.partitionKey.type },
          sortKey: gsi.sortKey ? { name: gsi.sortKey.name, type: gsi.sortKey.type } : undefined,
          projectionType: gsi.projectionType ?? dynamodb.ProjectionType.ALL,
          readCapacity: props.billingMode === dynamodb.BillingMode.PROVISIONED ? gsi.readCapacity ?? 5 : undefined,
          writeCapacity: props.billingMode === dynamodb.BillingMode.PROVISIONED ? gsi.writeCapacity ?? 5 : undefined,
        });
      }
    }

    // Optional: create a basic CloudWatch alarm on ThrottledRequests for operational visibility
    const throttleMetric = this.table.metric('ThrottledRequests', {
      statistic: 'sum',
      period: Duration.minutes(5),
    });

    new cloudwatch.Alarm(this, 'ThrottledAlarm', {
      metric: throttleMetric,
      evaluationPeriods: 1,
      threshold: 1,
      alarmDescription: 'Alarm if any throttled requests in 5 minute window',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Helpful policy snippet: grant read/write to a lambda role if needed
    // Example usage in other stacks:
    // myLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
    //   actions: ['dynamodb:GetItem','dynamodb:PutItem','dynamodb:Query','dynamodb:UpdateItem'],
    //   resources: [this.table.tableArn, `${this.table.tableArn}/*`],
    // }));

    // Outputs
    new CfnOutput(this, 'DynamoTableName', {
      value: this.table.tableName,
      description: 'DynamoDB table name',
    });

    new CfnOutput(this, 'DynamoTableArn', {
      value: this.table.tableArn,
      description: 'DynamoDB table ARN',
    });

    if (this.table.tableStreamArn) {
      new CfnOutput(this, 'DynamoTableStreamArn', {
        value: this.table.tableStreamArn,
        description: 'DynamoDB stream ARN (if enabled)',
      });
    }
  }

  /**
   * Convenience: grant full access to an IAM principal (e.g., a Lambda) - use selectively.
   */
  public grantFullAccess(grantee: iam.IGrantable) {
    this.table.grantFullAccess(grantee);
  }

  /**
   * Convenience: grant read/write access to an IAM principal.
   */
  public grantReadWrite(grantee: iam.IGrantable) {
    this.table.grantReadWriteData(grantee);
  }

  /**
   * Convenience: grant read-only access to an IAM principal.
   */
  public grantReadOnly(grantee: iam.IGrantable) {
    this.table.grantReadData(grantee);
  }
}

