import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';

export interface VpcConstructProps {
  envName: string;
  maxAzs?: number;
  natGateways?: number; // Optional: allow custom NAT Gateway count
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    // Validation should happen first
    if (!props.envName) {
      throw new Error('envName is required for VpcConstruct');
    }

    this.vpc = new ec2.Vpc(this, `Vpc-${props.envName}`, {
      maxAzs: props.maxAzs ?? 2,
      natGateways: props.natGateways ?? 1,
      subnetConfiguration: [
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
        },
      ],
    });

    // Tagging
    cdk.Tags.of(this.vpc).add('Environment', props.envName);

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${props.envName}-VpcId`,
    });
  }
}