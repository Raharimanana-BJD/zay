import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { booking } from "./bookings";
import { createdAt, newId, updatedAt } from "./columns";
import {
  actorKind,
  paymentEventKind,
  paymentMethod,
  paymentStatus,
} from "./enums";

export const payment = pgTable(
  "payment",
  {
    id: newId(),
    bookingId: uuid("booking_id")
      .notNull()
      .unique()
      .references(() => booking.id, { onDelete: "restrict" }),
    method: paymentMethod("method").notNull().default("cash"),
    agreedAmountAr: integer("agreed_amount_ar").notNull(),
    declaredAmountAr: integer("declared_amount_ar"),
    status: paymentStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("payment_declared_not_negative", sql`${t.declaredAmountAr} >= 0`),
  ]
);

export const paymentEvent = pgTable(
  "payment_event",
  {
    id: newId(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payment.id, { onDelete: "restrict" }),
    kind: paymentEventKind("kind").notNull(),
    amountAr: integer("amount_ar"),
    actorKind: actorKind("actor_kind").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reasonCode: text("reason_code"),
    reasonNote: text("reason_note"),
    clientRequestId: uuid("client_request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("payment_event_actor_request_uq").on(
      t.actorId,
      t.clientRequestId
    ),
    index("payment_event_payment_id_idx").on(t.paymentId),
    check(
      "payment_event_actor_required",
      sql`${t.actorKind} = 'system' OR ${t.actorId} IS NOT NULL`
    ),
  ]
);
