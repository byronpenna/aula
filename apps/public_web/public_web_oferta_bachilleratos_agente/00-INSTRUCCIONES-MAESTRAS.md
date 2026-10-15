# Instrucciones maestras para el agente de programación

Trabaja **dentro del repositorio `public_web` existente** del Colegio Coronel Francisco Linares. Implementa una sección pública completa **«Oferta académica»** con un catálogo categorizado y páginas de detalle para **cinco** bachilleratos: Hostelería y Turismo, Idiomas, Diseño Gráfico, Comunicaciones y General.

## 0. Antes de modificar código: auditoría obligatoria

1. Lee `README`, manifiesto de dependencias, estructura de rutas, layout, componentes, estilos, assets y configuración de despliegue.
2. Localiza y reutiliza el **header**, **footer**, menú móvil, botones, contenedores, tarjetas, colores, tipografía, iconos y espaciados del sitio actual. Prioriza variables/tokens CSS y componentes compartidos. No inventes una identidad gráfica alternativa.
3. Identifica la arquitectura y el stack existentes (React/Vite, Next u otro); **no migres el proyecto ni agregues una librería de UI pesada** para implementar esta sección.
4. Revisa rutas existentes de admisiones, contacto y Aula Virtual; usa sus destinos reales para los CTA.
5. Inspecciona los assets aprobados del colegio (escudo, fotografías institucionales e imágenes con permiso). Si no hay fotos utilizables, emplea bloques ilustrativos coherentes y deja un punto de sustitución bien documentado; no uses fotos de estudiantes sin autorización.
6. Determina si el sitio consume contenido remoto. Si no lo hace, comienza con una fuente local **tipada y centralizada** a partir de `ejemplos/catalogo-bachilleratos.json`; no necesitas crear backend ni un CMS nuevo.
7. Ejecuta los tests/build existentes para documentar línea base antes de cambios. Mantén intactas otras páginas.

## 1. Construir la experiencia

- **Navegación:** agrega «Oferta académica» al menú principal y al footer siguiendo los patrones actuales. Si el menú existente es compacto, inclúyelo sin romper su diseño responsive.
- **Home:** integra una sección teaser de bachilleratos después de «Nuestra propuesta» o en otra ubicación natural del layout; titular, introducción breve, 3–5 tarjetas o carrusel accesible y botón «Explorar los bachilleratos». No dupliques toda la página catálogo en home.
- **Catálogo:** una página en una ruta coherente con el enrutador real, preferentemente `/oferta-academica`, con hero, breadcrumbs si el sitio ya los usa, título, introducción, búsqueda opcional y filtro por área de interés. Mostrar **cinco tarjetas completas**, sin apariencias de programas inexistentes.
- **Detalle:** cinco páginas o estados de detalle con URL profunda compartible, preferentemente `/oferta-academica/:slug`. Incluye hero propio, visión general, lo que aprenderás (solo propuesta si no se verificó oficialmente), áreas de interés, metodología y ejemplos de proyectos, orientación de continuidad educativa, preguntas frecuentes verificadas y CTA. Breadcrumb «Inicio > Oferta académica > [Programa]».
- **Conversión:** CTA primario «Solicitar información» y secundario «Volver a la oferta». El CTA abre la ruta/formulario/canal ya existente; si no hay canal confirmado, usa `/contacto` solo si existe o un enlace funcional a la sección de contacto actual. Puedes preseleccionar el programa si el formulario real admite parámetros, sin romper la URL existente.
- **Reutilización:** define un componente de tarjeta y una plantilla de detalle impulsada por datos. No crear cinco páginas con contenido duplicado.

## 2. Reglas de diseño no negociables

- Mantener armonía con el sitio publicado: **misma cabecera, footer, marca institucional, ancho de contenido, familia tipográfica, escala de títulos, tono y estilos de botón**.
- Los acentos visuales de cada programa deben ser **variaciones controladas** de la paleta y no cinco marcas distintas. Usa la tonalidad institucional como hilo conductor.
- Presentar fotos/ilustraciones relacionadas con cada especialidad, idealmente recursos propios, con texto alternativo pertinente. Aplicar overlays legibles en imágenes de hero.
- Tarjetas con jerarquía: imagen o ilustración > etiqueta temática > nombre > beneficio descriptivo > chips de intereses > «Conocer el programa». Estados hover, focus, loading/empty si corresponde.
- Diseño mobile-first: una columna en móvil, dos en tablet y hasta tres en escritorio según el grid real; filtros adaptados a pantallas pequeñas; CTA claramente visible; evitar tablas extensas.
- Respetar contraste WCAG AA, navegación por teclado, labels, encabezados semánticos y `prefers-reduced-motion`.

## 3. Fuente de verdad y publicaciones responsables

- Los cinco nombres son decisión editorial del solicitante, pero **no presupongas denominación oficial del MINEDUCYT**.
- Los textos proporcionados en `02-CONTENIDO-BACHILLERATOS.md` son propuestas de marketing educativo. La lista de módulos/proyectos debe indicarse como **«Áreas que podrías explorar»** o mantenerse en borrador hasta aprobación académica.
- No publicar duraciones, modalidades específicas, matrícula, cupos, becas, certificaciones, requisitos especiales, acreditaciones ni alianzas no verificadas.
- No añadir «Computación» como sexta opción; estaba en una conversación anterior pero no en esta lista final.
- Toda fecha se obtiene de la configuración/publicación existente, no se hardcodea «Admisiones abiertas» para un año desconocido.

## 4. Implementación segura

- No modificar el backend del Aula Virtual, la administración académica, autenticación ni base de datos a menos que ya exista integración indispensable y explícita.
- No eliminar ni reescribir páginas existentes; integrar nuevas rutas y componentes de manera aditiva.
- No introducir dependencias grandes por efectos visuales. Si la app ya usa animaciones, respeta su sistema; de lo contrario, CSS sutil es suficiente.
- Evita rutas y enlaces rotos, layouts shift, imágenes sin dimensiones, contenidos falsos y SEO duplicado.
- Después de implementar: build, lint, tests y revisión manual de las seis vistas clave: catálogo + cinco detalles. Incluye la portada/home y menú móvil.

## 5. Entrega requerida

Al finalizar informa: (a) archivos modificados; (b) rutas nuevas y enlaces agregados; (c) datos confirmados vs pendientes de aprobación; (d) comandos ejecutados y sus resultados; (e) capturas en escritorio y móvil **si el entorno permite generarlas**; (f) cualquier limitación real. Prioriza una versión funcional completa frente a una presentación solo visual.

Continúa con los documentos 01–04 y el JSON de ejemplo. **Antes de programar, presenta un plan corto basado en la inspección real del repositorio.**
