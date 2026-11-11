"""Enlaces externos como recurso de una sección, al lado de los archivos (ver
learning/service.py ~línea 444): cualquier URL absoluta (video de YouTube/
Facebook/TikTok, o una página web cualquiera) — agregarlos/quitarlos es
acción de quien administra el curso (igual criterio que subir un archivo),
pero comentarlos es de "cualquiera que esté en el curso" — alumno, tutor o
docente, no solo staff. Reconocer el proveedor para mostrar una vista previa
es puramente de presentación (apps/web/src/lib/linkPreview.ts); el backend
solo valida que sea una URL absoluta de verdad."""

from __future__ import annotations

from tests import factories as f


def _create_section(client, headers, course_id, name="Enlaces"):
    resp = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": name}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def test_staff_creates_links_of_different_kinds(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    section_id = _create_section(client, headers, course_id)

    urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
        "https://www.facebook.com/watch/?v=1234567890",
        "https://www.tiktok.com/@usuario/video/7123456789012345678",
        "https://www.colegio.edu/guia-de-estudio.html",
    ]
    for url in urls:
        resp = client.post(
            f"/api/v1/resource-sections/{section_id}/links",
            headers=headers,
            json={"title": "Recurso externo", "url": url},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["url"] == url

    resources_resp = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=headers)
    assert resources_resp.status_code == 200, resources_resp.text
    links = resources_resp.json()["sections"][0]["links"]
    assert len(links) == 4
    assert {link["url"] for link in links} == set(urls)


def test_create_link_rejects_malformed_url_and_empty_title(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    section_id = _create_section(client, headers, structure["course"].id)

    no_scheme = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=headers,
        json={"title": "Enlace", "url": "www.example.com/pagina"},
    )
    assert no_scheme.status_code == 422

    not_a_url = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=headers,
        json={"title": "Enlace", "url": "esto no es una url"},
    )
    assert not_a_url.status_code == 422

    empty_title = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=headers,
        json={"title": "   ", "url": "https://www.example.com/pagina"},
    )
    assert empty_title.status_code == 422


def test_student_cannot_create_link_but_can_see_and_comment(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    student_user = f.create_user(
        db_session, display_name="Alumno Demo", cognito_sub=f"s-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    course_id = structure["course"].id
    section_id = _create_section(client, admin_headers, course_id)

    forbidden = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=student_headers,
        json={"title": "Clase", "url": "https://youtu.be/dQw4w9WgXcQ"},
    )
    assert forbidden.status_code == 403

    link_id = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=admin_headers,
        json={"title": "Clase grabada", "url": "https://youtu.be/dQw4w9WgXcQ"},
    ).json()["id"]

    student_view = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=student_headers)
    assert student_view.status_code == 200, student_view.text
    assert student_view.json()["sections"][0]["links"][0]["id"] == link_id

    empty_comment = client.post(
        f"/api/v1/resource-links/{link_id}/comments", headers=student_headers, json={"body": "   "}
    )
    assert empty_comment.status_code == 422

    comment_resp = client.post(
        f"/api/v1/resource-links/{link_id}/comments",
        headers=student_headers,
        json={"body": "¿A qué página del libro corresponde este video?"},
    )
    assert comment_resp.status_code == 200, comment_resp.text
    assert comment_resp.json()["author_name"] == "Alumno Demo"

    list_resp = client.get(f"/api/v1/resource-links/{link_id}/comments", headers=admin_headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["body"] == "¿A qué página del libro corresponde este video?"
    assert list_resp.json()[0]["author_name"] == "Alumno Demo"


def test_unrelated_teacher_cannot_see_link_or_comment(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    other_teacher = f.create_user(
        db_session, display_name="Otro Docente", cognito_sub=f"t-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    section_id = _create_section(client, admin_headers, structure["course"].id)
    link_id = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=admin_headers,
        json={"title": "Clase", "url": "https://youtu.be/dQw4w9WgXcQ"},
    ).json()["id"]

    forbidden_create = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=other_headers,
        json={"title": "Clase", "url": "https://youtu.be/dQw4w9WgXcQ"},
    )
    assert forbidden_create.status_code == 403

    not_found_comments = client.get(f"/api/v1/resource-links/{link_id}/comments", headers=other_headers)
    assert not_found_comments.status_code == 404

    not_found_post = client.post(
        f"/api/v1/resource-links/{link_id}/comments", headers=other_headers, json={"body": "Hola"}
    )
    assert not_found_post.status_code == 404


def test_delete_link_removes_it_and_its_comments(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    section_id = _create_section(client, headers, course_id)
    link_id = client.post(
        f"/api/v1/resource-sections/{section_id}/links",
        headers=headers,
        json={"title": "Clase", "url": "https://youtu.be/dQw4w9WgXcQ"},
    ).json()["id"]
    client.post(f"/api/v1/resource-links/{link_id}/comments", headers=headers, json={"body": "Nota"})

    delete_resp = client.delete(f"/api/v1/resource-links/{link_id}", headers=headers)
    assert delete_resp.status_code == 204

    resources_resp = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=headers)
    assert resources_resp.json()["sections"][0]["links"] == []

    comments_resp = client.get(f"/api/v1/resource-links/{link_id}/comments", headers=headers)
    assert comments_resp.status_code == 404
