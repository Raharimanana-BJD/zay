import type { Session } from "@zay-app/auth";

export const STAFF_ROLES = ["admin", "support"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: unknown): role is StaffRole =>
  role === "admin" || role === "support";

/** The author recorded on an event. Only call it behind a staff procedure. */
export function actorFromSession(session: Session) {
  const { id, role } = session.user;
  if (!isStaffRole(role)) {
    throw new Error("actorFromSession needs a staff session");
  }
  return { actorKind: role, actorId: id };
}
