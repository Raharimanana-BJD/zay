import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";
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

/** The role is read from the database on every request, never from the client. */
export const clientProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "client") {
    throw new TRPCError({ code: "FORBIDDEN", message: "ROLE_NOT_ALLOWED" });
  }
  return next();
});

export const driverProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "driver") {
    throw new TRPCError({ code: "FORBIDDEN", message: "ROLE_NOT_ALLOWED" });
  }
  return next();
});
