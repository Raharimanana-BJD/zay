import { reasonLabel } from "@/lib/labels";

/** `ban_reason` holds `code` or `code: note`, cut at the first `: `. */
export function banReasonText(banReason: string | null): string {
  if (!banReason) {
    return "Sans motif";
  }
  const separator = banReason.indexOf(": ");
  if (separator === -1) {
    return reasonLabel(banReason);
  }
  return `${reasonLabel(banReason.slice(0, separator))} : ${banReason.slice(separator + 2)}`;
}
