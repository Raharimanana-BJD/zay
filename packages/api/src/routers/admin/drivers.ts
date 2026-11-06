import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { offer } from "@zay-app/db/schema/dispatch";
import {
  driverDocument,
  driverProfile,
  vehicle,
  verificationDecision,
} from "@zay-app/db/schema/drivers";
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import z from "zod";

import {
  SUSPENSION_REASONS,
  VERIFICATION_REJECTION_REASONS,
} from "../../domain/codes";
import { adminProcedure, router, staffProcedure } from "../../index";
import { suspensionIncomplete } from "./accounts";
import {
  assertReason,
  badRequest,
  conflict,
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
const STATUS_CHANGED = "VERIFICATION_STATUS_CHANGED";
const DOCUMENTS_NOT_APPROVED = "DOCUMENTS_NOT_APPROVED";
const OPEN_OFFERS = ["sent", "priced", "negotiating"] as const;

type Status = (typeof driverProfile.verificationStatus.enumValues)[number];
type Subject = (typeof verificationDecision.subject.enumValues)[number];
interface Piece {
  expiresAt: Date | null;
  id: string;
  verificationStatus: Status;
}

const DOCUMENT_TRANSITIONS: Partial<Record<Status, readonly Status[]>> = {
  pending: ["approved", "rejected", "changes_requested"],
  changes_requested: ["approved", "rejected", "changes_requested"],
};
const SUBJECT_TRANSITIONS: Partial<Record<Status, readonly Status[]>> = {
  ...DOCUMENT_TRANSITIONS,
  approved: ["suspended"],
  suspended: ["approved"],
};

function assertTransition(subject: Subject, from: Status, to: Status) {
  const table =
    subject === "document" ? DOCUMENT_TRANSITIONS : SUBJECT_TRANSITIONS;
  if (from === to || !table[from]?.includes(to)) {
    throw conflict(STATUS_CHANGED);
  }
}

const isExpired = (piece: { expiresAt: Date | null }, now: Date) =>
  piece.expiresAt !== null && piece.expiresAt < now;

/** What stops an approval. A driver or vehicle needs at least one current piece. */
function blockersFor(pieces: Piece[], now: Date) {
  if (pieces.length === 0) {
    return [{ documentId: null, code: "NO_DOCUMENT" }];
  }
  const blockers: { documentId: string | null; code: string }[] = [];
  for (const piece of pieces) {
    if (piece.verificationStatus !== "approved") {
      blockers.push({ documentId: piece.id, code: "NOT_APPROVED" });
    } else if (isExpired(piece, now)) {
      blockers.push({ documentId: piece.id, code: "EXPIRED" });
    }
  }
  return blockers;
}

const canApproveSubject = (status: Status) =>
  SUBJECT_TRANSITIONS[status]?.includes("approved") ?? false;

export const driversRouter = router({
  list: staffProcedure
    .input(
      z.object({
        q: z.string().optional(),
        status: z.enum(driverProfile.verificationStatus.enumValues).optional(),
        page: pageSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      const pattern = likePattern(input.q);
      const filters: (SQL | undefined)[] = [];
      if (pattern) {
        filters.push(or(ilike(user.name, pattern), ilike(user.phone, pattern)));
      }
      if (input.status) {
        filters.push(eq(driverProfile.verificationStatus, input.status));
      }
      const where = and(...filters);
      const items = await ctx.db
        .select({
          userId: driverProfile.userId,
          name: user.name,
          phone: user.phone,
          status: driverProfile.verificationStatus,
          isOnline: driverProfile.isOnline,
          isAvailable: driverProfile.isAvailable,
          isSimulated: driverProfile.isSimulated,
          banned: isBanned,
          createdAt: driverProfile.createdAt,
        })
        .from(driverProfile)
        .innerJoin(user, eq(user.id, driverProfile.userId))
        .where(where)
        .orderBy(desc(driverProfile.createdAt), desc(driverProfile.userId))
        .limit(PAGE_SIZE)
        .offset(offsetOf(input.page));
      const [count] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(driverProfile)
        .innerJoin(user, eq(user.id, driverProfile.userId))
        .where(where);
      return { items, total: count?.total ?? 0 };
    }),

  get: staffProcedure
    .input(z.object({ driverId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { driverId } = input;
      const now = new Date();
      const [row] = await ctx.db
        .select({
          userId: driverProfile.userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          banned: isBanned,
          banReason: user.banReason,
          employmentRelation: driverProfile.employmentRelation,
          status: driverProfile.verificationStatus,
          isOnline: driverProfile.isOnline,
          isAvailable: driverProfile.isAvailable,
          isSimulated: driverProfile.isSimulated,
          createdAt: driverProfile.createdAt,
        })
        .from(driverProfile)
        .innerJoin(user, eq(user.id, driverProfile.userId))
        .where(eq(driverProfile.userId, driverId))
        .limit(1);
      if (!row) {
        throw notFound();
      }
      const vehicles = await ctx.db
        .select({
          id: vehicle.id,
          category: vehicle.category,
          make: vehicle.make,
          model: vehicle.model,
          registration: vehicle.registration,
          capacity: vehicle.capacity,
          status: vehicle.verificationStatus,
        })
        .from(vehicle)
        .where(and(eq(vehicle.driverId, driverId), isNull(vehicle.archivedAt)))
        .orderBy(desc(vehicle.createdAt));
      const documents = await ctx.db
        .select({
          id: driverDocument.id,
          vehicleId: driverDocument.vehicleId,
          typeCode: driverDocument.typeCode,
          expiresAt: driverDocument.expiresAt,
          verificationStatus: driverDocument.verificationStatus,
        })
        .from(driverDocument)
        .where(
          and(
            eq(driverDocument.driverId, driverId),
            isNull(driverDocument.replacedAt)
          )
        )
        .orderBy(driverDocument.typeCode);
      const personal = documents.filter((doc) => doc.vehicleId === null);
      const blockers = blockersFor(personal, now);
      const subjectIds = [
        driverId,
        ...vehicles.map((item) => item.id),
        ...documents.map((doc) => doc.id),
      ];
      // Decisions also cover replaced documents and archived vehicles of this driver.
      const allOwned = await ctx.db
        .select({ id: driverDocument.id })
        .from(driverDocument)
        .where(eq(driverDocument.driverId, driverId));
      const allVehicles = await ctx.db
        .select({ id: vehicle.id })
        .from(vehicle)
        .where(eq(vehicle.driverId, driverId));
      const everySubject = [
        ...new Set([
          ...subjectIds,
          ...allOwned.map((d) => d.id),
          ...allVehicles.map((v) => v.id),
        ]),
      ];
      const decisions = await ctx.db
        .select({
          id: verificationDecision.id,
          subject: verificationDecision.subject,
          subjectId: verificationDecision.subjectId,
          status: verificationDecision.status,
          reasonCode: verificationDecision.reasonCode,
          reasonNote: verificationDecision.reasonNote,
          decidedByName: user.name,
          createdAt: verificationDecision.createdAt,
        })
        .from(verificationDecision)
        .innerJoin(user, eq(user.id, verificationDecision.decidedBy))
        .where(inArray(verificationDecision.subjectId, everySubject))
        .orderBy(
          desc(verificationDecision.createdAt),
          desc(verificationDecision.id)
        );
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
        .where(eq(booking.driverId, driverId))
        .orderBy(desc(booking.createdAt), desc(booking.id))
        .limit(RECENT_BOOKINGS);
      return {
        ...row,
        suspensionIncomplete: await suspensionIncomplete(
          ctx.db,
          driverId,
          row.banned
        ),
        canApprove: canApproveSubject(row.status) && blockers.length === 0,
        blockers,
        vehicles: vehicles.map((item) => {
          const pieces = documents.filter((doc) => doc.vehicleId === item.id);
          const vehicleBlockers = blockersFor(pieces, now);
          return {
            ...item,
            canApprove:
              canApproveSubject(item.status) && vehicleBlockers.length === 0,
            blockers: vehicleBlockers,
          };
        }),
        documents: documents.map(({ verificationStatus, ...doc }) => ({
          ...doc,
          status: verificationStatus,
          isExpired: isExpired(doc, now),
        })),
        decisions,
        bookings,
      };
    }),

  documentUrl: staffProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [document] = await ctx.db
        .select({ storageKey: driverDocument.storageKey })
        .from(driverDocument)
        .where(eq(driverDocument.id, input.documentId))
        .limit(1);
      const file = document
        ? await ctx.files.getUrl(document.storageKey)
        : null;
      if (!file) {
        throw notFound();
      }
      return file;
    }),

  decide: adminProcedure
    .input(
      z.object({
        subject: z.enum(verificationDecision.subject.enumValues),
        subjectId: z.string(),
        status: z.enum([
          "approved",
          "rejected",
          "changes_requested",
          "suspended",
        ]),
        reasonCode: z.string().optional(),
        reasonNote: optionalNoteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { subject, subjectId, status, reasonCode, reasonNote } = input;
      if (
        status === "suspended" ||
        status === "rejected" ||
        status === "changes_requested"
      ) {
        if (!reasonCode) {
          throw badRequest("REASON_REQUIRED");
        }
        assertReason(
          status === "suspended"
            ? SUSPENSION_REASONS
            : VERIFICATION_REJECTION_REASONS,
          reasonCode,
          reasonNote
        );
      }
      if (subject === "document" && status === "suspended") {
        throw conflict(STATUS_CHANGED);
      }

      // Finds the driver first, because every decision locks that driver's row.
      let driverId = subjectId;
      if (subject === "vehicle") {
        const [row] = await ctx.db
          .select({ driverId: vehicle.driverId })
          .from(vehicle)
          .where(sql`${vehicle.id}::text = ${subjectId}`);
        driverId = row?.driverId ?? "";
      } else if (subject === "document") {
        const [row] = await ctx.db
          .select({ driverId: driverDocument.driverId })
          .from(driverDocument)
          .where(sql`${driverDocument.id}::text = ${subjectId}`);
        driverId = row?.driverId ?? "";
      }

      return await ctx.db.transaction(async (tx) => {
        const [profile] = await tx
          .select({ status: driverProfile.verificationStatus })
          .from(driverProfile)
          .where(eq(driverProfile.userId, driverId))
          .for("update");
        if (!profile) {
          throw notFound();
        }
        const now = new Date();
        const currentPieces = (vehicleId: string | null) =>
          tx
            .select({
              id: driverDocument.id,
              expiresAt: driverDocument.expiresAt,
              verificationStatus: driverDocument.verificationStatus,
            })
            .from(driverDocument)
            .where(
              and(
                eq(driverDocument.driverId, driverId),
                isNull(driverDocument.replacedAt),
                vehicleId === null
                  ? isNull(driverDocument.vehicleId)
                  : eq(driverDocument.vehicleId, vehicleId)
              )
            );

        if (subject === "document") {
          const [document] = await tx
            .select()
            .from(driverDocument)
            .where(eq(driverDocument.id, subjectId));
          if (!document || document.replacedAt) {
            throw conflict(STATUS_CHANGED);
          }
          if (document.vehicleId) {
            const [owner] = await tx
              .select({ archivedAt: vehicle.archivedAt })
              .from(vehicle)
              .where(eq(vehicle.id, document.vehicleId));
            if (owner?.archivedAt) {
              throw conflict(STATUS_CHANGED);
            }
          }
          assertTransition(subject, document.verificationStatus, status);
          if (status === "approved" && isExpired(document, now)) {
            throw conflict(DOCUMENTS_NOT_APPROVED);
          }
          await tx
            .update(driverDocument)
            .set({ verificationStatus: status })
            .where(eq(driverDocument.id, subjectId));
        } else if (subject === "vehicle") {
          const [current] = await tx
            .select()
            .from(vehicle)
            .where(eq(vehicle.id, subjectId));
          if (!current || current.archivedAt) {
            throw conflict(STATUS_CHANGED);
          }
          assertTransition(subject, current.verificationStatus, status);
          if (
            status === "approved" &&
            blockersFor(await currentPieces(subjectId), now).length > 0
          ) {
            throw conflict(DOCUMENTS_NOT_APPROVED);
          }
          await tx
            .update(vehicle)
            .set({ verificationStatus: status })
            .where(eq(vehicle.id, subjectId));
          if (status === "suspended") {
            await tx
              .update(offer)
              .set({ status: "void" })
              .where(
                and(
                  eq(offer.vehicleId, subjectId),
                  inArray(offer.status, [...OPEN_OFFERS])
                )
              );
          }
        } else {
          assertTransition(subject, profile.status, status);
          if (
            status === "approved" &&
            blockersFor(await currentPieces(null), now).length > 0
          ) {
            throw conflict(DOCUMENTS_NOT_APPROVED);
          }
          await tx
            .update(driverProfile)
            .set({ verificationStatus: status })
            .where(eq(driverProfile.userId, driverId));
          if (status === "suspended") {
            await tx
              .update(offer)
              .set({ status: "void" })
              .where(
                and(
                  eq(offer.driverId, driverId),
                  inArray(offer.status, [...OPEN_OFFERS])
                )
              );
          }
        }

        const [decision] = await tx
          .insert(verificationDecision)
          .values({
            subject,
            subjectId,
            status,
            reasonCode: reasonCode ?? null,
            reasonNote: reasonNote ?? null,
            decidedBy: ctx.session.user.id,
          })
          .returning({ id: verificationDecision.id });
        return { status, decisionId: decision?.id };
      });
    }),
});
