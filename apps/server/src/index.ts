import { trpcServer } from "@hono/trpc-server";
import { isStaffRole } from "@zay-app/api/domain/staff";
import { appRouter } from "@zay-app/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { readSeedFile } from "./files";
import { auth } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/trpc",
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  })
);

// Identity documents: team sessions only, and never cached.
app.get("/files/:key", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.body(null, 401);
  }
  if (!isStaffRole(session.user.role)) {
    return c.body(null, 403);
  }
  const key = c.req.param("key");
  const file = await readSeedFile(key);
  if (!file) {
    return c.body(null, 404);
  }
  return c.body(file, 200, {
    "Cache-Control": "private, no-store",
    "Content-Type": key.endsWith(".png") ? "image/png" : "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });
});

app.get("/", (c) => c.text("OK"));

export default app;
