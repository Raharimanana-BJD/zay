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

## Commands
- [ ] `bunx tsc --noEmit -p apps/native` → no errors → AC-1 to AC-4

## Value sourcing (spec 0001)
- [ ] Réserver: change the category between Voiture, Tuk tuk and Automatique → the summary price follows the chosen one, Automatique shows the lowest → value "prix"
- [ ] Booking tracking: a ride with no agreed price yet → the summary shows "—" → value "prix convenu"
- [ ] Driver home: go offline, open the full screen and tap recenter → the position is still found by a one off GPS read → value "ma position"

## Acceptance-criteria coverage
- AC-1: splash steps · AC-2: tab bar steps · AC-3: expand, close, live update steps · AC-4: controls, refused position, summary steps
- AC-5 to AC-17: not built yet (milestones 2 to 4)
