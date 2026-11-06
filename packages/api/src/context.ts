import type { Auth, Session } from "@zay-app/auth";
import type { Database } from "@zay-app/db";

import type { FileAccess } from "./domain/files";

export type Context = {
  session: Session | null;
  db: Database;
  auth: Auth;
  /** Headers of the incoming request, to forward to `auth.api` calls. */
  headers: Headers;
  files: FileAccess;
};
