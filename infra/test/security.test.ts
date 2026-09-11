import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { IdentityStack } from "../lib/identity-stack";
import { AsyncStack } from "../lib/async-stack";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";

/**
 * Aserciones de políticas críticas (sección 16 y 19, punto 13): sin DB/bucket
 * públicos ni destrucción de datos de producción. No requiere credenciales AWS.
 */
describe("infra security assertions", () => {
  const app = new cdk.App();
  const network = new NetworkStack(app, "TestNetwork");
  const data = new DataStack(app, "TestData", {
    vpc: network.vpc,
    appSecurityGroup: network.appSecurityGroup,
    migrationRunnerSecurityGroup: network.migrationRunnerSecurityGroup,
    environmentName: "dev",
  });
  const identity = new IdentityStack(app, "TestIdentity", { environmentName: "dev" });
  const asyncStack = new AsyncStack(app, "TestAsync", { vpc: network.vpc, environmentName: "dev" });
  const api = new ApiStack(app, "TestApi", {
    vpc: network.vpc,
    appSecurityGroup: network.appSecurityGroup,
    dbProxyEndpoint: data.proxyEndpoint,
    dbSecret: data.databaseSecret,
    userPool: identity.userPool,
    userPoolClient: identity.userPoolClient,
    filesBucketName: "aula-files-test",
    queueUrl: asyncStack.notificationsQueue.queueUrl,
    environmentName: "dev",
  });
  const frontend = new FrontendStack(app, "TestFrontend", { environmentName: "dev" });

  test("el bucket de archivos bloquea acceso público total", () => {
    const template = Template.fromStack(api);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("el bucket del frontend bloquea acceso público total", () => {
    const template = Template.fromStack(frontend);
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test("RDS no es públicamente accesible", () => {
    const template = Template.fromStack(data);
    template.hasResourceProperties("AWS::RDS::DBInstance", {
      PubliclyAccessible: false,
    });
  });

  test("dev no protege contra borrado ni retiene snapshot (documentado, no HA)", () => {
    const template = Template.fromStack(data);
    template.hasResourceProperties("AWS::RDS::DBInstance", {
      DeletionProtection: false,
    });
  });

  test("las subredes de datos son aisladas (sin ruta directa a internet)", () => {
    const isolatedSubnets = network.vpc.isolatedSubnets;
    expect(isolatedSubnets.length).toBeGreaterThan(0);
    for (const subnet of isolatedSubnets) {
      expect(subnet).toBeInstanceOf(ec2.Subnet);
    }
  });

  test("ninguna policy IAM generada usa Action/Resource comodín total", () => {
    const template = Template.fromStack(api);
    const policies = template.findResources("AWS::IAM::Policy");
    for (const policy of Object.values(policies) as any[]) {
      const statements = policy.Properties.PolicyDocument.Statement as any[];
      for (const statement of statements) {
        const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
        const resources = Array.isArray(statement.Resource)
          ? statement.Resource
          : [statement.Resource];
        expect(actions).not.toContain("*");
        expect(resources).not.toContain("*");
      }
    }
  });
});
