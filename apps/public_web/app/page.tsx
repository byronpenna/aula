import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { Features } from "@/components/Features";
import { OfertaAcademicaPreview } from "@/components/oferta/OfertaAcademicaPreview";
import { Community } from "@/components/Community";
import { SocialFeed } from "@/components/SocialFeed";
import { Contact } from "@/components/Contact";
import { CtaBanner } from "@/components/CtaBanner";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Stats />
        <Features />
        <OfertaAcademicaPreview />
        <Community />
        <SocialFeed />
        <Contact />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
