const TIME_ZONE = "Indian/Antananarivo";

const numberFormat = new Intl.NumberFormat("fr-FR");
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const NARROW_SPACES = /[  ]/g;

/** Whole ariary with plain spaces: `12 500 Ar`. */
export const formatAr = (amount: number) =>
  `${numberFormat.format(amount).replace(NARROW_SPACES, " ")} Ar`;

export const formatDateTime = (date: Date | string) =>
  dateTimeFormat.format(new Date(date));

/** Display a booking price: agreed, else the lowest active quote, marked as estimated. */
export function priceLabel(
  agreedAr: number | null,
  estimatedAr?: number | null
) {
  if (agreedAr !== null) {
    return formatAr(agreedAr);
  }
  return typeof estimatedAr === "number"
    ? `${formatAr(estimatedAr)} (estimé)`
    : "Non défini";
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

/** How long ago a position arrived: `il y a 12 s`, `il y a 3 min`, `il y a 2 h`. */
export function formatAge(ageS: number) {
  if (ageS < SECONDS_PER_MINUTE) {
    return `il y a ${ageS} s`;
  }
  if (ageS < SECONDS_PER_HOUR) {
    return `il y a ${Math.floor(ageS / SECONDS_PER_MINUTE)} min`;
  }
  return `il y a ${Math.floor(ageS / SECONDS_PER_HOUR)} h`;
}
