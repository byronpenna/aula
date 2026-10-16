// MyStudentsPage.tsx / StudentSubmissionsPage.tsx (sección 10): un tutor solo ve
// a sus propios hijos vinculados (nunca búsqueda libre de otros alumnos) y, desde
// ahí, las entregas de ese hijo — nunca las de otro.
describe("Mis hijos (tutor)", () => {
  it("el tutor ve a su hijo vinculado del seed y entra a sus entregas", () => {
    cy.loginAs("guardian");
    cy.visit("/my-students");
    cy.contains("h1", "Mis hijos").should("be.visible");
    cy.contains("li", "madre/padre").should("be.visible").find("a").click();
    cy.location("pathname").should("match", /\/students\/[\w-]+\/submissions$/);
    cy.contains("h1", "Entregas").should("be.visible");
  });

  it("un docente no tiene acceso a /my-students en la navegación", () => {
    cy.loginAs("teacher");
    cy.visit("/");
    cy.contains("nav a", "Mis hijos").should("not.exist");
  });
});
