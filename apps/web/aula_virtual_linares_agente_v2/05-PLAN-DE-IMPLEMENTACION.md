# Plan por fases para implementar sin interrumpir el Aula Virtual

## Fase 0 — Descubrimiento, comparación y decisiones

**Objetivo:** conocer cómo funciona el proyecto antes de dibujar o migrar.

- [ ] Localizar frontend de administración y sus componentes actuales; mapear sus seis formularios y las llamadas que realizan.
- [ ] Identificar stack, rutas, estado, ORM/esquema, migraciones, tests, despliegue y mecanismo de autenticación.
- [ ] Obtener escudo, paleta, tipografía y estilos verdaderos del sitio público o del código compartido. Crear tokens mapeados, no duplicados manualmente.
- [ ] Comparar información de las capturas originales con modelo real: años, grados, materias, secciones, cursos, asignación docente e inscripción.
- [ ] Auditar datos de ciclos/fechas, duplicados, relaciones rotas, docentes inactivos y registros históricos; **no cambiar datos durante el diagnóstico**.
- [ ] Determinar si ya existen usuarios/roles/guardians/servicio de invitación/auditoría y qué falta.
- [ ] Listar decisiones por aprobar: privilegios del coordinador, encargados, múltiples docentes, periodos y matrículas simultáneas.

**Entregable:** `docs/admin-discovery.md` en el repo con arquitectura real, decisiones, matriz original→nuevo, riesgos, API reusadas y plan de migración; no iniciar una reimplementación completa si existe funcionalidad reutilizable.

## Fase 1 — Base visual institucional

- [ ] Implementar diseño base del documento `01-DISENO-Y-BRANDING.md` y usar assets **reales** del colegio.
- [ ] Crear header blanco con escudo, sidebar blanca responsive, estados activos azules, breadcrumbs, tipografía y navegación por permisos.
- [ ] Estandarizar CTA, tabla, filtros, KPI, badge de estado, drawer, modal, confirmación, skeleton, vacío y error.
- [ ] Diseñar y conectar el dashboard a métricas reales disponibles, sin números del mockup.
- [ ] Cubrir desktop (1440 px), tablet (768 px) y móvil (375 px); verificar accesibilidad inicial.

**Hito:** dashboard navegable, consistente con web pública, componentes compartidos probados y rutas nuevas conectadas o protegidas.

## Fase 2 — Migración funcional de Academia

Orden que minimiza dependencias:

1. [ ] Años académicos: listar, buscar, crear, editar, archivar/estado autorizado.
2. [ ] Grados: ordenar, crear, editar y estado.
3. [ ] Materias: código único, crear, editar y estado.
4. [ ] Secciones: año+grado, duplicados, filtros y dependencias.
5. [ ] Cursos: tabla, filtros, alta, edición, asignación de docente, archivo y fechas.
6. [ ] Inscripciones: alumno+año+sección+fecha; reusar la semántica actual; retirada/traslado si está aprobado y soportado.
7. [ ] Tests de regresión contra acciones originales de cada módulo y datos históricos.

**Hito:** ninguna funcionalidad académica de la captura original desapareció; se puede operar el ciclo básico completo usando nueva UI.

## Fase 3 — Usuarios y permisos por alcance

- [ ] Diseñar migraciones aditivas de perfil/roles/permisos/asignaciones **solo para las brechas reales**.
- [ ] Integrar identidad e invitaciones con el proveedor actual; evitar duplicar contraseñas en base local.
- [ ] Crear usuarios: lista paginada, búsqueda autorizada, filtros, panel alta/edición, invitaciones y activación/desactivación.
- [ ] Crear roles: lista, detalle, matriz real de permisos, usuarios asignados, versión de edición y auditoría cuando soporte.
- [ ] Implementar comprobación del backend de permiso **más alcance** sobre cada recurso. Añadir índices/scopes y filtros del servidor.
- [ ] Bloquear escalamiento de privilegios, último administrador y accesos de docente/alumno/encargado fuera de vínculos verificados.
- [ ] Asegurar que la asignación de docente desde Cursos solo ofrece cuentas aptas y que cambiar docente cambia acceso efectivo correctamente.

**Hito:** invitación → aceptación → asignación de rol/alcance → comprobación de acceso → revocación/desactivación comprobadas mediante pruebas.

## Fase 4 — Robustez, seguridad y migración segura

- [ ] Completar pruebas `06-PRUEBAS-Y-CRITERIOS.md` (unitarias, integración, E2E, seguridad, UI y accesibilidad).
- [ ] Ensayar migración/backfill con copia anonimizada de datos reales y verificar conteos/relaciones antes y después.
- [ ] Revisar privacidad de menores, rate limits, CSRF (si cookies), CORS, logs redactados y permisos de exportación.
- [ ] Verificar estados de carga/vacío/error/409; simular caída de servicio de invitación sin mostrar éxito falso.
- [ ] Activar feature flag o reemplazo gradual. Mantener respaldo y mecanismo de rollback de código; **el rollback no debe borrar datos legítimos creados con la versión nueva**.
- [ ] Realizar UAT con administración/coordinación y registrar decisiones que solo la institución puede aprobar.

**Hito:** informe con pruebas, capturas, diffs visuales, validaciones de datos, migraciones y plan seguro de lanzamiento.

## Fase 5 — Entrega al responsable técnico

El PR/documentación final debe contener:

- Resumen de módulos completados, rutas/componentes/endpoints añadidos y compatibilidad de APIs.
- Migraciones revisadas, script/instrucciones de backfill y reporte de datos anómalos no alterados.
- Pruebas ejecutadas y resultados; capturas de dashboard, cursos, usuarios y roles en desktop y móvil.
- Decisiones institucionales pendientes, concesiones de permisos aprobadas y registro de cualquier funcionalidad excluida.
- Instrucciones de despliegue, feature flag y rollback seguro según infraestructura **real**.

## Prioridades y dependencias

| Prioridad | Trabajo | Depende de |
|---|---|---|
| P0 | Descubrimiento del repo y fuente de identidad | Acceso al código |
| P0 | Reutilizar branding oficial + layout | Assets/css institucionales |
| P0 | CRUD académico sin regresión | APIs actuales |
| P0 | Servidor RBAC/alcance para datos de estudiantes | Roles/vínculos existentes o migraciones |
| P1 | Usuarios/invitaciones y gestión roles | P0 de identidad/autorización |
| P1 | Auditoría de cambios sensibles | Persistencia/log de eventos |
| P1 | Responsive, accesibilidad y E2E | Componentes y rutas reales |
| P2 | Reportes/analytics adicionales y refinamientos | Definición de datos y permisos |

## Bloqueos que deben presentarse al responsable, no inventarse

- ¿Existe un escudo institucional SVG/PNG autorizado y un paquete compartido de diseño?
- ¿Quién tiene permiso para crear administradores y cambiar permisos globales?
- ¿El coordinador puede matricular/trasladar y asignar docentes o solo consultar?
- ¿Puede un alumno tener varias secciones activas en el mismo año?
- ¿Hay varios docentes por curso, períodos/bimestres o materias por grado predefinidas?
- ¿Quién verifica legal/administrativamente vínculos encargado–alumno?
- ¿Qué datos personales puede consultar/exportar cada perfil y cuánto se retienen logs?

En ausencia de respuesta, conservar comportamiento existente y **no ampliar** permisos sobre menores. Registrar la duda en el PR con propuesta reversible.
