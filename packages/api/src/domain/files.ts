/** Isolates file storage, so feature 22 can replace it without touching screens. */
export interface FileAccess {
  getUrl: (
    storageKey: string
  ) => Promise<{ url: string; expiresAt: Date } | null>;
  /** Deletes a stored upload. A missing file is not an error. */
  remove: (storageKey: string) => Promise<void>;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const UPLOAD_DOC_KEY = new RegExp(`^up-doc-${UUID}\\.(png|jpg|pdf)$`);
export const UPLOAD_PHOTO_KEY = new RegExp(`^up-photo-${UUID}\\.(png|jpg)$`);
/** The author's id sits in the key, so nobody can claim someone else's file. */
export const UPLOAD_AVATAR_KEY = new RegExp(
  `^up-avatar-([A-Za-z0-9_-]+)-${UUID}\\.(png|jpg)$`
);

/** The id of the account that sent this avatar, or null if it is not an avatar key. */
export const avatarOwnerOf = (key: string): string | null =>
  UPLOAD_AVATAR_KEY.exec(key)?.[1] ?? null;

export const isOwnAvatarKey = (key: string, userId: string) =>
  avatarOwnerOf(key) === userId;

export type FileKind = "image" | "pdf";

/** The format sits in the key's extension, decided by the server from the content. */
export const fileKindOf = (storageKey: string): FileKind =>
  storageKey.endsWith(".pdf") ? "pdf" : "image";
