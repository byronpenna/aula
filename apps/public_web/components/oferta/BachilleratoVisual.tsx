import type { ComponentType } from "react";
import type { AreaInteres } from "@/lib/bachilleratos";
import { CapIcon, ChatIcon, MicIcon, NavigationIcon, PaletteIcon } from "@/components/icons";

// Sin fotografías por especialidad (todavía no hay material institucional
// aprobado por programa, sección "Restricciones editoriales" del paquete del
// agente): bloque gráfico ilustrativo en variaciones controladas de la marca,
// listo para sustituirse por fotografía real cuando el colegio la apruebe.
const AREA_ICON: Record<AreaInteres, ComponentType<{ className?: string }>> = {
  "turismo-y-servicio": NavigationIcon,
  "lenguas-y-cultura": ChatIcon,
  "creatividad-visual": PaletteIcon,
  "medios-y-expresion": MicIcon,
  "formacion-integral": CapIcon,
};

const AREA_GRADIENT: Record<AreaInteres, string> = {
  "turismo-y-servicio": "from-brand-600 to-brand-800",
  "lenguas-y-cultura": "from-brand-700 to-accent-500",
  "creatividad-visual": "from-brand-800 to-brand-600",
  "medios-y-expresion": "from-brand-900 to-brand-700",
  "formacion-integral": "from-brand-700 to-brand-900",
};

export function BachilleratoVisual({
  area,
  variant = "card",
  className = "",
}: {
  area: AreaInteres;
  variant?: "card" | "hero";
  className?: string;
}) {
  const Icon = AREA_ICON[area];
  return (
    <div
      role="img"
      aria-label="Gráfico ilustrativo del programa (imagen provisional, pendiente de fotografía institucional)"
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${AREA_GRADIENT[area]} ${
        variant === "hero" ? "aspect-[16/10] rounded-3xl" : "aspect-[4/3] rounded-2xl"
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10 blur-2xl"
      />
      <Icon
        className={`relative text-white/90 ${variant === "hero" ? "h-16 w-16" : "h-10 w-10"}`}
      />
    </div>
  );
}
