# 0006. Raisonnement

## Context

Aujourd'hui, l'écran d'inscription demande « Client » ou « Chauffeur » avant même que le compte existe. Choisir chauffeur appelle `driver.register` juste après la vérification de l'email : le serveur crée un `driver_profile` en `pending` et passe `user.role` à `driver` tout de suite, avant toute validation. L'application ouvre alors l'espace chauffeur, où un compte non validé ne peut rien faire d'autre que remplir son dossier. Le même choix revient dans « Compléter mon profil » pour un compte Google (`me.completeProfile`).

Ce parcours pose trois problèmes. La personne doit décider de son rôle au moment où elle connaît le moins l'application. Un candidat chauffeur perd l'accès aux fonctions client pendant toute l'attente. Et le rôle est exclusif : `registerDriver` refuse un client qui a déjà une réservation (`CLIENT_HAS_BOOKINGS`), donc un client fidèle ne peut jamais devenir chauffeur, et un chauffeur ne peut pas commander de taxi.

Côté données, `driver_profile.verification_status` naît en `pending`, ce qui mélange « en cours de remplissage » et « envoyé, à juger ». L'équipe voit donc dans sa liste des dossiers vides, et `attachDocument` remet un dossier `changes_requested` en `pending` dès qu'une seule pièce arrive, avant que le candidat ait fini ses corrections.

La décision touche plusieurs couches à la fois : le schéma (`packages/db`), les gardes tRPC (`packages/api/src/index.ts`), la distribution (`domain/dispatch.ts` filtre sur `user.role = 'driver'`), la route d'envoi de fichiers (`apps/server/src/index.ts` réserve les pièces au rôle `driver`), la navigation mobile (`app/_layout.tsx`, `app/index.tsx`) et le back office. La démo du 9/11 repose sur le parcours actuel, qui marche.

## Options considered

### Option 1 : un compte, deux modes, capacité portée par `driver_profile`

`user.role` ne sert plus qu'à séparer clients et équipe. Le statut du `driver_profile` dit si la personne est chauffeur, et une colonne `active_mode` dit quel espace elle utilise. Le serveur contrôle les passages d'un mode à l'autre.

**Pros** :
- Une seule source de vérité, pas de rôle à synchroniser avec un statut.
- Le client garde son historique et peut devenir chauffeur à tout moment.
- Un chauffeur peut aussi commander une course sans second compte.

**Cons** :
- Chaque garde lit `driver_profile` en plus de la session.
- Toutes les lectures de `role === "driver"` changent d'un coup.
- Il faut des règles pour qu'un même compte ne soit jamais client et chauffeur sur la même course.

### Option 2 : rôle exclusif, changé à la validation

Même parcours d'inscription unique, mais à la validation le rôle passe de `client` à `driver`, et l'espace client se ferme pour ce compte.

**Pros** :
- Très proche du code actuel : les gardes sur `role` restent.
- Aucune règle de coexistence à écrire.

**Cons** :
- Le rôle et le statut disent la même chose et peuvent se contredire (suspension, rejet après coup).
- La règle `CLIENT_HAS_BOOKINGS` ou une perte d'historique client reste nécessaire.
- Un chauffeur qui veut prendre un taxi doit créer un second compte, avec un second téléphone.

### Option 3 : corriger sur place

Garder le choix à l'inscription, mais ne passer le rôle à `driver` qu'à la validation, et rendre l'espace client accessible pendant l'attente.

**Pros** :
- Le plus petit changement.

**Cons** :
- Ne répond pas à la demande : le choix reste au départ, et le rôle reste exclusif.

## Rationale

Le besoin exprimé est une transition fluide entre deux états d'une même personne, pas un changement d'identité. L'option 1 colle à ce besoin : le statut du dossier dit ce que la personne a le droit de faire, et `active_mode` dit ce qu'elle fait en ce moment. C'est aussi le seul modèle où « devenir chauffeur » ne coûte rien au client, ni son historique ni l'accès aux courses, ce qui est la raison même de passer par le profil plutôt que par l'inscription.

L'option 2 garde le code des gardes, mais elle double l'information dans deux colonnes, et c'est précisément ce genre de doublon qui finit incohérent après une suspension ou une correction manuelle. Elle garde aussi le problème des clients qui ont déjà roulé. L'option 3 ne change pas l'expérience demandée.

Le coût de l'option 1 est connu et borné : une lecture par clé primaire de plus par requête, et une liste finie d'endroits qui lisent `role === "driver"` (inventaire plus bas). Les règles de coexistence se réduisent à deux refus (`CLIENT_HAS_ACTIVE_BOOKING`, `DRIVER_BUSY`) et à un CHECK en base (`is_online` implique le mode chauffeur), ce qui empêche par construction un compte d'être sollicité pour sa propre demande.

Le statut `draft` explicite, plutôt qu'un `submitted_at` vide, garde la machine d'états lisible partout où elle est lue (back office, mobile, distribution). Il vit dans un enum propre au dossier (`driver_application_status`) et non dans `verification_status` partagé : `drizzle-kit migrate` passe toutes les migrations dans une seule transaction, où Postgres refuse d'utiliser une valeur ajoutée par `ADD VALUE`, alors qu'un type neuf s'utilise tout de suite. Les véhicules et les pièces ne peuvent ainsi jamais recevoir `draft`. Le mode et l'écran de bienvenue sont stockés côté serveur pour suivre le compte d'un téléphone à l'autre. Le rafraîchissement toutes les 5 s pendant l'attente suit la convention actuelle (pas de push) sans interroger le serveur toute la journée pour rien.

Construire après la démo : la refonte touche les gardes de toutes les actions chauffeur, et un oubli la veille casserait la course complète, qui est l'objet même de la démo.

## Inventaire des lectures du rôle chauffeur (2026-11-08)

| Fichier | Lecture | Devient |
|---|---|---|
| `packages/api/src/index.ts:57` et `:64` | `clientProcedure`, `driverProcedure` sur `role` | gardes par mode |
| `packages/api/src/domain/profile.ts:38` | `registerDriver`, `CLIENT_HAS_BOOKINGS`, `role = 'driver'` | supprimé, remplacé par `driver.apply` |
| `packages/api/src/routers/driver.ts:311` | `driver.register` | supprimé |
| `packages/api/src/routers/driver.ts:570` à `:787` | dossier, véhicules, pièces en `driverProcedure` | `dossierProcedure` |
| `packages/api/src/routers/driver.ts:787` | `attachDocument` remet `changes_requested` en `pending` | ne change plus le statut |
| `packages/api/src/routers/me.ts:62` | `completeProfile` avec `role` | sans rôle |
| `packages/api/src/domain/dispatch.ts:90` | `user.role = 'driver'` | `active_mode = 'driver'` |
| `packages/api/src/routers/admin/drivers.ts:58` | transitions, `changes_requested` vers `approved` | nouveau tableau |
| `packages/api/src/routers/admin/accounts.ts:116` | liste Clients sur `role = 'client'` | inclut les chauffeurs, avec badge |
| `apps/server/src/index.ts:96` | envoi de pièces réservé à `role = 'driver'` | lu sur `driver_profile` |
| `apps/native/app/_layout.tsx:102` et `:118` | garde des groupes sur `role` | garde sur `mode` |
| `apps/native/app/index.tsx:24` | redirection sur `role` | redirection sur `mode` |
| `apps/native/app/(auth)/inscription.tsx`, `verifier.tsx`, `components/complete-profile.tsx` | choix du rôle, relation | supprimés |
| `apps/server/scripts/seed-mobile.ts`, `seed-backoffice.ts`, `verify-data-model.ts`, `verify-mobile-flow.ts` | comptes en `role = 'driver'` | `role = 'client'` + dossier |
