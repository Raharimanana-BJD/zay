import { TRPCError } from "@trpc/server";
import { user } from "@zay-app/db/schema/auth";
import { booking, fareQuote } from "@zay-app/db/schema/bookings";
import {
  dispatchGroup,
  offer,
  offerProposal,
} from "@zay-app/db/schema/dispatch";
import { driverProfile } from "@zay-app/db/schema/drivers";
import { categoryFare } from "@zay-app/db/schema/settings";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";

import { type Transaction, transitionBooking } from "./booking-status";
import { PRICE_ADJUSTMENT_REASONS } from "./codes";
import { OPEN_OFFERS } from "./dispatch";
import { settingsById } from "./trip";

const MS_PER_S = 1000;

type Offer = typeof offer.$inferSelect;

export const conflict = (message: string) =>
  new TRPCError({ code: "CONFLICT", message });
const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });

export interface Actor {
  id: string;
  kind: "client" | "driver";
}

export interface PriceInput {
  amountAr: number;
  reasonCode?: string;
  reasonNote?: string;
}

const isOpen = (status: Offer["status"]) =>
  OPEN_OFFERS.some((open) => open === status);

/** Locks the offer and refuses it if it closed, whatever a late notification says. */
export async function lockOpenOffer(
  tx: Transaction,
  offerId: string,
  now: Date
) {
  const [row] = await tx
    .select()
    .from(offer)
    .where(eq(offer.id, offerId))
    .for("update");
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (!isOpen(row.status) || row.expiresAt <= now) {
    throw conflict("OFFER_EXPIRED");
  }
  return row;
}

/** Same request id, same author: the action already happened once. */
export async function isReplayedProposal(
  tx: Transaction,
  actorId: string,
  clientRequestId: string
) {
  const [row] = await tx
    .select({ id: offerProposal.id })
    .from(offerProposal)
    .where(
      and(
        eq(offerProposal.actorId, actorId),
        eq(offerProposal.clientRequestId, clientRequestId)
      )
    )
    .limit(1);
  return Boolean(row);
}

async function recordProposal(
  tx: Transaction,
  offerId: string,
  actor: Actor,
  kind: "accept" | "propose" | "counter" | "refuse",
  clientRequestId: string,
  price?: PriceInput
) {
  await tx.insert(offerProposal).values({
    offerId,
    actorKind: actor.kind,
    actorId: actor.id,
    kind,
    amountAr: price?.amountAr ?? null,
    reasonCode: price?.reasonCode ?? null,
    reasonNote: price?.reasonNote ?? null,
    clientRequestId,
  });
}

async function assertPriceAllowed(
  tx: Transaction,
  row: Offer,
  settingsVersionId: string,
  price: PriceInput
) {
  const [quote] = await tx
    .select({ minAr: fareQuote.minAr, maxAr: fareQuote.maxAr })
    .from(fareQuote)
    .where(eq(fareQuote.id, row.fareQuoteId));
  const [fare] = await tx
    .select({ roundingAr: categoryFare.roundingAr })
    .from(categoryFare)
    .where(
      and(
        eq(categoryFare.settingsVersionId, settingsVersionId),
        eq(categoryFare.category, row.category)
      )
    );
  if (!(quote && fare)) {
    throw new Error("Offer without quote or fare");
  }
  const { amountAr } = price;
  if (amountAr < quote.minAr || amountAr > quote.maxAr) {
    throw badRequest("PRICE_OUT_OF_RANGE");
  }
  if (amountAr % fare.roundingAr !== 0) {
    throw badRequest("PRICE_NOT_ROUNDED");
  }
}

function assertAdjustmentReason({ reasonCode, reasonNote }: PriceInput) {
  if (!(reasonCode && PRICE_ADJUSTMENT_REASONS.some((r) => r === reasonCode))) {
    throw badRequest("REASON_INVALID");
  }
  if (reasonCode === "other" && !reasonNote) {
    throw badRequest("NOTE_REQUIRED");
  }
}

async function bookingOf(tx: Transaction, bookingId: string) {
  // Locked first everywhere, so two actions on one booking run one after the other.
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

async function offerBookingId(tx: Transaction, offerId: string) {
  const [row] = await tx
    .select({ bookingId: offer.bookingId })
    .from(offer)
    .where(eq(offer.id, offerId));
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return row.bookingId;
}

async function lockForAction(tx: Transaction, offerId: string, now: Date) {
  const ride = await bookingOf(tx, await offerBookingId(tx, offerId));
  if (ride.status !== "OFFERED") {
    throw conflict("OFFER_EXPIRED");
  }
  const row = await lockOpenOffer(tx, offerId, now);
  return { ride, row };
}

const countersBy = async (
  tx: Transaction,
  offerId: string,
  actorKind: Actor["kind"]
) => {
  const [row] = await tx
    .select({ total: count() })
    .from(offerProposal)
    .where(
      and(
        eq(offerProposal.offerId, offerId),
        eq(offerProposal.kind, "counter"),
        eq(offerProposal.actorKind, actorKind)
      )
    );
  return row?.total ?? 0;
};

/** The author of the last price on the table, which says who must answer. */
export async function lastProposalActor(tx: Transaction, offerId: string) {
  const [row] = await tx
    .select({ actorKind: offerProposal.actorKind })
    .from(offerProposal)
    .where(eq(offerProposal.offerId, offerId))
    .orderBy(desc(offerProposal.createdAt), desc(offerProposal.id))
    .limit(1);
  return row?.actorKind ?? null;
}

/** The one place a driver gets a ride. One transaction, or nothing changes. */
async function assign(
  tx: Transaction,
  ride: typeof booking.$inferSelect,
  row: Offer,
  actor: Actor,
  clientRequestId: string
) {
  const [driver] = await tx
    .select({ isAvailable: driverProfile.isAvailable, banned: user.banned })
    .from(driverProfile)
    .innerJoin(user, eq(user.id, driverProfile.userId))
    .where(eq(driverProfile.userId, row.driverId));
  if (!driver?.isAvailable || driver.banned) {
    throw conflict("DRIVER_UNAVAILABLE");
  }
  if (row.currentPriceAr === null) {
    throw conflict("OFFER_NOT_PRICED");
  }
  await tx
    .update(offer)
    .set({ status: "accepted" })
    .where(eq(offer.id, row.id));
  await recordProposal(tx, row.id, actor, "accept", clientRequestId);
  await tx
    .update(booking)
    .set({
      driverId: row.driverId,
      vehicleId: row.vehicleId,
      agreedPriceAr: row.currentPriceAr,
    })
    .where(eq(booking.id, ride.id));
  await transitionBooking(tx, {
    bookingId: ride.id,
    to: "ACCEPTED",
    actor: { actorKind: actor.kind, actorId: actor.id },
    eventType: "driver_assigned",
  });
  await tx
    .update(offer)
    .set({ status: "void" })
    .where(
      and(
        eq(offer.bookingId, ride.id),
        ne(offer.id, row.id),
        inArray(offer.status, [...OPEN_OFFERS])
      )
    );
  await tx
    .update(dispatchGroup)
    .set({ status: "closed", endedAt: new Date() })
    .where(
      and(
        eq(dispatchGroup.bookingId, ride.id),
        inArray(dispatchGroup.status, ["active", "paused"])
      )
    );
}

async function refuse(
  tx: Transaction,
  offerId: string,
  actor: Actor,
  clientRequestId: string
) {
  await tx
    .update(offer)
    .set({ status: "refused" })
    .where(eq(offer.id, offerId));
  await recordProposal(tx, offerId, actor, "refuse", clientRequestId);
}

type DriverAnswer =
  | { action: "accept" }
  | { action: "refuse" }
  | ({ action: "propose" } & PriceInput)
  | ({ action: "counter" } & PriceInput);

async function driverAnswerToSent(
  tx: Transaction,
  ride: typeof booking.$inferSelect,
  row: Offer,
  actor: Actor,
  answer: DriverAnswer,
  clientRequestId: string,
  now: Date
) {
  if (answer.action === "counter") {
    throw conflict("OFFER_STATE_INVALID");
  }
  const settings = await settingsById(tx, ride.settingsVersionId);
  const expiresAt = new Date(
    now.getTime() + settings.clientResponseS * MS_PER_S
  );
  if (answer.action === "accept") {
    const [quote] = await tx
      .select({ amountAr: fareQuote.amountAr })
      .from(fareQuote)
      .where(eq(fareQuote.id, row.fareQuoteId));
    await tx
      .update(offer)
      .set({
        status: "priced",
        currentPriceAr: quote?.amountAr ?? null,
        expiresAt,
      })
      .where(eq(offer.id, row.id));
    await recordProposal(tx, row.id, actor, "accept", clientRequestId, {
      amountAr: quote?.amountAr as number,
    });
    return;
  }
  if (answer.action !== "propose") {
    throw conflict("OFFER_STATE_INVALID");
  }
  assertAdjustmentReason(answer);
  await assertPriceAllowed(tx, row, ride.settingsVersionId, answer);
  await tx
    .update(offer)
    .set({ status: "priced", currentPriceAr: answer.amountAr, expiresAt })
    .where(eq(offer.id, row.id));
  await recordProposal(tx, row.id, actor, "propose", clientRequestId, answer);
}

async function driverAnswerToCounter(
  tx: Transaction,
  ride: typeof booking.$inferSelect,
  row: Offer,
  actor: Actor,
  answer: DriverAnswer,
  clientRequestId: string,
  now: Date
) {
  if ((await lastProposalActor(tx, row.id)) !== "client") {
    throw conflict("OFFER_WAITING_CLIENT");
  }
  if (answer.action === "accept") {
    await assign(tx, ride, row, actor, clientRequestId);
    return;
  }
  if (answer.action !== "counter") {
    throw conflict("OFFER_STATE_INVALID");
  }
  if ((await countersBy(tx, row.id, "driver")) > 0) {
    throw conflict("COUNTER_LIMIT_REACHED");
  }
  await assertPriceAllowed(tx, row, ride.settingsVersionId, answer);
  const settings = await settingsById(tx, ride.settingsVersionId);
  await tx
    .update(offer)
    .set({
      currentPriceAr: answer.amountAr,
      expiresAt: new Date(now.getTime() + settings.clientResponseS * MS_PER_S),
    })
    .where(eq(offer.id, row.id));
  await recordProposal(tx, row.id, actor, "counter", clientRequestId, answer);
}

/** Cahier §9.5, from the driver's side. */
export async function driverAnswer(
  tx: Transaction,
  actor: Actor,
  offerId: string,
  answer: DriverAnswer,
  clientRequestId: string,
  now = new Date()
) {
  if (await isReplayedProposal(tx, actor.id, clientRequestId)) {
    return;
  }
  const { ride, row } = await lockForAction(tx, offerId, now);
  if (row.driverId !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (answer.action === "refuse") {
    await refuse(tx, row.id, actor, clientRequestId);
    return;
  }
  if (row.status === "sent") {
    await driverAnswerToSent(
      tx,
      ride,
      row,
      actor,
      answer,
      clientRequestId,
      now
    );
    return;
  }
  if (row.status === "negotiating") {
    await driverAnswerToCounter(
      tx,
      ride,
      row,
      actor,
      answer,
      clientRequestId,
      now
    );
    return;
  }
  throw conflict("OFFER_WAITING_CLIENT");
}

type ClientAnswer =
  | { action: "accept" }
  | { action: "refuse" }
  | ({ action: "counter" } & PriceInput);

/** Cahier §9.5 and §9.7, from the client's side. */
export async function clientAnswer(
  tx: Transaction,
  actor: Actor,
  offerId: string,
  answer: ClientAnswer,
  clientRequestId: string,
  now = new Date()
) {
  if (await isReplayedProposal(tx, actor.id, clientRequestId)) {
    return;
  }
  const { ride, row } = await lockForAction(tx, offerId, now);
  if (ride.clientId !== actor.id) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  if (row.status === "sent") {
    throw conflict("OFFER_NOT_PRICED");
  }
  if (answer.action === "refuse") {
    await refuse(tx, row.id, actor, clientRequestId);
    return;
  }
  const waitingDriver =
    row.status === "negotiating" &&
    (await lastProposalActor(tx, row.id)) === "client";
  if (waitingDriver) {
    throw conflict("OFFER_WAITING_DRIVER");
  }
  if (answer.action === "accept") {
    await assign(tx, ride, row, actor, clientRequestId);
    return;
  }
  if ((await countersBy(tx, row.id, "client")) > 0) {
    throw conflict("COUNTER_LIMIT_REACHED");
  }
  await assertPriceAllowed(tx, row, ride.settingsVersionId, answer);
  const settings = await settingsById(tx, ride.settingsVersionId);
  await tx
    .update(offer)
    .set({
      status: "negotiating",
      currentPriceAr: answer.amountAr,
      expiresAt: new Date(
        now.getTime() + settings.driverCounterResponseS * MS_PER_S
      ),
    })
    .where(eq(offer.id, row.id));
  await recordProposal(tx, row.id, actor, "counter", clientRequestId, answer);
}
