# Supuestos explícitos

Este documento registra decisiones de configuración usadas para poder desarrollar sin bloquear el trabajo por definiciones de negocio que el colegio real aún no ha confirmado. Todo lo aquí listado es **configurable** y **ficticio**; ningún valor representa una decisión final del propietario.

| Área | Supuesto usado | Dónde se configura | Debe cerrarse antes de prod |
|---|---|---|---|
| Nombre del colegio | `Colegio Demo` (ficticio) | seed `scripts/seed.py` | Sí |
| Dominio | `aula.example.local` (placeholder) | `.env`, CDK context | Sí |
| Región AWS | `us-east-1` (parametrizable) | `infra/cdk.json`, `.env` | Sí, validar residencia/latencia |
| Zona horaria | `America/El_Salvador` | `schools.timezone`, `SCHOOL_TIMEZONE` | Confirmar con colegio real |
| Moneda | `USD` | `schools.currency` | Confirmar |
| Escala de notas | 0–100, aprobación configurable por curso/periodo, sin umbral fijo en código | `grade_categories`/config de curso | Sí |
| Cuenta AWS propietaria | Sin perfil configurado en esta máquina; ninguna acción cloud ejecutada | ver `docs/runbooks/aws-profile-setup.md` | Sí |
| Alumnos sin email | Se asume `username` institucional ficticio (`nombre.apellido`) en seeds; sin procedimiento real de recuperación aún | `scripts/seed.py` | Sí, definir procedimiento escolar |
| MFA | No forzado en local/dev; meta declarada para personal con privilegios en prod, no implementada aún con Cognito real | — | Sí |
| Escaneo antimalware de archivos | Adaptador local explícitamente ficticio (`status=available` tras validación de tipo/tamaño, sin motor real) | `apps/api/app/modules/files` (fase 2) | Sí |
| Presupuesto / responsable de guardia | No definido | `docs/cost-estimate.md` | Sí |
| Single-AZ vs Multi-AZ | Dev/local: Single-AZ (RDS no aplica en local, se usa Postgres en contenedor) | `infra/lib/data-stack.ts` (parametrizable) | Sí |
| Retención de logs | Dev 7 días / prod 30 días (propuesto) | `infra/lib/observability-stack.ts` | Confirmar política |
| Traslados de sección | No implementado en esta entrega; matrícula inicial simple | `apps/api/app/modules/academics` | Fase 2 |
| Cobros/mora | Fuera de esta entrega (fase 7 opcional) | — | Confirmar necesidad real |

Cualquier decisión adicional tomada durante el desarrollo se añade a esta tabla o a un ADR en `docs/adr/` si tiene alternativas relevantes que documentar.
