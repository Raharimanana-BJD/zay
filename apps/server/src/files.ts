import { access, mkdir, readFile, writeFile } from "node:fs/promises";

import type { FileAccess } from "@zay-app/api/domain/files";

import { ENV } from "./env.server";

// Files live on the server's disk for the demo: the seed files, and what drivers send.
const SEED_FILES_DIR = new URL("../seed-files/", import.meta.url);
const UPLOADS_DIR = new URL("../uploads/", import.meta.url);
const SEED_KEY = /^seed-[a-z0-9-]+\.(png|jpg)$/;
const UPLOAD_KEY = /^up-(doc|photo)-[a-z0-9-]+\.(png|jpg)$/;
const PUBLIC_KEY = /^(up-photo-|seed-vehicule)/;
const URL_LIFETIME_MS = 5 * 60 * 1000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadKind = "doc" | "photo";

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  magic.every((value, index) => bytes[index] === value);

const fileUrl = (key: string) => {
  if (SEED_KEY.test(key)) {
    return new URL(key, SEED_FILES_DIR);
  }
  return UPLOAD_KEY.test(key) ? new URL(key, UPLOADS_DIR) : null;
};

/** Vehicle photos go to any signed in account, identity papers to the team only. */
export const isPublicFile = (key: string) => PUBLIC_KEY.test(key);

/** Reads a file, or null if the key is invalid or the file does not exist. */
export async function readStoredFile(
  key: string
): Promise<Uint8Array<ArrayBuffer> | null> {
  const url = fileUrl(key);
  if (!url) {
    return null;
  }
  try {
    return new Uint8Array(await readFile(url));
  } catch {
    return null;
  }
}

/** The content decides the type, never the name or the header the phone sent. */
export async function storeUpload(
  bytes: Uint8Array,
  kind: UploadKind
): Promise<string | null> {
  let extension: "png" | "jpg" | null = null;
  if (startsWith(bytes, PNG_MAGIC)) {
    extension = "png";
  } else if (startsWith(bytes, JPEG_MAGIC)) {
    extension = "jpg";
  }
  if (!extension) {
    return null;
  }
  const key = `up-${kind}-${crypto.randomUUID()}.${extension}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(new URL(key, UPLOADS_DIR), bytes);
  return key;
}

export const files: FileAccess = {
  async getUrl(storageKey) {
    const url = fileUrl(storageKey);
    if (!url) {
      return null;
    }
    try {
      await access(url);
    } catch {
      return null;
    }
    return {
      url: `${ENV.BETTER_AUTH_URL}/files/${storageKey}`,
      expiresAt: new Date(Date.now() + URL_LIFETIME_MS),
    };
  },
};
