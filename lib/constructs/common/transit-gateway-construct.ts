import { Construct } from 'constructs';
import { aws_ec2 as ec2, CfnOutput, Tags } from 'aws-cdk-lib';

export interface TransitGatewayConstructProps {
  envName: string;
  amazonSideAsn?: number;
  autoAcceptSharedAttachments?: string;
  defaultRouteTableAssociation?: string;
  defaultRouteTablePropagation?: string;
  tags?: { key: string; value: string }[];
}

export class TransitGatewayConstruct extends Construct {
  public readonly transitGateway: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: TransitGatewayConstructProps) {
    super(scope, id);

    this.transitGateway = new ec2.CfnTransitGateway(this, `TransitGateway-${props.envName}`, {
      description: `Transit Gateway for ${props.envName} environment`,
      amazonSideAsn: props.amazonSideAsn ?? 64512,
      autoAcceptSharedAttachments: props.autoAcceptSharedAttachments ?? 'enable',
      defaultRouteTableAssociation: props.defaultRouteTableAssociation ?? 'enable',
      defaultRouteTablePropagation: props.defaultRouteTablePropagation ?? 'enable',
      tags: props.tags ?? [
        { key: 'Name', value: `TransitGateway-${props.envName}` },
        { key: 'Environment', value: props.envName },
      ],
    });

    new CfnOutput(this, 'TransitGatewayId', {
      value: this.transitGateway.ref,
      exportName: `TransitGatewayId-${props.envName}`,
    });
  }
}