# Aula Virtual — paquete de implementación del rediseño administrativo

**Proyecto:** Aula Virtual del Colegio Coronel Francisco Linares  
**Versión del brief:** 2.0 — armonizada visualmente con el sitio público  
**Referencia institucional:** https://public-web.dy880wnmeoiy1.amplifyapp.com/

## Propósito

Rediseñar la pantalla de administración existente y convertirla en una experiencia modular y coherente con el sitio público del colegio. Preservar la administración académica existente y agregar **gestión de usuarios, roles, permisos y alcances**, con autorización real en backend. Este paquete **no presupone** tecnología de frontend, backend, autenticación ni base de datos: el agente primero debe inspeccionar el repositorio.

## Lectura obligatoria para el agente

| Orden | Archivo | Contenido |
|---|---|---|
| 0 | [`00-PROMPT-PARA-EL-AGENTE.md`](00-PROMPT-PARA-EL-AGENTE.md) | Instrucción ejecutable y reglas de trabajo. |
| 1 | [`01-DISENO-Y-BRANDING.md`](01-DISENO-Y-BRANDING.md) | Integración con el sitio público, tokens, componentes, responsive y accesibilidad. |
| 2 | [`02-PANTALLAS-Y-FLUJOS.md`](02-PANTALLAS-Y-FLUJOS.md) | Dashboard y todos los módulos académicos. |
| 3 | [`03-USUARIOS-ROLES-Y-SEGURIDAD.md`](03-USUARIOS-ROLES-Y-SEGURIDAD.md) | Usuarios, invitaciones, RBAC, matriz de permisos y restricciones. |
| 4 | [`04-MODELO-DATOS-Y-API.md`](04-MODELO-DATOS-Y-API.md) | Esquema propuesto, reglas de integridad y contratos REST ilustrativos. |
| 5 | [`05-PLAN-DE-IMPLEMENTACION.md`](05-PLAN-DE-IMPLEMENTACION.md) | Orden de trabajo, entregables por fase, dependencias y rollback. |
| 6 | [`06-PRUEBAS-Y-CRITERIOS.md`](06-PRUEBAS-Y-CRITERIOS.md) | Pruebas manuales/automatizadas y definición de terminado. |

## Imágenes de referencia (`assets/`)

- [`01-dashboard-administracion.png`](assets/01-dashboard-administracion.png): nueva portada administrativa, logotipo en encabezado, navegación lateral y accesos rápidos.
- [`02-gestion-academica-cursos.png`](assets/02-gestion-academica-cursos.png): navegación académica, filtros de cursos, tabla, actividad e hitos.
- [`03-gestion-usuarios.png`](assets/03-gestion-usuarios.png): tabla de usuarios, segmentación por rol, invitaciones y panel de creación.
- [`04-roles-permisos.png`](assets/04-roles-permisos.png): lista de roles y matriz de permisos.
- `original-01-administracion.png` y `original-02-cursos-inscripciones.png`: capturas proporcionadas como fuente de funcionalidad existente.

> **Jerarquía de fuentes:** para estilos, el código y los recursos **reales del sitio público** son la fuente de verdad; los mockups son una propuesta visual y no incluyen necesariamente el escudo oficial exacto. Para funcionalidad, el repositorio y la base de datos existentes prevalecen sobre rutas/entidades de ejemplo. Si hay contradicción o falta una decisión institucional, documentarla antes de introducir comportamiento irreversible.

## Reglas esenciales

1. No borrar registros académicos históricos ni introducir migraciones destructivas.
2. No reemplazar el escudo real por el dibujo aproximado de los mockups; reutilizar el recurso oficial del sitio.
3. No usar cantidades, fechas, nombres, teléfonos o correos ilustrativos de las imágenes como datos de producción.
4. No autorizar acciones solo porque el frontend oculte botones: **el backend valida permiso, alcance y estado**.
5. Conservar la semántica de inscripción/matrícula del sistema existente; el rediseño no debe cambiarla por accidente.
6. Para un usuario con varios roles, combinar permisos **dentro de sus respectivos alcances**, sin convertirlos en acceso global.
7. Si falta un endpoint, un servicio de correo o una capacidad real, implementar el soporte necesario o marcar la opción como no disponible; nunca simular éxito.

## Resultado esperado

Una rama/PR implementada con: layout administrativo, páginas académicas, usuarios, roles, autorización en backend, migraciones incrementales si fueran necesarias, pruebas, capturas desktop/mobile y un documento final de decisiones tomadas y tareas pendientes.
