import { DEMO_USERS } from "../support/commands";

// LoginPage.tsx (modo local, VITE_AUTH_MODE != "cognito"): adaptador temporal
// contra /auth/local/token. No usa cy.loginAs aquí a propósito — el login por UI
// es la funcionalidad bajo prueba, no un atajo de setup.
describe("Login local", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  it("muestra el formulario de ingreso local, no el panel de Cognito", () => {
    cy.contains("h1", "Aula Virtual").should("be.visible");
    cy.get("#username").should("be.visible");
    cy.get("#password").should("be.visible");
    cy.contains("button", "Ingresar").should("be.visible");
  });

  it("valida campos vacíos antes de llamar a la API", () => {
    cy.intercept("POST", "**/auth/local/token").as("login");
    cy.contains("button", "Ingresar").click();
    cy.contains("Ingresa tu usuario.").should("be.visible");
    cy.contains("Ingresa tu contraseña.").should("be.visible");
    cy.get("@login.all").should("have.length", 0);
  });

  it("rechaza credenciales inválidas con el mensaje real del backend", () => {
    cy.get("#username").type(DEMO_USERS.admin.username);
    cy.get("#password").type("contraseña-incorrecta");
    cy.contains("button", "Ingresar").click();
    cy.contains('[role="alert"]', "Usuario o contraseña incorrectos.").should("be.visible");
    cy.location("pathname").should("eq", "/login");
  });

  (Object.keys(DEMO_USERS) as (keyof typeof DEMO_USERS)[]).forEach((role) => {
    const user = DEMO_USERS[role];
    it(`permite iniciar sesión como ${role} (${user.username}) y lleva a Inicio`, () => {
      cy.get("#username").type(user.username);
      cy.get("#password").type(user.password);
      cy.contains("button", "Ingresar").click();
      cy.location("pathname").should("eq", "/");
      cy.contains("h1", `Hola, ${user.displayName}`).should("be.visible");
    });
  });

  it("permite cerrar sesión y vuelve a exigir login en una ruta protegida", () => {
    cy.get("#username").type(DEMO_USERS.admin.username);
    cy.get("#password").type(DEMO_USERS.admin.password);
    cy.contains("button", "Ingresar").click();
    cy.contains("button", "Salir").click();
    cy.location("pathname").should("eq", "/login");
    cy.visit("/courses");
    cy.location("pathname").should("eq", "/login");
  });
});
