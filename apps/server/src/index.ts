import { trpcServer } from "@hono/trpc-server";
import { isStaffRole } from "@zay-app/api/domain/staff";
import { appRouter } from "@zay-app/api/routers/index";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { startDispatcher } from "./dispatcher";
import { ENV } from "./env.server";
import {
  canReadFile,
  contentTypeOf,
  isUploadKind,
  maxBytesOf,
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

// Who reads which file is decided in `canReadFile` (spec 0005, shared contract).
app.get("/files/:key", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.body(null, 401);
  }
  const key = c.req.param("key");
  if (!(await canReadFile(key, session.user))) {
    return c.body(null, 403);
  }
  const file = await readStoredFile(key);
  if (!file) {
    return c.body(null, 404);
  }
  const contentType = contentTypeOf(key);
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  // Chrome refuses to show its PDF viewer for a sandboxed response, so a PDF
  // relies on the browser viewer, which runs no page script. Images stay sandboxed.
  if (contentType !== "application/pdf") {
    headers["Content-Security-Policy"] = "sandbox";
  }
  return c.body(file, 200, headers);
});

const tooLarge = (c: Context) => c.json({ code: "FILE_TOO_LARGE" }, 413);

// Each kind has its own size limit, read before the body is.
const uploadLimit: MiddlewareHandler = (c, next) => {
  const kind = c.req.param("kind") ?? "";
  if (!isUploadKind(kind)) {
    return Promise.resolve(c.body(null, 404));
  }
  return bodyLimit({ maxSize: maxBytesOf(kind), onError: tooLarge })(c, next);
};

// A driver sends a paper or a vehicle photo; anyone sends a profile photo.
app.post("/files/:kind", uploadLimit, async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.body(null, 401);
  }
  const kind = c.req.param("kind");
  if (!isUploadKind(kind)) {
    return c.body(null, 404);
  }
  const { id, role, phone } = session.user;
  if (kind !== "avatar" && role !== "driver") {
    return c.body(null, 403);
  }
  if (!(isStaffRole(role) || phone)) {
    return c.json({ code: "PROFILE_INCOMPLETE" }, 403);
  }
  const bytes = new Uint8Array(await c.req.raw.arrayBuffer());
  const key = await storeUpload(bytes, kind, id);
  return key
    ? c.json({ key }, 201)
    : c.json({ code: "FILE_TYPE_NOT_ALLOWED" }, 415);
});

app.get("/", (c) => c.text("OK"));

startDispatcher();

export default app;
