import { customType, geometry, timestamp, uuid } from "drizzle-orm/pg-core";

// The server runs on Bun, but the apps also read these types through tRPC, and they
// do not load the Bun types.
declare const Bun: { randomUUIDv7: () => string };

const SRID_WGS84 = 4326;

export type MultiPolygonWkt = string;

/** Primary key filled by the server with a time ordered UUID v7. */
export const newId = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => Bun.randomUUIDv7());

/** A point stored as `{ x: longitude, y: latitude }`. */
export const point = (name: string) =>
  geometry(name, { type: "point", mode: "xy", srid: SRID_WGS84 });

/** A service area. Writes take WKT, reads return the hex form PostGIS stores. */
export const multiPolygon = customType<{
  data: MultiPolygonWkt;
  driverData: string;
}>({
  dataType: () => `geometry(MultiPolygon, ${SRID_WGS84})`,
});

export const dateTime = (name: string) =>
  timestamp(name, { withTimezone: true });

export const createdAt = () =>
  dateTime("created_at")
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  dateTime("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());
