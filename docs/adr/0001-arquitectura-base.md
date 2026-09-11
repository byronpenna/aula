# ADR 0001: Arquitectura base del monolito modular serverless

Fecha: 2026-09-10
Estado: Aceptado

## Contexto

`ARQUITECTURA_AULA_VIRTUAL_CLAUDE.md` (versión 1.0, 2026-09-07) define la arquitectura objetivo para una plataforma escolar a medida de ~600 alumnos, con preferencia declarada del propietario por AWS Lambda/serverless y desarrollo a medida. No existe código previo; este ADR fija las decisiones estructurales para arrancar el monorepo sin re-discutirlas en cada módulo.

## Decisión

- **Backend**: monolito modular en una Lambda HTTP (FastAPI + Mangum) más funciones de trabajo separadas (dispatcher, workers), no una Lambda por endpoint ni microservicios por entidad. Capas `router → service → repository → database`; sin lógica de negocio ni SQL en routers.
- **Persistencia**: PostgreSQL, SQLAlchemy 2 + psycopg 3 síncronos, Alembic para migraciones. En local: contenedor Docker. En cloud (fase posterior): RDS + RDS Proxy.
- **Frontend**: React + TypeScript + Vite, Tailwind, TanStack Query para estado de servidor, React Hook Form + Zod para formularios; el servidor siempre revalida.
- **Identidad**: modelo de autorización preparado para Cognito (issuer/audience/scope, `cognito_sub` como vínculo estable), con adaptador de autenticación local (tokens firmados HS256 en memoria del backend, solo si `APP_ENV=local`) para poder desarrollar y probar sin cuenta AWS. La app debe negarse a iniciar con el bypass local si `APP_ENV` no es `local`.
- **Infraestructura**: AWS CDK en TypeScript como única fuente de infraestructura, en stacks separados (`network`, `data`, `identity`, `async`, `api`, `frontend`, `observability`). Se escribe y se sintetiza (`cdk synth`), pero no se despliega en esta entrega: no hay perfil AWS configurado en esta máquina ni autorización de gasto.
- **Multi-tenencia**: un colegio por instalación; `school_id` presente en todas las tablas de dominio para aislamiento lógico, sin construir aún un SaaS multicolegio.
- **Asíncrono**: patrón outbox en PostgreSQL + SQS + Lambdas worker, documentado y modelado en el esquema desde ahora aunque el dispatcher real de EventBridge Scheduler se implemente en una fase posterior.

## Alternativas consideradas

- **Terraform o Serverless Framework** en vez de CDK: descartado por el documento base, que exige una única fuente de infraestructura versionada y prohíbe mezclar herramientas sobre los mismos recursos.
- **Microservicios por dominio**: descartado por complejidad operativa y de despliegue innecesaria para la escala (~600 alumnos); el documento pide explícitamente monolito modular.
- **ORM asíncrono (SQLAlchemy async)**: descartado en esta primera entrega; el documento propone endpoints síncronos con I/O bloqueante fuera del event loop async, revisando más adelante si se requiere.

## Consecuencias

- El código de autorización debe verificar colegio + permiso + vínculo con el recurso en cada capa, no solo ocultar UI.
- La infraestructura CDK se desarrolla sin poder validarse contra una cuenta real hasta que el propietario configure un perfil AWS (ver `docs/runbooks/aws-profile-setup.md`); `cdk synth` y las pruebas de `infra/test` con `aws-cdk-lib/assertions` son la única validación posible por ahora.
- Cambios de este ADR (por ejemplo, mover a Aurora Serverless v2, o a SQLAlchemy async) requieren un nuevo ADR con comparación explícita, según pide la sección 13 del documento base.
