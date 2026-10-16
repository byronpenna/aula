// AcademicsAdminPage.tsx: CRUD + archivar/reactivar para años académicos (y, por
// extensión de la misma UI genérica, grados/materias/secciones/cursos). Se cubre
// a fondo la pestaña de Años académicos y, de forma ligera, que el resto de
// pestañas carga sus datos reales del seed sin romperse.
describe("Administración > Academia", () => {
  beforeEach(() => {
    cy.loginAs("admin");
    cy.visit("/admin/academics");
  });

  it("navega entre las 6 pestañas por query param", () => {
    const tabs: [string, string][] = [
      ["Años académicos", "years"],
      ["Grados", "grades"],
      ["Materias", "subjects"],
      ["Secciones", "sections"],
      ["Cursos", "courses"],
      ["Inscripciones", "enrollments"],
    ];
    tabs.forEach(([label, key]) => {
      cy.contains('[role="tab"]', label).click();
      cy.location("search").should("eq", `?tab=${key}`);
    });
  });

  it("crea un año académico, lo archiva y lo reactiva", () => {
    const label = `E2E-${Date.now()}`;
    cy.get('[name="label"]').first().type(label);
    cy.get('[name="starts_on"]').first().type("2028-01-15");
    cy.get('[name="ends_on"]').first().type("2028-11-15");
    cy.contains("form button", "Crear").click();

    cy.contains("tr", label).should("contain.text", "Activo");
    cy.contains("tr", label).contains("button", "Archivar").click();
    cy.contains("tr", label).should("contain.text", "Archivado");
    cy.contains("tr", label).contains("button", "Reactivar").click();
    cy.contains("tr", label).should("contain.text", "Activo");
  });

  it("edita un año académico existente", () => {
    const label = `E2E-edit-${Date.now()}`;
    cy.get('[name="label"]').first().type(label);
    cy.get('[name="starts_on"]').first().type("2029-01-15");
    cy.get('[name="ends_on"]').first().type("2029-11-15");
    cy.contains("form button", "Crear").click();

    cy.contains("tr", label).contains("button", "Editar").click();
    const newLabel = `${label}-mod`;
    cy.get('[name="label"]').last().clear().type(newLabel);
    cy.contains("form button", "Guardar").click();
    cy.contains("tr", newLabel).should("be.visible");
  });

  it("rechaza un año con fecha de fin anterior al inicio", () => {
    cy.get('[name="label"]').first().type(`E2E-bad-${Date.now()}`);
    cy.get('[name="starts_on"]').first().type("2030-06-01");
    cy.get('[name="ends_on"]').first().type("2030-01-01");
    cy.contains("form button", "Crear").click();
    cy.contains("Debe ser posterior al inicio.").should("be.visible");
  });

  it("muestra la estructura académica del seed en Grados/Materias/Secciones/Cursos", () => {
    cy.contains('[role="tab"]', "Grados").click();
    cy.contains("tr", "Sexto grado").should("be.visible");

    cy.contains('[role="tab"]', "Materias").click();
    cy.contains("tr", "Matemática").should("contain.text", "MAT6");

    cy.contains('[role="tab"]', "Secciones").click();
    cy.contains("table tbody tr", "A").should("be.visible");

    cy.contains('[role="tab"]', "Cursos").click();
    cy.get("table tbody tr").should("have.length.at.least", 1);
  });
});
