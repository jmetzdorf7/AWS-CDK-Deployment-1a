import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';

export interface TgwAttachmentConstructProps {
  vpc: ec2.Vpc;
  transitGatewayId: string;
  envName: string;
}

/**
 * Creates a Transit Gateway VPC attachment.
 * Notes:
 * - Picks up to one subnet per AZ (deduplicated) from the VPC private subnets.
 * - Validates inputs and emits an output with a safer exportName including env and stack.
 * - Does NOT create route table entries or TGW route propagation — you must add those separately.
 */
export class TgwAttachmentConstruct extends Construct {
  public readonly attachment: ec2.CfnTransitGatewayAttachment;

  constructor(scope: Construct, id: string, props: TgwAttachmentConstructProps) {
    super(scope, id);

    // Basic validation
    if (!props) {
      throw new Error('props are required.');
    }
    if (!props.transitGatewayId || props.transitGatewayId.trim().length === 0) {
      throw new Error('transitGatewayId is required.');
    }
    if (!props.vpc) {
      throw new Error('vpc is required.');
    }
    if (!props.envName || props.envName.trim().length === 0) {
      throw new Error('envName is required.');
    }

    // Normalize env name for tags and IDs
    const env = props.envName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Ensure there are private subnets available
    const privateSubnets = props.vpc.privateSubnets ?? [];
    if (privateSubnets.length === 0) {
      throw new Error('VPC must have at least one private subnet to attach to the Transit Gateway.');
    }

    // Choose up to one subnet per AZ: dedupe by availabilityZone to avoid multiple subnets in same AZ.
    // Keep order stable by using Map keyed by AZ and preserving first-seen subnet.
    const subnetByAz = new Map<string | undefined, string>();
    for (const s of privateSubnets) {
      // availabilityZone can be a token; using the string value when available is ideal.
      const az = s.availabilityZone;
      if (!subnetByAz.has(az)) {
        subnetByAz.set(az, s.subnetId);
      }
    }
    const subnetIds = Array.from(subnetByAz.values());
    if (subnetIds.length === 0) {
      throw new Error('No usable subnet IDs could be resolved for TGW attachment.');
    }

    // Create the TGW attachment
    this.attachment = new ec2.CfnTransitGatewayAttachment(this, 'TgwAttachment', {
      transitGatewayId: props.transitGatewayId,
      vpcId: props.vpc.vpcId,
      subnetIds,
      tags: [
        {
          key: 'Name',
          value: `tgw-attachment-${env}-${id}`,
        },
        {
          key: 'Environment',
          value: env,
        },
      ],
    });

    // Export name: include env and stack name to reduce global collisions
    const stackName = cdk.Stack.of(this).stackName;
    const exportName = `${env}-${stackName}-TgwAttachmentId-${id}`;

    new cdk.CfnOutput(this, 'TgwAttachmentId', {
      value: this.attachment.ref,
      description: 'The ID of the Transit Gateway Attachment',
      exportName,
    });
  }
}
