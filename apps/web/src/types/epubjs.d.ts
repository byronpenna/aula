// epubjs no publica tipos propios ni hay un paquete @types/epubjs en el
// registro (verificado al agregar la dependencia). Shim mínimo: solo declara
// el módulo como `any` — el tipado fino de lo que se usa vive en
// components/BookEpubReader.tsx, no aquí.
declare module "epubjs";
