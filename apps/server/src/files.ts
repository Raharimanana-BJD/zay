import { access, readFile } from "node:fs/promises";

import type { FileAccess } from "@zay-app/api/domain/files";

import { ENV } from "./env.server";

// Temporary implementation for the seed files, until feature 22 brings real storage.
const SEED_FILES_DIR = new URL("../seed-files/", import.meta.url);
const SEED_KEY = /^seed-[a-z0-9-]+\.(png|jpg)$/;
const URL_LIFETIME_MS = 5 * 60 * 1000;

/** Reads a seed file, or null if the key is invalid or the file does not exist. */
export async function readSeedFile(
  key: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!SEED_KEY.test(key)) {
    return null;
  }
  try {
    return new Uint8Array(await readFile(new URL(key, SEED_FILES_DIR)));
  } catch {
    return null;
  }
}

export const files: FileAccess = {
  async getUrl(storageKey) {
    if (!SEED_KEY.test(storageKey)) {
      return null;
    }
    try {
      await access(new URL(storageKey, SEED_FILES_DIR));
    } catch {
      return null;
    }
    return {
      url: `${ENV.BETTER_AUTH_URL}/files/${storageKey}`,
      expiresAt: new Date(Date.now() + URL_LIFETIME_MS),
    };
  },
};
