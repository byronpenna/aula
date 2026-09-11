# Configurar el perfil AWS para el proyecto Aula Virtual

Estado actual (2026-09-11): el perfil `aula` ya existe, apunta a la cuenta `861418247819` / región `us-east-1`, y tiene adjunta la policy de uso diario (`aws-cli-user-policy.json`, más abajo). Sigue sin correrse `cdk bootstrap` en esa cuenta/región. Esta sesión de Claude Code no creó el perfil ni adjuntó ninguna policy — eso lo hizo el propietario directamente; aquí se documenta el estado para que quede registrado.

Las secciones "Opción A/B" de abajo quedan como referencia si en el futuro se crea un perfil nuevo (por ejemplo `aula-staging`, `aula-prod`) para otro ambiente.

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

## Dos policies, dos identidades distintas

Este proyecto usa dos policies IAM separadas a propósito, y **no las usa la misma identidad**:

| Policy | Archivo | Quién la tiene | Para qué |
|---|---|---|---|
| Uso diario | `aws-cli-user-policy.json` | Usuario `aula` (ya adjunta) | `cdk synth`/`diff`/`deploy`/`destroy` de los stacks `Aula-*`, asumiendo los roles que crea el bootstrap |
| Bootstrap único | `aws-bootstrap-only-policy.json` | Una identidad con permisos de administrador (root, u otro perfil admin) — **no** `aula` | Crear una sola vez el stack `CDKToolkit` (bucket de assets, repo ECR, roles `cdk-hnb659fds-*`, parámetro SSM, key KMS) |

El usuario `aula` deliberadamente **no puede** crear/adjuntar/quitar policies IAM ni crear el bootstrap por sí mismo — por diseño, para no tener alcance de administrador de forma permanente. Los pasos 1, 2 y 4 de abajo se corren con tu identidad de administrador de la cuenta; solo el paso 3 usa `AWS_PROFILE=aula`.

```bash
# --- con tu identidad de ADMINISTRADOR (no AWS_PROFILE=aula) ---
aws iam create-policy \
  --policy-name AulaCdkBootstrapOnly \
  --policy-document file://docs/runbooks/aws-bootstrap-only-policy.json

aws iam attach-user-policy \
  --user-name aula \
  --policy-arn arn:aws:iam::861418247819:policy/AulaCdkBootstrapOnly

# --- con AWS_PROFILE=aula, una sola vez por cuenta/región ---
export AWS_PROFILE=aula
export AULA_CDK_ENV=1
cd infra
npx cdk bootstrap aws://861418247819/us-east-1

# --- de nuevo con tu identidad de ADMINISTRADOR: retirar el acceso temporal ---
aws iam detach-user-policy \
  --user-name aula \
  --policy-arn arn:aws:iam::861418247819:policy/AulaCdkBootstrapOnly
aws iam delete-policy \
  --policy-arn arn:aws:iam::861418247819:policy/AulaCdkBootstrapOnly
```

Una vez hecho el bootstrap, el uso normal es solo con `AWS_PROFILE=aula` (ya tiene todo lo que necesita vía `aws-cli-user-policy.json`):

```bash
export AWS_PROFILE=aula
export AULA_CDK_ENV=1
cd infra
npx cdk synth          # genera CloudFormation, no crea nada
npx cdk diff            # antes de cualquier deploy, para ver qué se crearía
npx cdk deploy <stack>  # cuando decidas desplegar de verdad — tiene costo
```

- `make infra-synth` corre `cdk synth` sin necesitar ningún perfil: los stacks son "environment-agnostic" por diseño (`infra/bin/aula.ts` solo fija `env: {account, region}` si exportas explícitamente `AULA_CDK_ENV=1` además de `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION`). Esto es intencional: el propio CLI de `cdk` puebla esas variables automáticamente desde el perfil `default` de tu máquina si existe uno, aunque no lo hayas pedido; sin el opt-in, este proyecto las ignora y no contacta ninguna cuenta AWS al sintetizar.
- Ningún comando de este repo ejecuta `cdk deploy`, `cdk bootstrap` ni crea recursos reales por sí solo. Eso siempre requiere que tú lo invoques explícitamente con el perfil ya configurado.

## Separación de ambientes

Cuando haya más de un ambiente cloud (dev/staging/prod), lo recomendado es un perfil por ambiente (`aula-dev`, `aula-staging`, `aula-prod`), idealmente apuntando a cuentas AWS separadas (el documento de arquitectura pide producción en cuenta separada cuando sea posible). No reutilices el mismo perfil para prod y no local si puedes evitarlo.

## Qué NO hace esta configuración por sí sola

- No autoriza gasto: `cdk bootstrap` y cualquier stack desplegado sí generan costo (S3, KMS, etc. mínimos en bootstrap; recursos reales en deploy).
- No envía invitaciones reales ni configura DNS de producción.
- No migra datos reales.

Cualquiera de esas acciones requiere tu autorización explícita en el momento, como pide la sección 1 del documento de arquitectura.
