import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LoggingConstruct } from '../lib/constructs/common/logging-construct';

describe('LoggingConstruct behavior', () => {
  test("dev: LogGroup uses RemovalPolicy.DESTROY (DeletionPolicy: Delete)", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'DevLoggingStack');
    // create construct for dev (default createOutput: false)
    new LoggingConstruct(stack, 'Logging', { envName: 'dev' });

    const template = Template.fromStack(stack).toJSON();

    const logGroupResources = Object.entries(template.Resources).filter(
      ([_, r]) => (r as any).Type === 'AWS::Logs::LogGroup'
    );

    expect(logGroupResources.length).toBeGreaterThan(0);

    const hasDelete = logGroupResources.some(([_, r]) => (r as any).DeletionPolicy === 'Delete');
    expect(hasDelete).toBe(true);
  });

  test("prod: LogGroup uses RemovalPolicy.RETAIN (DeletionPolicy: Retain)", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'ProdLoggingStack');
    // create construct for prod
    new LoggingConstruct(stack, 'Logging', { envName: 'prod' });

    const template = Template.fromStack(stack).toJSON();

    const logGroupResources = Object.entries(template.Resources).filter(
      ([_, r]) => (r as any).Type === 'AWS::Logs::LogGroup'
    );

    expect(logGroupResources.length).toBeGreaterThan(0);

    const hasRetain = logGroupResources.some(([_, r]) => (r as any).DeletionPolicy === 'Retain');
    expect(hasRetain).toBe(true);
  });

  test('createOutput=true produces an output with the expected export name', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'OutputLoggingStack');
    // create construct with output enabled
    new LoggingConstruct(stack, 'Logging', { envName: 'dev', createOutput: true });

    const template = Template.fromStack(stack).toJSON();

    const outputs = template.Outputs || {};
    const expectedExportName = `dev-${stack.stackName}-LogGroupName`;

    // find an output with Export.Name === expectedExportName
    const found = Object.values(outputs).some((out: any) => {
      return out && out.Export && out.Export.Name === expectedExportName;
    });

    expect(found).toBe(true);
  });
});
