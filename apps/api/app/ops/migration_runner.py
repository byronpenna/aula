"""Lambda handler para correr migraciones Alembic contra la RDS real (sección 18).

Sustituto serverless simple del "runner de CodeBuild en VPC" que describe el
documento de arquitectura para migraciones cloud, mientras esa pieza no se
implementa. RDS no tiene acceso público (sección 5); este Lambda vive en la
misma VPC/subred privada y usa el SG dedicado de migraciones para llegar al
proxy. Se invoca manualmente (`aws lambda invoke`) por un operador humano con
las credenciales del proyecto; no se expone por HTTP ni se dispara solo.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config

# __file__ = /var/task/app/ops/migration_runner.py -> parents[2] = /var/task
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def handler(event: dict[str, Any] | None, context: object) -> dict[str, Any]:
    event = event or {}
    action = event.get("action", "upgrade")

    if action == "seed_demo":
        # Import local: evita cargar el ORM/permissions en las invocaciones normales
        # de migración, que son la mayoría.
        from app.ops.seed_demo import run as seed_demo_run

        result = seed_demo_run(event.get("users", []), event.get("school_name", "Colegio Demo"))
        return {"status": "ok", "action": action, "result": result}

    target = event.get("target", "head")

    cfg = Config(str(_PROJECT_ROOT / "alembic.ini"))
    # "db_migrations", no "alembic": el paquete de la librería Alembic ya ocupa
    # /var/task/alembic (instalado por pip); nuestras migraciones se copian a un
    # nombre sin colisión durante el bundling (ver infra/lib/api-stack.ts).
    cfg.set_main_option("script_location", str(_PROJECT_ROOT / "db_migrations"))

    if action == "upgrade":
        command.upgrade(cfg, target)
    elif action == "downgrade":
        command.downgrade(cfg, target)
    elif action == "current":
        command.current(cfg, verbose=True)
    else:
        raise ValueError(f"acción no soportada: {action}")

    return {"status": "ok", "action": action, "target": target}
