-- Sign in now needs a verified email (spec 0004). Accounts made before that rule
-- never got a code, so they are trusted as they are when this migration runs.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
