import { user } from "@zay-app/db/schema/auth";
import { auditLog } from "@zay-app/db/schema/support";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";

import { AUDIT_ACTIONS } from "../../domain/codes";
import { adminProcedure, router } from "../../index";
import { offsetOf, PAGE_SIZE, pageSchema } from "./common";

const actor = alias(user, "actor");
const target = alias(user, "target");

export const auditRouter = router({
  list: adminProcedure
    .input(
      z.object({ action: z.enum(AUDIT_ACTIONS).optional(), page: pageSchema })
    )
    .query(async ({ ctx, input }) => {
      const where = input.action
        ? and(eq(auditLog.action, input.action))
        : undefined;
      const items = await ctx.db
        .select({
          id: auditLog.id,
          action: auditLog.action,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          before: auditLog.before,
          after: auditLog.after,
          createdAt: auditLog.createdAt,
          actorName: actor.name,
          targetName: target.name,
        })
        .from(auditLog)
        .leftJoin(actor, eq(actor.id, auditLog.actorId))
        .leftJoin(target, eq(target.id, auditLog.targetId))
        .where(where)
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where);
      return { items, total: count?.total ?? 0 };
    }),
});
