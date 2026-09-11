# Estado de implementación

Última actualización: 2026-09-11. Fase entregada: **0 y 1** (sección 20 del documento de arquitectura), con la primera entrega vertical de la sección 1 completa, **y desplegada por primera vez a la cuenta AWS real** (`861418247819`, `us-east-1`) a pedido explícito del propietario. Ver "Pendiente → Urgente" para lo que falta antes de que alguien pueda usar este ambiente de verdad.

## Implementado

### Fase 0 — Inspección, ADR, supuestos, repo y contratos
- Monorepo creado según la estructura de la sección 16 (`apps/api`, `apps/web`, `infra`, `packages/contracts`, `scripts`, `tests/e2e`, `tests/load`, `docs/`).
- `docs/ASSUMPTIONS.md`, `docs/adr/0001-arquitectura-base.md`, `docs/cost-estimate.md` (plantilla, sin cotización cerrada), `docs/runbooks/aws-profile-setup.md`.
- Repositorio Git inicializado localmente y publicado en `https://github.com/byronpenna/aula.git` (rama `main`).

### AWS — cuenta, bootstrap y primer despliegue real (2026-09-11)
- Perfil `aula` creado por el propietario, cuenta `861418247819`, región `us-east-1`. Verificado con `sts get-caller-identity` antes de cada operación mutante.
- Policy de uso diario adjunta al usuario `aula` (`docs/runbooks/aws-cli-user-policy.json`), ampliada dos veces durante este despliegue (logs/lambda/lectura de operación, y Amplify) a medida que se descubrieron necesidades reales; sigue sin alcance de IAM de escritura, EC2 de escritura, ni administración de otros servicios fuera de lo explícitamente listado.
- `cdk bootstrap aws://861418247819/us-east-1` corrido con una policy temporal (`docs/runbooks/aws-bootstrap-only-policy.json`) que el propietario debe retirar del usuario `aula` si aún sigue adjunta. Stack `CDKToolkit` en `CREATE_COMPLETE`.
- **Los 6 stacks de aplicación están desplegados y en `CREATE_COMPLETE`/`UPDATE_COMPLETE` en la cuenta real**: `Aula-dev-Network`, `Aula-dev-Data`, `Aula-dev-Identity`, `Aula-dev-Async`, `Aula-dev-Api`, `Aula-dev-Observability`. Recursos reales con costo continuo (RDS, RDS Proxy, NAT Gateway) están corriendo ahora mismo.
- **API real y funcional**: `https://ki6jdxvk1g.execute-api.us-east-1.amazonaws.com` — `/healthz` y `/readyz` responden 200 confirmados, `/readyz` verificado contra la RDS real a través del proxy.
- **Migraciones aplicadas a la RDS real**: se implementó un Lambda runner de migraciones (`app/ops/migration_runner.py`, invocado manualmente vía `aws lambda invoke`, sin exposición HTTP) como sustituto del runner de CodeBuild en VPC que describe la sección 5, ya que RDS no tiene acceso público. `alembic upgrade head` corrido y confirmado (`current` = `f6ea9df6c91c`, head).
- **Frontend real desplegado en AWS Amplify Hosting** (a pedido explícito del propietario, no la pila S3+CloudFront de `infra/lib/frontend-stack.ts` — ver `docs/adr/0002-frontend-amplify.md`): `https://main.dy880wnmeoiy1.amplifyapp.com`, deploy manual (build local + zip + `create-deployment`/`start-deployment`), con regla de reescritura SPA configurada. CORS de la API actualizado para permitir este origen real.
- **Brecha real encontrada y documentada, no ocultada**: el frontend desplegado **no puede iniciar sesión** contra la nube real. Solo implementa el adaptador de login local (`/auth/local/token`), deshabilitado intencionalmente fuera de `APP_ENV=local`; además el JWT authorizer de API Gateway bloquea esa ruta con 401 antes de llegar al Lambda. Implementar el flujo real de Cognito (Authorization Code + PKCE) en `apps/web` es trabajo pendiente, no fue parte de lo ya construido en la Fase 0/1.
- Bugs reales de packaging/runtime encontrados y corregidos durante este despliegue (detalle en "Bugs encontrados y corregidos" más abajo): desajuste de arquitectura arm64/x86_64 en el bundling Docker, formateador de logs que descartaba tracebacks, `statement_timeout` incompatible con RDS Proxy, colisión de nombre entre el paquete `alembic` y la carpeta de migraciones del proyecto, ruta `/readyz` nunca registrada en el HTTP API, y límite de concurrencia de Lambda de esta cuenta nueva menor al asumido originalmente.
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
- **Infraestructura AWS CDK (TypeScript)**: stacks `network` (VPC 2 AZ, subred pública solo para NAT, privadas de app y aisladas de datos, S3 Gateway Endpoint), `data` (RDS PostgreSQL + RDS Proxy, SG con reglas mínimas, cifrado en reposo), `identity` (Cognito User Pool + resource server + client SPA sin secret), `async` (SQS + DLQ + dispatcher placeholder + EventBridge Scheduler cada minuto — el dispatcher real de outbox sigue pendiente, fase 5), `api` (HTTP API + Lambda **con código real empaquetado vía Docker bundling**, más un Lambda runner de migraciones + JWT authorizer + bucket de archivos privado), `frontend` (S3 privado + CloudFront con OAC — código presente pero **no desplegado**, el frontend real corre en Amplify), `observability` (dashboard + 3 alarmas, desplegado). Todos los stacks salvo `frontend` están desplegados en la cuenta real (ver sección anterior).
- **`cdk synth` verificado sin contactar ninguna cuenta AWS real**: los stacks son "environment-agnostic" por diseño; se corrigió además un comportamiento donde el propio CLI de `cdk` poblaba `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` desde el perfil `default` ambiente de la máquina — ahora se requiere el opt-in explícito `AULA_CDK_ENV=1` para usarlos (ver `docs/runbooks/aws-profile-setup.md`).
- **Pruebas de infra** (`infra/test/security.test.ts`, Jest + `aws-cdk-lib/assertions`): bucket de archivos y de frontend bloquean acceso público total, RDS no es públicamente accesible, ninguna policy IAM generada usa `Action`/`Resource` wildcard total, subredes de datos son aisladas. 6/6 pasando.
- **CI** (`.github/workflows/ci.yml`): lint/tipos + pytest con Postgres de servicio + `alembic upgrade head` desde una DB nueva (backend); lint/tipos/build (frontend); jest + `cdk synth --quiet` (infra). No incluye despliegue (no hay OIDC ni cuenta configurada).
- **Docker Compose**: Postgres + API con hot-reload; `.env`/`.env.example` documentados.

## Bugs encontrados y corregidos durante el despliegue real

Ninguno de estos era visible en local (Docker Compose) porque solo se manifiestan en la topología cloud real (Lambda, RDS Proxy, cuenta nueva). Se listan porque cambiaron código de aplicación, no solo infraestructura:

| Bug | Síntoma | Causa | Corrección |
|---|---|---|---|
| Arquitectura de Lambda | `ImportModuleError: No module named 'pydantic_core._pydantic_core'` | Docker bundling corrió en arm64 (host Apple Silicon); Lambda desplegado por defecto en x86_64 | `architecture: ARM_64` + `platform: "linux/arm64"` explícito en el bundling (`infra/lib/api-stack.ts`) |
| Logging sin traceback | Logs solo mostraban `"unhandled_error"` sin causa | `JsonFormatter` nunca incluía `record.exc_info` | Se agrega `payload["exception"]` cuando hay `exc_info` (`app/core/logging.py`) |
| `statement_timeout` vs RDS Proxy | `FATAL: Feature not supported: RDS Proxy currently doesn't support command-line options` | Se pasaba `-c statement_timeout=...` como `options` de conexión (libpq), no soportado por el proxy | `SET statement_timeout` vía evento `connect` de SQLAlchemy en vez de `connect_args` (`app/db/session.py`) |
| Ruta `/readyz` faltante | 404 en el HTTP API | Nunca se registró la ruta en `ApiStack`, solo `/healthz` | Ruta agregada en `infra/lib/api-stack.ts` |
| Colisión `alembic` | `Can't find Python file /var/task/alembic/env.py` | El paquete pip `alembic` y la carpeta de migraciones del proyecto comparten nombre; el `cp` las mezclaba | Las migraciones se copian a `db_migrations/` en el bundling; `migration_runner.py` apunta ahí |
| Cuota de concurrencia Lambda | `CREATE_FAILED`: *decreases account's UnreservedConcurrentExecution below its minimum* | Cuenta AWS nueva con cuota total menor a la asumida (30+5 reservadas) | Se quitó `reservedConcurrentExecutions` de ambos Lambdas hasta confirmar la cuota real |
| Config cloud de DB no existía | N/A (gap de diseño, no error en producción) | `Settings` solo sabía leer una `DATABASE_URL` completa; el Lambda recibe `DB_PROXY_ENDPOINT`+`DB_SECRET_ARN` | `_resolve_cloud_database_url()` en `app/core/config.py` arma la URL desde Secrets Manager una vez por contenedor frío |

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
| Jest `infra/test/security.test.ts` | **6/6 passed**, incluyendo el nuevo Lambda runner de migraciones |
| `cdk deploy` de los 6 stacks de aplicación contra la cuenta real | **Exitoso**; `cdk diff` revisado antes de cada deploy |
| `GET /healthz` contra la API real | **200**, confirmado con `curl` |
| `GET /readyz` contra la API real (toca RDS real vía proxy) | **200**, confirmado con `curl` tras corregir `statement_timeout` |
| `alembic upgrade head` contra la RDS real | **Exitoso**, confirmado con `current` = `f6ea9df6c91c` vía logs de CloudWatch |
| Frontend real en Amplify (`https://main.dy880wnmeoiy1.amplifyapp.com`) | Carga y enruta SPA correctamente (confirmado en navegador real); **login falla como se espera** (ver brecha de Cognito arriba) — confirmado con `curl` que el 401 viene del JWT authorizer, no de un bug de red |
| CORS de la API con el origen real de Amplify | Confirmado con `curl -X OPTIONS` que devuelve `access-control-allow-origin` correcto |
| Pruebas E2E con Playwright (`tests/e2e/`) | **No ejecutadas todavía** — solo hay un spec de referencia comentado; falta instalar Playwright |
| Pruebas de carga k6 (`tests/load/`) | **No ejecutadas** — script de referencia sin correr contra el ambiente real |

## Pendiente

### Urgente (bloquea usar el sistema real, no es "fase 2")
- **Login real de Cognito en el frontend** (Authorization Code + PKCE, sección 6): sin esto nadie puede autenticarse contra el ambiente desplegado. Es la brecha más importante detectada en esta sesión.
- **Sembrar datos reales o un flujo de invitación** para el ambiente cloud: el seed actual (`scripts/seed.py`) solo crea usuarios con credencial local, inútil en la nube; no existe todavía un usuario Cognito real ni un `school_memberships` correspondiente en la RDS real.
- Retirar la policy temporal `AulaCdkBootstrapOnly` del usuario `aula` si sigue adjunta (acción del propietario, con su identidad de administrador).
- Confirmar la cuota real de concurrencia de Lambda de la cuenta (Service Quotas) y reintroducir `reservedConcurrentExecutions` con un valor medido, no asumido.

### Fase 2 (sección 20 del documento de arquitectura)
- Estructura académica completa (traslados de sección, historial), matrícula avanzada.
- Contenido de curso (`course_units`, `lessons`) y su publicación.
- Archivos privados (`files`, presigned upload/download, escaneo antimalware) — todavía no implementado; los adjuntos de tareas/entregas no existen en esta entrega.
- Notas (`grade_items`, `grade_categories`, `grades`, `grade_revisions`), asistencia, exámenes, avisos, reportes, dashboards, outbox/SQS real (el dispatcher sigue siendo un placeholder), cobros opcionales (fase 7).
- MFA real con Cognito, invitaciones reales, SES con dominio verificado.
- FKs compuestas `(school_id, parent_id)` en tablas hijas como refuerzo adicional a la validación de aplicación ya existente (documentado como hardening pendiente en `db/base.py::SchoolScopedMixin`).
- Pruebas E2E Playwright y de carga k6, ambas con script de referencia listo pero sin ejecutar contra el ambiente real.
- Todas las decisiones de negocio de la sección 21 (branding, presupuesto, región/residencia, RPO/RTO, escala de notas, etc.) siguen sin cerrarse; no bloquearon esta entrega pero sí una producción real con alumnos.
- Runner de CodeBuild en VPC para migraciones (sección 5): el Lambda manual (`migration_runner.py`) es un sustituto funcional pero no automatizado desde CI/CD.
- Amplify conectado a GitHub con build automático, en vez del deploy manual actual (ver `docs/adr/0002-frontend-amplify.md`).

## Riesgos conocidos

- El adaptador de login local usa contraseña compartida (`aula-local-dev`) para todos los usuarios semilla; es intencional y exclusivo de `APP_ENV=local`, documentado y con guarda de arranque, pero no debe confundirse con una política de contraseñas real.
- El bundle de frontend (~476KB) no está optimizado con code-splitting; aceptable para este alcance, revisar antes de una fase con más páginas.
- `cdk synth` detectó (y se corrigió) que el CLI de `cdk` puede poblar variables de entorno de cuenta AWS desde el perfil `default` de la máquina sin pedirlo explícitamente; se añadió el opt-in `AULA_CDK_ENV=1` para evitar que esto ocurra sin querer en un futuro `cdk deploy`.
- **Hay recursos reales con costo continuo corriendo ahora mismo** en la cuenta `861418247819`: RDS (db.t4g.micro Single-AZ), RDS Proxy, NAT Gateway, más el uso normal de Lambda/API Gateway/Amplify/CloudWatch. No se ha hecho una estimación de costo formal de este ambiente (`docs/cost-estimate.md` sigue siendo una plantilla); revisar el primer estado de cuenta de AWS.
- El Lambda de la API y el runner de migraciones comparten el mismo bundle de dependencias; no hay separación de capas todavía (aceptable a esta escala, revisar si el tamaño del paquete se vuelve un problema).

## Siguiente paso

Cerrar la brecha de login real (Cognito + PKCE en el frontend) antes de continuar con la Fase 2, porque sin eso el ambiente desplegado no es utilizable por nadie. En paralelo, el propietario debe revisar el primer cargo de AWS y decidir si mantener estos recursos corriendo o pausarlos (`cdk destroy <stack>`) mientras se retoma el desarrollo.
