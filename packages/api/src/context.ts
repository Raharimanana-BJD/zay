import type { Session } from "@zay-app/auth";
import type { Database } from "@zay-app/db";

export type Context = {
  session: Session | null;
  db: Database;
};
