# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The repo holds two UI surfaces under this one product record:

- `apps/web` (TanStack Start): the public landing page on `/` and the admin back office under `/admin`.
- `apps/native` (Expo, React Native): one mobile app for clients and drivers, shipped as an Android APK. Its look is Zay's own brand (cream and Zay yellow), not Material or the iOS HIG, so it does not count as a native-platform design language.

## Users

- **Clients:** people who live in Toliara (Tuléar), Madagascar, and need a taxi or a tuk-tuk to get around town. Many use entry-level Android phones on an unreliable mobile connection, speak Malagasy day to day, and pay in cash.
- **Drivers:** taxi and tuk-tuk drivers in Toliara who want ride requests near them. They use the same app as the clients, switch to driver mode, and send in their papers (driving licence, registration card, insurance) for the team to check. They use the app while working, often on the road.
- **Admin team:** Zay staff who check driver files and vehicles, watch over rides and reports, set fares and dispatch rules, manage accounts and roles, and read the statistics. They work only in the web back office, in French.

Public surfaces are designed first for the real residents and drivers of Toliara. The 9 November 2026 demo in front of a jury is one milestone, not the audience.

## Product Purpose

Zay lets someone in Toliara book a taxi or a tuk-tuk without hunting for one in the street. They know the price before they leave, compare offers from nearby drivers, follow the driver on the map, and pay in cash at the end. Drivers get a steady flow of nearby requests and a tool to manage their availability, rides and earnings. The admin team gets what it needs to verify accounts, supervise rides and configure the service.

Success: a client can go from "I need a ride" to a confirmed driver on the way within a few seconds of tapping, even on a weak connection, and both sides trust the agreed price.

## Positioning

What a generic ride-hailing app cannot truthfully claim:

- **Offers and bounded negotiation:** drivers send offers, the client compares them and can negotiate. The server sets the limits, so there is one negotiation at a time, offers expire, and a driver stays locked while their offer is open.
- **Taxi and tuk-tuk together:** both vehicle types in one app. The client picks one, or lets Zay search both automatically.
- **One app, two roles:** the same app for clients and drivers. A driver's file is reviewed by the Zay team before they can take rides.
- **Built for Toliara:** it copes with an unstable network, places described by local landmarks rather than postal addresses (always pinned on the map, with the description as a complement), entry-level phones, and cash payment.

## Operating Context

- **Ride flow:** choose pickup and destination on a map of Toliara → see an indicative price → drivers nearby are offered the request in groups → compare offers, negotiate within limits → assign → follow the driver → ride → record cash payment. Edge cases include cancellations, incidents, changing the destination and losing the connection.
- **Driver flow:** sign up, switch to driver mode, upload papers and vehicle photos, wait for validation, go online, answer requests, see history and earnings.
- **Revenue:** drivers pay a subscription through Mobile Money. Rides are paid in cash.
- **Distribution:** no app store. The Android app is a downloadable APK, linked from the landing page through `VITE_APK_URL` (the button reads « Bientôt disponible » while the link is unset).
- **Languages:** French and Malagasy across the mobile app and the landing page. The back office is French only.
- **Demo:** simulated drivers driven from the web, with fares and zones as configurable test values (no field survey yet).

## Capabilities and Constraints

- Business rules (prices, offers, timers, ride status) are enforced on the server, never only in a client.
- Sign-in is email and password, with an email code to verify a new account and to reset a forgotten password.
- Background push notifications are not built yet (they need a Firebase project).
- Real fares, coverage area, served neighbourhoods and allowed destinations are still undecided, pending a field survey. Do not present test values as real prices.
- Expansion to other cities is out of scope for the MVP.
- Terminology: « course » (ride), « offre » (offer), « chauffeur » (driver), « client », « dossier » (driver file), « tuk-tuk », amounts in ariary.

## Brand Commitments

- Name: **Zay**. Logo and mark assets live in `Resource-zayapp/` (`logo.png`, `logo-w.png`, splash and favicon variants) and `apps/web/public/landing/` (`mark.png`, `mark-w.png`).
- The mobile identity (cream background, Zay yellow) is the product's recognisable face. The landing page reuses it so visitors recognise what they install. The back office keeps its own neutral tokens.
- `DESIGN-uber.md` is a layout reference only. Its brand name, logo and fonts never appear in the product (spec 0002, AC-7).
- Voice in French copy: polite « vous », short plain sentences, concrete benefits, and no sums of money on the public page.

## Evidence on Hand

- Illustrations: `Resource-zayapp/image-1.png` (a man booking a ride on his phone) and `image-2.png` (a driver helping a passenger load luggage), with web copies in `apps/web/public/landing/`.
- App screenshot: `apps/web/public/landing/app-screen.webp`.
- Mobile redesign reference: `Resource-zayapp/Zay App Redesign.pdf`.
- Contact: Toliara, Madagascar · `brayjuanico@gmail.com` · `+261 38 14 600 78`.
- Requirements: `cahier_des_charges_plateforme_taxi_toliara.md`. Plan: `docs/scope/_root/scope.md`. Specs: `docs/specs/_root/`.
- **Absent, never fabricate:** testimonials, user or ride counts, partner logos, press, ratings, real fares, store badges or listings.

## Product Principles

1. **The price is known and agreed before the ride.** Every surface supports trust in the price: estimate first, offers compared, negotiation within server rules.
2. **Works in Toliara's real conditions.** Assume an entry-level Android phone, a weak connection and a landmark instead of an address. Lightness and resilience beat richness.
3. **One product, two roles, one face.** Clients and drivers share the same app and identity. The driver path is a mode, not a separate product.
4. **Speak the local language plainly.** French and Malagasy are equal citizens on user-facing surfaces, in simple words.
5. **The server is the referee.** No client-side shortcut decides a price, a timer or a status.

## Accessibility & Inclusion

- Public and mobile surfaces work at 360 px wide with no horizontal scroll, touch targets of at least 44 px, and alt text on every image (also translated).
- Driver screens must stay usable at a glance and with one hand while working.
- Malagasy copy has not yet been reviewed by a native speaker; treat it as provisional.
- Amounts in ariary display the same way everywhere.
