import { TRPCError } from "@trpc/server";
import type { Database } from "@zay-app/db";
import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { driverProfile } from "@zay-app/db/schema/drivers";
import { eq } from "drizzle-orm";

import type { Transaction } from "./booking-status";
import { conflict } from "./offers";
import { isStaffRole } from "./staff";

export type EmploymentRelation = "owner" | "renter" | "employee";

/**
 * A profile is complete once it has a phone. A Google account starts without
 * one (spec 0005). The team is always complete.
 */
export const isProfileComplete = (row: {
  phone?: string | null;
  role?: string | null;
}) => isStaffRole(row.role) || (row.phone ?? null) !== null;

/** Reads the database, never the cached session. */
export async function assertProfileComplete(db: Database, userId: string) {
  const [row] = await db
    .select({ phone: user.phone, role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  if (!(row && isProfileComplete(row))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "PROFILE_INCOMPLETE" });
  }
}

/**
 * Turns a client into a driver, once. Shared by `driver.register` and
 * `me.completeProfile`, so both keep the same checks.
 */
export async function registerDriver(
  tx: Transaction,
  { id, role }: { id: string; role?: string | null | undefined },
  employmentRelation: EmploymentRelation
) {
  if (role === "driver") {
    return;
  }
  if (role !== "client") {
    throw new TRPCError({ code: "FORBIDDEN", message: "ROLE_NOT_ALLOWED" });
  }
  const [ride] = await tx
    .select({ id: booking.id })
    .from(booking)
    .where(eq(booking.clientId, id))
    .limit(1);
  if (ride) {
    throw conflict("CLIENT_HAS_BOOKINGS");
  }
  await tx
    .insert(driverProfile)
    .values({ userId: id, employmentRelation })
    .onConflictDoNothing();
  await tx.update(user).set({ role: "driver" }).where(eq(user.id, id));
}
