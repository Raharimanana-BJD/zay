import { user } from "@zay-app/db/schema/auth";
import { auditLog } from "@zay-app/db/schema/support";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import z from "zod";

import { phoneSchema } from "../../domain/phone";
import { STAFF_ROLES } from "../../domain/staff";
import { adminProcedure, router } from "../../index";
import { suspensionIncomplete } from "./accounts";
import {
  badRequest,
  conflict,
  isBanned,
  isUniqueViolation,
  offsetOf,
  PAGE_SIZE,
  pageSchema,
} from "./common";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const staffOnly = inArray(user.role, [...STAFF_ROLES]);

export const teamRouter = router({
  list: adminProcedure
    .input(z.object({ page: pageSchema }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          banned: isBanned,
          banReason: user.banReason,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(staffOnly)
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
        .where(staffOnly);
      const items = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          suspensionIncomplete: await suspensionIncomplete(
            ctx.db,
            row.id,
            row.banned
          ),
        }))
      );
      return { items, total: count?.total ?? 0 };
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1),
        email: z.email(),
        phone: z.string(),
        role: z.enum(STAFF_ROLES),
        temporaryPassword: z
          .string()
          .min(MIN_PASSWORD_LENGTH)
          .max(MAX_PASSWORD_LENGTH),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name, role, temporaryPassword } = input;
      const email = input.email.toLowerCase();
      const phone = phoneSchema.safeParse(input.phone);
      if (!phone.success) {
        throw badRequest("PHONE_INVALID");
      }
      const [taken] = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(or(eq(user.email, email), eq(user.phone, phone.data)))
        .limit(1);
      if (taken) {
        throw conflict("EMAIL_OR_PHONE_TAKEN");
      }
      let id: string;
      try {
        const created = await ctx.auth.api.createUser({
          headers: ctx.headers,
          body: {
            name,
            email,
            password: temporaryPassword,
            role: role as "admin",
            // The team vouches for the address, so no verification code is needed.
            data: { phone: phone.data, locale: "fr", emailVerified: true },
          },
        });
        id = created.user.id;
      } catch (error) {
        const code = (error as { body?: { code?: string } }).body?.code;
        // Two creations at once pass the check above, and then the unique index decides.
        if (
          code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
          code === "FAILED_TO_CREATE_USER" ||
          isUniqueViolation(error)
        ) {
          throw conflict("EMAIL_OR_PHONE_TAKEN");
        }
        throw error;
      }
      try {
        await ctx.db.insert(auditLog).values({
          actorId: ctx.session.user.id,
          action: "team.created",
          targetType: "user",
          targetId: id,
          after: { name, email, role },
        });
        return { id, auditWritten: true };
      } catch (error) {
        console.error("team.created audit line was not written", id, error);
        return { id, auditWritten: false };
      }
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(STAFF_ROLES) }))
    .mutation(async ({ ctx, input }) => {
      const { userId, role } = input;
      if (userId === ctx.session.user.id) {
        throw badRequest("CANNOT_TARGET_SELF");
      }
      const [account] = await ctx.db
        .select({ role: user.role })
        .from(user)
        .where(and(eq(user.id, userId), staffOnly))
        .limit(1);
      if (!account) {
        throw badRequest("NOT_A_TEAM_ACCOUNT");
      }
      if (account.role === role) {
        // Already applied: only a failed audit write makes this replay do anything.
        const [last] = await ctx.db
          .select({ after: auditLog.after })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.targetId, userId),
              eq(auditLog.action, "team.role_changed")
            )
          )
          .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
          .limit(1);
        if (!last || last.after?.role === role) {
          return { ok: true as const };
        }
      } else {
        await ctx.auth.api.setRole({
          headers: ctx.headers,
          body: { userId, role: role as "admin" },
        });
      }
      await ctx.db.insert(auditLog).values({
        actorId: ctx.session.user.id,
        action: "team.role_changed",
        targetType: "user",
        targetId: userId,
        before: { role: account.role === role ? null : account.role },
        after: { role },
      });
      return { ok: true as const };
    }),
});
