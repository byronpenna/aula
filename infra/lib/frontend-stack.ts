import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface FrontendStackProps extends cdk.StackProps {
  environmentName: string;
}

/**
 * Frontend estático (sección 5): S3 privado + CloudFront con Origin Access Control.
 * El certificado y el dominio real (`aula.<dominio>`) quedan como placeholder hasta
 * que el propietario confirme dominio (sección 21); no se configura Route 53 aquí.
 */
export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy:
        props.environmentName === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environmentName !== "prod",
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        // SPA: rutas sin extensión reescriben a index.html; no convertir todos los
        // errores de assets en 200 (sección 5) — solo 404/403 de navegación de rutas.
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
      ],
    });

    new cdk.CfnOutput(this, "DistributionDomainName", { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
  }
}
