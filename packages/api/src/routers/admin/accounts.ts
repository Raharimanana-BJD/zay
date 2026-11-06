import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { offer } from "@zay-app/db/schema/dispatch";
import { driverProfile } from "@zay-app/db/schema/drivers";
import { auditLog } from "@zay-app/db/schema/support";
import { and, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import z from "zod";

import type { Context } from "../../context";
import { SUSPENSION_REASONS } from "../../domain/codes";
import { adminProcedure, router, staffProcedure } from "../../index";
import {
  assertReason,
  badRequest,
  isBanned,
  likePattern,
  notFound,
  offsetOf,
  optionalNoteSchema,
  PAGE_SIZE,
  pageSchema,
} from "./common";
import { placeLabels } from "./places";

const RECENT_BOOKINGS = 10;
const CLIENT_ACTIVE = [
  "PENDING",
  "SEARCHING",
  "OFFERED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
] as const;
const DRIVER_ACTIVE = [
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
] as const;

/** The latest suspension action on an account, or null if it never had one. */
export async function lastBanAction(db: Context["db"], userId: string) {
  const [last] = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.targetId, userId),
        inArray(auditLog.action, ["account.banned", "account.unbanned"])
      )
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(1);
  return last?.action ?? null;
}

/** Banned with no matching audit line: the suspension stopped halfway. */
export async function suspensionIncomplete(
  db: Context["db"],
  userId: string,
  banned: boolean
) {
  return banned && (await lastBanAction(db, userId)) !== "account.banned";
}

async function findActiveRide(db: Context["db"], userId: string) {
  const [ride] = await db
    .select({ id: booking.id })
    .from(booking)
    .where(
      or(
        and(
          eq(booking.clientId, userId),
          inArray(booking.status, [...CLIENT_ACTIVE])
        ),
        and(
          eq(booking.driverId, userId),
          inArray(booking.status, [...DRIVER_ACTIVE])
        )
      )
    )
    .orderBy(desc(booking.createdAt))
    .limit(1);
  return ride ?? null;
}

async function readAccount(db: Context["db"], userId: string) {
  const [account] = await db
    .select({
      id: user.id,
      role: user.role,
      banned: isBanned,
      banReason: user.banReason,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!account) {
    throw notFound();
  }
  return account;
}

export const accountsRouter = router({
  listClients: staffProcedure
    .input(
      z.object({
        q: z.string().optional(),
        banned: z.boolean().optional(),
        page: pageSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const pattern = likePattern(input.q);
      const filters: (SQL | undefined)[] = [eq(user.role, "client")];
      if (pattern) {
        filters.push(
          or(
            ilike(user.name, pattern),
            ilike(user.email, pattern),
            ilike(user.phone, pattern)
          )
        );
      }
      if (input.banned !== undefined) {
        filters.push(sql`${isBanned} = ${input.banned}`);
      }
      const where = and(...filters);
      const items = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          banned: isBanned,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(where)
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
        .where(where);
      return { items, total: count?.total ?? 0 };
    }),

  getClient: staffProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [client] = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          locale: user.locale,
          banned: isBanned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(and(eq(user.id, input.userId), eq(user.role, "client")))
        .limit(1);
      if (!client) {
        throw notFound();
      }
      const places = placeLabels();
      const bookings = await places
        .joins(
          ctx.db
            .select({
              id: booking.id,
              status: booking.status,
              agreedPriceAr: booking.agreedPriceAr,
              createdAt: booking.createdAt,
              pickup: places.pickup,
              destination: places.destination,
            })
            .from(booking)
            .$dynamic()
        )
        .where(eq(booking.clientId, client.id))
        .orderBy(desc(booking.createdAt), desc(booking.id))
        .limit(RECENT_BOOKINGS);
      return {
        ...client,
        bookings,
        suspensionIncomplete: await suspensionIncomplete(
          ctx.db,
          client.id,
          client.banned
        ),
      };
    }),

  ban: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        reasonCode: z.string(),
        reasonNote: optionalNoteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, reasonCode, reasonNote } = input;
      assertReason(SUSPENSION_REASONS, reasonCode, reasonNote);
      if (userId === ctx.session.user.id) {
        throw badRequest("CANNOT_TARGET_SELF");
      }
      const account = await readAccount(ctx.db, userId);
      if (
        account.banned &&
        (await lastBanAction(ctx.db, userId)) === "account.banned"
      ) {
        return { ok: true as const };
      }
      const banReason = reasonNote
        ? `${reasonCode}: ${reasonNote}`
        : reasonCode;
      if (!account.banned) {
        const ride = await findActiveRide(ctx.db, userId);
        if (ride) {
          return {
            ok: false as const,
            code: "ACTIVE_RIDE" as const,
            bookingId: ride.id,
          };
        }
        await ctx.auth.api.banUser({
          headers: ctx.headers,
          body: { userId, banReason },
        });
      }
      await ctx.db.transaction(async (tx) => {
        const [profile] = await tx
          .select({ userId: driverProfile.userId })
          .from(driverProfile)
          .where(eq(driverProfile.userId, userId));
        if (profile) {
          await tx
            .update(driverProfile)
            .set({ isOnline: false, isAvailable: false })
            .where(eq(driverProfile.userId, userId));
          await tx
            .update(offer)
            .set({ status: "void" })
            .where(
              and(
                eq(offer.driverId, userId),
                inArray(offer.status, ["sent", "priced", "negotiating"])
              )
            );
        }
        await tx.insert(auditLog).values({
          actorId: ctx.session.user.id,
          action: "account.banned",
          targetType: "user",
          targetId: userId,
          before: { banned: account.banned, banReason: account.banReason },
          after: { banned: true, reasonCode, reasonNote: reasonNote ?? null },
        });
      });
      return { ok: true as const };
    }),

  unban: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;
      const account = await readAccount(ctx.db, userId);
      if (account.banned) {
        await ctx.auth.api.unbanUser({
          headers: ctx.headers,
          body: { userId },
        });
      } else if ((await lastBanAction(ctx.db, userId)) !== "account.banned") {
        // A replay after a failed audit write passes the test above and rewrites the line.
        throw badRequest("ACCOUNT_NOT_BANNED");
      }
      await ctx.db.insert(auditLog).values({
        actorId: ctx.session.user.id,
        action: "account.unbanned",
        targetType: "user",
        targetId: userId,
        before: { banned: true, banReason: account.banReason },
        after: { banned: false },
      });
      return { ok: true as const };
    }),
});
