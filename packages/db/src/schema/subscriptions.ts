import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, dateTime, newId, updatedAt } from "./columns";
import { driverProfile } from "./drivers";
import { subscriptionPaymentStatus } from "./enums";

export const subscriptionPlan = pgTable(
  "subscription_plan",
  {
    id: newId(),
    name: text("name").notNull(),
    priceAr: integer("price_ar").notNull(),
    durationDays: integer("duration_days").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("subscription_plan_price_positive", sql`${t.priceAr} > 0`),
    check("subscription_plan_duration_positive", sql`${t.durationDays} > 0`),
  ]
);

export const subscriptionPayment = pgTable(
  "subscription_payment",
  {
    id: newId(),
    driverId: text("driver_id")
      .notNull()
      .references(() => driverProfile.userId, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlan.id, { onDelete: "restrict" }),
    amountAr: integer("amount_ar").notNull(),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    status: subscriptionPaymentStatus("status").notNull().default("pending"),
    clientRequestId: uuid("client_request_id").notNull(),
    confirmedAt: dateTime("confirmed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscription_payment_provider_reference_uq").on(
      t.provider,
      t.providerReference
    ),
    uniqueIndex("subscription_payment_driver_request_uq").on(
      t.driverId,
      t.clientRequestId
    ),
  ]
);

export const subscriptionPeriod = pgTable(
  "subscription_period",
  {
    id: newId(),
    driverId: text("driver_id")
      .notNull()
      .references(() => driverProfile.userId, { onDelete: "restrict" }),
    paymentId: uuid("payment_id")
      .notNull()
      .unique()
      .references(() => subscriptionPayment.id, { onDelete: "restrict" }),
    startsAt: dateTime("starts_at").notNull(),
    endsAt: dateTime("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("subscription_period_driver_ends_idx").on(t.driverId, t.endsAt)]
);
