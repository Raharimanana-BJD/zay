import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const STORAGE_KEY = "zay.pendingVerification";
/** The server's code lives 10 minutes (`OTP_MINUTES` in `packages/auth`). */
const CODE_LIFETIME_MS = 10 * 60 * 1000;

export interface PendingVerification {
  email: string;
  relation?: string;
}

interface Stored extends PendingVerification {
  savedAt: number;
}

/**
 * Remembers the email waiting for its code. If Android closes the app while the
 * person reads the code in their mail, the app reopens on the code screen.
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
  if (!(isFresh && typeof stored.email === "string")) {
    await clearPendingVerification();
    return null;
  }
  return { email: stored.email, relation: stored.relation };
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
