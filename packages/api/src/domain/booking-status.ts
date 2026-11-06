import { TRPCError } from "@trpc/server";
import type { Database } from "@zay-app/db";
import { booking, bookingEvent } from "@zay-app/db/schema/bookings";
import { and, eq } from "drizzle-orm";

export type BookingStatus = typeof booking.$inferSelect.status;
type BookingEvent = typeof bookingEvent.$inferSelect;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const statusChanged = () =>
  new TRPCError({ code: "CONFLICT", message: "BOOKING_STATUS_CHANGED" });

/** The storage contract from spec 0001. No other status change is allowed. */
export const BOOKING_TRANSITIONS: Readonly<
  Record<BookingStatus, readonly BookingStatus[]>
> = {
  PENDING: ["SEARCHING", "CANCELLED", "EXPIRED"],
  SEARCHING: ["OFFERED", "NO_DRIVER_FOUND", "CANCELLED", "EXPIRED"],
  OFFERED: ["SEARCHING", "ACCEPTED", "NO_DRIVER_FOUND", "CANCELLED", "EXPIRED"],
  ACCEPTED: ["DRIVER_ARRIVING", "CANCELLED", "SEARCHING"],
  DRIVER_ARRIVING: ["ARRIVED", "CANCELLED", "SEARCHING"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED", "SEARCHING"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: [],
  EXPIRED: [],
  NO_DRIVER_FOUND: [],
  DISPUTED: ["COMPLETED"],
};

export const canTransition = (from: BookingStatus, to: BookingStatus) =>
  BOOKING_TRANSITIONS[from].includes(to);

export interface TransitionInput {
  actor: {
    actorKind: BookingEvent["actorKind"];
    actorId: string | null;
  };
  bookingId: string;
  clientRequestId?: string | null;
  eventType: string;
  reasonCode?: string | null;
  reasonNote?: string | null;
  to: BookingStatus;
}

export interface TransitionResult {
  booking: typeof booking.$inferSelect;
  event: BookingEvent;
  replayed: boolean;
}

/**
 * The only write of `booking.status` on the server. Call it inside a transaction.
 * It never creates the `payment` row, because closing a dispute also returns to
 * `COMPLETED`. The end of ride action does that.
 */
export async function transitionBooking(
  tx: Transaction,
  input: TransitionInput
): Promise<TransitionResult> {
  const { bookingId, to, actor, eventType, clientRequestId } = input;

  // A double click waits here, then finds the first click's event below.
  const [current] = await tx
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .for("update");
  if (!current) {
    throw statusChanged();
  }

  if (clientRequestId && actor.actorId) {
    const [original] = await tx
      .select()
      .from(bookingEvent)
      .where(
        and(
          eq(bookingEvent.actorId, actor.actorId),
          eq(bookingEvent.clientRequestId, clientRequestId)
        )
      )
      .limit(1);
    if (original) {
      return {
        booking: { ...current, status: original.toStatus ?? current.status },
        event: original,
        replayed: true,
      };
    }
  }

  if (!canTransition(current.status, to)) {
    throw statusChanged();
  }

  const now = new Date();
  const [updated] = await tx
    .update(booking)
    .set({ status: to, statusChangedAt: now })
    .where(eq(booking.id, bookingId))
    .returning();
  const [event] = await tx
    .insert(bookingEvent)
    .values({
      bookingId,
      type: eventType,
      fromStatus: current.status,
      toStatus: to,
      actorKind: actor.actorKind,
      actorId: actor.actorId,
      reasonCode: input.reasonCode ?? null,
      reasonNote: input.reasonNote ?? null,
      clientRequestId: clientRequestId ?? null,
      createdAt: now,
    })
    .returning();
  if (!(updated && event)) {
    throw new Error("transitionBooking wrote no row");
  }
  return { booking: updated, event, replayed: false };
}
