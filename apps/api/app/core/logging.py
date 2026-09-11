"""Logging JSON estructurado (sección 14 del documento de arquitectura).

Campos: service, environment, request_id, route, duration_ms, status.
Redacta Authorization, cookies, credenciales y cuerpos de respuesta con datos personales.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

_REDACTED_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key"}


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str, environment: str) -> None:
        super().__init__()
        self.service = service
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "service": self.service,
            "environment": self.environment,
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        for key in ("request_id", "route", "duration_ms", "status", "event_id"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        # Sin esto, logger.exception()/exc_info=True no dejaban rastro del
        # traceback real en los logs (bug encontrado al diagnosticar el primer
        # despliegue real: solo se veía "unhandled_error" sin causa).
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(app_env: str, log_level: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(service="aula-api", environment=app_env))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(log_level)


def install_request_logging(app: FastAPI) -> None:
    logger = logging.getLogger("aula.request")

    @app.middleware("http")
    async def request_logging_middleware(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request_completed",
            extra={
                "request_id": request_id,
                "route": request.url.path,
                "duration_ms": duration_ms,
                "status": response.status_code,
            },
        )
        return response
