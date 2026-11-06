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
import { driverProfile, vehicle } from "@zay-app/db/schema/drivers";
import { payment, paymentEvent } from "@zay-app/db/schema/payments";
import { settingsVersion } from "@zay-app/db/schema/settings";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";

import { transitionBooking } from "../../domain/booking-status";
import {
  CANCELLATION_REASONS,
  DISPUTE_REASONS,
  PAYMENT_RESOLUTION_REASONS,
} from "../../domain/codes";
import { paymentStatusFor } from "../../domain/payment";
import { actorFromSession } from "../../domain/staff";
import { router, staffProcedure } from "../../index";
import {
  assertReason,
  badRequest,
  conflict,
  daySchema,
  likePattern,
  noteSchema,
  notFound,
  offsetOf,
  optionalNoteSchema,
  PAGE_SIZE,
  pageSchema,
  TIME_ZONE,
} from "./common";
import { placeLabels } from "./places";

const MAX_RETAINED_AR = 10_000_000;
const client = alias(user, "client");
const driver = alias(user, "driver");

const dayStart = (day: string) =>
  sql`(${day}::date)::timestamp AT TIME ZONE ${sql.raw(`'${TIME_ZONE}'`)}`;
const dayEnd = (day: string) =>
  sql`((${day}::date) + 1)::timestamp AT TIME ZONE ${sql.raw(`'${TIME_ZONE}'`)}`;

// An accepted offer wins. A withdrawn one counts only while the search has not restarted.
const rideCategory = sql<string>`coalesce(
  (SELECT o.category::text FROM ${offer} o WHERE o.booking_id = ${booking.id} AND o.status = 'accepted' LIMIT 1),
  CASE WHEN ${booking.status} NOT IN ('SEARCHING', 'OFFERED') THEN
    (SELECT o.category::text FROM ${offer} o WHERE o.booking_id = ${booking.id} AND o.status = 'withdrawn' ORDER BY o.updated_at DESC LIMIT 1)
  END,
  ${booking.requestedCategory}::text
)`;
const estimatedPrice = sql<number | null>`(
  SELECT min(q.amount_ar) FROM ${fareQuote} q WHERE q.booking_id = ${booking.id} AND q.replaced_at IS NULL
)`;

const actionInput = z.object({
  bookingId: z.string().uuid(),
  reasonCode: z.string(),
  reasonNote: optionalNoteSchema,
  clientRequestId: z.string().uuid(),
});

export const bookingsRouter = router({
  list: staffProcedure
    .input(
      z.object({
        q: z.string().optional(),
        status: z.enum(booking.status.enumValues).optional(),
        from: daySchema.optional(),
        to: daySchema.optional(),
        page: pageSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const pattern = likePattern(input.q);
      const filters: (SQL | undefined)[] = [];
      if (pattern) {
        filters.push(
          or(
            ilike(client.name, pattern),
            ilike(client.phone, pattern),
            ilike(driver.name, pattern),
            ilike(driver.phone, pattern)
          )
        );
      }
      if (input.status) {
        filters.push(eq(booking.status, input.status));
      }
      if (input.from) {
        filters.push(sql`${booking.createdAt} >= ${dayStart(input.from)}`);
      }
      if (input.to) {
        filters.push(sql`${booking.createdAt} < ${dayEnd(input.to)}`);
      }
      const where = and(...filters);
      const places = placeLabels();
      const items = await places
        .joins(
          ctx.db
            .select({
              id: booking.id,
              status: booking.status,
              clientName: client.name,
              driverName: driver.name,
              category: rideCategory,
              agreedPriceAr: booking.agreedPriceAr,
              estimatedPriceAr: estimatedPrice,
              pickup: places.pickup,
              destination: places.destination,
              createdAt: booking.createdAt,
            })
            .from(booking)
            .innerJoin(client, eq(client.id, booking.clientId))
            .leftJoin(driver, eq(driver.id, booking.driverId))
            .$dynamic()
        )
        .where(where)
        .orderBy(desc(booking.createdAt), desc(booking.id))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(booking)
        .innerJoin(client, eq(client.id, booking.clientId))
        .leftJoin(driver, eq(driver.id, booking.driverId))
        .where(where);
      return { items, total: count?.total ?? 0 };
    }),

  get: staffProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const places = placeLabels();
      const [row] = await places
        .joins(
          ctx.db
            .select({
              booking,
              category: rideCategory,
              pickup: places.pickup,
              destination: places.destination,
              settingsVersion: settingsVersion.version,
              clientName: client.name,
              clientPhone: client.phone,
              clientEmail: client.email,
              driverName: driver.name,
              driverPhone: driver.phone,
              isSimulated: driverProfile.isSimulated,
              vehicleCategory: vehicle.category,
              vehicleMake: vehicle.make,
              vehicleModel: vehicle.model,
              vehicleRegistration: vehicle.registration,
            })
            .from(booking)
            .innerJoin(client, eq(client.id, booking.clientId))
            .innerJoin(
              settingsVersion,
              eq(settingsVersion.id, booking.settingsVersionId)
            )
            .leftJoin(driver, eq(driver.id, booking.driverId))
            .leftJoin(driverProfile, eq(driverProfile.userId, booking.driverId))
            .leftJoin(vehicle, eq(vehicle.id, booking.vehicleId))
            .$dynamic()
        )
        .where(eq(booking.id, input.bookingId))
        .limit(1);
      if (!row) {
        throw notFound();
      }
      const { bookingId } = input;
      const quotes = await ctx.db
        .select()
        .from(fareQuote)
        .where(eq(fareQuote.bookingId, bookingId))
        .orderBy(asc(fareQuote.createdAt));
      const offerDriver = alias(user, "offer_driver");
      const offers = await ctx.db
        .select({
          id: offer.id,
          status: offer.status,
          category: offer.category,
          currentPriceAr: offer.currentPriceAr,
          createdAt: offer.createdAt,
          driverId: offer.driverId,
          driverName: offerDriver.name,
        })
        .from(offer)
        .innerJoin(offerDriver, eq(offerDriver.id, offer.driverId))
        .where(eq(offer.bookingId, bookingId))
        .orderBy(asc(offer.createdAt));
      const proposalActor = alias(user, "proposal_actor");
      const proposals =
        offers.length === 0
          ? []
          : await ctx.db
              .select({
                id: offerProposal.id,
                offerId: offerProposal.offerId,
                actorKind: offerProposal.actorKind,
                actorName: proposalActor.name,
                kind: offerProposal.kind,
                amountAr: offerProposal.amountAr,
                reasonCode: offerProposal.reasonCode,
                reasonNote: offerProposal.reasonNote,
                createdAt: offerProposal.createdAt,
              })
              .from(offerProposal)
              .innerJoin(
                proposalActor,
                eq(proposalActor.id, offerProposal.actorId)
              )
              .where(
                inArray(
                  offerProposal.offerId,
                  offers.map((item) => item.id)
                )
              )
              .orderBy(asc(offerProposal.createdAt));
      const destinationChanges = await ctx.db
        .select({
          id: destinationChange.id,
          status: destinationChange.status,
          oldPriceAr: destinationChange.oldPriceAr,
          newPriceAr: destinationChange.newPriceAr,
          oldNote: destinationChange.oldNote,
          newNote: destinationChange.newNote,
          createdAt: destinationChange.createdAt,
        })
        .from(destinationChange)
        .where(eq(destinationChange.bookingId, bookingId))
        .orderBy(asc(destinationChange.createdAt));
      const [paymentRow] = await ctx.db
        .select()
        .from(payment)
        .where(eq(payment.bookingId, bookingId));
      const paymentActor = alias(user, "payment_actor");
      const paymentEvents = paymentRow
        ? await ctx.db
            .select({
              id: paymentEvent.id,
              kind: paymentEvent.kind,
              amountAr: paymentEvent.amountAr,
              actorKind: paymentEvent.actorKind,
              actorName: paymentActor.name,
              reasonCode: paymentEvent.reasonCode,
              reasonNote: paymentEvent.reasonNote,
              createdAt: paymentEvent.createdAt,
            })
            .from(paymentEvent)
            .leftJoin(paymentActor, eq(paymentActor.id, paymentEvent.actorId))
            .where(eq(paymentEvent.paymentId, paymentRow.id))
            .orderBy(asc(paymentEvent.createdAt))
        : [];
      const eventActor = alias(user, "event_actor");
      const events = await ctx.db
        .select({
          id: bookingEvent.id,
          type: bookingEvent.type,
          fromStatus: bookingEvent.fromStatus,
          toStatus: bookingEvent.toStatus,
          actorKind: bookingEvent.actorKind,
          actorName: eventActor.name,
          reasonCode: bookingEvent.reasonCode,
          reasonNote: bookingEvent.reasonNote,
          createdAt: bookingEvent.createdAt,
        })
        .from(bookingEvent)
        .leftJoin(eventActor, eq(eventActor.id, bookingEvent.actorId))
        .where(eq(bookingEvent.bookingId, bookingId))
        .orderBy(asc(bookingEvent.createdAt), asc(bookingEvent.id));
      return {
        booking: row.booking,
        category: row.category,
        places: { pickup: row.pickup, destination: row.destination },
        settingsVersion: row.settingsVersion,
        client: {
          name: row.clientName,
          phone: row.clientPhone,
          email: row.clientEmail,
          id: row.booking.clientId,
        },
        driver: row.driverName
          ? {
              id: row.booking.driverId,
              name: row.driverName,
              phone: row.driverPhone,
              isSimulated: row.isSimulated ?? false,
            }
          : null,
        vehicle: row.vehicleModel
          ? {
              category: row.vehicleCategory,
              make: row.vehicleMake,
              model: row.vehicleModel,
              registration: row.vehicleRegistration,
            }
          : null,
        quotes,
        offers: offers.map((item) => ({
          ...item,
          proposals: proposals.filter(
            (proposal) => proposal.offerId === item.id
          ),
        })),
        destinationChanges,
        payment: paymentRow
          ? {
              paymentId: paymentRow.id,
              status: paymentRow.status,
              method: paymentRow.method,
              agreedAmountAr: paymentRow.agreedAmountAr,
              declaredAmountAr: paymentRow.declaredAmountAr,
              originalDeclaredAr:
                paymentEvents
                  .filter((event) => event.kind === "declared")
                  .at(-1)?.amountAr ?? null,
              events: paymentEvents,
            }
          : null,
        events,
      };
    }),

  cancel: staffProcedure.input(actionInput).mutation(async ({ ctx, input }) => {
    const { bookingId, reasonCode, reasonNote, clientRequestId } = input;
    assertReason(CANCELLATION_REASONS, reasonCode, reasonNote);
    const actor = actorFromSession(ctx.session);
    return await ctx.db.transaction(async (tx) => {
      const result = await transitionBooking(tx, {
        bookingId,
        to: "CANCELLED",
        actor,
        eventType: "status_changed",
        reasonCode,
        reasonNote,
        clientRequestId,
      });
      if (result.replayed) {
        return { status: result.booking.status };
      }
      await tx
        .update(offer)
        .set({ status: "void" })
        .where(
          and(
            eq(offer.bookingId, bookingId),
            inArray(offer.status, ["sent", "priced", "negotiating"])
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
      const expired = await tx
        .update(destinationChange)
        .set({ status: "expired" })
        .where(
          and(
            eq(destinationChange.bookingId, bookingId),
            eq(destinationChange.status, "pending")
          )
        )
        .returning({ id: destinationChange.id });
      if (expired.length > 0) {
        await tx.insert(bookingEvent).values({
          bookingId,
          type: "destination_expired",
          actorKind: actor.actorKind,
          actorId: actor.actorId,
        });
      }
      return { status: result.booking.status };
    });
  }),

  openDispute: staffProcedure
    .input(actionInput)
    .mutation(async ({ ctx, input }) => {
      const { bookingId, reasonCode, reasonNote, clientRequestId } = input;
      assertReason(DISPUTE_REASONS, reasonCode, reasonNote);
      const actor = actorFromSession(ctx.session);
      return await ctx.db.transaction(async (tx) => {
        const result = await transitionBooking(tx, {
          bookingId,
          to: "DISPUTED",
          actor,
          eventType: "dispute_opened",
          reasonCode,
          reasonNote,
          clientRequestId,
        });
        return { status: result.booking.status };
      });
    }),

  closeDispute: staffProcedure
    .input(
      z.object({
        bookingId: z.string().uuid(),
        reasonNote: noteSchema,
        clientRequestId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { bookingId, reasonNote, clientRequestId } = input;
      const actor = actorFromSession(ctx.session);
      return await ctx.db.transaction(async (tx) => {
        const result = await transitionBooking(tx, {
          bookingId,
          to: "COMPLETED",
          actor,
          eventType: "dispute_closed",
          reasonNote,
          clientRequestId,
        });
        return { status: result.booking.status };
      });
    }),

  resolvePayment: staffProcedure
    .input(
      z.object({
        paymentId: z.string().uuid(),
        retainedAmountAr: z.number().int().min(0).max(MAX_RETAINED_AR),
        reasonCode: z.string(),
        reasonNote: optionalNoteSchema,
        clientRequestId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        paymentId,
        retainedAmountAr,
        reasonCode,
        reasonNote,
        clientRequestId,
      } = input;
      assertReason(PAYMENT_RESOLUTION_REASONS, reasonCode, reasonNote);
      const actor = actorFromSession(ctx.session);
      return await ctx.db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, paymentId))
          .for("update");
        if (!current) {
          throw notFound();
        }
        const [replay] = await tx
          .select({ amountAr: paymentEvent.amountAr })
          .from(paymentEvent)
          .where(
            and(
              eq(paymentEvent.actorId, actor.actorId),
              eq(paymentEvent.clientRequestId, clientRequestId)
            )
          )
          .limit(1);
        if (replay) {
          return {
            status: paymentStatusFor(
              replay.amountAr ?? 0,
              current.agreedAmountAr
            ),
          };
        }
        if (current.status !== "disputed") {
          throw conflict("PAYMENT_NOT_DISPUTED");
        }
        if (retainedAmountAr > current.agreedAmountAr) {
          throw badRequest("AMOUNT_ABOVE_AGREED");
        }
        const status = paymentStatusFor(
          retainedAmountAr,
          current.agreedAmountAr
        );
        await tx.insert(paymentEvent).values({
          paymentId,
          kind: "resolved",
          amountAr: retainedAmountAr,
          ...actor,
          reasonCode,
          reasonNote,
          clientRequestId,
        });
        await tx
          .update(payment)
          .set({ declaredAmountAr: retainedAmountAr, status })
          .where(eq(payment.id, paymentId));
        return { status };
      });
    }),
});
