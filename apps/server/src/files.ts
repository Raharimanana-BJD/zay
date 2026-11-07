import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import {
  avatarOwnerOf,
  type FileAccess,
  UPLOAD_AVATAR_KEY,
  UPLOAD_DOC_KEY,
  UPLOAD_PHOTO_KEY,
} from "@zay-app/api/domain/files";
import { isStaffRole } from "@zay-app/api/domain/staff";
import { user } from "@zay-app/db/schema/auth";
import { booking } from "@zay-app/db/schema/bookings";
import { driverDocument } from "@zay-app/db/schema/drivers";
import { and, eq, inArray, or } from "drizzle-orm";

import { ENV } from "./env.server";
import { db } from "./services";

// Files live on the server's disk for the demo: the seed files, and what people send.
const SEED_FILES_DIR = new URL("../seed-files/", import.meta.url);
const UPLOADS_DIR = new URL("../uploads/", import.meta.url);
const SEED_KEY = /^seed-[a-z0-9-]+\.(png|jpg)$/;
const PUBLIC_KEY = /^(up-photo-|seed-vehicule)/;
const URL_LIFETIME_MS = 5 * 60 * 1000;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const MEGABYTE = 1024 * 1024;

/** While a ride is in one of these states, its client and driver see each other's photo. */
const RIDE_WITH_PHOTOS = [
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
] as const;

type Extension = "png" | "jpg" | "pdf";

const UPLOAD_KINDS = {
  doc: { maxBytes: 10 * MEGABYTE, formats: ["png", "jpg", "pdf"] },
  photo: { maxBytes: 5 * MEGABYTE, formats: ["png", "jpg"] },
  avatar: { maxBytes: 5 * MEGABYTE, formats: ["png", "jpg"] },
} as const satisfies Record<
  string,
  { maxBytes: number; formats: readonly Extension[] }
>;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export const isUploadKind = (value: string): value is UploadKind =>
  Object.hasOwn(UPLOAD_KINDS, value);

export const maxBytesOf = (kind: UploadKind) => UPLOAD_KINDS[kind].maxBytes;

const CONTENT_TYPES: Record<Extension, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  pdf: "application/pdf",
};

const startsWith = (bytes: Uint8Array, magic: number[]) =>
  magic.every((value, index) => bytes[index] === value);

const isUploadKey = (key: string) =>
  UPLOAD_DOC_KEY.test(key) ||
  UPLOAD_PHOTO_KEY.test(key) ||
  UPLOAD_AVATAR_KEY.test(key);

const fileUrl = (key: string) => {
  if (SEED_KEY.test(key)) {
    return new URL(key, SEED_FILES_DIR);
  }
  return isUploadKey(key) ? new URL(key, UPLOADS_DIR) : null;
};

/** Read from the extension of a key that already passed `fileUrl`. */
export const contentTypeOf = (key: string) => {
  const extension = key.slice(key.lastIndexOf(".") + 1) as Extension;
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
};

/** The content decides the format, never the name or the header the phone sent. */
const formatOf = (bytes: Uint8Array): Extension | null => {
  if (startsWith(bytes, PNG_MAGIC)) {
    return "png";
  }
  if (startsWith(bytes, JPEG_MAGIC)) {
    return "jpg";
  }
  return startsWith(bytes, PDF_MAGIC) ? "pdf" : null;
};

async function canReadAvatar(key: string, readerId: string) {
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.image, key));
  // Only a key that is someone's current photo is readable, and its id must be the author's.
  if (!owner || owner.id !== avatarOwnerOf(key)) {
    return false;
  }
  if (owner.id === readerId) {
    return true;
  }
  const [ride] = await db
    .select({ id: booking.id })
    .from(booking)
    .where(
      and(
        inArray(booking.status, [...RIDE_WITH_PHOTOS]),
        or(
          and(eq(booking.clientId, owner.id), eq(booking.driverId, readerId)),
          and(eq(booking.driverId, owner.id), eq(booking.clientId, readerId))
        )
      )
    )
    .limit(1);
  return Boolean(ride);
}

async function isOwnDocument(key: string, readerId: string) {
  const [document] = await db
    .select({ id: driverDocument.id })
    .from(driverDocument)
    .where(
      and(
        eq(driverDocument.storageKey, key),
        eq(driverDocument.driverId, readerId)
      )
    )
    .limit(1);
  return Boolean(document);
}

/**
 * Vehicle photos go to any signed in account. Papers go to the team and to the
 * driver who owns them. A profile photo goes to its owner, the team, and the other
 * side of an active ride.
 */
export async function canReadFile(
  key: string,
  reader: { id: string; role?: string | null }
) {
  if (isStaffRole(reader.role) || PUBLIC_KEY.test(key)) {
    return true;
  }
  if (UPLOAD_AVATAR_KEY.test(key)) {
    return await canReadAvatar(key, reader.id);
  }
  if (UPLOAD_DOC_KEY.test(key)) {
    return await isOwnDocument(key, reader.id);
  }
  return false;
}

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

/** Stores an upload and returns its key, or null if the format is not allowed for this kind. */
export async function storeUpload(
  bytes: Uint8Array,
  kind: UploadKind,
  authorId: string
): Promise<string | null> {
  const extension = formatOf(bytes);
  const allowed: readonly Extension[] = UPLOAD_KINDS[kind].formats;
  if (!(extension && allowed.includes(extension))) {
    return null;
  }
  const prefix = kind === "avatar" ? `up-avatar-${authorId}` : `up-${kind}`;
  const key = `${prefix}-${crypto.randomUUID()}.${extension}`;
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
  async remove(storageKey) {
    // Seed files are shared by every test account, so they are never deleted.
    if (!isUploadKey(storageKey)) {
      return;
    }
    await rm(new URL(storageKey, UPLOADS_DIR), { force: true });
  },
};
