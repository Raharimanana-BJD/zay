# Supervision et signalements

## Summary

L'équipe retrouve une réservation et lit toute son histoire. Elle peut annuler une course non terminée, ouvrir ou fermer un litige, résoudre un paiement contesté, et traiter les signalements jusqu'à leur clôture. Toutes les transitions passent par une seule fonction serveur, que la fonction 9 réutilise.

## Requirements

- **AC-21**: L'équipe liste les réservations, 25 par page, les plus récentes d'abord, avec filtres par statut et par période, et une recherche sur nom ou téléphone du client ou du chauffeur. Une nouvelle réservation apparait en 10 s sans recharger.
- **AC-22**: Le détail montre client, chauffeur, véhicule, lieux, catégorie demandée et catégorie de l'offre, devis, offres et propositions, version de réglages, paiement, et tous les `booking_event` dans l'ordre, avec auteur, heure et motif.
- **AC-23**: Admin et support annulent une réservation dont le statut le permet, avec un motif. Le statut passe à `CANCELLED`, le chauffeur et le prix sont gardés, les offres ouvertes passent à `void`, les groupes `active` ou `paused` à `closed`, et un changement de destination `pending` à `expired`. Un événement garde `actor_kind`, l'auteur et le motif.
- **AC-24**: Une transition interdite, ou une réservation déjà changée par quelqu'un d'autre, est refusée avec `BOOKING_STATUS_CHANGED`. L'écran recharge l'état réel. Rien n'est écrit.
- **AC-25**: Renvoyer la même action avec le même `clientRequestId` n'agit qu'une fois, et répond comme la première.
- **AC-26**: Admin et support passent une réservation `COMPLETED` à `DISPUTED` avec un motif, et la rendent à `COMPLETED` avec une note. L'événement est `dispute_opened` ou `dispute_closed`. `completed_at` ne change pas.
- **AC-27**: Sur un paiement `disputed`, admin et support saisissent un montant retenu et un motif. Un montant supérieur au prix convenu est refusé avec `AMOUNT_ABOVE_AGREED`, et rien n'est écrit. Sinon, un `payment_event` `resolved` est ajouté, `declared_amount_ar` prend ce montant, et le statut devient `pending` à 0, `partial` s'il est inférieur au prix convenu, `paid` s'il lui est égal. Sur tout autre statut de paiement, c'est refusé.
- **AC-28**: L'équipe liste les signalements, filtrés par statut et par type. « Prendre en charge » passe `open` à `in_progress` et m'assigne. Deux personnes en même temps : une seule réussit, et l'autre voit `REPORT_STATUS_CHANGED`.
- **AC-29**: Sur un signalement, on peut ajouter une note, résoudre avec une note, rouvrir `resolved` avec une note, et clore `resolved`. `closed` est définitif. Chaque geste ajoute un `report_event` avec son auteur, et le détail affiche l'auteur du signalement, sa réservation et tout l'historique.

## Decision

`transitionBooking` est la seule écriture de `booking.status` côté serveur, dans `packages/api/src/domain/booking-status.ts`. Le premier construit, entre l'admin et la fonction 9, l'écrit.

## Feature design

**State transitions**:

Réservation : la table de la spec 0001, recopiée dans `booking-status.ts`. Depuis cet espace, seuls ces gestes sont proposés :

| Depuis | Vers | Geste |
|---|---|---|
| `PENDING`, `SEARCHING`, `OFFERED`, `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED`, `IN_PROGRESS` | `CANCELLED` | Annuler |
| `COMPLETED` | `DISPUTED` | Ouvrir un litige |
| `DISPUTED` | `COMPLETED` | Fermer le litige |

Signalement :

| Depuis | Vers | Geste | Note |
|---|---|---|---|
| `open` | `in_progress` | Prendre en charge | Facultative |
| `in_progress` | `resolved` | Résoudre | Obligatoire |
| `resolved` | `in_progress` | Rouvrir | Obligatoire |
| `resolved` | `closed` | Clore | Facultative |

Un `in_progress` peut être résolu ou annoté par n'importe quel membre de l'équipe. `assignee_id` indique qui suit, sans bloquer.

**Fonction partagée**:

```ts
transitionBooking(tx, {
  bookingId, to, actor: { actorKind, actorId },
  eventType, reasonCode?, reasonNote?, clientRequestId?,
}) // rend { booking, event, replayed: boolean }
```

1. Lire la réservation avec `FOR UPDATE`, ce qui fait attendre un double clic.
2. Si `clientRequestId` existe déjà pour cet `actorId` dans `booking_event`, rendre l'original avec `replayed: true`. Le statut rendu est `event.to_status`, et aucun effet n'est rejoué.
3. Si `(status, to)` n'est pas dans la table, lever `BOOKING_STATUS_CHANGED`.
4. Mettre à jour `status` et `status_changed_at`, puis ajouter l'événement.

`transitionBooking` ne crée jamais la ligne `payment` : c'est l'action de fin de course de la fonction 9 qui le fait, car fermer un litige repasse aussi à `COMPLETED`.

**Effets d'une annulation**, dans la même transaction, seulement si `replayed` est faux :
- Offres `sent`, `priced` ou `negotiating` : `void`.
- Groupes `active` ou `paused` : `closed`, avec `ended_at` à l'heure du serveur.
- Changement de destination `pending` : `expired`, plus un événement `destination_expired`, avec le même auteur et `client_request_id` vide (règle de 0001).

**Déroulé de `resolvePayment`**, dans une transaction :
1. Lire le paiement avec `FOR UPDATE`.
2. Si `clientRequestId` existe déjà pour cet auteur dans `payment_event`, rendre le statut calculé depuis `amount_ar` de cet événement et `agreed_amount_ar`, sans rien écrire.
3. Si le statut n'est pas `disputed`, lever `PAYMENT_NOT_DISPUTED`.
4. Si le montant dépasse `agreed_amount_ar`, lever `AMOUNT_ABOVE_AGREED`.
5. Ajouter l'événement `resolved`, puis mettre à jour `declared_amount_ar` et `status`.

**API surface**:

| Procédure | Type | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|---|
| `admin.bookings.list` | Query | `q?`, `status?`, `from?`, `to?`, `page` | `items` (id, statut, client, chauffeur, catégorie, prix, lieux, date), `total` | Équipe | |
| `admin.bookings.get` | Query | `bookingId` | `booking`, `client`, `driver?`, `vehicle?`, `places`, `category`, `settingsVersion`, `quotes` (tous, remplacés compris), `offers` avec leurs `proposals`, `destinationChanges`, `payment?` avec `paymentId` et ses `events`, `events` | Équipe | `NOT_FOUND` |
| `admin.bookings.cancel` | Mutation | `bookingId`, `reasonCode`, `reasonNote?`, `clientRequestId` | `status` | Équipe | `CONFLICT` `BOOKING_STATUS_CHANGED` |
| `admin.bookings.openDispute` | Mutation | `bookingId`, `reasonCode`, `reasonNote?`, `clientRequestId` | `status` | Équipe | `CONFLICT` |
| `admin.bookings.closeDispute` | Mutation | `bookingId`, `reasonNote`, `clientRequestId` | `status` | Équipe | `CONFLICT` |
| `admin.bookings.resolvePayment` | Mutation | `paymentId`, `retainedAmountAr` entier de 0 à 10 000 000, jamais au dessus du prix convenu, `reasonCode`, `reasonNote?`, `clientRequestId` | `status` | Équipe | `CONFLICT` `PAYMENT_NOT_DISPUTED`, `BAD_REQUEST` `AMOUNT_ABOVE_AGREED` |
| `admin.reports.list` | Query | `status?`, `typeCode?`, `page` | `items`, `total` | Équipe | |
| `admin.reports.get` | Query | `reportId` | Signalement, auteur, réservation si elle existe, assigné, événements | Équipe | `NOT_FOUND` |
| `admin.reports.take` | Mutation | `reportId`, `note?` | `status` | Équipe | `CONFLICT` `REPORT_STATUS_CHANGED` |
| `admin.reports.addNote` | Mutation | `reportId`, `note` | `eventId` | Équipe | `CONFLICT` si `closed` |
| `admin.reports.changeStatus` | Mutation | `reportId`, `to: resolved\|in_progress\|closed`, `note?` | `status` | Équipe | `BAD_REQUEST` note manquante, `CONFLICT` `REPORT_STATUS_CHANGED` |

Les motifs d'annulation viennent de `CANCELLATION_REASONS`. Un `reasonCode` inconnu est refusé.

Règles des signalements :
- `take` est le seul geste qui assigne et qui quitte `open`.
- `changeStatus` n'accepte que les trois gestes de la table, avec `UPDATE ... WHERE status = valeur lue`.
- Une réouverture garde l'assigné.
- Une note fait de 1 à 500 caractères.

**Value sourcing**:

| Action | Valeur | Source |
|---|---|---|
| Événement | `actor_kind`, `actor_id` | `actorFromSession` |
| Événement | `type` | `status_changed` pour une annulation, `dispute_opened`, `dispute_closed` |
| Liste | Client et chauffeur | `user.name`, `user.phone` par `client_id` et `driver_id` |
| Liste | Prix affiché | `agreed_price_ar`, sinon `amount_ar` du devis actif le plus bas, marqué « estimé », sinon « Non défini » |
| Liste, détail | Libellé d'un lieu | `landmark.name`, sinon `district.name`, sinon la note, sinon « Point sur la carte » (règle de 0001) |
| Liste, détail | Catégorie de course | `offer.category` de l'offre `accepted`. Sinon, la dernière `withdrawn`, si la réservation n'est pas repartie en recherche (`SEARCHING`, `OFFERED`). Sinon `requested_category` |
| Détail | Auteur d'un événement | `user.name` par `actor_id`, « Système » si `actor_kind = system` |
| Détail | Chauffeur simulé | `driver_profile.is_simulated` |
| Liste | Période | `from` et `to`, jours du fuseau `Indian/Antananarivo` appliqués sur `created_at` |
| Paiement | `amount_ar` du `resolved` | `retainedAmountAr` |
| Paiement | Montant déclaré d'origine | Dernier `payment_event` `declared` |
| Signalement | `assignee_id` | `ctx.session.user.id` |
| Signalement | `client_request_id` | Aucune action d'équipe n'en crée, cette colonne ne concerne que l'auteur du signalement |

**Key invariants**:
- Chaque changement de `booking.status` ajoute un `booking_event` dans la même transaction (0001).
- `driver_id`, `vehicle_id` et `agreed_price_ar` sont gardés après une annulation (0001).
- `payment.status` suit la règle de 0001, et n'est écrit que dans la transaction de son événement.
- Les journaux ne sont jamais modifiés.

**Security model**: toutes les procédures sont en `staffProcedure`. Une note libre peut contenir des données personnelles : elle reste visible de l'équipe seulement.

**Critical test scenarios**:
- Happy path : annuler une réservation `ACCEPTED` avec un motif, et voir l'événement et les offres mises à jour, verifies **AC-22**, **AC-23**.
- Failure case : deux annulations en même temps, une seule réussit, verifies **AC-24**.
- Failure case : même `clientRequestId` deux fois, un seul événement, verifies **AC-25**.
- Failure case : annuler une réservation `COMPLETED` est refusé, verifies **AC-24**.
- Litige : `COMPLETED` vers `DISPUTED` et retour, `completed_at` inchangé, verifies **AC-26**.
- Paiement : contesté, 2 000 Ar retenus sur 5 000 Ar donnent `partial`, `paid` à 5 000 Ar, et 5 001 Ar est refusé sans rien écrire, verifies **AC-27**.
- Signalement : deux `take` simultanés, une seule réussite, puis note, résolution, réouverture, clôture, et un `closed` refuse tout, verifies **AC-28**, **AC-29**.
- Liste : une réservation créée par le seed apparait en 10 s, verifies **AC-21**.

## Build plan

1. Tester `booking-status.ts` (créé à l'étape 6 du socle) avec `bun test` sur toute la table, et écrire `admin.bookings.list` et `get`, satisfies **AC-21**, **AC-22**, **AC-24**, **AC-25**
2. Construire `/admin/reservations`, son détail et sa chronologie, satisfies **AC-21**, **AC-22**
3. Ajouter `cancel`, `openDispute`, `closeDispute` et leurs fenêtres, satisfies **AC-23**, **AC-24**, **AC-25**, **AC-26**
4. Ajouter `resolvePayment` et son formulaire dans le détail, satisfies **AC-27**
5. Écrire `admin.reports` et les pages `/admin/signalements`, satisfies **AC-28**, **AC-29**

## Rationale

Une seule fonction de transition évite deux versions de la règle. Résoudre le paiement ici donne une issue au scénario G, sans écran à inventer pour la fonction 19, qui construit la contestation côté téléphone.
