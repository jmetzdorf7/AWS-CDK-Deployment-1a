import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpcConstructProps {
  envName: string;
  maxAzs?: number;
  cidr?: string;
  natGateways?: number;
  tags?: { [key: string]: string };
  additionalSubnetConfiguration?: ec2.SubnetConfiguration[];
}

function validateProps(props: VpcConstructProps) {
  if (!props) {
    throw new Error('Props are required.');
  }

  // envName validation
  if (!props.envName || props.envName.trim().length === 0) {
    throw new Error('envName is required and must be a non-empty string.');
  }

  // maxAzs validation
  if (props.maxAzs !== undefined && (!Number.isInteger(props.maxAzs) || props.maxAzs < 1)) {
    throw new Error('maxAzs must be a positive integer.');
  }

  // natGateways validation
  if (props.natGateways !== undefined && (!Number.isInteger(props.natGateways) || props.natGateways < 0)) {
    throw new Error('natGateways must be a non-negative integer.');
  }

  // CIDR validation (basic, enforces 0-255 octets and mask 0-32)
  if (props.cidr !== undefined) {
    const cidrRegex =
      /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\/([0-9]|[12][0-9]|3[0-2])$/;
    if (!cidrRegex.test(props.cidr)) {
      throw new Error('cidr must be a valid CIDR block (e.g., "10.0.0.0/16").');
    }
  }

  // Tags validation
  if (props.tags) {
    Object.entries(props.tags).forEach(([k, v]) => {
      if (typeof k !== 'string' || typeof v !== 'string') {
        throw new Error('All tag keys and values must be strings.');
      }
      if (k.length > 128 || v.length > 256) {
        throw new Error('Tag key/value too long. Keys: 128 chars max, values: 256 chars max.');
      }
    });
  }

  // Additional Subnets validation (only when provided)
  if (props.additionalSubnetConfiguration !== undefined) {
    if (!Array.isArray(props.additionalSubnetConfiguration)) {
      throw new Error('additionalSubnetConfiguration must be an array if provided.');
    }
    // Each entry must have a non-empty name
    props.additionalSubnetConfiguration.forEach((s, idx) => {
      if (!s || typeof s.name !== 'string' || s.name.trim().length === 0) {
        throw new Error(`additionalSubnetConfiguration[${idx}].name is required and must be a non-empty string.`);
      }
    });
    // Check for duplicate names in additionalSubnetConfiguration
    const allNames = props.additionalSubnetConfiguration.map(s => s.name);
    const nameSet = new Set(allNames);
    if (nameSet.size < allNames.length) {
      throw new Error('Duplicate subnet group names in additionalSubnetConfiguration.');
    }
  }
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    // Validation
    validateProps(props);

    // Normalize env name for IDs / resource naming safety
    const env = props.envName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');

    const defaultSubnets: ec2.SubnetConfiguration[] = [
      {
        name: `${env}-public`,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        name: `${env}-private`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        name: `${env}-isolated`,
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    ];

    // Ensure additional subnet names do not collide with defaults
    const additional = props.additionalSubnetConfiguration ?? [];
    const defaultNames = new Set(defaultSubnets.map(s => s.name));
    additional.forEach(s => {
      if (defaultNames.has(s.name)) {
        throw new Error(`additionalSubnetConfiguration contains a subnet name that conflicts with a default subnet: ${s.name}`);
      }
    });

    const subnetConfiguration = [
      ...defaultSubnets,
      ...additional,
    ];

    // Apply sensible defaults and guard natGateways vs maxAzs
    const maxAzs = props.maxAzs ?? 2;
    let natGateways = props.natGateways ?? 1;
    if (natGateways > maxAzs) {
      // Cap natGateways to maxAzs to avoid surprising multi-AZ NAT gateway creation
      natGateways = maxAzs;
    }

    this.vpc = new ec2.Vpc(this, `Vpc-${env}`, {
      cidr: props.cidr ?? '10.0.0.0/16',
      maxAzs,
      natGateways,
      subnetConfiguration,
    });

    // Tagging - apply provided tags plus Environment
    cdk.Tags.of(this.vpc).add('Environment', env);
    if (props.tags) {
      Object.entries(props.tags).forEach(([k, v]) => {
        cdk.Tags.of(this.vpc).add(k, v);
      });
    }

    const stackName = cdk.Stack.of(this).stackName;

    // Outputs (include stackName in exportName to reduce global-name collisions)
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${env}-${stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).subnetIds),
      description: 'Public subnet IDs',
      exportName: `${env}-${stackName}-PublicSubnetIds`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds),
      description: 'Private subnet IDs',
      exportName: `${env}-${stackName}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'IsolatedSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds),
      description: 'Isolated subnet IDs',
      exportName: `${env}-${stackName}-IsolatedSubnetIds`,
    });
  }
}
