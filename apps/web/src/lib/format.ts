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
