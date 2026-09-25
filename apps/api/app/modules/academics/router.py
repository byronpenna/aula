from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership, get_current_user, require_permission
from app.core.errors import NotFoundError
from app.core.permissions import ACADEMICS_MANAGE, COURSE_READ, ENROLLMENT_MANAGE
from app.db.session import get_db
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.academics.models import (
    AcademicYear,
    Course,
    CourseTeacher,
    Enrollment,
    GradeLevel,
    Section,
    Subject,
)
from app.modules.academics.schemas import (
    AcademicYearCreate,
    AcademicYearOut,
    AcademicYearUpdate,
    CourseCreate,
    CourseOut,
    CourseTeacherCreate,
    CourseTeacherOut,
    CourseUpdate,
    EnrollmentCreate,
    EnrollmentOut,
    GradeLevelCreate,
    GradeLevelOut,
    GradeLevelUpdate,
    SectionCreate,
    SectionOut,
    SectionUpdate,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
)
from app.modules.identity.models import User

router = APIRouter(tags=["academics"])


def _course_out(db: Session, course: Course) -> CourseOut:
    out = CourseOut.model_validate(course)
    out.teacher_user_ids = academics_repo.list_active_teacher_ids_for_course(db, course.id)
    return out


@router.post("/academic-years", response_model=AcademicYearOut)
def create_academic_year(
    payload: AcademicYearCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> AcademicYear:
    year = academics_service.create_academic_year(
        db, current, payload, request.state.request_id
    )
    return year


@router.get("/academic-years", response_model=list[AcademicYearOut])
def list_academic_years(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[AcademicYear]:
    return academics_repo.list_academic_years(db, current.school_id)


@router.patch("/academic-years/{year_id}", response_model=AcademicYearOut)
def update_academic_year(
    year_id: uuid.UUID,
    payload: AcademicYearUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> AcademicYear:
    return academics_service.update_academic_year(
        db, current, year_id, payload, request.state.request_id
    )


@router.post("/academic-years/{year_id}/archive", response_model=AcademicYearOut)
def archive_academic_year(
    year_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> AcademicYear:
    return academics_service.set_academic_year_status(
        db, current, year_id, "archived", request.state.request_id
    )


@router.post("/academic-years/{year_id}/activate", response_model=AcademicYearOut)
def activate_academic_year(
    year_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> AcademicYear:
    return academics_service.set_academic_year_status(
        db, current, year_id, "active", request.state.request_id
    )


@router.post("/grade-levels", response_model=GradeLevelOut)
def create_grade_level(
    payload: GradeLevelCreate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> GradeLevel:
    return academics_service.create_grade_level(db, current, payload.name, payload.sort_order)


@router.get("/grade-levels", response_model=list[GradeLevelOut])
def list_grade_levels(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[GradeLevel]:
    return academics_repo.list_grade_levels(db, current.school_id)


@router.patch("/grade-levels/{grade_level_id}", response_model=GradeLevelOut)
def update_grade_level(
    grade_level_id: uuid.UUID,
    payload: GradeLevelUpdate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> GradeLevel:
    return academics_service.update_grade_level(db, current, grade_level_id, payload)


@router.post("/grade-levels/{grade_level_id}/archive", response_model=GradeLevelOut)
def archive_grade_level(
    grade_level_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> GradeLevel:
    return academics_service.set_grade_level_status(db, current, grade_level_id, "archived")


@router.post("/grade-levels/{grade_level_id}/activate", response_model=GradeLevelOut)
def activate_grade_level(
    grade_level_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> GradeLevel:
    return academics_service.set_grade_level_status(db, current, grade_level_id, "active")


@router.post("/subjects", response_model=SubjectOut)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Subject:
    return academics_service.create_subject(db, current, payload.code, payload.name)


@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[Subject]:
    return academics_repo.list_subjects(db, current.school_id)


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: uuid.UUID,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Subject:
    return academics_service.update_subject(db, current, subject_id, payload)


@router.post("/subjects/{subject_id}/archive", response_model=SubjectOut)
def archive_subject(
    subject_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Subject:
    return academics_service.set_subject_status(db, current, subject_id, "archived")


@router.post("/subjects/{subject_id}/activate", response_model=SubjectOut)
def activate_subject(
    subject_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Subject:
    return academics_service.set_subject_status(db, current, subject_id, "active")


@router.post("/sections", response_model=SectionOut)
def create_section(
    payload: SectionCreate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Section:
    return academics_service.create_section(
        db, current, payload.academic_year_id, payload.grade_level_id, payload.name
    )


@router.get("/sections", response_model=list[SectionOut])
def list_sections(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[Section]:
    return academics_repo.list_sections(db, current.school_id)


@router.patch("/sections/{section_id}", response_model=SectionOut)
def update_section(
    section_id: uuid.UUID,
    payload: SectionUpdate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Section:
    return academics_service.update_section(db, current, section_id, payload)


@router.post("/sections/{section_id}/archive", response_model=SectionOut)
def archive_section(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Section:
    return academics_service.set_section_status(db, current, section_id, "archived")


@router.post("/sections/{section_id}/activate", response_model=SectionOut)
def activate_section(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Section:
    return academics_service.set_section_status(db, current, section_id, "active")


@router.post("/courses", response_model=CourseOut)
def create_course(
    payload: CourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> CourseOut:
    course = academics_service.create_course(
        db,
        current,
        payload.section_id,
        payload.subject_id,
        payload.academic_year_id,
        payload.starts_on,
        payload.ends_on,
        request.state.request_id,
    )
    return _course_out(db, course)


@router.patch("/courses/{course_id}", response_model=CourseOut)
def update_course(
    course_id: uuid.UUID,
    payload: CourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> CourseOut:
    course = academics_service.update_course(
        db, current, course_id, payload, request.state.request_id
    )
    return _course_out(db, course)


@router.post("/courses/{course_id}/archive", response_model=CourseOut)
def archive_course(
    course_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> CourseOut:
    course = academics_service.archive_course(db, current, course_id, request.state.request_id)
    return _course_out(db, course)


@router.post("/courses/{course_id}/activate", response_model=CourseOut)
def activate_course(
    course_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> CourseOut:
    course = academics_service.activate_course(db, current, course_id, request.state.request_id)
    return _course_out(db, course)


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[CourseOut]:
    courses = academics_service.list_visible_courses(db, current, user.id)
    return [_course_out(db, course) for course in courses]


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> CourseOut:
    course = academics_repo.get_course(db, current.school_id, course_id)
    if course is None:
        raise NotFoundError("El curso indicado no existe en este colegio.")
    academics_service.require_course_access(db, current, user.id, course)
    return _course_out(db, course)


@router.post("/courses/{course_id}/teachers", response_model=CourseTeacherOut)
def assign_course_teacher(
    course_id: uuid.UUID,
    payload: CourseTeacherCreate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> CourseTeacher:
    return academics_service.assign_teacher(db, current, course_id, payload.teacher_user_id)


@router.post("/enrollments", response_model=EnrollmentOut)
def create_enrollment(
    payload: EnrollmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ENROLLMENT_MANAGE)),
) -> Enrollment:
    return academics_service.create_enrollment(db, current, payload, request.state.request_id)


@router.get("/students/{student_id}/enrollments", response_model=list[EnrollmentOut])
def list_student_enrollments(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[Enrollment]:
    academics_service.require_student_access(db, current, user.id, student_id)
    return academics_repo.list_enrollments_for_student(db, current.school_id, student_id)
