import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';

export type EnableDisable = 'enable' | 'disable';

export interface TransitGatewayConstructProps {
  envName: string;
  amazonSideAsn?: number;
  autoAcceptSharedAttachments?: EnableDisable;
  defaultRouteTableAssociation?: EnableDisable;
  defaultRouteTablePropagation?: EnableDisable;
  tags?: { key: string; value: string }[];
}

/**
 * TransitGatewayConstruct (L1)
 * - Creates an AWS::EC2::TransitGateway resource.
 * - Validates and normalizes envName.
 * - Applies tags consistently and emits a CfnOutput with a safer exportName.
 *
 * Notes:
 * - Transit Gateway creation incurs costs. If used cross-account, ensure you handle
 *   acceptance and permissions correctly.
 * - This construct does NOT create attachments, associations, or routes — those must
 *   be created separately (see TgwAttachmentConstruct and route table updates).
 */
export class TransitGatewayConstruct extends Construct {
  public readonly transitGateway: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: TransitGatewayConstructProps) {
    super(scope, id);

    if (!props) {
      throw new Error('TransitGatewayConstruct props are required.');
    }
    if (!props.envName || props.envName.trim().length === 0) {
      throw new Error('props.envName is required and must be a non-empty string.');
    }

    // Normalize envName for safe use in ids/tags/export names
    const env = props.envName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');

    // Basic validation for amazonSideAsn (positive integer). For stricter range checks,
    // adjust as needed based on desired ASN range (16-bit/32-bit).
    if (props.amazonSideAsn !== undefined) {
      if (!Number.isInteger(props.amazonSideAsn) || props.amazonSideAsn <= 0) {
        throw new Error('amazonSideAsn must be a positive integer when provided.');
      }
    }

    // Validate tags shape if provided
    if (props.tags) {
      props.tags.forEach((t, idx) => {
        if (!t || typeof t.key !== 'string' || typeof t.value !== 'string') {
          throw new Error(`tags[${idx}] must be an object with string key and value.`);
        }
      });
    }

    // Build default tags (merged with any provided)
    const defaultTags: { key: string; value: string }[] = [
      { key: 'Name', value: `TransitGateway-${env}` },
      { key: 'Environment', value: env },
    ];
    const mergedTags = props.tags ? [...defaultTags, ...props.tags] : defaultTags;

    this.transitGateway = new ec2.CfnTransitGateway(this, `TransitGateway-${env}`, {
      description: `Transit Gateway for ${env} environment`,
      amazonSideAsn: props.amazonSideAsn ?? 64512,
      autoAcceptSharedAttachments: props.autoAcceptSharedAttachments ?? 'enable',
      defaultRouteTableAssociation: props.defaultRouteTableAssociation ?? 'enable',
      defaultRouteTablePropagation: props.defaultRouteTablePropagation ?? 'enable',
      tags: mergedTags,
    });

    // Also add tags via CDK tagging (helps ensure tags apply consistently across resources)
    mergedTags.forEach(t => cdk.Tags.of(this.transitGateway).add(t.key, t.value));

    // Use stack name in export to reduce global collisions
    const stackName = cdk.Stack.of(this).stackName;
    const exportName = `${env}-${stackName}-TransitGatewayId`;

    new cdk.CfnOutput(this, 'TransitGatewayId', {
      value: this.transitGateway.ref,
      exportName,
      description: `Transit Gateway Id for ${env}`,
    });
  }
}
