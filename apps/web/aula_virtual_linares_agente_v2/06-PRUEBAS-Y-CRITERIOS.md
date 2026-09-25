# Matriz de pruebas y criterios de aceptación

## 1. Validación visual y experiencia de usuario

- [ ] Se utiliza el **logotipo oficial real** y el header/sidebar se ven parte de la web del colegio; los tokens reales del sitio gobiernan el tema final.
- [ ] Dashboard, Cursos, Usuarios y Roles se corresponden funcionalmente con `assets/01` a `assets/04` sin reproducir sus datos ficticios.
- [ ] Activo de navegación, breadcrumbs y CTA reflejan ruta actual.
- [ ] El menú responsive funciona a 375, 768, 1280 y 1440 px sin overflow accidental; columnas de tabla densas permiten scroll o resumen móvil.
- [ ] En tabulador, el orden del foco es lógico; modal/drawer atrapa y devuelve foco; etiquetas, errores y estados se anuncian accesiblemente.
- [ ] Contraste de texto e iconos alcanza WCAG AA; rojo/verde no es único indicador de estado.
- [ ] Cambios se guardan con feedback real; errores preservan entradas y no dejan spinners infinitos.
- [ ] Funcionalidad de lectura funciona con teclado y sin depender de hover; botones no habilitados explican por qué.

## 2. Regresión de Academia

| ID | Escenario | Resultado esperado |
|---|---|---|
| A-01 | Crear año con etiqueta, inicio y fin válidos | Nuevo registro persistente y visible en lista. |
| A-02 | Fecha fin anterior a inicio | Error de campo frontend + rechazo backend. |
| A-03 | Crear grado con orden entero positivo | Visible ordenado correctamente. |
| A-04 | Crear materia con código duplicado en distintas mayúsculas | `409`/validación clara sin segundo registro. |
| A-05 | Crear sección año + grado + nombre | Opción filtrada por año y visible en Cursos. |
| A-06 | Repetir sección en mismo año y grado | Error de duplicado. |
| A-07 | Crear curso con año/sección/materia/fechas | Persistencia sin duplicado ni fechas inconsistentes. |
| A-08 | Cambiar docente del curso | Docente actual correcto y evento auditado; verificar accesos. |
| A-09 | Matricular alumno en sección y año | Inscripción persistente y visible por usuario autorizado. |
| A-10 | Matricular el mismo alumno de nuevo en la misma sección | Se bloquea duplicado activo. |
| A-11 | Intentar borrar curso/materia con registros dependientes | Se archiva si permitido o se bloquea; historial intacto. |
| A-12 | Consultar años/cursos históricos | Mismos vínculos académicos y conteos que antes de la migración. |
| A-13 | Filtros dependientes año → sección → curso | No muestran relaciones que no pertenecen al año seleccionado. |
| A-14 | Registro antiguo etiquetado 2027 con fechas de 2026 | No se altera silenciosamente; se reporta inconsistencia si la regla aprobada la considera tal. |

## 3. Usuarios y roles

| ID | Escenario | Resultado esperado |
|---|---|---|
| U-01 | Buscar un usuario con rol autorizado | Solo devuelve usuarios dentro del alcance del actor. |
| U-02 | Invitar correo nuevo | Servicio acepta invitación; UI confirma **solo después** del éxito. |
| U-03 | Reintentar invitación tras timeout | No genera cuentas duplicadas ni envíos múltiples indeseados. |
| U-04 | Crear usuario con correo duplicado | Conflicto claro; no duplica identidad/perfil. |
| U-05 | Asignar rol de docente a curso permitido | Ve únicamente cursos autorizados. |
| U-06 | Coordinador intenta autoasignarse Administrador | `403`; ningún cambio persistido. |
| U-07 | Administrador revoca rol de otro usuario | Se refleja en el próximo request y se registra auditoría. |
| U-08 | Intentar desactivar el último administrador protegido | Acción rechazada sin dejar institución sin administración. |
| U-09 | Actualizar rol desde dos pestañas con versiones distintas | Conflicto 409, opción de revisar cambios y no sobrescribir silenciosamente. |
| U-10 | Desactivar usuario con historial académico | Acceso revocado sin borrar calificaciones, cursos ni logs históricos. |
| U-11 | Encargado consulta alumno no vinculado | `403` o `404`; ningún dato personal filtrado. |
| U-12 | Usuario con dos roles y alcances distintos | La unión no produce acceso global ni cruza ámbitos. |

## 4. Pruebas de seguridad/API

- [ ] Endpoints de listado, detalle, creación, edición, asignación, auditoría y exportación bloquean `401` y `403` apropiadamente.
- [ ] Cambiar IDs en URL o cuerpo (IDOR) no expone ni modifica año, sección, curso, usuario o alumno ajenos.
- [ ] Cada endpoint de escritura hace **autorización en servidor**, no depende de ocultar botones.
- [ ] Se aplica paginación/filtro en servidor **antes** de responder recursos que el usuario no debe ver.
- [ ] El cambio de roles no es posible por `PATCH /me` ni por payloads extras enviados a un endpoint genérico.
- [ ] La desactivación invalida caché/sesiones de acuerdo con el proveedor real.
- [ ] Logs/auditoría no incluyen contraseñas, tokens, notas personales innecesarias o dumps completos de estudiantes.
- [ ] Si cookies: CSRF efectivo sobre POST/PATCH/DELETE; revisar CORS/rate-limit e invitaciones.
- [ ] Respuestas sensibles no se cachean públicamente; conteos del dashboard reflejan alcance autorizado.

## 5. Prueba de migración y resiliencia

1. Preparar copia anonimizada con años, materias, secciones, cursos con docente, matrículas y usuarios reales suficientes para reproducir relaciones y datos históricos.
2. Tomar snapshot de conteos y claves de relaciones de cada entidad antes de migración.
3. Ejecutar migraciones y backfill **dos veces en entorno de prueba** si el diseño es idempotente; no deben duplicarse permisos, roles ni perfiles.
4. Comparar conteos, llaves y acceso a cursos históricos después de migrar; justificar cada cambio.
5. Desplegar versión nueva con feature flag (si es viable), simular fallo externo de invitaciones y rollback de código sin pérdida de datos escritos por la nueva versión.
6. Comprobar que datos pendientes de revisión (etiqueta/fecha incoherente, duplicados) quedan en un reporte y no se corrigen por heurística.

## 6. Definición de terminado

- [ ] El diseño de producción usa assets y tokens oficiales del colegio y es responsive/accesible.
- [ ] Todos los formularios y acciones académicas de la pantalla original siguen operativos o tienen reemplazo funcional verificado.
- [ ] Dashboard y listados muestran información real, filtros correctos, paginación y estados completos.
- [ ] Usuarios e invitaciones están integrados con identidad real y preservan historial.
- [ ] Roles y permisos tienen persistencia, alcance por recurso, controles de privilegios y edición concurrente segura.
- [ ] Auditoría registra cambios sensibles con redacción de datos.
- [ ] Pruebas unitarias, integración, E2E, seguridad, responsive y accesibilidad pasan; adjuntar resultados específicos.
- [ ] Migraciones están ensayadas, no hay pérdida de datos, existe estrategia de rollback y decisiones institucionales están documentadas.
- [ ] No hay links, botones o tarjetas decorativas que simulen funciones terminadas.

## 7. Evidencias a adjuntar al PR

Capturas nuevas `dashboard-desktop`, `cursos-desktop`, `usuarios-desktop`, `roles-desktop`, `usuarios-mobile` y `roles-mobile`; resultado de test runner/linter; reporte de migración con conteos; ejemplo anonimizados de eventos de auditoría y tabla de permisos finales aprobados.
