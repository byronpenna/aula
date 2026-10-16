---
name: aula-web-polish
description: Aplica la identidad visual del colegio (tokens de marca, tipografía, botones, tarjetas, badges) a pantallas y componentes de apps/web (la SPA "Aula Virtual" en React + Vite + Tailwind). Úsalo siempre que el usuario pida que apps/web se vea "más bonita", "profesional", "con marca", "consistente con el sitio público", o pida pulir/rediseñar visualmente cualquier pantalla, tabla, formulario, botón o componente del panel administrativo — incluso si solo menciona el nombre de una pantalla (p. ej. "la página de cursos", "el login", "el dashboard") sin usar la palabra "diseño". No es para cambiar lógica, rutas, llamadas a la API ni reglas de permisos — solo apariencia.
---

# Pulir el diseño visual de Aula Virtual (apps/web)

## El problema exacto que existe hoy

`apps/web/src/index.css` ya tiene los tokens de marca reales del colegio, copiados
literalmente de `apps/public_web` (la fuente de verdad, nunca los inventes de
nuevo ni los dupliques a mano):

```css
--color-brand-50  ... --color-brand-900   /* azules institucionales */
--color-accent-300 ... --color-accent-500 /* amarillo/dorado de acento */
--font-sans    /* Inter */
--font-display /* Poppins, para títulos */
.focus-ring    /* anillo de foco accesible ya definido */
```

El problema: casi ningún componente de `apps/web/src/routes` o
`apps/web/src/components` usa estos tokens todavía. Usan clases genéricas de
Tailwind (`sky-600`, `slate-900`, `slate-500`, `emerald-*`, `amber-*`, `rounded-md`
suelto) que no tienen nada que ver con la marca del colegio — por eso la app se ve
"de plantilla". Arreglar esto es un trabajo de **reemplazo de clases y
tipografía**, no de arquitectura: no hace falta tocar `AdminLayout.tsx` ni la
navegación por permisos, eso ya existe y funciona.

Antes de tocar nada, confirma que los tokens siguen siendo los mismos leyendo
`apps/web/src/index.css` y, si quieres ver el lenguaje visual "correcto" en vivo,
mira cómo ya los usa `apps/public_web` (es la referencia real, no una captura ni
un mockup): `components/Header.tsx`, `components/Hero.tsx`,
`components/Features.tsx`, `components/CtaBanner.tsx`, `components/Contact.tsx`.

Si el usuario pide algo que va más allá de apariencia (nueva sección de sidebar,
nuevo rol, nueva tabla con datos distintos), eso pertenece al paquete más grande
`apps/web/aula_virtual_linares_agente_v2/` (ya en marcha vía `AdminLayout.tsx`,
`AdminUsersPage.tsx`, `AdminRolesPage.tsx`) — léelo tú si el pedido roza ese
terreno, pero no actives ese alcance solo porque te pidieron "más bonito".

## Mapa de reemplazo (lo que cambia, clase por clase)

| Antes (genérico) | Después (marca del colegio) | Dónde |
|---|---|---|
| `text-slate-900`, `font-bold` en títulos | agrega `font-display` + usa `text-brand-900` | `<h1>`/`<h2>`/`<h3>` |
| `text-slate-500`, `text-slate-400` | `text-brand-500` / `text-brand-600` | texto secundario/metadata |
| `border-slate-200`, `border-slate-300` | `border-brand-100` / `ring-brand-100` | bordes de tarjetas/inputs |
| `bg-sky-600`, `bg-sky-700` (botón primario) | `bg-brand-800 hover:bg-brand-900 text-white` | botones primarios |
| botón de alto énfasis / CTA principal | `bg-accent-400 hover:bg-accent-300 text-brand-900` | un único CTA destacado por vista, no todos los botones |
| `bg-sky-50`, `bg-slate-50` (fondo suave) | `bg-brand-50` | secciones, filas alternas, chips |
| `rounded-md` en botones/pills | `rounded-full` | botones, badges, chips (mira `StatusBadge.tsx`) |
| `rounded-md`/`rounded-lg` en tarjetas | `rounded-xl` o `rounded-2xl` | tarjetas, paneles, modales |
| cualquier elemento interactivo sin anillo de foco visible | agrega la clase `focus-ring` | botones, links, inputs, filas clicables |

No toques `emerald-*`/`amber-*`/`red-*` en `StatusBadge.tsx`: esos colores
**son** semántica de estado (activo/borrador/peligro), no la paleta de marca — el
propio comentario del archivo ya explica por qué nunca debe ser solo color. Si
necesitas un acento de peligro, usa el rojo estándar de Tailwind (`red-*`), igual
que ya hace el resto del código: no existe un rojo institucional real todavía.

## Cómo trabajar (incremental, nunca en bloque)

1. **Elige un solo archivo o pantalla** a la vez — el que el usuario mencionó, o
   si no especificó, empieza por los componentes pequeños y reutilizados
   (`components/StatusBadge.tsx`, `MetricCard.tsx`, `Breadcrumbs.tsx`,
   `States.tsx`) antes que páginas completas: pulirlos ahí se propaga a toda la
   app sin tocar cada página. Después sigue con las pantallas de más tráfico
   (`LoginPage.tsx`, `AppShell.tsx`, `AdminDashboardPage.tsx`) antes de las tablas
   de administración más profundas.
2. **Solo cambia `className`/estilo.** No toques handlers, llamadas a
   `apiClient`, hooks de `react-query`, props ni la lógica de permisos
   (`permissions?.permissions.includes(...)`): un pase de diseño que rompe una
   función no es un pase de diseño, es un bug.
3. Aplica el mapa de arriba, y de paso:
   - Un solo `<h1>` por pantalla, jerarquía de encabezados sin saltos.
   - Contraste AA: si un texto queda difícil de leer sobre `brand-800`/`brand-900`,
     usa `text-white` o `text-brand-100`, no un gris genérico encima de azul oscuro.
   - Estados vacío/error/carga (`States.tsx`) con texto real, nunca solo un
     spinner sin mensaje.
4. **Verifica antes de seguir al siguiente archivo**, desde `apps/web`:
   ```bash
   npm run typecheck && npm run lint && npm run build
   ```
   Si tienes forma de ver la app corriendo (`npm run dev`), revisa visualmente la
   pantalla que tocaste — un cambio de clases puede compilar bien y verse roto
   igual (texto invisible por mal contraste, botón que pierde el `onClick` por un
   `<div>` mal anidado, etc.).
5. Repite archivo por archivo. Si son muchos, ve avisando cuáles quedaron y
   cuáles faltan en vez de intentar todo de un salto silencioso.

## Qué reportar al terminar

Igual que cualquier cambio de código: qué archivos tocaste, qué comandos
corriste y su resultado, y si pudiste verlo corriendo o solo compilar+lint. Si
encontraste una pantalla que en realidad necesita la reestructuración más grande
de `aula_virtual_linares_agente_v2/` (no solo clases), dilo en vez de forzar un
parche cosmético sobre algo que necesita otra cosa.
