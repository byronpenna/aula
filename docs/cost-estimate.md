# Estimación de costo — Aula Virtual

Estado: plantilla sin cotización cerrada. No usar estas cifras para decidir presupuesto; son placeholders a completar antes de cualquier despliegue con costo. Ningún recurso real ha sido creado a partir de este documento.

- Región propuesta: `us-east-1` (sujeta a validación de residencia/latencia, sección 5 del documento de arquitectura).
- Fecha de la próxima revisión de precios: pendiente, hacerla justo antes de desplegar (los precios de AWS cambian).
- Fuente oficial de precios a consultar en su momento: [Calculadora AWS](https://calculator.aws/), [Precios de Lambda](https://aws.amazon.com/lambda/pricing/), [Precios de API Gateway](https://aws.amazon.com/api-gateway/pricing/).

## Partidas a cotizar antes de desplegar

| Partida | Variables a medir | Estimado |
|---|---|---|
| Lambda (API + workers) | Invocaciones/mes, GB-segundo, concurrencia reservada/provisionada | Pendiente |
| HTTP API Gateway | Requests/mes | Pendiente |
| RDS PostgreSQL | Clase de instancia, Single/Multi-AZ, almacenamiento gp3, I/O, backups | Pendiente |
| RDS Proxy | Horas de proxy, conexiones | Pendiente |
| NAT Gateway | Horas + GB procesados; 1 NAT en dev, evaluar por AZ en prod | Pendiente |
| Endpoints de interfaz (SQS/Secrets Manager) | Por AZ, comparar contra costo del NAT | Pendiente |
| S3 (documentos + frontend) | GB almacenados, requests, versiones, escaneo antimalware | Pendiente |
| CloudFront | Egreso, requests | Pendiente |
| Cognito | MAU, MFA | Pendiente |
| SES | Emails/mes | Pendiente |
| SQS + Scheduler | Mensajes/mes | Pendiente |
| CloudWatch (logs, métricas, trazas) | Volumen de logs, retención | Pendiente |
| Route 53 / DNS | Zonas hospedadas, queries | Pendiente |
| KMS | Claves, requests | Pendiente |
| CodeBuild (runner de migraciones) | Minutos de build | Pendiente |

## Escenarios a modelar (sección 12 del documento de arquitectura)

| Escenario | Carga | Costo estimado |
|---|---|---|
| Uso cotidiano | 50 usuarios activos | Pendiente |
| Examen de varios grados | 150 usuarios, 45–60 min | Pendiente |
| Pico de validación | 300 usuarios concentrados | Pendiente |
| Crecimiento (exploratorio) | 600 usuarios | Pendiente |

## Notas

- No depender del free tier para justificar viabilidad.
- Separar costo de hosting del costo de soporte humano/desarrollo.
- RDS + RDS Proxy + NAT pueden dominar el costo total de una aplicación de este tamaño; no asumir que "solo se cobra cuando entra un alumno".
- AWS Budgets con alertas se configurará en la fase de preparación de producción (fase 6); las alertas no son un corte automático de gasto.
