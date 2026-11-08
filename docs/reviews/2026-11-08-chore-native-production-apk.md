# Review, chore/native-production-apk, 2026-11-08

**Reviewed by**: Claude Sonnet 5.5 (author on the same family, fresh read)
**Scope**: about 55 files, branch vs main (plus uncommitted and untracked files)
**Verdict**: Changes requested

## Summary
This change adds Google sign up with a later phone step, profile photos, PDF documents, an admin set expiry date at approval, an animated splash and map work. The server side is careful: the file rules, the profile gate and the Google account linking cleanup are well thought through. The headline problem is a broken `seed:backoffice` script, with garbled text in two files that looks like an accidental edit. Two smaller risks are worth a look before you ship (PDF preview in the back office, and an extra database read on every call).

## Major
### 🟠 The seed:backoffice script is broken, `apps/server/package.json:14`
**Problem**: The script name was replaced by three spaces (`"   ": "bun run scripts/seed-backoffice.ts"`). In `apps/server/AGENTS.md:30` the doc line now reads `seed:backoff    ice`. It looks like a stray edit.
**Why it matters**: `bun run seed:backoffice` no longer exists, so the back office test data cannot be seeded, and the doc is wrong too.
**Suggested fix**: Put the key back to `seed:backoffice` in the package file and fix the doc line.

## Minor
### 🟡 PDF preview may be blocked in Chrome, `apps/server/src/index.ts:64` and `apps/web/src/routes/admin/chauffeurs/$driverId.tsx` (DocumentViewer)
**Problem**: Files are sent with `Content-Security-Policy: sandbox`, then the back office shows PDFs in an `<object>` and an "Ouvrir" link. Chrome usually refuses to show its built in PDF viewer for a sandboxed response. I could not run it, so this is a risk, not a proof.
**Why it matters**: The team may see a blocked frame instead of the document, which defeats AC for PDF review.
**Suggested fix**: Check it in Chrome and Firefox. If blocked, send the sandbox header only for non PDF, or force a download for PDFs (`Content-Disposition: attachment`), which is also safe.

### 🟡 One extra database read on every client and driver call, `packages/api/src/index.ts:45`
**Problem**: `completeProcedure` reads the user row on each request, and the driver home and ride screens poll every few seconds.
**Why it matters**: It adds load for a check that almost always passes. Reading it fresh is the right idea, so this is only a cost note.
**Suggested fix**: Accept it for now, or fold the phone check into a query the router already runs. Revisit if the polling grows.

### 🟡 Account takeover cleanup runs only after linking, `packages/auth/src/index.ts` (databaseHooks.account.create.after)
**Problem**: `requireLocalEmailVerified: false` lets Google link to an unverified email account, then the hook deletes the password and sessions. The cleanup is in an `after` hook, so if it throws, the link already exists with the squatter's password still alive. Also the squatter's phone stays on the account.
**Why it matters**: A failed cleanup silently leaves the exact hole the hook is meant to close.
**Suggested fix**: Make sure a failure in the hook is loud (logged) and consider clearing the phone too, so the real owner goes through `completeProfile`.

### 🟡 Production server URL is now the committed default, `apps/native/.env.schema:11`
**Problem**: The default moved to `https://api.braharim.cloud`. That is right for the APK, but local dev builds will now hit production unless someone overrides it.
**Why it matters**: Easy to test against real data by accident.
**Suggested fix**: Keep the production value in the EAS build profile and keep a local default here, or note the override in the native AGENTS.md.

### 🟡 A fresh avatar upload cannot be read until `setImage`, `apps/server/src/files.ts:94`
**Problem**: `canReadAvatar` only allows a key that is someone's current `user.image`, so the owner cannot preview a picked photo from the server before saving it.
**Why it matters**: Not a bug if the app previews the local file, just confirm the screen does not load the uploaded key first.
**Suggested fix**: Check the profile screen flow once.

## Nits
- ⚪ `apps/web/src/components/admin/action-dialog.tsx`, the "(facultative)" text is hard coded next to a label; fine for a French only back office.
- ⚪ `apps/native/components/documents-block.tsx` (sendAll loop), a blank line after `for (...) {` that the formatter will remove.

## Strengths
- File access is decided in one place (`canReadFile`): the avatar owner id is inside the key, formats are chosen from the file content, per kind size limits are read before the body, and PDFs are served with `nosniff` and a sandbox policy.
- The profile gate reads the phone from the database, not the cached session, and `completeProfile` is race safe (guarded update, unique violation turned into `PHONE_TAKEN`, welcome mail never blocks).
- The expiry date moved to the team at approval, enforced strictly (`z.strictObject` on attach, `EXPIRY_NOT_ALLOWED` on the server), so the client cannot choose it.
- `packages/db/src/schema/auth.ts` change matches what the generator would produce, and the migration is a clean one liner.

## Test coverage
No test runner script or CI exists yet (`none-yet`). The riskiest new logic has no tests: `canReadFile` (who sees which photo or paper), `completeProfile` and the Google linking hook, and the expiry rules in `admin.drivers.decide`. These are pure enough to cover with `bun test` in `packages/api/src/domain`, and worth doing before the production APK.
