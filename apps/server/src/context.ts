import type { Context as ApiContext } from "@zay-app/api/context";
import type { Context as HonoContext } from "hono";

import { files } from "./files";
import { auth, db } from "./services";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({
  context,
}: CreateContextOptions): Promise<ApiContext> {
  const { headers } = context.req.raw;
  const session = await auth.api.getSession({ headers });
  return {
    auth,
    db,
    files,
    headers,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
