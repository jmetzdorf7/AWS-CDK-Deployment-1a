import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

export interface ApiGatewayConstructProps {
  envName: string;
  s3BucketName: string;
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // Normalize env name and keep it safe for stage/resource ids (MainStack already validates envs)
    const env = (props.envName || 'dev').toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // NOTE: Ensure 'lambda/hello' exists and is packaged correctly. For Node.js lambdas with deps
    // consider using aws-lambda-nodejs's NodejsFunction which bundles using esbuild.
    const helloLambda = new lambda.Function(this, `HelloLambda-${env}`, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/hello'),
      environment: {
        ENV_NAME: env,
      },
    });

    // Least-privilege: scope to bucket and objects. If you know specific prefixes, tighten further.
    helloLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        's3:ListBucket',
        's3:GetObject',
      ],
      resources: [
        `arn:aws:s3:::${props.s3BucketName}`,
        `arn:aws:s3:::${props.s3BucketName}/*`,
      ],
    }));

    // Access/logging configuration
    // Create an explicit LogGroup for API access logs so we can control retention and removal policy.
    const accessLogGroup = new LogGroup(this, `ApiAccessLogGroup-${env}`, {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // For production avoid data tracing (sensitive data) and consider reducing the logging level.
    const isProd = env === 'prod';
    const dataTraceEnabled = !isProd; // true for non-prod only
    const loggingLevel = isProd ? apigateway.MethodLoggingLevel.ERROR : apigateway.MethodLoggingLevel.INFO;

    this.api = new apigateway.RestApi(this, `ApiGateway-${env}`, {
      restApiName: `ServiceApi-${env}`,
      description: `API Gateway for ${env} environment`,
      deployOptions: {
        stageName: env,
        loggingLevel,
        dataTraceEnabled,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(), // structured logs
      },
      // Consider setting endpointConfiguration: { types: [apigateway.EndpointType.REGIONAL] } explicitly if needed
    });

    const helloResource = this.api.root.addResource('hello');
    helloResource.addMethod('GET', new apigateway.LambdaIntegration(helloLambda));

    // Outputs: emit API URL. If you need a cross-stack export, add exportName with a stable pattern.
    new cdk.CfnOutput(this, `ApiUrl-${env}`, {
      value: this.api.url,
    });

    // Tagging
    cdk.Tags.of(this.api).add('Environment', env);
    cdk.Tags.of(helloLambda).add('Environment', env);
    cdk.Tags.of(accessLogGroup).add('Environment', env);
  }
}
