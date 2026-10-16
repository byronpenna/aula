// AdminUsersPage.tsx: alta de usuario (contraseña generada y editable, igual
// política que Cognito), activar/desactivar, asignar/revocar roles, y el
// guardado del "último administrador" (identity/service.py::_guard_last_admin)
// que impide dejar al colegio sin nadie que pueda administrar usuarios/roles.
describe("Administración > Usuarios", () => {
  beforeEach(() => {
    cy.loginAs("admin");
    cy.visit("/admin/users");
  });

  it("crea un usuario docente con la contraseña generada y lo ve en el listado", () => {
    const suffix = Date.now();
    const username = `e2e.docente.${suffix}`;

    cy.contains("button", "Nuevo usuario").click();
    cy.get('[name="display_name"]').type("Docente E2E");
    cy.get('[name="username"]').type(username);
    cy.get('[name="role_code"]').select("Teacher");

    cy.get('[name="password"]')
      .invoke("val")
      .then((value) => expect(String(value)).to.have.length.at.least(12));

    cy.contains("button", "Crear").click();

    cy.contains("No hay servicio de correo configurado para este ambiente").should("be.visible");
    cy.contains("tr", username).should("be.visible").and("contain.text", "teacher");
  });

  it("alterna el estado de un usuario existente y lo deja como estaba", () => {
    // No asume que docente.demo empiece "Activo": corridas previas de esta misma
    // suite (u otra persona probando en el mismo entorno local) pudieron dejarlo
    // desactivado. Se detecta el estado real y se hace un ciclo completo de ida y
    // vuelta, así el resultado final siempre repone el estado inicial.
    // UserRow reusa StatusBadge con el mismo mapeo que Academia (archived ->
    // "Archivado"): una membresía inactiva no tiene su propia etiqueta aparte.
    cy.contains("tr", "docente.demo").then(($row) => {
      const startsActive = $row.text().includes("Activo");
      const [firstAction, firstLabel] = startsActive
        ? ["Desactivar", "Archivado"]
        : ["Activar", "Activo"];
      const [secondAction, secondLabel] = startsActive
        ? ["Activar", "Activo"]
        : ["Desactivar", "Archivado"];

      cy.contains("tr", "docente.demo").find("button").contains(firstAction).click();
      cy.contains("tr", "docente.demo").should("contain.text", firstLabel);
      cy.contains("tr", "docente.demo").find("button").contains(secondAction).click();
      cy.contains("tr", "docente.demo").should("contain.text", secondLabel);
    });
  });

  it("asigna y revoca un rol adicional a un usuario", () => {
    cy.contains("tr", "docente.demo").within(() => {
      cy.get("select").select("Coordinator");
      cy.contains("button", "Agregar").click();
    });
    cy.contains("tr", "docente.demo").should("contain.text", "coordinator");

    cy.contains("tr", "docente.demo").within(() => {
      cy.contains("span", "coordinator").find('button[aria-label="Quitar rol coordinator"]').click();
    });
    cy.contains("tr", "docente.demo").should("not.contain.text", "coordinator");
  });

  it("no permite desactivar al último administrador", () => {
    cy.contains("tr", "admin.demo").find("button").contains("Desactivar").click();
    cy.contains("No se pudo completar la operación").should("be.visible");
    cy.contains("dejaría al colegio sin nadie").should("be.visible");
    cy.contains("tr", "admin.demo").should("contain.text", "Activo");
  });

  it("filtra usuarios por segmento y por búsqueda", () => {
    cy.contains("button", "Docentes").click();
    cy.contains("tr", "docente.demo").should("be.visible");
    cy.contains("tr", "alumno.demo").should("not.exist");

    cy.contains("button", "Todos").click();
    cy.get('input[placeholder="Buscar por nombre o correo…"]').type("Alumno Demo");
    cy.contains("tr", "alumno.demo").should("be.visible");
    cy.contains("tr", "docente.demo").should("not.exist");
  });
});
