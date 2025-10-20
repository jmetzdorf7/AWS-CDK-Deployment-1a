#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiRepoPipelineStack } from '../lib/stacks/cicd-pipeline-stack';
import { CombinedBuildPipelineStack } from '../lib/stacks/combined-build-pipeline-stack';

const app = new cdk.App();

// Provide your CodeStar Connections ARN as a cdk context variable or environment variable
const connectionArn = app.node.tryGetContext('connectionArn') ||
  process.env.CODESTAR_CONNECTION_ARN || 'arn:aws:codestar-connections:REGION:ACCOUNT:connection/CONNECTION_ID';

// List the repositories you want in the pipelines
const repos = [
  { id: 'service-a', owner: 'myorg', repo: 'service-a', branch: 'main' },
  { id: 'service-b', owner: 'myorg', repo: 'service-b', branch: 'main' },
  // add more repos as needed
];

new MultiRepoPipelineStack(app, 'MultiRepoPipelineStack', {
  connectionArn,
  repos,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new CombinedBuildPipelineStack(app, 'CombinedBuildPipelineStack', {
  connectionArn,
  repos,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

app.synth();