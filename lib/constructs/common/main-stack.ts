import * as cdk from 'aws-cdk-lib';
import { CustomConstruct } from 'lib/custom-constructs.ts';

import { VpcConstruct } from '';
import { TransitGatewayConstruct } from '';
import { TgwAttachmentConstruct } from '';
import { LoggingConstruct } from '';
import { ApiGatewayConstruct } from '';
import { IamConstruct } from '';
import { S3Construct } from '';
import { Ec2Construct } from '';

export interface MainStackProps extends cdk.StackProps {
  envName: string;
  description?: string; // Added to support stack description
}

export class MainStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, {
      ...props,
      description: props.description,
    });

    // Validate Environment
    const allowedEnvs = ['dev', 'staging', 'prod'];
    if (!allowedEnvs.includes(props.envName)) {
      throw new Error(
        `Invalid environment name: ${props.envName}. Allowed values: ${allowedEnvs.join(', ')}`
      );
    }

    // Logging
    const logging = new LoggingConstruct(this, 'LoggingConstruct', {
      envName: props.envName,
    });

    // VPC
    const vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
      envName: props.envName,
    });

    // Transit Gateway
    const tgwConstruct = new TransitGatewayConstruct(this, 'TgwConstruct');

    // TGW Attachment
    new TgwAttachmentConstruct(this, 'TgwAttachmentConstruct', {
      vpc: vpcConstruct.vpc,
      transitGatewayId: tgwConstruct.transitGateway.ref,
    });

    // API Gateway
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGatewayConstruct', {
      envName: props.envName,
    });

    // IAM
    const iam = new IamConstruct(this, 'IamConstruct', {
      envName: props.envName,
    });

    // S3
    const s3 = new S3Construct(this, 'S3Construct', {
      envName: props.envName,
    });

    // EC2
    const ec2 = new Ec2Construct(this, 'Ec2Construct', {
      envName: props.envName,
      vpc: vpcConstruct.vpc,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpcConstruct.vpc.vpcId,
      exportName: `${props.envName}-VpcId`,
    });

    // Example: Export S3 bucket name and API Gateway endpoint as outputs (if available)
    if (s3.bucket) {
      new cdk.CfnOutput(this, 'S3BucketName', {
        value: s3.bucket.bucketName,
        exportName: `${props.envName}-S3BucketName`,
      });
    }
    if (apiGateway.api && apiGateway.api.url) {
      new cdk.CfnOutput(this, 'ApiGatewayUrl', {
        value: apiGateway.api.url,
        exportName: `${props.envName}-ApiGatewayUrl`,
      });
    }

    // Tags
    cdk.Tags.of(this).add('Environment', props.envName);
    cdk.Tags.of(this).add('LogGroup', logging.logGroup.logGroupName);
  }
}