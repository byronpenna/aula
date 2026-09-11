import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface DataStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  migrationRunnerSecurityGroup: ec2.ISecurityGroup;
  environmentName: string;
}

/**
 * Base de datos (sección 13): RDS PostgreSQL + RDS Proxy. Dimensionamiento inicial
 * de ejemplo (Graviton burstable 2 vCPU/4GB, gp3 30-50GB) a evaluar, no un
 * compromiso de capacidad. Single-AZ en dev/piloto; Multi-AZ es una decisión
 * explícita pendiente antes de producción (sección 21). Deletion protection y
 * snapshot final solo cuando el entorno se marque como producción.
 */
export class DataStack extends cdk.Stack {
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly proxyEndpoint: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const isProd = props.environmentName === "prod";

    const dataSecurityGroup = new ec2.SecurityGroup(this, "DataSecurityGroup", {
      vpc: props.vpc,
      description: "RDS Proxy y RDS PostgreSQL",
      allowAllOutbound: false,
    });

    // SG de RDS permite 5432 desde el SG del proxy (aquí, el mismo SG hace de
    // proxy+instancia) y, únicamente, desde el runner autorizado de migraciones y
    // las Lambdas autorizadas (sección 5).
    dataSecurityGroup.addIngressRule(
      props.appSecurityGroup,
      ec2.Port.tcp(5432),
      "Lambdas autorizadas hacia RDS Proxy",
    );
    dataSecurityGroup.addIngressRule(
      props.migrationRunnerSecurityGroup,
      ec2.Port.tcp(5432),
      "Runner de migraciones autorizado",
    );

    const credentials = rds.Credentials.fromGeneratedSecret("aula_app", {
      secretName: `aula/${props.environmentName}/db-credentials`,
    });

    const instance = new rds.DatabaseInstance(this, "Database", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dataSecurityGroup],
      credentials,
      storageEncrypted: true, // Cifrado en reposo (sección 11).
      allocatedStorage: 30,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      multiAz: isProd, // Pendiente de confirmar antes de producción (sección 21).
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(isProd ? 14 : 1),
      databaseName: "aula",
      publiclyAccessible: false,
    });

    const proxy = new rds.DatabaseProxy(this, "DatabaseProxy", {
      proxyTarget: rds.ProxyTarget.fromInstance(instance),
      secrets: [instance.secret!],
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dataSecurityGroup],
      requireTLS: true,
      iamAuth: false,
    });

    this.databaseSecret = instance.secret!;
    this.proxyEndpoint = proxy.endpoint;

    new cdk.CfnOutput(this, "ProxyEndpoint", { value: proxy.endpoint });
    new cdk.CfnOutput(this, "DatabaseSecretArn", { value: instance.secret!.secretArn });
  }
}
