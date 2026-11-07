import type { TKey } from "@/lib/i18n";

const THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const METERS_PER_KM = 1000;
const MINUTE_S = 60;

/** The same amount format everywhere: `12 500 Ar`. */
export const formatAr = (amount: number | null | undefined) =>
  amount === null || amount === undefined
    ? "—"
    : `${String(amount).replace(THOUSANDS, " ")} Ar`;

export const formatDistance = (meters: number | null | undefined) => {
  if (meters === null || meters === undefined) {
    return "—";
  }
  return meters < METERS_PER_KM
    ? `${meters} m`
    : `${(meters / METERS_PER_KM).toFixed(1).replace(".", ",")} km`;
};

export const formatDate = (value: Date | string, locale: string) =>
  new Date(value).toLocaleString(locale === "mg" ? "fr-MG" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Indian/Antananarivo",
  });

export const formatAge = (
  seconds: number,
  t: (key: TKey, values?: Record<string, string | number>) => string
) =>
  seconds < MINUTE_S
    ? t("common.ageSeconds", { n: seconds })
    : t("common.ageMinutes", { n: Math.floor(seconds / MINUTE_S) });

/** Good enough for a retry key. It is not a secret, and only this user's rows use it. */
export const newRequestId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random % 4) + 8;
    return value.toString(16);
  });

const TIME_ZONE = "Indian/Antananarivo";
const MS_PER_DAY = 86_400_000;
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A day only, like `07/11/2026`, in Antananarivo time. */
export const formatDay = (value: Date | string, locale: string) =>
  new Date(value).toLocaleDateString(locale === "mg" ? "fr-MG" : "fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });

/** Whole days from today to that date, both read in Antananarivo time. Negative once past. */
export function daysUntil(value: Date | string, now = new Date()) {
  const toUtcDay = (date: Date) =>
    Date.parse(`${dayKey.format(date)}T00:00:00Z`);
  return Math.round((toUtcDay(new Date(value)) - toUtcDay(now)) / MS_PER_DAY);
}
