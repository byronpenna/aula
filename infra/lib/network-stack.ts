import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

/**
 * Red base (sección 5): VPC en dos AZ, subredes privadas de aplicación (Lambdas con
 * DB) y privadas de datos (RDS/Proxy), un NAT Gateway (dev/piloto; documentar costo
 * fijo y punto de falla si se mantiene solo uno en prod), y S3 Gateway Endpoint.
 * Sin subredes públicas para cargas de trabajo: conectar una Lambda a una subred
 * pública no le da IP pública ni salida a internet por sí sola [S3].
 *
 * El SG de datos (RDS/Proxy) se crea en `DataStack`, no aquí: RDS Proxy añade una
 * regla de conexión interna que referencia el puerto del endpoint de la instancia
 * (un atributo de DataStack); si ese SG viviera en NetworkStack se formaría un
 * ciclo Network->Data->Network entre stacks. Solo los SG que son puros peers
 * (aplicación, runner de migraciones) viven en este stack.
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly appSecurityGroup: ec2.SecurityGroup;
  public readonly migrationRunnerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1, // Un solo NAT en dev/piloto (sección 5); evaluar por AZ en prod.
      subnetConfiguration: [
        {
          // Solo aloja el NAT Gateway; ninguna carga de trabajo se despliega aquí.
          // Conectar una Lambda a esta subred no le da IP pública ni salida a
          // internet por sí sola [S3] — las Lambdas van en "app-private".
          name: "nat-public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "app-private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "data-isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // S3 Gateway Endpoint (sección 5): acceso privado a S3 sin salir por NAT.
    this.vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc: this.vpc,
      description: "Lambdas de aplicacion (API y workers con acceso a DB)",
      allowAllOutbound: true,
    });

    this.migrationRunnerSecurityGroup = new ec2.SecurityGroup(this, "MigrationRunnerSg", {
      vpc: this.vpc,
      description:
        "Runner de CodeBuild autorizado para migraciones (seccion 5); sin SSH abierto ni DB publica.",
      allowAllOutbound: true,
    });

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
