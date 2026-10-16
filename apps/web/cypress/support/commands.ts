// Usuarios demo creados por `python scripts/seed.py` (ver scripts/seed.py): un rol
// cada uno, un solo colegio ("Colegio Demo") — por eso basta con fijar el token en
// `sessionStorage`, sin seleccionar colegio aparte (AuthContext.tsx autoselecciona
// cuando `memberships.length === 1`).
export const DEMO_USERS = {
  admin: { username: "admin.demo", password: "aula-local-dev", displayName: "Admin Demo" },
  teacher: { username: "docente.demo", password: "aula-local-dev", displayName: "Docente Demo" },
  student: { username: "alumno.demo", password: "aula-local-dev", displayName: "Alumno Demo" },
  guardian: { username: "tutor.demo", password: "aula-local-dev", displayName: "Tutor Demo" },
} as const;

export type DemoRole = keyof typeof DEMO_USERS;

// Cypress.env()/env de cypress.config.ts no son necesarios para un valor fijo de
// desarrollo local; se define aquí en vez de leerlo del config para no depender
// de cómo cada versión de Cypress expone config no sensible al código del spec.
const API_BASE_URL = "http://localhost:8000/api/v1";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Login real contra /auth/local/token (sin UI) + cy.session para no repetir
       * el POST en cada test; replica lo que AuthContext.tsx guarda tras un login
       * exitoso para que la app, al visitar cualquier ruta, se considere autenticada. */
      loginAs(role: DemoRole): Chainable<void>;
      /** Login a través del propio formulario (cypress/e2e/login.cy.ts: es la
       * funcionalidad bajo prueba ahí, no un atajo). */
      loginViaUi(username: string, password: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("loginAs", (role: DemoRole) => {
  const user = DEMO_USERS[role];
  cy.session(role, () => {
    cy.request("POST", `${API_BASE_URL}/auth/local/token`, {
      username: user.username,
      password: user.password,
    }).then(({ body }) => {
      const expiresAt = Date.now() + body.expires_in * 1000;
      // `onBeforeLoad` inyecta sessionStorage ANTES de que corran los scripts de la
      // página (a diferencia de cy.window().then(...) tras el visit, que llega
      // demasiado tarde: lib/session.ts ya hidrató zustand desde un storage vacío y
      // AuthContext.tsx, al ver `hasValidSession()` en falso, sobrescribe la sesión
      // con `.clear()` antes de que el set manual alcance a aplicarse).
      cy.visit("/", {
        onBeforeLoad(win) {
          win.sessionStorage.setItem(
            "aula-session",
            JSON.stringify({
              state: { token: body.access_token, expiresAt, schoolId: null },
              version: 0,
            }),
          );
        },
      });
      cy.contains("h1", "Hola,");
    });
  });
});

Cypress.Commands.add("loginViaUi", (username: string, password: string) => {
  cy.visit("/login");
  cy.get("#username").type(username);
  cy.get("#password").type(password);
  cy.contains("button", "Ingresar").click();
});
