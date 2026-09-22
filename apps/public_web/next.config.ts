import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Export estático (sección 5 / ADR 0002): igual que apps/web, este sitio se
  // despliega a Amplify Hosting con un deploy manual (zip del build subido vía
  // create-deployment), no con el hosting SSR/compute de Amplify para Next.js.
  // La página no tiene rutas dinámicas ni lógica de servidor, así que un build
  // estático a `out/` es suficiente y evita esa complejidad.
  output: "export",
  images: {
    // La optimización de next/image requiere el servidor de imágenes de Next,
    // no disponible en un export estático; las imágenes ya están servidas tal
    // cual desde public/img.
    unoptimized: true,
  },
};

export default nextConfig;
