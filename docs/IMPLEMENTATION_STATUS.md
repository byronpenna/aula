# Estado de implementación

Última actualización: 2026-09-10. Fase entregada: **0 y 1** (sección 20 del documento de arquitectura), con la primera entrega vertical de la sección 1 completa.

## Implementado

### Fase 0 — Inspección, ADR, supuestos, repo y contratos
- Monorepo creado según la estructura de la sección 16 (`apps/api`, `apps/web`, `infra`, `packages/contracts`, `scripts`, `tests/e2e`, `tests/load`, `docs/`).
- `docs/ASSUMPTIONS.md`, `docs/adr/0001-arquitectura-base.md`, `docs/cost-estimate.md` (plantilla, sin cotización cerrada), `docs/runbooks/aws-profile-setup.md`.
- Repositorio Git inicializado localmente. Sin remoto configurado; nada empujado a ningún lado.
- OpenAPI exportable desde FastAPI (`apps/api/export_openapi.py`) + script de generación de cliente TS en `packages/contracts` (no ejecutado en esta entrega: requiere `npm run generate` manual).

### Fase 1 — Auth, permisos, DB, IaC base, frontend shell + entrega vertical
- **Identidad**: `schools`, `users`, `school_memberships`, `roles`/`permissions`/`role_permissions`, `membership_roles`, `student_profiles`, `guardian_student_links`, `audit_events`, `local_auth_credentials` (adaptador de desarrollo local).
- **Auth**: verificación de JWT con modo local (HS256, solo `APP_ENV=local`, la app se niega a iniciar si `local_auth_enabled=true` fuera de local) y modo Cognito-ready (issuer/JWKS remoto, sin User Pool real todavía). Revalida `token_use=access`, `client_id`, `scope` y estado activo en DB en cada request.
- **RBAC**: catálogo de permisos (`app/core/permissions.py`), roles por defecto (school_admin, coordinator, teacher, student, guardian, finance), `school_id` efectivo derivado de membresía activa (validado, no confiado ciegamente desde header/query).
- **Académico**: `academic_years`, `grading_periods`, `grade_levels`, `sections`, `subjects`, `courses`, `course_teachers`, `enrollments`, `course_enrollments`.
- **Aprendizaje**: `assignments`, `submissions`, `submission_revisions` (inmutables, versión monotónica, concurrencia optimista).
- **Vertical slice real** (sección 1): docente crea materia/curso vía admin, matrícula transaccional (matrícula + inscripciones de curso en una sola transacción), docente crea y publica tarea, alumno matriculado ve solo tareas publicadas, entrega borrador con control de versión optimista (409 en conflicto), entrega final con detección de tardanza por reloj del servidor, retry de submit idempotente, tutor con vínculo activo consulta las entregas de su hijo, docente ve todas las entregas de su tarea. **Confirmado funcionando de extremo a extremo dos veces**: (1) vía HTTP real con `curl` contra Postgres real, (2) visualmente en el navegador (Chrome, vía `claude-in-chrome`) con login local real como docente y como tutor, mostrando datos reales del seed, no simulados.
- **Migraciones Alembic**: una migración inicial (`f6ea9df6c91c`), reescrita a mano para resolver el ciclo de FK `submissions ↔ submission_revisions` (autogenerate de Alembic no pudo ordenarlo). Verificada: `upgrade head` desde cero, `downgrade base`, y `upgrade head` de nuevo — las tres funcionan. `alembic check` confirma que no hay drift contra los modelos actuales.
- **Seed** (`scripts/seed.py`): idempotente (se puede correr varias veces sin duplicar), crea colegio demo, catálogo de roles/permisos, 4 usuarios (admin/docente/alumno/tutor) con credencial local, año académico, grado, sección, materia, curso, matrícula, vínculo de tutor y una tarea publicada.
- **Frontend**: React + TS + Vite + Tailwind v4 + TanStack Query + React Hook Form + Zod. Login local, selector de colegio cuando hay varias membresías, nav por rol, páginas de cursos/tarea/mis-hijos/entregas de alumno con estados reales de carga/vacío/error/permiso denegado, autosave de entrega con debounce de 2s y estados "pendiente/guardando/guardado/conflicto/sin conexión" (sección 9). **Limitación documentada del MVP**: al recargar la página se pierde el texto del borrador no confirmado (el token vive solo en memoria y el cuerpo de la revisión no se relee del servidor); la interfaz lo advierte explícitamente.
- **Infraestructura AWS CDK (TypeScript)**: stacks `network` (VPC 2 AZ, subred pública solo para NAT, privadas de app y aisladas de datos, S3 Gateway Endpoint), `data` (RDS PostgreSQL + RDS Proxy, SG con reglas mínimas, cifrado en reposo), `identity` (Cognito User Pool + resource server + client SPA sin secret), `async` (SQS + DLQ + dispatcher placeholder + EventBridge Scheduler cada minuto), `api` (HTTP API + Lambda placeholder + JWT authorizer + bucket de archivos privado), `frontend` (S3 privado + CloudFront con OAC), `observability` (dashboard + alarmas base). El código Lambda real (FastAPI empaquetado) queda pendiente de una fase de empaquetado reproducible; por ahora los handlers son placeholders inline para poder sintetizar sin Docker ni cuenta AWS.
- **`cdk synth` verificado sin contactar ninguna cuenta AWS real**: los stacks son "environment-agnostic" por diseño; se corrigió además un comportamiento donde el propio CLI de `cdk` poblaba `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` desde el perfil `default` ambiente de la máquina — ahora se requiere el opt-in explícito `AULA_CDK_ENV=1` para usarlos (ver `docs/runbooks/aws-profile-setup.md`).
- **Pruebas de infra** (`infra/test/security.test.ts`, Jest + `aws-cdk-lib/assertions`): bucket de archivos y de frontend bloquean acceso público total, RDS no es públicamente accesible, ninguna policy IAM generada usa `Action`/`Resource` wildcard total, subredes de datos son aisladas. 6/6 pasando.
- **CI** (`.github/workflows/ci.yml`): lint/tipos + pytest con Postgres de servicio + `alembic upgrade head` desde una DB nueva (backend); lint/tipos/build (frontend); jest + `cdk synth --quiet` (infra). No incluye despliegue (no hay OIDC ni cuenta configurada).
- **Docker Compose**: Postgres + API con hot-reload; `.env`/`.env.example` documentados.

## Pruebas ejecutadas y resultado

| Suite | Resultado |
|---|---|
| `pytest` backend (aislamiento por colegio, tutor solo ve vínculos activos, token con scope incorrecto rechazado, usuario inactivo pierde acceso con token vigente, docente pierde acceso al desasignarlo, curso de otro colegio no encontrado, flujo vertical completo, tardanza rechazada) | **8/8 passed**, contra PostgreSQL real (no mocks), con `drop_all`/`create_all` repetido dos veces para confirmar que no hay drift |
| `ruff check` backend | Limpio |
| `mypy` backend | Limpio (0 errores en 33 archivos) |
| `alembic upgrade head` → `downgrade base` → `upgrade head` | Las tres verificadas manualmente, exitosas |
| `npm run typecheck` frontend | Limpio |
| `npm run lint` frontend (oxlint) | Limpio (1 warning menor de fast-refresh, no bloqueante) |
| `npm run build` frontend | Exitoso (bundle ~476KB / 149KB gzip) |
| E2E manual en navegador real (Chrome vía `claude-in-chrome`) | Login docente → curso → tarea publicada → entregas visibles; login tutor → "Mis hijos" → entrega del alumno visible. Confirmado visualmente, no solo por API. |
| `cdk synth` (sin credenciales reales) | Exitoso, sin advertencias de seguridad pendientes |
| Jest `infra/test/security.test.ts` | **6/6 passed** |
| Pruebas E2E con Playwright (`tests/e2e/`) | **No ejecutadas todavía** — solo hay un spec de referencia comentado; falta instalar Playwright |
| Pruebas de carga k6 (`tests/load/`) | **No ejecutadas** — script de referencia sin correr; requiere ambiente desplegado |
| `cdk deploy` / recursos AWS reales | **No ejecutado, ni se intentó** — no hay perfil AWS configurado para este proyecto (ver `docs/runbooks/aws-profile-setup.md`) |

## Pendiente (siguiente fase: Fase 2 — sección 20)

- Estructura académica completa (traslados de sección, historial), matrícula avanzada.
- Contenido de curso (`course_units`, `lessons`) y su publicación.
- Archivos privados (`files`, presigned upload/download, escaneo antimalware) — todavía no implementado; los adjuntos de tareas/entregas no existen en esta entrega.
- Notas (`grade_items`, `grade_categories`, `grades`, `grade_revisions`), asistencia, exámenes, avisos, reportes, dashboards, outbox/SQS real (el dispatcher es un placeholder), cobros opcionales (fase 7).
- Empaquetado real de la Lambda de API (dependencias reproducibles, capas) — hoy es un placeholder inline en `infra/lib/api-stack.ts`.
- MFA real con Cognito, invitaciones reales, SES con dominio verificado.
- FKs compuestas `(school_id, parent_id)` en tablas hijas como refuerzo adicional a la validación de aplicación ya existente (documentado como hardening pendiente en `db/base.py::SchoolScopedMixin`).
- Pruebas E2E Playwright y de carga k6, ambas con script de referencia listo pero sin ejecutar.
- Todas las decisiones de negocio de la sección 21 (branding, presupuesto, región/residencia, RPO/RTO, escala de notas, etc.) siguen sin cerrarse; no bloquean esta entrega pero sí producción.

## Riesgos conocidos

- El adaptador de login local usa contraseña compartida (`aula-local-dev`) para todos los usuarios semilla; es intencional y exclusivo de `APP_ENV=local`, documentado y con guarda de arranque, pero no debe confundirse con una política de contraseñas real.
- El bundle de frontend (~476KB) no está optimizado con code-splitting; aceptable para este alcance, revisar antes de una fase con más páginas.
- `cdk synth` detectó (y se corrigió) que el CLI de `cdk` puede poblar variables de entorno de cuenta AWS desde el perfil `default` de la máquina sin pedirlo explícitamente; se añadió el opt-in `AULA_CDK_ENV=1` para evitar que esto ocurra sin querer en un futuro `cdk deploy`.

## Siguiente paso

Fase 2: estructura académica completa, contenido de curso, y comenzar `files` (archivos privados) ya que `assignment_attachments`/`submission_files` quedaron fuera de esta entrega. Antes de esa fase, revisar con el propietario las decisiones de la sección 21 que empiecen a ser relevantes (branding, escala de notas, tipos de archivo permitidos).
