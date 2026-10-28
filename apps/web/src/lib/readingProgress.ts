// Recordar dónde se quedó cada lector (página de PDF o CFI de EPUB): conveniencia
// por dispositivo en localStorage, nunca estado crítico — si falla (modo privado,
// storage bloqueado) el lector simplemente abre desde el principio.
const KEY_PREFIX = "aula-book-progress:";

export function getReadingProgress(bookId: string): string | null {
  try {
    return window.localStorage.getItem(KEY_PREFIX + bookId);
  } catch {
    return null;
  }
}

export function setReadingProgress(bookId: string, value: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + bookId, value);
  } catch {
    // Almacenamiento no disponible (privado/bloqueado): no es crítico, se ignora.
  }
}
