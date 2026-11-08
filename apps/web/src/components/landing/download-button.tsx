import { cn } from "@zay-app/ui/lib/utils";
import { Clock, Download } from "lucide-react";

import { ENV } from "@/env";
import { useLandingLanguage } from "@/lib/landing/language";

type Tone = "ink" | "yellow";

const TONES: Record<Tone, string> = {
  ink: "bg-landing-ink text-white hover:bg-landing-ink-soft focus-visible:outline-landing-ink",
  yellow:
    "bg-landing-yellow text-landing-ink hover:bg-landing-yellow-hover focus-visible:outline-landing-yellow",
};

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full px-6 font-medium text-base outline-offset-3 focus-visible:outline-2 landing-press";

/**
 * Links to the APK when `VITE_APK_URL` is set; otherwise a disabled
 * "coming soon" button, so the page still works without it (spec 0007, AC-6).
 */
export function DownloadButton({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: Tone;
}) {
  const { copy } = useLandingLanguage();
  const apkUrl = ENV.VITE_APK_URL;

  if (!apkUrl) {
    return (
      <button
        className={cn(
          BASE,
          "cursor-not-allowed border border-current/25 bg-transparent opacity-70",
          tone === "yellow" ? "text-white" : "text-landing-ink",
          className
        )}
        disabled
        type="button"
      >
        <Clock aria-hidden className="size-5" />
        {copy.download.soon}
      </button>
    );
  }

  return (
    <a className={cn(BASE, TONES[tone], className)} download href={apkUrl}>
      <Download aria-hidden className="size-5" />
      {copy.download.label}
    </a>
  );
}
