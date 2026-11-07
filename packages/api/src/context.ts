import type { Auth, AuthMailer, Session } from "@zay-app/auth";
import type { Database } from "@zay-app/db";

import type { FileAccess } from "./domain/files";

export type Context = {
  session: Session | null;
  db: Database;
  auth: Auth;
  /** Headers of the incoming request, to forward to `auth.api` calls. */
  headers: Headers;
  files: FileAccess;
  /** Never awaited by a caller that must answer fast: a lost mail blocks nothing. */
  mailer: Pick<AuthMailer, "sendWelcome">;
};
