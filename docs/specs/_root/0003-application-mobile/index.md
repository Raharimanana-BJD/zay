# 0003 · Application mobile client et chauffeur

**Status**: Assumed
**Date**: 2026-11-06
**Authorized by**: Raharimanana-bjd, during /develop ("je valide toutes tes suggestions")

## Owed decision

Les fonctions 3, 4, 5, 6, 7, 9, 11, 13, 17, 19 et 22 du scope attendaient chacune une décision. La construction de la partie mobile les tranche toutes ici, sans délibération `/architect`.

## Assumption built on

| Sujet | Choix retenu pour la démo |
|---|---|
| Rôles (3) | Inscription toujours en `client`. Le choix chauffeur appelle ensuite `driver.register`, qui crée `driver_profile` et passe le rôle à `driver`, seulement si le compte n'a aucune réservation. Le rôle reste jamais une entrée de l'inscription. `clientProcedure` et `driverProcedure` ferment les actions de l'autre rôle |
| Navigation (3) | Expo Router, un groupe par espace : `(auth)`, `(client)`, `(driver)`, avec `Stack.Protected` |
| Temps réel (4) | Lecture répétée par tRPC toutes les 3 s tant que l'écran est ouvert. Reprise après coupure : le téléphone relit l'état, sans file d'actions hors ligne. Les délais et les expirations restent contrôlés par l'heure du serveur |
| Notifications (4) | Pas de push : il exige un projet Firebase et une clé. À la place, vibration et bandeau dans l'application, et l'écran chauffeur reste allumé en ligne. Application en arrière plan : pas d'alerte, à reprendre plus tard |
| Minuteries (11) | `setInterval` d'une seconde dans `apps/server`, qui appelle `runDispatchTick`. Toutes les échéances sont en base, donc un redémarrage ne perd rien |
| Carte (5) | WebView avec Leaflet et les tuiles raster CARTO, sans clé. Plus léger qu'un moteur vectoriel sur un petit Android |
| Itinéraire (5) | Serveur public OSRM avec un délai de 3 s. Secours : `ST_Distance` × 1,3, enregistré en `fallback` |
| Design (6) | Les jetons noir et blanc de `DESIGN-uber.md` déjà adoptés par le web, en thème clair, avec HeroUI Native et la police système |
| Langues (7) | Dictionnaires typés `fr` et `mg` dans `apps/native/lib/i18n`, sans dépendance. La langue suit `user.locale`. Le malagasy reste à relire par un locuteur |
| Première course (9) | Transitions par `transitionBooking`. `driver_assigned` à l'attribution |
| Distribution (11) | Un groupe reste ouvert pendant `driver_response_s`, et un groupe vide se remplit dès qu'un chauffeur devient éligible. Une offre chiffrée ou en négociation met la recherche en `paused`. Classement : distance par tranches de 500 m, puis chauffeur sollicité le moins récemment |
| Négociation (13) | Le chauffeur accepte ou propose. Le client confirme, refuse ou fait sa contre proposition. Le chauffeur accepte (attribution immédiate, le client s'étant déjà engagé sur ce prix), refuse, ou fait sa dernière proposition, que le client accepte ou refuse |
| Annulations (17) | Client : jusqu'à la prise en charge, avec un motif. Chauffeur : il se retire et la réservation revient à `SEARCHING`, sauf `client_absent` en `ARRIVED`, qui annule. Pendant la course : signalement seulement. Pas de délai d'attente imposé |
| Paiement (19) | Le chauffeur déclare le montant autant de fois que nécessaire, tant que le paiement n'est pas contesté. Le client conteste, et le support résout depuis le web |
| Dossier chauffeur (22) | Fichiers sur le disque du serveur (`apps/server/uploads/`) par `POST /files`. Clés `up-doc-*` réservées à l'équipe, clés `up-photo-*` lisibles par tout compte connecté. Pièces demandées : permis, identité, carte grise, assurance |
| Une demande à la fois | Un client avec une demande active ne peut pas en créer une autre |

## Code area

`apps/native/`, `apps/server/src/`, `apps/server/scripts/seed-mobile.ts`, `apps/server/scripts/verify-mobile-flow.ts`, `packages/api/src/domain/`, `packages/api/src/routers/`.

## Requirements

Repris des `Done when` du scope pour les fonctions 3, 4, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21 et 22, et des scénarios A à G du cahier (§21).

Hors de ce build : abonnement Mobile Money (28, il faut un prestataire), simulateur web (10), gestion des quartiers et zones depuis le web (partie admin de 15), mise en ligne (8), notifications en arrière plan.

## Ratify

This decision was recorded by /develop, not deliberated. Run `/architect application mobile` to deliberate and ratify it. Until then it stays flagged as an owed decision; it does not block marking the feature `done`.
