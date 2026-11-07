import { createAuth } from "@zay-app/auth";
import { createDb } from "@zay-app/db";
import { createMailer } from "@zay-app/email";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const mailer = createMailer(ENV);
export const auth = createAuth(ENV, db, { mailer });
