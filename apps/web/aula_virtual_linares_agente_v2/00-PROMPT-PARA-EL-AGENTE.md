# Prompt maestro para el agente de programación

Actúa como desarrollador full-stack responsable de rediseñar la **Administración de Aula Virtual del Colegio Coronel Francisco Linares** en el repositorio existente. Usa los demás archivos Markdown de este paquete como especificaciones y los PNG de `assets/` como referencias visuales. El rediseño debe armonizar con el sitio institucional: https://public-web.dy880wnmeoiy1.amplifyapp.com/.

## Antes de cambiar código

1. Inspecciona el repositorio: framework, componentes UI, router, estilos globales, autenticación, backend, ORM/modelos, migraciones y test runner. Identifica qué funcionalidad ya existe y cuál falta.
2. Localiza recursos reales del sitio público (escudo, logotipo, tipografía, colores, botones, fondos y motivos decorativos). Si el sitio público está en otro repositorio o no hay acceso a su código, documenta qué pudiste verificar y utiliza tokens provisionales del documento de diseño; **no inventes un logotipo oficial**.
3. Compara los formularios originales con la propuesta nueva; crea una matriz **funcionalidad existente → pantalla nueva → ruta/componente → endpoint**. Identifica compatibilidad y datos históricos.
4. Comprueba cómo se gestionan actualmente los usuarios, el inicio de sesión, los perfiles y las relaciones docente–curso/alumno–sección/encargado–alumno. Reutiliza lo existente donde sea razonable.
5. Presenta o registra un plan por fases y las decisiones pendientes; continúa con lo que no requiera inventar reglas institucionales.

## Implementa

- Layout institucional: encabezado con escudo **real**, nombre de colegio/Aula Virtual, usuario actual; navegación lateral clara, breadcrumb y diseño responsive.
- Dashboard administrativo con KPIs reales, actividad reciente, accesos rápidos y fechas relevantes cuando esos datos existan.
- Páginas independientes: años académicos, grados, materias, secciones, cursos e inscripciones, conservando todos los flujos existentes.
- Páginas de **Usuarios** (tabla, búsqueda, filtros, invitaciones, creación/edición, activación/desactivación, roles) y **Roles y permisos** (lista, detalle, usuarios asignados, matriz por módulo/acción y auditoría cuando esté soportada).
- Backend para autorización por permisos y **alcance del recurso**; implementar validaciones y auditoría de acciones sensibles.
- Migraciones incrementales, pruebas unitarias/integración/E2E y estados de carga, vacío, error y éxito.

## Guía visual y de producto

Imita la identidad de la **web del colegio**, no la de un SaaS genérico oscuro. Prioriza encabezado blanco, azul institucional, títulos azul marino, acentos rojos discretos, tarjetas blancas, bordes suaves y ornamentación azul/amarilla **solo en áreas no críticas**. Usa el mismo logo y tipografía reales cuando estén disponibles. Para pantallas densas como tablas y formularios, conserva legibilidad y no sacrifiques contraste ni espacio útil por decoración.

Los mockups contienen valores ilustrativos (p. ej. “156 cursos”, “24 usuarios”) y un tratamiento aproximado del escudo: **no usar como datos ni activos finales**. Si los componentes actuales ya responden al branding público, reutilízalos.

## Reglas innegociables

- No crear una segunda fuente de verdad para asignaciones docentes, matrículas ni autenticación.
- No cambiar APIs públicas existentes sin adaptación, pruebas y migración consciente.
- No permitir que un usuario se conceda roles privilegiados ni que se desactive al último administrador con capacidad de administrar permisos.
- No borrar en cascada estudiantes, evaluaciones, tareas, notas, archivos ni históricos de matrícula.
- No publicar datos personales de menores sin validar permisos y relación real con el recurso.
- No marcar una característica como terminada si solo se diseñó la pantalla pero no hay persistencia ni autorización funcional.
- No inventar decisiones de negocio (alumnos multisección, dobles docentes, rol del coordinador, acceso del encargado). Registrar dudas y mantener el comportamiento previo donde proceda.

## Orden recomendado

Sigue `05-PLAN-DE-IMPLEMENTACION.md`. Después de cada fase, ejecuta pruebas y entrega un resumen corto con archivos modificados, migraciones, endpoints, capturas y bloqueos. Al concluir, contrasta el resultado con `06-PRUEBAS-Y-CRITERIOS.md` y adjunta evidencia. Si no tienes acceso al entorno o credenciales de despliegue, entrega cambios listos para revisión, sin fingir que están desplegados.
