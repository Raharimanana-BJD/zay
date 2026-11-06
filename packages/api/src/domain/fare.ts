const PERCENT = 100;
const METERS_PER_KM = 1000;

export interface FareRule {
  baseFareAr: number;
  includedM: number;
  perKmAr: number;
  roundingAr: number;
}

export interface FareAmounts {
  amountAr: number;
  maxAr: number;
  minAr: number;
}

/** Rounds inward at both bounds, so they stay within the allowed variation. */
export function computeFare(
  rule: FareRule,
  distanceM: number,
  priceVariationPct: number
): FareAmounts {
  const { baseFareAr, perKmAr, includedM, roundingAr } = rule;
  const billableKm = Math.max(distanceM - includedM, 0) / METERS_PER_KM;
  const amountAr =
    Math.round((baseFareAr + billableKm * perKmAr) / roundingAr) * roundingAr;
  const minAr =
    Math.ceil(
      (amountAr * (PERCENT - priceVariationPct)) / (PERCENT * roundingAr)
    ) * roundingAr;
  const maxAr =
    Math.floor(
      (amountAr * (PERCENT + priceVariationPct)) / (PERCENT * roundingAr)
    ) * roundingAr;
  return { amountAr, minAr, maxAr };
}
