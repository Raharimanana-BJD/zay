import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  createdAt,
  dateTime,
  multiPolygon,
  newId,
  point,
  updatedAt,
} from "./columns";
import { zoneKind } from "./enums";

export const district = pgTable(
  "district",
  {
    id: newId(),
    name: text("name").notNull(),
    point: point("point").notNull(),
    archivedAt: dateTime("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("district_name_active_uq")
      .on(t.name)
      .where(sql`${t.archivedAt} IS NULL`),
  ]
);

export const landmark = pgTable(
  "landmark",
  {
    id: newId(),
    name: text("name").notNull(),
    point: point("point").notNull(),
    districtId: uuid("district_id").references(() => district.id, {
      onDelete: "restrict",
    }),
    archivedAt: dateTime("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("landmark_district_id_idx").on(t.districtId)]
);

export const serviceZone = pgTable(
  "service_zone",
  {
    id: newId(),
    kind: zoneKind("kind").notNull(),
    name: text("name").notNull(),
    area: multiPolygon("area").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("service_zone_area_gist").using("gist", t.area)]
);
