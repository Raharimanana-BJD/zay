import { Banknote, MapPin, Navigation, Users } from "lucide-react";

import { useLandingLanguage } from "@/lib/landing/language";

import { Container, SectionHeading } from "./section";

/** One icon per client argument, in the order of `copy.how.steps` (AC-4). */
const STEP_ICONS = [MapPin, Users, Navigation, Banknote];

export function HowItWorks() {
  const { copy } = useLandingLanguage();
  const { how } = copy;

  return (
    <section
      aria-labelledby="how-title"
      className="scroll-mt-20 bg-landing-surface py-20 sm:py-24"
      id="fonctionnement"
    >
      <Container>
        <SectionHeading id="how-title" lead={how.lead} title={how.title} />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {how.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? MapPin;
            return (
              <li
                className="flex flex-col rounded-2xl border border-landing-border bg-landing-cream p-6"
                key={step.title}
              >
                <div className="flex items-center justify-between">
                  <span
                    aria-hidden
                    className="flex size-12 items-center justify-center rounded-full bg-landing-yellow text-landing-ink"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span
                    aria-hidden
                    className="font-bold text-2xl text-landing-border-strong tabular-nums"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-6 font-medium text-landing-muted text-sm">
                  {step.step}
                </p>
                <h3 className="mt-1.5 font-bold text-xl leading-snug">
                  {step.title}
                </h3>
                <p className="mt-3 text-landing-muted leading-relaxed">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
