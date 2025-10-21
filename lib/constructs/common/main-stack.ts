import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcConstruct } from './vpc-construct';
import { TransitGatewayConstruct } from './transit-gateway-construct';
import { TgwAttachmentConstruct } from './tgw-attachment-construct';
import { LoggingConstruct } from './logging-construct';
import { ApiGatewayConstruct } from './api-gateway-construct';
import { IamConstruct } from './iam-construct';
import { S3Construct } from './s3-construct';
import { Ec2Construct } from './ec2-construct';

export interface MainStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly description?: string; // Added to support stack description
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
        `Invalid environment name: "${props.envName}". Allowed values: ${allowedEnvs.join(', ')}`
      );
    }

    // Logging
    const logging = new LoggingConstruct(this, 'LoggingConstruct', {
      envName: props.envName,
      ...(props.env ? { env: props.env } : {}),
    });

    // VPC
    const vpcConstruct = new VpcConstruct(this, 'VpcConstruct', {
      envName: props.envName,
      ...(props.env ? { env: props.env } : {}),
    });

    // Transit Gateway
    const tgwConstruct = new TransitGatewayConstruct(this, 'TgwConstruct', {
      ...(props.env ? { env: props.env } : {}),
    });

    // TGW Attachment
    const tgwAttachment = new TgwAttachmentConstruct(this, 'TgwAttachmentConstruct', {
      vpc: vpcConstruct.vpc,
      transitGatewayId: tgwConstruct.transitGateway.ref,
      ...(props.env ? { env: props.env } : {}),
    });
    tgwAttachment.node.addDependency(tgwConstruct);
    tgwAttachment.node.addDependency(vpcConstruct);

    // API Gateway
    const apiGateway = new ApiGatewayConstruct(this, 'ApiGatewayConstruct', {
      envName: props.envName,
      ...(props.env ? { env: props.env } : {}),
    });

    // IAM
    const iam = new IamConstruct(this, 'IamConstruct', {
      envName: props.envName,
      ...(props.env ? { env: props.env } : {}),
    });

    // S3
    const s3 = new S3Construct(this, 'S3Construct', {
      envName: props.envName,
      ...(props.env ? { env: props.env } : {}),
    });

    // EC2
    const ec2 = new Ec2Construct(this, 'Ec2Construct', {
      envName: props.envName,
      vpc: vpcConstruct.vpc,
      ...(props.env ? { env: props.env } : {}),
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpcConstruct.vpc.vpcId,
      exportName: `${props.envName}-${this.stackName}-VpcId`,
    });

    if (s3.bucket) {
      new cdk.CfnOutput(this, 'S3BucketName', {
        value: s3.bucket.bucketName,
        exportName: `${props.envName}-${this.stackName}-S3BucketName`,
      });
    }
    if (apiGateway.api && (apiGateway as any).api.url) {
      new cdk.CfnOutput(this, 'ApiGatewayUrl', {
        value: (apiGateway as any).api.url,
        exportName: `${props.envName}-${this.stackName}-ApiGatewayUrl`,
      });
    }

    // Tags
    cdk.Tags.of(this).add('Project', 'your-project');
    cdk.Tags.of(this).add('Environment', props.envName);

    if (logging && (logging as any).logGroup) {
      const lg = (logging as any).logGroup;
      try {
        cdk.Tags.of(lg).add('Environment', props.envName);
      } catch {
        // Some constructs expose resources differently; tagging may not be possible in all cases.
      }
    }
  }
}
