import { TRPCError } from "@trpc/server";
import type { Database } from "@zay-app/db";
import { user } from "@zay-app/db/schema/auth";
import {
  booking,
  bookingEvent,
  destinationChange,
  fareQuote,
} from "@zay-app/db/schema/bookings";
import {
  dispatchGroup,
  offer,
  offerProposal,
} from "@zay-app/db/schema/dispatch";
import { driverPosition, vehicle } from "@zay-app/db/schema/drivers";
import { payment } from "@zay-app/db/schema/payments";
import { and, asc, desc, eq, inArray, isNull, not, or, sql } from "drizzle-orm";
import z from "zod";

import { transitionBooking } from "../domain/booking-status";
import { CANCELLATION_REASONS, DISPUTE_REASONS } from "../domain/codes";
import { ACTIVE_RIDE, advanceSearch } from "../domain/dispatch";
import { isPositionStale, positionAgeS } from "../domain/driver-position";
import { type Actor, clientAnswer, conflict } from "../domain/offers";
import {
  cancelByClient,
  destinationPrice,
  disputePayment,
  requestDestinationChange,
} from "../domain/rides";
import {
  categoriesOf,
  estimateRoute,
  faresOf,
  isInZone,
  latestSettings,
  pointSql,
  quotesFor,
  settingsById,
} from "../domain/trip";
import { clientProcedure, router } from "../index";
import { assertReason, isUniqueViolation, PAGE_SIZE } from "./admin/common";
import { placeLabels } from "./admin/places";
import {
  historyColumns,
  placeSchema,
  priceSchema,
  reasonSchema,
  requestIdSchema,
} from "./shared";

const MS_PER_S = 1000;
const IN_REQUEST = ["PENDING", "SEARCHING", "OFFERED"] as const;
const MAX_PASSENGERS = 8;

const secondsUntil = (date: Date, now: Date) =>
  Math.max(0, Math.ceil((date.getTime() - now.getTime()) / MS_PER_S));

const tripSchema = z.object({
  pickup: placeSchema,
  destination: placeSchema,
  passengers: z.number().int().min(1).max(MAX_PASSENGERS),
});

const fieldsOf = (place: z.infer<typeof placeSchema>) => ({
  point: { x: place.lng, y: place.lat },
  note: place.note || null,
  districtId: place.districtId ?? null,
  landmarkId: place.landmarkId ?? null,
});

async function assertZones(
  db: Database,
  pickup: z.infer<typeof placeSchema>,
  destination: z.infer<typeof placeSchema>
) {
  if (!(await isInZone(db, "pickup", pickup))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "PICKUP_OUT_OF_ZONE" });
  }
  if (!(await isInZone(db, "destination", destination))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "DESTINATION_OUT_OF_ZONE",
    });
  }
}

const clientActor = (id: string): Actor => ({ id, kind: "client" });

async function ownedBooking(db: Database, id: string, clientId: string) {
  const [ride] = await db.select().from(booking).where(eq(booking.id, id));
  if (!ride || ride.clientId !== clientId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  return ride;
}

/** Name, vehicle and distance, but no phone number before attribution (cahier §9.6). */
async function readOffers(
  db: Database,
  ride: typeof booking.$inferSelect,
  photoUrl: (key: string | null) => Promise<string | null>,
  now: Date
) {
  const { x, y } = ride.pickupPoint;
  const rows = await db
    .select({
      id: offer.id,
      status: offer.status,
      category: offer.category,
      currentPriceAr: offer.currentPriceAr,
      expiresAt: offer.expiresAt,
      driverName: user.name,
      make: vehicle.make,
      model: vehicle.model,
      registration: vehicle.registration,
      capacity: vehicle.capacity,
      photoKey: vehicle.photoKey,
      quotedAr: fareQuote.amountAr,
      minAr: fareQuote.minAr,
      maxAr: fareQuote.maxAr,
      distanceM: sql<
        number | null
      >`ST_Distance(${driverPosition.point}::geography, ${pointSql({ lat: y, lng: x })}::geography)`,
    })
    .from(offer)
    .innerJoin(user, eq(user.id, offer.driverId))
    .innerJoin(vehicle, eq(vehicle.id, offer.vehicleId))
    .innerJoin(fareQuote, eq(fareQuote.id, offer.fareQuoteId))
    .leftJoin(driverPosition, eq(driverPosition.driverId, offer.driverId))
    .where(
      and(
        eq(offer.bookingId, ride.id),
        inArray(offer.status, ["priced", "negotiating"])
      )
    )
    .orderBy(asc(offer.currentPriceAr));
  if (rows.length === 0) {
    return [];
  }
  const proposals = await db
    .select({
      offerId: offerProposal.offerId,
      kind: offerProposal.kind,
      actorKind: offerProposal.actorKind,
      reasonCode: offerProposal.reasonCode,
    })
    .from(offerProposal)
    .where(
      inArray(
        offerProposal.offerId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(offerProposal.createdAt), asc(offerProposal.id));
  return await Promise.all(
    rows.map(async ({ photoKey, expiresAt, distanceM, ...row }) => {
      const own = proposals.filter((p) => p.offerId === row.id);
      const last = own.at(-1);
      const countered = own.some(
        (p) => p.kind === "counter" && p.actorKind === "client"
      );
      return {
        ...row,
        photoUrl: await photoUrl(photoKey),
        expiresInS: secondsUntil(expiresAt, now),
        distanceM: distanceM === null ? null : Math.round(Number(distanceM)),
        reasonCode: own.filter((p) => p.reasonCode).at(-1)?.reasonCode ?? null,
        waitingDriver: last?.actorKind === "client",
        canCounter: !countered && row.status === "priced",
      };
    })
  );
}

async function readAssignedDriver(
  db: Database,
  ride: typeof booking.$inferSelect,
  photoUrl: (key: string | null) => Promise<string | null>,
  gpsMaxAgeS: number,
  now: Date
) {
  if (!(ride.driverId && ride.vehicleId)) {
    return null;
  }
  const [row] = await db
    .select({
      name: user.name,
      phone: user.phone,
      category: vehicle.category,
      make: vehicle.make,
      model: vehicle.model,
      registration: vehicle.registration,
      photoKey: vehicle.photoKey,
      point: driverPosition.point,
      receivedAt: driverPosition.receivedAt,
    })
    .from(user)
    .innerJoin(vehicle, eq(vehicle.id, ride.vehicleId))
    .leftJoin(driverPosition, eq(driverPosition.driverId, user.id))
    .where(eq(user.id, ride.driverId));
  if (!row) {
    return null;
  }
  const { point, receivedAt, photoKey, ...driver } = row;
  const ageS = receivedAt ? positionAgeS(receivedAt, now) : null;
  return {
    ...driver,
    photoUrl: await photoUrl(photoKey),
    position:
      point && ageS !== null
        ? {
            lat: point.y,
            lng: point.x,
            ageS,
            isStale: isPositionStale(ageS, gpsMaxAgeS),
          }
        : null,
  };
}

export const clientRouter = router({
  quote: clientProcedure.input(tripSchema).mutation(async ({ ctx, input }) => {
    const { pickup, destination, passengers } = input;
    await assertZones(ctx.db, pickup, destination);
    const settings = await latestSettings(ctx.db);
    const fares = await faresOf(ctx.db, settings.id);
    const route = await estimateRoute(ctx.db, pickup, destination);
    return {
      distanceM: route.distanceM,
      distanceSource: route.source,
      line: route.line,
      quotes: quotesFor(
        fares,
        ["car", "tuk_tuk"],
        passengers,
        route.distanceM,
        settings.priceVariationPct
      ),
    };
  }),

  createBooking: clientProcedure
    .input(
      tripSchema.extend({
        clientRequestId: requestIdSchema,
        category: z.enum(["car", "tuk_tuk", "auto"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const clientId = session.user.id;
      const { clientRequestId, category, passengers, pickup, destination } =
        input;
      const existing = async () => {
        const [row] = await db
          .select({ id: booking.id })
          .from(booking)
          .where(
            and(
              eq(booking.clientId, clientId),
              eq(booking.clientRequestId, clientRequestId)
            )
          );
        return row ?? null;
      };
      const replay = await existing();
      if (replay) {
        return replay;
      }
      const [active] = await db
        .select({ id: booking.id })
        .from(booking)
        .where(
          and(
            eq(booking.clientId, clientId),
            inArray(booking.status, [...IN_REQUEST, ...ACTIVE_RIDE])
          )
        )
        .limit(1);
      if (active) {
        throw conflict("ACTIVE_BOOKING_EXISTS");
      }
      await assertZones(db, pickup, destination);
      const settings = await latestSettings(db);
      const fares = await faresOf(db, settings.id);
      const route = await estimateRoute(db, pickup, destination);
      const quotes = quotesFor(
        fares,
        categoriesOf(category),
        passengers,
        route.distanceM,
        settings.priceVariationPct
      );
      if (quotes.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "TOO_MANY_PASSENGERS",
        });
      }
      const from = fieldsOf(pickup);
      const to = fieldsOf(destination);
      const now = new Date();
      try {
        return await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(booking)
            .values({
              clientId,
              clientRequestId,
              requestedCategory: category,
              passengers,
              settingsVersionId: settings.id,
              pickupPoint: from.point,
              pickupNote: from.note,
              pickupDistrictId: from.districtId,
              pickupLandmarkId: from.landmarkId,
              destinationPoint: to.point,
              destinationNote: to.note,
              destinationDistrictId: to.districtId,
              destinationLandmarkId: to.landmarkId,
              statusChangedAt: now,
            })
            .returning();
          if (!created) {
            throw new Error("Booking not created");
          }
          await tx.insert(fareQuote).values(
            quotes.map((quote) => ({
              bookingId: created.id,
              category: quote.category,
              settingsVersionId: settings.id,
              distanceM: route.distanceM,
              distanceSource: route.source,
              amountAr: quote.amountAr,
              minAr: quote.minAr,
              maxAr: quote.maxAr,
            }))
          );
          await tx.insert(bookingEvent).values({
            bookingId: created.id,
            type: "booking_created",
            toStatus: "PENDING",
            actorKind: "client",
            actorId: clientId,
            createdAt: now,
          });
          const { booking: searching } = await transitionBooking(tx, {
            bookingId: created.id,
            to: "SEARCHING",
            actor: { actorKind: "system", actorId: null },
            eventType: "status_changed",
          });
          await advanceSearch(tx, searching, now);
          return { id: created.id };
        });
      } catch (error) {
        const raced = isUniqueViolation(error) ? await existing() : null;
        if (raced) {
          return raced;
        }
        throw error;
      }
    }),

  /** The booking still open after a lost connection, if any. */
  activeBooking: clientProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ id: booking.id, status: booking.status })
      .from(booking)
      .where(
        and(
          eq(booking.clientId, ctx.session.user.id),
          inArray(booking.status, [...IN_REQUEST, ...ACTIVE_RIDE])
        )
      )
      .orderBy(desc(booking.createdAt))
      .limit(1);
    return row ?? null;
  }),

  booking: clientProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { db, session, files } = ctx;
      const ride = await ownedBooking(db, input.id, session.user.id);
      const now = new Date();
      const settings = await settingsById(db, ride.settingsVersionId);
      const photoUrl = async (key: string | null) =>
        key ? ((await files.getUrl(key))?.url ?? null) : null;
      const labels = placeLabels();
      const [named] = await labels
        .joins(
          db
            .select({
              pickup: labels.pickup,
              destination: labels.destination,
            })
            .from(booking)
            .$dynamic()
        )
        .where(eq(booking.id, ride.id));
      const quotes = await db
        .select({
          category: fareQuote.category,
          amountAr: fareQuote.amountAr,
          distanceM: fareQuote.distanceM,
          distanceSource: fareQuote.distanceSource,
        })
        .from(fareQuote)
        .where(
          and(eq(fareQuote.bookingId, ride.id), isNull(fareQuote.replacedAt))
        );
      const [group] = await db
        .select({
          sequence: dispatchGroup.sequence,
          status: dispatchGroup.status,
        })
        .from(dispatchGroup)
        .where(eq(dispatchGroup.bookingId, ride.id))
        .orderBy(desc(dispatchGroup.sequence))
        .limit(1);
      const [paymentRow] = await db
        .select({
          status: payment.status,
          agreedAmountAr: payment.agreedAmountAr,
          declaredAmountAr: payment.declaredAmountAr,
        })
        .from(payment)
        .where(eq(payment.bookingId, ride.id));
      const [change] = await db
        .select({
          newPriceAr: destinationChange.newPriceAr,
          newNote: destinationChange.newNote,
          expiresAt: destinationChange.expiresAt,
        })
        .from(destinationChange)
        .where(
          and(
            eq(destinationChange.bookingId, ride.id),
            eq(destinationChange.status, "pending")
          )
        );
      const [closing] = await db
        .select({
          actorKind: bookingEvent.actorKind,
          reasonCode: bookingEvent.reasonCode,
          type: bookingEvent.type,
        })
        .from(bookingEvent)
        .where(
          and(
            eq(bookingEvent.bookingId, ride.id),
            or(
              eq(bookingEvent.toStatus, "CANCELLED"),
              eq(bookingEvent.type, "driver_replaced")
            )
          )
        )
        .orderBy(desc(bookingEvent.createdAt))
        .limit(1);
      return {
        id: ride.id,
        status: ride.status,
        requestedCategory: ride.requestedCategory,
        passengers: ride.passengers,
        agreedPriceAr: ride.agreedPriceAr,
        pickup: {
          label: named?.pickup ?? "",
          note: ride.pickupNote,
          lat: ride.pickupPoint.y,
          lng: ride.pickupPoint.x,
        },
        destination: {
          label: named?.destination ?? "",
          note: ride.destinationNote,
          lat: ride.destinationPoint.y,
          lng: ride.destinationPoint.x,
        },
        quotes,
        search: group
          ? {
              round: group.sequence,
              maxRounds: settings.maxGroups,
              paused: group.status === "paused",
            }
          : null,
        offers: await readOffers(db, ride, photoUrl, now),
        driver: await readAssignedDriver(
          db,
          ride,
          photoUrl,
          settings.gpsMaxAgeS,
          now
        ),
        payment: paymentRow ?? null,
        destinationChange: change
          ? {
              newPriceAr: change.newPriceAr,
              expiresInS: secondsUntil(change.expiresAt, now),
            }
          : null,
        lastChange: closing ?? null,
      };
    }),

  answerOffer: clientProcedure
    .input(
      z.discriminatedUnion("action", [
        z.object({
          action: z.enum(["accept", "refuse"]),
          offerId: z.uuid(),
          clientRequestId: requestIdSchema,
        }),
        z.object({
          action: z.literal("counter"),
          offerId: z.uuid(),
          clientRequestId: requestIdSchema,
          amountAr: priceSchema,
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      const { offerId, clientRequestId, ...answer } = input;
      const actor = clientActor(ctx.session.user.id);
      try {
        await ctx.db.transaction((tx) =>
          clientAnswer(tx, actor, offerId, answer, clientRequestId)
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict(
            input.action === "counter"
              ? "NEGOTIATION_ALREADY_OPEN"
              : "DRIVER_UNAVAILABLE"
          );
        }
        throw error;
      }
    }),

  cancel: clientProcedure
    .input(reasonSchema.extend({ bookingId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { bookingId, ...action } = input;
      assertReason(CANCELLATION_REASONS, action.reasonCode, action.reasonNote);
      await ctx.db.transaction((tx) =>
        cancelByClient(tx, ctx.session.user.id, bookingId, action)
      );
    }),

  previewDestination: clientProcedure
    .input(z.object({ bookingId: z.uuid(), destination: placeSchema }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const ride = await ownedBooking(db, input.bookingId, session.user.id);
      if (!(await isInZone(db, "destination", input.destination))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DESTINATION_OUT_OF_ZONE",
        });
      }
      const route = await estimateRoute(
        db,
        { lat: ride.pickupPoint.y, lng: ride.pickupPoint.x },
        input.destination
      );
      const { amountAr } = await db.transaction((tx) =>
        destinationPrice(tx, ride, route.distanceM)
      );
      return {
        newPriceAr: amountAr,
        oldPriceAr: ride.agreedPriceAr,
        distanceM: route.distanceM,
      };
    }),

  requestDestination: clientProcedure
    .input(
      z.object({
        bookingId: z.uuid(),
        destination: placeSchema,
        clientRequestId: requestIdSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const { bookingId, destination, clientRequestId } = input;
      const ride = await ownedBooking(db, bookingId, session.user.id);
      if (!(await isInZone(db, "destination", destination))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "DESTINATION_OUT_OF_ZONE",
        });
      }
      const route = await estimateRoute(
        db,
        { lat: ride.pickupPoint.y, lng: ride.pickupPoint.x },
        destination
      );
      try {
        await db.transaction((tx) =>
          requestDestinationChange(
            tx,
            session.user.id,
            bookingId,
            {
              ...destination,
              distanceM: route.distanceM,
              distanceSource: route.source,
            },
            clientRequestId
          )
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("DESTINATION_CHANGE_PENDING");
        }
        throw error;
      }
    }),

  disputePayment: clientProcedure
    .input(reasonSchema.extend({ bookingId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { bookingId, ...action } = input;
      assertReason(DISPUTE_REASONS, action.reasonCode, action.reasonNote);
      await ctx.db.transaction((tx) =>
        disputePayment(tx, ctx.session.user.id, bookingId, action)
      );
    }),

  history: clientProcedure
    .input(z.object({ page: z.number().int().min(1).default(1) }))
    .query(async ({ ctx, input }) => {
      const labels = placeLabels();
      const rows = await labels
        .joins(
          ctx.db
            .select({
              ...historyColumns,
              pickup: labels.pickup,
              destination: labels.destination,
              category: sql<string>`coalesce(${offer.category}::text, ${booking.requestedCategory}::text)`,
            })
            .from(booking)
            .leftJoin(payment, eq(payment.bookingId, booking.id))
            .leftJoin(
              offer,
              and(eq(offer.bookingId, booking.id), eq(offer.status, "accepted"))
            )
            .$dynamic()
        )
        .where(
          and(
            eq(booking.clientId, ctx.session.user.id),
            not(inArray(booking.status, [...IN_REQUEST, ...ACTIVE_RIDE]))
          )
        )
        .orderBy(desc(booking.createdAt))
        .limit(PAGE_SIZE)
        .offset((input.page - 1) * PAGE_SIZE);
      return rows;
    }),
});
