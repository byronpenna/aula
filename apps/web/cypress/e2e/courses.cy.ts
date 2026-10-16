// CoursesPage.tsx / CourseDetailPage.tsx: list_visible_courses() en el backend ya
// filtra por rol (docente -> solo lo que enseña, alumno/tutor -> solo donde están
// matriculados/vinculados); aquí se prueba que la UI refleja ese alcance y que los
// controles de "Nueva tarea"/"Publicar" solo aparecen para quien administra el
// curso (sección 6, mismo criterio que CourseDetailPage.tsx::isStaff).
describe("Cursos", () => {
  it("el docente ve el curso que enseña (seed: Colegio Demo) y puede entrar al detalle", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.contains("h1", "Cursos").should("be.visible");
    cy.contains("a", "Curso ").should("be.visible").and("contain.text", "Estado: active").click();
    cy.location("pathname").should("match", /\/courses\/[\w-]+$/);
    cy.contains("h1", "Tareas del curso").should("be.visible");
  });

  it("el alumno ve el mismo curso en el que está matriculado", () => {
    cy.loginAs("student");
    cy.visit("/courses");
    cy.contains("a", "Curso ").should("be.visible");
  });

  it("el tutor ve el curso de su hijo vinculado", () => {
    cy.loginAs("guardian");
    cy.visit("/courses");
    cy.contains("a", "Curso ").should("be.visible");
  });

  it("solo el docente (staff) ve el botón Nueva tarea en el detalle del curso", () => {
    cy.loginAs("teacher");
    cy.visit("/courses");
    cy.contains("a", "Curso ").click();
    cy.contains("button", "Nueva tarea").should("be.visible");
  });

  it("el alumno no ve Nueva tarea pero sí la tarea publicada del seed", () => {
    cy.loginAs("student");
    cy.visit("/courses");
    cy.contains("a", "Curso ").click();
    cy.contains("button", "Nueva tarea").should("not.exist");
    cy.contains("a", "Tarea de práctica: fracciones").should("be.visible");
  });
});
