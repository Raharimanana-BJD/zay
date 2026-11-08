import { cn } from "@zay-app/ui/lib/utils";
import type { ReactNode } from "react";

/** The centred content column shared by every band of the landing page. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-8", className)}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  id,
  lead,
  title,
  tone = "light",
}: {
  id: string;
  lead?: string;
  title: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div className="max-w-2xl">
      <h2
        className="text-balance font-bold text-3xl leading-tight sm:text-4xl sm:leading-[1.2]"
        id={id}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cn(
            "mt-4 text-pretty text-lg leading-relaxed",
            isDark ? "text-landing-on-dark-muted" : "text-landing-muted"
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
