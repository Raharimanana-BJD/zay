# Statistiques

## Summary

La page d'accueil de `/admin` montre les chiffres essentiels et l'évolution des réservations, à partir des vraies données et sans table de calcul. La période se choisit, et un filtre retire les chauffeurs simulés.

## Requirements

- **AC-37**: Admin et support voient, pour Aujourd'hui, 7 ou 30 jours : réservations créées, courses terminées, annulations, recherches sans chauffeur, offres envoyées. Et à l'instant présent : courses actives, chauffeurs en ligne, signalements ouverts, dossiers en attente. Les chiffres correspondent à une lecture directe des tables.
- **AC-38**: Une courbe montre les réservations créées et les courses terminées sur la période, par heure pour Aujourd'hui (les 24 heures) et par jour sinon, découpées dans le fuseau `Indian/Antananarivo`, sans trou pour une période vide. Des barres montrent les annulations par motif, avec une valeur lisible sans survoler.
- **AC-39**: « Inclure les chauffeurs simulés », activé par défaut, retire une fois désactivé les courses terminées, les offres, les courses actives et les chauffeurs en ligne qui les concernent. Les autres chiffres et les barres ne changent pas.
- **AC-40**: Sans aucune donnée, la page affiche des zéros et un message clair, pas une courbe cassée. Les chiffres se rafraîchissent toutes les 10 s, et une erreur propose de réessayer.

## Decision

Une seule requête `admin.dashboard.stats`, calculée à la lecture. La courbe utilise le composant `chart` de shadcn sur Recharts, avec les jetons `--chart-*`.

## Feature design

**API surface**:

| Procédure | Type | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|---|
| `admin.dashboard.stats` | Query | `period: today\|7d\|30d`, `includeSimulated: boolean` | `totals`, `now`, `series: { bucket, created, completed }[]`, `cancellationsByReason` | Équipe | |

**Value sourcing**:

| Valeur | Source |
|---|---|
| Début de période | Minuit dans `Indian/Antananarivo`, aujourd'hui, ou 6 ou 29 jours avant. Calculé sur le serveur |
| Réservations créées | `booking` où `created_at` est dans la période |
| Courses terminées | `booking` où `completed_at` est dans la période, statut `COMPLETED` ou `DISPUTED` |
| Annulations et motifs | `booking_event` où `to_status = CANCELLED` et `created_at` dans la période. `reason_code` nul devient « Sans motif » |
| Recherches sans chauffeur | `booking_event` où `to_status = NO_DRIVER_FOUND` et `created_at` dans la période |
| Offres envoyées | `offer` où `created_at` est dans la période |
| Courses actives | `booking` en `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED` ou `IN_PROGRESS` |
| Chauffeurs en ligne | `driver_profile.is_online` |
| Signalements ouverts | `report` en `open` ou `in_progress` |
| Dossiers en attente | `driver_profile` en `pending` ou `changes_requested` |
| Découpage | `date_trunc` dans le fuseau `Indian/Antananarivo`, sur `created_at` pour `created` et sur `completed_at` pour `completed`, puis `generate_series` jusqu'à la fin de la période pour combler les vides |
| Filtre simulé | Jointure `driver_profile.is_simulated` par `booking.driver_id` ou `offer.driver_id`, seulement sur les quatre mesures d'AC-39 |

**Écran**: tuiles en 2 rangées (`card-soft-tinted`, chiffre en 36 px), onglets pilule pour la période, courbe en noir pour les réservations et en gris `#5e5e5e` avec tirets pour les courses terminées, légende directe, et barres horizontales. La courbe a une alternative texte, avec le total de chaque série.

**Key invariants**: aucun chiffre stocké. Cette page n'écrit rien.

**Security model**: `staffProcedure`, chiffres agrégés seulement, sans donnée personnelle.

**Critical test scenarios**:
- Happy path : avec le seed, chaque tuile correspond à un comptage SQL direct sur les 30 jours, verifies **AC-37**.
- Fuseau : une réservation créée à 22 h UTC tombe sur le jour suivant à Toliara, verifies **AC-38**.
- Filtre : retirer les simulés baisse les courses terminées de celles de ce chauffeur, verifies **AC-39**.
- Failure case : sur une base sans réservation, la page affiche zéros et message, verifies **AC-40**.

## Build plan

1. Écrire `admin.dashboard.stats`, satisfies **AC-37**, **AC-38**, **AC-39**
2. Construire `/admin` : tuiles, période, filtre et états, satisfies **AC-37**, **AC-39**, **AC-40**
3. Ajouter `chart` de shadcn dans `packages/ui`, puis la courbe et les barres, satisfies **AC-38**

## Rationale

Calculer à la lecture reste juste sans tâche de fond, et largement assez rapide au volume de la démo. Les courbes sont le premier élément à couper si le temps manque, car les tuiles portent déjà le « Done when » de la fonction 27.
