# Especificación funcional — Dashboard y administración académica

## 0. Alcance heredado de la pantalla original

La pantalla actual permite gestionar:

| Entidad | Campos observados | Operaciones que no se pueden perder |
|---|---|---|
| Años académicos | Etiqueta, inicio, fin | Crear, listar. Añadir edición/estado si no existían. |
| Grados | Nombre, orden | Crear, listar. |
| Materias | Código, nombre | Crear, listar. |
| Secciones | Año académico, grado, nombre | Crear, listar. |
| Cursos | Año académico, sección, materia, fecha inicio/fin | Crear, listar, editar, eliminar cuando la regla de integridad lo permita, asignar docente. |
| Inscripciones | Alumno, año académico, sección, fecha inicio | Matricular y preservar relaciones existentes. |

**Nota de datos reales:** en la captura original aparece un registro etiquetado `2027` con fechas `2026-01-01 → 2026-01-02`. El agente debe incluir en su auditoría inicial un reporte de registros potencialmente inconsistentes y confirmar la regla institucional; **no corregir registros históricos ni inferir el año a partir de la etiqueta automáticamente**.

## 1. Rutas y navegación sugeridas

```text
/admin                       Dashboard
/admin/academic-years        Años académicos
/admin/grades                Grados
/admin/sections              Secciones
/admin/subjects              Materias
/admin/courses               Cursos
/admin/enrollments           Inscripciones / matrículas
/admin/users                 Usuarios
/admin/roles                 Roles y permisos
/admin/reports               Reportes, solo si existe el módulo
/admin/settings              Configuración, solo si existe el módulo
```

Son ejemplos: conservar las rutas del proyecto cuando ya hay enlaces permanentes; usar redirecciones/adaptadores si se renombran. La navegación de «Academia» puede contar también con pestañas horizontales dentro del módulo, como en `assets/02-gestion-academica-cursos.png`, sin duplicar botones de creación ni desorientar al usuario.

## 2. Dashboard `/admin`

Referencia: `assets/01-dashboard-administracion.png`.

### Bloques

- Saludo opcional, título «Administración» y subtítulo «Gestiona la estructura académica, usuarios y configuración del sistema».
- Indicadores: años académicos, grados, secciones, cursos, usuarios y roles. Priorizar 4–6 cards útiles; mostrar claramente si el dato es global o filtrado por año. Si algún agregado no está disponible, mostrar estado de carga/error y no inventar el número.
- «Actividad reciente»: línea de tiempo resumida de creación/edición académica, matrículas y asignaciones (según permisos). No exponer información de usuarios fuera del alcance del visor.
- «Accesos rápidos»: nuevo año, nuevo grado, nueva materia, nuevo curso, gestionar inscripciones y usuarios. Solo mostrar opciones permitidas y con rutas implementadas.
- Opcional si hay datos reales: «Próximas fechas académicas», avisos de inicio/fin de períodos y pendientes operativos.

### Interacciones

- Cards clicables solo si llevan a una vista realmente accesible; el número y el filtro aplicado deben coincidir con la lista destino.
- Seleccionar año global si el sistema maneja ese contexto; persistir en URL/parámetro o estado compartido según arquitectura. No usar año implícito al alterar registros históricos.
- Actividad paginada/limitada; enlazar a entidad cuando el actor tenga `*.read` dentro de su alcance.

## 3. Patrón común para catálogos académicos

Cada pantalla tendrá `PageHeader` (título, descripción y CTA «Nuevo/a...»), sección de filtros y lista, `StatusBadge`, menú por fila «Ver/Editar/Archivar» según permisos, estado vacío con acción, skeleton de carga, error con reintento, paginación/ordenamiento.

**Alta/edición:** modal para catálogos cortos (año, grado, materia); drawer lateral o página para sección, curso y matrícula. Bloquear doble envío. Guardar responde con feedback verificable y actualiza solo cachés/listas afectadas. Cambios de estado con confirmación y explicación de dependencias.

**Borrado:** el mockup dice «Eliminar» en algunos lugares, pero en producción usar «Archivar», «Desactivar» o eliminación física solamente si el backend garantiza ausencia de vínculos históricos. Si existen cursos, tareas, calificaciones, matrícula o relación docente, no borrar en cascada.

## 4. Años académicos `/admin/academic-years`

**Tabla:** etiqueta, inicio, fin, estado, secciones/cursos asociados cuando exista conteo eficiente y acciones.

**Filtros:** búsqueda de etiqueta; estado y orden cronológico. Un año puede figurar como planificado/activo/cerrado según la regla **persistida** del sistema, no solo por la fecha del navegador.

**Formulario:** `label` (requerido), `starts_on` (requerido), `ends_on` (requerido), estado si el modelo ya lo soporta o se añade con migración aprobada.

**Reglas:** etiqueta no vacía ni repetida dentro de institución; inicio anterior al fin; revisar impacto si se cambia la fecha de un año que ya contiene cursos. Permitir períodos solapados solo si la institución o el modelo existente lo admiten. Nunca archivar/desactivar automáticamente otros años al seleccionar uno.

## 5. Grados `/admin/grades`

**Tabla:** nombre, orden pedagógico, estado, número de secciones y acciones.

**Formulario:** nombre (requerido), orden entero positivo (requerido) y estado si aplica.

**Reglas:** el grado es una entidad reutilizable entre años si así existe actualmente; evitar duplicar «Sexto grado» por ciclo. Normalizar nombres para detectar duplicados; ordenar por el orden pedagógico, no alfabético. Confirmar si hay niveles (preescolar/básica/bachillerato) antes de extender el modelo.

## 6. Materias `/admin/subjects`

**Tabla:** código, nombre, estado y cursos asociados.

**Formulario:** código corto (requerido, ejemplo `MAT6`), nombre (requerido, ejemplo `Matemática`), estado si existe.

**Reglas:** código único case-insensitive si no contradice el esquema existente; trim y validación razonable de longitud; la materia con cursos históricos se archiva en lugar de eliminarse. No imponer equivalencia entre materia y grado: la asignación sucede al crear un curso o una oferta curricular si ya existe.

## 7. Secciones `/admin/sections`

**Tabla:** año, grado, nombre de sección, capacidad (si existe), matriculados, estado y acciones.

**Filtros:** primero año, luego grado y estado; buscador por «A», «B», etc.

**Formulario:** año (requerido), grado (requerido), nombre (requerido), capacidad opcional **solo si el sistema ya soporta cupos o la institución lo solicita**.

**Reglas:** impedir sección duplicada por `(academic_year, grade, nombre_normalizado)`; los cambios de año o grado de una sección que ya tiene cursos/matrículas requieren un flujo explícito y autorización. Mostrar «Sexto grado A · 2026» en vistas de selección.

## 8. Cursos `/admin/courses`

Referencia: `assets/02-gestion-academica-cursos.png`.

### Listado

Columnas sugeridas: curso/materia, grado–sección, año, docente principal, inicio, fin, inscritos/cupo si aplica, estado y acciones. Filtros por año, grado, sección, materia, docente, estado y búsqueda. Año → grado/sección deben actualizar listas dependientes sin borrar filtros válidos innecesariamente. El componente podrá guardar filtros en la URL.

### Crear/editar

1. Seleccionar año académico.
2. Seleccionar sección filtrada por el año.
3. Seleccionar materia.
4. Definir inicio y fin dentro del período salvo excepción existente/autorizada.
5. Asignar docente activo de rol adecuado, obligatorio solo si el proceso actual lo requiere.
6. Revisar resumen y guardar.

**Asignación de docente:** en la fila o detalle usar «Asignar docente» / «Cambiar docente»; indicar docente actual; confirmar reemplazo, registrar quién realizó el cambio y, si hay docentes múltiples, respetar la estructura actual en lugar de introducir un segundo `teacher_id`.

**Reglas:** impedir curso duplicado por sección + materia, salvo si ya existen períodos/ediciones; ante edición de fechas verificar dependencias; curso histórico solo se archiva; nunca se pierden tareas, calificaciones y archivos al desactivar.

### Detalle del curso

Ficha con año, materia, grado/sección, docente(s), período, número de inscritos y enlaces a funcionalidad existente (contenido, tareas, evaluaciones) según permisos. No desarrollar funciones que no existan ni sean parte del alcance solo para llenar tarjetas de la vista.

## 9. Inscripciones `/admin/enrollments`

El menú visible dirá «Inscripciones» para coincidir con los mockups; la acción será «Matricular alumno» cuando se trata de asociar alumno + año + sección. Conservar el nombre real de las tablas/servicios internos. No transformar la inscripción por sección en inscripción por curso sin identificar y probar las dependencias existentes.

**Listado:** alumno/identificador, año, grado–sección, fecha de inicio, estado y acciones; filtros año, sección, estado y búsqueda de alumno. Usar opciones de búsqueda remota para muchos estudiantes.

**Formulario:** alumno, año, sección filtrada y fecha. Validar matrícula activa duplicada; si la institución exige única sección por año, impedir simultaneidad salvo transferencia formal. Fecha dentro de año o excepción definida. El backend vuelve a validar cupo si este concepto existe.

**Operaciones opcionales condicionadas al esquema:** traslado entre secciones, retiro (con fecha/motivo), reactivación y exportación. No ponerlas como acciones funcionales si no hay lógica ni audit trail implementados.

## 10. Reglas transversales y estados

- Solo mostrar opción «Crear/Editar/Archivar/Asignar» con permiso y alcance efectivo, pero la seguridad se verifica en backend.
- Todas las tablas soportan navegación por teclado, etiquetas claras y botones de acción identificables.
- `404` cuando el registro no existe o no debe revelar su existencia; `403` para acción fuera de permisos; `409` para duplicado/edición en conflicto/dependencias; `422` para validación.
- Los listados necesitan paginación en servidor si la cantidad de datos lo amerita; no traer toda la institución para filtrar en el navegador.
- Mantener navegación operativa desde la pantalla antigua hasta concluir migración y E2E; no retirar rutas existentes de golpe.

## 11. Flujos E2E de academia

**Flujo A:** crear año → crear grado/materia (si faltan) → crear sección → crear curso → asignar docente → matricular alumno → comprobar que alumno y docente ven **solo** los recursos autorizados.

**Flujo B:** buscar curso histórico → cambiar docente con autorización → verificar lista y ficha → confirmar registro de auditoría → revocar acceso del docente anterior si no tiene otra relación vigente.

**Flujo C:** intentar archivar una materia en uso → respuesta explícita; impedir eliminación destructiva y conservar toda la información histórica.
