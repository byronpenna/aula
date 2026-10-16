// Flujo completo de tareas y entregas (sección 5/9): el docente crea una tarea en
// borrador, la publica; el alumno la entrega (SUBMISSION_CREATE, control de
// versión optimista); el docente revisa la lista de entregas. Un solo `it` porque
// cada paso depende del id real que crea el paso anterior (capturado vía
// `cy.intercept`, no hardcodeado). Los cursos pueden tener un nombre libre (ver
// CourseNameHeader), así que el link se ubica por href, no por el texto "Curso ".
const courseLinkSelector = 'a[href^="/courses/"]';

describe("Tareas: crear, publicar, entregar y revisar", () => {
  it("docente crea y publica una tarea; alumno la entrega; docente ve la entrega", () => {
    const title = `Tarea E2E ${Date.now()}`;

    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().click();

    cy.contains("button", "Nueva tarea").click();
    cy.get('[name="title"]').type(title);
    cy.get('[name="due_at"]').type("2027-01-15T10:00");

    cy.intercept("POST", "**/courses/*/assignments").as("createAssignment");
    cy.contains("form button", "Guardar borrador").click();
    cy.wait("@createAssignment").then(({ response }) => {
      const assignmentId = response?.body.id as string;
      cy.wrap(assignmentId).as("assignmentId");
    });

    cy.contains("li", title).should("contain.text", "draft");
    cy.contains("li", title).contains("button", "Publicar").click();
    cy.contains("li", title).should("contain.text", "published");
    cy.contains("li", title).contains("button", "Publicar").should("not.exist");

    cy.contains("li", title).contains("a", title).click();
    cy.contains("h2", "Entregas de alumnos").should("be.visible");
    cy.contains("Aún no hay entregas.").should("be.visible");

    cy.get("@assignmentId").then((assignmentId) => {
      cy.loginAs("student");
      cy.visit(`/assignments/${assignmentId}`);
      cy.contains("label", "Mi entrega").should("be.visible");
      cy.get("#submission-body").type("Mi respuesta a la tarea de práctica.");
      cy.contains("button", "Entregar").click();
      cy.contains("button", "Entregado").should("be.disabled");
      cy.get("#submission-body").should("be.disabled");

      cy.loginAs("teacher");
      cy.visit(`/assignments/${assignmentId}`);
      cy.contains("h2", "Entregas de alumnos").should("be.visible");
      cy.get("table tbody tr").first().should("contain.text", "submitted");
      cy.get("table tbody tr").first().contains("button", "Ver").click();
      cy.contains("Esta entrega no tiene archivos adjuntos.").should("be.visible");
    });
  });

  it("un docente no puede entregar y un alumno no ve la lista de entregas de otros", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().click();
    cy.contains("a", "Tarea de práctica: fracciones").click();
    cy.get("#submission-body").should("not.exist");
    cy.contains("h2", "Entregas de alumnos").should("be.visible");

    cy.loginAs("student");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().click();
    cy.contains("a", "Tarea de práctica: fracciones").click();
    cy.contains("h2", "Entregas de alumnos").should("not.exist");
    cy.contains("label", "Mi entrega").should("be.visible");
  });
});
