#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { IdentityStack } from "../lib/identity-stack";
import { AsyncStack } from "../lib/async-stack";
import { ApiStack } from "../lib/api-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { ObservabilityStack } from "../lib/observability-stack";

/**
 * Entrada de CDK (sección 16). Deliberadamente NO fija `env: { account, region }`
 * a partir de `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION`: el propio CLI de `cdk`
 * puebla esas variables automáticamente desde las credenciales AWS ambiente de la
 * máquina (el perfil `default`, si existe), aunque este proyecto no tenga cuenta
 * propia configurada — usarlas sin querer haría que `cdk synth` intente resolver
 * AZs contra una cuenta ajena. Se requiere el opt-in explícito `AULA_CDK_ENV=1`
 * (además de las variables de cuenta/región) para fijar un entorno real, típicamente
 * solo al hacer `cdk deploy` con el perfil dedicado de
 * docs/runbooks/aws-profile-setup.md. Sin ese opt-in, los stacks quedan
 * "environment-agnostic" y `cdk synth` no debería necesitar ninguna credencial.
 */

const app = new cdk.App();

const environmentName = app.node.tryGetContext("environmentName") ?? "dev";
const env =
  process.env.AULA_CDK_ENV === "1" && process.env.CDK_DEFAULT_ACCOUNT && process.env.CDK_DEFAULT_REGION
    ? { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
    : undefined;

const tags = { project: "aula-virtual", environment: environmentName };
const stackProps: cdk.StackProps = { env, tags };
const prefix = `Aula-${environmentName}`;

const network = new NetworkStack(app, `${prefix}-Network`, stackProps);

const data = new DataStack(app, `${prefix}-Data`, {
  ...stackProps,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
  migrationRunnerSecurityGroup: network.migrationRunnerSecurityGroup,
  environmentName,
});

const identity = new IdentityStack(app, `${prefix}-Identity`, {
  ...stackProps,
  environmentName,
});

const asyncStack = new AsyncStack(app, `${prefix}-Async`, {
  ...stackProps,
  vpc: network.vpc,
  environmentName,
});

const api = new ApiStack(app, `${prefix}-Api`, {
  ...stackProps,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
  dbProxyEndpoint: data.proxyEndpoint,
  dbSecret: data.databaseSecret,
  userPool: identity.userPool,
  userPoolClient: identity.userPoolClient,
  filesBucketName: `aula-files-${environmentName}`,
  queueUrl: asyncStack.notificationsQueue.queueUrl,
  environmentName,
});

const frontend = new FrontendStack(app, `${prefix}-Frontend`, {
  ...stackProps,
  environmentName,
});

new ObservabilityStack(app, `${prefix}-Observability`, {
  ...stackProps,
  apiFunction: api.apiFunction,
  dispatcherFunction: asyncStack.dispatcherFunction,
  dlq: asyncStack.deadLetterQueue,
  environmentName,
});

void data;
void frontend;
