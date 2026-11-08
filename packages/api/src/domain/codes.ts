// Lists the server controls and the language files translate. A feature can add
// values here without a migration, because the columns that hold them are text.

export const BOOKING_EVENT_TYPES = [
  "status_changed",
  "booking_created",
  "driver_assigned",
  "driver_replaced",
  "destination_requested",
  "destination_applied",
  "destination_refused",
  "destination_expired",
  "dispute_opened",
  "dispute_closed",
] as const;

export const CANCELLATION_REASONS = [
  "client_changed_mind",
  "driver_unavailable",
  "client_absent",
  "driver_absent",
  "support_intervention",
  "other",
] as const;

export const PRICE_ADJUSTMENT_REASONS = [
  "distance_differs",
  "difficult_road",
  "difficult_destination",
  "other",
] as const;

export const REPORT_TYPES = [
  "client_absent",
  "driver_absent",
  "payment_issue",
  "safety",
  "help",
  "other",
] as const;

export const VERIFICATION_REJECTION_REASONS = [
  "document_unreadable",
  "document_expired",
  "information_mismatch",
  "other",
] as const;

export const SUSPENSION_REASONS = [
  "safety",
  "fraud",
  "document_issue",
  "behavior",
  "other",
] as const;

export const DISPUTE_REASONS = [
  "payment",
  "price",
  "behavior",
  "other",
] as const;

export const PAYMENT_RESOLUTION_REASONS = [
  "driver_confirmed",
  "client_confirmed",
  "agreement",
  "other",
] as const;

export const DRIVER_DOCUMENT_TYPES = [
  "driving_license",
  "national_id",
  "vehicle_registration",
  "insurance",
] as const;

/** These papers belong to a vehicle; the others belong to the driver. */
export const VEHICLE_DOCUMENT_TYPES = [
  "vehicle_registration",
  "insurance",
] as const satisfies readonly (typeof DRIVER_DOCUMENT_TYPES)[number][];

export const isVehicleDocumentType = (typeCode: string) =>
  (VEHICLE_DOCUMENT_TYPES as readonly string[]).includes(typeCode);

export const AUDIT_ACTIONS = [
  "account.banned",
  "account.unbanned",
  "team.created",
  "team.role_changed",
] as const;
