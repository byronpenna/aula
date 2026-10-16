import { defineConfig } from "cypress";

// E2E contra el stack local (docker compose up -d + npm run dev, sección 19).
// Requiere `python scripts/seed.py` corrido al menos una vez: todos los specs usan
// los usuarios demo que crea (admin.demo/docente.demo/alumno.demo/tutor.demo,
// contraseña "aula-local-dev") en vez de datos inventados, porque son idempotentes
// y ya existen en cualquier entorno local de este proyecto.
export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
  },
});
