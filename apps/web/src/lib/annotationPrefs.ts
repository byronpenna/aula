// Preferencia "mostrar anotaciones" del lector (notas + resaltados): pura
// conveniencia visual por dispositivo, igual criterio que readingProgress.ts —
// nunca borra nada, solo oculta la superposición para una lectura más simple.
const KEY = "aula-book-reader:show-annotations";

export function getShowAnnotations(): boolean {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === null ? true : value === "1";
  } catch {
    return true;
  }
}

export function setShowAnnotations(value: boolean): void {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Almacenamiento no disponible (privado/bloqueado): no es crítico, se ignora.
  }
}
