# Plan de ejecución, QA y criterios de aceptación

## Fase 1 — Reconocimiento y plan

- [ ] Identificar framework, router, build, librería de estilos, convenciones, componentes reutilizables y assets.
- [ ] Detectar rutas reales de admisiones/contacto y anclas de navegación existentes.
- [ ] Confirmar variables de marca desde código, sin adivinar hexadecimales.
- [ ] Ejecutar build/tests previos y registrar fallos existentes.
- [ ] Describir el plan de rutas, componentes y modificaciones mínimas.

## Fase 2 — Contenido y base de componentes

- [ ] Crear la fuente tipada de exactamente cinco bachilleratos y centralizar los copys.
- [ ] Reutilizar botón, tarjeta, contenedor, breadcrumbs y layout existentes o extenderlos si falta alguna pieza.
- [ ] Definir imágenes autorizadas/ilustraciones/placeholder con textos alternativos.
- [ ] Respetar la distinción entre contenido sugerido y datos curriculares oficiales.

## Fase 3 — Interfaces

- [ ] Agregar enlace en navegación y footer sin romper header móvil.
- [ ] Integrar preview en home, equilibrado con secciones actuales.
- [ ] Implementar catálogo, filtros/estado vacío y búsqueda ligera si aporta valor.
- [ ] Implementar plantilla de detalle y las cinco rutas.
- [ ] Agregar CTA al destino actual de contacto/admisiones y sección de programas relacionados.
- [ ] Verificar metadatos y enlace profundo por ruta.

## Fase 4 — QA funcional y editorial

| Caso | Resultado esperado |
|---|---|
| Inicio → Oferta académica | Llega al catálogo sin alterar home ni navegación existente. |
| Catálogo inicial | Se ven cinco opciones: Hostelería y Turismo, Idiomas, Diseño Gráfico, Comunicaciones y General. |
| Filtro por área | Muestra la tarjeta correcta y permite «Todos» para restablecer. |
| Búsqueda por tilde/mayúsculas | Si hay búsqueda, encuentra «Diseño» con «diseno». |
| Tarjeta → detalle | Abre la URL correcta y muestra contenido único y su CTA. |
| URL de detalle directa + refresh | Carga correctamente en entorno de despliegue (revisar Amplify rewrites). |
| Slug inexistente | Estado 404 coherente, sin contenido incorrecto. |
| CTA de admisiones | Abre un enlace o formulario REAL y funcional. |
| Contenido curricular | No presenta módulos ilustrativos como malla aprobada. |
| Datos aún desconocidos | No hay duraciones, turnos, precios, certificados ni convenios inventados. |
| Escritorio/tablet/móvil | No hay overflow horizontal, tarjetas truncadas ni menú inaccesible. |
| Teclado / lector de pantalla | Orden de tabulación, foco visible, un H1 y filtros etiquetados. |
| Imágenes | Sin 404, con `alt` correcto, y se cargan sin saltos evidentes. |
| SEO | Título y descripción únicos, breadcrumbs y canónicas coherentes. |
| Build + lint + tests | Sin nuevas regresiones; documentar bloqueos del repositorio si los hay. |

## Matriz de visualización mínima

Capturar, si el entorno dispone de navegador:

1. Home de escritorio con preview integrada.
2. Catálogo de escritorio con las cinco opciones.
3. Una ficha larga de detalle en escritorio (por ejemplo, Hostelería y Turismo).
4. Catálogo móvil 390px con filtros y menú.
5. Ficha móvil 390px con CTA visible sin interferencias.
6. Una ficha adicional con fotografía diferente, para comprobar consistencia entre programas.

## Criterios de aceptación

- [ ] Se ha preservado el diseño público **real** del sitio (cabecera, footer, tipografía, colores, botones, ritmo visual).
- [ ] Las cinco opciones son fáciles de identificar y categorizar por área de interés.
- [ ] Cada opción tiene detalle visualmente rico pero coherente con la misma plantilla.
- [ ] El contenido es reutilizable desde datos, no componentes copiados cinco veces.
- [ ] Toda acción CTA sirve al usuario y llega a un destino existente.
- [ ] No se tocan el login ni los flujos internos del Aula Virtual.
- [ ] No hay datos oficiales inventados; el colegio puede completar la ficha tras la revisión editorial.
- [ ] Código revisado, pruebas documentadas y despliegue compatible con la infraestructura actual.

## Entrega del agente

Enviar un resumen con: rutas y componentes creados; archivos modificados; capturas si son posibles; comandos de test/build y resultados; decisión sobre imágenes definitivas o provisionales; referencias de contenido que todavía necesitan validación académica. Si se necesitó alterar una regla de rewrite de Amplify, explicar el cambio. No publicar contenido no autorizado ni simular que todas las especialidades tienen homologación comprobada.
