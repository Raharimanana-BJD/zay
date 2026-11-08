import { CarTaxiFront, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { useLandingLanguage } from "@/lib/landing/language";

import { Container, SectionHeading } from "./section";

/** A simple three wheeler, drawn like the lucide icons around it. */
function TukTukIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M4 16V9a4 4 0 0 1 4-4h6l4 6h1a2 2 0 0 1 2 2v3" />
      <path d="M10 5v6h8" />
      <path d="M8 16h6" />
      <circle cx="6" cy="17" r="2" />
      <circle cx="16.5" cy="17" r="2" />
    </svg>
  );
}

type IconType = ComponentType<{ className?: string }>;

function VehicleCard({
  body,
  icon: Icon,
  title,
  featured,
}: {
  body: string;
  featured?: boolean;
  icon: IconType;
  title: string;
}) {
  return (
    <li
      className={
        featured
          ? "flex flex-col rounded-2xl bg-landing-surface p-7 shadow-[0_4px_16px_rgb(10_10_10/0.06)]"
          : "flex flex-col rounded-2xl border border-landing-border-strong border-dashed p-7 sm:col-span-2 lg:col-span-1"
      }
    >
      <span
        aria-hidden
        className={
          featured
            ? "flex size-14 items-center justify-center rounded-2xl bg-landing-yellow-soft text-landing-ink"
            : "flex size-14 items-center justify-center rounded-2xl bg-landing-cream-deep text-landing-ink"
        }
      >
        <Icon className="size-7" />
      </span>
      <h3 className="mt-6 font-bold text-2xl">{title}</h3>
      <p className="mt-3 text-landing-muted leading-relaxed">{body}</p>
    </li>
  );
}

export function Vehicles() {
  const { copy } = useLandingLanguage();
  const { vehicles } = copy;

  return (
    <section
      aria-labelledby="vehicles-title"
      className="scroll-mt-20 py-20 sm:py-24"
      id="vehicules"
    >
      <Container>
        <SectionHeading
          id="vehicles-title"
          lead={vehicles.lead}
          title={vehicles.title}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <VehicleCard
            body={vehicles.taxi.body}
            featured
            icon={CarTaxiFront}
            title={vehicles.taxi.title}
          />
          <VehicleCard
            body={vehicles.tukTuk.body}
            featured
            icon={TukTukIcon}
            title={vehicles.tukTuk.title}
          />
          <VehicleCard
            body={vehicles.auto.body}
            icon={Sparkles}
            title={vehicles.auto.title}
          />
        </ul>
      </Container>
    </section>
  );
}
