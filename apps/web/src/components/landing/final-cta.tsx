import { useLandingLanguage } from "@/lib/landing/language";

import { DownloadButton } from "./download-button";
import { Container } from "./section";

export function FinalCta() {
  const { copy } = useLandingLanguage();

  return (
    <section aria-labelledby="final-title" className="pb-20 sm:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] bg-landing-yellow px-6 py-14 text-center sm:px-12 sm:py-20">
          <img
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-8 -bottom-10 hidden w-72 opacity-10 sm:block"
            height={233}
            loading="lazy"
            src="/landing/mark.png"
            width={256}
          />
          <h2
            className="relative text-balance font-bold text-3xl leading-tight sm:text-5xl"
            id="final-title"
          >
            {copy.final.title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-pretty text-landing-ink/80 text-lg leading-relaxed">
            {copy.final.lead}
          </p>
          <div className="relative mt-8 flex flex-col items-center gap-3">
            <DownloadButton className="w-full sm:w-auto" />
            <p className="font-medium text-landing-ink/75 text-sm">
              {copy.download.note}
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
