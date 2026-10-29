"""Notas y resaltados personales sobre un libro (sección nueva, independiente
de la gestión de versiones de archivo): cada anotación requiere acceso de
compra al libro (mismo criterio 404 que el contenido), es privada de su autor
por defecto, y puede compartirse (`is_shared`) con cualquier otro usuario que
también tenga acceso de compra al mismo libro."""

from __future__ import annotations

from tests import factories as f


def _setup_school_with_two_students(db_session, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])

    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    other_student_user = f.create_user(db_session, display_name="Otro Alumno", cognito_sub=f"s2-{unique_suffix}")
    f.add_membership(db_session, school=school, user=other_student_user, role_codes=["student"])

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(
        school_id=school.id, user_id=student_user.id, student_number=f"N-{unique_suffix}"
    )
    other_profile = StudentProfile(
        school_id=school.id, user_id=other_student_user.id, student_number=f"N2-{unique_suffix}"
    )
    db_session.add_all([profile, other_profile])
    db_session.flush()
    db_session.commit()
    return school, admin, student_user, profile, other_student_user, other_profile


def _create_book_purchased_by(client, admin_headers, student_headers, profile, *, title, price="10.00"):
    book_id = client.post(
        "/api/v1/books", headers=admin_headers, json={"title": title, "price": price}
    ).json()["id"]
    client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(profile.id)},
    )
    return book_id


RECT = {"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.05}


def test_student_can_create_list_and_delete_own_pdf_highlight(db_session, client, unique_suffix):
    school, admin, student_user, profile, _other_user, _other_profile = _setup_school_with_two_students(
        db_session, unique_suffix
    )
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    book_id = _create_book_purchased_by(client, admin_headers, student_headers, profile, title="Álgebra I")

    create_resp = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "highlight", "color": "yellow", "page_number": 3, "rects": [RECT]},
    )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    assert body["kind"] == "highlight"
    assert body["color"] == "yellow"
    assert body["page_number"] == 3
    assert body["is_shared"] is False
    assert body["is_mine"] is True
    assert body["x"] == RECT["x"] and body["y"] == RECT["y"]

    list_resp = client.get(f"/api/v1/books/{book_id}/annotations", headers=student_headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1

    delete_resp = client.delete(
        f"/api/v1/books/{book_id}/annotations/{body['id']}", headers=student_headers
    )
    assert delete_resp.status_code == 204, delete_resp.text
    assert client.get(f"/api/v1/books/{book_id}/annotations", headers=student_headers).json() == []


def test_note_requires_body_and_highlight_requires_valid_color(db_session, client, unique_suffix):
    school, admin, student_user, profile, _ou, _op = _setup_school_with_two_students(db_session, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    book_id = _create_book_purchased_by(client, admin_headers, student_headers, profile, title="Física")

    empty_note = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "note", "page_number": 1, "rects": [RECT], "body": "   "},
    )
    assert empty_note.status_code == 422, empty_note.text

    bad_color = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "highlight", "page_number": 1, "rects": [RECT], "color": "ultraviolet"},
    )
    assert bad_color.status_code == 422, bad_color.text

    missing_rects = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "highlight", "page_number": 1, "color": "yellow"},
    )
    assert missing_rects.status_code == 422, missing_rects.text

    both_schemes = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={
            "kind": "highlight",
            "page_number": 1,
            "rects": [RECT],
            "color": "yellow",
            "cfi_range": "epubcfi(/6/4!/4/2,/1:0,/1:10)",
        },
    )
    assert both_schemes.status_code == 422, both_schemes.text

    ok_note = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "note", "page_number": 1, "rects": [RECT], "body": "Revisar esto"},
    )
    assert ok_note.status_code == 200, ok_note.text


def test_epub_annotation_uses_cfi_range(db_session, client, unique_suffix):
    school, admin, student_user, profile, _ou, _op = _setup_school_with_two_students(db_session, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    book_id = _create_book_purchased_by(client, admin_headers, student_headers, profile, title="Geometría EPUB")

    resp = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={
            "kind": "highlight",
            "color": "green",
            "cfi_range": "epubcfi(/6/4!/4/2,/1:0,/1:10)",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["cfi_range"] == "epubcfi(/6/4!/4/2,/1:0,/1:10)"
    assert body["page_number"] is None
    assert body["rects"] is None


def test_cannot_annotate_book_without_purchase(db_session, client, unique_suffix):
    school, admin, _student_user, _profile, other_user, _other_profile = _setup_school_with_two_students(
        db_session, unique_suffix
    )
    admin_headers = f.auth_headers(admin, school_id=school.id)
    other_headers = f.auth_headers(other_user, school_id=school.id)
    book_id = client.post(
        "/api/v1/books", headers=admin_headers, json={"title": "Química", "price": "5.00"}
    ).json()["id"]

    resp = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=other_headers,
        json={"kind": "highlight", "color": "yellow", "page_number": 1, "rects": [RECT]},
    )
    assert resp.status_code == 404, resp.text


def test_shared_annotation_visible_to_other_purchaser_but_private_one_is_not(db_session, client, unique_suffix):
    school, admin, student_user, profile, other_user, other_profile = _setup_school_with_two_students(
        db_session, unique_suffix
    )
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    other_headers = f.auth_headers(other_user, school_id=school.id)

    book_id = _create_book_purchased_by(client, admin_headers, student_headers, profile, title="Historia")
    client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(other_profile.id)},
    )

    private_resp = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "note", "page_number": 1, "rects": [RECT], "body": "Nota privada"},
    )
    shared_resp = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={
            "kind": "note",
            "page_number": 2,
            "rects": [RECT],
            "body": "Nota compartida",
            "is_shared": True,
        },
    )
    assert private_resp.status_code == 200 and shared_resp.status_code == 200

    others_view = client.get(f"/api/v1/books/{book_id}/annotations", headers=other_headers).json()
    assert [a["body"] for a in others_view] == ["Nota compartida"]
    assert others_view[0]["is_mine"] is False
    assert others_view[0]["author_name"] == "Alumno"

    own_view = client.get(f"/api/v1/books/{book_id}/annotations", headers=student_headers).json()
    assert {a["body"] for a in own_view} == {"Nota privada", "Nota compartida"}


def test_only_author_can_update_or_delete_annotation(db_session, client, unique_suffix):
    school, admin, student_user, profile, other_user, other_profile = _setup_school_with_two_students(
        db_session, unique_suffix
    )
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    other_headers = f.auth_headers(other_user, school_id=school.id)

    book_id = _create_book_purchased_by(client, admin_headers, student_headers, profile, title="Biología")
    client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(other_profile.id)},
    )

    created = client.post(
        f"/api/v1/books/{book_id}/annotations",
        headers=student_headers,
        json={"kind": "note", "page_number": 1, "rects": [RECT], "body": "Original", "is_shared": True},
    ).json()

    forbidden_update = client.patch(
        f"/api/v1/books/{book_id}/annotations/{created['id']}",
        headers=other_headers,
        json={"body": "Hackeado"},
    )
    assert forbidden_update.status_code == 404, forbidden_update.text

    forbidden_delete = client.delete(
        f"/api/v1/books/{book_id}/annotations/{created['id']}", headers=other_headers
    )
    assert forbidden_delete.status_code == 404, forbidden_delete.text

    own_update = client.patch(
        f"/api/v1/books/{book_id}/annotations/{created['id']}",
        headers=student_headers,
        json={"body": "Editado", "is_shared": False},
    )
    assert own_update.status_code == 200, own_update.text
    assert own_update.json()["body"] == "Editado"
    assert own_update.json()["is_shared"] is False

    # Al dejar de compartirla, el otro alumno ya no la ve.
    others_view = client.get(f"/api/v1/books/{book_id}/annotations", headers=other_headers).json()
    assert others_view == []
