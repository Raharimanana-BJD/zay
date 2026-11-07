# Verify: Retouches de l'interface mobile · spec 0005 · updated 2026-11-08
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

### Milestone 1: onglets, splash, carte plein écran (AC-1 à AC-4)

Needs a new native build (`bun run android` in `apps/native`), because the native splash changed in `app.json`.

- [ ] Cold start, signed out → yellow screen `#f7c910`, black `Zay` logo, three black dots bouncing under it, then the welcome or sign in screen. No jump between the native splash and the animated one → AC-1
- [ ] Cold start, signed in as a client, then as a driver → the splash stays until the role is known, then opens straight on the right space (no flash of the sign in screen) → AC-1
- [ ] Cold start with a fast session read → the splash still stays at least 1 second, then fades out → AC-1
- [ ] Turn on "Remove animations" in Android accessibility settings, cold start → the three dots stay still → AC-1
- [ ] Cold start in airplane mode while signed in → the splash goes away anyway (me.get fails, the stored session role is used) → AC-1
- [ ] Client and driver tab bars → icons only, 24 px, yellow dot under the open tab, nothing hidden by the bar at the bottom of Réserver → AC-2
- [ ] TalkBack on the tab bar → each tab is read with its name and its selected state → AC-2
- [ ] Réserver, Suivi de course client, Accueil chauffeur, Course chauffeur → each map has a round expand button in the top right corner → AC-3
- [ ] Tap expand → fullscreen map with the same markers and route; tap Fermer, then reopen and press Android back → both close it, and the screen below kept its input → AC-3
- [ ] Client follows a ride in full screen while the driver moves → the driver marker moves on the big map → AC-3
- [ ] Fullscreen controls: recenter, see the whole trip, zoom +, zoom − each act on the map; "see the whole trip" frames pickup, destination and driver → AC-4
- [ ] Location permission refused, tap recenter → "Position introuvable" shows and the map does not move → AC-4
- [ ] Summary card: Réserver shows the estimated distance and the price of the chosen category (automatic → lowest), nothing before a quote; ride tracking shows status, route and agreed price; driver home shows "En ligne" or "Hors ligne", or the new request with its route and price → AC-4

### Milestone 2: serveur de fichiers et photo de profil (AC-5 à AC-7, AC-14)

No new native build needed (no new native module). Restart the dev server so the new `/files` routes load.

- [x] Profile, tap the avatar → a sheet with "Prendre une photo · Choisir dans la galerie", and no "Retirer la photo" while there is no photo → AC-5
- [ ] Choose a gallery photo → a square crop opens, then a spinner on the avatar, then the new photo shows at once → AC-5
- [x] Change the photo again → the new one shows, and the previous `up-avatar-…` file is gone from `apps/server/uploads/` → AC-5
- [x] With a photo, open the sheet → "Retirer la photo" is there; tap it → the initial comes back, the file is gone from disk → AC-5
- [ ] Take a photo with the camera permission refused → the toast asks to allow the camera or use the gallery → AC-5
- [ ] Send an image over 5 MB as an avatar → "Cette image est trop lourde.", the old photo stays → AC-5
- [ ] Client and driver both with a photo, ride accepted → the client tracking screen shows the driver's photo next to the name, the driver ride screen shows the client's photo → AC-6
- [ ] Same ride, one side without a photo → that side shows the first letter of the name → AC-6
- [ ] Ride completed or cancelled → the same avatar URL now answers 403, and the screens fall back to the initial → AC-6, AC-7
- [x] A third client opens someone's avatar URL → 403 · no session → 401 · the team (admin or support) → 200 → AC-7
- [x] Driver sends a PDF document through `POST /files/doc` → 201 with an `up-doc-….pdf` key; over 10 MB → 413 `FILE_TOO_LARGE`; a text file → 415 `FILE_TYPE_NOT_ALLOWED` → AC-14
- [x] Driver reads their own document → 200; another driver reads it → 403; every file answer carries `Content-Security-Policy: sandbox` → AC-14
- [x] `POST /api/auth/update-user` with an `image` field → 400 `IMAGE_NOT_ALLOWED` → AC-5

### Value sourcing (spec 0002)
- [ ] Profile photo comes from `me.get.imageUrl`: set `user.image` to null in the database → the profile shows the initial
- [ ] Initial fallback: rename the account to "élodie" → the avatar shows "É"
- [ ] Driver photo on tracking comes from the assigned driver: reassign the ride to another driver → the photo follows the new driver
- [x] Client photo on the driver ride comes from `driver.ride.clientImageUrl` ← the client's `user.image`
- [x] The crop is square with quality 0.6: the stored file is square and well under 1 MB for a phone photo

### Milestone 3: téléphone facultatif, Google et écran de complétion (AC-8 à AC-11)

Needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server, `<BETTER_AUTH_URL>/api/auth/callback/google` in the Google console, and `EXPO_PUBLIC_GOOGLE_SIGN_IN=true` in the app. No new native module (`expo-web-browser` was already there). Restart the server so the auth changes load.

- [ ] With `EXPO_PUBLIC_GOOGLE_SIGN_IN=false` → no Google button on Connexion or Inscription; with `true` → "Continuer avec Google" on both → AC-8
- [ ] Google with an email already signed up by password (and verified) → signed straight into the right space, no completion screen → AC-8
- [ ] Google with an unknown email → account created (Google name and email, no photo), then only "Compléter mon profil" shows → AC-9
- [ ] On that screen, choose Chauffeur, enter a free phone, Continuer → the driver space opens, the Dossier shows "Propriétaire", a welcome mail arrives (Mailpit) → AC-9
- [ ] Same with Client → the client space opens → AC-9
- [ ] On the completion screen, kill and reopen the app → still only that screen; "Se déconnecter" works → AC-10
- [x] An incomplete account calling `client.createBooking`, `driver.register`, `me.report` → `PROFILE_INCOMPLETE`; `POST /files/avatar` → 403 `PROFILE_INCOMPLETE`; `me.get`, `me.setLocale` still answer → AC-10
- [ ] Enter a phone another account already has → "Ce numéro est déjà utilisé par un autre compte.", and the database row keeps `phone` empty, role `client` → AC-11
- [ ] Cancel the Google page, or deny access → back on Connexion with the "La connexion avec Google n'a pas abouti" toast → AC-8
- [ ] Someone signs up by email with your address and never verifies it; you then use Google → you land on that account, its old password no longer signs in, its email is verified → AC-8
- [ ] Profile of a Google only account → no "Changer le mot de passe"; a password account still has it → AC-8
- [x] Back office, a Google account still on the completion screen → "Non renseigné" in the client list and on its page → AC-9
- [x] `POST /api/auth/sign-up/email` without `phone` or with `""` → 400 `PHONE_REQUIRED`; `POST /api/auth/update-user` with `phone: null` → 400 → AC-10

### Value sourcing (spec 0003)
- [ ] Google account name and email come from the Google profile: change the Google display name, sign up → the Zay name follows
- [ ] Initial role is `client`: before completion, `user.role` is `client` in the database
- [x] Phone and role come from the completion screen; the driver situation is always `owner`
- [x] Locale comes from the app: switch the app to Malagasy before completing → `user.locale` is `mg` and the welcome mail is in Malagasy
- [x] The guard reads `user.phone` in the database: set a complete client's phone to NULL in SQL → its next booking call answers `PROFILE_INCOMPLETE`
- [ ] `/sign-in/social` with `additionalData: { phone, role }` → the new account still has no phone and the `client` role

### Milestone 4: documents chauffeur (AC-12, AC-13, AC-15 à AC-17)

Needs a new development build: `expo-document-picker` is a new native module (`bun run android` from `apps/native`). Restart the server so the API changes load. Use a driver account, and an admin account in the back office.

- [x] Dossier → touch "Assurance" → a sheet with "Prendre une photo · Choisir une image · Choisir un PDF" → AC-12
- [x] Choose a 2 MB PDF → the row shows "Prêt", a PDF icon and the file name; nothing reaches the server yet (no new `driver_document` row) → AC-12
- [ ] Take a photo for "Pièce d'identité" → "Prêt" with the photo as thumbnail → AC-12
- [x] Choose a PDF over 10 MB → toast "Ce PDF dépasse 10 Mo", the row does not change → AC-12, AC-14
- [x] The button reads "Envoyer mes documents (2)"; with nothing ready it is greyed out and reads "(0)" → AC-13
- [ ] Touch it → both rows go "Envoi en cours", then "En attente"; toast "Documents envoyés : 2"; the header shows "2 sur 4 envoyés" with the yellow bar at half → AC-13, AC-15
- [ ] Prepare two documents, turn on airplane mode during the send → the failed one stays "Prêt" with the network error under it; once back online, the button sends only that one → AC-13
- [x] A sent image: touch its thumbnail → it opens large, "Fermer" closes it. A sent PDF: icon, "PDF envoyé le JJ/MM/AAAA", nothing opens → AC-15
- [x] Back office, driver page, "Voir" on the PDF → the PDF shows inside the window, with an "Ouvrir" link that opens a new tab → AC-16
- [x] Same with an image → shown as before → AC-16
- [x] In the browser network tab, the PDF response has `Content-Type: application/pdf` and `Content-Security-Policy: sandbox` → AC-16
- [ ] "Approuver" on a document → an optional "Date d'expiration" field; "Complément" and "Rejeter" have none; the vehicle and driver "Approuver" have none → AC-17
- [x] Approve the insurance with a date 10 days ahead → the app shows "Expire le …" and the "Expire bientôt" pill; the database has `expires_at` at 23:59:59 Antananarivo time (20:59:59 UTC) → AC-15, AC-17
- [ ] Approve with the field empty → `expires_at` is NULL, the app shows no expiry line → AC-17
- [x] The date field does not offer a past day; sending one anyway through the API answers `DOCUMENTS_NOT_APPROVED` and nothing changes → AC-17
- [ ] Ask "Complément" with "Document illisible" and a note → the app row shows "À compléter" and the note in red; without a note it shows "Document illisible" (in Malagasy too) → AC-15
- [ ] In SQL, set an approved document's `expires_at` to yesterday → the app shows "Expiré", and going online answers `DOCUMENT_EXPIRED` → AC-15
- [x] `driver.attachDocument` with an `expiresAt` field → refused by the schema (`unrecognized_keys`) → AC-17
- [x] `admin.drivers.decide` with `expiresAt` on a rejection, or on a vehicle → `EXPIRY_NOT_ALLOWED` (BAD_REQUEST) → AC-17
- [x] Replace an approved, dated document from the app → the new row starts "En attente" with no date → AC-17

### Value sourcing (spec 0004)
- [ ] Progress count is the number of required documents with a current row: replace one document → the count does not go up
- [x] Progress total follows `requiredDocuments` (4 today)
- [x] Row state: local "Prêt" wins over the server state until sent; with no file at all, "À envoyer"
- [x] Sent preview follows the stored key's extension: a `.pdf` key shows the PDF icon, `.png`/`.jpg` the thumbnail
- [ ] Send date comes from `driver_document.created_at`: change it in SQL → "PDF envoyé le" follows
- [ ] Expiry comes from `driver_document.expires_at`: change it in SQL → the date follows
- [ ] "Expire bientôt" counts days in Antananarivo time: set `expires_at` to 30 days ahead at 23:59 local → pill shown; 31 days → no pill. Test near midnight UTC (03:00 local) that the day count does not shift
- [ ] Reason is the latest decision on that document only: two decisions in a row → the newest note shows; a decision on the driver itself never shows on a document row
- [x] Admin date field writes `decide.expiresAt`: pick a day → that same day is shown back in the back office "Expiration" column

## Commands
- [x] `bunx tsc --noEmit -p apps/native` → no errors → AC-1 to AC-4
- [x] `bun run db:verify` → 67 checks passed (email sign up still needs a phone) → AC-10
- [x] `cd apps/server && bun run verify:mobile` → 0 failed (the guard lets complete accounts through) → AC-10

## Value sourcing (spec 0001)
- [ ] Réserver: change the category between Voiture, Tuk tuk and Automatique → the summary price follows the chosen one, Automatique shows the lowest → value "prix"
- [ ] Booking tracking: a ride with no agreed price yet → the summary shows "—" → value "prix convenu"
- [ ] Driver home: go offline, open the full screen and tap recenter → the position is still found by a one off GPS read → value "ma position"

## Acceptance-criteria coverage
- AC-1: splash steps · AC-2: tab bar steps · AC-3: expand, close, live update steps · AC-4: controls, refused position, summary steps
- AC-5: profile sheet, crop, change, remove, size steps · AC-6: ride photo steps · AC-7: access steps · AC-14: PDF document steps
- AC-8: Google button, linking, cancel, takeover, password row steps · AC-9: new account, completion, back office steps · AC-10: blocked screen and refused calls steps · AC-11: taken phone step
- AC-12: sheet, ready, size steps · AC-13: send all, partial failure steps · AC-15: progress, preview, expiry, reason steps · AC-16: PDF view, Ouvrir, headers steps · AC-17: date field, past date, empty date, schema, replace steps
