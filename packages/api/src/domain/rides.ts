import { TRPCError } from "@trpc/server";
import {
  booking,
  bookingEvent,
  destinationChange,
  fareQuote,
} from "@zay-app/db/schema/bookings";
import { dispatchGroup, offer } from "@zay-app/db/schema/dispatch";
import { payment, paymentEvent } from "@zay-app/db/schema/payments";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { type Transaction, transitionBooking } from "./booking-status";
import { OPEN_OFFERS } from "./dispatch";
import { computeFare } from "./fare";
import { conflict } from "./offers";
import { paymentStatusFor } from "./payment";
import {
  categoriesOf,
  faresOf,
  type RequestedCategory,
  settingsById,
} from "./trip";

export const CLIENT_CANCELLABLE = [
  "PENDING",
  "SEARCHING",
  "OFFERED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
] as const;
export const DRIVER_WITHDRAWABLE = [
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
] as const;
export const DESTINATION_CHANGEABLE = ["ACCEPTED", "DRIVER_ARRIVING"] as const;

type Booking = typeof booking.$inferSelect;
export type RideStep =
  | "DRIVER_ARRIVING"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED";

const includes = <T extends string>(list: readonly T[], value: string) =>
  list.some((item) => item === value);

async function closeSearch(tx: Transaction, bookingId: string) {
  await tx
    .update(offer)
    .set({ status: "void" })
    .where(
      and(
        eq(offer.bookingId, bookingId),
        inArray(offer.status, [...OPEN_OFFERS])
      )
    );
  await tx
    .update(dispatchGroup)
    .set({ status: "closed", endedAt: new Date() })
    .where(
      and(
        eq(dispatchGroup.bookingId, bookingId),
        inArray(dispatchGroup.status, ["active", "paused"])
      )
    );
}

async function lockBooking(tx: Transaction, bookingId: string) {
  const [ride] = await tx
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .for("update");
  if (!ride) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return ride;
}

async function replayed(
  tx: Transaction,
  actorId: string,
  clientRequestId: string
) {
  const [row] = await tx
    .select({ id: bookingEvent.id })
    .from(bookingEvent)
    .where(
      and(
        eq(bookingEvent.actorId, actorId),
        eq(bookingEvent.clientRequestId, clientRequestId)
      )
    )
    .limit(1);
  return Boolean(row);
}

export interface ReasonedAction {
  clientRequestId: string;
  reasonCode: string;
  reasonNote?: string;
}

export async function cancelByClient(
  tx: Transaction,
  clientId: string,
  bookingId: string,
  action: ReasonedAction
) {
  const ride = await lockBooking(tx, bookingId);
  if (ride.clientId !== clientId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (await replayed(tx, clientId, action.clientRequestId)) {
    return;
  }
  if (!includes(CLIENT_CANCELLABLE, ride.status)) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  await closeSearch(tx, bookingId);
  await transitionBooking(tx, {
    bookingId,
    to: "CANCELLED",
    actor: { actorKind: "client", actorId: clientId },
    eventType: "status_changed",
    ...action,
  });
}

/** After a change of destination, only the vehicle's category still has a quote. */
async function restoreQuotes(tx: Transaction, ride: Booking) {
  const active = await tx
    .select()
    .from(fareQuote)
    .where(and(eq(fareQuote.bookingId, ride.id), isNull(fareQuote.replacedAt)));
  const [reference] = active;
  if (!reference) {
    throw new Error("Booking without an active quote");
  }
  const settings = await settingsById(tx, ride.settingsVersionId);
  const fares = await faresOf(tx, ride.settingsVersionId);
  const missing = categoriesOf(ride.requestedCategory as RequestedCategory)
    .filter((category) => !active.some((q) => q.category === category))
    .flatMap((category) => {
      const fare = fares.find((f) => f.category === category);
      return fare && ride.passengers <= fare.maxCapacity ? [fare] : [];
    });
  if (missing.length > 0) {
    await tx.insert(fareQuote).values(
      missing.map((fare) => ({
        bookingId: ride.id,
        category: fare.category,
        settingsVersionId: settings.id,
        distanceM: reference.distanceM,
        distanceSource: reference.distanceSource,
        ...computeFare(fare, reference.distanceM, settings.priceVariationPct),
      }))
    );
  }
}

/** The ride goes back to the search, and only this driver stays excluded (AC-13). */
async function replaceDriver(
  tx: Transaction,
  ride: Booking,
  driverId: string,
  action: ReasonedAction
) {
  await tx
    .update(offer)
    .set({ status: "withdrawn" })
    .where(and(eq(offer.bookingId, ride.id), eq(offer.status, "accepted")));
  await transitionBooking(tx, {
    bookingId: ride.id,
    to: "SEARCHING",
    actor: { actorKind: "driver", actorId: driverId },
    eventType: "driver_replaced",
    data: {
      previous_driver_id: ride.driverId,
      previous_vehicle_id: ride.vehicleId,
      previous_price_ar: ride.agreedPriceAr,
    },
    ...action,
  });
  await tx
    .update(booking)
    .set({ driverId: null, vehicleId: null, agreedPriceAr: null })
    .where(eq(booking.id, ride.id));
  await restoreQuotes(tx, ride);
}

export async function withdrawByDriver(
  tx: Transaction,
  driverId: string,
  bookingId: string,
  action: ReasonedAction
) {
  const ride = await lockBooking(tx, bookingId);
  if (await replayed(tx, driverId, action.clientRequestId)) {
    return;
  }
  if (ride.driverId !== driverId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (!includes(DRIVER_WITHDRAWABLE, ride.status)) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  if (action.reasonCode === "client_absent") {
    if (ride.status !== "ARRIVED") {
      throw conflict("CLIENT_ABSENT_NEEDS_ARRIVAL");
    }
    await transitionBooking(tx, {
      bookingId,
      to: "CANCELLED",
      actor: { actorKind: "driver", actorId: driverId },
      eventType: "status_changed",
      ...action,
    });
    return;
  }
  await replaceDriver(tx, ride, driverId, action);
}

/** The driver's four steps. The transition table refuses any shortcut. */
export async function advanceRide(
  tx: Transaction,
  driverId: string,
  bookingId: string,
  to: RideStep,
  clientRequestId: string
) {
  const ride = await lockBooking(tx, bookingId);
  if (await replayed(tx, driverId, clientRequestId)) {
    return;
  }
  if (ride.driverId !== driverId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  await transitionBooking(tx, {
    bookingId,
    to,
    actor: { actorKind: "driver", actorId: driverId },
    eventType: "status_changed",
    clientRequestId,
  });
  if (to === "COMPLETED") {
    await tx
      .update(booking)
      .set({ completedAt: new Date() })
      .where(eq(booking.id, bookingId));
    // Ending a ride never says the money was received (cahier §11.2).
    await tx
      .insert(payment)
      .values({ bookingId, agreedAmountAr: ride.agreedPriceAr as number })
      .onConflictDoNothing();
  }
}

export async function declarePayment(
  tx: Transaction,
  driverId: string,
  bookingId: string,
  amountAr: number,
  clientRequestId: string
) {
  const [row] = await tx
    .select({ payment, driverId: booking.driverId })
    .from(payment)
    .innerJoin(booking, eq(booking.id, payment.bookingId))
    .where(eq(payment.bookingId, bookingId))
    .for("update", { of: payment });
  if (!row) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  if (row.driverId !== driverId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  const events = await tx
    .insert(paymentEvent)
    .values({
      paymentId: row.payment.id,
      kind: "declared",
      amountAr,
      actorKind: "driver",
      actorId: driverId,
      clientRequestId,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvent.id });
  if (events.length === 0) {
    return;
  }
  if (row.payment.status === "disputed") {
    throw conflict("PAYMENT_DISPUTED");
  }
  await tx
    .update(payment)
    .set({
      declaredAmountAr: amountAr,
      status: paymentStatusFor(amountAr, row.payment.agreedAmountAr),
    })
    .where(eq(payment.id, row.payment.id));
}

export async function disputePayment(
  tx: Transaction,
  clientId: string,
  bookingId: string,
  action: ReasonedAction
) {
  const [row] = await tx
    .select({ payment, clientId: booking.clientId })
    .from(payment)
    .innerJoin(booking, eq(booking.id, payment.bookingId))
    .where(eq(payment.bookingId, bookingId))
    .for("update", { of: payment });
  if (!row) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  if (row.clientId !== clientId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  const events = await tx
    .insert(paymentEvent)
    .values({
      paymentId: row.payment.id,
      kind: "disputed",
      actorKind: "client",
      actorId: clientId,
      reasonCode: action.reasonCode,
      reasonNote: action.reasonNote ?? null,
      clientRequestId: action.clientRequestId,
    })
    .onConflictDoNothing()
    .returning({ id: paymentEvent.id });
  if (events.length > 0) {
    await tx
      .update(payment)
      .set({ status: "disputed" })
      .where(eq(payment.id, row.payment.id));
  }
}

export interface NewDestination {
  distanceM: number;
  distanceSource: "route" | "fallback";
  districtId?: string | null;
  landmarkId?: string | null;
  lat: number;
  lng: number;
  note?: string | null;
}

/** The new price uses the booking's own settings, never the latest ones. */
export async function destinationPrice(
  tx: Transaction,
  ride: Booking,
  distanceM: number
) {
  const [current] = await tx
    .select({ category: offer.category })
    .from(offer)
    .where(and(eq(offer.bookingId, ride.id), eq(offer.status, "accepted")));
  const settings = await settingsById(tx, ride.settingsVersionId);
  const fares = await faresOf(tx, ride.settingsVersionId);
  const fare = fares.find((f) => f.category === current?.category);
  if (!(fare && current)) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  return {
    category: current.category,
    settings,
    ...computeFare(fare, distanceM, settings.priceVariationPct),
  };
}

export async function requestDestinationChange(
  tx: Transaction,
  clientId: string,
  bookingId: string,
  target: NewDestination,
  clientRequestId: string,
  now = new Date()
) {
  const ride = await lockBooking(tx, bookingId);
  if (ride.clientId !== clientId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (await replayed(tx, clientId, clientRequestId)) {
    return;
  }
  if (!includes(DESTINATION_CHANGEABLE, ride.status)) {
    throw conflict("BOOKING_STATUS_CHANGED");
  }
  const { settings, amountAr } = await destinationPrice(
    tx,
    ride,
    target.distanceM
  );
  await tx.insert(destinationChange).values({
    bookingId,
    oldPoint: ride.destinationPoint,
    oldNote: ride.destinationNote,
    oldDistrictId: ride.destinationDistrictId,
    oldLandmarkId: ride.destinationLandmarkId,
    newPoint: { x: target.lng, y: target.lat },
    newNote: target.note ?? null,
    newDistrictId: target.districtId ?? null,
    newLandmarkId: target.landmarkId ?? null,
    newDistanceM: target.distanceM,
    newDistanceSource: target.distanceSource,
    settingsVersionId: settings.id,
    oldPriceAr: ride.agreedPriceAr as number,
    newPriceAr: amountAr,
    requestedBy: clientId,
    // The client saw the new price before sending this request.
    clientAcceptedAt: now,
    expiresAt: new Date(now.getTime() + settings.clientResponseS * 1000),
  });
  await tx.insert(bookingEvent).values({
    bookingId,
    type: "destination_requested",
    actorKind: "client",
    actorId: clientId,
    clientRequestId,
    data: { old_price_ar: ride.agreedPriceAr, new_price_ar: amountAr },
  });
}

async function applyDestinationChange(
  tx: Transaction,
  ride: Booking,
  change: typeof destinationChange.$inferSelect,
  driverId: string,
  now: Date
) {
  const { category, settings, ...amounts } = await destinationPrice(
    tx,
    ride,
    change.newDistanceM
  );
  await tx
    .update(fareQuote)
    .set({ replacedAt: now })
    .where(and(eq(fareQuote.bookingId, ride.id), isNull(fareQuote.replacedAt)));
  const [quote] = await tx
    .insert(fareQuote)
    .values({
      bookingId: ride.id,
      category,
      settingsVersionId: settings.id,
      distanceM: change.newDistanceM,
      distanceSource: change.newDistanceSource,
      ...amounts,
    })
    .returning({ id: fareQuote.id });
  await tx
    .update(booking)
    .set({
      destinationPoint: change.newPoint,
      destinationNote: change.newNote,
      destinationDistrictId: change.newDistrictId,
      destinationLandmarkId: change.newLandmarkId,
      agreedPriceAr: change.newPriceAr,
    })
    .where(eq(booking.id, ride.id));
  await tx
    .update(destinationChange)
    .set({
      status: "applied",
      driverAcceptedAt: now,
      fareQuoteId: quote?.id ?? null,
    })
    .where(eq(destinationChange.id, change.id));
  await tx.insert(bookingEvent).values({
    bookingId: ride.id,
    type: "destination_applied",
    actorKind: "driver",
    actorId: driverId,
    data: { old_price_ar: change.oldPriceAr, new_price_ar: change.newPriceAr },
  });
}

export async function answerDestinationChange(
  tx: Transaction,
  driverId: string,
  bookingId: string,
  accept: boolean,
  now = new Date()
) {
  const ride = await lockBooking(tx, bookingId);
  if (ride.driverId !== driverId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  const [change] = await tx
    .select()
    .from(destinationChange)
    .where(
      and(
        eq(destinationChange.bookingId, bookingId),
        eq(destinationChange.status, "pending")
      )
    )
    .orderBy(desc(destinationChange.createdAt))
    .limit(1);
  if (!change || change.expiresAt <= now) {
    throw conflict("DESTINATION_CHANGE_EXPIRED");
  }
  if (accept) {
    await applyDestinationChange(tx, ride, change, driverId, now);
    return;
  }
  await tx
    .update(destinationChange)
    .set({ status: "refused" })
    .where(eq(destinationChange.id, change.id));
  await tx.insert(bookingEvent).values({
    bookingId,
    type: "destination_refused",
    actorKind: "driver",
    actorId: driverId,
  });
}
