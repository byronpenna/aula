// CoursesPage.tsx / CourseDetailPage.tsx: list_visible_courses() en el backend ya
// filtra por rol (docente -> solo lo que enseña, alumno/tutor -> solo donde están
// matriculados/vinculados); aquí se prueba que la UI refleja ese alcance y que los
// controles de "Nueva tarea"/"Publicar" solo aparecen para quien administra el
// curso (sección 6, mismo criterio que CourseDetailPage.tsx::isStaff). Los cursos
// pueden tener un nombre libre (admin/docente encargado lo editan desde el
// detalle, ver CourseNameHeader), así que el selector del link no asume un texto
// fijo tipo "Curso {id}" — usa el href, que sí es estable.
const courseLinkSelector = 'a[href^="/courses/"]';

describe("Cursos", () => {
  it("el docente ve el curso que enseña (seed: Colegio Demo) y puede entrar al detalle", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.contains("h1", "Cursos").should("be.visible");
    cy.get(courseLinkSelector).first().should("be.visible").and("contain.text", "Activo").click();
    cy.location("pathname").should("match", /\/courses\/[\w-]+$/);
    cy.contains("h1", "Tareas del curso").should("be.visible");
  });

  it("el alumno ve el mismo curso en el que está matriculado", () => {
    cy.loginAs("student");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().should("be.visible");
  });

  it("el tutor ve el curso de su hijo vinculado", () => {
    cy.loginAs("guardian");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().should("be.visible");
  });

  it("solo el docente (staff) ve el botón Nueva tarea en el detalle del curso", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().click();
    cy.contains("button", "Nueva tarea").should("be.visible");
  });

  it("el alumno no ve Nueva tarea pero sí la tarea publicada del seed", () => {
    cy.loginAs("student");
    cy.visit("/courses");
    cy.get(courseLinkSelector).first().click();
    cy.contains("button", "Nueva tarea").should("not.exist");
    cy.contains("a", "Tarea de práctica: fracciones").should("be.visible");
  });
});
