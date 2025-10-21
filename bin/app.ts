#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { App, Environment, Tags } from 'aws-cdk-lib';
import { MainStack, MainStackProps } from '../lib/constructs/common/main-stack';
import { TemplateBucketStack, TemplateBucketStackProps } from '../lib/template-bucket-stack';

/**
 * CDK entrypoint — keep this file thin:
 * - Resolve context/env
 * - Add global tags
 * - Instantiate stacks (pass resolved props)
 *
 * Precedence for stage/envName:
 *   --context stage=... > app.node.tryGetContext('env') > process.env.STAGE > 'dev'
 *
 * Template bucket forceRetain flag:
 *   --context templateBucket.forceRetain=true OR TEMPLATE_BUCKET_FORCE_RETAIN=true
 */

const app = new App();

// Resolve deployment stage with sensible precedence
const envName = (
  (app.node.tryGetContext('stage') as string) ||
  (app.node.tryGetContext('env') as string) ||
  process.env.STAGE ||
  'dev'
) as string;

// Resolve account/region from environment variables (allow undefined for synth)
const account = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION;

// Enforce account/region only for production deployments
if ((!account || !region) && envName === 'prod') {
  throw new Error(
    'For prod deployments, CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION must be set (or pass via --context).'
  );
}

if (!account || !region) {
  // Allow synth or local dev workflows without explicit account/region
  console.warn(
    'CDK account/region are not set. Stacks will be environment-agnostic (recommended for local synth).'
  );
}

// Use CDK Environment typing; undefined means "environment-agnostic"
const awsEnv: Environment | undefined = account && region ? { account, region } : undefined;

// Global tags (replace 'your-project' with your project identifier)
Tags.of(app).add('project', 'your-project');
Tags.of(app).add('env', envName);

// Prepare MainStack props
const mainStackProps: MainStackProps = {
  envName,
  env: awsEnv,
  stackName: `MainStack-${envName}`,
  description: `Main infrastructure stack for ${envName} environment`,
};

// Instantiate MainStack
new MainStack(app, `${envName}-MainStack`, mainStackProps);

// Determine template bucket options from context or environment
const templateForceRetainContext = app.node.tryGetContext('templateBucket')?.forceRetain;
const templateForceRetainEnv = process.env.TEMPLATE_BUCKET_FORCE_RETAIN;
const forceRetain =
  typeof templateForceRetainContext !== 'undefined'
    ? Boolean(templateForceRetainContext)
    : typeof templateForceRetainEnv !== 'undefined'
    ? templateForceRetainEnv.toLowerCase() === 'true'
    : undefined;

// Build TemplateBucketStack props
const templateProps: TemplateBucketStackProps = {
  envName,
  ...(typeof forceRetain !== 'undefined' ? { forceRetain } : {}),
  env: awsEnv,
};

// Instantiate TemplateBucketStack as a separate stack
new TemplateBucketStack(app, `${envName}-TemplateBucketStack`, templateProps);

app.synth();
