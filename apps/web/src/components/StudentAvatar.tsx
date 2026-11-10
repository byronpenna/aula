import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFileBlobUrl } from "../lib/download";

// Foto de perfil de un alumno, compartida por toda la app (Administración >
// Alumnos, Estudiantes inscritos de un curso, ficha de alumno): mismo fetch
// (vía blob — el endpoint exige sesión autenticada, nunca una URL `<img src>`
// directa) y mismo respaldo con la inicial del nombre si no hay foto, para que
// nunca se vea un hueco vacío. Si la foto existe pero falla al cargarla
// (permiso o archivo borrado), lo marca con un anillo ámbar en vez de fallar en
// silencio como si nunca hubiera tenido foto.
//
// A propósito NO se revoca el blob: URL.revokeObjectURL(url) en un cleanup de
// useEffect (como hacía antes) invalida el blob aunque react-query siga
// sirviendo esa misma URL desde caché (staleTime) — al reabrir el mismo alumno
// después de ver otro, el <img> apuntaba a un blob ya revocado y se rompía
// (icono de imagen rota). Dejar el blob vivo mientras dure la pestaña es el
// mismo trade-off que ya hacen la mayoría de apps para imágenes cacheadas;
// nunca se acumulan más que unas pocas por sesión de administración.
//
// `photoFileId` debe pasarse como `null` cuando quien mira no tiene permiso
// para descargarla (files/service.py::get_download exige ENROLLMENT_MANAGE
// para fotos de alumno) — así se evita una descarga condenada a un 403 y el
// aviso ámbar engañoso que eso mostraría a casi todo el que no administra
// matrícula (docentes, tutores, el propio alumno).
export function StudentAvatar({
  photoFileId,
  name,
  size,
}: {
  photoFileId: string | null;
  name: string;
  size: string;
}) {
  const photo = useQuery({
    queryKey: ["students", "photo-url", photoFileId],
    queryFn: async () => getFileBlobUrl(photoFileId as string),
    enabled: Boolean(photoFileId),
    staleTime: 5 * 60 * 1000,
  });
  const photoUrl = photo.data?.url ?? null;

  // Última red de seguridad: si el navegador no logra decodificar el blob (el
  // caso de arriba, u otra razón), nunca se queda mostrando el ícono nativo de
  // imagen rota — cae a la inicial, igual que si nunca hubiera habido foto.
  // `imgBroken` solo puede ser true para una `photoUrl` real (nunca para
  // `null`), así que un alumno sin foto nunca cae por error en el estado
  // "falló al cargar".
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const imgBroken = photoUrl !== null && photoUrl === brokenUrl;

  if (photoUrl && !imgBroken) {
    return (
      <img
        src={photoUrl}
        alt=""
        onError={() => setBrokenUrl(photoUrl)}
        className={`${size} shrink-0 rounded-full object-cover ring-1 ring-brand-100`}
      />
    );
  }

  const failed = photo.isError || imgBroken;
  return (
    <span
      aria-hidden="true"
      title={failed ? "No se pudo cargar la fotografía" : undefined}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full font-display font-bold ${
        failed ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200" : "bg-brand-100 text-brand-700"
      }`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
