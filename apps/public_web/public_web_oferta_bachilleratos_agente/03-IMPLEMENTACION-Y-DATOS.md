# Implementación técnica y fuente de datos

## Principio técnico

No conocemos el stack, el árbol de archivos ni la nomenclatura interna del repositorio `public_web`. El agente debe inspeccionarlos y adaptar los ejemplos a su realidad. Las rutas y nombres siguientes representan responsabilidades, **no una migración ni una estructura obligatoria**.

## 1. Modelo sugerido

```ts
type AreaInteres =
  | 'turismo-y-servicio'
  | 'lenguas-y-cultura'
  | 'creatividad-visual'
  | 'medios-y-expresion'
  | 'formacion-integral';

type Bachillerato = {
  id: string;
  slug: string;
  titulo: string;
  area: AreaInteres;
  etiquetaArea: string;
  gancho: string;
  resumen: string;
  imagen?: { src: string; alt: string; position?: string };
  intereses: string[];
  areasExplorar: string[]; // propuestas editoriales, no asignaturas oficiales
  ejemplosProyectos: string[]; // expresamente hipotéticos
  continuidad: string[];
  seo: { title: string; description: string };
  oficial?: {
    denominacion?: string;
    duracion?: string;
    modalidad?: string;
    documentoPlan?: string;
    verificadoPor?: string;
    fechaVerificacion?: string;
  };
};
```

Usar `ejemplos/catalogo-bachilleratos.json` como **semilla**, convertir al tipo real y definir validación mínima (slugs únicos; exactamente cinco fichas iniciales; imagen con `alt`; arreglos no vacíos; `oficial` solo cuando existan pruebas verificables). Separar `contenidoEditorial` de `datosOficiales` si el proyecto ya tiene CMS o estándares propios.

## 2. Componentes propuestos

```text
ExistingPublicLayout (REUTILIZAR)
├── ExistingHeader (extender navegación)
├── Home
│   └── OfertaAcademicaPreview
├── OfertaAcademicaIndex
│   ├── OfertaHero
│   ├── AreaFilters
│   ├── SearchInput [opcional]
│   ├── BachilleratoGrid
│   │   └── BachilleratoCard × 5
│   └── AdmissionsCTA
├── BachilleratoDetail (plantilla, slug dinámico)
│   ├── Breadcrumb
│   ├── DetailHero
│   ├── OverviewSection
│   ├── ExploreAreasGrid
│   ├── ExampleProjects
│   ├── InterestsSection
│   ├── FurtherStudiesSection
│   ├── VerifiedFacts [condicional]
│   ├── VerifiedFaq [condicional]
│   └── RelatedPrograms + AdmissionsCTA
└── ExistingFooter (añadir enlace)
```

Reutilizar componentes ya presentes que cubran estas funciones; **no crear duplicados innecesarios**.

## 3. Enrutamiento

- Índice: `/oferta-academica`.
- Detalles: `/oferta-academica/hosteleria-y-turismo`, `/idiomas`, `/diseno-grafico`, `/comunicaciones`, `/general`.
- URL inexistente: 404 real (SSR) o vista Not Found compatible con la SPA. No mostrar una ficha vacía.
- Deep links: comprobar al refrescar directamente cualquier URL en el hosting existente de Amplify.
- Menú y footer: misma ruta canónica, sin enlaces rotos.
- CTA: reutiliza enlace real de admisiones/contacto. Si se implementa `?programa=slug`, comprobar que el formulario receptor acepta el parámetro; nunca transmitir datos de menores o sensibles en URL.

## 4. Filtros / búsqueda

- `Todos` seleccionada por defecto.
- Filtro de una única área cada vez, con el nombre editorial amigable y contador; mostrar todos al limpiar.
- Búsqueda opcional por título, resumen e intereses normalizados (sin tildes, minúsculas).
- Cambiar filtro sin navegación completa. El estado vacío guía a restablecer filtros; `aria-live="polite"` anuncia el número de resultados.
- Con cinco opciones, evitar librerías de búsqueda, filtros múltiples complejos o paginación innecesaria.

## 5. Imágenes

Las referencias visuales son ideas de composición, no imágenes que deban descargarse sin derechos. Prioridad: (1) fotos institucionales aprobadas; (2) imágenes ya licenciadas en el repositorio; (3) ilustraciones originales realizadas para el colegio; (4) placeholder editorial consistente. Establecer proporciones del hero y tarjetas; `loading="lazy"` salvo hero/LCP, compresión moderna y variantes responsive si la infraestructura lo permite. Documentar el responsable de sustituir las imágenes provisionales.

## 6. SEO y contenido compartible

- Un H1 por página, `title` único y `meta description` descriptiva por bachillerato.
- `canonical`, Open Graph y Twitter Card reutilizando utilidades SEO existentes; las imágenes sociales deben ser del colegio o genéricas debidamente licenciadas.
- Breadcrumbs semánticos; JSON-LD `BreadcrumbList` solo si ya se utiliza SEO estructurado y las URLs son reales. No introducir `Course`, `EducationalOccupationalProgram`, duración o credenciales no verificadas.
- No indexar contenido editorial incompleto marcado `draft` si el proyecto tiene workflow de publicación; alternativamente lanzar solo texto aprobado.
- En SPA puras, revisar si el proyecto resuelve metadatos de cada ruta al compartir enlaces; si no, implementar una solución compatible con su stack sin rehacer toda la aplicación.

## 7. Integración y seguridad

- El catálogo inicial puede ser **estático**, con tipado local y sin endpoint. No pedir autenticación para verlo.
- Evitar crear nuevos formularios de captación que almacenen datos personales sin arquitectura, consentimiento, validación y política de privacidad existentes.
- Sanitizar contenido enriquecido si se obtiene en el futuro de un CMS; no interpolar HTML sin control.
- No tocar el Aula Virtual, roles, sesiones, panel administrativo ni tablas académicas para implementar la oferta pública.
- Si el agente encuentra una entidad existente `programs`/`academic-offering`, puede mapearla solo si sus datos están aprobados y mantiene compatibilidad; registrar los supuestos antes de hacerlo.

## 8. Guía de archivos (ajustar al proyecto real)

```text
src/
  content/bachilleratos.[ts|js|json]     # fuente de datos única
  components/oferta/
    BachilleratoCard.*
    AreaFilters.*
    OfertaPreview.*
    BachilleratoDetailTemplate.*
  pages/oferta-academica.*               # o rutas del framework
  pages/oferta-academica/[slug].*        # si el stack usa rutas por archivos
```

Los componentes y estilos deben cumplir las convenciones del repositorio (CSS Modules, Tailwind, SCSS, etc.) y consumir los tokens existentes, no imponer otra librería de estilos.
