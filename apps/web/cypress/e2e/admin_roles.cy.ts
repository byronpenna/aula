// AdminRolesPage.tsx: matriz de permisos por rol con control de concurrencia
// optimista (version/expected_version) y el guardado de que school_admin nunca
// se quede sin poder administrar usuarios/roles (identity/service.py::
// update_role_permissions).
describe("Administración > Roles y permisos", () => {
  beforeEach(() => {
    cy.loginAs("admin");
    cy.visit("/admin/roles");
  });

  it("lista los roles del sistema y muestra sus usuarios asignados", () => {
    cy.contains("nav button", "Teacher").should("be.visible");
    cy.contains("nav button", "Teacher").click();
    cy.contains("h2", "Teacher").should("be.visible");
    cy.contains("Rol del sistema (código fijo)").should("be.visible");
    cy.contains("h2", "Usuarios con este rol").parent().should("contain.text", "Docente Demo");
  });

  it("quita y vuelve a otorgar un permiso al rol docente, y persiste tras recargar", () => {
    cy.intercept("PUT", "**/roles/*/permissions").as("savePermissions");

    cy.contains("nav button", "Teacher").click();
    cy.contains("label", "Registrar y editar asistencia").find('input[type="checkbox"]').uncheck();
    cy.contains("button", "Guardar permisos").click();
    cy.wait("@savePermissions").its("response.statusCode").should("eq", 200);

    cy.reload();
    cy.contains("nav button", "Teacher").click();
    cy.contains("label", "Registrar y editar asistencia")
      .find('input[type="checkbox"]')
      .should("not.be.checked");

    // Restaura el estado original para no afectar otras corridas de la suite.
    cy.contains("label", "Registrar y editar asistencia").find('input[type="checkbox"]').check();
    cy.contains("button", "Guardar permisos").click();
    cy.wait("@savePermissions").its("response.statusCode").should("eq", 200);
    cy.reload();
    cy.contains("nav button", "Teacher").click();
    cy.contains("label", "Registrar y editar asistencia")
      .find('input[type="checkbox"]')
      .should("be.checked");
  });

  it("no permite quitarle a school_admin el permiso de administrar usuarios", () => {
    cy.intercept("PUT", "**/roles/*/permissions").as("savePermissions");

    cy.contains("nav button", "School Admin").click();
    cy.contains("label", "Invitar, desactivar y administrar usuarios del colegio")
      .find('input[type="checkbox"]')
      .uncheck();
    cy.contains("button", "Guardar permisos").click();
    cy.wait("@savePermissions").its("response.statusCode").should("eq", 422);
    cy.contains("dejaría al colegio sin nadie que pueda revertirlo").should("be.visible");

    cy.reload();
    cy.contains("nav button", "School Admin").click();
    cy.contains("label", "Invitar, desactivar y administrar usuarios del colegio")
      .find('input[type="checkbox"]')
      .should("be.checked");
  });
});
