# Especificación de Usuarios, Roles y permisos

Referencias visuales: `assets/03-gestion-usuarios.png` y `assets/04-roles-permisos.png`. Las cifras, correos y ejemplos visibles son **ilustrativos**. Este documento describe comportamientos deseados sujetos a las capacidades y restricciones del sistema existente.

## 1. Pantalla Usuarios `/admin/users`

### Estructura

- Título «Usuarios» y subtítulo descriptivo; CTA azul «Nuevo usuario» visible solo con permiso `users.invite` o `users.create` real.
- Buscador por nombre, correo o identificador; filtros por estado, rol y, cuando aplique, año/sección/curso.
- Segmentos visuales «Todos», «Administradores», «Docentes», «Estudiantes», «Padres de familia» con conteos del backend; agregar Coordinadores si ese rol existe. Un usuario con varios roles puede aparecer en varios segmentos, por lo que **la suma de segmentos no equivale al total**.
- Tabla con nombre/avatar o iniciales, identificador, correo, rol(es), estado, último acceso **solo si el servicio de identidad permite obtenerlo**, y menú de acciones.
- Panel «Invitaciones pendientes» si se implementan invitaciones reales; reenviar, cancelar o ver vencimiento según soporte backend.

### Acciones por fila

Ver perfil y vínculos académicos autorizados; editar nombre/datos permitidos; cambiar estado activo/inactivo; gestionar asignaciones de roles y alcances; reenviar invitación pendiente; consultar accesos efectivos/auditoría si el actor posee permisos. Nunca mostrar contraseña ni claves del proveedor de identidad.

### Drawer «Nuevo usuario»

Datos mínimos: nombre y apellido, correo, identificador institucional o matrícula según tipo de usuario (opcional hasta confirmar requerimiento), teléfono opcional, rol principal, roles adicionales, estado/invitación y campos dependientes del rol. Ejemplos:

- Docente: vinculación posterior a cursos/secciones autorizados.
- Estudiante: vínculo con matrícula o perfil académico existente; no crear matrícula automáticamente sin confirmación.
- Encargado: vínculo explícito con estudiantes verificados, sujeto a procedimiento institucional.
- Administrador/coordinador: alcance explícito y confirmación adicional para roles elevados.

El formulario no permite autoasignarse privilegios que el actor no puede delegar. Si el sistema usa un IdP externo, crear/invitar mediante ese proveedor y enviar un enlace para establecer credenciales. Si no tiene invitaciones, implementar un mecanismo seguro **compatible con el sistema existente** y no inventar contraseñas visibles en UI.

### Ciclo de cuenta

`invited/pending → active → inactive` como ejemplo. Ajustar a las transiciones reales; preservar usuarios históricos para calificaciones, tareas y auditoría. Desactivar no equivale a borrar y debe impedir nuevos accesos según la arquitectura de sesiones/IdP. Evitar duplicados por correo normalizado y, si existe, ID de identidad único.

## 2. Roles y permisos `/admin/roles`

### Layout

Columna izquierda: lista de roles con nombre, descripción, usuarios asignados, estado y CTA «Nuevo rol» según permiso. Columna derecha: nombre/detalle del rol, badge de estado, CTA «Editar rol» y pestañas **Permisos**, **Usuarios asignados** y **Auditoría** (esta última solo si existe fuente real de logs y hay permiso).

La matriz usa filas por módulo y columnas por acción permitida para ese módulo. En una institución, **no todas las acciones son válidas para todos los módulos**: por ejemplo «Asignar» para cursos/docentes y roles, «Transferir» para matrículas, «Exportar» solo si hay un endpoint real. Casillas no aplicables se muestran deshabilitadas con explicación, no concedidas por defecto.

### Roles base propuestos para confirmar con el colegio

| Rol | Uso | Alcance por defecto sugerido |
|---|---|---|
| Administrador | Gestiona administración académica y configuración autorizada | Institución, **sin asumir automáticamente** permisos críticos de superadministración. |
| Coordinador académico | Supervisión de los grados, años o secciones asignados | Año/grado/sección, si el modelo existente lo soporta. |
| Docente | Gestiona sus cursos y tareas/evaluaciones autorizadas | Cursos asignados. |
| Estudiante | Consulta y participa en sus clases | Cuenta y matrículas propias. |
| Padre/madre o encargado | Seguimiento de estudiantes vinculados | Solo hijos/estudiantes cuya relación esté validada. |

Un **superadministrador técnico** puede existir como rol protegido distinto de Administrador si el repositorio lo requiere. No reemplazar ni degradar roles preexistentes al crear esta propuesta. Roles base son un **borrador para aprobación**, no permisos definitivos de producción.

### Catálogo sugerido de permisos

```text
academic_years: read, create, update, archive
 grades:          read, create, update, archive
 subjects:        read, create, update, archive
 sections:        read, create, update, archive
 courses:         read, create, update, archive, assign_teacher
 enrollments:     read, create, update, transfer, withdraw
 users:           read, invite, update, activate, deactivate, assign_roles
 roles:           read, create, update, archive, assign
 audit:           read
 reports:         read, export              # solo si existe el módulo
 settings:        read, update             # solo si existe el módulo
```

Quitar o añadir acciones según capacidades reales de backend. Preferir claves estables `module.action`, no traducir claves técnicas cuando cambie el idioma de la UI.

### Matriz y edición

- Solo un actor autorizado puede abrir la edición. Mostrar permisos persistidos, no datos del mockup.
- Al seleccionar/retirar permisos, mostrar previsualización de «N usuarios afectados» o cambio real de asignaciones si la base lo soporta.
- Confirmar cambios peligrosos (roles de administración, acceso a menores, exportaciones). Proteger roles del sistema `is_system`/`is_editable=false` cuando corresponda.
- Guardar el conjunto de permisos de forma transaccional, con control optimista de versión para evitar que una pantalla antigua reemplace cambios de otro administrador.
- La pestaña «Usuarios asignados» lista usuario, alcance, fecha, estado y permite revocar únicamente si está autorizado.
- Mostrar historial de cambios de rol de forma filtrada, sin secretos ni datos innecesarios.

## 3. Separar permiso y alcance

- **Permiso:** qué acción puede realizar: `courses.update`, `users.assign_roles`, etc.
- **Alcance:** sobre qué recursos: `institution`, `academic_year`, `grade`, `section`, `course`, `self`, `linked_students`.
- **Relación comprobada:** además del rol, debe existir vínculo docente–curso, matrícula alumno–sección o encargado–alumno donde corresponda.

Ejemplo: docente con `courses.read` solo para `course=123` **no** puede cambiar URL a `course=456`. Coordinador de un año no ve usuarios y notas de otras secciones por pertenecer a un rol llamado «Coordinador».

Con varios roles, el resultado efectivo es la unión de **pares (permiso, alcance)**. No combinar un permiso de un rol con el alcance amplio de otro rol si no pertenecen a la misma concesión autorizada. Solo el servidor determina relaciones; parámetros del cliente nunca prueban acceso.

## 4. Tabla de defaults a revisar antes de implementar

| Capacidad | Administrador | Coordinador | Docente | Estudiante | Encargado |
|---|---|---|---|---|---|
| Catálogos y años | Según aprobación institucional | Lectura en alcance | No por defecto | No | No |
| Crear cursos/secciones | Según aprobación | Solo delegación explícita | No por defecto | No | No |
| Asignar docentes | Según aprobación | Solo delegación explícita | No | No | No |
| Inscripciones | Según aprobación | Solo delegación explícita | Solo lectura autorizada, si aplica | Propia | Del hijo si aplica |
| Roles y usuarios | Solo permisos administrativos expresos | No por defecto | No | No | No |
| Cursos visibles | Todos los autorizados | En alcance | Asignados | Matriculados | Vinculados a hijos |
| Calificaciones y datos de menores | Necesidad funcional comprobada | En alcance autorizado | Cursos asignados | Propias | De hijos con vínculo validado |

**No ejecutar seeds con esta tabla sin validar permisos existentes con responsables del colegio.** El mínimo privilegio es el punto de partida.

## 5. Casos de seguridad obligatorios

1. Proteger todos los endpoints de servidor, incluidos listados, exportaciones, búsquedas y modificación por ID.
2. Un usuario no puede asignarse por API un rol que no puede delegar; nunca confiar en roles enviados en payload de actualización del propio perfil.
3. Impedir desactivar/revocar al **último administrador** capaz de recuperar la gestión de usuarios/roles; la política exacta depende del sistema existente.
4. Revocación/inactivación debe surtir efecto en la siguiente operación autenticada; invalidar caché de autorización y sesiones/tokens cuando corresponda al IdP.
5. Las relaciones encargado–alumno deben verificarse: la simple coincidencia de apellidos, correo o ID suministrado por navegador no concede acceso.
6. No mostrar datos de alumnos a usuarios fuera de su alcance, ni permitir búsqueda global de cuentas sin permiso.
7. Auditar invitación, activación, desactivación, asignación/revocación de roles, edición de permisos, traslado de alumnos y cambios de docente.
8. Si hay cookies, proteger escrituras contra CSRF; controlar rate limit de invitaciones, autenticación y búsquedas sensibles; nunca registrar credenciales/tokens en logs.

## 6. Auditoría mínima

Campos de referencia: actor, acción, entidad, ID de recurso, valores anteriores y nuevos **minimizados/redactados**, timestamp, request ID y origen cuando esté permitido. Solo consultar con permiso `audit.read` y alcance adecuado. Aplicar retención institucional/legal confirmada; no mostrar en la UI la IP, el correo o contenido sensible si no hacen falta para la operación.

## 7. Estados, mensajes y confirmaciones

- «Invitación enviada» solo después de confirmación del servicio externo; mostrar fallo y permitir reintento seguro.
- «No tienes permiso para esta acción» para 403; mantener el contexto de formulario sin exponer datos restringidos.
- «El rol fue actualizado por otro administrador» para conflicto de versión; recargar/comparar antes de volver a guardar.
- Confirmación de desactivar incluye nombre del usuario e impacto de acceso; roles privilegiados requieren paso explícito y razón si la política lo solicita.
