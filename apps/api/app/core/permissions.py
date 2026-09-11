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

ALL_PERMISSIONS: dict[str, str] = {
    USERS_MANAGE: "Invitar, desactivar y administrar usuarios del colegio",
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
}

# Rol -> permisos por defecto, usado solo por el seed para poblar role_permissions.
DEFAULT_ROLE_PERMISSIONS: dict[str, list[str]] = {
    "school_admin": list(ALL_PERMISSIONS.keys()),
    "coordinator": [
        ACADEMICS_MANAGE,
        COURSE_READ,
        REPORT_READ,
        ENROLLMENT_MANAGE,
        GUARDIAN_LINK_MANAGE,
    ],
    "teacher": [
        COURSE_READ,
        ASSIGNMENT_MANAGE,
        SUBMISSION_GRADE,
        ATTENDANCE_MANAGE,
        GRADE_PUBLISH,
    ],
    "student": [COURSE_READ, SUBMISSION_CREATE],
    "guardian": [COURSE_READ, REPORT_READ],
    "finance": [BILLING_MANAGE],
}
