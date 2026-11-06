import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { createdAt, dateTime, newId, point, updatedAt } from "./columns";
import { driverProfile, vehicle } from "./drivers";
import {
  actorKind,
  bookingStatus,
  destinationChangeStatus,
  distanceSource,
  requestedCategory,
  vehicleCategory,
} from "./enums";
import { district, landmark } from "./places";
import { settingsVersion } from "./settings";

export const booking = pgTable(
  "booking",
  {
    id: newId(),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    clientRequestId: uuid("client_request_id").notNull(),
    requestedCategory: requestedCategory("requested_category").notNull(),
    passengers: integer("passengers").notNull(),
    status: bookingStatus("status").notNull().default("PENDING"),
    settingsVersionId: uuid("settings_version_id")
      .notNull()
      .references(() => settingsVersion.id, { onDelete: "restrict" }),
    driverId: text("driver_id").references(() => driverProfile.userId, {
      onDelete: "restrict",
    }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
      onDelete: "restrict",
    }),
    agreedPriceAr: integer("agreed_price_ar"),
    pickupPoint: point("pickup_point").notNull(),
    pickupNote: text("pickup_note"),
    pickupDistrictId: uuid("pickup_district_id").references(() => district.id, {
      onDelete: "restrict",
    }),
    pickupLandmarkId: uuid("pickup_landmark_id").references(() => landmark.id, {
      onDelete: "restrict",
    }),
    destinationPoint: point("destination_point").notNull(),
    destinationNote: text("destination_note"),
    destinationDistrictId: uuid("destination_district_id").references(
      () => district.id,
      {
        onDelete: "restrict",
      }
    ),
    destinationLandmarkId: uuid("destination_landmark_id").references(
      () => landmark.id,
      {
        onDelete: "restrict",
      }
    ),
    statusChangedAt: dateTime("status_changed_at").notNull(),
    completedAt: dateTime("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("booking_client_request_uq").on(t.clientId, t.clientRequestId),
    uniqueIndex("booking_driver_active_uq")
      .on(t.driverId)
      .where(
        sql`${t.status} IN ('ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS')`
      ),
    index("booking_client_created_idx").on(t.clientId, t.createdAt),
    index("booking_driver_created_idx").on(t.driverId, t.createdAt),
    index("booking_status_idx").on(t.status),
    check("booking_passengers_positive", sql`${t.passengers} >= 1`),
    check(
      "booking_assigned_has_driver_vehicle_price",
      sql`${t.status} NOT IN ('ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED')
        OR (${t.driverId} IS NOT NULL AND ${t.vehicleId} IS NOT NULL AND ${t.agreedPriceAr} IS NOT NULL)`
    ),
  ]
);

export const bookingEvent = pgTable(
  "booking_event",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    fromStatus: bookingStatus("from_status"),
    toStatus: bookingStatus("to_status"),
    actorKind: actorKind("actor_kind").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reasonCode: text("reason_code"),
    reasonNote: text("reason_note"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    clientRequestId: uuid("client_request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("booking_event_actor_request_uq").on(
      t.actorId,
      t.clientRequestId
    ),
    index("booking_event_booking_created_idx").on(t.bookingId, t.createdAt),
    check(
      "booking_event_actor_required",
      sql`${t.actorKind} = 'system' OR ${t.actorId} IS NOT NULL`
    ),
  ]
);

export const fareQuote = pgTable(
  "fare_quote",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    category: vehicleCategory("category").notNull(),
    settingsVersionId: uuid("settings_version_id")
      .notNull()
      .references(() => settingsVersion.id, { onDelete: "restrict" }),
    distanceM: integer("distance_m").notNull(),
    distanceSource: distanceSource("distance_source").notNull(),
    amountAr: integer("amount_ar").notNull(),
    minAr: integer("min_ar").notNull(),
    maxAr: integer("max_ar").notNull(),
    replacedAt: dateTime("replaced_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("fare_quote_active_uq")
      .on(t.bookingId, t.category)
      .where(sql`${t.replacedAt} IS NULL`),
  ]
);

export const destinationChange = pgTable(
  "destination_change",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    oldPoint: point("old_point").notNull(),
    oldNote: text("old_note"),
    oldDistrictId: uuid("old_district_id").references(() => district.id, {
      onDelete: "restrict",
    }),
    oldLandmarkId: uuid("old_landmark_id").references(() => landmark.id, {
      onDelete: "restrict",
    }),
    newPoint: point("new_point").notNull(),
    newNote: text("new_note"),
    newDistrictId: uuid("new_district_id").references(() => district.id, {
      onDelete: "restrict",
    }),
    newLandmarkId: uuid("new_landmark_id").references(() => landmark.id, {
      onDelete: "restrict",
    }),
    newDistanceM: integer("new_distance_m").notNull(),
    newDistanceSource: distanceSource("new_distance_source").notNull(),
    settingsVersionId: uuid("settings_version_id")
      .notNull()
      .references(() => settingsVersion.id, { onDelete: "restrict" }),
    oldPriceAr: integer("old_price_ar").notNull(),
    newPriceAr: integer("new_price_ar").notNull(),
    /** Filled only when the change moves to `applied`. */
    fareQuoteId: uuid("fare_quote_id").references(() => fareQuote.id, {
      onDelete: "restrict",
    }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    clientAcceptedAt: dateTime("client_accepted_at"),
    driverAcceptedAt: dateTime("driver_accepted_at"),
    status: destinationChangeStatus("status").notNull().default("pending"),
    expiresAt: dateTime("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("destination_change_pending_uq")
      .on(t.bookingId)
      .where(sql`${t.status} = 'pending'`),
    index("destination_change_booking_id_idx").on(t.bookingId),
  ]
);
