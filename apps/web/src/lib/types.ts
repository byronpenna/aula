// Tipos alineados manualmente con app/modules/*/schemas.py mientras se conecta el
// generador OpenAPI real (packages/contracts/scripts/generate.ts). Si cambia un
// schema de FastAPI, actualizar aquí también hasta automatizarlo por completo.

export interface Membership {
  school_id: string;
  school_name: string;
  status: string;
  roles: string[];
}

export interface Me {
  id: string;
  display_name: string;
  email: string | null;
  status: string;
  memberships: Membership[];
}

export interface Permissions {
  school_id: string;
  permissions: string[];
}

export interface LinkedStudent {
  student_id: string;
  school_id: string;
  student_number: string;
  display_name: string | null;
  relationship_label: string;
}

export interface Course {
  id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  status: string;
}

export interface AcademicYear {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  status: string;
}

export interface GradeLevel {
  id: string;
  name: string;
  sort_order: number;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
}

export interface Section {
  id: string;
  academic_year_id: string;
  grade_level_id: string;
  name: string;
}

export interface CourseTeacher {
  id: string;
  course_id: string;
  teacher_user_id: string;
  status: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  instructions: string;
  due_at: string;
  max_score: string;
  status: "draft" | "published";
  allow_late: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  version: number;
  late: boolean;
}
