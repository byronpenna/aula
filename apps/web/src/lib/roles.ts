// Nombres legibles para los role_codes del backend (app/core/permissions.py
// ::DEFAULT_ROLE_PERMISSIONS). Solo para mostrar en UI — nunca se usa para
// autorizar nada (las comprobaciones de permiso siguen leyendo el código crudo).
const ROLE_LABELS: Record<string, string> = {
  school_admin: "Administrador",
  coordinator: "Coordinador",
  teacher: "Docente",
  student: "Estudiante",
  guardian: "Tutor",
  finance: "Colecturía",
  public_site_editor: "Editor del sitio público",
};

export function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}
