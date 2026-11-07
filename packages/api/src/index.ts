import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
import { assertProfileComplete, isProfileComplete } from "./domain/profile";
import { isStaffRole } from "./domain/staff";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/** Admin and support. The role is read from the database on every request. */
export const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isStaffRole(ctx.session.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});

/** A signed in account with a phone: the gate on every client and driver action. */
export const completeProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    // A phone is never removed from a live session, so a session that has one
    // is complete. Only a session without one is checked again in the database.
    if (!isProfileComplete(ctx.session.user)) {
      await assertProfileComplete(ctx.db, ctx.session.user.id);
    }
    return next();
  }
);

/** The role is read from the database on every request, never from the client. */
export const clientProcedure = completeProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "client") {
    throw new TRPCError({ code: "FORBIDDEN", message: "ROLE_NOT_ALLOWED" });
  }
  return next();
});

export const driverProcedure = completeProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "driver") {
    throw new TRPCError({ code: "FORBIDDEN", message: "ROLE_NOT_ALLOWED" });
  }
  return next();
});
