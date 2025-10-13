import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';

export interface TgwAttachmentConstructProps {
  vpc: ec2.Vpc;
  transitGatewayId: string;
  envName: string;
}

export class TgwAttachmentConstruct extends Construct {
  public readonly attachment: ec2.CfnTransitGatewayAttachment;

  constructor(scope: Construct, id: string, props: TgwAttachmentConstructProps) {
    super(scope, id);

    this.attachment = new ec2.CfnTransitGatewayAttachment(this, 'TgwAttachment', {
      transitGatewayId: props.transitGatewayId,
      vpcId: props.vpc.vpcId,
      subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
      tags: [
        {
          key: 'Name',
          value: `TgwAttachment-${id}`,
        },
        {
          key: 'Env',
          value: props.envName,
        },
      ],
    });

    new cdk.CfnOutput(this, 'TgwAttachmentId', {
      value: this.attachment.ref,
      description: 'The ID of the Transit Gateway Attachment',
      exportName: `TgwAttachmentId-${id}`,
    });
  }
}