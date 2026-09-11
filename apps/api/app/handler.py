"""Adaptador Mangum para AWS Lambda (sección 4). No se ejecutan migraciones, seeds
ni creación de tablas al importar este módulo ni en cada cold start."""

from __future__ import annotations

from mangum import Mangum

from app.main import app

handler = Mangum(app)
