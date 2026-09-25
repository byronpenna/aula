# Descubrimiento — Rediseño de administración (Fase 0)

Entregable de la Fase 0 de `apps/web/aula_virtual_linares_agente_v2/05-PLAN-DE-IMPLEMENTACION.md`. Documenta lo encontrado en el repo **antes** de tocar código del rediseño; no se alteró ningún dato durante esta auditoría.

## 1. Stack real (no presupuesto por el paquete de especificación)

| Capa | Tecnología real |
|---|---|
| Frontend académico (`apps/web`) | React 19 + TS + Vite + Tailwind v4 + TanStack Query + React Hook Form + Zod + React Router v6. Paleta actual: clases Tailwind genéricas `sky-*`/`slate-*` (sin tokens de marca propios). |
| Frontend público (`apps/public_web`) | Next.js (App Router) + Tailwind v4. **Aquí sí existen tokens de marca reales** (`app/globals.css`): `--color-brand-50..900` (azul, `900=#172554`), `--color-accent-300..500` (dorado), fuentes `Inter` (sans) y `Poppins` (display). Ya tiene un mini panel admin propio (`app/admin`) para gestionar noticias — **no confundir con el admin académico de `apps/web`**, son apps y dominios distintos. |
| Backend | FastAPI + SQLAlchemy + Alembic + PostgreSQL, monorepo `apps/api`. Módulos: `identity`, `academics`, `learning`, `files`. |
| Auth | Cognito Authorization Code + PKCE (`oidc-client-ts`) en producción; adaptador de login local (JWT HS256) solo con `APP_ENV=local`. Roles/permisos son **100% locales** (tablas `roles`/`permissions`/`role_permissions`/`membership_roles`), no vienen de grupos de Cognito. |
| Tests | `pytest` contra Postgres real (backend), `oxlint`/`tsc` (frontend), Jest (infra CDK). Sin Playwright/E2E corriendo todavía (script de referencia sin ejecutar). |

## 2. Marca real vs. mockups del paquete

- **Escudo real**: `apps/public_web/public/img/logo.jpg` (960×960, JPEG). Es el único logo oficial en el repo; `apps/web` no tiene ninguno propio (solo `favicon.svg`/`icons.svg` genéricos de Vite).
- **Nombre/lema real** (`apps/public_web/lib/config.ts`): `SCHOOL_NAME = "Colegio Coronel Francisco Linares"`, `SCHOOL_SHORT_NAME = "Colegio Linares"`, lema `"Dios, Patria y Ciencia"` (confirmado en `Hero.tsx`, `Stats.tsx`, `Footer.tsx`, metadata de `layout.tsx`).
- **Colores reales**: azul (`brand-50..900`) y dorado (`accent-300..500`) confirmados en `globals.css`. **No existe un tercer color rojo institucional** en el sitio real — el paquete de diseño lo propone como acento, pero en el código público el rojo (`red-600`/`red-50` de Tailwind estándar) solo se usa para errores, igual que en `apps/web` hoy. Decisión tomada: **no inventar un rojo de marca**; mantener rojo únicamente para estados de error/peligro, como ya hacen ambas apps.
- **Tipografía real**: `Inter`/`Poppins` vía `next/font` en `apps/public_web`; `apps/web` no carga ninguna fuente propia (usa la fuente de sistema de Tailwind). Se adoptarán las mismas familias en `apps/web` (vía `@fontsource` o Google Fonts, ya que Vite no tiene el helper de `next/font`).
- **Conclusión de branding**: los tokens `--brand-navy/--brand-primary/--brand-gold` del documento `01-DISENO-Y-BRANDING.md` son aproximados pero cercanos; se reemplazan por los valores reales de `apps/public_web/app/globals.css`, portados a `apps/web` como variables Tailwind propias (`brand-*`, `accent-*`) en un solo lugar (`tailwind.config`/`@theme`), no repetidos a mano por componente.

## 3. Matriz funcionalidad existente → estado

| Módulo (spec) | ¿Existe hoy en `apps/web`? | Ruta/componente actual | Endpoint actual |
|---|---|---|---|
| Años académicos | ✅ Crear, listar | `AcademicYearsSection` en `AcademicsAdminPage.tsx` | `GET/POST /academic-years` |
| Grados | ✅ Crear, listar | `GradeLevelsSection` | `GET/POST /grade-levels` |
| Materias | ✅ Crear, listar | `SubjectsSection` | `GET/POST /subjects` |
| Secciones | ✅ Crear, listar | `SectionsSection` | `GET/POST /sections` |
| Cursos | ✅ Crear, listar, **editar, eliminar (baja lógica), asignar docente** (agregado en esta sesión, antes de leer este paquete) | `CoursesSection`/`CourseRow` | `GET/POST/PATCH/DELETE /courses`, `POST /courses/{id}/teachers` |
| Inscripciones | ✅ Matricular (alumno+año+sección+cursos), **bloqueada si el curso no tiene docente** (agregado esta sesión) | `EnrollmentsSection` | `GET/POST /enrollments`, `GET /students/{id}/enrollments` |
| Usuarios (`/admin/users`) | ❌ No existe ninguna pantalla ni endpoint de listar/crear/invitar/activar usuarios. | — | `USERS_MANAGE` permiso definido pero **sin ningún endpoint que lo use** |
| Roles y permisos (`/admin/roles`) | ❌ No existe pantalla ni endpoint de listar roles, ver matriz o editar permisos. Los roles son fijos en `core/permissions.py` + seed. | — | — |
| Auditoría (`/admin/audit-logs`) | ⚠️ Tabla `audit_events` existe y ya se escribe (`assignment.publish`, `enrollment.create`, `course.create/update/delete`, etc.) pero **no hay endpoint de lectura ni UI**. | — | — |
| Layout institucional (header/sidebar de marca) | ❌ `AppShell.tsx` es una barra horizontal simple sin logo, sin sidebar, sin breadcrumbs. | `AppShell.tsx` | — |
| Dashboard con KPIs | ❌ `HomePage.tsx` solo lista los permisos del usuario en texto plano; no hay KPIs, actividad reciente ni accesos rápidos. | `HomePage.tsx` | `GET /me/permissions` |

**Conclusión clave**: la administración académica (años/grados/materias/secciones/cursos/inscripciones) ya está funcionalmente completa y no requiere reimplementarse — la Fase 2 del paquete (`05-PLAN-DE-IMPLEMENTACION.md`) está prácticamente resuelta en el backend; falta el **layout/branding** alrededor de ella (Fase 1) y las **tres piezas completamente nuevas**: Usuarios, Roles y permisos, Auditoría (Fase 3), que hoy no existen ni en frontend ni en backend (endpoints).

## 4. Modelo RBAC real vs. propuesto por el paquete

El modelo real (`app/core/deps.py`, `app/core/permissions.py`, `app/modules/identity/models.py`) ya resuelve **permiso + alcance** para lo que existe hoy, pero de una forma más simple que la propuesta del paquete:

- **Permiso**: catálogo fijo en código (`core/permissions.py`), no editable en runtime. Roles (`school_admin`, `coordinator`, `teacher`, `student`, `guardian`, `finance`) son filas en `roles`, asignadas a una `SchoolMembership` vía `membership_roles` — **siempre a nivel de colegio completo**, sin `scope_type`/`scope_id` por año/grado/sección.
- **Alcance real ya implementado, pero por relación de dominio, no por asignación de rol**: `academics/service.py::require_course_access` y `require_student_access` verifican el vínculo real (docente↔curso vía `course_teachers`, alumno↔curso vía `course_enrollments`, tutor↔alumno vía `guardian_student_links`) antes de conceder acceso — esto **ya cumple** la regla del paquete de "no confiar solo en el rol, verificar vínculo real" (sección 3 de `03-USUARIOS-ROLES-Y-SEGURIDAD.md`) para docentes/alumnos/tutores.
- **Brecha real frente al paquete**: no existe manera de decir "coordinador solo del grado X" o "administrador solo del año Y" — `school_admin`/`coordinator` siempre son alcance institución completa hoy. Implementar `scope_type: academic_year | grade | section` para esos roles requiere:
  1. Nueva tabla `role_scopes` (o extender `membership_roles` con `scope_type`/`scope_id` nullable) — migración aditiva, sin tocar filas existentes (todas quedarían `scope_type=institution` por compatibilidad).
  2. Cambiar `get_current_membership`/`require_permission` para resolver el alcance efectivo por permiso, no solo el conjunto de permisos.
  3. Esto es la pieza de mayor riesgo/tamaño del paquete completo — se aísla como **su propia sub-fase** (ver plan).
- `roles` no tiene `is_system`/`is_editable`/`version`/`description` (necesarios para proteger roles del sistema y edición concurrente de la matriz de permisos, sección 2 de `03-USUARIOS-ROLES-Y-SEGURIDAD.md`) — columnas nuevas, aditivas.
- No hay invitaciones (`invited_at`, envío de correo) ni `last_login_at` en `User` — columnas nuevas, aditivas. No hay servicio de correo real en el repo (grep sin resultados de SES/SMTP fuera de la mención en `docs/IMPLEMENTATION_STATUS.md` como pendiente de Fase 2/SES). **Bloqueo real**: sin servicio de correo, "invitar por correo" no puede prometerse como funcional; se documenta como decisión pendiente.

## 5. Auditoría de datos (sin corregir nada)

- **Corrección a una nota anterior de este documento**: al construir y probar la pestaña "Años académicos" del rediseño (ver §7), apareció en la base de desarrollo local un año etiquetado `2027` con fechas `2026-01-01 → 2026-01-02` — el mismo caso descrito como ejemplo en `02-PANTALLAS-Y-FLUJOS.md §0`. Es un registro real de esta base de desarrollo (creado accidentalmente durante pruebas manuales de sesiones anteriores, no dato de producción del colegio), pero se trata exactamente igual que dictan las reglas: **no se corrigió ni se infirió el año a partir de la etiqueta**; queda visible en la tabla con sus fechas tal cual, editable manualmente por un administrador si decide corregirlo.
- Se detectaron **filas duplicadas de `enrollments`** en la base de desarrollo local (mismo alumno/año/sección dos veces, visibles ahora en la pestaña "Inscripciones" del rediseño) que rompen el script de seed idempotente — son artefacto de pruebas manuales repetidas en este entorno local, no un caso de producción. No se modificaron; queda anotado para quien resetee el entorno local (`docker compose down -v` + recrear), fuera del alcance de este rediseño.

## 6. Decisiones institucionales pendientes (no inventadas, ver `05-PLAN-DE-IMPLEMENTACION.md` §"Bloqueos")

| # | Pregunta | Default conservador aplicado mientras no haya respuesta |
|---|---|---|
| 1 | ¿El coordinador puede matricular/trasladar y asignar docentes, o solo consultar? | Mantener lo actual: `coordinator` ya tiene `enrollment:manage`/`academics:manage` a nivel de colegio completo (igual que hoy); **no** se reduce ni amplía. |
| 2 | ¿Puede un alumno tener varias secciones activas en el mismo año? | No cambiar semántica: `enrollments` no tiene índice único que lo impida hoy a nivel de aplicación más allá de "no duplicar la misma sección"; no se toca. |
| 3 | ¿Hay varios docentes por curso? | Ya soportado (relación N:N vía `course_teachers`, agregado en esta sesión); no se introduce un segundo campo `teacher_id`. |
| 4 | ¿Quién verifica vínculos encargado–alumno? | Se mantiene el proceso actual (`guardian_student_links` con `status`/`valid_from`/`valid_to`, sin autoservicio); no se agrega autoverificación. |
| 5 | ¿Existe un escudo institucional autorizado? | **Sí, confirmado**: `apps/public_web/public/img/logo.jpg`. Se reutiliza tal cual. |
| 6 | ¿Quién puede crear administradores / cambiar permisos globales? | Se restringe a `users:manage` (ya en el catálogo, hoy sin endpoints); por defecto solo `school_admin` lo tiene, igual que hoy. No se concede a `coordinator`. |
| 7 | ¿Qué retención tienen los logs de auditoría / qué datos de menores puede exportar cada perfil? | Sin política institucional confirmada: **no se implementa exportación** en esta entrega; auditoría queda de solo lectura, sin retención automática (igual que la tabla `audit_events` hoy, que no tiene purga). |

## 7. Alcance recomendado para continuar (propuesta, sujeta a aprobación)

Dado el tamaño del paquete completo (rediseño visual + 2 módulos nuevos con RBAC de alcance + auditoría + invitaciones + E2E), se recomienda secuenciar en slices entregables de forma independiente, en vez de intentar las 5 fases del paquete en un solo lote. Ver plan propuesto en la conversación.

## 8. Fase 1 — hecho en esta entrega

Tras la Fase 0 (este documento), se ejecutó una Fase 1 ampliada que combina marca institucional (`01-DISENO-Y-BRANDING.md`) con paridad funcional real de Academia (parte de `02-PANTALLAS-Y-FLUJOS.md`), a pedido explícito del propietario ("la parte que ya está hecha conserva la funcionalidad o incluso optimízala, pero arregla su diseño para acoplarse a los estándares").

**Backend (`apps/api`)**
- Migración aditiva: columna `status` (`active`/`archived`) en `grade_levels`, `subjects`, `sections` (Años ya la tenía). Ninguna tabla se borró ni renombró.
- `PATCH` + `POST .../archive` + `POST .../activate` para años, grados, materias y secciones — antes solo tenían crear/listar. Archivar nunca oculta del listado (a diferencia de Cursos): la UI muestra el estado con una insignia y dos acciones (Archivar/Reactivar), reversible.
- Validación de duplicado case-insensitive (etiqueta de año, nombre de grado, código de materia, nombre de sección dentro de año+grado) con `409` claro en vez de un error genérico o un segundo registro silencioso.
- **Corrección de un hallazgo real**: `Course.status="deleted"` ocultaba el curso *incluso al resolverlo por ID*, lo que habría roto el acceso histórico a tareas/entregas de un curso archivado (viola la regla explícita "nunca se pierden tareas, calificaciones y archivos al desactivar"). Se renombró a `"archived"` y se separó la resolución por ID (`academics_repo.get_course`, ahora siempre la encuentra) de los listados de navegación/matrícula (`list_*`, que sí la excluyen). `DELETE /courses/{id}` pasó a `POST /courses/{id}/archive` + `POST /courses/{id}/activate`, coherente con el resto de catálogos. Se agregó el bloqueo correspondiente: un curso archivado no admite tareas nuevas (`learning.service.create_assignment`) ni matrículas nuevas (`academics.service.create_enrollment`).
- 24/24 tests pasando (`pytest`), incluidos 2 archivos nuevos (`test_course_management.py` ampliado, `test_academics_catalog_management.py`); `ruff`/`mypy` limpios.

**Frontend (`apps/web`)**
- Tokens de marca reales portados de `apps/public_web/app/globals.css` (azul `brand-50..900`, dorado `accent-300..500`, fuentes Inter/Poppins vía `@fontsource`) a `src/index.css`, y barrido mecánico de las clases `sky-*` genéricas a `brand-*` en los 11 archivos que las usaban. No se inventó un rojo de marca (no existe uno real en el sitio público); el rojo estándar queda solo para error/peligro.
- Escudo real (`apps/public_web/public/img/logo.jpg`) copiado a `apps/web/public/img/logo.jpg` y usado en el header (`AppShell.tsx`), junto a "Colegio Linares" / "Aula Virtual".
- Nuevo shell de administración: `AdminLayout` + `AdminSidebar` (solo "Inicio" y "Academia" — nada de Usuarios/Roles/Reportes porque no existen todavía), `Breadcrumbs`, `MetricCard`, `StatusBadge`.
- Nuevo `/admin` (dashboard) con 5 KPI reales (años/grados/materias/secciones/cursos, mismas queries que ya usaba Academia — sin duplicar llamadas) y accesos rápidos a cada pestaña.
- `AcademicsAdminPage` (`/admin/academics`) rediseñado con pestañas horizontales (`?tab=`) y tablas reales (columnas, `StatusBadge`, edición inline, Archivar/Reactivar) en vez de los seis bloques apilados con listas de "pills" — patrón explícitamente permitido por `02-PANTALLAS-Y-FLUJOS.md §1` ("pestañas horizontales dentro del módulo... sin duplicar botones de creación"). Ninguna funcionalidad existente (crear/editar/archivar curso, asignar docente, matricular con bloqueo por falta de docente) se perdió; varias ahora también existen para años/grados/materias/secciones.
- `index.html`: `lang="es-SV"`, título real.
- Verificado en navegador real (Chrome): dashboard con KPIs correctos, las 6 pestañas de Academia, crear/editar/archivar/reactivar en cada catálogo, asignación de docente, y que un docente sin permiso ve "Acceso no autorizado" al entrar a `/admin` por URL directa (el backend ya lo bloqueaba; ahora la UI también lo comunica con claridad). `npm run typecheck/lint/build` limpios.

**Explícitamente no incluido en esta entrega** (ver §6 y §7 más arriba): Usuarios, Roles y permisos, Auditoría (Fase 3); dividir Academia en rutas independientes por entidad con paginación de servidor; bloque "Actividad reciente" del dashboard (requiere un endpoint nuevo de lectura de `audit_events`); columnas de conteo (matriculados por curso/sección); verificación responsive real por debajo de 768px (las tablas se envolvieron en contenedores con scroll horizontal y el shell tiene un botón de menú móvil, pero no se pudo capturar una pantalla real <768px en esta sesión — la herramienta de redimensionar ventana del navegador no afectó el viewport real).
