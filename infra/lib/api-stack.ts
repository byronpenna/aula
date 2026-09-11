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

export interface ApiStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
  dbProxyEndpoint: string;
  dbSecret: secretsmanager.ISecret;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  filesBucketName: string;
  queueUrl: string;
  environmentName: string;
}

/**
 * HTTP API + Lambda FastAPI/Mangum (sección 4). El código real (apps/api) se
 * empaqueta en una fase de build separada (con dependencias reproducibles); esta
 * pila usa un placeholder inline para poder sintetizarse sin Docker ni cuenta AWS.
 * Reservar 30 ejecuciones concurrentes para la API, memoria inicial 1024 MB y
 * timeout 25s (sección 4) son valores a ajustar tras medir, no cifras definitivas.
 */
export class ApiStack extends cdk.Stack {
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

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
      handler: "app.handler.handler",
      code: lambda.Code.fromInline(
        "def handler(event, context):\n" +
          "    return {'statusCode': 501, 'body': 'Pendiente de empaquetado real (ver infra/lib/api-stack.ts)'}\n",
      ),
      timeout: cdk.Duration.seconds(25),
      memorySize: 1024,
      reservedConcurrentExecutions: 30,
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
      },
    });

    props.dbSecret.grantRead(this.apiFunction);
    filesBucket.grantReadWrite(this.apiFunction);

    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `aula-api-${props.environmentName}`,
      corsPreflight: {
        allowOrigins: ["https://aula.example.local"],
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

    new cdk.CfnOutput(this, "HttpApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "FilesBucketName", { value: filesBucket.bucketName });
  }
}
