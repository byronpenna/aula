# Diseño técnico propuesto: datos, APIs y autorización

> **Contratos de referencia, no descripción del sistema ya instalado.** El agente debe identificar backend, ORM, migraciones, servicio de identidad y endpoints existentes. Conservar nombres/rutas/semántica actuales cuando sea posible. Introducir endpoints nuevos solo para brechas reales y documentarlos en la especificación del repositorio.

## 1. Modelo de dominio lógico

```text
academic_years(id, label, starts_on, ends_on, status, created_at, updated_at)
grades(id, name, sort_order, status, created_at, updated_at)
subjects(id, code, name, status, created_at, updated_at)
sections(id, academic_year_id FK, grade_id FK, name, capacity NULL, status, ...)
courses(id, academic_year_id FK, section_id FK, subject_id FK,
        starts_on, ends_on, status, ...)
course_teachers(id, course_id FK, teacher_user_id FK, is_primary,
                assigned_at, unassigned_at NULL, assigned_by FK, ...)
enrollments(id, student_user_id FK, academic_year_id FK, section_id FK,
            starts_on, ends_on NULL, status, ...)
users(id, identity_provider_id UNIQUE NULL, first_name, last_name,
      email UNIQUE, institutional_id UNIQUE NULL, status,
      invited_at NULL, last_login_at NULL, ...)
roles(id, key UNIQUE, name, description, is_system, is_editable, status, version, ...)
permissions(id, key UNIQUE, module, action, description)
role_permissions(role_id FK, permission_id FK, PRIMARY KEY(role_id, permission_id))
user_role_assignments(id, user_id FK, role_id FK, scope_type,
                      scope_id NULL, assigned_by FK, assigned_at, revoked_at NULL)
guardian_students(guardian_user_id FK, student_user_id FK,
                  relationship, verified_at NULL, status, ...)
audit_logs(id, actor_user_id NULL, action, resource_type, resource_id,
           before_redacted JSON NULL, after_redacted JSON NULL,
           request_id, occurred_at)
```

### Al adaptar al proyecto

- **Si el curso ya tiene `teacher_id`:** ese campo o la tabla actual es la fuente de verdad. Solo crear `course_teachers` si se necesitan múltiples docentes/historial y existe un plan de migración claro. No escribir dos fuentes en paralelo sin reconciliación.
- **Si las matrículas ya son por curso:** no cambiar su semántica silenciosamente; exponer el flujo «matricular en sección» mediante las reglas existentes o discutir la ampliación con el colegio.
- **Si usuarios ya viven en el proveedor de identidad:** `users` es un perfil local con clave de referencia, no un almacén adicional de contraseñas.
- **Si los roles ya vienen del proveedor de identidad:** decidir si el IdP o la app es la fuente de autorización; no duplicar decisiones divergentes.
- `capacity`, fechas de invitación, último login y auditoría pueden ser opcionales solo donde el producto lo soporte.

### Integridad e índices recomendados

| Entidad | Regla |
|---|---|
| Año | `starts_on < ends_on`; `label` única normalizada si corresponde a la institución. |
| Grado | nombre normalizado único según ámbito del catálogo; `sort_order >= 1`. |
| Materia | código único case-insensitive y nombre obligatorio. |
| Sección | única `(academic_year_id, grade_id, normalized_name)` dentro de política de archivados. |
| Curso | único `(section_id, subject_id)` solo si no hay períodos/ediciones adicionales. |
| Matrícula | índice parcial de matrícula activa según política de una o múltiples secciones. |
| Usuarios | correo normalizado único, ID de IdP único cuando existe. |
| Asignaciones | prevenir duplicados activos de rol + usuario + alcance. |
| Auditoría | índices por fecha, actor y recurso; escritura append-only a nivel aplicación y acceso restringido. |

Usar `DATE` para períodos académicos; evitar que conversiones UTC desplacen una fecha de calendario. Integrar los `CHECK` y `UNIQUE` con las convenciones del motor real y comprobar los datos preexistentes **antes** de crear constraints estrictos.

## 2. Modelo RBAC con alcance

### `can(user, permission_key, resource)`

1. Validar identidad, sesión y estado activo del usuario.
2. Obtener roles/asignaciones vigentes y permisos efectivos **en el servidor**.
3. Para cada concesión, comprobar que el permiso y el alcance coinciden en la **misma** asignación válida.
4. Resolver la pertenencia real del recurso a institución/año/grado/sección/curso o relación personal (alumno propio/encargado verificado).
5. Aplicar las restricciones de negocio (registro archivado, matrícula cerrada, último administrador, etc.).
6. Denegar de manera segura (`403` o `404` deliberado) y auditar escrituras sensibles.

```text
scope_type: institution | academic_year | grade | section | course | self | linked_students
scope_id: obligatorio si el tipo apunta a un recurso concreto; no confiar en scope_id del cliente
```

El alcance `grade` requiere política explícita respecto al año (¿todas las secciones de ese grado o solo el ciclo asignado?). No usar comodines globales salvo concesión expresa y auditada. Un token con permisos obsoletos no puede sostener privilegios revocados indefinidamente: definir TTL corto, invalidación o lookup server-side.

## 3. API de referencia

Prefijo propuesto: `/api/v1/admin`. Mantener los endpoints actuales o implementar adaptadores cuando ya exista contrato público.

| Recurso | GET/listar | Crear | Actualizar | Acción de estado |
|---|---|---|---|---|
| Dashboard | `GET /dashboard?academic_year_id=...` | — | — | — |
| Años | `GET /academic-years` | `POST /academic-years` | `PATCH /academic-years/{id}` | `POST /academic-years/{id}/archive` |
| Grados | `GET /grades` | `POST /grades` | `PATCH /grades/{id}` | `POST /grades/{id}/archive` |
| Materias | `GET /subjects` | `POST /subjects` | `PATCH /subjects/{id}` | `POST /subjects/{id}/archive` |
| Secciones | `GET /sections?academic_year_id=...&grade_id=...` | `POST /sections` | `PATCH /sections/{id}` | `POST /sections/{id}/archive` |
| Cursos | `GET /courses?academic_year_id=...&section_id=...` | `POST /courses` | `PATCH /courses/{id}` | `POST /courses/{id}/archive` |
| Inscripciones | `GET /enrollments?academic_year_id=...` | `POST /enrollments` | `PATCH /enrollments/{id}` | `POST /enrollments/{id}/withdraw` |
| Usuarios | `GET /users?query=...&role=...&status=...` | `POST /users/invitations` | `PATCH /users/{id}` | `POST /users/{id}/deactivate` |
| Roles | `GET /roles` y `GET /roles/{id}` | `POST /roles` | `PATCH /roles/{id}` | `POST /roles/{id}/archive` |
| Permisos | `GET /permissions` | — | `PUT /roles/{id}/permissions` | — |
| Auditoría | `GET /audit-logs` | — | — | — |

### Operaciones específicas

```http
POST   /courses/{id}/teachers
DELETE /courses/{id}/teachers/{assignment_id}
POST   /enrollments/{id}/transfer
POST   /users/{id}/invitations/resend
POST   /users/{id}/activate
GET    /users/{id}/effective-permissions
POST   /users/{id}/role-assignments
DELETE /users/{id}/role-assignments/{assignment_id}
GET    /roles/{id}/users
GET    /roles/{id}/audit-logs
```

No implementar rutas opcionales si no hay pantalla, caso de negocio y backend correspondiente. Los listados deben incorporar paginación/orden y aplicar filtros autorizados **en la consulta de servidor**, antes de calcular total o enviar datos.

### Ejemplo: crear curso

```json
{
  "academic_year_id": "uuid-del-anio",
  "section_id": "uuid-de-seccion",
  "subject_id": "uuid-de-materia",
  "starts_on": "2026-01-15",
  "ends_on": "2026-11-15",
  "teacher_user_id": "uuid-del-docente"
}
```

El campo docente solo se acepta si forma parte del proceso actual/decidido. Verificar que la sección pertenezca al año y que la asignación sea autorizada.

### Ejemplo: invitación y asignación de rol

```json
{
  "first_name": "Ana",
  "last_name": "Pérez",
  "email": "ejemplo@colegio.edu.sv",
  "send_invitation": true,
  "role_assignments": [
    {
      "role_key": "teacher",
      "scope_type": "course",
      "scope_id": "uuid-de-curso"
    }
  ]
}
```

**No confiar en `role_key` ni en `scope_id`:** el servidor valida que el actor puede delegar ese permiso en ese ámbito. Aplicar idempotencia a invitaciones para evitar duplicados por reintento y coordinar el resultado con el IdP y el correo.

### Ejemplo: actualizar permisos de un rol

```json
{
  "expected_version": 4,
  "permission_keys": [
    "courses.read",
    "courses.update",
    "courses.assign_teacher"
  ]
}
```

Confirmar que el actor puede administrar ese rol y todas las capacidades concedidas; si la versión ya cambió, responder `409` y ofrecer resolución de conflicto desde UI. Actualización atómica y auditoría con diferencia anterior/posterior.

### Respuestas y errores

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Revisa los campos indicados",
  "fields": {"ends_on": "Debe ser posterior a la fecha de inicio"}
}
```

HTTP orientativos: `200/201/204` éxito; `400/422` validación; `401` no autenticado; `403` no autorizado; `404` inexistente/no visible; `409` conflicto; `429` rate limit; `500` error genérico con identificador de solicitud sin trazas sensibles.

## 4. Autorización en UI + servidor

- UI consume el conjunto real de permisos/alcances para decidir menú, acciones, filtros y mensajes de acceso.
- Servidor valida **cada lectura y mutación**, incluidas exportaciones, búsquedas por correo, listado de roles y edición por ID.
- Controlar enumeración de usuarios y consulta lateral de registros ajenos (IDOR).
- No permitir modificar roles/alcances en `PATCH /me` o en un `PATCH /users/{id}` genérico; endpoints privilegiados separados.
- Una desactivación o revocación invalida o acorta credenciales y caché de autorización según el proveedor de identidad.
- Audit trail obligatorio para cambios de roles, docentes, estados de usuario, traslados e integridad de periodos.

## 5. Estrategia de migración y backfill

1. Inventario de tablas, llaves foráneas, roles existentes y datos anómalos; respaldo y ensayo sobre copia anonimizada.
2. Añadir tablas/columnas nuevas **sin borrar ni renombrar** las antiguas en la primera migración.
3. Resolver mapeo del usuario autenticado a usuario local, conservar claves existentes y no duplicar cuentas.
4. Asignar roles actuales de forma explícita: no inferir «admin» por correo, nombre o etiqueta de sesión sin fuente de identidad verificable.
5. Sembrar catálogo de permisos **sin conceder** privilegios extra por defecto; mapear grants actuales y pedir aprobación sobre expansiones.
6. Ejecutar validación de constraints contra datos reales; generar reporte de incompatibilidades (incluido el período de ejemplo 2027 con fechas 2026, si sigue existiendo).
7. Lanzar bajo feature flag o ruta paralela; probar flujos con datos históricos; habilitar nueva UI cuando sea funcionalmente equivalente.
8. Retirar pantallas/APIs obsoletas solo después de validación en producción y ventana de rollback acordada.

Si el proyecto usa autenticación administrada por terceros, no introducir nueva autenticación casera. Para correos de invitación y notificaciones, identificar sistema de correo preexistente y contemplar fallas y reintentos idempotentes.
