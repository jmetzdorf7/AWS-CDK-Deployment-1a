import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
  ObjectOwnership,
  BucketProps,
} from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy, Duration, Tags } from 'aws-cdk-lib';

export interface TemplateBucketStackProps extends cdk.StackProps {
  /**
   * Environment name (e.g. 'dev', 'staging', 'prod').
   * Used to choose sensible defaults for lifecycle and retention.
   */
  readonly envName?: string;

  /**
   * If provided, forces the removal policy regardless of envName.
   * - true  => RemovalPolicy.RETAIN (keep objects)
   * - false => RemovalPolicy.DESTROY (remove objects, use with caution)
   */
  readonly forceRetain?: boolean;
}

/**
 * TemplateBucketStack
 *
 * - Versioning enabled to keep object history (useful for templates).
 * - SSE-S3 encryption by default; change to KMS if cross-account encryption or key control is required.
 * - BlockPublicAccess.BLOCK_ALL to prevent accidental exposure.
 * - ObjectOwnership.BUCKET_OWNER_ENFORCED to ensure bucket-owner control over uploaded objects.
 * - lifecycleRules to cleanup old noncurrent versions and reduce storage costs.
 * - RemovalPolicy: DESTROY for dev (with autoDeleteObjects), RETAIN for non-dev by default.
 */
export class TemplateBucketStack extends cdk.Stack {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props?: TemplateBucketStackProps) {
    super(scope, id, props);

    const envName = props?.envName ?? process.env.STAGE ?? 'dev';
    const isDev = envName === 'dev';

    // Default removal policy: keep data in non-dev, allow destroy in dev for easy cleanup.
    const removalPolicy =
      props?.forceRetain === true
        ? RemovalPolicy.RETAIN
        : isDev
        ? RemovalPolicy.DESTROY
        : RemovalPolicy.RETAIN;

    // autoDeleteObjects is only meaningful when RemovalPolicy.DESTROY
    const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;

    // S3 bucket props
    const bucketProps: BucketProps = {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy,
      autoDeleteObjects,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      // Keep a lifecycle rule for noncurrent versions to limit storage growth.
      lifecycleRules: [
        {
          // Transition/delete noncurrent versions after 30 days (adjust as needed).
          noncurrentVersionExpiration: Duration.days(30),
        },
      ],
    };

    // Use a friendly construct id (avoid Cfn-prefixed ids unless you need the L1 resource)
    this.bucket = new Bucket(this, 'TemplatesBucket', bucketProps);

    // Tags
    Tags.of(this).add('Project', 'your-project'); // replace with real project id
    Tags.of(this).add('Environment', envName);

    // Output a stable export name including env to reduce chance of collision
    new cdk.CfnOutput(this, 'TemplateBucketName', {
      value: this.bucket.bucketName,
      exportName: `${envName}-${this.stackName}-TemplateBucketName`,
      description: `S3 bucket for storing templates (${envName})`,
    });
  }
}
