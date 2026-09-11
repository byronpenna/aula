# Configurar el perfil AWS para el proyecto Aula Virtual

Esta sesión de Claude Code **no tiene** un perfil AWS configurado para este proyecto y **no ha tocado** tu `~/.aws/config` ni `~/.aws/credentials` existentes (ya tienes otros perfiles ahí). Este runbook son los pasos para que **tú** crees un perfil nuevo, aislado, cuando decidas avanzar con la nube. Nada de esto se ejecuta automáticamente.

Recomendación: usa un perfil con nombre propio, por ejemplo `aula-dev`, para no interferir con tus perfiles actuales ni con otros proyectos.

## Opción A — AWS IAM Identity Center / SSO (recomendado si tu organización ya lo usa)

1. `aws configure sso --profile aula-dev`
2. Te pedirá:
   - SSO start URL (te lo da tu administrador de AWS Identity Center).
   - SSO region (la región donde vive el Identity Center, no necesariamente `us-east-1`).
   - Se abrirá el navegador para autenticarte; selecciona la cuenta y el rol/permission set que vayas a usar para este proyecto.
   - Default client Region: `us-east-1` (o la región que decidas usar para el proyecto).
   - Default output format: `json`.
3. Verifica: `aws sts get-caller-identity --profile aula-dev`
4. Cuando el SSO expire, renuévalo con `aws sso login --profile aula-dev`.

## Opción B — Usuario IAM con access keys de larga duración

Solo si no tienes Identity Center disponible. Es preferible evitar keys permanentes; en CI ya está decidido usar OIDC (sección 18 del documento de arquitectura), no keys.

1. En la consola AWS (o pidiéndole a quien administre la cuenta), crea un usuario IAM dedicado a este proyecto, sin permisos de administrador total; idealmente con una policy acotada a lo que CDK necesita para bootstrap/deploy (o `AdministratorAccess` temporal solo para el bootstrap inicial, si así lo decides tú).
2. Genera un access key para ese usuario.
3. `aws configure --profile aula-dev` y pega:
   - AWS Access Key ID
   - AWS Secret Access Key
   - Default region: `us-east-1` (o la que corresponda)
   - Default output format: `json`
4. Verifica: `aws sts get-caller-identity --profile aula-dev`

## Usar el perfil con este proyecto

- Exporta `AWS_PROFILE=aula-dev` en tu shell (o `export AWS_PROFILE=aula-dev` en `.envrc`/`.env` local, **nunca** commiteado) antes de correr comandos CDK:
  ```bash
  export AWS_PROFILE=aula-dev
  export AWS_REGION=us-east-1
  cd infra
  npx cdk bootstrap    # una sola vez por cuenta/región, tiene costo/recursos mínimos
  npx cdk synth        # genera CloudFormation, no crea nada
  npx cdk diff          # antes de cualquier deploy, para ver qué se crearía
  npx cdk deploy <stack> # cuando decidas desplegar de verdad — tiene costo
  ```
- `make infra-synth` (definido en este repo) corre `cdk synth` sin necesitar el perfil: los stacks son "environment-agnostic" por diseño (`infra/bin/aula.ts` solo fija `env: {account, region}` si exportas explícitamente `AULA_CDK_ENV=1` además de `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION`). Esto es intencional: el propio CLI de `cdk` puebla `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` automáticamente desde el perfil `default` de tu máquina si existe uno, aunque no lo hayas pedido; sin el opt-in `AULA_CDK_ENV=1`, este proyecto ignora esas variables ambientales y no contacta ninguna cuenta AWS al sintetizar. Actívalo solo cuando vayas a hacer `cdk deploy` real con el perfil `aula-dev`:
  ```bash
  export AWS_PROFILE=aula-dev
  export AULA_CDK_ENV=1
  npx cdk deploy <stack>
  ```
- Ningún comando de este repo ejecuta `cdk deploy`, `cdk bootstrap` ni crea recursos reales por sí solo. Eso siempre requiere que tú lo invoques explícitamente con el perfil ya configurado.

## Separación de ambientes

Cuando haya más de un ambiente cloud (dev/staging/prod), lo recomendado es un perfil por ambiente (`aula-dev`, `aula-staging`, `aula-prod`), idealmente apuntando a cuentas AWS separadas (el documento de arquitectura pide producción en cuenta separada cuando sea posible). No reutilices el mismo perfil para prod y no local si puedes evitarlo.

## Qué NO hace esta configuración por sí sola

- No autoriza gasto: `cdk bootstrap` y cualquier stack desplegado sí generan costo (S3, KMS, etc. mínimos en bootstrap; recursos reales en deploy).
- No envía invitaciones reales ni configura DNS de producción.
- No migra datos reales.

Cualquiera de esas acciones requiere tu autorización explícita en el momento, como pide la sección 1 del documento de arquitectura.
