export type ResolvedPaymentStatus = "pending" | "partial" | "paid";

/** The rule from spec 0001: nothing declared is pending, less than agreed is partial. */
export function paymentStatusFor(
  amountAr: number,
  agreedAmountAr: number
): ResolvedPaymentStatus {
  if (amountAr === 0) {
    return "pending";
  }
  return amountAr < agreedAmountAr ? "partial" : "paid";
}
