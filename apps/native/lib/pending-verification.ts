import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const STORAGE_KEY = "zay.pendingVerification";
/** The server's code lives 10 minutes (`OTP_MINUTES` in `packages/auth`). */
const CODE_LIFETIME_MS = 10 * 60 * 1000;

/** Which screen waits for a code: the new account's, or the forgotten password's. */
export type PendingKind = "verify-email" | "reset-password";

export interface PendingVerification {
  email: string;
  kind: PendingKind;
  relation?: string;
}

const KINDS: readonly string[] = ["verify-email", "reset-password"];

interface Stored extends PendingVerification {
  savedAt: number;
}

/**
 * Remembers the email waiting for its code, never the code itself. If Android
 * closes the app while the person reads the code in their mail, the app reopens
 * on the code screen of the same flow.
 */
export const savePendingVerification = (pending: PendingVerification) =>
  SecureStore.setItemAsync(
    STORAGE_KEY,
    JSON.stringify({ ...pending, savedAt: Date.now() } satisfies Stored)
  ).catch(() => undefined);

export const clearPendingVerification = () =>
  SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);

async function readPendingVerification(): Promise<PendingVerification | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  const stored = JSON.parse(raw) as Partial<Stored>;
  const isFresh =
    typeof stored.savedAt === "number" &&
    Date.now() - stored.savedAt < CODE_LIFETIME_MS;
  const isValid =
    typeof stored.email === "string" &&
    typeof stored.kind === "string" &&
    KINDS.includes(stored.kind);
  if (!(isFresh && isValid)) {
    await clearPendingVerification();
    return null;
  }
  return {
    email: stored.email as string,
    kind: stored.kind as PendingKind,
    relation: stored.relation,
  };
}

/** Undefined while reading, then the pending email or null. */
export function usePendingVerification() {
  const [pending, setPending] = useState<
    PendingVerification | null | undefined
  >(undefined);
  useEffect(() => {
    readPendingVerification()
      .then(setPending)
      .catch(() => setPending(null));
  }, []);
  return pending;
}
