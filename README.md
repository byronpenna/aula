# Aula Virtual

Plataforma escolar a medida (monolito modular serverless: FastAPI + Lambda, React,
PostgreSQL, AWS CDK). Especificación completa en
[`ARQUITECTURA_AULA_VIRTUAL_CLAUDE.md`](./ARQUITECTURA_AULA_VIRTUAL_CLAUDE.md).

Estado actual: Fase 0 + Fase 1 del plan de la sección 20 (ver
[`docs/IMPLEMENTATION_STATUS.md`](./docs/IMPLEMENTATION_STATUS.md) para el detalle
vivo de qué está implementado, probado y pendiente). Todo dato es ficticio; nada se
ha desplegado a AWS (ver [`docs/runbooks/aws-profile-setup.md`](./docs/runbooks/aws-profile-setup.md)
si vas a configurar un perfil para avanzar con la nube).

## Requisitos

- Docker + Docker Compose
- Python 3.12
- Node.js 22+
- (Opcional, solo para tocar infraestructura) AWS CLI v2 y un perfil configurado

## Arranque local

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
make bootstrap   # crea venv, instala deps de api/web, levanta Postgres
make migrate     # aplica migraciones Alembic
make seed        # datos ficticios: colegio demo, usuarios, curso, tarea
make dev         # API en :8000, frontend en :5173
```

Usuarios de prueba (contraseña `aula-local-dev` para todos, login local en
`/login`, solo válido con `APP_ENV=local`):

| Usuario | Rol |
|---|---|
| `admin.demo` | school_admin |
| `
` | teacher |
| `alumno.demo` | student |
| `tutor.demo` | guardian |

- Usuario: admin.sitio
- Contraseña: aula-local-dev

## Comandos

| Comando | Qué hace |
|---|---|
| `make bootstrap` | Instala dependencias y levanta la base de datos local |
| `make dev` | Corre API (Docker) + frontend (Vite) |
| `make migrate` | Aplica migraciones Alembic |
| `make seed` | Siembra datos ficticios idempotentes |
| `make test` | Pruebas de backend (contra Postgres real) + infra |
| `make lint` | Lint/tipos de backend y frontend |
| `make build` | Build de producción del frontend |
| `make infra-synth` | `cdk synth` de los stacks (sin credenciales AWS reales) |

## Estructura

Ver la sección 16 de `ARQUITECTURA_AULA_VIRTUAL_CLAUDE.md`. Resumen:

- `apps/api` — FastAPI (Mangum), módulos `identity`/`academics`/`learning`, Alembic.
- `apps/web` — React + TypeScript + Vite + Tailwind + TanStack Query.
- `infra` — AWS CDK (TypeScript): network, data, identity, async, api, frontend, observability.
- `packages/contracts` — OpenAPI + cliente TypeScript generado.
- `docs/` — ADRs, supuestos, estado de implementación, runbooks, estimación de costo.

## Documentación relacionada

- [`docs/ASSUMPTIONS.md`](./docs/ASSUMPTIONS.md) — decisiones de configuración explícitas y ficticias.
- [`docs/adr/`](./docs/adr) — decisiones de arquitectura con alternativas.
- [`docs/runbooks/aws-profile-setup.md`](./docs/runbooks/aws-profile-setup.md) — cómo configurar un perfil AWS nuevo para este proyecto (nada se hizo automáticamente).
- [`docs/cost-estimate.md`](./docs/cost-estimate.md) — plantilla de costo, sin cotización cerrada.
