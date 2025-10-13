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
  // CIDR validation 
  if (props.cidr !== undefined) {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
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
  // Additional Subnets validation 
  //   if (props.additionalSubnetConfiguration) {
    if (!Array.isArray(props.additionalSubnetConfiguration)) {
      throw new Error('additionalSubnetConfiguration must be an array.');
    }
    // Check for duplicate names
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

    const defaultSubnets: ec2.SubnetConfiguration[] = [
      {
        name: `${props.envName}-Public`,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        name: `${props.envName}-Private`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        name: `${props.envName}-Isolated`,
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }
    ];

    const subnetConfiguration = [
      ...defaultSubnets,
      ...(props.additionalSubnetConfiguration ?? [])
    ];

    this.vpc = new ec2.Vpc(this, `Vpc-${props.envName}`, {
      cidr: props.cidr ?? '10.0.0.0/16',
      maxAzs: props.maxAzs ?? 2,
      natGateways: props.natGateways ?? 1,
      subnetConfiguration,
    });

    // Tagging
    cdk.Tags.of(this.vpc).add('Environment', props.envName);
    if (props.tags) {
      Object.entries(props.tags).forEach(([k, v]) =>
        cdk.Tags.of(this.vpc).add(k, v)
      );
    }

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${props.envName}-VpcId`
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }).subnetIds),
      description: 'Public subnet IDs',
      exportName: `${props.envName}-PublicSubnetIds`
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds),
      description: 'Private subnet IDs',
      exportName: `${props.envName}-PrivateSubnetIds`
    });

    new cdk.CfnOutput(this, 'IsolatedSubnetIds', {
      value: cdk.Fn.join(',', this.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds),
      description: 'Isolated subnet IDs',
      exportName: `${props.envName}-IsolatedSubnetIds`
    });
  }
}