import Script from "next/script";
import { SCHOOL_FACEBOOK_URL, SCHOOL_TIKTOK_URL } from "@/lib/config";

const TIKTOK_HANDLE = SCHOOL_TIKTOK_URL.split("/@")[1] ?? "";

export function SocialFeed() {
  return (
    <section id="redes" className="bg-brand-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
            Redes sociales
          </span>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Descubre más de nosotros en nuestras redes sociales
          </h2>
          <p className="mt-4 text-lg text-brand-700">
            Nuestros últimos videos de TikTok y publicaciones de Facebook, directo desde nuestros
            perfiles oficiales.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-5 lg:items-start">
          <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 lg:col-span-3">
            <blockquote
              className="tiktok-embed"
              cite={SCHOOL_TIKTOK_URL}
              data-unique-id={TIKTOK_HANDLE}
              data-embed-type="creator"
              style={{ maxWidth: "100%", minWidth: "288px" }}
            >
              <section>
                <a
                  target="_blank"
                  rel="noreferrer noopener"
                  href={`${SCHOOL_TIKTOK_URL}?refer=creator_embed`}
                >
                  @{TIKTOK_HANDLE}
                </a>
              </section>
            </blockquote>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand-100 lg:col-span-2">
            <div id="fb-root" />
            <div
              className="fb-page"
              data-href={SCHOOL_FACEBOOK_URL}
              data-tabs="timeline"
              data-height="700"
              data-small-header="false"
              data-adapt-container-width="true"
              data-hide-cover="false"
              data-show-facepile="false"
            >
              <blockquote cite={SCHOOL_FACEBOOK_URL} className="fb-xfbml-parse-ignore">
                <a href={SCHOOL_FACEBOOK_URL}>Colegio Coronel Francisco Linares</a>
              </blockquote>
            </div>
          </div>
        </div>
      </div>

      <Script id="tiktok-embed-js" src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
      <Script
        id="facebook-jssdk"
        src="https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v19.0"
        strategy="lazyOnload"
        crossOrigin="anonymous"
      />
    </section>
  );
}
