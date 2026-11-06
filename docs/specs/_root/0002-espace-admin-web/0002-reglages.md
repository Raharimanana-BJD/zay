# Réglages de tarifs et de distribution

## Summary

Un admin modifie tarifs et délais dans un seul formulaire. Chaque enregistrement crée une nouvelle version, après une comparaison et une note obligatoire, et les anciennes ne changent jamais. Les réservations en cours gardent leur version.

## Requirements

- **AC-10**: Un admin voit la version courante préremplie, change une valeur, voit anciennes et nouvelles valeurs, saisit une note, et enregistre. Une nouvelle `settings_version` et ses deux `category_fare` existent, avec son auteur, et les anciennes lignes sont intactes.
- **AC-11**: Une réservation existante garde sa `settings_version_id` et ses devis. La plus haute version s'applique aux nouvelles demandes.
- **AC-12**: Une valeur hors limites, un groupe minimum supérieur au maximum, une note vide, ou un enregistrement sans aucun changement sont refusés par le serveur, avec un message par champ. Rien n'est créé.
- **AC-13**: Si un autre admin a enregistré depuis l'ouverture du formulaire, le serveur refuse avec `SETTINGS_CHANGED`. L'écran le dit et propose de recharger. L'historique montre chaque version, son auteur, sa date, sa note et les valeurs modifiées.

## Decision

Formulaire unique, comparaison obligatoire et note requise. Pas de ligne `audit_log` : les versions sont déjà leur propre historique (spec 0001).

## Feature design

**Écran** : `/admin/reglages`, un seul bouton principal « Enregistrer », et l'historique en dessous. Le formulaire a trois blocs : Distribution, Négociation et GPS, puis un bloc par catégorie.

**Limites contrôlées par Zod dans `packages/api`** (entiers uniquement) :

| Champ | Min | Max |
|---|---|---|
| `priceVariationPct` | 0 | 100 |
| `groupMinDrivers` | 1 | `groupMaxDrivers` |
| `groupMaxDrivers` | 1 | 10 |
| `driverResponseS`, `clientResponseS`, `driverCounterResponseS` | 5 | 300 |
| `groupPauseS` | 0 | 60 |
| `maxGroups` | 1 | 10 |
| `gpsMaxAgeS` | 10 | 3600 |
| `baseFareAr`, `perKmAr` | 0 | 1 000 000 |
| `includedM` | 0 | 100 000 |
| `roundingAr` | 1 | 1 000 |
| `maxCapacity` | 1 | 20 |
| `changeNote` | 1 caractère | 500 caractères |

Baisser `maxCapacity` ne touche pas les véhicules existants. La règle de 0001 s'applique à la création ou la modification d'un véhicule. Le devis, lui, suit déjà la version de la réservation.

**API surface**:

| Procédure | Type | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|---|
| `admin.settings.current` | Query | | Version, valeurs, tarifs `car` et `tuk_tuk`, nom de l'auteur | admin | |
| `admin.settings.history` | Query | `page` | `items` avec valeurs complètes, tarifs et auteur, `total` | admin | |
| `admin.settings.create` | Mutation | `baseVersion`, valeurs, `fares.car`, `fares.tuk_tuk`, `changeNote` | `{ ok: true, id, version }` ou `{ ok: false, fieldErrors }`, ou `{ ok: false, code: "NO_CHANGE" }` | admin | `CONFLICT` `SETTINGS_CHANGED` |

Zod ne contrôle en entrée que la forme (des entiers et du texte). Les limites sont contrôlées dans la procédure, qui rend `fieldErrors` sous la forme `{ champ: message en français }`. Une transaction lit la plus haute version et la compare à `baseVersion`, puis écrit `version + 1` et les deux tarifs. Si deux admins écrivent ensemble, l'index unique sur `version` refuse le second, et cette erreur est rendue en `SETTINGS_CHANGED`.

**Value sourcing**:

| Action | Valeur | Source |
|---|---|---|
| Formulaire | Valeurs de départ | `admin.settings.current` |
| Création | `version` | Plus haute version + 1, sur le serveur |
| Création | `createdBy` | `ctx.session.user.id` |
| Comparaison | Anciennes valeurs | `admin.settings.current` chargé à l'ouverture |
| Historique | Valeurs modifiées | Comparaison dans le navigateur avec la version précédente de la liste. La plus ancienne d'une page charge aussi sa précédente, grâce à une ligne en plus demandée par le serveur |
| Historique | Auteur | `user.name` par `created_by`, « Système » si vide |

**Key invariants**: `settings_version` et `category_fare` ne sont jamais modifiés ni supprimés. Chaque version a exactement deux tarifs.

**Security model**: `adminProcedure` sur les trois procédures. Le support ne lit pas ces réglages.

**Critical test scenarios**:
- Happy path : modifier le tarif voiture crée la version 2 sans changer la version 1, verifies **AC-10**.
- Données : une réservation créée avant le changement garde sa version et son devis, verifies **AC-11**.
- Failure case : deux admins partent de la version 2, le second reçoit `SETTINGS_CHANGED`, verifies **AC-13**.
- Failure case : `groupMinDrivers` à 4 avec un maximum à 3 est refusé, verifies **AC-12**.
- Auth/permission : `admin.settings.current` appelé par un support reçoit `FORBIDDEN`, verifies **AC-4** de la spec Socle.

## Build plan

1. Écrire le routeur `admin` et `admin.settings` avec les limites Zod et la transaction, satisfies **AC-10**, **AC-11**, **AC-12**, **AC-13**
2. Construire `/admin/reglages` : formulaire, fenêtre de comparaison, messages par champ, conflit, satisfies **AC-10**, **AC-12**, **AC-13**
3. Construire l'historique paginé, satisfies **AC-13**

## Rationale

La comparaison protège d'une faute de frappe qui toucherait toutes les nouvelles demandes. Le `baseVersion` évite d'écraser sans le savoir le travail d'un collègue.
