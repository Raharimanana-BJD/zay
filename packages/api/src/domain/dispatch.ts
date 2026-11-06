// biome-ignore-all lint/performance/noAwaitInLoops: each booking gets its own transaction
import type { Database } from "@zay-app/db";
import { user } from "@zay-app/db/schema/auth";
import {
  booking,
  bookingEvent,
  destinationChange,
  fareQuote,
} from "@zay-app/db/schema/bookings";
import { dispatchGroup, offer } from "@zay-app/db/schema/dispatch";
import {
  driverDocument,
  driverPosition,
  driverProfile,
  vehicle,
} from "@zay-app/db/schema/drivers";
import { serviceZone } from "@zay-app/db/schema/places";
import type { settingsVersion } from "@zay-app/db/schema/settings";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { type Transaction, transitionBooking } from "./booking-status";
import { pointSql, settingsById } from "./trip";

const MS_PER_S = 1000;
/** Too little time left to answer: the next group gets this driver instead. */
const MIN_FILL_WINDOW_MS = 5000;
const DISTANCE_BAND_M = 500;

export const OPEN_OFFERS = ["sent", "priced", "negotiating"] as const;
export const ACTIVE_RIDE = [
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
] as const;
const SEARCH_STATUSES = ["SEARCHING", "OFFERED"] as const;

type Booking = typeof booking.$inferSelect;
type Group = typeof dispatchGroup.$inferSelect;
type Settings = typeof settingsVersion.$inferSelect;

const SYSTEM = { actorKind: "system", actorId: null } as const;

const secondsAfter = (from: Date, seconds: number) =>
  new Date(from.getTime() + seconds * MS_PER_S);

/** Every rule of cahier §8.2 that a driver must meet to receive this request. */
function findEligibleDrivers(
  tx: Transaction,
  ride: Booking,
  categories: ("car" | "tuk_tuk")[],
  settings: Settings,
  now: Date
) {
  const { x, y } = ride.pickupPoint;
  const distanceToPickup = sql`ST_Distance(${driverPosition.point}::geography, ${pointSql({ lat: y, lng: x })}::geography)`;
  const activeDriverZone = and(
    eq(serviceZone.kind, "driver"),
    eq(serviceZone.isActive, true)
  );

  return tx
    .select({
      driverId: driverProfile.userId,
      vehicleId: vehicle.id,
      category: vehicle.category,
    })
    .from(driverProfile)
    .innerJoin(user, eq(user.id, driverProfile.userId))
    .innerJoin(vehicle, eq(vehicle.id, driverProfile.activeVehicleId))
    .innerJoin(
      driverPosition,
      eq(driverPosition.driverId, driverProfile.userId)
    )
    .where(
      and(
        eq(user.role, "driver"),
        sql`coalesce(${user.banned}, false) = false`,
        eq(driverProfile.verificationStatus, "approved"),
        eq(driverProfile.isOnline, true),
        eq(driverProfile.isAvailable, true),
        eq(vehicle.verificationStatus, "approved"),
        isNull(vehicle.archivedAt),
        inArray(vehicle.category, categories),
        gte(vehicle.capacity, ride.passengers),
        gt(driverPosition.receivedAt, secondsAfter(now, -settings.gpsMaxAgeS)),
        notExists(
          tx
            .select({ id: booking.id })
            .from(booking)
            .where(
              and(
                eq(booking.driverId, driverProfile.userId),
                inArray(booking.status, [...ACTIVE_RIDE])
              )
            )
        ),
        notExists(
          tx
            .select({ id: offer.id })
            .from(offer)
            .where(
              and(
                eq(offer.driverId, driverProfile.userId),
                or(
                  inArray(offer.status, [...OPEN_OFFERS]),
                  and(eq(offer.bookingId, ride.id), ne(offer.status, "void"))
                )
              )
            )
        ),
        notExists(
          tx
            .select({ id: driverDocument.id })
            .from(driverDocument)
            .where(
              and(
                eq(driverDocument.driverId, driverProfile.userId),
                isNull(driverDocument.replacedAt),
                lt(driverDocument.expiresAt, now)
              )
            )
        ),
        or(
          notExists(
            tx
              .select({ id: serviceZone.id })
              .from(serviceZone)
              .where(activeDriverZone)
          ),
          sql`EXISTS (SELECT 1 FROM ${serviceZone} WHERE ${activeDriverZone} AND ST_Contains(${serviceZone.area}, ${driverPosition.point}))`
        )
      )
    )
    .orderBy(
      // Near drivers first, then whoever has waited longest for a request.
      sql`floor(${distanceToPickup} / ${DISTANCE_BAND_M})`,
      sql`(SELECT max(o.created_at) FROM offer o WHERE o.driver_id = ${driverProfile.userId}) NULLS FIRST`,
      driverProfile.userId
    )
    .limit(settings.groupMaxDrivers);
}

async function fillGroup(
  tx: Transaction,
  ride: Booking,
  group: Group,
  settings: Settings,
  now: Date
) {
  const quotes = await tx
    .select({ id: fareQuote.id, category: fareQuote.category })
    .from(fareQuote)
    .where(and(eq(fareQuote.bookingId, ride.id), isNull(fareQuote.replacedAt)));
  const drivers = await findEligibleDrivers(
    tx,
    ride,
    quotes.map((quote) => quote.category),
    settings,
    now
  );
  if (drivers.length < settings.groupMinDrivers) {
    return 0;
  }
  const quoteOf = new Map(quotes.map((quote) => [quote.category, quote.id]));
  const created = await tx
    .insert(offer)
    .values(
      drivers.map((driver) => ({
        bookingId: ride.id,
        groupId: group.id,
        driverId: driver.driverId,
        vehicleId: driver.vehicleId,
        fareQuoteId: quoteOf.get(driver.category) as string,
        category: driver.category,
        expiresAt: group.expiresAt,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: offer.id });
  if (created.length > 0 && ride.status === "SEARCHING") {
    await transitionBooking(tx, {
      bookingId: ride.id,
      to: "OFFERED",
      actor: SYSTEM,
      eventType: "status_changed",
    });
  }
  return created.length;
}

/** Groups since the last driver change: a replacement gets a full new search. */
async function roundsUsed(tx: Transaction, bookingId: string) {
  const [replaced] = await tx
    .select({ at: bookingEvent.createdAt })
    .from(bookingEvent)
    .where(
      and(
        eq(bookingEvent.bookingId, bookingId),
        eq(bookingEvent.type, "driver_replaced")
      )
    )
    .orderBy(desc(bookingEvent.createdAt))
    .limit(1);
  const [row] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(dispatchGroup)
    .where(
      and(
        eq(dispatchGroup.bookingId, bookingId),
        replaced ? gte(dispatchGroup.startedAt, replaced.at) : undefined
      )
    );
  return row?.total ?? 0;
}

async function endGroup(
  tx: Transaction,
  ride: Booking,
  group: Group,
  now: Date
) {
  await tx
    .update(dispatchGroup)
    .set({ status: "exhausted", endedAt: now })
    .where(eq(dispatchGroup.id, group.id));
  if (ride.status === "OFFERED") {
    await transitionBooking(tx, {
      bookingId: ride.id,
      to: "SEARCHING",
      actor: SYSTEM,
      eventType: "status_changed",
    });
  }
}

async function advanceActiveGroup(
  tx: Transaction,
  ride: Booking,
  group: Group,
  settings: Settings,
  now: Date,
  hasOpenPriced: boolean
) {
  const groupOffers = await tx
    .select({ status: offer.status })
    .from(offer)
    .where(eq(offer.groupId, group.id));
  const windowOver = now >= group.expiresAt;
  if (groupOffers.length === 0 && !windowOver) {
    // An empty window still counts, and a driver who comes online can fill it.
    if (group.expiresAt.getTime() - now.getTime() >= MIN_FILL_WINDOW_MS) {
      await fillGroup(tx, ride, group, settings, now);
    }
    return;
  }
  const allAnswered =
    groupOffers.length > 0 && groupOffers.every((row) => row.status !== "sent");
  if (!(windowOver || allAnswered)) {
    return;
  }
  if (hasOpenPriced) {
    await tx
      .update(dispatchGroup)
      .set({ status: "paused" })
      .where(eq(dispatchGroup.id, group.id));
    return;
  }
  await endGroup(tx, ride, group, now);
}

/**
 * One step of the search for one booking. Run inside a transaction that holds the
 * booking row, so two ticks can never start the same group.
 */
export async function advanceSearch(
  tx: Transaction,
  ride: Booking,
  now: Date
): Promise<void> {
  const settings = await settingsById(tx, ride.settingsVersionId);
  const [group] = await tx
    .select()
    .from(dispatchGroup)
    .where(eq(dispatchGroup.bookingId, ride.id))
    .orderBy(desc(dispatchGroup.sequence))
    .limit(1);
  const openOffers = await tx
    .select({ status: offer.status })
    .from(offer)
    .where(
      and(eq(offer.bookingId, ride.id), inArray(offer.status, [...OPEN_OFFERS]))
    );
  // A price the client can still accept pauses the search (scope rule).
  const hasOpenPriced = openOffers.some((row) => row.status !== "sent");

  if (group?.status === "active") {
    await advanceActiveGroup(tx, ride, group, settings, now, hasOpenPriced);
    return;
  }
  if (group?.status === "paused") {
    if (!hasOpenPriced) {
      await endGroup(tx, ride, group, now);
    }
    return;
  }
  if (hasOpenPriced) {
    return;
  }
  if (
    group?.endedAt &&
    now < secondsAfter(group.endedAt, settings.groupPauseS)
  ) {
    return;
  }
  if ((await roundsUsed(tx, ride.id)) >= settings.maxGroups) {
    await transitionBooking(tx, {
      bookingId: ride.id,
      to: "NO_DRIVER_FOUND",
      actor: SYSTEM,
      eventType: "status_changed",
    });
    return;
  }
  const [next] = await tx
    .insert(dispatchGroup)
    .values({
      bookingId: ride.id,
      sequence: (group?.sequence ?? 0) + 1,
      startedAt: now,
      expiresAt: secondsAfter(now, settings.driverResponseS),
    })
    .returning();
  if (next) {
    await fillGroup(tx, ride, next, settings, now);
  }
}

async function expirePendingDestinationChanges(db: Database, now: Date) {
  const stale = await db
    .select({
      id: destinationChange.id,
      bookingId: destinationChange.bookingId,
    })
    .from(destinationChange)
    .innerJoin(booking, eq(booking.id, destinationChange.bookingId))
    .where(
      and(
        eq(destinationChange.status, "pending"),
        or(
          lt(destinationChange.expiresAt, now),
          sql`${booking.status} NOT IN ('ACCEPTED', 'DRIVER_ARRIVING')`
        )
      )
    );
  for (const change of stale) {
    await db.transaction(async (tx) => {
      const expired = await tx
        .update(destinationChange)
        .set({ status: "expired" })
        .where(
          and(
            eq(destinationChange.id, change.id),
            eq(destinationChange.status, "pending")
          )
        )
        .returning({ id: destinationChange.id });
      if (expired.length > 0) {
        await tx.insert(bookingEvent).values({
          bookingId: change.bookingId,
          type: "destination_expired",
          actorKind: "system",
        });
      }
    });
  }
}

/** Runs every second from `apps/server`. All deadlines live in the database. */
export async function runDispatchTick(db: Database, now = new Date()) {
  await db
    .update(offer)
    .set({ status: "expired" })
    .where(
      and(inArray(offer.status, [...OPEN_OFFERS]), lt(offer.expiresAt, now))
    );
  await expirePendingDestinationChanges(db, now);

  const searching = await db
    .select({ id: booking.id })
    .from(booking)
    .where(inArray(booking.status, [...SEARCH_STATUSES]));
  for (const { id } of searching) {
    await db.transaction(async (tx) => {
      // Another tick or a client action holds this booking: try again next second.
      const [ride] = await tx
        .select()
        .from(booking)
        .where(eq(booking.id, id))
        .for("update", { skipLocked: true });
      if (ride && SEARCH_STATUSES.some((status) => status === ride.status)) {
        await advanceSearch(tx, ride, now);
      }
    });
  }
}
