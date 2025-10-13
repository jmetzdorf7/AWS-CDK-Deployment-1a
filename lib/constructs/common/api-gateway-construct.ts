import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';

export interface ApiGatewayConstructProps {
  envName: string;
  s3BucketName: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    const helloLambda = new lambda.Function(this, `HelloLambda-${props.envName}`, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/hello'),
      environment: {
        ENV_NAME: props.envName,
      },
    });

    helloLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:ListBucket',
        's3:GetObject',
      ],
      resources: [
        `arn:aws:s3:::${props.s3BucketName}`,
        `arn:aws:s3:::${props.s3BucketName}/*`
      ],
    }));

    this.api = new apigateway.RestApi(this, `ApiGateway-${props.envName}`, {
      restApiName: `ServiceApi-${props.envName}`,
      description: `API Gateway for ${props.envName} environment`,
      deployOptions: {
        stageName: props.envName,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        // Optionally add accessLogDestination/accessLogFormat for advanced logging
      },
    });

    const helloResource = this.api.root.addResource('hello');
    helloResource.addMethod('GET', new apigateway.LambdaIntegration(helloLambda));

    // Outputs
    new cdk.CfnOutput(this, `ApiUrl-${props.envName}`, {
      value: this.api.url,
    });

    // Tagging
    cdk.Tags.of(this.api).add('Environment', props.envName);
    cdk.Tags.of(helloLambda).add('Environment', props.envName);
  }
}