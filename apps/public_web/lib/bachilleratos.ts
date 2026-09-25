// Fuente única de datos de la oferta académica (sección 7 del paquete del agente:
// "public_web_oferta_bachilleratos_agente"). Contenido editorial ilustrativo —
// pendiente de revisión y aprobación por la dirección académica del colegio antes
// de tratarse como malla oficial. No agregar un sexto programa (p. ej. Computación)
// sin instrucción explícita.

export type AreaInteres =
  | "turismo-y-servicio"
  | "lenguas-y-cultura"
  | "creatividad-visual"
  | "medios-y-expresion"
  | "formacion-integral";

export interface Bachillerato {
  slug: string;
  titulo: string;
  area: AreaInteres;
  etiquetaArea: string;
  gancho: string;
  resumen: string;
  intereses: string[];
  areasExplorar: string[];
  ejemplosProyectos: string[];
  continuidad: string[];
  seo: { title: string; description: string };
}

export const AREAS: { value: AreaInteres; label: string }[] = [
  { value: "turismo-y-servicio", label: "Turismo y servicio" },
  { value: "lenguas-y-cultura", label: "Lenguas y cultura" },
  { value: "creatividad-visual", label: "Creatividad visual" },
  { value: "medios-y-expresion", label: "Medios y expresión" },
  { value: "formacion-integral", label: "Formación integral" },
];

export const BACHILLERATOS: Bachillerato[] = [
  {
    slug: "hosteleria-y-turismo",
    titulo: "Hostelería y Turismo",
    area: "turismo-y-servicio",
    etiquetaArea: "Turismo y servicio",
    gancho: "Convierte la hospitalidad y el descubrimiento en experiencias memorables.",
    resumen:
      "Explora el mundo de la atención al visitante, la organización de experiencias y el patrimonio turístico. Desarrolla habilidades de comunicación, servicio, planificación y trabajo en equipo.",
    intereses: ["Atención al público", "Viajes y cultura", "Organización de eventos"],
    areasExplorar: [
      "Hospitalidad y atención",
      "Patrimonio local",
      "Comunicación con visitantes",
      "Organización de actividades",
      "Sostenibilidad turística",
      "Herramientas digitales del sector",
    ],
    ejemplosProyectos: [
      "Diseñar una ruta cultural local",
      "Simular la gestión de una actividad escolar",
      "Preparar una guía digital de destinos",
    ],
    continuidad: ["Turismo", "Hotelería", "Administración", "Gestión de servicios"],
    seo: {
      title: "Hostelería y Turismo | Oferta académica | Colegio Coronel Francisco Linares",
      description:
        "Conoce nuestra propuesta de bachillerato en Hostelería y Turismo. Explora áreas de interés, proyectos ilustrativos y cómo solicitar información.",
    },
  },
  {
    slug: "idiomas",
    titulo: "Idiomas",
    area: "lenguas-y-cultura",
    etiquetaArea: "Lenguas y cultura",
    gancho: "Abre nuevas conversaciones y conecta con otras culturas.",
    resumen:
      "Fortalece tu expresión oral y escrita, la escucha y la comunicación intercultural mientras exploras nuevas formas de aprender y utilizar otras lenguas.",
    intereses: ["Comunicación", "Culturas del mundo", "Lectura y conversación"],
    areasExplorar: [
      "Expresión oral",
      "Comprensión auditiva",
      "Escritura",
      "Comunicación intercultural",
      "Recursos digitales para el aprendizaje",
      "Presentaciones en otro idioma",
    ],
    ejemplosProyectos: [
      "Crear un pódcast bilingüe",
      "Organizar una feria cultural",
      "Elaborar una guía de conversación para visitantes",
    ],
    continuidad: ["Idiomas", "Traducción", "Docencia", "Comunicación"],
    seo: {
      title: "Idiomas | Oferta académica | Colegio Coronel Francisco Linares",
      description:
        "Conoce nuestra propuesta de bachillerato en Idiomas. Explora áreas de interés, proyectos ilustrativos y cómo solicitar información.",
    },
  },
  {
    slug: "diseno-grafico",
    titulo: "Diseño Gráfico",
    area: "creatividad-visual",
    etiquetaArea: "Creatividad visual",
    gancho: "Dale forma a tus ideas y aprende a comunicar con imágenes.",
    resumen:
      "Descubre los fundamentos de la comunicación visual y desarrolla criterio creativo para construir piezas gráficas, explorar herramientas digitales y presentar propuestas de diseño.",
    intereses: ["Ilustración", "Fotografía", "Identidad visual"],
    areasExplorar: [
      "Teoría del color",
      "Composición",
      "Tipografía",
      "Diseño editorial",
      "Identidad visual",
      "Herramientas de producción digital",
    ],
    ejemplosProyectos: [
      "Diseñar la identidad gráfica de un evento escolar",
      "Crear la portada de una revista",
      "Proponer una campaña visual para una causa comunitaria",
    ],
    continuidad: ["Diseño", "Comunicación visual", "Animación", "Áreas creativas afines"],
    seo: {
      title: "Diseño Gráfico | Oferta académica | Colegio Coronel Francisco Linares",
      description:
        "Conoce nuestra propuesta de bachillerato en Diseño Gráfico. Explora áreas de interés, proyectos ilustrativos y cómo solicitar información.",
    },
  },
  {
    slug: "comunicaciones",
    titulo: "Comunicaciones",
    area: "medios-y-expresion",
    etiquetaArea: "Medios y expresión",
    gancho: "Descubre cómo contar historias que informan y conectan.",
    resumen:
      "Explora la escritura, la expresión oral, los medios audiovisuales y las plataformas digitales para comunicar ideas con creatividad, rigor y responsabilidad.",
    intereses: ["Escritura", "Fotografía y video", "Medios digitales"],
    areasExplorar: [
      "Redacción",
      "Guion",
      "Comunicación oral",
      "Narrativas audiovisuales",
      "Medios digitales",
      "Ética informativa",
    ],
    ejemplosProyectos: [
      "Producir un boletín escolar",
      "Crear una serie corta de entrevistas",
      "Elaborar un pódcast sobre la comunidad educativa",
    ],
    continuidad: ["Comunicación", "Periodismo", "Publicidad", "Producción audiovisual"],
    seo: {
      title: "Comunicaciones | Oferta académica | Colegio Coronel Francisco Linares",
      description:
        "Conoce nuestra propuesta de bachillerato en Comunicaciones. Explora áreas de interés, proyectos ilustrativos y cómo solicitar información.",
    },
  },
  {
    slug: "general",
    titulo: "General",
    area: "formacion-integral",
    etiquetaArea: "Formación integral",
    gancho: "Fortalece tus conocimientos y mantén abiertas nuevas posibilidades.",
    resumen:
      "Desarrolla una base académica amplia que integra pensamiento crítico, comunicación, ciencias, matemáticas y habilidades para continuar tu formación en distintas áreas.",
    intereses: ["Ciencias y humanidades", "Exploración académica", "Razonamiento y análisis"],
    areasExplorar: [
      "Matemáticas",
      "Ciencias",
      "Lenguaje y literatura",
      "Estudios sociales",
      "Competencias digitales",
      "Proyectos interdisciplinarios",
    ],
    ejemplosProyectos: [
      "Organizar una feria de investigación",
      "Desarrollar un proyecto de participación comunitaria",
      "Preparar una exposición interdisciplinaria",
    ],
    continuidad: ["Diversas áreas de estudios superiores, según requisitos de ingreso"],
    seo: {
      title: "General | Oferta académica | Colegio Coronel Francisco Linares",
      description:
        "Conoce nuestra propuesta de bachillerato General. Explora áreas de interés, proyectos ilustrativos y cómo solicitar información.",
    },
  },
];

export function getBachilleratoBySlug(slug: string): Bachillerato | undefined {
  return BACHILLERATOS.find((b) => b.slug === slug);
}

export function getRelatedBachilleratos(slug: string, limit = 3): Bachillerato[] {
  return BACHILLERATOS.filter((b) => b.slug !== slug).slice(0, limit);
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function searchBachilleratos(items: Bachillerato[], query: string): Bachillerato[] {
  const q = normalize(query.trim());
  if (!q) return items;
  return items.filter((b) => {
    const haystack = normalize([b.titulo, b.resumen, ...b.intereses].join(" "));
    return haystack.includes(q);
  });
}
