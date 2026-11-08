import { createFileRoute } from "@tanstack/react-router";

import { Drivers } from "@/components/landing/drivers";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Vehicles } from "@/components/landing/vehicles";
import { ENV } from "@/env";
import { fr } from "@/lib/landing/fr";
import {
  LandingLanguageProvider,
  useLandingLanguage,
} from "@/lib/landing/language";

const TRAILING_SLASH = /\/$/;

/** Share tags read the server HTML, which is always French (spec 0007, AC-10). */
function landingHead() {
  const siteUrl = ENV.VITE_SITE_URL?.replace(TRAILING_SLASH, "");
  const meta = [
    { title: fr.meta.title },
    { name: "description", content: fr.meta.description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Zay" },
    { property: "og:locale", content: "fr_FR" },
    { property: "og:title", content: fr.meta.title },
    { property: "og:description", content: fr.meta.description },
    { name: "theme-color", content: "#f5f3ee" },
  ];

  if (!siteUrl) {
    return { meta };
  }

  return {
    meta: [
      ...meta,
      { property: "og:url", content: `${siteUrl}/` },
      { property: "og:image", content: `${siteUrl}/logo.png` },
    ],
    links: [{ rel: "canonical", href: `${siteUrl}/` }],
  };
}

export const Route = createFileRoute("/")({
  head: landingHead,
  component: LandingPage,
});

function LandingPage() {
  return (
    <LandingLanguageProvider>
      <LandingContent />
    </LandingLanguageProvider>
  );
}

function LandingContent() {
  const { copy } = useLandingLanguage();
  return (
    <div className="landing min-h-svh">
      <a
        className="sr-only z-50 rounded-full bg-landing-ink px-5 py-3 font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#contenu"
      >
        {copy.skipLink}
      </a>
      <LandingHeader />
      <main id="contenu">
        <Hero />
        <HowItWorks />
        <Vehicles />
        <Drivers />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
