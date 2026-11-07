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
import { emailOTP } from "better-auth/plugins/email-otp";
import z from "zod";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  /** Google sign in is on only when both values are set. */
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
};

type MailLocale = "fr" | "mg";

/**
 * What the auth needs to send mail. `apps/server` passes the mailer from
 * `@zay-app/email`, so this package never knows about SMTP.
 */
export type AuthMailer = {
  sendOtp: (input: {
    to: string;
    code: string;
    purpose: "email-verification" | "forget-password";
    locale: MailLocale;
    expiresInMinutes: number;
  }) => Promise<void>;
  sendWelcome: (input: {
    to: string;
    name: string;
    locale: MailLocale;
  }) => Promise<void>;
};

export type AuthOptions = {
  mailer: AuthMailer;
  desktopOrigins?: readonly string[];
  /** Only test scripts turn this off, to sign up and act at once. */
  requireEmailVerification?: boolean;
};

const OTP_MINUTES = 10;
const OTP_ATTEMPTS = 3;
const SECONDS_PER_MINUTE = 60;

const toMailLocale = (value: unknown): MailLocale =>
  value === "mg" ? "mg" : "fr";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const SIGN_UP_PATH = "/sign-up/email";
const UPDATE_USER_PATH = "/update-user";

// Passwordless sign in and email change are not part of the product. Every HTTP
// route of the admin plugin stays closed too: the server reaches these actions
// through `auth.api`, after its own role checks in `@zay-app/api`.
const CLOSED_PATHS = [
  "/sign-in/email-otp",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
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
  { mailer, desktopOrigins = [], requireEmailVerification = true }: AuthOptions
) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // The phone stays required, so Google only opens existing accounts.
            disableImplicitSignUp: true,
          },
        }
      : undefined;

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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: requireEmailVerification,
      sendOnSignIn: requireEmailVerification,
      autoSignInAfterVerification: true,
      afterEmailVerification: async (user) => {
        const { locale } = user as { locale?: unknown };
        await mailer
          .sendWelcome({
            to: user.email,
            name: user.name,
            locale: toMailLocale(locale),
          })
          .catch(() => {
            // A lost welcome mail never blocks the account.
          });
      },
    },
    socialProviders: google,
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    disabledPaths: CLOSED_PATHS,
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

        // The photo is a file key only `me.setImage` checks and writes (spec 0005).
        if ("image" in body) {
          throw new APIError("BAD_REQUEST", {
            code: "IMAGE_NOT_ALLOWED",
            message: "The profile photo is changed through me.setImage.",
          });
        }

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
    plugins: [
      expo(),
      admin({ defaultRole: "client" }),
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_MINUTES * SECONDS_PER_MINUTE,
        allowedAttempts: OTP_ATTEMPTS,
        storeOTP: "hashed",
        disableSignUp: true,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== "email-verification" && type !== "forget-password") {
            return;
          }
          const owner = await ctx?.context.adapter.findOne<{
            locale?: string;
          }>({
            model: "user",
            where: [{ field: "email", value: email.toLowerCase() }],
            select: ["locale"],
          });
          // Not awaited, so the answer time does not reveal if the mail left.
          mailer
            .sendOtp({
              to: email,
              code: otp,
              purpose: type,
              locale: toMailLocale(owner?.locale),
              expiresInMinutes: OTP_MINUTES,
            })
            .catch((error: unknown) => {
              ctx?.context.logger.error("Failed to send an OTP email", error);
            });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
