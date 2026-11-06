import { pgEnum } from "drizzle-orm/pg-core";

export const vehicleCategory = pgEnum("vehicle_category", ["car", "tuk_tuk"]);
export const requestedCategory = pgEnum("requested_category", [
  "car",
  "tuk_tuk",
  "auto",
]);
export const employmentRelation = pgEnum("employment_relation", [
  "owner",
  "renter",
  "employee",
]);
export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
  "changes_requested",
  "suspended",
]);
export const verificationSubject = pgEnum("verification_subject", [
  "driver",
  "vehicle",
  "document",
]);
export const zoneKind = pgEnum("zone_kind", [
  "pickup",
  "destination",
  "driver",
]);
export const bookingStatus = pgEnum("booking_status", [
  "PENDING",
  "SEARCHING",
  "OFFERED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "NO_DRIVER_FOUND",
  "DISPUTED",
]);
export const actorKind = pgEnum("actor_kind", [
  "client",
  "driver",
  "admin",
  "support",
  "system",
]);
export const distanceSource = pgEnum("distance_source", ["route", "fallback"]);
export const dispatchGroupStatus = pgEnum("dispatch_group_status", [
  "active",
  "paused",
  "exhausted",
  "closed",
]);
export const offerStatus = pgEnum("offer_status", [
  "sent",
  "priced",
  "negotiating",
  "accepted",
  "refused",
  "expired",
  "void",
  "withdrawn",
]);
export const proposalKind = pgEnum("proposal_kind", [
  "accept",
  "propose",
  "counter",
  "refuse",
]);
export const destinationChangeStatus = pgEnum("destination_change_status", [
  "pending",
  "applied",
  "refused",
  "expired",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "partial",
  "paid",
  "disputed",
]);
export const paymentMethod = pgEnum("payment_method", ["cash"]);
export const paymentEventKind = pgEnum("payment_event_kind", [
  "declared",
  "disputed",
  "resolved",
]);
export const reportStatus = pgEnum("report_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export const subscriptionPaymentStatus = pgEnum("subscription_payment_status", [
  "pending",
  "succeeded",
  "failed",
]);
