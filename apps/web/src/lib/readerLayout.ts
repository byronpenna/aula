// Punto de corte compartido entre BookPdfReader y BookEpubReader: por debajo de
// este ancho de contenedor se muestra una sola página (como en un teléfono),
// por encima se muestra una doble página ("spread") como un libro abierto —
// mismo criterio que usa epub.js internamente para su propio `minSpreadWidth`.
export const SPREAD_MIN_WIDTH_PX = 840;
