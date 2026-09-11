/**
 * Referencia del flujo E2E objetivo (sección 19, punto 12): docente crea/publica
 * tarea, alumno entrega, tutor consulta. Requiere Playwright instalado y la app
 * corriendo (`make dev`) — ver tests/e2e/README.md. No se ejecuta en CI todavía.
 */
// import { test, expect } from "@playwright/test";
//
// test("docente -> tarea -> alumno -> entrega -> consulta de padre", async ({ page }) => {
//   await page.goto("/login");
//   await page.getByLabel("Usuario").fill("docente.demo");
//   await page.getByLabel("Contraseña").fill("aula-local-dev");
//   await page.getByRole("button", { name: "Ingresar" }).click();
//   // ... publicar tarea, cerrar sesión, entrar como alumno.demo, entregar,
//   // cerrar sesión, entrar como tutor.demo y verificar que ve la entrega.
// });

export {};
