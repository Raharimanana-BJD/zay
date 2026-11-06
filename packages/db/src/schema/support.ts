import {
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { booking } from "./bookings";
import { createdAt, newId, updatedAt } from "./columns";
import { reportStatus } from "./enums";

export const report = pgTable(
  "report",
  {
    id: newId(),
    bookingId: uuid("booking_id").references(() => booking.id, {
      onDelete: "restrict",
    }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    typeCode: text("type_code").notNull(),
    description: text("description"),
    status: reportStatus("status").notNull().default("open"),
    assigneeId: text("assignee_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    clientRequestId: uuid("client_request_id").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("report_author_request_uq").on(t.authorId, t.clientRequestId),
    index("report_status_created_idx").on(t.status, t.createdAt),
  ]
);

export const reportEvent = pgTable(
  "report_event",
  {
    id: newId(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => report.id, { onDelete: "restrict" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    fromStatus: reportStatus("from_status"),
    toStatus: reportStatus("to_status"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("report_event_report_id_idx").on(t.reportId)]
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: newId(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetType, t.targetId, t.createdAt),
  ]
);
