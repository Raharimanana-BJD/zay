# Verify: Retouches de l'interface mobile · spec 0005 · updated 2026-11-07
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

- [ ] Profile, tap the avatar → a sheet with "Prendre une photo · Choisir dans la galerie", and no "Retirer la photo" while there is no photo → AC-5
- [ ] Choose a gallery photo → a square crop opens, then a spinner on the avatar, then the new photo shows at once → AC-5
- [ ] Change the photo again → the new one shows, and the previous `up-avatar-…` file is gone from `apps/server/uploads/` → AC-5
- [ ] With a photo, open the sheet → "Retirer la photo" is there; tap it → the initial comes back, the file is gone from disk → AC-5
- [ ] Take a photo with the camera permission refused → the toast asks to allow the camera or use the gallery → AC-5
- [ ] Send an image over 5 MB as an avatar → "Cette image est trop lourde.", the old photo stays → AC-5
- [ ] Client and driver both with a photo, ride accepted → the client tracking screen shows the driver's photo next to the name, the driver ride screen shows the client's photo → AC-6
- [ ] Same ride, one side without a photo → that side shows the first letter of the name → AC-6
- [ ] Ride completed or cancelled → the same avatar URL now answers 403, and the screens fall back to the initial → AC-6, AC-7
- [ ] A third client opens someone's avatar URL → 403 · no session → 401 · the team (admin or support) → 200 → AC-7
- [ ] Driver sends a PDF document through `POST /files/doc` → 201 with an `up-doc-….pdf` key; over 10 MB → 413 `FILE_TOO_LARGE`; a text file → 415 `FILE_TYPE_NOT_ALLOWED` → AC-14
- [ ] Driver reads their own document → 200; another driver reads it → 403; every file answer carries `Content-Security-Policy: sandbox` → AC-14
- [ ] `POST /api/auth/update-user` with an `image` field → 400 `IMAGE_NOT_ALLOWED` → AC-5

### Value sourcing (spec 0002)
- [ ] Profile photo comes from `me.get.imageUrl`: set `user.image` to null in the database → the profile shows the initial
- [ ] Initial fallback: rename the account to "élodie" → the avatar shows "É"
- [ ] Driver photo on tracking comes from the assigned driver: reassign the ride to another driver → the photo follows the new driver
- [ ] Client photo on the driver ride comes from `driver.ride.clientImageUrl` ← the client's `user.image`
- [ ] The crop is square with quality 0.6: the stored file is square and well under 1 MB for a phone photo

## Commands
- [ ] `bunx tsc --noEmit -p apps/native` → no errors → AC-1 to AC-4

## Value sourcing (spec 0001)
- [ ] Réserver: change the category between Voiture, Tuk tuk and Automatique → the summary price follows the chosen one, Automatique shows the lowest → value "prix"
- [ ] Booking tracking: a ride with no agreed price yet → the summary shows "—" → value "prix convenu"
- [ ] Driver home: go offline, open the full screen and tap recenter → the position is still found by a one off GPS read → value "ma position"

## Acceptance-criteria coverage
- AC-1: splash steps · AC-2: tab bar steps · AC-3: expand, close, live update steps · AC-4: controls, refused position, summary steps
- AC-5: profile sheet, crop, change, remove, size steps · AC-6: ride photo steps · AC-7: access steps · AC-14: PDF document steps
- AC-8 to AC-13, AC-15 to AC-17: not built yet (milestones 3 and 4)
