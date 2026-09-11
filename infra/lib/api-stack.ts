import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/**
 * Empaqueta apps/api con Docker (pip install del propio paquete, que arrastra sus
 * dependencias vía pyproject.toml/hatchling) — reemplaza el placeholder inline.
 * Requiere Docker disponible en la máquina/CI que corra `cdk synth`/`deploy`.
 */
const API_SOURCE_DIR = path.join(__dirname, "..", "..", "apps", "api");

function buildApiCodeAsset(): lambda.Code {
  return lambda.Code.fromAsset(API_SOURCE_DIR, {
    bundling: {
      image: lambda.Runtime.PYTHON_3_12.bundlingImage,
      // Fijo explícitamente arm64: debe coincidir con `architecture` del Lambda
      // (ver ApiFunction más abajo). Sin esto, el bundling usa la arquitectura de
      // la máquina que corre `cdk deploy`, y un host x86_64 produciría binarios
      // incompatibles con un Lambda declarado ARM_64 (o viceversa).
      platform: "linux/arm64",
      command: [
        "bash",
        "-c",
        [
          "pip install --no-cache-dir . -t /asset-output",
          // alembic/ (nuestras migraciones) y alembic.ini no son parte del paquete
          // `app` instalable; se copian aparte para que MigrationRunnerFunction
          // pueda invocar Alembic contra la RDS real. Se renombra el destino a
          // db_migrations/: `pip install` ya puso el PAQUETE `alembic` (la
          // librería) en /asset-output/alembic, y copiar nuestra carpeta con el
          // mismo nombre encima anidaba env.py un nivel de más en vez de
          // reemplazarlo (bug encontrado al probar el runner de migraciones).
          "cp -r alembic /asset-output/db_migrations",
          "cp alembic.ini /asset-output/alembic.ini",
          // Quita metadata de compilación que no aporta en runtime (reduce tamaño).
          "find /asset-output -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true",
        ].join(" && "),
      ],
    },
  });
}

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  migrationRunnerSecurityGroup: ec2.ISecurityGroup;
  dbProxyEndpoint: string;
  dbSecret: secretsmanager.ISecret;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  filesBucketName: string;
  queueUrl: string;
  environmentName: string;
  /** Orígenes permitidos para CORS (gateway + FastAPI). Placeholder hasta conocer
   * el dominio real del frontend (Amplify); actualizar y redeployar cuando se
   * tenga (sección 5: "CORS limitado a orígenes configurados"). */
  allowedOrigins?: string[];
}

/**
 * HTTP API + Lambda FastAPI/Mangum (sección 4). El código de apps/api se empaqueta
 * con Docker bundling (`buildApiCodeAsset`) — requiere Docker disponible donde se
 * corra `cdk synth`/`deploy`. Memoria inicial 1024 MB y timeout 25s (sección 4) son
 * valores a ajustar tras medir, no cifras definitivas. Concurrencia reservada
 * deshabilitada por ahora (ver nota en el constructor): la cuota de la cuenta no
 * la soporta todavía.
 */
export class ApiStack extends cdk.Stack {
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const allowedOrigins = props.allowedOrigins ?? ["https://aula.example.local"];

    const filesBucket = new s3.Bucket(this, "FilesBucket", {
      bucketName: props.filesBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy:
        props.environmentName === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: cdk.Duration.days(1) }],
    });

    const apiLogGroup = new logs.LogGroup(this, "ApiLogGroup", {
      retention:
        props.environmentName === "prod" ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.apiFunction = new lambda.Function(this, "ApiFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      // El bundling con Docker corre en la arquitectura nativa de la máquina que
      // ejecuta `cdk deploy` (Graviton/arm64 en este caso); debe coincidir con la
      // arquitectura declarada aquí o los binarios compilados (pydantic_core,
      // psycopg-binary, etc.) fallan al importar en runtime.
      architecture: lambda.Architecture.ARM_64,
      handler: "app.handler.handler",
      code: buildApiCodeAsset(),
      timeout: cdk.Duration.seconds(25),
      memorySize: 1024,
      // Sin reservedConcurrentExecutions: la cuota total de Lambda de esta cuenta
      // (nueva) es más baja que lo asumido en la sección 4; ver nota equivalente
      // en async-stack.ts. Reintroducir cuando se confirme la cuota real.
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.appSecurityGroup],
      logGroup: apiLogGroup,
      environment: {
        APP_ENV: props.environmentName,
        DB_PROXY_ENDPOINT: props.dbProxyEndpoint,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        COGNITO_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        FILES_BUCKET: filesBucket.bucketName,
        QUEUE_URL: props.queueUrl,
        LOCAL_AUTH_ENABLED: "false",
        ALLOWED_ORIGINS: JSON.stringify(allowedOrigins),
      },
    });

    props.dbSecret.grantRead(this.apiFunction);
    filesBucket.grantReadWrite(this.apiFunction);

    // Runner de migraciones (sección 18): sustituto serverless simple del runner
    // de CodeBuild en VPC mientras esa pieza no se implementa. Solo invocable
    // manualmente por un operador con `aws lambda invoke`; no se expone por HTTP
    // ni corre automáticamente en cada deploy (evita migrar sin supervisión).
    const migrationRunnerFunction = new lambda.Function(this, "MigrationRunnerFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: "app.ops.migration_runner.handler",
      code: buildApiCodeAsset(),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.migrationRunnerSecurityGroup],
      environment: {
        APP_ENV: props.environmentName,
        DB_PROXY_ENDPOINT: props.dbProxyEndpoint,
        DB_SECRET_ARN: props.dbSecret.secretArn,
        COGNITO_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
        COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
        LOCAL_AUTH_ENABLED: "false",
      },
    });
    props.dbSecret.grantRead(migrationRunnerFunction);

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `aula-api-${props.environmentName}`,
      corsPreflight: {
        allowOrigins: allowedOrigins,
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["authorization", "content-type", "x-school-id", "idempotency-key"],
      },
    });

    const authorizer = new HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
        identitySource: ["$request.header.Authorization"],
      },
    );

    const integration = new HttpLambdaIntegration("ApiIntegration", this.apiFunction);

    httpApi.addRoutes({
      path: "/api/v1/{proxy+}",
      methods: [apigwv2.HttpMethod.ANY],
      integration,
      authorizer,
    });

    // Rutas de salud sin autorizador (sección 14): liveness/readiness livianos.
    httpApi.addRoutes({
      path: "/healthz",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });
    httpApi.addRoutes({
      path: "/readyz",
      methods: [apigwv2.HttpMethod.GET],
      integration,
    });

    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "FilesBucketName", { value: filesBucket.bucketName });
    new cdk.CfnOutput(this, "MigrationRunnerFunctionName", {
      value: migrationRunnerFunction.functionName,
    });
  }
}
