import { TRPCError } from "@trpc/server";
import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { district, landmark } from "@zay-app/db/schema/places";
import { report, reportEvent } from "@zay-app/db/schema/support";
import { and, eq, isNull } from "drizzle-orm";
import z from "zod";

import { REPORT_TYPES } from "../domain/codes";
import { type FileAccess, isOwnAvatarKey } from "../domain/files";
import { conflict } from "../domain/offers";
import { phoneSchema } from "../domain/phone";
import { isProfileComplete, registerDriver } from "../domain/profile";
import { completeProcedure, protectedProcedure, router } from "../index";
import { isUniqueViolation } from "./admin/common";
import { noteSchema, requestIdSchema } from "./shared";

/** Deletes the previous avatar, only if it is one this same account sent. */
async function dropOldAvatar(
  files: FileAccess,
  previous: string | null | undefined,
  userId: string
) {
  if (!(previous && isOwnAvatarKey(previous, userId))) {
    return;
  }
  await files.remove(previous).catch(() => {
    // A file left on disk never blocks the change of photo.
  });
}

export const meRouter = router({
  /** The role comes from here, so a screen never trusts a stored copy. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        locale: user.locale,
        role: user.role,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id));
    if (!row) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const { image, ...profile } = row;
    return {
      ...profile,
      imageUrl: image ? ((await ctx.files.getUrl(image))?.url ?? null) : null,
      isComplete: isProfileComplete(row),
    };
  }),

  /**
   * The step after a Google sign up: the phone and the role, once (spec 0005).
   * Nothing is saved when the phone is already taken.
   */
  completeProfile: protectedProcedure
    .input(
      z.object({
        phone: phoneSchema,
        role: z.enum(["client", "driver"]),
        locale: z.enum(["fr", "mg"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await ctx.db
        .select({
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, userId));
      if (!row || isProfileComplete(row)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PROFILE_ALREADY_COMPLETE",
        });
      }
      try {
        await ctx.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(user)
            .set({ phone: input.phone, locale: input.locale })
            .where(and(eq(user.id, userId), isNull(user.phone)))
            .returning({ id: user.id });
          if (!updated) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "PROFILE_ALREADY_COMPLETE",
            });
          }
          if (input.role === "driver") {
            await registerDriver(tx, { id: userId, role: row.role }, "owner");
          }
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw conflict("PHONE_TAKEN");
        }
        throw error;
      }
      // Not awaited: a lost welcome mail never blocks the account.
      ctx.mailer
        .sendWelcome({ to: row.email, name: row.name, locale: input.locale })
        .catch(() => undefined);
    }),

  /** The only way to write `user.image`: Better Auth refuses it on its own routes. */
  setImage: protectedProcedure
    .input(z.object({ storageKey: z.string().max(200) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const isOwnFile =
        isOwnAvatarKey(input.storageKey, userId) &&
        (await ctx.files.getUrl(input.storageKey)) !== null;
      if (!isOwnFile) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      const [previous] = await ctx.db
        .select({ image: user.image })
        .from(user)
        .where(eq(user.id, userId));
      await ctx.db
        .update(user)
        .set({ image: input.storageKey })
        .where(eq(user.id, userId));
      if (previous?.image !== input.storageKey) {
        await dropOldAvatar(ctx.files, previous?.image, userId);
      }
    }),

  removeImage: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [previous] = await ctx.db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId));
    await ctx.db.update(user).set({ image: null }).where(eq(user.id, userId));
    await dropOldAvatar(ctx.files, previous?.image, userId);
  }),

  setLocale: protectedProcedure
    .input(z.object({ locale: z.enum(["fr", "mg"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ locale: input.locale })
        .where(eq(user.id, ctx.session.user.id));
    }),

  places: protectedProcedure.query(async ({ ctx }) => {
    const [districts, landmarks] = await Promise.all([
      ctx.db
        .select({ id: district.id, name: district.name, point: district.point })
        .from(district)
        .where(isNull(district.archivedAt))
        .orderBy(district.name),
      ctx.db
        .select({
          id: landmark.id,
          name: landmark.name,
          point: landmark.point,
          districtId: landmark.districtId,
        })
        .from(landmark)
        .where(isNull(landmark.archivedAt))
        .orderBy(landmark.name),
    ]);
    return {
      districts: districts.map(({ point, ...row }) => ({
        ...row,
        lat: point.y,
        lng: point.x,
      })),
      landmarks: landmarks.map(({ point, ...row }) => ({
        ...row,
        lat: point.y,
        lng: point.x,
      })),
    };
  }),

  report: completeProcedure
    .input(
      z.object({
        clientRequestId: requestIdSchema,
        bookingId: z.uuid().optional(),
        typeCode: z.enum(REPORT_TYPES),
        description: noteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorId = ctx.session.user.id;
      if (input.bookingId) {
        const [ride] = await ctx.db
          .select({ clientId: booking.clientId, driverId: booking.driverId })
          .from(booking)
          .where(eq(booking.id, input.bookingId));
        if (!(ride?.clientId === authorId || ride?.driverId === authorId)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      await ctx.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(report)
          .values({ ...input, authorId })
          .onConflictDoNothing()
          .returning({ id: report.id });
        if (created) {
          await tx.insert(reportEvent).values({
            reportId: created.id,
            actorId: authorId,
            toStatus: "open",
          });
        }
      });
    }),
});
