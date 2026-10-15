# Diseño UX/UI — Oferta académica en `public_web`

## 1. Consistencia con el sitio vivo

Referencia: https://public-web.dy880wnmeoiy1.amplifyapp.com/. La página pública actualmente comunica las **admisiones**, su propuesta educativa de **preescolar a bachillerato**, las herramientas digitales del Aula Virtual, la comunidad estudiantil y los valores institucionales. El agente debe inspeccionar el código fuente y usar los tokens visuales reales: no se han verificado valores hexadecimales, fuentes o tamaños exactos del sitio solo a partir de su texto público.

Conservar el logo oficial real, si está dentro del repositorio, y nunca recrear el escudo mediante IA. Si hay motivos gráficos o texturas institucionales existentes, reutilizarlos con discreción. El lenguaje debe sonar cercano, claro y formativo, no excesivamente comercial.

## 2. Mapa de navegación

```text
Inicio
├── Nuestra propuesta [ya existente]
├── Oferta académica [nuevo resumen enlazado]
│   ├── Catálogo (/oferta-academica)
│   ├── Hostelería y Turismo (/oferta-academica/hosteleria-y-turismo)
│   ├── Idiomas (/oferta-academica/idiomas)
│   ├── Diseño Gráfico (/oferta-academica/diseno-grafico)
│   ├── Comunicaciones (/oferta-academica/comunicaciones)
│   └── General (/oferta-academica/general)
├── Vida estudiantil [ya existente]
└── Admisiones / Contacto [usar navegación real]
```

Las rutas son propuestas; mantener la convención de routing actual si es diferente. Utilizar URLs compatibles con deep links en Amplify, teniendo en cuenta los rewrite rules de la SPA/SSR existente.

## 3. Home: teaser integrado, no landing nueva

Ubicar una banda «Descubre tu próximo paso» o «Elige el bachillerato que conecta contigo» en un punto natural antes de Vida estudiantil. Mostrar una introducción breve, tres tarjetas destacadas y un botón «Ver los cinco bachilleratos», o las cinco si el diseño original permite una sección visual equilibrada. Reutilizar la retícula, el color base y los botones existentes. No alterar el hero de admisiones ni la posición principal de las llamadas actuales.

## 4. Catálogo: vista principal

### Hero

- Eyebrow: `OFERTA ACADÉMICA`.
- H1: «Explora nuestros bachilleratos».
- Subtítulo: «Descubre diferentes caminos para desarrollar tus talentos y continuar tu formación».
- Fondo con un tratamiento gráfico institucional, no un collage de cinco fotografías ilegibles.
- Breadcrumb y CTA de información según el patrón existente.

### Explorar por área

Usar **categorías editoriales de interés**, no clasificaciones oficiales del sistema educativo: 

| Área | Opción | Ejemplo de interés |
|---|---|---|
| Turismo y servicio | Hostelería y Turismo | Atención, experiencias, organización |
| Lenguas y cultura | Idiomas | Comunicación intercultural |
| Creatividad visual | Diseño Gráfico | Ilustración, marcas, diseño |
| Medios y expresión | Comunicaciones | Escritura, audio, video y relatos |
| Formación integral | General | Exploración académica amplia |

Controles: filtro «Todos» (activo por defecto), filtros por área y opcionalmente una búsqueda que ignore mayúsculas y tildes. Dado que hay **un programa por categoría**, evitar un sistema complejo de filtros combinados: bastan chips o pestañas y una búsqueda sencilla. Las categorías son contenido editorial y podrán ampliarse si se agregan programas en el futuro.

### Tarjetas

Cada tarjeta incluye: imagen aprobada o ilustración coherente, área, título, descripción de hasta unas 25 palabras, 2–3 chips que sinteticen intereses (no acreditaciones), icono sutil y CTA «Conocer el bachillerato». Mantener altura consistente en escritorio; toda la tarjeta puede ser enlace si no hay enlaces interactivos anidados.

Tratamiento sugerido por campo, siempre subordinado a la marca existente:

- **Hostelería y Turismo:** fotografía de servicios, espacios turísticos o un mapa ilustrado; textura suave de líneas de recorrido.
- **Idiomas:** ilustración de diálogo o fotografía de práctica lingüística; detalles de burbujas de conversación.
- **Diseño Gráfico:** composición tipográfica o trabajos de diseño aprobados; collage organizado sobre retícula.
- **Comunicaciones:** micrófono, cámara o estudiantes produciendo contenidos con autorización; diagonales editoriales.
- **General:** libros, aula, ciencias o aprendizaje integral; geometría sobria y luminosa.

No usar fotos de alumnos identificables sin permiso. Proveer placeholders de igual proporción para evitar saltos visuales. En móvil: una tarjeta visible por fila, sin microtipografías.

### Pie de catálogo

Franja final: «¿Aún no sabes cuál elegir? Nuestro equipo puede orientarte». CTA a contacto/admisiones funcional. No afirmar que hay un departamento de orientación o entrevistas si no está confirmado.

## 5. Ficha de programa — plantilla compartida

Orden recomendado:

1. **Breadcrumb** + hero con área, nombre del programa, frase breve y CTA «Solicitar información».
2. **En pocas palabras:** resumen de 2 párrafos con imagen o recuadro informativo editorial.
3. **Lo que explorarás:** 4–6 competencias/áreas **ilustrativas**, visualizadas en pequeñas tarjetas con iconos.
4. **Aprender haciendo:** 2–3 ideas de proyectos claramente marcadas como «Ejemplos de proyectos» (no evidencias de actividades ya ejecutadas).
5. **¿Con qué intereses conecta?:** 3–4 bullets breves que ayuden al aspirante a reconocerse, sin prometer resultados de carrera.
6. **Después del bachillerato:** áreas de continuidad formativa (p. ej. carreras afines) sin garantía de empleo o ingreso a universidades.
7. **Información del programa:** duración, modalidad, turnos, malla y matrícula **solo si el repositorio o la dirección entregan información verificada**; de otro modo omitir la sección o mostrar una invitación a solicitar detalles.
8. **Preguntas frecuentes:** máximo 3–5 preguntas cuyas respuestas se puedan verificar. No inventar precios o requisitos.
9. **CTA final:** llamada de contacto/admisiones + navegación a los otros programas.

En escritorio: hero 60/40 texto-fotografía o adaptación equivalente al layout original, separadores generosos y contenedor legible. En móvil: fotografía debajo del titular para que el CTA aparezca pronto. Secciones de fondo alterno solo si el sistema existente ya lo usa. Evitar animaciones invasivas o sticky CTA que tape contenido.

## 6. Comportamiento y microinteracciones

- Cambiar chips de filtro sin recargar toda la página; sincronizar con querystring `?area=` si el router actual facilita compartir resultados.
- Al filtrar, actualizar contador accesible «Mostrando X de 5 opciones» y mostrar estado vacío con un botón «Limpiar filtros».
- Tarjetas y botones con estados hover/focus claramente visibles; la animación puede ser elevación sutil de 2–4px y duración corta, respetando reducción de movimiento.
- El enlace entre programas al pie del detalle nunca debe mostrar el propio programa como sugerencia principal.
- No hacer carruseles con autoplay; si se usan en home, permitir uso de teclado y botones anteriores/siguientes.

## 7. Accesibilidad y rendimiento

`alt` descriptivos, un solo H1 por ruta, niveles de encabezado sin saltos ilógicos, indicadores de foco, contraste AA, controles de búsqueda etiquetados, `aria-current` en breadcrumbs, hit areas táctiles generosas, imágenes responsivas (`srcset` si está soportado) y cargas diferidas salvo imagen LCP. Evitar librerías de scroll/parallax pesadas. Pantallas objetivo: 360/390px, 768px, 1280/1440px.
