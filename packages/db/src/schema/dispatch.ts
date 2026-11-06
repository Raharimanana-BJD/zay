import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { booking, fareQuote } from "./bookings";
import { createdAt, dateTime, newId, updatedAt } from "./columns";
import { driverProfile, vehicle } from "./drivers";
import {
  actorKind,
  dispatchGroupStatus,
  offerStatus,
  proposalKind,
  vehicleCategory,
} from "./enums";

export const dispatchGroup = pgTable(
  "dispatch_group",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    status: dispatchGroupStatus("status").notNull().default("active"),
    startedAt: dateTime("started_at").notNull(),
    expiresAt: dateTime("expires_at").notNull(),
    endedAt: dateTime("ended_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("dispatch_group_booking_sequence_uq").on(
      t.bookingId,
      t.sequence
    ),
  ]
);

export const offer = pgTable(
  "offer",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "restrict" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => dispatchGroup.id, { onDelete: "restrict" }),
    driverId: text("driver_id")
      .notNull()
      .references(() => driverProfile.userId, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicle.id, { onDelete: "restrict" }),
    fareQuoteId: uuid("fare_quote_id")
      .notNull()
      .references(() => fareQuote.id, { onDelete: "restrict" }),
    category: vehicleCategory("category").notNull(),
    status: offerStatus("status").notNull().default("sent"),
    currentPriceAr: integer("current_price_ar"),
    expiresAt: dateTime("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("offer_booking_driver_uq")
      .on(t.bookingId, t.driverId)
      .where(sql`${t.status} <> 'void'`),
    uniqueIndex("offer_driver_open_uq")
      .on(t.driverId)
      .where(sql`${t.status} IN ('sent', 'priced', 'negotiating')`),
    uniqueIndex("offer_booking_negotiating_uq")
      .on(t.bookingId)
      .where(sql`${t.status} = 'negotiating'`),
    uniqueIndex("offer_booking_accepted_uq")
      .on(t.bookingId)
      .where(sql`${t.status} = 'accepted'`),
  ]
);

export const offerProposal = pgTable(
  "offer_proposal",
  {
    id: newId(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offer.id, { onDelete: "restrict" }),
    actorKind: actorKind("actor_kind").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: proposalKind("kind").notNull(),
    amountAr: integer("amount_ar"),
    reasonCode: text("reason_code"),
    reasonNote: text("reason_note"),
    clientRequestId: uuid("client_request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("offer_proposal_actor_request_uq").on(
      t.actorId,
      t.clientRequestId
    ),
    index("offer_proposal_offer_created_idx").on(t.offerId, t.createdAt),
  ]
);
