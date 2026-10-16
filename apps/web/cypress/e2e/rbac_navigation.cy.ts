// AppShell.tsx muestra enlaces de navegación según el rol activo (sección 10: "un
// profesor no puede ver administración y un alumno no puede nada más que subir
// trabajos de los cursos en los que está inscrito"). El backend igual exige el
// permiso en cada endpoint (rbac_navigation solo prueba la UI; admin_access_control
// prueba que el servidor también lo bloquea si alguien fuerza la URL).
describe("Navegación según rol", () => {
  it("el administrador ve Administración y no ve Mis hijos", () => {
    cy.loginAs("admin");
    cy.visit("/");
    cy.contains("nav a", "Administración").should("be.visible");
    cy.contains("nav a", "Mis hijos").should("not.exist");
  });

  it("el docente no ve Administración ni Mis hijos", () => {
    cy.loginAs("teacher");
    cy.visit("/");
    cy.contains("nav a", "Administración").should("not.exist");
    cy.contains("nav a", "Mis hijos").should("not.exist");
    cy.contains("nav a", "Cursos").should("be.visible");
  });

  it("el alumno no ve Administración ni Mis hijos", () => {
    cy.loginAs("student");
    cy.visit("/");
    cy.contains("nav a", "Administración").should("not.exist");
    cy.contains("nav a", "Mis hijos").should("not.exist");
  });

  it("el tutor ve Mis hijos y no ve Administración", () => {
    cy.loginAs("guardian");
    cy.visit("/");
    cy.contains("nav a", "Mis hijos").should("be.visible");
    cy.contains("nav a", "Administración").should("not.exist");
  });

  it("cada usuario ve su propio nombre y rol en la cabecera", () => {
    cy.loginAs("teacher");
    cy.visit("/");
    cy.contains("header", "Docente Demo").should("be.visible");
    cy.contains("header", "teacher").should("be.visible");
  });
});
