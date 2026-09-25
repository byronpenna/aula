# Diseño de interfaz y armonía con la web institucional

## 1. Referencia y objetivo

Referencia de marca: https://public-web.dy880wnmeoiy1.amplifyapp.com/  
Identidad textual del sitio: **Colegio Coronel Francisco Linares**, lema **«Dios, Patria, Ciencia»**, y Aula Virtual como plataforma de la comunidad educativa. El mockup aprobado conserva el carácter escolar de la web pública: blanco y azul como base, rojo institucional como acento, escudo en cabecera y una decoración azul/amarilla muy contenida.

**La paleta numérica de este documento es provisional**, deducida de los mockups. El agente debe buscar primero el CSS/design tokens y los recursos originales del sitio público. Si difieren, extraer y aplicar los valores reales en un único tema compartido o mapeado, no duplicar CSS a mano en cada módulo.

## 2. Comparación: original → rediseño

| Elemento | Pantalla original | Pantalla nueva |
|---|---|---|
| Navegación | Barra horizontal Inicio/Cursos/Administración y una página larga | Header de marca + sidebar con grupos Academia, Usuarios, Reportes y Sistema |
| Formularios | Seis bloques apilados con creación y listados | Cada entidad tiene su ruta, tabla de gestión y alta/edición en drawer o modal |
| Jerarquía | Todas las secciones compiten visualmente | Dashboard de entrada; filtros, listas, acciones y títulos consistentes |
| Docentes | Asignación debajo de cada curso en página larga | Acción contextual en fila y ficha de curso |
| Usuarios/roles | No aparecen en capturas originales | Módulos completos y protegidos por permisos |
| Marca | UI azul genérica | Cabecera institucional real, tipografía/espaciado del sitio y acentos escolares |

## 3. Assets y tokens

### 3.1 Assets obligatorios

- Reutilizar **escudo/logo oficial real** y sus variantes de alta resolución desde el sitio institucional o su repositorio. Nunca extraer el escudo aproximado de la imagen generada como si fuese oficial.
- Si existe sistema de componentes común con la web pública, reutilizar fuente, variables y elementos compartidos sin acoplar la administración a secciones de marketing.
- El motivo sol/libro y las curvas azul/amarillo del mockup pueden ser decorativos de baja prioridad: usarlos solo si hay activos originales o puede recrearse sin confundirlos con el escudo. No ocupar espacio de tablas.

### 3.2 Tokens propuestos como fallback

```css
/* Valores de referencia del MOCKUP; reemplazar por tokens reales del sitio. */
:root {
  --brand-navy: #142458;
  --brand-primary: #1165d8;
  --brand-primary-hover: #0b54ba;
  --brand-red: #c52c37;      /* Acento; no usar para texto pequeño sin contrastar. */
  --brand-gold: #f2ba2b;     /* Decoración únicamente. */
  --surface: #ffffff;
  --canvas: #f6faff;
  --border: #d9e5f4;
  --text-main: #17274a;
  --text-muted: #5a6d8c;
  --success: #187e53;
  --warning: #97630a;
  --danger: #b4232c;
  --focus: #0a62d0;
  --radius-card: 12px;
  --radius-control: 8px;
  --header-height: 76px;
  --sidebar-width: 232px;
}
```

Los estados usan texto + icono o badge; nunca solo un color. Validar contraste WCAG AA con la tipografía que efectivamente use la página pública. Ajustar `--brand-primary` si el componente no logra el contraste necesario en texto blanco.

### 3.3 Tipografía y densidad

- Prioridad: fuente real del sitio público. Fallback de sistema sin dependencias arbitrarias.
- H1 pantalla 28–32 px, H2 sección 20–22 px, H3 tarjeta 16–18 px; cuerpo 14–16 px; metadata mínimo 12–13 px con contraste adecuado.
- Contenedor: ancho fluido, máximo sugerido 1440–1600 px; 20–28 px entre paneles; tarjetas 16–24 px de padding; tablas más compactas sin perder área táctil.
- Borde fino y sombra sutil: no introducir un diseño oscuro, neomórfico o degradados sobre toda la pantalla.

## 4. Shell de administración

### Header

- Izquierda: **escudo real + nombre del colegio**; separador visual opcional; título «Aula Virtual» y subtítulo corto.
- Derecha: notificaciones solo si existen funcionalmente; nombre, avatar/iniciales y rol del usuario autenticado; menú con perfil y cerrar sesión.
- En móvil: conservar marca compacta, botón de menú accesible y menú de usuario; evitar que logotipo empuje contenido fuera de pantalla.

### Sidebar

1. Inicio.
2. **Academia:** Años académicos, Grados, Secciones, Materias, Cursos, Inscripciones.
3. **Usuarios:** Usuarios, Roles y permisos.
4. **Reportes:** solo si existe un destino real y el usuario tiene permiso.
5. **Sistema:** Configuración solo si existe y está autorizada.

Elemento activo en azul primario con texto/icono blanco; elementos inactivos en azul marino. Barra lateral clara/blanca, a diferencia del primer rediseño oscuro. No mostrar opciones prohibidas ni permitir visitarlas por URL directa.

### Área principal

- Breadcrumb «Administración / Módulo»; título claro, descripción de una línea y **una acción primaria** arriba a la derecha cuando aplique.
- Tarjetas KPI para vistas generales y paneles con filtros + tabla para vistas CRUD.
- Formularios sencillos (año, materia) en modal; formularios complejos (curso, usuario) en drawer lateral o página dedicada.
- Snackbars/toasts accesibles para confirmación y errores; errores de campo junto a sus inputs.

## 5. Componentes reutilizables

Implementar o reutilizar `AdminLayout`, `AppHeader`, `AdminSidebar`, `PageHeader`, `Breadcrumbs`, `MetricCard`, `StatusBadge`, `FilterPanel`, `DataTable`, `FormDrawer`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `ErrorState`, `PermissionGate`, `AcademicYearSelector`, `RoleBadge` y `AuditTimeline` según los patrones y nombres del repositorio.

- Botón primario: azul sólido, acción actual; secundario: contorno azul; peligro: rojo con confirmación.
- Estado: Activo/Planificado/Finalizado/Inactivo/Pendiente y variantes adecuadas por entidad.
- Tablas con cabeceras visibles, columnas ordenables donde proceda, paginación real, selección si hay acciones masivas respaldadas por API y menú accesible por fila.
- Ningún botón de edición, ver, crear o exportar puede quedar decorativo.
- Drawers mantienen botones «Cancelar» y «Guardar» visibles; cierran tras éxito comprobado o permiten continuar editando según patrón del proyecto.

## 6. Adaptación responsive

| Ancho | Comportamiento |
|---|---|
| >= 1280 px | Sidebar 232 px, dashboard de 4–6 KPIs según ancho, tablas completas, drawer usuario ~360–440 px. |
| 768–1279 px | Sidebar colapsable, 2–3 KPIs por fila, filtros envueltos, tablas desplazables horizontalmente. |
| < 768 px | Header compacto, sidebar drawer con foco atrapado, 1 columna para formularios/KPIs, tarjetas/resumen para tablas densas. |

En móviles, la matriz de roles necesita vista por módulo expandible o desplazamiento horizontal con títulos de fila/columna persistentes; no reducir las casillas hasta volverlas inusables.

## 7. Accesibilidad y localización

- `lang="es-SV"` donde corresponda; fechas visuales `dd/mm/aaaa`, transporte API `YYYY-MM-DD`, zona horaria definida por el sistema (no crear desplazamientos por convertir fechas locales a UTC sin criterio).
- Navegación completa con teclado, iconos con etiqueta, foco visible, modales con retorno de foco, errores con `aria-describedby` y `aria-live` para cambios asíncronos.
- Al hacer click en «Ver», «Editar» o «…» debe quedar claro el registro afectado. Diálogo destructivo con nombre del recurso.
- Actividad y métricas usan **datos reales**; estados vacío/error en vez de cifras ficticias.

## 8. Imágenes y alcance de fidelidad

- `assets/01-dashboard-administracion.png` — referencia de layout, no inventario de datos.
- `assets/02-gestion-academica-cursos.png` — referencia de módulos/filtros/tabla; el número de páginas y cupos es ilustrativo.
- `assets/03-gestion-usuarios.png` — referencia de gestión y drawer. Validar si el alta institucional se hace por invitación o contraseña preexistente.
- `assets/04-roles-permisos.png` — referencia de diseño; una casilla azul en la imagen **no significa permiso concedido en producción**.

**Aceptación visual:** dashboard, cursos, usuarios y roles deben percibirse como partes del mismo sitio institucional. Antes de dar por terminado, comparar capturas reales de escritorio y móvil con las imágenes y documentar diferencias intencionales.
