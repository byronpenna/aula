#!/usr/bin/env python3
"""Exporta el esquema OpenAPI de la app a stdout (sección 8: generar cliente
TypeScript desde OpenAPI). Uso: `python export_openapi.py > openapi.json`."""

from __future__ import annotations

import json

from app.main import app

if __name__ == "__main__":
    print(json.dumps(app.openapi(), indent=2, ensure_ascii=False))
