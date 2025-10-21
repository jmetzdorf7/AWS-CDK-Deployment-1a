import * as path from 'path';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ApiStackProps extends StackProps {
  /**
   * Stage name used for the API stage (e.g. "dev", "staging", "prod").
   * If not provided the stack id will be used as part of the generated stage name.
   */
  readonly stageName?: string;
  /**
   * Allowlist of CORS origins. Default is ["*"] for convenience — replace with explicit origins for production.
   */
  readonly corsAllowOrigins?: string[];
}

/**
 * ApiStack
 *
 * - Creates a Lambda (NodeJS) that handles requests.
 * - Creates a RestApi with proxying to that Lambda (single entrypoint).
 * - Enables access logging and basic stage configuration.
 *
 * Notes:
 * - Adjust the lambda entry path to point at your actual handler file (lambda/api-handler.ts).
 * - For larger APIs prefer structuring routes with separate Lambda functions or use Lambda URL / HTTP API (apigatewayv2).
 */
export class ApiStack extends Stack {
  public readonly handler: lambda.Function;
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps = {}) {
    super(scope, id, props);

    const stage = props.stageName ?? 'dev';

    // Log group for API access logs
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Common NodejsFunction props (bundling + runtime)
    const nodeFnProps: NodejsFunctionProps = {
      entry: path.join(__dirname, '../lambda/api-handler.ts'), // <-- adjust this path
      handler: 'handler', // exported function name in your lambda file
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 512,
      timeout: Duration.seconds(30),
      bundling: {
        minify: true,
        sourceMap: true,
        // exclude aws-sdk to keep bundle small (available in Lambda runtime)
        externalModules: ['aws-sdk'],
      },
      environment: {
        STAGE: stage,
        // add other environment variables here, for example:
        // TABLE_NAME: myTable.tableName
      },
    };

    // Lambda function that implements the API
    this.handler = new NodejsFunction(this, 'ApiHandler', nodeFnProps);

    // Rest API (v1) with proxy integration to the Lambda
    this.restApi = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `${this.stackName}-api`,
      deployOptions: {
        stageName: stage,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
      defaultCorsPreflightOptions: {
        allowOrigins: props.corsAllowOrigins ?? ['*'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Proxy all requests to the Lambda (single-handler approach)
    this.restApi.root.addProxy({
      defaultIntegration: new apigateway.LambdaIntegration(this.handler),
      anyMethod: true,
    });

    // Example: if your lambda needs to access other resources, grant permissions here
    // myTable.grantReadWriteData(this.handler);

    // Export useful values as stack outputs
    new apigateway.CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url ?? `https://${this.restApi.restApiId}.execute-api.${this.region}.amazonaws.com/${stage}`,
      description: 'Base URL for the REST API',
    });

    new apigateway.CfnOutput(this, 'LambdaFunctionName', {
      value: this.handler.functionName,
      description: 'Name of the Lambda function handling API requests',
    });
  }
}

