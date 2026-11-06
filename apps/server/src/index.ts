import { trpcServer } from "@hono/trpc-server";
import { isStaffRole } from "@zay-app/api/domain/staff";
import { appRouter } from "@zay-app/api/routers/index";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { startDispatcher } from "./dispatcher";
import { ENV } from "./env.server";
import {
  isPublicFile,
  MAX_UPLOAD_BYTES,
  readStoredFile,
  storeUpload,
} from "./files";
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

// Identity documents: team sessions only. Vehicle photos: any signed in account.
app.get("/files/:key", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.body(null, 401);
  }
  const key = c.req.param("key");
  if (!(isStaffRole(session.user.role) || isPublicFile(key))) {
    return c.body(null, 403);
  }
  const file = await readStoredFile(key);
  if (!file) {
    return c.body(null, 404);
  }
  return c.body(file, 200, {
    "Cache-Control": "private, no-store",
    "Content-Type": key.endsWith(".png") ? "image/png" : "image/jpeg",
    "X-Content-Type-Options": "nosniff",
  });
});

// A driver sends a picture of a paper or a vehicle, and gets a key to attach to it.
app.post(
  "/files/:kind",
  bodyLimit({
    maxSize: MAX_UPLOAD_BYTES,
    onError: (c) => c.json({ code: "FILE_TOO_LARGE" }, 413),
  }),
  async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.body(null, 401);
    }
    if (session.user.role !== "driver") {
      return c.body(null, 403);
    }
    const kind = c.req.param("kind");
    if (kind !== "doc" && kind !== "photo") {
      return c.body(null, 404);
    }
    const bytes = new Uint8Array(await c.req.raw.arrayBuffer());
    const key = await storeUpload(bytes, kind);
    return key
      ? c.json({ key }, 201)
      : c.json({ code: "FILE_TYPE_NOT_ALLOWED" }, 415);
  }
);

app.get("/", (c) => c.text("OK"));

startDispatcher();

export default app;
