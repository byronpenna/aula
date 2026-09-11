# ADR 0002: Frontend servido con AWS Amplify Hosting, no con la pila S3+CloudFront de `FrontendStack`

Fecha: 2026-09-11
Estado: Aceptado

## Contexto

El documento de arquitectura (sección 5) y `infra/lib/frontend-stack.ts` proponen S3 privado + CloudFront con Origin Access Control como hosting del frontend. El propietario pidió explícitamente desplegar el frontend en AWS Amplify Hosting en su lugar, en la misma sesión de despliegue inicial a la cuenta `861418247819`.

## Decisión

- El frontend (`apps/web`) se publica en una app de Amplify Hosting (`aula-web`, `appId dy880wnmeoiy1`) mediante **deploy manual** (`aws amplify create-deployment` + subida del zip de `dist/` + `start-deployment`), no mediante conexión a GitHub con build automático. Se eligió el deploy manual porque conectar un repositorio a Amplify requiere autorizar una GitHub App/OAuth de forma interactiva en el navegador, algo que esta sesión no puede completar por el usuario.
- `infra/lib/frontend-stack.ts` (S3 + CloudFront) se mantiene en el repositorio sin desplegar, documentado como alternativa; no se instanció `Aula-dev-Frontend` en `infra/bin/aula.ts` en esta entrega.
- Reglas de reescritura SPA configuradas manualmente en la app de Amplify (`aws amplify update-app --custom-rules`) para que rutas de React Router devuelvan `index.html` con 200, replicando el comportamiento de `errorResponses` que `FrontendStack` ya definía para CloudFront.
- `ApiStack` recibe el dominio real de Amplify (`https://main.dy880wnmeoiy1.amplifyapp.com`) como `allowedOrigins`, usado tanto en el CORS del HTTP API Gateway como en el middleware CORS de FastAPI.

## Alternativas consideradas

- **Amplify conectado a GitHub con build automático**: descartado por ahora porque requiere autorización interactiva de una GitHub App que el propietario debe completar en el navegador; puede añadirse después sin perder el historial de despliegues manuales.
- **Mantener S3+CloudFront (`FrontendStack`) como estaba planeado**: descartado por instrucción explícita del propietario de usar Amplify.

## Consecuencias

- Cada actualización del frontend requiere repetir el flujo manual (`npm run build` en `apps/web`, zip, `create-deployment`/subida/`start-deployment`) hasta que se conecte CI/CD real vía GitHub, o se escriba un script/target de Makefile que lo automatice.
- El dominio de Amplify (`*.amplifyapp.com`) es temporal/de desarrollo; añadir un dominio propio requiere un ADR o actualización de este mismo documento, más el ajuste correspondiente de `allowedOrigins` en `infra/bin/aula.ts` y redeploy de `Aula-dev-Api`.
- `FrontendStack` queda como código muerto hasta que se decida usarlo (por ejemplo, para producción con un dominio propio) o se elimine explícitamente.
- Las políticas de seguridad de Amplify Hosting (headers, cache) no se han revisado línea por línea contra la sección 5 del documento de arquitectura; queda pendiente antes de producción real.
