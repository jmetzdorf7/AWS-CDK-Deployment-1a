#!/usr/bin/env node
import { CustomConstruct } from '../lib/custom-construct.ts';
import { MainStack, MainStackProps } from '../lib/constructs/common/main-stack.ts';

const app = new cdk.App();

// Get environment name from context or default to 'dev'
const envName: string = app.node.tryGetContext('env') || 'dev';

// Validate AWS environment variables
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

if (!account || !region) {
  throw new Error('CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION must be set.');
}

const awsEnv = {
  account,
  region,
};

// Define stack props
const stackProps: MainStackProps = {
  envName,
  env: awsEnv,
  stackName: `MainStack-${envName}`,
  description: `Main infrastructure stack for ${envName} environment`,
};

// Deploy main stack
new MainStack(app, stackProps.stackName, stackProps);