"""Errores uniformes de la API (sección 8 del documento de arquitectura).

Formato de respuesta:
    {"error": {"code": "...", "message": "...", "details": {}}, "request_id": "uuid"}

Nunca se devuelven stack traces al cliente.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("aula.api")


class ApiError(HTTPException):
    """Excepción de dominio con código de error estable para el cliente."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or {}


class NotFoundError(ApiError):
    def __init__(self, message: str = "El recurso no existe o no pertenece al usuario."):
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)


class ForbiddenError(ApiError):
    def __init__(self, message: str = "Permiso insuficiente."):
        super().__init__(status.HTTP_403_FORBIDDEN, "FORBIDDEN", message)


class UnauthorizedError(ApiError):
    def __init__(self, message: str = "Autenticación inválida o ausente."):
        super().__init__(status.HTTP_401_UNAUTHORIZED, "UNAUTHORIZED", message)


class ConflictError(ApiError):
    def __init__(self, message: str = "El recurso cambió; actualiza e intenta nuevamente."):
        super().__init__(status.HTTP_409_CONFLICT, "RESOURCE_CONFLICT", message)


class UnprocessableError(ApiError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, details)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {"code": exc.code, "message": exc.message, "details": exc.details},
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Los datos enviados no son válidos.",
                    "details": {"errors": exc.errors()},
                },
                "request_id": _request_id(request),
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = _request_id(request)
        logger.exception("unhandled_error", extra={"request_id": request_id})
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": "Ocurrió un error inesperado. Intenta nuevamente.",
                    "details": {},
                },
                "request_id": request_id,
            },
        )
