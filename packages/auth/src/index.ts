import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import type { Database } from "@zay-app/db";
import * as schema from "@zay-app/db/schema/auth";
import { betterAuth } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import z from "zod";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const SIGN_UP_PATH = "/sign-up/email";
const UPDATE_USER_PATH = "/update-user";

// Every HTTP route of the admin plugin stays closed. The server reaches these
// actions through `auth.api`, after its own role checks in `@zay-app/api`.
const CLOSED_ADMIN_PATHS = [
  "/admin/ban-user",
  "/admin/create-user",
  "/admin/get-user",
  "/admin/has-permission",
  "/admin/impersonate-user",
  "/admin/list-user-sessions",
  "/admin/list-users",
  "/admin/remove-user",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/set-role",
  "/admin/set-user-password",
  "/admin/stop-impersonating",
  "/admin/unban-user",
  "/admin/update-user",
];

const phoneTakenError = () =>
  new APIError("BAD_REQUEST", {
    code: "PHONE_NUMBER_ALREADY_USED",
    message: "This phone number is already used by another account.",
  });

export function createAuth(
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      ...desktopOrigins,
      "zay-app://",
      "exp://",
      "http://localhost:8081",
    ],
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    disabledPaths: CLOSED_ADMIN_PATHS,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    user: {
      additionalFields: {
        phone: {
          type: "string",
          required: true,
          unique: true,
          validator: {
            input: z
              .string()
              .regex(
                E164_PHONE,
                "Phone must be in international format, like +261340000000"
              ),
          },
        },
        locale: {
          type: "string",
          required: true,
          defaultValue: "fr",
          validator: { input: z.enum(["fr", "mg"]) },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_UP_PATH && ctx.path !== UPDATE_USER_PATH) {
          return;
        }
        const body = (ctx.body ?? {}) as { phone?: unknown };

        // Better Auth only rejects a truthy role, so an empty one needs this check.
        if (ctx.path === SIGN_UP_PATH && "role" in body) {
          throw new APIError("BAD_REQUEST", {
            code: "ROLE_NOT_ALLOWED",
            message: "The role cannot be chosen at sign up.",
          });
        }
        if (typeof body.phone !== "string") {
          return;
        }

        const owner = await ctx.context.adapter.findOne<{ id: string }>({
          model: "user",
          where: [{ field: "phone", value: body.phone }],
          select: ["id"],
        });
        if (!owner) {
          return;
        }
        if (ctx.path === UPDATE_USER_PATH) {
          const session = await getSessionFromCtx(ctx);
          if (session?.user.id === owner.id) {
            return;
          }
        }
        throw phoneTakenError();
      }),
      // Two simultaneous sign ups both pass the check above, then the unique index
      // stops the second one. Better Auth reports that as a generic failure.
      after: createAuthMiddleware(async (ctx) => {
        const { returned } = ctx.context;
        const isFailedSignUp =
          ctx.path === SIGN_UP_PATH &&
          returned instanceof APIError &&
          returned.body?.code === "FAILED_TO_CREATE_USER";
        const phone = (ctx.body as { phone?: unknown } | undefined)?.phone;
        if (!isFailedSignUp || typeof phone !== "string") {
          return;
        }
        const owner = await ctx.context.adapter.findOne<{ id: string }>({
          model: "user",
          where: [{ field: "phone", value: phone }],
          select: ["id"],
        });
        if (owner) {
          throw phoneTakenError();
        }
      }),
    },
    plugins: [expo(), admin({ defaultRole: "client" })],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
