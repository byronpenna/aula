import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface IdentityStackProps extends cdk.StackProps {
  environmentName: string;
}

/**
 * Cognito User Pool (sección 6). Registro público prohibido (altas administradas);
 * cliente de SPA sin secret; resource server con scope `school-api/access` exigido
 * por el JWT authorizer de HTTP API y revalidado por el backend ([S1]).
 */
export class IdentityStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `aula-${props.environmentName}`,
      selfSignUpEnabled: false, // Altas e invitaciones administradas (sección 6).
      signInAliases: { username: true, email: true },
      standardAttributes: {
        email: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy:
        props.environmentName === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      // MFA obligatorio para personal con privilegios es meta de producción
      // (sección 6, 21): se habilita explícitamente antes de altas reales, no aquí.
      mfa: cognito.Mfa.OPTIONAL,
    });

    const accessScope = new cognito.ResourceServerScope({
      scopeName: "access",
      scopeDescription: "Acceso a la API",
    });
    const resourceServer = this.userPool.addResourceServer("ApiResourceServer", {
      identifier: "school-api",
      scopes: [accessScope],
    });

    this.userPoolClient = this.userPool.addClient("SpaClient", {
      generateSecret: false, // Cliente público de SPA (sección 6).
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.resourceServer(resourceServer, accessScope)],
        callbackUrls: ["https://aula.example.local/callback"],
        logoutUrls: ["https://aula.example.local/logout"],
      },
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
  }
}
