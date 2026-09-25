"""HTTP real contra el módulo `public_site` (noticias del sitio público, sección 7:
mismo Postgres que aula virtual, schema `content` separado)."""

from __future__ import annotations

from tests import factories as f


def test_school_admin_can_manage_news_lifecycle(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"adm-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)

    create_resp = client.post(
        "/api/v1/public-site/news",
        headers=headers,
        json={"title": "¡Expotecnia Linares 2026 ya casi está aquí!", "body": "Detalles pronto."},
    )
    assert create_resp.status_code == 200, create_resp.text
    news = create_resp.json()
    assert news["status"] == "draft"
    assert news["published_at"] is None
    assert news["slug"] == "expotecnia-linares-2026-ya-casi-esta-aqui"
    news_id = news["id"]

    list_resp = client.get("/api/v1/public-site/news", headers=headers)
    assert list_resp.status_code == 200
    assert any(item["id"] == news_id for item in list_resp.json())

    publish_resp = client.put(
        f"/api/v1/public-site/news/{news_id}",
        headers=headers,
        json={"status": "published"},
    )
    assert publish_resp.status_code == 200, publish_resp.text
    assert publish_resp.json()["published_at"] is not None

    delete_resp = client.delete(f"/api/v1/public-site/news/{news_id}", headers=headers)
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/api/v1/public-site/news/{news_id}", headers=headers)
    assert get_resp.status_code == 404


def test_duplicate_titles_get_distinct_slugs(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"adm-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)

    first = client.post(
        "/api/v1/public-site/news", headers=headers, json={"title": "Matrícula 2027", "body": "..."}
    )
    second = client.post(
        "/api/v1/public-site/news", headers=headers, json={"title": "Matrícula 2027", "body": "..."}
    )
    assert first.json()["slug"] == "matricula-2027"
    assert second.json()["slug"] == "matricula-2027-2"


def test_user_without_public_site_permission_is_forbidden(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"doc-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(teacher, school_id=school.id)

    resp = client.post(
        "/api/v1/public-site/news", headers=headers, json={"title": "No autorizado", "body": "..."}
    )
    assert resp.status_code == 403
