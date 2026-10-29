// Paleta fija de colores de resaltado — debe coincidir con
// books/service.py::ANNOTATION_COLORS en el backend.
export const HIGHLIGHT_COLORS = [
  { key: "yellow", label: "Amarillo", swatchClass: "bg-yellow-300", overlayRgba: "rgba(253, 224, 71, 0.45)" },
  { key: "green", label: "Verde", swatchClass: "bg-emerald-300", overlayRgba: "rgba(110, 231, 183, 0.45)" },
  { key: "blue", label: "Azul", swatchClass: "bg-sky-300", overlayRgba: "rgba(125, 211, 252, 0.45)" },
  { key: "pink", label: "Rosa", swatchClass: "bg-pink-300", overlayRgba: "rgba(249, 168, 212, 0.45)" },
] as const;

export type HighlightColorKey = (typeof HIGHLIGHT_COLORS)[number]["key"];

export function highlightOverlayColor(color: string | null): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === color)?.overlayRgba ?? "rgba(253, 224, 71, 0.45)";
}
