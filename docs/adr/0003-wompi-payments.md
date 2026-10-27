# ADR 0003: Dos caminos de pago para el catálogo de libros — Wompi y colecturía manual

Fecha: 2026-10-26
Estado: Aceptado

## Contexto

Se agrega un catálogo de libros digitales (`apps/api/app/modules/books/`), independiente de los cursos, donde el acceso al archivo de un libro queda restringido a quien lo haya comprado (sección 6: 404 si no hay compra `paid`, nunca 403, mismo criterio que `require_course_access`). El propietario pidió que la compra se pueda pagar de dos formas: con la pasarela **Wompi** (en línea) o por **colecturía** (el administrador registra la compra ya cobrada en caja, sin paso de solicitud/aprobación). Hoy no hay credenciales reales de Wompi disponibles.

El único módulo de dinero existente, `billing` (colegiaturas), nunca integró una pasarela — solo registra pagos manuales de staff (`PaymentTransaction`). No había ningún precedente de llamar a un servicio de pago externo ni de recibir webhooks públicos en este repositorio.

## Decisión

- **Modelo de compra único** (`BookPurchase`): un libro no requiere "solicitar" la compra — `method="colecturia"` se crea directamente en `status="paid"` (admin/finanzas ya cobraron), y `method="wompi"` se crea en `status="pending"` y solo pasa a `paid`/`failed` cuando llega el webhook de Wompi, nunca por el redirect del navegador (no es una confirmación de pago confiable).
- **Checkout de Wompi sin llamada HTTP saliente**: se usa el Web Checkout de Wompi, que funciona por redirección firmada (`books/wompi_client.py::build_checkout_signature`, SHA-256 de `reference+amount_in_cents+currency+integrity_secret`). El backend solo genera la referencia y la firma; el navegador va directo a Wompi.
- **Webhook público sin autorizador de Cognito**: nueva ruta `/webhooks/wompi`, montada sin el prefijo `/api/v1` y sin el JWT authorizer de API Gateway (`infra/lib/api-stack.ts`, ruta `/webhooks/{proxy+}`), igual patrón que `/public/{proxy+}` del sitio público. La autenticidad del request se verifica con una firma HMAC del cuerpo (`books/wompi_client.py::verify_webhook_signature`), no con la red.
- **Idempotencia por referencia, no por header**: no existe un mecanismo genérico de `Idempotency-Key` en este backend (confirmado al investigar); en vez de introducir uno, `BookPurchase.external_reference` tiene un `UniqueConstraint` y el webhook es un no-op si la compra ya está `paid` — mismo criterio que la matrícula (`enroll_student_in_course`, check-then-insert).
- **Secretos vs. variables de entorno planas**: `WOMPI_PUBLIC_KEY` es pública (va al navegador) y viaja como variable de entorno simple, igual que `COGNITO_CLIENT_ID`. Las tres llaves sensibles (`private_key`, `integrity_secret`, `events_key`) viven en un secreto de Secrets Manager (`aula/<env>/wompi`), resuelto en runtime por `core/config.py::_resolve_wompi_secrets`, mismo patrón que la credencial de base de datos (`_resolve_cloud_database_url`).
- **Sin credenciales reales todavía**: el secreto se crea con un placeholder vacío (`"{}"`); con eso, `start_wompi_purchase` responde un error claro ("pago en línea no disponible") y el frontend muestra el botón de Wompi deshabilitado. La colecturía manual no depende de ninguna de estas llaves y es 100% funcional desde el día uno.
- **Fórmulas de firma sin verificar contra una cuenta real**: `wompi_client.py` implementa la fórmula pública de integridad/checksum documentada por Wompi, marcada explícitamente con comentarios y `# pragma: no cover` — debe confirmarse contra la documentación oficial y una transacción real antes de activar `WOMPI_PUBLIC_KEY` en producción.

## Alternativas consideradas

- **Reutilizar `billing.PaymentTransaction` para las compras de libros**: descartado — ese modelo está acoplado a `StudentInstallment`/planes de pago por año académico; una compra de libro es un evento independiente, sin mensualidades. Se prefirió un modelo nuevo y más simple (`BookPurchase`) en vez de forzar el encaje.
- **Modelar el libro como una fila más de `files.File`** (`attached_to_type="book"`): descartado para no mezclar el dispatch de acceso de `files/service.py::get_download` (que no tiene noción de "compra") con la lógica de `require_book_purchase_access`. El archivo del libro vive como columnas propias en `Book`, reutilizando solo el adaptador de almacenamiento (`files/storage.py::get_storage`).
- **Exigir `enrollment:manage` para el selector de alumnos de colecturía** (reutilizar `GET /students`): descartado porque el rol `finance` no tiene ese permiso por defecto y ampliarlo sería scope creep (le daría a finanzas acceso a matrícula). Se agregó `GET /books/students`, gateado por `books:manage`.

## Consecuencias

- Mientras no haya credenciales reales de Wompi, el módulo "libros" solo es utilizable por colecturía — aceptado explícitamente por el propietario como el estado inicial.
- Activar Wompi en producción requiere: (1) cargar `private_key`/`integrity_secret`/`events_key` reales en el secreto `aula/<env>/wompi` (`aws secretsmanager put-secret-value`, sin redeploy), (2) definir `wompiPublicKey`/`VITE_WOMPI_PUBLIC_KEY` con la llave pública real, y (3) verificar `wompi_client.py` contra una transacción de prueba en el sandbox de Wompi antes de apuntar a producción.
- El webhook público es una superficie nueva sin autenticación de red; su única protección es la firma HMAC. Si Wompi cambia su fórmula de firma, las compras dejan de confirmarse silenciosamente (todas las compras quedan `pending` y los webhooks se rechazan con 422) — vale la pena una alerta/monitor sobre compras `pending` viejas antes de ir a producción real.
