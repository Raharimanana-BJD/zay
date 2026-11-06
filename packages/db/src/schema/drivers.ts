import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  foreignKey,
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
import {
  employmentRelation,
  vehicleCategory,
  verificationStatus,
  verificationSubject,
} from "./enums";

export const driverProfile = pgTable(
  "driver_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    employmentRelation: employmentRelation("employment_relation").notNull(),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("pending"),
    isOnline: boolean("is_online").notNull().default(false),
    isAvailable: boolean("is_available").notNull().default(false),
    isSimulated: boolean("is_simulated").notNull().default(false),
    activeVehicleId: uuid("active_vehicle_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The one circular link of this group, so it is declared here and not on the column.
    foreignKey({
      name: "driver_profile_active_vehicle_id_vehicle_id_fk",
      columns: [t.activeVehicleId],
      foreignColumns: [vehicle.id],
    }).onDelete("restrict"),
    check(
      "driver_profile_available_requires_online",
      sql`NOT ${t.isAvailable} OR ${t.isOnline}`
    ),
  ]
);

export const vehicle = pgTable(
  "vehicle",
  {
    id: newId(),
    driverId: text("driver_id")
      .notNull()
      .references((): AnyPgColumn => driverProfile.userId, {
        onDelete: "restrict",
      }),
    category: vehicleCategory("category").notNull(),
    make: text("make"),
    model: text("model").notNull(),
    registration: text("registration"),
    capacity: integer("capacity").notNull(),
    photoKey: text("photo_key"),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("pending"),
    archivedAt: dateTime("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("vehicle_registration_active_uq")
      .on(t.registration)
      .where(sql`${t.archivedAt} IS NULL AND ${t.registration} IS NOT NULL`),
    index("vehicle_driver_id_idx").on(t.driverId),
    check("vehicle_capacity_positive", sql`${t.capacity} >= 1`),
  ]
);

export const driverDocument = pgTable(
  "driver_document",
  {
    id: newId(),
    driverId: text("driver_id")
      .notNull()
      .references(() => driverProfile.userId, { onDelete: "restrict" }),
    vehicleId: uuid("vehicle_id").references(() => vehicle.id, {
      onDelete: "restrict",
    }),
    typeCode: text("type_code").notNull(),
    storageKey: text("storage_key").notNull(),
    expiresAt: dateTime("expires_at"),
    verificationStatus: verificationStatus("verification_status")
      .notNull()
      .default("pending"),
    replacedAt: dateTime("replaced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("driver_document_driver_id_idx").on(t.driverId)]
);

export const verificationDecision = pgTable(
  "verification_decision",
  {
    id: newId(),
    subject: verificationSubject("subject").notNull(),
    subjectId: text("subject_id").notNull(),
    status: verificationStatus("status").notNull(),
    reasonCode: text("reason_code"),
    reasonNote: text("reason_note"),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("verification_decision_subject_idx").on(
      t.subject,
      t.subjectId,
      t.createdAt
    ),
  ]
);

export const driverPosition = pgTable(
  "driver_position",
  {
    driverId: text("driver_id")
      .primaryKey()
      .references(() => driverProfile.userId, { onDelete: "restrict" }),
    point: point("point").notNull(),
    accuracyM: doublePrecision("accuracy_m"),
    /** Time on the phone. A write only replaces the row when this is newer. */
    recordedAt: dateTime("recorded_at").notNull(),
    /** Time on the server. Freshness checks read this one. */
    receivedAt: dateTime("received_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("driver_position_point_gist").using("gist", t.point)]
);
