// FileAttachments.tsx: mismo componente para material de la tarea, entrega propia
// y entregas vistas por docente/tutor — cada caller decide si puede subir
// (uploadUrl) o es solo lectura. Se prueba contra el almacenamiento real
// (apps/api/local_storage en dev local), no un mock.
describe("Archivos adjuntos", () => {
  it("el docente sube material a la tarea y queda listado", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.contains("a", "Curso ").click();
    cy.contains("a", "Tarea de práctica: fracciones").click();

    cy.contains("h2", "Material adjunto")
      .parent()
      .find('input[type="file"]')
      .selectFile("cypress/fixtures/material-tarea.txt", { force: true });

    cy.contains("h2", "Material adjunto")
      .parent()
      .contains("button", "material-tarea.txt")
      .should("be.visible");
  });

  it("el alumno ve el material pero no puede subir material de la tarea (solo su propia entrega)", () => {
    cy.loginAs("student");
    cy.visit("/courses");
    cy.contains("a", "Curso ").click();
    cy.contains("a", "Tarea de práctica: fracciones").click();

    cy.contains("h2", "Material adjunto").parent().find('input[type="file"]').should("not.exist");
    cy.contains("h2", "Material adjunto")
      .parent()
      .contains("button", "material-tarea.txt")
      .should("be.visible");

    // No se asume si esta entrega concreta del seed ya está "submitted" (y por lo
    // tanto sin input de subida: FileAttachments.tsx solo da uploadUrl mientras
    // status !== "submitted") — ese flujo de ida y vuelta ya lo cubre
    // assignments.cy.ts con una tarea nueva. Aquí solo importa la invariante de
    // "Archivos de mi entrega" siempre visible como sección, sea cual sea su estado.
    cy.contains("h3", "Archivos de mi entrega").should("be.visible");
  });
});
