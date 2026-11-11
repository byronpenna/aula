"""Publicaciones del curso, tipo "red social" (sección nueva, ver
learning/service.py "Publicaciones del curso"): publicar/quitar exige
ASSIGNMENT_MANAGE + estar realmente vinculado a ese curso puntual (igual
criterio que una fecha importante o una tarea); comentar y votar en la
encuesta solo exigen estar en el curso — "discutida por los alumnos", no
exclusivo de staff."""

from __future__ import annotations

from tests import factories as f

PNG_BYTES = b"\x89PNG\r\n\x1a\n fake png content"


def _create_post(client, headers, course_id, *, body="Hola clase", poll=None):
    payload = {"body": body}
    if poll is not None:
        payload["poll"] = poll
    return client.post(f"/api/v1/courses/{course_id}/posts", headers=headers, json=payload)


def test_teacher_creates_post_with_single_choice_poll(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    db_session.commit()

    headers = f.auth_headers(teacher, school_id=school.id)
    course_id = structure["course"].id

    resp = _create_post(
        client,
        headers,
        course_id,
        body="¿Qué les pareció el experimento de hoy?",
        poll={
            "question": "¿Les gustó el experimento?",
            "allow_multiple": False,
            "options": [{"label": "Sí"}, {"label": "No"}, {"label": "Más o menos"}],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["author_name"] == "Docente"
    assert body["comment_count"] == 0
    assert body["images"] == []
    assert body["poll"]["question"] == "¿Les gustó el experimento?"
    assert body["poll"]["allow_multiple"] is False
    assert body["poll"]["total_votes"] == 0
    assert [o["label"] for o in body["poll"]["options"]] == ["Sí", "No", "Más o menos"]
    assert all(o["vote_count"] == 0 and o["voted_by_me"] is False for o in body["poll"]["options"])

    list_resp = client.get(f"/api/v1/courses/{course_id}/posts", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["body"] == "¿Qué les pareció el experimento de hoy?"


def test_create_post_rejects_empty_body_and_bad_poll(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    empty_body = _create_post(client, headers, course_id, body="   ")
    assert empty_body.status_code == 422

    empty_question = _create_post(
        client, headers, course_id, poll={"question": "  ", "options": [{"label": "A"}, {"label": "B"}]}
    )
    assert empty_question.status_code == 422

    one_option = _create_post(
        client, headers, course_id, poll={"question": "¿Pregunta?", "options": [{"label": "Única"}]}
    )
    assert one_option.status_code == 422


def test_student_cannot_post_but_can_comment_and_vote(db_session, client, unique_suffix):
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

    forbidden = _create_post(client, student_headers, course_id)
    assert forbidden.status_code == 403

    post = _create_post(
        client,
        admin_headers,
        course_id,
        poll={
            "question": "¿Prefieren tarea individual o en grupo?",
            "allow_multiple": True,
            "options": [{"label": "Individual"}, {"label": "Grupo"}, {"label": "Ambas"}],
        },
    ).json()
    post_id = post["id"]
    poll_id = post["poll"]["id"]
    option_ids = [o["id"] for o in post["poll"]["options"]]

    empty_comment = client.post(
        f"/api/v1/posts/{post_id}/comments", headers=student_headers, json={"body": "  "}
    )
    assert empty_comment.status_code == 422

    comment_resp = client.post(
        f"/api/v1/posts/{post_id}/comments",
        headers=student_headers,
        json={"body": "¡Prefiero en grupo!"},
    )
    assert comment_resp.status_code == 200, comment_resp.text
    assert comment_resp.json()["author_name"] == "Alumno Demo"

    comments_list = client.get(f"/api/v1/posts/{post_id}/comments", headers=admin_headers)
    assert len(comments_list.json()) == 1

    # Encuesta de opción múltiple: puede marcar dos opciones a la vez.
    vote_resp = client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote",
        headers=student_headers,
        json={"option_ids": [option_ids[0], option_ids[1]]},
    )
    assert vote_resp.status_code == 200, vote_resp.text
    poll_out = vote_resp.json()
    assert poll_out["total_votes"] == 1
    votes_by_id = {o["id"]: o for o in poll_out["options"]}
    assert votes_by_id[option_ids[0]]["vote_count"] == 1
    assert votes_by_id[option_ids[1]]["vote_count"] == 1
    assert votes_by_id[option_ids[0]]["voted_by_me"] is True
    assert votes_by_id[option_ids[2]]["vote_count"] == 0

    # Volver a votar reemplaza el conjunto completo, no se acumula.
    revote_resp = client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote",
        headers=student_headers,
        json={"option_ids": [option_ids[2]]},
    )
    assert revote_resp.status_code == 200, revote_resp.text
    revote_out = {o["id"]: o for o in revote_resp.json()["options"]}
    assert revote_out[option_ids[0]]["vote_count"] == 0
    assert revote_out[option_ids[2]]["vote_count"] == 1
    assert revote_out[option_ids[2]]["voted_by_me"] is True

    # La lista de publicaciones también refleja el voto más reciente.
    list_resp = client.get(f"/api/v1/courses/{course_id}/posts", headers=student_headers)
    listed_poll = list_resp.json()[0]["poll"]
    listed_options = {o["id"]: o for o in listed_poll["options"]}
    assert listed_options[option_ids[2]]["voted_by_me"] is True


def test_single_choice_poll_rejects_more_than_one_option(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    post = _create_post(
        client,
        headers,
        course_id,
        poll={"question": "¿Pregunta?", "allow_multiple": False, "options": [{"label": "A"}, {"label": "B"}]},
    ).json()
    poll_id = post["poll"]["id"]
    option_ids = [o["id"] for o in post["poll"]["options"]]

    too_many = client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote",
        headers=headers,
        json={"option_ids": option_ids},
    )
    assert too_many.status_code == 422

    foreign_option = client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote",
        headers=headers,
        json={"option_ids": ["00000000-0000-0000-0000-000000000000"]},
    )
    assert foreign_option.status_code == 422


def test_unrelated_teacher_cannot_post_or_see(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    other_teacher = f.create_user(
        db_session, display_name="Otro Docente", cognito_sub=f"t2-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    course_id = structure["course"].id
    post_id = _create_post(client, admin_headers, course_id).json()["id"]

    forbidden_create = _create_post(client, other_headers, course_id)
    assert forbidden_create.status_code == 404

    not_found_comments = client.get(f"/api/v1/posts/{post_id}/comments", headers=other_headers)
    assert not_found_comments.status_code == 404


def test_delete_post_removes_poll_and_comments(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    post = _create_post(
        client,
        headers,
        course_id,
        poll={"question": "¿Pregunta?", "options": [{"label": "A"}, {"label": "B"}]},
    ).json()
    post_id = post["id"]
    poll_id = post["poll"]["id"]
    option_id = post["poll"]["options"][0]["id"]
    client.post(f"/api/v1/posts/{post_id}/comments", headers=headers, json={"body": "Nota"})
    client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote", headers=headers, json={"option_ids": [option_id]}
    )

    delete_resp = client.delete(f"/api/v1/posts/{post_id}", headers=headers)
    assert delete_resp.status_code == 204

    list_resp = client.get(f"/api/v1/courses/{course_id}/posts", headers=headers)
    assert list_resp.json() == []

    comments_resp = client.get(f"/api/v1/posts/{post_id}/comments", headers=headers)
    assert comments_resp.status_code == 404

    vote_after_delete = client.post(
        f"/api/v1/course-post-polls/{poll_id}/vote", headers=headers, json={"option_ids": [option_id]}
    )
    assert vote_after_delete.status_code == 404


def test_post_image_upload_accepts_images_and_rejects_other_types(
    db_session, client, unique_suffix
):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    post_id = _create_post(client, headers, course_id).json()["id"]

    image_resp = client.post(
        f"/api/v1/posts/{post_id}/images",
        headers=headers,
        files={"upload": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert image_resp.status_code == 200, image_resp.text
    assert image_resp.json()["content_type"] == "image/png"

    pdf_resp = client.post(
        f"/api/v1/posts/{post_id}/images",
        headers=headers,
        files={"upload": ("documento.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert pdf_resp.status_code == 422

    list_resp = client.get(f"/api/v1/courses/{course_id}/posts", headers=headers)
    assert len(list_resp.json()[0]["images"]) == 1
    assert list_resp.json()[0]["images"][0]["content_type"] == "image/png"
