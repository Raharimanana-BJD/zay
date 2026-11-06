import type { Database } from "@zay-app/db";
import { serviceZone } from "@zay-app/db/schema/places";
import { categoryFare, settingsVersion } from "@zay-app/db/schema/settings";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Transaction } from "./booking-status";
import { computeFare } from "./fare";

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";
const ROUTE_TIMEOUT_MS = 3000;
/** Roads are never straight. This keeps a fallback price close to a real one. */
const FALLBACK_ROAD_FACTOR = 1.3;

export type VehicleCategory = "car" | "tuk_tuk";
export type RequestedCategory = VehicleCategory | "auto";
type Reader = Database | Transaction;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  distanceM: number;
  /** `[lng, lat]` pairs for the map, only when the routing service answered. */
  line: [number, number][] | null;
  source: "route" | "fallback";
}

export const pointSql = ({ lat, lng }: Coordinates) =>
  sql`ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326)`;

export const categoriesOf = (
  requested: RequestedCategory
): VehicleCategory[] =>
  requested === "auto" ? ["car", "tuk_tuk"] : [requested];

async function straightLineM(db: Reader, from: Coordinates, to: Coordinates) {
  const result = await db.execute<{ meters: number | string }>(
    sql`SELECT ST_Distance(${pointSql(from)}::geography, ${pointSql(to)}::geography) AS meters`
  );
  const [row] = result.rows as { meters: number | string }[];
  return Number(row?.meters ?? 0);
}

async function fetchRoute(from: Coordinates, to: Coordinates) {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const response = await fetch(
    `${OSRM_URL}/${path}?overview=simplified&geometries=geojson`,
    { signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS) }
  );
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as {
    routes?: {
      distance: number;
      geometry: { coordinates: [number, number][] };
    }[];
  };
  return body.routes?.[0] ?? null;
}

/** The routing service, then a calculated distance if it fails or is too slow. */
export async function estimateRoute(
  db: Reader,
  from: Coordinates,
  to: Coordinates
): Promise<RouteEstimate> {
  try {
    const route = await fetchRoute(from, to);
    if (route) {
      return {
        distanceM: Math.round(route.distance),
        line: route.geometry.coordinates,
        source: "route",
      };
    }
  } catch {
    // Same answer as an empty route: the rider must still get a price.
  }
  const straight = await straightLineM(db, from, to);
  return {
    distanceM: Math.round(straight * FALLBACK_ROAD_FACTOR),
    line: null,
    source: "fallback",
  };
}

export async function latestSettings(db: Reader) {
  const [settings] = await db
    .select()
    .from(settingsVersion)
    .orderBy(desc(settingsVersion.version))
    .limit(1);
  if (!settings) {
    throw new Error("No settings version");
  }
  return settings;
}

export async function settingsById(db: Reader, id: string) {
  const [settings] = await db
    .select()
    .from(settingsVersion)
    .where(eq(settingsVersion.id, id));
  if (!settings) {
    throw new Error("Unknown settings version");
  }
  return settings;
}

export const faresOf = (db: Reader, settingsVersionId: string) =>
  db
    .select()
    .from(categoryFare)
    .where(eq(categoryFare.settingsVersionId, settingsVersionId));

export interface CategoryQuote extends ReturnType<typeof computeFare> {
  category: VehicleCategory;
  maxCapacity: number;
  roundingAr: number;
}

/** A category too small for the group gets no quote, per spec 0001. */
export function quotesFor(
  fares: (typeof categoryFare.$inferSelect)[],
  categories: VehicleCategory[],
  passengers: number,
  distanceM: number,
  priceVariationPct: number
): CategoryQuote[] {
  return fares
    .filter(
      (fare) =>
        categories.includes(fare.category) && passengers <= fare.maxCapacity
    )
    .map((fare) => ({
      ...computeFare(fare, distanceM, priceVariationPct),
      category: fare.category,
      maxCapacity: fare.maxCapacity,
      roundingAr: fare.roundingAr,
    }));
}

/** With no active zone of this kind every place is accepted, per spec 0001. */
export async function isInZone(
  db: Reader,
  kind: "pickup" | "destination",
  point: Coordinates
): Promise<boolean> {
  const activeOfKind = and(
    eq(serviceZone.kind, kind),
    eq(serviceZone.isActive, true)
  );
  const [zones] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceZone)
    .where(activeOfKind);
  if (!zones?.total) {
    return true;
  }
  const [inside] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceZone)
    .where(
      and(
        activeOfKind,
        sql`ST_Contains(${serviceZone.area}, ${pointSql(point)})`
      )
    );
  return (inside?.total ?? 0) > 0;
}
