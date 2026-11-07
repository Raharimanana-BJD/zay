import { TRPCError } from "@trpc/server";
import type { Database } from "@zay-app/db";
import { user } from "@zay-app/db/schema/auth";
import {
  booking,
  destinationChange,
  fareQuote,
} from "@zay-app/db/schema/bookings";
import { offer, offerProposal } from "@zay-app/db/schema/dispatch";
import {
  driverDocument,
  driverPosition,
  driverProfile,
  vehicle,
  verificationDecision,
} from "@zay-app/db/schema/drivers";
import { payment } from "@zay-app/db/schema/payments";
import { categoryFare } from "@zay-app/db/schema/settings";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import z from "zod";

import {
  CANCELLATION_REASONS,
  DRIVER_DOCUMENT_TYPES,
  PRICE_ADJUSTMENT_REASONS,
} from "../domain/codes";
import { ACTIVE_RIDE, OPEN_OFFERS } from "../domain/dispatch";
import {
  type FileAccess,
  fileKindOf,
  UPLOAD_DOC_KEY,
  UPLOAD_PHOTO_KEY,
} from "../domain/files";
import { conflict, driverAnswer } from "../domain/offers";
import { registerDriver } from "../domain/profile";
import {
  advanceRide,
  answerDestinationChange,
  declarePayment,
  withdrawByDriver,
} from "../domain/rides";
import { faresOf, latestSettings, pointSql } from "../domain/trip";
import { completeProcedure, driverProcedure, router } from "../index";
import {
  assertReason,
  isUniqueViolation,
  PAGE_SIZE,
  TIME_ZONE,
} from "./admin/common";
import { placeLabels } from "./admin/places";
import {
  historyColumns,
  noteSchema,
  priceSchema,
  reasonSchema,
  requestIdSchema,
} from "./shared";

const MS_PER_S = 1000;
const SHORT_TEXT = 80;

const relationSchema = z.enum(["owner", "renter", "employee"]);
const zone = sql.raw(`'${TIME_ZONE}'`);

const secondsUntil = (date: Date, now: Date) =>
  Math.max(0, Math.ceil((date.getTime() - now.getTime()) / MS_PER_S));

async function readProfile(db: Database, driverId: string) {
  const [row] = await db
    .select()
    .from(driverProfile)
    .where(eq(driverProfile.userId, driverId));
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "DRIVER_NOT_REGISTERED",
    });
  }
  return row;
}

/** What still blocks this driver from receiving requests, as stable codes. */
async function blockers(db: Database, driverId: string) {
  const profile = await readProfile(db, driverId);
  const reasons: string[] = [];
  if (profile.verificationStatus !== "approved") {
    reasons.push("ACCOUNT_NOT_APPROVED");
  }
  const [active] = profile.activeVehicleId
    ? await db
        .select({
          status: vehicle.verificationStatus,
          archivedAt: vehicle.archivedAt,
        })
        .from(vehicle)
        .where(eq(vehicle.id, profile.activeVehicleId))
    : [];
  if (!active || active.archivedAt) {
    reasons.push("NO_ACTIVE_VEHICLE");
  } else if (active.status !== "approved") {
    reasons.push("VEHICLE_NOT_APPROVED");
  }
  const [expired] = await db
    .select({ id: driverDocument.id })
    .from(driverDocument)
    .where(
      and(
        eq(driverDocument.driverId, driverId),
        isNull(driverDocument.replacedAt),
        lt(driverDocument.expiresAt, new Date())
      )
    )
    .limit(1);
  if (expired) {
    reasons.push("DOCUMENT_EXPIRED");
  }
  return { profile, reasons };
}

async function readOpenOffer(db: Database, driverId: string, now: Date) {
  const labels = placeLabels();
  const [row] = await labels
    .joins(
      db
        .select({
          id: offer.id,
          bookingId: offer.bookingId,
          status: offer.status,
          category: offer.category,
          currentPriceAr: offer.currentPriceAr,
          expiresAt: offer.expiresAt,
          quotedAr: fareQuote.amountAr,
          minAr: fareQuote.minAr,
          maxAr: fareQuote.maxAr,
          distanceM: fareQuote.distanceM,
          settingsVersionId: fareQuote.settingsVersionId,
          passengers: booking.passengers,
          pickupPoint: booking.pickupPoint,
          destinationPoint: booking.destinationPoint,
          pickupNote: booking.pickupNote,
          destinationNote: booking.destinationNote,
          pickup: labels.pickup,
          destination: labels.destination,
          toPickupM: sql<
            number | null
          >`ST_Distance(${driverPosition.point}::geography, ${booking.pickupPoint}::geography)`,
        })
        .from(offer)
        .innerJoin(booking, eq(booking.id, offer.bookingId))
        .innerJoin(fareQuote, eq(fareQuote.id, offer.fareQuoteId))
        .leftJoin(driverPosition, eq(driverPosition.driverId, offer.driverId))
        .$dynamic()
    )
    .where(
      and(
        eq(offer.driverId, driverId),
        inArray(offer.status, [...OPEN_OFFERS]),
        sql`${offer.expiresAt} > ${now.toISOString()}::timestamptz`
      )
    )
    .limit(1);
  if (!row) {
    return null;
  }
  const proposals = await db
    .select({
      kind: offerProposal.kind,
      actorKind: offerProposal.actorKind,
      amountAr: offerProposal.amountAr,
    })
    .from(offerProposal)
    .where(eq(offerProposal.offerId, row.id))
    .orderBy(asc(offerProposal.createdAt), asc(offerProposal.id));
  const [fare] = await db
    .select({ roundingAr: categoryFare.roundingAr })
    .from(categoryFare)
    .where(
      and(
        eq(categoryFare.settingsVersionId, row.settingsVersionId),
        eq(categoryFare.category, row.category)
      )
    );
  const {
    expiresAt,
    settingsVersionId: _settings,
    pickupPoint,
    destinationPoint,
    toPickupM,
    ...rest
  } = row;
  return {
    ...rest,
    pickupLat: pickupPoint.y,
    pickupLng: pickupPoint.x,
    destinationLat: destinationPoint.y,
    destinationLng: destinationPoint.x,
    toPickupM: toPickupM === null ? null : Math.round(Number(toPickupM)),
    expiresInS: secondsUntil(expiresAt, now),
    roundingAr: fare?.roundingAr ?? 100,
    clientCounterAr:
      proposals
        .filter((p) => p.kind === "counter" && p.actorKind === "client")
        .at(-1)?.amountAr ?? null,
    waitingClient: proposals.at(-1)?.actorKind === "driver",
    canCounter: !proposals.some(
      (p) => p.kind === "counter" && p.actorKind === "driver"
    ),
  };
}

async function readRide(
  db: Database,
  files: FileAccess,
  driverId: string,
  where: SQL
) {
  const labels = placeLabels();
  const [row] = await labels
    .joins(
      db
        .select({
          id: booking.id,
          status: booking.status,
          agreedPriceAr: booking.agreedPriceAr,
          passengers: booking.passengers,
          pickupPoint: booking.pickupPoint,
          destinationPoint: booking.destinationPoint,
          pickupNote: booking.pickupNote,
          destinationNote: booking.destinationNote,
          pickup: labels.pickup,
          destination: labels.destination,
          clientName: user.name,
          clientPhone: user.phone,
          clientImage: user.image,
          paymentStatus: payment.status,
          declaredAmountAr: payment.declaredAmountAr,
        })
        .from(booking)
        .innerJoin(user, eq(user.id, booking.clientId))
        .leftJoin(payment, eq(payment.bookingId, booking.id))
        .$dynamic()
    )
    .where(and(eq(booking.driverId, driverId), where))
    .orderBy(desc(booking.createdAt))
    .limit(1);
  if (!row) {
    return null;
  }
  const now = new Date();
  const [change] = await db
    .select({
      oldPriceAr: destinationChange.oldPriceAr,
      newPriceAr: destinationChange.newPriceAr,
      newNote: destinationChange.newNote,
      newDistanceM: destinationChange.newDistanceM,
      newPoint: destinationChange.newPoint,
      expiresAt: destinationChange.expiresAt,
    })
    .from(destinationChange)
    .where(
      and(
        eq(destinationChange.bookingId, row.id),
        eq(destinationChange.status, "pending")
      )
    );
  const { pickupPoint, destinationPoint, clientImage, ...rest } = row;
  return {
    ...rest,
    clientImageUrl: clientImage
      ? ((await files.getUrl(clientImage))?.url ?? null)
      : null,
    pickupLat: pickupPoint.y,
    pickupLng: pickupPoint.x,
    destinationLat: destinationPoint.y,
    destinationLng: destinationPoint.x,
    destinationChange: change
      ? {
          oldPriceAr: change.oldPriceAr,
          newPriceAr: change.newPriceAr,
          newNote: change.newNote,
          newDistanceM: change.newDistanceM,
          expiresInS: secondsUntil(change.expiresAt, now),
        }
      : null,
  };
}

const vehicleInput = z.object({
  id: z.uuid().optional(),
  category: z.enum(["car", "tuk_tuk"]),
  make: z.string().trim().max(SHORT_TEXT).optional(),
  model: z.string().trim().min(1).max(SHORT_TEXT),
  registration: z.string().trim().max(SHORT_TEXT).optional(),
  capacity: z.number().int().min(1),
  photoKey: z.string().regex(UPLOAD_PHOTO_KEY).optional(),
});

export const driverRouter = router({
  /** The sign up form creates a client, and this turns it into a driver once. */
  register: completeProcedure
    .input(z.object({ employmentRelation: relationSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction((tx) =>
        registerDriver(tx, ctx.session.user, input.employmentRelation)
      );
    }),

  /** Everything the driver's home needs, read again every few seconds. */
  home: driverProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    const driverId = session.user.id;
    const now = new Date();
    const { profile, reasons } = await blockers(db, driverId);
    const settings = await latestSettings(db);
    const [position] = await db
      .select({ receivedAt: driverPosition.receivedAt })
      .from(driverPosition)
      .where(eq(driverPosition.driverId, driverId));
    const ride = await readRide(
      db,
      ctx.files,
      driverId,
      inArray(booking.status, [...ACTIVE_RIDE])
    );
    const [today] = await db
      .select({
        rides: sql<number>`count(*)::int`,
        agreedAr: sql<number>`coalesce(sum(${payment.agreedAmountAr}), 0)::int`,
        collectedAr: sql<number>`coalesce(sum(${payment.declaredAmountAr}), 0)::int`,
      })
      .from(booking)
      .innerJoin(payment, eq(payment.bookingId, booking.id))
      .where(
        and(
          eq(booking.driverId, driverId),
          sql`(${booking.completedAt} AT TIME ZONE ${zone})::date = (now() AT TIME ZONE ${zone})::date`
        )
      );
    return {
      verificationStatus: profile.verificationStatus,
      isOnline: profile.isOnline,
      isAvailable: profile.isAvailable,
      blockers: reasons,
      positionIntervalS: Math.max(5, Math.floor(settings.gpsMaxAgeS / 4)),
      hasPosition: Boolean(position),
      offer: ride ? null : await readOpenOffer(db, driverId, now),
      ride,
      today: today ?? { rides: 0, agreedAr: 0, collectedAr: 0 },
    };
  }),

  setAvailability: driverProcedure
    .input(z.object({ isOnline: z.boolean(), isAvailable: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const { reasons } = await blockers(db, session.user.id);
      if (input.isAvailable && reasons.length > 0) {
        throw conflict(reasons[0] as string);
      }
      await db
        .update(driverProfile)
        .set({
          isOnline: input.isOnline,
          isAvailable: input.isOnline && input.isAvailable,
        })
        .where(eq(driverProfile.userId, session.user.id));
    }),

  updatePosition: driverProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracyM: z.number().nonnegative().optional(),
        recordedAt: z.iso.datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const point = { x: input.lng, y: input.lat };
      const recordedAt = new Date(input.recordedAt);
      await ctx.db
        .insert(driverPosition)
        .values({
          driverId: ctx.session.user.id,
          point,
          accuracyM: input.accuracyM ?? null,
          recordedAt,
          receivedAt: now,
        })
        .onConflictDoUpdate({
          target: driverPosition.driverId,
          set: {
            point: pointSql(input),
            accuracyM: input.accuracyM ?? null,
            recordedAt,
            receivedAt: now,
          },
          // A late packet from a bad network never moves the driver backwards.
          setWhere: lt(driverPosition.recordedAt, recordedAt),
        });
    }),

  answerOffer: driverProcedure
    .input(
      z.discriminatedUnion("action", [
        z.object({
          action: z.enum(["accept", "refuse"]),
          offerId: z.uuid(),
          clientRequestId: requestIdSchema,
        }),
        z.object({
          action: z.literal("propose"),
          offerId: z.uuid(),
          clientRequestId: requestIdSchema,
          amountAr: priceSchema,
          reasonCode: z.enum(PRICE_ADJUSTMENT_REASONS),
          reasonNote: noteSchema,
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
      const actor = { id: ctx.session.user.id, kind: "driver" as const };
      try {
        await ctx.db.transaction((tx) =>
          driverAnswer(tx, actor, offerId, answer, clientRequestId)
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("DRIVER_UNAVAILABLE");
        }
        throw error;
      }
    }),

  ride: driverProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const ride = await readRide(
        ctx.db,
        ctx.files,
        ctx.session.user.id,
        eq(booking.id, input.id)
      );
      if (!ride) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ride;
    }),

  advanceRide: driverProcedure
    .input(
      z.object({
        bookingId: z.uuid(),
        to: z.enum(["DRIVER_ARRIVING", "ARRIVED", "IN_PROGRESS", "COMPLETED"]),
        clientRequestId: requestIdSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction((tx) =>
        advanceRide(
          tx,
          ctx.session.user.id,
          input.bookingId,
          input.to,
          input.clientRequestId
        )
      );
    }),

  withdraw: driverProcedure
    .input(reasonSchema.extend({ bookingId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { bookingId, ...action } = input;
      assertReason(CANCELLATION_REASONS, action.reasonCode, action.reasonNote);
      await ctx.db.transaction((tx) =>
        withdrawByDriver(tx, ctx.session.user.id, bookingId, action)
      );
    }),

  answerDestination: driverProcedure
    .input(z.object({ bookingId: z.uuid(), accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction((tx) =>
        answerDestinationChange(
          tx,
          ctx.session.user.id,
          input.bookingId,
          input.accept
        )
      );
    }),

  declarePayment: driverProcedure
    .input(
      z.object({
        bookingId: z.uuid(),
        amountAr: z.number().int().nonnegative(),
        clientRequestId: requestIdSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction((tx) =>
        declarePayment(
          tx,
          ctx.session.user.id,
          input.bookingId,
          input.amountAr,
          input.clientRequestId
        )
      );
    }),

  /** Includes the rides this driver left, through its `withdrawn` offers. */
  history: driverProcedure
    .input(z.object({ page: z.number().int().min(1).default(1) }))
    .query(async ({ ctx, input }) => {
      const labels = placeLabels();
      return await labels
        .joins(
          ctx.db
            .select({
              ...historyColumns,
              offerStatus: offer.status,
              offerPriceAr: offer.currentPriceAr,
              category: offer.category,
              pickup: labels.pickup,
              destination: labels.destination,
            })
            .from(offer)
            .innerJoin(booking, eq(booking.id, offer.bookingId))
            .leftJoin(payment, eq(payment.bookingId, booking.id))
            .$dynamic()
        )
        .where(
          and(
            eq(offer.driverId, ctx.session.user.id),
            or(
              eq(offer.status, "withdrawn"),
              and(
                eq(offer.status, "accepted"),
                sql`${booking.status} NOT IN ('ACCEPTED', 'DRIVER_ARRIVING', 'ARRIVED', 'IN_PROGRESS')`
              )
            )
          )
        )
        .orderBy(desc(booking.createdAt))
        .limit(PAGE_SIZE)
        .offset((input.page - 1) * PAGE_SIZE);
    }),

  dossier: driverProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    const driverId = session.user.id;
    const profile = await readProfile(db, driverId);
    const vehicles = await db
      .select({
        id: vehicle.id,
        category: vehicle.category,
        make: vehicle.make,
        model: vehicle.model,
        registration: vehicle.registration,
        capacity: vehicle.capacity,
        photoKey: vehicle.photoKey,
        verificationStatus: vehicle.verificationStatus,
      })
      .from(vehicle)
      .where(and(eq(vehicle.driverId, driverId), isNull(vehicle.archivedAt)))
      .orderBy(asc(vehicle.createdAt));
    const currentDocuments = await db
      .select({
        id: driverDocument.id,
        typeCode: driverDocument.typeCode,
        storageKey: driverDocument.storageKey,
        verificationStatus: driverDocument.verificationStatus,
        expiresAt: driverDocument.expiresAt,
        sentAt: driverDocument.createdAt,
      })
      .from(driverDocument)
      .where(
        and(
          eq(driverDocument.driverId, driverId),
          isNull(driverDocument.replacedAt)
        )
      );
    const documentDecisions =
      currentDocuments.length === 0
        ? []
        : await db
            .select({
              subjectId: verificationDecision.subjectId,
              reasonCode: verificationDecision.reasonCode,
              reasonNote: verificationDecision.reasonNote,
            })
            .from(verificationDecision)
            .where(
              and(
                eq(verificationDecision.subject, "document"),
                inArray(
                  verificationDecision.subjectId,
                  currentDocuments.map((doc) => doc.id)
                )
              )
            )
            .orderBy(
              desc(verificationDecision.createdAt),
              desc(verificationDecision.id)
            );
    const documents = await Promise.all(
      currentDocuments.map(async ({ storageKey, ...doc }) => {
        // Rows come newest first, so the first match is the latest decision.
        const latest = documentDecisions.find(
          (row) => row.subjectId === doc.id
        );
        const file = await ctx.files.getUrl(storageKey);
        return {
          ...doc,
          fileKind: fileKindOf(storageKey),
          fileUrl: file?.url ?? null,
          reasonCode: latest?.reasonCode ?? null,
          reasonNote: latest?.reasonNote ?? null,
        };
      })
    );
    const [decision] = await db
      .select({
        status: verificationDecision.status,
        reasonCode: verificationDecision.reasonCode,
        reasonNote: verificationDecision.reasonNote,
      })
      .from(verificationDecision)
      .where(
        and(
          eq(verificationDecision.subject, "driver"),
          eq(verificationDecision.subjectId, driverId)
        )
      )
      .orderBy(desc(verificationDecision.createdAt))
      .limit(1);
    const settings = await latestSettings(db);
    const fares = await faresOf(db, settings.id);
    return {
      employmentRelation: profile.employmentRelation,
      verificationStatus: profile.verificationStatus,
      activeVehicleId: profile.activeVehicleId,
      lastDecision: decision ?? null,
      vehicles,
      documents,
      requiredDocuments: DRIVER_DOCUMENT_TYPES,
      capacityLimits: Object.fromEntries(
        fares.map((fare) => [fare.category, fare.maxCapacity])
      ) as Record<"car" | "tuk_tuk", number>,
    };
  }),

  setRelation: driverProcedure
    .input(z.object({ employmentRelation: relationSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(driverProfile)
        .set({ employmentRelation: input.employmentRelation })
        .where(eq(driverProfile.userId, ctx.session.user.id));
    }),

  saveVehicle: driverProcedure
    .input(vehicleInput)
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const driverId = session.user.id;
      const { id, ...fields } = input;
      const settings = await latestSettings(db);
      const fares = await faresOf(db, settings.id);
      const limit = fares.find((f) => f.category === fields.category);
      if (limit && fields.capacity > limit.maxCapacity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "CAPACITY_TOO_HIGH",
        });
      }
      try {
        return await db.transaction(async (tx) => {
          if (!id) {
            const [created] = await tx
              .insert(vehicle)
              .values({ ...fields, driverId })
              .returning({ id: vehicle.id });
            // A first vehicle is the one in use, so the driver has nothing to choose.
            await tx
              .update(driverProfile)
              .set({ activeVehicleId: created?.id })
              .where(
                and(
                  eq(driverProfile.userId, driverId),
                  isNull(driverProfile.activeVehicleId)
                )
              );
            return { id: created?.id as string };
          }
          const [current] = await tx
            .select()
            .from(vehicle)
            .where(and(eq(vehicle.id, id), eq(vehicle.driverId, driverId)))
            .for("update");
          if (!current) {
            throw new TRPCError({ code: "NOT_FOUND" });
          }
          // Spec 0001: these three facts were checked, so a change needs a new check.
          const recheck =
            current.category !== fields.category ||
            current.capacity !== fields.capacity ||
            (current.registration ?? "") !== (fields.registration ?? "");
          await tx
            .update(vehicle)
            .set({
              ...fields,
              verificationStatus: recheck
                ? "pending"
                : current.verificationStatus,
            })
            .where(eq(vehicle.id, id));
          return { id };
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("REGISTRATION_TAKEN");
        }
        throw error;
      }
    }),

  setActiveVehicle: driverProcedure
    .input(z.object({ vehicleId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = ctx;
      const driverId = session.user.id;
      const [own] = await db
        .select({ id: vehicle.id })
        .from(vehicle)
        .where(
          and(
            eq(vehicle.id, input.vehicleId),
            eq(vehicle.driverId, driverId),
            isNull(vehicle.archivedAt)
          )
        );
      if (!own) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const [active] = await db
        .select({ id: booking.id })
        .from(booking)
        .where(
          and(
            eq(booking.driverId, driverId),
            inArray(booking.status, [...ACTIVE_RIDE])
          )
        )
        .limit(1);
      if (active) {
        throw conflict("RIDE_IN_PROGRESS");
      }
      await db
        .update(driverProfile)
        .set({ activeVehicleId: input.vehicleId })
        .where(eq(driverProfile.userId, driverId));
    }),

  /** A new file replaces the current one of this type, and needs a new check (with no date). */
  attachDocument: driverProcedure
    .input(
      // Strict: the expiry date is the team's to set, at approval.
      z.strictObject({
        typeCode: z.enum(DRIVER_DOCUMENT_TYPES),
        storageKey: z.string().regex(UPLOAD_DOC_KEY),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const driverId = ctx.session.user.id;
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(driverDocument)
          .set({ replacedAt: new Date() })
          .where(
            and(
              eq(driverDocument.driverId, driverId),
              eq(driverDocument.typeCode, input.typeCode),
              isNull(driverDocument.replacedAt)
            )
          );
        await tx.insert(driverDocument).values({
          driverId,
          typeCode: input.typeCode,
          storageKey: input.storageKey,
        });
        // The team asked for a correction: this sends the file back to its queue.
        await tx
          .update(driverProfile)
          .set({ verificationStatus: "pending" })
          .where(
            and(
              eq(driverProfile.userId, driverId),
              eq(driverProfile.verificationStatus, "changes_requested")
            )
          );
      });
    }),
});
