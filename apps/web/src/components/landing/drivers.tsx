import { useLandingLanguage } from "@/lib/landing/language";

import { DownloadButton } from "./download-button";
import { Container, SectionHeading } from "./section";

/** "Become a driver": no amount of money, ever (spec 0007, AC-5). */
export function Drivers() {
  const { copy } = useLandingLanguage();
  const { drivers } = copy;

  return (
    <section
      aria-labelledby="drivers-title"
      className="scroll-mt-20 pb-20 sm:pb-24"
      id="chauffeurs"
    >
      <Container>
        <div className="grid gap-10 overflow-hidden rounded-[2rem] bg-landing-ink p-6 text-white sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14 lg:p-14">
          <div className="rounded-3xl bg-landing-cream p-4 sm:p-6">
            <img
              alt={drivers.illustrationAlt}
              className="h-auto w-full"
              decoding="async"
              height={926}
              loading="lazy"
              src="/landing/driver.webp"
              width={1200}
            />
          </div>

          <div>
            <SectionHeading
              id="drivers-title"
              lead={drivers.lead}
              title={drivers.title}
              tone="dark"
            />
            <ol className="mt-8 space-y-5">
              {drivers.steps.map((step, index) => (
                <li className="flex gap-4" key={step.title}>
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-landing-yellow font-bold text-landing-ink text-sm"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-lg">{step.title}</h3>
                    <p className="mt-1 text-landing-on-dark-muted leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <DownloadButton className="mt-9 w-full sm:w-auto" tone="yellow" />
          </div>
        </div>
      </Container>
    </section>
  );
}
