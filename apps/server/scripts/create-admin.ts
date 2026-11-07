// Creates the first admin, or a new one. Run from the root:
//   bun run admin:create --email a@zay.mg --name "Nom" --phone +261340000000
// The password is only asked for at the prompt, so it stays out of the shell history.

import { parseArgs } from "node:util";

import { phoneSchema } from "@zay-app/api/domain/phone";
import { user } from "@zay-app/db/schema/auth";
import { eq, or } from "drizzle-orm";
import z from "zod";

import { auth, db } from "../src/services";

const MIN_PASSWORD_LENGTH = 8;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
  },
});

const email = z.email().safeParse(values.email);
if (!email.success) {
  fail("Usage : admin:create --email <email> --name <nom> --phone <+261...>");
}
if (!values.name?.trim()) {
  fail("Le nom est obligatoire : --name <nom>");
}
const phone = phoneSchema.safeParse(values.phone);
if (!phone.success) {
  fail("Téléphone mal formé. Format attendu : +261340000000");
}

// Better Auth stores emails in lower case, so the comparison has to match.
const normalizedEmail = email.data.toLowerCase();
const [taken] = await db
  .select({ id: user.id })
  .from(user)
  .where(or(eq(user.email, normalizedEmail), eq(user.phone, phone.data)))
  .limit(1);
if (taken) {
  fail("Cet email ou ce téléphone est déjà utilisé. Rien n'a été modifié.");
}

// biome-ignore lint/suspicious/noAlert: `prompt` is the Bun way to read the password here
const password = prompt("Mot de passe (8 caractères au moins) :") ?? "";
if (password.length < MIN_PASSWORD_LENGTH) {
  fail("Mot de passe trop court. Rien n'a été modifié.");
}

const created = await auth.api.createUser({
  body: {
    email: normalizedEmail,
    password,
    name: values.name.trim(),
    role: "admin",
    data: { phone: phone.data, locale: "fr", emailVerified: true },
  },
});

process.stdout.write(`Admin créé : ${created.user.email}\n`);
process.exit(0);
