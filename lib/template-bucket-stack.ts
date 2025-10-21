import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';

export class TemplateBucketStack extends cdk.Stack {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.bucket = new Bucket(this, 'CfnTemplatesBucket', {
      versioned: true,                        // enable S3 versioning
      encryption: BucketEncryption.S3_MANAGED,// SSE-S3 to avoid extra KMS permissions
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,    // keep data if stack is deleted
      enforceSSL: true,
    });

    new cdk.CfnOutput(this, 'TemplateBucketName', {
      value: this.bucket.bucketName,
      exportName: `${this.stackName}-TemplateBucketName`,
    });
  }
}
