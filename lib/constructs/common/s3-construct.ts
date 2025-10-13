import { Construct } from 'constructs';
import { Bucket, BucketProps, RemovalPolicy, BucketEncryption, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';

export interface S3ConstructProps {
  envName: string;
  bucketProps?: Partial<BucketProps>; // Allow extensibility for future bucket options
}

/**
 * S3Construct creates an S3 bucket configured for the specified environment.
 * - In production: retains the bucket and disables auto-delete for safety.
 * - In other environments: destroys bucket and auto-deletes objects for easy cleanup.
 */
export class S3Construct extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    // Sanitize envName and node.addr if needed for S3 bucket naming rules
    const bucketName = `cdk-${props.envName.toLowerCase()}-bucket-${this.node.addr}`.replace(/_/g, '-');

    this.bucket = new Bucket(this, `Bucket-${props.envName}`, {
      bucketName,
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== 'prod',
      ...props.bucketProps, // Allow overriding defaults
    });
  }
}