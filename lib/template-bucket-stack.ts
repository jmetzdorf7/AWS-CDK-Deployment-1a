import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TemplateBucketStack } from '../lib/template-bucket-stack';

describe('TemplateBucketStack removalPolicy behavior', () => {
  test('dev stack uses RemovalPolicy.DESTROY (DeletionPolicy: Delete)', () => {
    const app = new cdk.App();
    const stack = new TemplateBucketStack(app, 'DevTemplateBucketStack', {
      envName: 'dev',
    });

    const template = Template.fromStack(stack);
    const json = template.toJSON();

    const bucketEntries = Object.entries(json.Resources).filter(
      ([_, r]) => (r as any).Type === 'AWS::S3::Bucket'
    );

    expect(bucketEntries.length).toBeGreaterThan(0);

    // Pick first S3 bucket resource and assert its DeletionPolicy is Delete
    const [, bucketResource] = bucketEntries[0];
    expect((bucketResource as any).DeletionPolicy).toBe('Delete');
  });

  test('prod stack uses RemovalPolicy.RETAIN (DeletionPolicy: Retain)', () => {
    const app = new cdk.App();
    const stack = new TemplateBucketStack(app, 'ProdTemplateBucketStack', {
      envName: 'prod',
    });

    const template = Template.fromStack(stack);
    const json = template.toJSON();

    const bucketEntries = Object.entries(json.Resources).filter(
      ([_, r]) => (r as any).Type === 'AWS::S3::Bucket'
    );

    expect(bucketEntries.length).toBeGreaterThan(0);

    // Pick first S3 bucket resource and assert its DeletionPolicy is Retain
    const [, bucketResource] = bucketEntries[0];
    expect((bucketResource as any).DeletionPolicy).toBe('Retain');
  });
});
