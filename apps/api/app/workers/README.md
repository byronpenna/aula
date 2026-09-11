# Workers (dispatcher, reports, notifications, grading)

Pendiente de la fase 5 (avisos, reportes y dashboards) según `docs/IMPLEMENTATION_STATUS.md`
y la sección 20 del documento de arquitectura. Este directorio existe para fijar la
estructura del monorepo (sección 16) desde ahora; no contiene lógica todavía.

Cuando se implemente: `dispatcher.py` (lee `outbox_events` con `FOR UPDATE SKIP LOCKED`
y publica a SQS), `notifications.py` (consume SQS, llama SES), `reports.py` (genera
reportes largos fuera del límite de Lambda síncrona) y `grading.py` (corrección
automática de evaluaciones objetivas, fase 4).
