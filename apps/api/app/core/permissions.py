"""Catálogo de permisos granulares (sección 6 del documento de arquitectura).

Este módulo es la única fuente de verdad de los códigos de permiso; el seed
(`scripts/seed.py`) los inserta en la tabla `permissions` y arma la matriz
`role_permissions`. Añadir un permiso nuevo aquí y en el seed, nunca solo en un router.
"""

from __future__ import annotations

# Permisos explícitos del documento base.
USERS_MANAGE = "users:manage"
ACADEMICS_MANAGE = "academics:manage"
COURSE_READ = "course:read"
ASSIGNMENT_MANAGE = "assignment:manage"
SUBMISSION_CREATE = "submission:create"
SUBMISSION_GRADE = "submission:grade"
ATTENDANCE_MANAGE = "attendance:manage"
GRADE_PUBLISH = "grade:publish"
REPORT_READ = "report:read"
BILLING_MANAGE = "billing:manage"

# Extensiones necesarias para la entrega vertical (matrícula), documentadas aquí
# porque el documento base no las enumera explícitamente pero sí exige el flujo.
ENROLLMENT_MANAGE = "enrollment:manage"
GUARDIAN_LINK_MANAGE = "guardian_link:manage"

# Área administrativa del sitio público (apps/public_web/AGENTS admin): un solo
# permiso para todo el módulo `public_site` (noticias hoy, más contenido después),
# igual que el resto del catálogo no separa "crear" de "editar" por recurso.
PUBLIC_SITE_MANAGE = "public_site:manage"

# Fase 3 (Usuarios y roles, sección 6): separados de USERS_MANAGE porque editar la
# matriz de permisos de un rol es una acción distinta y más sensible que
# invitar/desactivar usuarios; auditoría es de solo lectura.
ROLES_MANAGE = "roles:manage"
AUDIT_READ = "audit:read"

# Catálogo de libros digitales (módulo nuevo, independiente de cursos): BOOKS_READ
# es solo para ver el catálogo/precio y la propia biblioteca (comprar no requiere
# permiso especial, cualquiera con BOOKS_READ puede iniciar una compra); BOOKS_MANAGE
# es crear/editar libros, subir el archivo y registrar compras por colecturía.
BOOKS_MANAGE = "books:manage"
BOOKS_READ = "books:read"

ALL_PERMISSIONS: dict[str, str] = {
    USERS_MANAGE: "Invitar, desactivar y administrar usuarios del colegio",
    ROLES_MANAGE: "Ver y editar roles y su matriz de permisos",
    AUDIT_READ: "Consultar el registro de auditoría",
    ACADEMICS_MANAGE: "Administrar años, secciones, materias y cursos",
    COURSE_READ: "Consultar cursos y su contenido",
    ASSIGNMENT_MANAGE: "Crear, editar y publicar tareas",
    SUBMISSION_CREATE: "Crear y enviar entregas propias",
    SUBMISSION_GRADE: "Calificar entregas de alumnos",
    ATTENDANCE_MANAGE: "Registrar y editar asistencia",
    GRADE_PUBLISH: "Publicar calificaciones",
    REPORT_READ: "Consultar reportes",
    BILLING_MANAGE: "Administrar cargos y pagos (módulo opcional)",
    ENROLLMENT_MANAGE: "Matricular alumnos en secciones y cursos",
    GUARDIAN_LINK_MANAGE: "Administrar vínculos entre tutores y alumnos",
    PUBLIC_SITE_MANAGE: "Administrar el contenido del sitio público (noticias y otros)",
    BOOKS_MANAGE: "Administrar el catálogo de libros y registrar compras por colecturía",
    BOOKS_READ: "Consultar el catálogo de libros y la propia biblioteca",
}

# Rol -> permisos por defecto, usado solo por el seed para poblar role_permissions.
DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "school_admin": list(ALL_PERMISSIONS.keys()),
    "public_site_editor": [PUBLIC_SITE_MANAGE],
    "coordinator": [
        ACADEMICS_MANAGE,
        COURSE_READ,
        REPORT_READ,
        ENROLLMENT_MANAGE,
        GUARDIAN_LINK_MANAGE,
        BOOKS_READ,
    ],
    "teacher": [
        COURSE_READ,
        ASSIGNMENT_MANAGE,
        SUBMISSION_GRADE,
        ATTENDANCE_MANAGE,
        GRADE_PUBLISH,
        BOOKS_READ,
    ],
    "student": [COURSE_READ, SUBMISSION_CREATE, BOOKS_READ],
    "guardian": [COURSE_READ, REPORT_READ, BOOKS_READ],
    "finance": [BILLING_MANAGE, BOOKS_MANAGE, BOOKS_READ],
}
