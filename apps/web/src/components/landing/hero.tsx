import { Check } from "lucide-react";
import type { CSSProperties } from "react";

import { useLandingLanguage } from "@/lib/landing/language";

import { DownloadButton } from "./download-button";
import { Container } from "./section";

/** Order of each hero text block in the load sequence. */
const riseStep = (step: number) => ({ "--rise-step": step }) as CSSProperties;

/** A phone drawn in CSS around the app screen: no branded device image. */
function PhoneFrame({ alt }: { alt: string }) {
  return (
    <div className="relative rounded-[2.4rem] bg-landing-ink p-[0.55rem] shadow-[0_24px_60px_-12px_rgb(10_10_10/0.35)]">
      <div
        aria-hidden
        className="absolute top-[0.95rem] left-1/2 z-10 h-[0.95rem] w-[30%] -translate-x-1/2 rounded-full bg-landing-ink"
      />
      <img
        alt={alt}
        className="block h-auto w-full rounded-[1.9rem]"
        decoding="async"
        height={1688}
        src="/landing/app-screen.webp"
        width={780}
      />
    </div>
  );
}

export function Hero() {
  const { copy } = useLandingLanguage();
  const { hero } = copy;

  return (
    <section aria-labelledby="hero-title" className="overflow-hidden">
      <Container className="grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div>
          <p
            className="landing-rise inline-flex items-center gap-2 rounded-full bg-landing-yellow-soft px-3.5 py-1.5 font-semibold text-landing-yellow-ink text-sm"
            style={riseStep(0)}
          >
            <span
              aria-hidden
              className="landing-ping relative size-2 rounded-full bg-landing-yellow"
            />
            {hero.eyebrow}
          </p>
          <h1
            className="landing-rise mt-5 text-balance font-bold text-4xl leading-[1.12] sm:text-5xl lg:text-[3.5rem]"
            id="hero-title"
            style={riseStep(1)}
          >
            {hero.title}
          </h1>
          <p
            className="landing-rise mt-6 max-w-xl text-pretty text-landing-muted text-lg leading-relaxed sm:text-xl"
            style={riseStep(2)}
          >
            {hero.lead}
          </p>

          <div
            className="landing-rise mt-8 flex flex-wrap items-center gap-x-5 gap-y-3"
            style={riseStep(3)}
          >
            <DownloadButton className="w-full sm:w-auto" />
            <p className="text-landing-muted text-sm">{copy.download.note}</p>
          </div>

          <ul
            className="landing-rise mt-8 flex flex-wrap gap-x-6 gap-y-3"
            style={riseStep(4)}
          >
            {hero.highlights.map((item) => (
              <li
                className="flex items-center gap-2 font-medium text-sm"
                key={item}
              >
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-full bg-landing-ink text-landing-yellow"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto aspect-[10/9] w-full max-w-[560px]">
          <div
            aria-hidden
            className="landing-unveil absolute inset-x-[4%] bottom-[2%] h-[62%] rounded-[2rem] bg-landing-surface"
          />
          <img
            alt={hero.illustrationAlt}
            className="landing-settle absolute bottom-[2%] left-0 h-auto w-[78%]"
            fetchPriority="high"
            height={926}
            src="/landing/hero.webp"
            width={1200}
          />
          <div className="landing-phone absolute top-0 right-[2%] w-[40%]">
            <PhoneFrame alt={hero.screenAlt} />
          </div>
        </div>
      </Container>
    </section>
  );
}
