/** Isolates file storage, so feature 22 can replace it without touching screens. */
export interface FileAccess {
  getUrl: (
    storageKey: string
  ) => Promise<{ url: string; expiresAt: Date } | null>;
}
