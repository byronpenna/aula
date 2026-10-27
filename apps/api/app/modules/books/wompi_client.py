"""Cliente mínimo de Wompi (pasarela de pago, módulo "libros").

Sin credenciales reales todavía (ver `core/config.py`): este archivo implementa
la fórmula de firma de integridad documentada públicamente por Wompi para el
Web Checkout, pero **no se ha podido probar contra una cuenta Wompi real**.
Cuando lleguen las credenciales, verificar ambas funciones contra la
documentación oficial (https://docs.wompi.co/) antes de confiar en producción.

No requiere `httpx`: el checkout es por redirección firmada (el navegador va
directo a Wompi), no por una llamada server-to-server; solo el webhook de
confirmación llega a esta API.
"""

from __future__ import annotations

import hashlib
import hmac


def build_checkout_signature(
    reference: str, amount_in_cents: int, currency: str, integrity_secret: str
) -> str:
    """Firma de integridad del Web Checkout: SHA-256 de
    `reference + amount_in_cents + currency + integrity_secret`, concatenados
    sin separador (fórmula pública de Wompi). # pragma: no cover - fórmula sin
    verificar contra una cuenta Wompi real."""
    raw = f"{reference}{amount_in_cents}{currency}{integrity_secret}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_webhook_signature(
    checksum: str, properties: list[str], payload: dict, timestamp: str, events_key: str
) -> bool:  # pragma: no cover - requiere credenciales/eventos reales de Wompi
    """Verifica `signature.checksum` de un evento de Wompi: SHA-256 de los
    valores de `signature.properties` (en el orden dado, navegando el payload
    con notación de punto, p. ej. "data.transaction.id") concatenados con el
    timestamp del evento y el `events_key`, sin separador (fórmula pública de
    Wompi). Comparación con `hmac.compare_digest` para evitar timing attacks."""

    def _resolve(path: str):
        value = payload
        for part in path.split("."):
            if not isinstance(value, dict) or part not in value:
                return ""
            value = value[part]
        return value

    raw = "".join(str(_resolve(prop)) for prop in properties) + timestamp + events_key
    expected = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected, checksum)
