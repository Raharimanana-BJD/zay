import { TRPCError } from "@trpc/server";
import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { district, landmark } from "@zay-app/db/schema/places";
import { report, reportEvent } from "@zay-app/db/schema/support";
import { eq, isNull } from "drizzle-orm";
import z from "zod";

import { REPORT_TYPES } from "../domain/codes";
import { protectedProcedure, router } from "../index";
import { noteSchema, requestIdSchema } from "./shared";

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
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id));
    if (!row) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return row;
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

  report: protectedProcedure
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
