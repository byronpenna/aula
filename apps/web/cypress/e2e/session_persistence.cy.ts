import { DEMO_USERS } from "../support/commands";

// Regresión del bug corregido con lib/session.ts (zustand + sessionStorage): antes
// de ese fix, recargar la página perdía la sesión porque el token solo vivía en
// memoria. Aquí se prueba el síntoma real (recargar sigue autenticado), no la
// implementación interna.
describe("Persistencia de sesión al recargar", () => {
  it("sigue autenticado tras recargar la página", () => {
    cy.loginAs("admin");
    cy.visit("/");
    cy.contains("h1", `Hola, ${DEMO_USERS.admin.displayName}`).should("be.visible");

    cy.reload();

    cy.contains("h1", `Hola, ${DEMO_USERS.admin.displayName}`).should("be.visible");
    cy.location("pathname").should("eq", "/");
  });

  it("conserva la sesión al navegar entre rutas protegidas sin volver a pedir login", () => {
    cy.loginAs("teacher");
    cy.visit("/");
    cy.contains("a", "Cursos").click();
    cy.location("pathname").should("eq", "/courses");
    cy.reload();
    cy.location("pathname").should("eq", "/courses");
    cy.contains("h1", "Cursos").should("be.visible");
  });

  it("sin sesión, una ruta protegida redirige a /login", () => {
    cy.visit("/courses");
    cy.location("pathname").should("eq", "/login");
  });
});
