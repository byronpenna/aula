import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface IdentityStackProps extends cdk.StackProps {
  environmentName: string;
  /** Callback/logout URLs del cliente SPA para el flujo Authorization Code + PKCE
   * (sección 6/17). Placeholder hasta conocer el dominio real del frontend
   * (Amplify); actualizar y redeployar cuando el frontend implemente /callback. */
  callbackUrls?: string[];
  logoutUrls?: string[];
}

/**
 * Cognito User Pool (sección 6). Registro público prohibido (altas administradas);
 * cliente de SPA sin secret; resource server con scope `school-api/access` exigido
 * por el JWT authorizer de HTTP API y revalidado por el backend ([S1]). Dominio
 * Hosted UI necesario para que el cliente SPA pueda completar Authorization Code
 * + PKCE (sección 17): sin `addDomain`, no existe endpoint /oauth2/authorize.
 */
export class IdentityStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);

    const callbackUrls = props.callbackUrls ?? ["https://aula.example.local/callback"];
    const logoutUrls = props.logoutUrls ?? ["https://aula.example.local/logout"];

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
        callbackUrls,
        logoutUrls,
      },
      preventUserExistenceErrors: true,
    });

    // Prefijo fijo (incluye el account id) en vez de derivarlo de `this.account`:
    // los stacks son "environment-agnostic" por diseño (bin/aula.ts) y `cdk synth`
    // en CI corre sin AULA_CDK_ENV=1, donde `this.account` es un token sin resolver
    // que rompería la validación de formato del dominio Cognito.
    this.userPoolDomain = this.userPool.addDomain("HostedUiDomain", {
      cognitoDomain: { domainPrefix: `aula-${props.environmentName}-861418247819` },
    });

    new cdk.CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, "HostedUiDomainUrl", { value: this.userPoolDomain.baseUrl() });
  }
}
