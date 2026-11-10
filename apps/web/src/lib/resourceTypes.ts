// Catálogo de tipos de recurso de curso: espejo en el frontend de
// `ALLOWED_CONTENT_TYPES` (apps/api/app/modules/files/service.py) — mismo
// conjunto de content-types aceptados, aquí solo para clasificar/filtrar/
// mostrar un badge, nunca para validar (el backend sigue siendo la única
// fuente de verdad sobre qué se acepta).
export interface ResourceType {
  key: string;
  label: string;
  contentTypes: string[];
  badgeClass: string;
}

export const RESOURCE_TYPES: ResourceType[] = [
  {
    key: "pdf",
    label: "PDF",
    contentTypes: ["application/pdf"],
    badgeClass: "bg-red-50 text-red-700 ring-red-200",
  },
  {
    key: "word",
    label: "Word",
    contentTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    badgeClass: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  {
    key: "excel",
    label: "Excel",
    contentTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  {
    key: "powerpoint",
    label: "PowerPoint",
    contentTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    badgeClass: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  {
    key: "image",
    label: "Imagen",
    contentTypes: ["image/png", "image/jpeg", "image/webp"],
    badgeClass: "bg-purple-50 text-purple-700 ring-purple-200",
  },
  {
    key: "text",
    label: "Texto",
    contentTypes: ["text/plain"],
    badgeClass: "bg-slate-100 text-slate-600 ring-slate-200",
  },
];

// Comodín para cualquier content-type que el backend llegue a aceptar más
// adelante y que este catálogo todavía no liste explícitamente — nunca bloquea
// la vista, solo cae en una etiqueta genérica.
const OTHER_TYPE: ResourceType = {
  key: "other",
  label: "Otro",
  contentTypes: [],
  badgeClass: "bg-brand-50 text-brand-700 ring-brand-200",
};

export function getResourceType(contentType: string): ResourceType {
  return RESOURCE_TYPES.find((type) => type.contentTypes.includes(contentType)) ?? OTHER_TYPE;
}

// Para los filtros de la pestaña "Recursos": incluye "Otro" al final para que
// un tipo no listado también sea filtrable.
export const RESOURCE_TYPE_FILTERS: ResourceType[] = [...RESOURCE_TYPES, OTHER_TYPE];

// Para el atributo `accept` del selector de archivos: todos los content-types
// reconocidos, en el mismo orden que el catálogo.
export const RESOURCE_UPLOAD_ACCEPT = RESOURCE_TYPES.flatMap((type) => type.contentTypes).join(",");
