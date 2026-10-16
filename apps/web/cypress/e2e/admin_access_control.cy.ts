// El servidor, no solo la navegación, es quien decide el acceso (AdminLayout.tsx:
// "el backend vuelve a exigir el permiso en cada endpoint; esto es solo para no
// ofrecer una puerta que el propio servidor va a cerrar"). Aquí se fuerza la URL
// directamente (sin pasar por los enlaces que rbac_navigation.cy.ts ya probó que
// están ocultos) para confirmar que el 403 real del backend se refleja como
// ForbiddenState, no solo que el enlace no se muestra.
describe("Control de acceso del área de administración", () => {
  it("el administrador entra al dashboard y a cada módulo", () => {
    cy.loginAs("admin");
    cy.visit("/admin");
    cy.contains("h1", "Administración").should("be.visible");
    cy.contains('[role="alert"]', "Acceso no autorizado").should("not.exist");

    cy.visit("/admin/academics");
    cy.contains("h1", "Academia").should("be.visible");

    cy.visit("/admin/users");
    cy.contains("h1", "Usuarios").should("be.visible");

    cy.visit("/admin/roles");
    cy.contains("h1", "Roles y permisos").should("be.visible");
  });

  it("un docente que fuerza /admin recibe Acceso no autorizado del servidor", () => {
    cy.loginAs("teacher");
    cy.visit("/admin");
    cy.contains('[role="alert"]', "Acceso no autorizado").should("be.visible");
  });

  it("un alumno que fuerza /admin/users y /admin/roles recibe Acceso no autorizado", () => {
    cy.loginAs("student");
    cy.visit("/admin/users");
    cy.contains('[role="alert"]', "Acceso no autorizado").should("be.visible");
    cy.visit("/admin/roles");
    cy.contains('[role="alert"]', "Acceso no autorizado").should("be.visible");
  });

  it("un tutor que fuerza /admin/academics recibe Acceso no autorizado", () => {
    cy.loginAs("guardian");
    cy.visit("/admin/academics");
    cy.contains('[role="alert"]', "Acceso no autorizado").should("be.visible");
  });
});
