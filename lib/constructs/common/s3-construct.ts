import { Construct } from 'constructs';
import { Bucket, BucketProps, RemovalPolicy, BucketEncryption, BlockPublicAccess } from 'aws-cdk-lib/aws-s3';
import * as crypto from 'crypto';

export interface S3ConstructProps {
  envName: string;
  bucketProps?: Partial<BucketProps>; // Allow extensibility for future bucket options
}

/**
 * S3Construct creates an S3 bucket configured for the specified environment.
 * - By default it DOES NOT set a physical bucketName (safer & portable).
 * - If caller provides bucketProps.bucketName it will be sanitized.
 *
 * Important notes:
 * - S3 bucket names must be globally unique and follow strict rules;
 *   avoid setting a fixed name unless you need determinism across runs.
 * - autoDeleteObjects can be destructive and may behave differently for versioned buckets;
 *   test destroy in a non-prod account before enabling for real workloads.
 */
export class S3Construct extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    const env = (props.envName || 'dev').toLowerCase();

    // Build base defaults
    const defaults: Partial<BucketProps> = {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: env !== 'prod', // caution: autoDeleteObjects + versioned may be problematic
    };

    // Helper: sanitize a provided bucket name to meet S3 rules (best-effort).
    // If the caller needs a guaranteed unique name across accounts/regions, prefer
    // using account/region + short hash, but note tokens may be unresolved at synth time.
    const sanitizeBucketName = (name: string): string => {
      if (!name) return name;
      let n = name.toLowerCase();

      // replace invalid characters with hyphen
      n = n.replace(/[^a-z0-9.-]+/g, '-');

      // replace underscores if any (underscore explicitly not allowed)
      n = n.replace(/_/g, '-');

      // collapse consecutive hyphens/dots
      n = n.replace(/[-.]{2,}/g, '-');

      // trim leading/trailing non-alphanum (S3 names must start/end with letter/number)
      n = n.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');

      // ensure length 3..63
      if (n.length > 63) {
        // keep start, append short hash to ensure some uniqueness
        const hash = crypto.createHash('sha1').update(name).digest('hex').slice(0, 8);
        n = `${n.slice(0, 54)}-${hash}`; // 54 + 1 + 8 = 63
      }
      if (n.length < 3) {
        // pad with hyphens and a short hash
        const hash = crypto.createHash('sha1').update(name).digest('hex').slice(0, 6);
        n = `${n}-${hash}`.slice(0, 3);
      }
      // final cleanup to ensure no leading/trailing hyphen
      n = n.replace(/^-+/, '').replace(/-+$/, '');
      // last check: if empty (defensive), generate a random short name
      if (!n) {
        n = `cdk-bucket-${crypto.randomBytes(4).toString('hex')}`;
      }
      return n;
    };

    // If the caller provided bucketProps.bucketName, sanitize it; otherwise omit to let CDK choose.
    const providedBucketName = props.bucketProps?.bucketName;
    const finalBucketProps: BucketProps = {
      ...defaults,
      ...(props.bucketProps || {}),
      // If bucketProps.bucketName exists, sanitize and set it; otherwise do not pass bucketName
      ...(providedBucketName ? { bucketName: sanitizeBucketName(providedBucketName) } : {}),
    } as BucketProps;

    // Caveat/warning comment: when autoDeleteObjects=true and versioned=true, ensure your CDK version
    // and the cleanup custom resource behave as expected. Consider disabling versioning for dev/test buckets
    // if you rely on auto-delete on destroy.

    this.bucket = new Bucket(this, `Bucket-${env}`, finalBucketProps);
  }
}
