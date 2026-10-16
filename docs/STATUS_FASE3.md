# Estado del proyecto — Fase 1, 2 y 3a (Usuarios y Roles)

> Generado automáticamente para dejar constancia de lo entregado hasta ahora y
> de lo que falta. Complementa a `docs/admin-discovery.md` (discovery original
> del paquete `aula_virtual_linares_agente_v2`) y a `docs/IMPLEMENTATION_STATUS.md`.

## 1. Resumen ejecutivo

| Bloque | Estado | Commit |
|---|---|---|
| RBAC de UI (profesor no ve admin, alumno solo sus cursos) | ✅ Hecho | `4a9e5bf fix session` |
| Persistencia de sesión (zustand + sessionStorage) | ✅ Hecho | `4a9e5bf fix session` |
| Fase 1 — marca institucional + paridad CRUD de Academia | ✅ Hecho | `4150283 phase1` |
| Fase 3a — Usuarios, Roles, Permisos y Auditoría (alcance colegio, Cognito real) | ✅ Código completo — ⚠️ **sin commit, sin deploy de infra** | *(working tree)* |
| Invitación por correo real (SES) | ✅ Código completo — ⚠️ **sin identidad SES verificada, sin deploy** | *(working tree)* |

El proyecto corre localmente (`docker compose up -d` con el override de puerto
descrito en `compose.override.yaml`): API en `http://localhost:8000`, DB en
`localhost:5433`.

## 2. Qué se hizo

### 2.1 RBAC de UI + sesión persistente

- `CourseDetailPage.tsx`: los botones/formulario de "Nueva tarea" y "Publicar"
  solo se muestran a personal (`teacher`/`school_admin`/`coordinator`), igual
  que ya hacía `AssignmentDetailPage.tsx`.
- Sesión: antes se perdía al recargar porque el token vivía solo en memoria.
  Se instaló `zustand` y se creó `apps/web/src/lib/session.ts` (store con
  persistencia en `sessionStorage`, nunca `localStorage`); `apiClient.ts` y
  `AuthContext.tsx` ahora rehidratan desde ese store tanto en modo local como
  en modo Cognito (que ya persistía su propio estado vía `oidc-client-ts`).

### 2.2 Fase 1 — Marca institucional + paridad de Academia

- Branding real tomado de `apps/public_web` (logo, colores, tipografías
  Inter/Poppins) vía tokens `@theme inline` en `index.css`; reemplazo de todas
  las clases `sky-*` por `brand-*`.
- Rediseño (no solo cosmético) de la pantalla de Academia
  (`AcademicsAdminPage.tsx`, ~1500 líneas): tablas reales, `StatusBadge`,
  edición inline, archivar/activar para los 4 catálogos (años, grados,
  secciones, materias) y para cursos.
- Corrección de semántica de archivado de cursos: un curso archivado se
  excluye de los listados de navegación pero sigue siendo resoluble por ID
  (para acceso histórico a tareas/entregas ya existentes).
- Nuevos componentes: `Breadcrumbs`, `StatusBadge`, `MetricCard`.
- Nuevo shell de administración: `AdminLayout.tsx` (sidebar) +
  `AdminDashboardPage.tsx` (KPIs) en `/admin`.
- Migración `7cb2030948f9` (columnas `status` en catálogo académico) y tests
  (`test_academics_catalog_management.py`, actualización de
  `test_course_management.py`).
- Efecto colateral corregido: un bug preexistente y no relacionado en
  `public_site/router.py` (faltaba `response_model=None` en un `DELETE`)
  tumbaba toda la app FastAPI al importar; se corrigió con el mismo patrón que
  ya se usaba para el archivado de cursos.

### 2.3 Fase 3a — Usuarios, Roles, Permisos y Auditoría

**Decisiones del usuario que gobiernan este bloque:**
- Alcance institucional completo (todo el colegio), no granular por
  año/grado/sección — eso queda para una fase futura, pendiente de decisión
  institucional sobre qué puede hacer un coordinador.
- Alta de usuario: contraseña generada aleatoriamente por defecto, editable en
  el formulario, **usando el User Pool de Cognito real ya desplegado** (no un
  mecanismo de credenciales paralelo).

**Backend:**
- `core/permissions.py`: nuevos permisos `roles:manage`, `audit:read`.
- `identity/models.py`: `Role.is_system`, `Role.version` (control de
  concurrencia optimista). Migración `492d3c002ca9` (backfill `is_system=True`
  para los 7 roles sembrados).
- `identity/cognito_admin.py` (nuevo): `admin_create_user()` — llama
  `cognito-idp:AdminCreateUser` con `MessageAction=SUPPRESS` (no hay SES
  configurado; la contraseña se comunica desde el propio formulario).
- `identity/service.py`: alta de usuario con rama dual según
  `settings.local_auth_enabled` (local → `LocalAuthCredential`; Cognito real →
  `admin_create_user`), activar/desactivar membresía, asignar/revocar rol,
  actualizar permisos de rol con `expected_version` (409 en conflicto).
- Guardado del "último administrador": ninguna acción puede dejar un colegio
  sin ningún titular activo de `users:manage`/`roles:manage`.
- Endpoints nuevos en `identity/router.py`: `GET/POST /users`,
  `PATCH /users/{id}`, `POST /users/{id}/activate|deactivate`,
  `POST/DELETE /users/{id}/role-assignments...`, `GET /roles`,
  `PUT /roles/{code}/permissions`, `GET /roles/{code}/users`,
  `GET /permissions`, `GET /audit-logs` (este último redacta el campo
  `changes`, solo expone actor/acción/recurso/fecha).
- Tests nuevos: `test_users_management.py`, `test_roles_management.py`,
  `test_audit_log.py` (incluyen la rama Cognito simulada con
  `unittest.mock.patch("boto3.client", ...)`, sin tocar AWS real).

**Infraestructura (`infra/lib/api-stack.ts`):**
- Nueva variable de entorno `COGNITO_USER_POOL_ID` para el Lambda de la API.
- Nuevo permiso IAM `cognito-idp:AdminCreateUser`, acotado al ARN del User
  Pool (ningún otro permiso `Admin*`).
- Validado con `cdk synth` + `npm test` (Jest, sin credenciales AWS reales).
  **No se ejecutó `cdk deploy`.**

**Frontend:**
- `AdminLayout.tsx`: navegación ahora filtrada por los permisos reales del
  usuario (`NAV_SECTIONS`).
- `AdminUsersPage.tsx` (nuevo, `/admin/users`): listado, filtros, alta con
  contraseña generada+editable, activar/desactivar.
- `AdminRolesPage.tsx` (nuevo, `/admin/roles`): lista de roles, matriz de
  permisos por módulo, guardado con `expected_version` y manejo de 409,
  usuarios asignados por rol.
- Verificado en navegador: login local, alta de usuario, cambio de permisos
  de un rol con reflejo real en lo que ve un docente, bloqueo del 409 al
  "último administrador".

### 2.4 Invitación por correo real (SES)

Siguiendo con el patrón dual ya usado para altas locales/Cognito, `create_user`
ahora también decide si puede enviar la invitación por correo:

- **Nuevo módulo `identity/mailer.py`**: `send_invitation_email()` llama
  `ses:SendEmail` (mismo patrón de `cognito_admin.py`: aislado para poder
  simular `boto3.client` en tests). Nunca lanza — si SES rechaza el envío, la
  cuenta ya creada se mantiene y el llamador decide qué mostrar.
- **`core/config.py`**: `mail_from_address` (si está vacío, el correo queda
  deshabilitado — es el caso por defecto en todos los ambientes hoy),
  `mail_from_name`, `app_base_url` (link de login que va en el cuerpo del
  correo).
- **`identity/service.py::create_user`**: si hay `email` en el alta y
  `mail_from_address` configurado, envía la invitación (usuario + contraseña
  temporal + link de login) y devuelve si se envió.
- **Respuesta de `POST /users`** (`UserCreateOut`): `invitation_sent: bool` +
  `temporary_password: str | None` — la contraseña **nunca** viaja en la
  respuesta HTTP si ya se envió por correo (no duplicar el secreto en dos
  canales, uno de los cuales puede quedar en logs de acceso/proxy).
- **Frontend (`AdminUsersPage.tsx`)**: tras crear la cuenta, muestra un aviso
  distinto según `invitation_sent` — "se envió la invitación a {email}" o la
  contraseña para copiar y compartir a mano.
- **Infra (`infra/lib/api-stack.ts`)**: nuevo prop `sesFromEmail?: string` —
  sin definir (el caso hoy), no se otorga ningún permiso `ses:*` y
  `MAIL_FROM_ADDRESS` queda vacío en el Lambda. Si se define, otorga
  `ses:SendEmail`/`ses:SendRawEmail` acotado al ARN exacto de esa identidad
  (nunca `*`, verificado con un test nuevo en `security.test.ts`).
- **Tests nuevos** en `test_users_management.py`: envío exitoso (SES simulado),
  envío fallido no revierte el alta, y el caso sin correo configurado sigue
  devolviendo la contraseña en la respuesta.

**Por qué no se desplegó nada todavía**: SES exige una identidad verificada
(dominio o dirección de correo) antes de poder enviar, y ningún entorno de
este proyecto tiene todavía un dominio propio ni una dirección verificada
(Cognito/CloudFront usan dominios AWS por defecto — ver `infra/bin/aula.ts`).
El código queda listo y parametrizado por `sesFromEmail`/`MAIL_FROM_ADDRESS`;
falta que el propietario decida qué dirección/dominio usar, la verifique en
SES, y la pase a `infra/bin/aula.ts` antes de desplegar.

### 2.5 Entorno local

- `compose.override.yaml` (gitignorado): remapea el puerto publicado de `db`
  a `5433` porque el `5432` del host ya estaba ocupado por un contenedor de
  otro proyecto en la misma máquina (`portal-2-core-be-db-1`, no se tocó).
- Stack corriendo: `aula-db-1` (5433→5432), `aula-api-1` (8000).

## 3. Verificación realizada

- Backend: `pytest -q`, `ruff check app/`, `mypy app/` — en verde en la última
  corrida.
- Infra: `cdk synth`, `npm test` (Jest) — en verde.
- Frontend: `npm run typecheck && npm run lint && npm run build` — en verde.
- Navegador: flujo completo de Fase 3a verificado manualmente (login, alta de
  usuario, edición de permisos, bloqueo de último admin).

## 4. Estado de commits

La Fase 3a completa (Usuarios/Roles/Permisos/Auditoría) **y** el bloque de
invitación por correo (2.4) ya quedaron commiteados en `3bd6845 changes`. Lo
único que sigue sin commitear es el ajuste final de esta misma iteración
(la respuesta `UserCreateOut`/`invitation_sent` en `create_user` y su reflejo
en el formulario de alta):

```
M  apps/api/app/modules/identity/service.py
M  apps/web/src/lib/types.ts
M  apps/web/src/routes/AdminUsersPage.tsx
M  docs/STATUS_FASE3.md
```

No se ha creado ningún commit en esta sesión (no se pidió). Cuando quieras,
pide explícitamente el commit y lo preparo.

## 5. Próximos pasos

1. **Commit del ajuste final de invitación por correo** (los 4 archivos de la
   sección 4), pendiente de tu confirmación explícita.
2. **Verificar una identidad en SES** (dominio propio o una dirección de
   correo) y pasarla como `sesFromEmail` en `infra/bin/aula.ts` — sin esto,
   `identity/mailer.py` queda inactivo en cualquier entorno desplegado y
   `create_user` sigue mostrando la contraseña en el formulario en vez de
   enviarla.
3. **`cdk deploy`** del cambio de IAM para Cognito (`cognito-idp:AdminCreateUser`,
   ya commiteado) y, una vez verificada la identidad SES del punto 2, del
   permiso `ses:SendEmail` — acción del propietario de la cuenta AWS; sin el
   primero, la alta de usuarios reales vía Cognito fallará por falta de
   permisos en el entorno desplegado (en local funciona porque usa
   `LocalAuthCredential`).
4. **RBAC granular (Fase 3b)** — coordinador limitado a año/grado/sección:
   pendiente de que definan la política institucional de qué puede ver/hacer
   un coordinador.
5. **Pantalla de Auditoría dedicada** (`/admin/audit-logs`) — el endpoint ya
   existe (`GET /audit-logs`), falta la UI.
6. **Limpieza del dato duplicado preexistente** en `enrollments` del dev local
   (rompe el reseed idempotente de `scripts/seed.py`; no es un bug introducido
   en esta sesión, documentado y no corregido por estar fuera de alcance).
7. **Revisar `apps/public_web/public_web_oferta_bachilleratos_agente/`** — su
   propósito aún no se investigó; confirmar si corresponde actuar sobre él.
