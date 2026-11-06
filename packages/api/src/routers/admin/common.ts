import { TRPCError } from "@trpc/server";
import { user } from "@zay-app/db/schema/auth";
import { sql } from "drizzle-orm";
import z from "zod";

export const PAGE_SIZE = 25;
export const TIME_ZONE = "Indian/Antananarivo";
const MAX_NOTE_LENGTH = 500;

export const pageSchema = z.number().int().min(1).default(1);
export const offsetOf = (page: number) => (page - 1) * PAGE_SIZE;
export const noteSchema = z.string().trim().min(1).max(MAX_NOTE_LENGTH);
export const optionalNoteSchema = noteSchema.optional();
export const daySchema = z.iso.date();

export const conflict = (message: string) =>
  new TRPCError({ code: "CONFLICT", message });
export const badRequest = (message: string) =>
  new TRPCError({ code: "BAD_REQUEST", message });
export const notFound = () => new TRPCError({ code: "NOT_FOUND" });

/** Trims the search, then escapes `%` and `_` so they match themselves. */
export function likePattern(q: string | undefined): string | null {
  const trimmed = q?.trim();
  if (!trimmed) {
    return null;
  }
  return `%${trimmed.replace(/[\\%_]/g, "\\$&")}%`;
}

/** A known code is required, and `other` also needs a note. */
export function assertReason(
  allowed: readonly string[],
  code: string,
  note: string | undefined
) {
  if (!allowed.includes(code)) {
    throw badRequest("REASON_INVALID");
  }
  if (code === "other" && !note) {
    throw badRequest("NOTE_REQUIRED");
  }
}

export const isBanned = sql<boolean>`coalesce(${user.banned}, false)`;

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    if ((current as { code?: unknown }).code === "23505") {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
