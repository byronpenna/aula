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
    CourseCreate,
    CourseOut,
    CourseTeacherCreate,
    CourseTeacherOut,
    EnrollmentCreate,
    EnrollmentOut,
    GradeLevelCreate,
    GradeLevelOut,
    SectionCreate,
    SectionOut,
    SubjectCreate,
    SubjectOut,
)
from app.modules.identity.models import User

router = APIRouter(tags=["academics"])


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


@router.post("/courses", response_model=CourseOut)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> Course:
    return academics_service.create_course(
        db, current, payload.section_id, payload.subject_id, payload.academic_year_id
    )


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[Course]:
    return academics_service.list_visible_courses(db, current, user.id)


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> Course:
    course = academics_repo.get_course(db, current.school_id, course_id)
    if course is None:
        raise NotFoundError("El curso indicado no existe en este colegio.")
    academics_service.require_course_access(db, current, user.id, course)
    return course


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
