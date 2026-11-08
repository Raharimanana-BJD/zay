# 0006. Inscription unique et passage au mode chauffeur

**Date**: 2026-11-08
**Status**: Proposed
**Remplace**: la ligne « Rôles (3) » de la spec [0003](../0003-application-mobile/index.md) (le reste de 0003 reste `Assumed`)

## Summary

Tout le monde s'inscrit avec le même formulaire et arrive dans l'espace client. Celui qui veut conduire passe par une carte « Devenir chauffeur » dans son profil, prépare son dossier (relation, véhicule, quatre pièces) puis l'envoie. Dès que l'équipe valide, l'application affiche un écran de bienvenue et ouvre le mode chauffeur. Une même personne garde ensuite les deux modes et passe de l'un à l'autre depuis son profil, comme une seule identité avec une capacité en plus, et non deux comptes.

À construire **après la démo du 9/11** : la démo garde le parcours actuel.

## Requirements

**User stories**:
- En tant que nouvel utilisateur, je veux m'inscrire sans choisir de rôle, pour commander une course tout de suite.
- En tant que client, je veux devenir chauffeur depuis mon profil, à mon rythme, sans perdre mon historique.
- En tant que candidat, je veux voir où en est mon dossier et savoir quoi corriger quand l'équipe me le demande.
- En tant que chauffeur validé, je veux passer du mode chauffeur au mode client, pour prendre moi aussi un taxi.
- En tant que membre de l'équipe, je veux ne juger que des dossiers envoyés, jamais un brouillon.

**Acceptance criteria**:
- **AC-1**: L'inscription par email et l'écran « Compléter mon profil » (Google) ne proposent plus de rôle. Tout nouveau compte a `user.role = 'client'`, aucun `driver_profile`, et arrive dans l'espace client.
- **AC-2**: Dans l'onglet Profil d'un client sans dossier, une carte « Devenir chauffeur » ouvre l'écran du dossier (`/devenir-chauffeur`). Le premier choix est la relation (propriétaire, locataire, salarié), qui crée le dossier en brouillon (`draft`).
- **AC-3**: L'écran du dossier montre trois cartes (Relation, Véhicule, Documents), chacune avec son état (à faire, fait, à corriger), une barre de progression, et le bouton « Envoyer mon dossier », actif seulement quand tout est là : une relation, au moins un véhicule non archivé avec photo et choisi comme véhicule actif, et une pièce courante pour chacun des quatre types (permis, identité, carte grise, assurance) qui n'est ni `rejected` ni `changes_requested`. Le serveur refuse un envoi incomplet avec `APPLICATION_INCOMPLETE` et la liste des manques.
- **AC-4**: L'envoi fait passer le dossier en `pending` et date `submitted_at`. La carte du profil affiche « En attente de validation » avec la date d'envoi. Le dossier devient en lecture seule, et toute écriture est refusée par le serveur avec `APPLICATION_LOCKED`.
- **AC-5**: Pendant le brouillon et l'attente, la personne garde toutes les fonctions client (commander, suivre, historique).
- **AC-6**: Dans le web, la liste des chauffeurs n'affiche jamais un brouillon. L'équipe ne décide sur un dossier (le chauffeur, ses véhicules, ses pièces) que s'il est `pending`, `approved` ou `suspended`. Passer de `changes_requested` à `approved` est refusé (`STATUS_CHANGED`) : il faut d'abord un nouvel envoi.
- **AC-7**: Quand l'équipe demande des corrections, la carte affiche « Corrections demandées » et le message de l'équipe, au plus 5 s après si l'application est ouverte. Le dossier redevient modifiable, les pièces à reprendre sont marquées « à corriger », et un nouvel envoi le remet en `pending`. Envoyer une nouvelle pièce ne remet plus le dossier en attente toute seule.
- **AC-8**: Quand l'équipe rejette, la carte affiche le motif et un bouton « Refaire une demande », qui remet le dossier en `draft` en gardant les pièces déjà envoyées.
- **AC-9**: En `draft` ou `rejected`, « Abandonner ma demande » (après confirmation) supprime le dossier, ses véhicules et ses pièces, et la carte redevient « Devenir chauffeur ». Le serveur refuse l'abandon dans tout autre état (`APPLICATION_SENT`).
- **AC-10**: Après la validation, au plus 5 s après si l'application est ouverte, un écran plein « Bienvenue, vous êtes chauffeur Zay » s'affiche une seule fois par compte. « Commencer » ouvre l'espace chauffeur, « Plus tard » reste en mode client. Si la personne a une réservation client en cours, l'écran attend qu'elle soit terminée ou annulée.
- **AC-11**: Un chauffeur validé change de mode par une carte de l'onglet Profil, dans les deux modes. Passer en mode chauffeur est refusé avec `CLIENT_HAS_ACTIVE_BOOKING` tant qu'une réservation client n'est pas terminée ou annulée. Passer en mode client met le chauffeur hors ligne et indisponible, sauf s'il a une course attribuée non terminée ou une offre ouverte : refus avec `DRIVER_BUSY`.
- **AC-12**: À l'ouverture, l'application affiche le dernier mode utilisé (`driver_profile.active_mode`), sur tout téléphone du compte. Sans réseau au démarrage, elle ouvre le dernier mode connu sur ce téléphone.
- **AC-13**: Le serveur ferme chaque mode : une action client en mode chauffeur et une action chauffeur hors du mode chauffeur validé sont refusées avec `MODE_NOT_ACTIVE`. La distribution ne sollicite que des chauffeurs `approved` en mode chauffeur, donc jamais pour leur propre demande.
- **AC-14**: Une suspension remet le compte en mode client, hors ligne. La carte affiche « Compte chauffeur suspendu » et le motif, sans bouton de changement de mode. Après réactivation, la carte propose de nouveau le mode chauffeur, sans nouvel écran de bienvenue.
- **AC-15**: Dans le web, la liste Clients montre aussi les chauffeurs, avec un badge portant l'état de leur dossier. Suspendre ce compte suspend la personne dans les deux modes.
- **AC-16**: Après la migration, les comptes chauffeurs existants marchent sans rien faire : `role = 'driver'` n'existe plus, un chauffeur validé ouvre l'application en mode chauffeur sans écran de bienvenue, un dossier en attente reste en attente.
- **AC-17**: Un client qui a déjà fait des courses peut devenir chauffeur (la règle `CLIENT_HAS_BOOKINGS` disparaît).
- **AC-18**: Tous les nouveaux textes et codes d'erreur existent en français et en malagasy.

## Decision

**Chosen option**: Option 1 : un seul compte, deux modes, la capacité chauffeur portée par `driver_profile`.

`user.role` ne distingue plus que client et équipe. Être chauffeur, c'est avoir un `driver_profile` `approved`, et le mode affiché est `driver_profile.active_mode`, contrôlé par le serveur.

**Implementation skills**: `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) · `expo-data-fetching` (`expo/skills`, `.agents/skills/expo-data-fetching/`) · `heroui-native` (`heroui-inc/heroui`, `.agents/skills/heroui-native/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Feature design

**Plateforme** : `apps/native` (Expo), `packages/api` (tRPC), `packages/db` (Drizzle), `apps/server` (route `/files`), `apps/web` (back office). Design : l'interface mobile actuelle (`Group`, `GroupRow`, fond crème, jaune Zay) et `Resource-zayapp/Zay App Redesign.pdf`.

**Data model sketch** (changements seulement) :

| Table | Colonne | Type | Règle |
|---|---|---|---|
| `user` (généré par Better Auth) | `role` | text | `client`, `admin` ou `support`. Plus jamais `driver`. Pas de changement de schéma |
| nouvel enum `driver_application_status` | `draft`, `pending`, `approved`, `rejected`, `changes_requested`, `suspended` | | propre à `driver_profile`. `verification_status` (véhicules, pièces, décisions) ne change pas, donc `draft` n'y est jamais valide |
| nouvel enum `app_mode` | `client`, `driver` | | |
| `driver_profile` | `verification_status` | `driver_application_status` (avant : `verification_status`) | converti par `USING verification_status::text::driver_application_status`, défaut **`draft`** (avant : `pending`) |
| `driver_profile` | `submitted_at` | timestamptz, nullable | posé à chaque envoi, vidé au retour en brouillon |
| `driver_profile` | `active_mode` | `app_mode`, not null, défaut `client` | `driver` seulement si `verification_status = 'approved'` (règle serveur) |
| `driver_profile` | `welcomed_at` | timestamptz, nullable | posé par l'écran de bienvenue |
| `driver_profile` | CHECK `driver_profile_online_requires_driver_mode` | | `NOT is_online OR active_mode = 'driver'` |
| `verification_decision` | inchangée | | son `reason_code` et son `reason_note` les plus récents (sujet `driver`) sont le message montré sur la carte |

Relations inchangées : `user 1 : 0..1 driver_profile`, `driver_profile 1 : N vehicle`, `driver_profile 1 : N driver_document`.

**State transitions** (`driver_profile.verification_status`) :

| De | Vers | Qui | Action |
|---|---|---|---|
| (aucun) | `draft` | le client | `driver.apply` |
| `draft`, `changes_requested` | `pending` | le candidat | `driver.submit` |
| `pending` | `approved`, `rejected`, `changes_requested` | admin | `admin.drivers.decide` |
| `rejected` | `draft` | le candidat | `driver.reapply` |
| `draft`, `rejected` | (supprimé) | le candidat | `driver.abandon` |
| `approved` | `suspended` | admin | `decide`, force `active_mode = 'client'`, hors ligne |
| `suspended` | `approved` | admin | `decide`, `active_mode` reste `client` |

Les transitions des véhicules et des pièces (`DOCUMENT_TRANSITIONS` dans `admin/drivers.ts`) ne changent pas : une pièce corrigée peut passer de `changes_requested` à `approved` pendant que le dossier est `pending`. Seule la ligne du sujet `driver` perd `changes_requested` vers `approved`.

`active_mode` : `client` → `driver` par `me.setMode` ou `me.welcome` (si `approved`, sans réservation client active). `driver` → `client` par `me.setMode` (si pas occupé) ou par une suspension.

**Procédures** (`packages/api/src/index.ts`, chacune lit la base à chaque requête) :
- `clientProcedure` : `completeProcedure` + `role = 'client'` + (pas de `driver_profile`, ou `active_mode = 'client'`). Sinon `MODE_NOT_ACTIVE`.
- `driverProcedure` : `completeProcedure` + `role = 'client'` + `verification_status = 'approved'` + `active_mode = 'driver'`. Sinon `MODE_NOT_ACTIVE`.
- `assignedDriverProcedure` (nouvelle, pour `driver.ride`, `advanceRide`, `withdraw`, `answerDestination`, `declarePayment`) : `completeProcedure` + le compte est le chauffeur attribué de la réservation demandée, quel que soit son mode ou son statut. Une course commencée se termine donc même si le chauffeur est suspendu ou banni pendant le trajet. `declarePayment` reste ouvert après `COMPLETED`, comme aujourd'hui.
- `me.report` reste en `completeProcedure` et marche dans les deux modes.
- `dossierProcedure` (nouvelle) : `completeProcedure` + `role = 'client'` + un `driver_profile` existe (sinon `DRIVER_NOT_REGISTERED`). Les écritures du dossier refusent `pending` et `rejected` avec `APPLICATION_LOCKED`.

**API surface** :

| Action | Type | Entrées | Sorties | Accès | Erreurs |
|---|---|---|---|---|---|
| `me.get` | query | | ajoute `mode: 'client' \| 'driver'`, `driver: null \| { status, submittedAt, decision: { reasonCode, reasonNote } \| null, showWelcome }` | protected | |
| `me.completeProfile` | mutation | `phone` (le champ `role` disparaît) | | protected | inchangées |
| `me.setMode` | mutation | `mode`, `requestId` | `mode` | complete | `DRIVER_NOT_APPROVED`, `CLIENT_HAS_ACTIVE_BOOKING`, `DRIVER_BUSY` |
| `me.welcome` | mutation | `mode` (`driver` pour Commencer, `client` pour Plus tard), `requestId` | `mode` | complete | comme `me.setMode` |
| `driver.apply` | mutation | `employmentRelation` | | complete, `role = 'client'` | `ROLE_NOT_ALLOWED` ; sans effet si le dossier existe |
| `driver.dossier` | query | | l'existant + `status`, `submittedAt`, `sections: { relation, vehicle, documents }` (chacune `todo \| done \| to_fix`), `missing: string[]`, `canSubmit`, `decision` | dossier | `DRIVER_NOT_REGISTERED` |
| `driver.submit` | mutation | `requestId` | `status` | dossier | `APPLICATION_INCOMPLETE` (le code seul : le téléphone affiche `driver.dossier.missing`), `STATUS_CHANGED` |
| `driver.reapply` | mutation | `requestId` | `status` | dossier | `STATUS_CHANGED`. Les pièces rejetées restent `rejected`, donc « à corriger » |
| `driver.abandon` | mutation | `requestId` | | dossier | `APPLICATION_SENT` ; `APPLICATION_HAS_HISTORY` si une `booking` ou une `offer` cite ce chauffeur |
| `driver.setRelation`, `saveVehicle`, `setActiveVehicle`, `attachDocument` | mutation | inchangées | inchangées | dossier (avant : driver) | + `APPLICATION_LOCKED` |
| `driver.home`, `setAvailability`, `updatePosition`, `answerOffer`, `ride`, `advanceRide`, `withdraw`, `answerDestination`, `declarePayment`, `history` | inchangées | | | driver (mode actif) | + `MODE_NOT_ACTIVE` |
| `driver.register` | supprimée | | | | |
| `POST /files/:kind` (`apps/server`) | HTTP | inchangées | | `avatar` : tout compte ; pièce et photo de véhicule : un `driver_profile` en `draft`, `changes_requested`, `approved` ou `suspended` | 403 |
| `admin.drivers.list` | query | `status` sans `draft` | exclut `draft` | staff | |
| `admin.drivers.get` | query | inchangées | | staff | 404 pour un dossier `draft` |
| `admin.drivers.decide` | mutation | inchangées | | admin | `APPLICATION_NOT_SUBMITTED` si le dossier est `draft`, `changes_requested` ou `rejected` ; `STATUS_CHANGED` si le dossier a bougé entre la lecture et le verrou |
| `admin.accounts.ban` | mutation | inchangées | | admin | met aussi `active_mode = 'client'` (aujourd'hui seulement hors ligne, `accounts.ts:240`) |
| `admin.accounts` (liste Clients) | query | | ajoute `driverStatus: status \| null` | staff | |

**Value sourcing** :

| Action | Valeur | Source |
|---|---|---|
| `me.get` | `mode` | `driver_profile.active_mode`, ou `client` sans `driver_profile` |
| `me.get` | `driver.status`, `submittedAt` | colonnes de `driver_profile` |
| `me.get` | `driver.decision` | dernière `verification_decision` du sujet `driver` pour ce compte, seulement si le statut est `changes_requested`, `rejected` ou `suspended` |
| `me.get` | `showWelcome` | `status = 'approved'` et `welcomed_at IS NULL` (la recherche de réservation ne tourne que dans ce cas) et aucune réservation client dans `IN_REQUEST` ou `ACTIVE_RIDE` (les mêmes listes que `ACTIVE_BOOKING_EXISTS` dans `client.ts`) |
| `driver.dossier` | `sections.relation` | `done` dès que le dossier existe (la relation est demandée par `driver.apply`) |
| `driver.dossier` | `sections.vehicle` | `done` : `active_vehicle_id` pointe un véhicule non archivé avec `photo_key` ; `to_fix` : ce véhicule est `rejected` ou `changes_requested` ; sinon `todo` |
| `driver.dossier` | `sections.documents` | pour chaque type de `DRIVER_DOCUMENT_TYPES`, la pièce où `replaced_at IS NULL` ; `to_fix` si l'une est `rejected` ou `changes_requested`, `done` si les quatre existent, sinon `todo` |
| `driver.dossier` | `missing` | codes stables : `NO_ACTIVE_VEHICLE`, `VEHICLE_PHOTO_MISSING`, `VEHICLE_TO_FIX`, `DOCUMENT_MISSING:<type>`, `DOCUMENT_TO_FIX:<type>` |
| `driver.dossier` | message d'une pièce ou d'un véhicule « à corriger » | sa dernière `verification_decision` (sujet `document` ou `vehicle`, `reason_code` et `reason_note`), affichée sous la pièce |
| `driver.dossier` | `canSubmit` | `missing` vide et statut `draft` ou `changes_requested` |
| `driver.submit` | `submitted_at` | heure du serveur |
| `me.setMode` vers client | « occupé » | une `booking` attribuée à ce chauffeur dans `ACTIVE_RIDE`, ou une `offer` de ce chauffeur dans `OPEN_OFFERS` non expirée |
| `me.setMode` vers chauffeur | « réservation client active » | une `booking` de ce client dans `IN_REQUEST` ou `ACTIVE_RIDE` |
| Écran du dossier | progression | nombre de sections `done` sur 3 |
| Démarrage hors ligne | dernier mode | copie de `me.get.mode` dans SecureStore, clé `zay.mode.<userId>`, écrite à chaque réponse de `me.get`, effacée à la déconnexion |
| Rafraîchissement | intervalle | 5 s quand `driver.status = 'pending'` et l'application au premier plan, sinon au retour au premier plan et au focus. Une réponse `MODE_NOT_ACTIVE` relance aussi `me.get`, puis le routage suit le nouveau mode |
| Liste Clients | `driverStatus` | `driver_profile.verification_status` par jointure gauche |

**Key invariants** :
- `user.role` ne vaut jamais `driver`. Le contrôle d'un rôle chauffeur passe toujours par `driver_profile`.
- `active_mode = 'driver'` implique `verification_status = 'approved'`. Toute écriture qui sort d'`approved` remet `active_mode = 'client'`, `is_online = false`, `is_available = false` dans la même transaction.
- `is_online` implique `active_mode = 'driver'` (CHECK en base).
- Le changement de mode, l'envoi, le retour en brouillon, l'abandon et `admin.drivers.decide` verrouillent la ligne `driver_profile` (`FOR UPDATE`) puis relisent le statut avant d'écrire. Les actions du candidat passent par `useAction` (un `requestId`), donc un double appui n'agit qu'une fois.
- `client.request` (création d'une réservation) verrouille aussi la ligne `driver_profile` du compte, si elle existe, et refuse avec `MODE_NOT_ACTIVE` si `active_mode = 'driver'`. Le passage en mode chauffeur et une nouvelle demande ne se croisent donc jamais.
- La distribution garde en plus le filtre `booking.client_id <> driver_profile.user_id`, par prudence.
- Une suspension ou un bannissement remet `active_mode = 'client'` et hors ligne, et annule les offres ouvertes, mais ne touche pas une course déjà attribuée : elle se termine par `assignedDriverProcedure`.
- `driver.abandon` supprime dans une seule transaction, dans cet ordre : `active_vehicle_id` à null, puis `driver_document`, `vehicle`, `driver_position`, `driver_profile` (toutes ces clés sont en `restrict`). Les lignes de `verification_decision` restent, comme historique.
- Seul le candidat fait passer un dossier en `pending`. Aucune autre écriture (pièce, véhicule) ne change le statut du dossier.
- Une réservation client active et le mode chauffeur ne coexistent jamais.

**Navigation** (`apps/native/app/`) :
- `_layout.tsx` choisit le groupe avec `mode` (de `me.get`, sinon la copie SecureStore `zay.mode.<userId>`, sinon `client`) : `(client)` si `client`, `(driver)` si `driver`. Le rôle sert seulement à écarter l'équipe (`StaffNotice`).
- Nouvelle pile `(client)/devenir-chauffeur/` : le hub et un écran par section, qui reprennent les blocs de `(driver)/(tabs)/dossier.tsx` et `components/documents-block.tsx` (à extraire en composants partagés).
- L'écran de bienvenue est un écran plein posé par `_layout.tsx` quand `showWelcome` est vrai, sur le modèle de `CompleteProfile`.
- `ProfileScreen` reçoit une carte `DriverCard`, une par état : rien, `draft` (« Reprendre ma demande », n/3), `pending`, `changes_requested` (message), `rejected` (motif, refaire, abandonner), `approved` (passer en mode chauffeur ou client), `suspended` (motif).
- L'onglet Dossier du mode chauffeur reste, pour ajouter un véhicule ou remplacer une pièce expirée.
- `(auth)/inscription.tsx`, `(auth)/verifier.tsx`, `components/complete-profile.tsx` et `index.tsx` perdent le choix du rôle et la relation. `RegisteringContext` disparaît s'il ne sert plus.

**Security model** :
- Un client ne lit et n'écrit que son propre dossier (l'identifiant vient toujours de la session).
- L'équipe (`admin`, `support`) ne peut pas avoir de dossier chauffeur (`driver.apply` refuse avec `ROLE_NOT_ALLOWED`).
- Seul `admin` décide sur un dossier, comme aujourd'hui. `support` lit la liste.
- Les pièces (`up-doc-*`) restent lisibles par l'équipe seulement. Un brouillon abandonné supprime ses lignes, et les fichiers déjà sur le disque restent (voir Follow-up).
- Données personnelles : permis, pièce d'identité. Pas de nouvelle exposition par rapport à la spec 0005 ; l'historique des décisions reste.

**Configuration required** : aucune nouvelle variable.

**Critical test scenarios** :
- Parcours complet : inscription, carte, relation, véhicule, quatre pièces, envoi, validation dans le web, écran de bienvenue, Commencer, demande reçue en ligne. Vérifie **AC-1** à **AC-4**, **AC-10**, **AC-13**
- Envoi incomplet refusé avec la bonne liste `missing`, et écriture en `pending` refusée. Vérifie **AC-3**, **AC-4**
- Corrections : message visible, pièce remplacée sans remise en attente automatique, nouvel envoi, et approbation refusée depuis `changes_requested`. Vérifie **AC-6**, **AC-7**
- Rejet puis Refaire une demande, et abandon refusé en `pending`. Vérifie **AC-8**, **AC-9**
- Changement de mode : refus avec une réservation client active, refus `DRIVER_BUSY` avec une offre ouverte, passage hors ligne sinon. Vérifie **AC-11**
- Fermeture des modes : `client.*` appelé en mode chauffeur et `driver.home` appelé en mode client répondent `MODE_NOT_ACTIVE`. Vérifie **AC-13**
- Suspension d'un chauffeur en ligne : hors ligne, mode client, carte suspendue. Suspension pendant une course attribuée : la course se termine et le paiement se déclare. Vérifie **AC-14**
- Courses croisées : passage en mode chauffeur et nouvelle demande client envoyés en même temps, une seule réussit. Vérifie **AC-11**, **AC-13**
- Abandon d'un brouillon avec véhicule actif et pièces : tout est supprimé sans erreur de clé. Vérifie **AC-9**
- Migration sur une copie des données de démo : chauffeur validé en mode chauffeur, plus aucun `role = 'driver'`. Vérifie **AC-16**

## Build plan

Approche Tracer Bullet : la tranche 1 fait passer un vrai candidat de l'inscription au mode chauffeur, puis les tranches suivantes ajoutent les cas d'erreur, l'équipe et la finition.

1. Une migration : créer `driver_application_status` et `app_mode`, convertir la colonne, ajouter `submitted_at`, `active_mode`, `welcomed_at`, migrer les données (voir Migration plan), puis poser le CHECK. Un nouveau type, contrairement à `ALTER TYPE ... ADD VALUE`, s'utilise dans la même transaction, et `drizzle-kit migrate` passe toutes les migrations en attente dans une seule. Tester `db:migrate` sur une base vide et sur une copie des données de démo. Satisfies **AC-16**
2. Serveur, fil principal : les trois procédures par mode, `me.get` (`mode`, `driver`), `driver.apply`, `driver.submit`, `me.setMode`, `me.welcome`, le dossier ouvert à `dossierProcedure`, la route `/files` lue sur `driver_profile`, la distribution filtrée sur `active_mode`, la suppression de `driver.register`, de `registerDriver` et de `CLIENT_HAS_BOOKINGS`, et `me.completeProfile` sans rôle. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-11**, **AC-13**, **AC-17**
3. Mobile, fil principal : inscription et complétion sans rôle, routage par `mode`, carte du profil, pile `devenir-chauffeur` avec les blocs extraits de l'onglet Dossier, écran de bienvenue, `me.get` toutes les 5 s en attente et au retour au premier plan. Satisfies **AC-1** à **AC-5**, **AC-10**, **AC-12**
4. Équipe : la liste et le détail cachent les brouillons, filtres et libellés de statut du web sans `draft`, `decide` verrouille, suit le nouveau tableau et refuse les dossiers non envoyés, suspension et bannissement remettent en mode client hors ligne, `assignedDriverProcedure` pour finir une course en cours, `attachDocument` ne remet plus en attente, badge dans la liste Clients. Satisfies **AC-6**, **AC-13**, **AC-14**, **AC-15**
5. Cas de retour : message des corrections, sections « à corriger », `driver.reapply`, `driver.abandon` avec confirmation, refus `DRIVER_BUSY` et `CLIENT_HAS_ACTIVE_BOOKING` affichés sur la carte. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-11**
6. Finition : copie du mode dans SecureStore pour le démarrage hors ligne, textes et codes `errors.*` en `fr` et `mg`, `seed-mobile`, `seed-backoffice`, `verify-mobile-flow` et `verify-data-model` mis à jour (chauffeurs, simulés compris, en `role = 'client'` avec dossier `approved`, `active_mode = 'driver'` et `welcomed_at` posé). Satisfies **AC-12**, **AC-16**, **AC-18**

## Migration plan

**Strategy** : une seule mise en production (une migration, un déploiement), car la démo reste sur l'ancien parcours et la base de démo se recharge.
**Phases** :
1. `CREATE TYPE driver_application_status`, `CREATE TYPE app_mode`, puis `ALTER COLUMN verification_status TYPE driver_application_status USING verification_status::text::driver_application_status`.
2. Ensuite, dans l'ordre : ajouter les trois colonnes ; `active_mode = 'driver'` et `welcomed_at = now()` pour les dossiers `approved` ; `welcomed_at = now()` pour les dossiers `suspended` ; `submitted_at = updated_at` pour `pending` et `changes_requested` ; `is_online = false, is_available = false` pour tout dossier qui n'est pas en mode chauffeur ; `UPDATE "user" SET role = 'client' WHERE role = 'driver'` ; nouveau défaut `draft` ; enfin le CHECK.
3. Déployer serveur et application ensemble. Une ancienne application qui appelle `driver.register` reçoit une erreur, ce qui est acceptable sans store public.
**Rollback** : revenir au commit précédent et lancer une migration inverse qui supprime les brouillons (même ordre que `driver.abandon`), remet `role = 'driver'` sur tout compte avec un `driver_profile`, retire le CHECK et les trois colonnes, et reconvertit la colonne en `verification_status`.
**Risks** : un compte qui avait `role = 'driver'` sans `driver_profile` (données de test cassées) deviendrait un simple client, ce qui est le bon résultat. Vérifier avant la migration qu'aucun chauffeur n'est en course.

## Consequences

**Positive** :
- Une seule porte d'entrée, et l'inscription ne demande plus une décision que la personne n'a pas encore prise.
- Une seule source de vérité pour « est chauffeur » : `driver_profile`. La règle `CLIENT_HAS_BOOKINGS` et le changement de rôle disparaissent.
- L'équipe ne voit plus de dossiers à moitié remplis, et ne valide jamais une version qu'elle n'a pas relue.

**Negative / tradeoffs** :
- `clientProcedure` et `driverProcedure` lisent maintenant `driver_profile` à chaque requête (une lecture par clé primaire de plus).
- Toutes les lectures de `role === "driver"` changent en même temps (serveur, distribution, route `/files`, mobile, scripts) : un oubli donne un `MODE_NOT_ACTIVE` difficile à comprendre.
- Le mobile interroge `me.get` toutes les 5 s pendant l'attente, faute de notifications push.
- Un candidat refusé peut renvoyer sans limite, ce qui peut charger l'équipe.

**Neutral** :
- La spec 0003 perd sa ligne « Rôles (3) ». La ligne « Navigation (3) » reste vraie (trois groupes, `Stack.Protected`), avec un garde sur le mode au lieu du rôle.
- La liste Clients du web inclut désormais les chauffeurs.

## Follow-up

- [x] Dans la spec 0003, marquer la ligne « Rôles (3) » comme remplacée par 0006.
- [ ] Nettoyer les fichiers d'un dossier abandonné sur le disque du serveur (`apps/server/uploads/`), aujourd'hui laissés en place (Deferred du scope).
- [ ] Notifications push pour la validation, quand un projet Firebase existera (fonction 4 du scope).
- [ ] Limiter le nombre de nouvelles demandes après rejet si l'équipe en reçoit trop (Deferred du scope).
- [ ] La description de la fonction 3 du scope parle encore du « choix du rôle à l'inscription » : `/scope` peut la reformuler.
