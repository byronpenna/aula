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
  handle: string | null;
  status: string;
  memberships: Membership[];
}

export interface MeUpdate {
  handle: string | null;
}

export interface Permissions {
  school_id: string;
  permissions: string[];
}

export interface UserListItem {
  id: string;
  display_name: string;
  email: string | null;
  username: string | null;
  handle: string | null;
  membership_status: string;
  role_codes: string[];
}

export interface UserCreateResult extends UserListItem {
  invitation_sent: boolean;
  temporary_password: string | null;
}

export interface Permission {
  code: string;
  description: string;
}

export interface RoleSummary {
  code: string;
  name: string;
  is_system: boolean;
  version: number;
  permission_codes: string[];
  assigned_user_count: number;
}

export interface RoleUser {
  id: string;
  display_name: string;
  email: string | null;
  membership_status: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  actor_display_name: string | null;
  action: string;
  target_type: string;
  target_id: string;
  occurred_at: string;
  request_id: string | null;
}

export interface LinkedStudent {
  student_id: string;
  school_id: string;
  student_number: string;
  display_name: string | null;
  relationship_label: string;
}

export type CourseModality = "virtual" | "presencial" | "mixto";

export interface Course {
  id: string;
  section_id: string;
  subject_id: string;
  academic_year_id: string;
  starts_on: string;
  ends_on: string;
  status: string;
  name: string | null;
  modality: CourseModality;
  teacher_user_ids: string[];
}

export interface CourseScheduleSlot {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string | null;
}

export interface Teacher {
  id: string;
  display_name: string;
  email: string | null;
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
  status: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface Section {
  id: string;
  academic_year_id: string;
  grade_level_id: string;
  name: string;
  status: string;
}

export interface CourseStudent {
  id: string;
  student_number: string;
  display_name: string | null;
  photo_file_id: string | null;
}

export interface ResourceLink {
  id: string;
  resource_section_id: string;
  title: string;
  url: string;
  created_at: string;
}

export interface ResourceLinkComment {
  id: string;
  resource_link_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface ResourceSectionWithFiles {
  id: string;
  name: string;
  status: string;
  files: FileAttachment[];
  links: ResourceLink[];
}

export interface CourseResources {
  sections: ResourceSectionWithFiles[];
  unsectioned_files: FileAttachment[];
  unsectioned_links: ResourceLink[];
}

export interface CourseTeacher {
  id: string;
  course_id: string;
  teacher_user_id: string;
  status: string;
}

export interface StudentProfile {
  id: string;
  student_number: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  photo_file_id: string | null;
  user_id: string | null;
}

export interface GuardianLink {
  id: string;
  guardian_id: string;
  guardian_display_name: string | null;
  guardian_phone: string | null;
  student_id: string;
  relationship_label: string;
  status: string;
  valid_from: string;
  valid_to: string | null;
}

export interface GuardianProfileStudent {
  id: string;
  display_name: string | null;
  student_number: string;
  grade_level_name: string | null;
}

export interface GuardianProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  profession: string | null;
  workplace: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  photo_file_id: string | null;
  user_id: string | null;
  students: GuardianProfileStudent[];
}

export interface StudentDetail {
  id: string;
  student_number: string;
  display_name: string | null;
  email: string | null;
  photo_file_id: string | null;
}

export interface EnrollmentRecord {
  id: string;
  academic_year_id: string;
  student_id: string;
  section_id: string;
  starts_on: string;
  ends_on: string | null;
  status: string;
}

// "File" ya es un tipo global del DOM (window.File); se nombra distinto para no
// hacer shadowing por accidente en los componentes que también manejan inputs.
export interface FileAttachment {
  id: string;
  owner_user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: string;
  created_at: string;
}

// `x`/`y` presentes juntos = nota de punto exacto (fracción 0..1 del ancho/alto
// de esa página); ambos null = nota de página completa (ver PdfPreviewModal.tsx).
export interface FileNote {
  id: string;
  file_id: string;
  author_user_id: string;
  author_name: string;
  page_number: number;
  x: number | null;
  y: number | null;
  body: string;
  created_at: string;
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

export interface CourseCalendarEvent {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  created_at: string;
}

export interface CoursePostPollOption {
  id: string;
  label: string;
  vote_count: number;
  voted_by_me: boolean;
}

export interface CoursePostPoll {
  id: string;
  question: string;
  allow_multiple: boolean;
  total_votes: number;
  options: CoursePostPollOption[];
}

export interface CoursePost {
  id: string;
  course_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
  images: FileAttachment[];
  poll: CoursePostPoll | null;
  comment_count: number;
}

export interface CoursePostComment {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  body: string;
  created_at: string;
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

export interface PaymentPlan {
  id: string;
  academic_year_id: string;
  name: string;
  total_amount: string;
  status: string;
}

export interface PaymentPlanInstallment {
  id: string;
  payment_plan_id: string;
  due_date: string;
  amount: string;
}

export interface PaymentPlanWithInstallments {
  plan: PaymentPlan;
  installments: PaymentPlanInstallment[];
}

export interface EnrolledStudent {
  id: string;
  student_number: string;
  display_name: string | null;
  section_id: string;
  has_payment_plan: boolean;
}

export interface Payment {
  id: string;
  payment_transaction_id: string;
  method: "cash" | "card";
  authorization_number: string | null;
  paid_at: string;
}

export interface PaymentTransaction {
  id: string;
  method: "cash" | "card";
  authorization_number: string | null;
  amount_tendered: string | null;
  amount_total: string;
  change_given: string | null;
  paid_at: string;
  recorded_by_user_id: string;
}

export interface StudentInstallment {
  id: string;
  due_date: string;
  amount: string;
  status: string;
  effective_status: "paid" | "pending" | "overdue";
  payment: Payment | null;
}

export interface StudentPaymentPlan {
  id: string;
  student_id: string;
  academic_year_id: string;
  payment_plan_id: string;
  payment_plan_name: string;
  status: string;
  installments: StudentInstallment[];
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  price: string;
  status: "active" | "archived";
  file_filename: string | null;
  file_content_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
  // Solo significativo para quien consulta como alumno/tutor: si ya tiene una
  // compra "paid" de este libro (ver books/service.py::_is_owned).
  owned: boolean;
}

export interface BookFileVersion {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  is_active: boolean;
  uploaded_by_user_id: string | null;
  created_at: string;
}

export interface BookAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Una anotación nace siempre de una selección de texto: en PDF trae
// `page_number`+`rects` (uno por línea seleccionada); en EPUB trae `cfi_range`
// (epub.js resuelve solo a qué posición corresponde) — nunca ambos esquemas a
// la vez (ver books/service.py::create_book_annotation).
export interface BookAnnotation {
  id: string;
  book_id: string;
  author_user_id: string;
  author_name: string;
  is_mine: boolean;
  kind: "note" | "highlight";
  body: string | null;
  color: string | null;
  is_shared: boolean;
  page_number: number | null;
  x: number | null;
  y: number | null;
  rects: BookAnnotationRect[] | null;
  cfi_range: string | null;
  created_at: string;
}

export interface BookPurchase {
  id: string;
  book_id: string;
  student_id: string;
  method: "colecturia" | "wompi";
  status: "pending" | "paid" | "failed" | "cancelled";
  amount: string;
  recorded_by_user_id: string | null;
  paid_at: string | null;
  created_at: string;
  student_display_name: string | null;
}

export interface WompiCheckout {
  reference: string;
  amount_in_cents: number;
  currency: string;
  public_key: string;
  integrity_signature: string;
  checkout_base_url: string;
}
