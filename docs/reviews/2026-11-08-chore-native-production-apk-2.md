# Review, chore/native-production-apk, 2026-11-08

**Reviewed by**: Sonnet 5.5 (author on Sonnet 5.5, fresh reviewer context)
**Scope**: 74 files, branch vs main (merge base 2130760)
**Verdict**: Approve with nits

## Summary
This branch adds Google sign up with a later phone step, profile photos with a ride based read rule, PDF documents, an expiry date set by the team at approval, an animated splash and a production APK setup. The server side is careful: the file read rule lives in one place, the key format carries the author id, the phone gate is checked against the database when the session has none, and the Google link cleanup runs before the link is written. `bun run check-types` passes for all workspaces. I found no blockers or majors. The points below are small gaps you can fix soon. No test runner exists yet, so the correctness of the new branching logic (canReadFile, completeProfile, the link cleanup) rests on `/check verify` only. Add `bun test` cases for these once a runner is set up.

## Minor
### 🟡 Avatar uploads have no quota and can leave orphan files, `apps/server/src/index.ts:96`
**Problem**: Any signed in account with a phone can now POST up to 5 MB to `/files/avatar` as many times as it wants. Each call writes a new file. The file is only cleaned up when `me.setImage` succeeds later. An upload without a `setImage` (app killed, network error) stays on disk forever. The same is true for a document uploaded whose `attachDocument` fails (`apps/native/components/documents-block.tsx:317`).
**Why it matters**: Before this branch only drivers could upload. Now every client can, so a single account can fill the disk of the server. At demo scale this is low risk, but it is a new open door.
**Suggested fix**: Add a simple rate limit or a cap per account on the avatar route, and later a cleanup job for upload files that no row points to.

### 🟡 PDF is served from the API origin without the sandbox header, `apps/server/src/index.ts:69`
**Problem**: The `Content-Security-Policy: sandbox` header is skipped for PDF so Chrome shows its viewer. The PDF content is checked only by its first four bytes (`%PDF`) and the driver controls the rest. The page is on the same origin as the auth cookie.
**Why it matters**: `nosniff` and the `application/pdf` type stop HTML from running, and browser PDF viewers run in their own sandbox, so the real risk is small. It is still a weaker setup than the images have, and it depends on every viewer behaving.
**Suggested fix**: Keep as is for the demo. Note it in the spec, and move files to a separate origin when the real storage (feature 22) replaces the disk.

### 🟡 Old app builds break on `attachDocument`, `packages/api/src/routers/driver.ts:785`
**Problem**: The input is now `z.strictObject`, so a build that still sends `expiresAt` gets a BAD_REQUEST with a generic message.
**Why it matters**: Only matters if an older APK is still in drivers' hands. The strictness is on purpose (the date belongs to the team), so this is a rollout point, not a bug.
**Suggested fix**: Make sure the new APK is installed before the demo, or ignore an unknown `expiresAt` for one release.

### 🟡 Google sign up always makes a driver an "owner", `packages/api/src/routers/me.ts:90`
**Problem**: `completeProfile` calls `registerDriver(tx, ..., "owner")` with no choice of relation, while `driver.register` lets the person pick owner, renter or employee.
**Why it matters**: A renter or employee who signs up with Google ends with the wrong employment relation and has no screen to fix it.
**Suggested fix**: Add the relation to the `completeProfile` input (and the screen) when the role is driver, or confirm that spec 0006 will cover it.

### 🟡 An already attached document can show as failed, `apps/native/components/documents-block.tsx:317`
**Problem**: Upload, attach and `onSent()` sit in one try block. If `onSent()` (the refetch) fails after `attachDocument` worked, the row is marked "ready" with an error and the driver can send it again, which uploads a second file and replaces the first.
**Why it matters**: Harmless data wise (the server keeps the latest) but it confuses the driver and wastes a verification round.
**Suggested fix**: Catch the refetch error on its own, so a successful attach is still counted as sent.

### 🟡 Past expiry day gives a misleading error code, `packages/api/src/routers/admin/drivers.ts:104`
**Problem**: `approvedExpiry` throws `conflict(DOCUMENTS_NOT_APPROVED)` when the day is in the past.
**Why it matters**: The web form blocks past days, so this only shows for a stale tab or a direct call, and the message will not match what happened.
**Suggested fix**: Use a dedicated code such as `EXPIRY_IN_PAST` so the dialog can say the right thing.

## Nits
- ⚪ `apps/native/components/google-button.tsx:12`, `BANNED` regex test on the error code is a guess at Better Auth's code text; a short comment with the real value would help.
- ⚪ `apps/web/src/components/admin/action-dialog.tsx:84`, the word "(facultative)" is added to the label in the component, so it cannot be changed per use; move it into `dateLabel`.
- ⚪ `packages/auth/src/index.ts:200`, the `delete` on `additionalData` needs the biome-ignore; fine, but a one line link to why Better Auth merges the returned context would help the next reader.
- ⚪ `apps/native/.env.production`, the production API host is committed in clear. It is public by design, so only check that the file stays free of secrets.

## Strengths
- One `canReadFile` decides every file read; avatar keys carry the author id and must also equal the current `user.image`, so a file can not be claimed or read after it is replaced.
- The Google link cleanup runs in a `before` hook, so a failed cleanup means no link, and the pre registered unverified account (password, sessions, phone) is removed when the real owner arrives. Different email linking stays closed by Better Auth default.
- `completeProcedure` avoids a database read for sessions that already have a phone, and `completeProfile` uses an `isNull(phone)` guarded update plus unique violation mapping, so double submits and phone clashes are safe.
- The expiry date is now a server side decision with a calendar day in Antananarivo time and an end of day rule, and the strict input stops drivers from setting it.
- Earlier review points (seed key, PDF sandbox in Chrome, extra DB read, hook cleanup, production URL default) are confirmed fixed in the current code.

## Test coverage
Test signal is none-yet: there is no test script or CI. The new branching logic (`canReadFile` and avatar rules, `completeProfile`, the link cleanup hook, `assertExpiryAllowed` and `approvedExpiry`) has no automated test. Pure functions such as `avatarOwnerOf`, `endOfDay` and `isProfileComplete` are cheap to cover with `bun test`. `/check verify` should exercise a Google account that is new, a pre registered unverified email, and an avatar read by the other side of an active ride and then after it ends.
