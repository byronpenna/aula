# E2E (Cypress)

Un spec por módulo funcional de `apps/web`, contra el stack local real (no mocks):
backend FastAPI + Postgres vía Docker Compose, y `npm run dev` para el frontend.

## Requisitos antes de correr

```bash
docker compose up -d                 # desde la raíz del repo
cd apps/api && python ../../scripts/seed.py   # una vez; es idempotente
cd apps/web && npm run dev           # deja esto corriendo en otra terminal
```

Los specs asumen los usuarios de `scripts/seed.py` (`admin.demo`, `docente.demo`,
`alumno.demo`, `tutor.demo`, contraseña `aula-local-dev`) y los datos académicos
que ese seed crea (Colegio Demo, Sexto grado A, Matemática, un curso, la tarea
"Tarea de práctica: fracciones"). Si nunca corriste el seed, la mayoría de specs
fallan por falta de datos, no por un bug de la app.

## Correr

```bash
npm run cy:open   # modo interactivo
npm run cy:run    # headless, toda la suite
```

## Specs

| Archivo | Cubre |
|---|---|
| `login.cy.ts` | Login local (UI), validación de campos, error de credenciales, logout |
| `session_persistence.cy.ts` | Que la sesión sobreviva a un F5 (bug corregido con `lib/session.ts`) |
| `rbac_navigation.cy.ts` | Visibilidad de enlaces de navegación por rol |
| `courses.cy.ts` | Alcance de `/courses` por rol; botón "Nueva tarea" solo para staff |
| `assignments.cy.ts` | Crear/publicar tarea, entrega del alumno, revisión del docente |
| `file_attachments.cy.ts` | Subida de material y lectura de archivos adjuntos |
| `my_students.cy.ts` | Tutor viendo a su hijo vinculado y sus entregas |
| `admin_access_control.cy.ts` | El servidor (no solo la UI) bloquea `/admin/*` sin permiso |
| `admin_academics.cy.ts` | CRUD + archivar/reactivar en el módulo Academia |
| `admin_users.cy.ts` | Alta de usuario, activar/desactivar, roles, guardado del último admin |
| `admin_roles.cy.ts` | Matriz de permisos por rol, guardado de school_admin |

## Notas sobre el entorno compartido

Estos specs corren contra la misma base de datos de desarrollo que usas para
`make seed`/probar a mano — no hay una base descartable por corrida. Por diseño:

- Los tests que alternan estado (activar/desactivar, permisos de un rol) detectan
  el estado real antes de actuar y hacen un ciclo de ida y vuelta, para no
  depender de que el entorno empiece "limpio" ni dejarlo distinto de como lo
  encontraron.
- El test que da de alta un usuario nuevo (`admin_users.cy.ts`) crea uno con
  nombre único por corrida (`e2e.docente.<timestamp>`) y no lo elimina (la API no
  expone borrado duro de usuarios, por diseño de todo el proyecto). Correr la
  suite muchas veces acumula esos usuarios de prueba en el entorno local; no
  afecta a los demás specs, pero si molesta, se pueden desactivar a mano desde
  `/admin/users`.
