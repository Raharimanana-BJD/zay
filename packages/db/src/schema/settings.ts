import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { createdAt, newId } from "./columns";
import { vehicleCategory } from "./enums";

/** Never modified, only versioned. The current version is the highest one. */
export const settingsVersion = pgTable(
  "settings_version",
  {
    id: newId(),
    version: integer("version").notNull().unique(),
    priceVariationPct: integer("price_variation_pct").notNull(),
    groupMinDrivers: integer("group_min_drivers").notNull(),
    groupMaxDrivers: integer("group_max_drivers").notNull(),
    driverResponseS: integer("driver_response_s").notNull(),
    groupPauseS: integer("group_pause_s").notNull(),
    maxGroups: integer("max_groups").notNull(),
    clientResponseS: integer("client_response_s").notNull(),
    driverCounterResponseS: integer("driver_counter_response_s").notNull(),
    gpsMaxAgeS: integer("gps_max_age_s").notNull(),
    changeNote: text("change_note"),
    /** Empty only for version 1, which the seed migration writes. */
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "settings_version_group_range",
      sql`${t.groupMinDrivers} <= ${t.groupMaxDrivers}`
    ),
    check(
      "settings_version_price_variation_range",
      sql`${t.priceVariationPct} BETWEEN 0 AND 100`
    ),
  ]
);

export const categoryFare = pgTable(
  "category_fare",
  {
    settingsVersionId: uuid("settings_version_id")
      .notNull()
      .references(() => settingsVersion.id, { onDelete: "restrict" }),
    category: vehicleCategory("category").notNull(),
    baseFareAr: integer("base_fare_ar").notNull(),
    perKmAr: integer("per_km_ar").notNull(),
    includedM: integer("included_m").notNull(),
    roundingAr: integer("rounding_ar").notNull(),
    maxCapacity: integer("max_capacity").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.settingsVersionId, t.category] }),
    check("category_fare_rounding_positive", sql`${t.roundingAr} > 0`),
  ]
);
