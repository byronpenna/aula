export const AULA_VIRTUAL_URL =
  process.env.NEXT_PUBLIC_AULA_URL ?? "https://main.dy880wnmeoiy1.amplifyapp.com";

export const SCHOOL_NAME = "Colegio Coronel Francisco Linares";
export const SCHOOL_SHORT_NAME = "Colegio Linares";

export const SCHOOL_ADDRESS =
  "Carretera Troncal del Norte, kilómetro 13, cantón San Nicolás, Apopa, San Salvador";
export const SCHOOL_PHONE = "+503 2203 7402";
export const SCHOOL_PHONE_HREF = "+50322037402";

// TODO(propietario): el link de "horario de atención" recibido apunta al mismo
// perfil de TikTok que SCHOOL_TIKTOK_URL — probablemente un copy/paste
// duplicado. Se deja el dato de horario sin publicar hasta confirmar el
// horario real o el link correcto (ver docs/ASSUMPTIONS.md).
export const SCHOOL_SCHEDULE: string | null = null;

export const SCHOOL_WAZE_URL =
  "https://www.waze.com/es/live-map/directions/colegio-coronel-francisco-linares-apopa?to=place.w.177471626.1774912869.1923016";
export const SCHOOL_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/place/Centro+Escolar+Coronel+Francisco+Linares/data=!4m2!3m1!1s0x0:0xd42fe69872f322ae?sa=X&ved=1t:2428&ictx=111";
export const SCHOOL_FACEBOOK_URL = "https://www.facebook.com/ColegioFranciscoLinares";
export const SCHOOL_TIKTOK_URL = "https://www.tiktok.com/@colegio.linares";
