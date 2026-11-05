import { createAuth } from "@zay-app/auth";
import { createDb } from "@zay-app/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
