"""Paridad CRUD de catálogos académicos (años, grados, materias, secciones):
editar, archivar/reactivar, rechazo de duplicados case-insensitive y 403 para quien
no tiene `academics:manage` (ver academics/service.py)."""

from __future__ import annotations

from tests import factories as f


def _admin_headers(db_session, school, unique_suffix):
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    return f.auth_headers(admin, school_id=school.id)


def _teacher_headers(db_session, school, unique_suffix):
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    return f.auth_headers(teacher, school_id=school.id)


# --- Años académicos ------------------------------------------------------


def test_academic_year_update_archive_activate(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    headers = _admin_headers(db_session, school, unique_suffix)

    create_resp = client.post(
        "/api/v1/academic-years",
        headers=headers,
        json={"label": f"Y{unique_suffix}", "starts_on": "2026-01-01", "ends_on": "2026-11-30"},
    )
    assert create_resp.status_code == 200, create_resp.text
    year_id = create_resp.json()["id"]

    update_resp = client.patch(
        f"/api/v1/academic-years/{year_id}", headers=headers, json={"label": f"Y{unique_suffix}-v2"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["label"] == f"Y{unique_suffix}-v2"

    bad_dates_resp = client.patch(
        f"/api/v1/academic-years/{year_id}",
        headers=headers,
        json={"starts_on": "2026-12-01", "ends_on": "2026-01-01"},
    )
    assert bad_dates_resp.status_code == 422

    archive_resp = client.post(f"/api/v1/academic-years/{year_id}/archive", headers=headers)
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    # Archivar no oculta del listado (a diferencia de Cursos): sigue siendo historia
    # visible, la UI filtra/etiqueta.
    list_resp = client.get("/api/v1/academic-years", headers=headers)
    assert year_id in [y["id"] for y in list_resp.json()]

    activate_resp = client.post(f"/api/v1/academic-years/{year_id}/activate", headers=headers)
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "active"


def test_academic_year_rejects_case_insensitive_duplicate_label(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    headers = _admin_headers(db_session, school, unique_suffix)

    label = f"Y{unique_suffix}"
    first = client.post(
        "/api/v1/academic-years",
        headers=headers,
        json={"label": label, "starts_on": "2026-01-01", "ends_on": "2026-11-30"},
    )
    assert first.status_code == 200

    dup = client.post(
        "/api/v1/academic-years",
        headers=headers,
        json={"label": f"  {label.upper()}  ", "starts_on": "2027-01-01", "ends_on": "2027-11-30"},
    )
    assert dup.status_code == 409


# --- Grados ----------------------------------------------------------------


def test_grade_level_update_archive_activate_and_duplicate(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    headers = _admin_headers(db_session, school, unique_suffix)

    name = f"Grado {unique_suffix}"
    create_resp = client.post(
        "/api/v1/grade-levels", headers=headers, json={"name": name, "sort_order": 1}
    )
    assert create_resp.status_code == 200
    grade_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "active"

    dup_resp = client.post(
        "/api/v1/grade-levels", headers=headers, json={"name": f" {name.upper()} ", "sort_order": 2}
    )
    assert dup_resp.status_code == 409

    update_resp = client.patch(
        f"/api/v1/grade-levels/{grade_id}", headers=headers, json={"sort_order": 3}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["sort_order"] == 3

    bad_order_resp = client.patch(
        f"/api/v1/grade-levels/{grade_id}", headers=headers, json={"sort_order": 0}
    )
    assert bad_order_resp.status_code == 422

    archive_resp = client.post(f"/api/v1/grade-levels/{grade_id}/archive", headers=headers)
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    activate_resp = client.post(f"/api/v1/grade-levels/{grade_id}/activate", headers=headers)
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "active"


def test_teacher_cannot_manage_grade_levels(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    headers = _teacher_headers(db_session, school, unique_suffix)

    resp = client.post(
        "/api/v1/grade-levels", headers=headers, json={"name": "Grado X", "sort_order": 1}
    )
    assert resp.status_code == 403


# --- Materias ----------------------------------------------------------------


def test_subject_update_archive_and_duplicate_code(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    headers = _admin_headers(db_session, school, unique_suffix)

    code = f"MAT{unique_suffix}"
    create_resp = client.post(
        "/api/v1/subjects", headers=headers, json={"code": code, "name": "Matemática"}
    )
    assert create_resp.status_code == 200
    subject_id = create_resp.json()["id"]

    dup_resp = client.post(
        "/api/v1/subjects", headers=headers, json={"code": code.lower(), "name": "Otra"}
    )
    assert dup_resp.status_code == 409

    update_resp = client.patch(
        f"/api/v1/subjects/{subject_id}", headers=headers, json={"name": "Matemática Avanzada"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Matemática Avanzada"

    archive_resp = client.post(f"/api/v1/subjects/{subject_id}/archive", headers=headers)
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"


# --- Secciones ---------------------------------------------------------------


def test_section_update_archive_and_duplicate_name(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    headers = _admin_headers(db_session, school, unique_suffix)

    dup_resp = client.post(
        "/api/v1/sections",
        headers=headers,
        json={
            "academic_year_id": str(structure["year"].id),
            "grade_level_id": str(structure["grade"].id),
            "name": structure["section"].name.upper(),
        },
    )
    assert dup_resp.status_code == 409

    update_resp = client.patch(
        f"/api/v1/sections/{structure['section'].id}", headers=headers, json={"name": "B"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "B"

    archive_resp = client.post(
        f"/api/v1/sections/{structure['section'].id}/archive", headers=headers
    )
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    activate_resp = client.post(
        f"/api/v1/sections/{structure['section'].id}/activate", headers=headers
    )
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "active"
