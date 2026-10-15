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

### 2.4 Entorno local

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

## 4. ⚠️ Pendiente inmediato — nada de la Fase 3a está commiteado

`git status` confirma que **todo el bloque 2.3** (Usuarios/Roles/Permisos/
Auditoría + el cambio de IAM en infra) sigue solo en el árbol de trabajo:

```
M  apps/api/app/core/config.py
M  apps/api/app/core/permissions.py
M  apps/api/app/modules/identity/models.py
M  apps/api/app/modules/identity/repository.py
M  apps/api/app/modules/identity/router.py
M  apps/api/app/modules/identity/schemas.py
M  apps/api/app/modules/identity/service.py
M  apps/api/tests/factories.py
M  apps/web/src/App.tsx
M  apps/web/src/lib/types.ts
M  apps/web/src/routes/AdminLayout.tsx
M  docs/admin-discovery.md
M  infra/lib/api-stack.ts
?? apps/api/alembic/versions/492d3c002ca9_roles_is_system_and_version.py
?? apps/api/app/modules/identity/cognito_admin.py
?? apps/api/tests/test_audit_log.py
?? apps/api/tests/test_roles_management.py
?? apps/api/tests/test_users_management.py
?? apps/web/src/routes/AdminRolesPage.tsx
?? apps/web/src/routes/AdminUsersPage.tsx
```

No se ha creado ningún commit en esta sesión (no se pidió). Cuando quieras,
pide explícitamente el commit y lo preparo.

También aparece sin seguimiento `apps/public_web/public_web_oferta_bachilleratos_agente/`
— un paquete nuevo que no se ha investigado ni tocado en esta sesión; si
quieres que se trabaje, dilo explícitamente.

## 5. Próximos pasos

1. **Commit del bloque Fase 3a** (pendiente de tu confirmación explícita).
2. **`cdk deploy` del cambio de IAM** (`cognito-idp:AdminCreateUser`) — acción
   del propietario de la cuenta AWS; sin esto, la alta de usuarios reales vía
   Cognito fallará por falta de permisos en el entorno desplegado (en local
   funciona porque usa `LocalAuthCredential`).
3. **RBAC granular (Fase 3b)** — coordinador limitado a año/grado/sección:
   pendiente de que definan la política institucional de qué puede ver/hacer
   un coordinador.
4. **Pantalla de Auditoría dedicada** (`/admin/audit-logs`) — el endpoint ya
   existe (`GET /audit-logs`), falta la UI.
5. **Invitación por correo real** — no hay SES configurado; hoy la
   contraseña generada se entrega a mano desde el formulario de alta.
6. **Limpieza del dato duplicado preexistente** en `enrollments` del dev local
   (rompe el reseed idempotente de `scripts/seed.py`; no es un bug introducido
   en esta sesión, documentado y no corregido por estar fuera de alcance).
7. **Revisar `apps/public_web/public_web_oferta_bachilleratos_agente/`** — su
   propósito aún no se investigó; confirmar si corresponde actuar sobre él.
