import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { report, reportEvent } from "@zay-app/db/schema/support";
import { and, asc, desc, eq, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import z from "zod";

import { REPORT_TYPES } from "../../domain/codes";
import { router, staffProcedure } from "../../index";
import {
  badRequest,
  conflict,
  noteSchema,
  notFound,
  offsetOf,
  optionalNoteSchema,
  PAGE_SIZE,
  pageSchema,
} from "./common";

const STATUS_CHANGED = "REPORT_STATUS_CHANGED";
const author = alias(user, "author");
const assignee = alias(user, "assignee");

const CHANGES = {
  resolved: { from: "in_progress", noteRequired: true },
  in_progress: { from: "resolved", noteRequired: true },
  closed: { from: "resolved", noteRequired: false },
} as const;

export const reportsRouter = router({
  list: staffProcedure
    .input(
      z.object({
        status: z.enum(report.status.enumValues).optional(),
        typeCode: z.enum(REPORT_TYPES).optional(),
        page: pageSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const filters: (SQL | undefined)[] = [];
      if (input.status) {
        filters.push(eq(report.status, input.status));
      }
      if (input.typeCode) {
        filters.push(eq(report.typeCode, input.typeCode));
      }
      const where = and(...filters);
      const items = await ctx.db
        .select({
          id: report.id,
          typeCode: report.typeCode,
          status: report.status,
          description: report.description,
          bookingId: report.bookingId,
          authorName: author.name,
          assigneeName: assignee.name,
          createdAt: report.createdAt,
        })
        .from(report)
        .innerJoin(author, eq(author.id, report.authorId))
        .leftJoin(assignee, eq(assignee.id, report.assigneeId))
        .where(where)
        .orderBy(desc(report.createdAt), desc(report.id))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(report)
        .where(where);
      return { items, total: count?.total ?? 0 };
    }),

  get: staffProcedure
    .input(z.object({ reportId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          report,
          authorName: author.name,
          authorPhone: author.phone,
          authorRole: author.role,
          assigneeName: assignee.name,
          bookingStatus: booking.status,
          bookingCreatedAt: booking.createdAt,
        })
        .from(report)
        .innerJoin(author, eq(author.id, report.authorId))
        .leftJoin(assignee, eq(assignee.id, report.assigneeId))
        .leftJoin(booking, eq(booking.id, report.bookingId))
        .where(eq(report.id, input.reportId))
        .limit(1);
      if (!row) {
        throw notFound();
      }
      const events = await ctx.db
        .select({
          id: reportEvent.id,
          fromStatus: reportEvent.fromStatus,
          toStatus: reportEvent.toStatus,
          note: reportEvent.note,
          actorName: user.name,
          createdAt: reportEvent.createdAt,
        })
        .from(reportEvent)
        .innerJoin(user, eq(user.id, reportEvent.actorId))
        .where(eq(reportEvent.reportId, input.reportId))
        .orderBy(asc(reportEvent.createdAt), asc(reportEvent.id));
      return { ...row, events };
    }),

  take: staffProcedure
    .input(z.object({ reportId: z.string().uuid(), note: optionalNoteSchema }))
    .mutation(async ({ ctx, input }) => {
      const { reportId, note } = input;
      const actorId = ctx.session.user.id;
      return await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(report)
          .set({ status: "in_progress", assigneeId: actorId })
          .where(and(eq(report.id, reportId), eq(report.status, "open")))
          .returning({ status: report.status });
        if (!updated) {
          throw conflict(STATUS_CHANGED);
        }
        await tx.insert(reportEvent).values({
          reportId,
          actorId,
          fromStatus: "open",
          toStatus: "in_progress",
          note,
        });
        return { status: updated.status };
      });
    }),

  addNote: staffProcedure
    .input(z.object({ reportId: z.string().uuid(), note: noteSchema }))
    .mutation(async ({ ctx, input }) => {
      const { reportId, note } = input;
      return await ctx.db.transaction(async (tx) => {
        const [current] = await tx
          .select({ status: report.status })
          .from(report)
          .where(eq(report.id, reportId))
          .for("update");
        if (!current) {
          throw notFound();
        }
        if (current.status === "closed") {
          throw conflict(STATUS_CHANGED);
        }
        const [event] = await tx
          .insert(reportEvent)
          .values({ reportId, actorId: ctx.session.user.id, note })
          .returning({ id: reportEvent.id });
        return { eventId: event?.id };
      });
    }),

  changeStatus: staffProcedure
    .input(
      z.object({
        reportId: z.string().uuid(),
        to: z.enum(["resolved", "in_progress", "closed"]),
        note: optionalNoteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { reportId, to, note } = input;
      const { from, noteRequired } = CHANGES[to];
      if (noteRequired && !note) {
        throw badRequest("NOTE_REQUIRED");
      }
      return await ctx.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(report)
          .set({ status: to })
          .where(and(eq(report.id, reportId), eq(report.status, from)))
          .returning({ status: report.status });
        if (!updated) {
          throw conflict(STATUS_CHANGED);
        }
        await tx.insert(reportEvent).values({
          reportId,
          actorId: ctx.session.user.id,
          fromStatus: from,
          toStatus: to,
          note,
        });
        return { status: updated.status };
      });
    }),
});
