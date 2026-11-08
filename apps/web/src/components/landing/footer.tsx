import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";

import { CONTACT } from "@/lib/landing/contact";
import { useLandingLanguage } from "@/lib/landing/language";

import { Container } from "./section";

const CONTACT_LINK =
  "inline-flex min-h-11 items-center gap-3 rounded-md outline-offset-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-landing-yellow";

export function LandingFooter() {
  const { copy } = useLandingLanguage();
  const { footer } = copy;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-landing-ink text-white">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 sm:py-16">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              alt=""
              aria-hidden
              className="h-8 w-auto"
              height={233}
              loading="lazy"
              src="/landing/mark-w.png"
              width={256}
            />
            <span className="font-bold text-xl">Zay</span>
          </div>
          <p className="mt-4 max-w-xs text-landing-on-dark-muted">
            {footer.tagline}
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-landing-yellow text-sm uppercase tracking-wider">
            {footer.contactTitle}
          </h2>
          <address className="mt-4 space-y-1 text-landing-on-dark-muted not-italic">
            <p className="flex min-h-11 items-center gap-3">
              <MapPin aria-hidden className="size-5 shrink-0" />
              <span className="sr-only">{footer.cityLabel} : </span>
              {footer.city}
            </p>
            <p>
              <a className={CONTACT_LINK} href={`mailto:${CONTACT.email}`}>
                <Mail aria-hidden className="size-5 shrink-0" />
                <span className="sr-only">{footer.emailLabel} : </span>
                <span className="break-all">{CONTACT.email}</span>
              </a>
            </p>
            <p>
              <a className={CONTACT_LINK} href={CONTACT.phoneHref}>
                <Phone aria-hidden className="size-5 shrink-0" />
                <span className="sr-only">{footer.phoneLabel} : </span>
                {CONTACT.phoneDisplay}
              </a>
            </p>
          </address>
        </div>
      </Container>

      <div className="border-white/10 border-t">
        <Container className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 text-landing-on-dark-muted text-sm">
          <p>© {year} Zay</p>
          <Link
            className="inline-flex min-h-11 items-center rounded-md outline-offset-2 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-landing-yellow"
            to="/login"
          >
            {footer.admin}
          </Link>
        </Container>
      </div>
    </footer>
  );
}
