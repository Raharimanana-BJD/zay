import { Link } from "@tanstack/react-router";
import { cn } from "@zay-app/ui/lib/utils";

import { type MouseEvent, useCallback } from "react";

import {
  isLang,
  type LandingLang,
  useLandingLanguage,
} from "@/lib/landing/language";

import { Container } from "./section";

const LANGS: LandingLang[] = ["fr", "mg"];

function LanguageSwitch() {
  const { copy, lang, setLang } = useLandingLanguage();
  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { value } = event.currentTarget;
      if (isLang(value)) {
        setLang(value);
      }
    },
    [setLang]
  );
  return (
    <fieldset className="rounded-full border border-landing-border bg-landing-surface p-1">
      <legend className="sr-only">{copy.language.label}</legend>
      <div className="relative grid grid-cols-2">
        <span
          aria-hidden
          className="landing-lang-pill absolute inset-y-0 left-0 w-1/2 rounded-full bg-landing-ink"
          style={{
            transform: `translateX(${LANGS.indexOf(lang) * 100}%)`,
          }}
        />
        {LANGS.map((option) => {
          const isActive = option === lang;
          return (
            <button
              aria-pressed={isActive}
              className={cn(
                "relative flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 font-semibold text-sm outline-offset-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-landing-ink",
                isActive
                  ? "text-white"
                  : "text-landing-muted hover:text-landing-ink"
              )}
              key={option}
              lang={option}
              onClick={handleClick}
              type="button"
              value={option}
            >
              {option.toUpperCase()}
              <span className="sr-only"> · {copy.language[option]}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function LandingHeader() {
  const { copy } = useLandingLanguage();
  const links = [
    { href: "#fonctionnement", label: copy.nav.how },
    { href: "#vehicules", label: copy.nav.vehicles },
    { href: "#chauffeurs", label: copy.nav.drivers },
  ];

  return (
    <header className="sticky top-0 z-30 border-landing-border/70 border-b bg-landing-cream/90 backdrop-blur-md">
      <Container className="flex h-18 items-center justify-between gap-4">
        <Link
          className="flex min-h-11 items-center gap-2.5 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-landing-ink"
          to="/"
        >
          <img
            alt={copy.logoAlt}
            className="h-8 w-auto"
            height={233}
            src="/landing/mark.png"
            width={256}
          />
          <span aria-hidden className="font-bold text-xl">
            Zay
          </span>
        </Link>

        <nav aria-label={copy.nav.label} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  className="flex min-h-11 items-center rounded-full px-4 font-medium text-landing-muted text-sm outline-offset-2 transition-colors hover:bg-landing-surface hover:text-landing-ink focus-visible:outline-2 focus-visible:outline-landing-ink"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <LanguageSwitch />
      </Container>
    </header>
  );
}
