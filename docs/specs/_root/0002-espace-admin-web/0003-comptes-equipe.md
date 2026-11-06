# Comptes, équipe et journal

## Summary

L'équipe consulte les clients, et un admin peut suspendre ou réactiver un compte, sauf pendant une course active. Un admin crée aussi les comptes de ses collègues et change leur rôle. Chacun de ces gestes laisse une trace, lisible dans le journal.

## Requirements

- **AC-14**: Admin et support listent les clients, 25 par page, avec une recherche sur nom, email ou téléphone, et un filtre sur les comptes suspendus. Le détail montre l'identité, l'état du compte et les 10 dernières réservations. Un identifiant qui n'est pas un compte `client` répond `NOT_FOUND`.
- **AC-15**: Un admin suspend un compte avec un motif et une note facultative. Le compte perd tout de suite sa session, ne peut plus se reconnecter, et une ligne `account.banned` existe dans `audit_log`. Un chauffeur suspendu passe hors ligne, indisponible, et ses offres ouvertes passent à `void`.
- **AC-16**: Suspendre un compte avec une course active est refusé. Rien ne change, et l'écran donne un lien vers cette réservation.
- **AC-17**: Un admin réactive un compte. Le compte peut se reconnecter, et une ligne `account.unbanned` existe. Un chauffeur réactivé reste hors ligne jusqu'à sa prochaine action. Réactiver un compte non suspendu est refusé.
- **AC-18**: Un admin crée un compte équipe avec nom, email, téléphone, rôle et mot de passe temporaire. La personne se connecte avec, et une ligne `team.created` existe, sans le mot de passe. Un téléphone mal formé, ou un email ou téléphone déjà utilisé, est refusé avec un message clair, même si deux créations arrivent ensemble.
- **AC-19**: Un admin fait passer un compte équipe de `admin` à `support` et inversement. Le droit change dès la requête suivante, et une ligne `team.role_changed` existe. Il ne peut pas changer son propre rôle, ni donner un autre rôle, ni toucher un compte qui n'est pas de l'équipe.
- **AC-20**: Un admin lit `/admin/journal` : auteur, action, cible, date, valeurs avant et après, du plus récent au plus ancien, avec un filtre par action. Un admin ne peut pas se suspendre lui même.

## Decision

Lecture par Drizzle et écriture par `auth.api`. Les routes HTTP du plugin sont fermées, donc ces procédures sont le seul chemin.

## Feature design

**API surface**:

| Procédure | Type | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|---|
| `admin.accounts.listClients` | Query | `q?`, `banned?`, `page` | `items` (`id`, `name`, `email`, `phone`, `banned`, `createdAt`), `total` | Équipe | |
| `admin.accounts.getClient` | Query | `userId`, filtré sur `role = 'client'` | Identité, `banned`, `banReason`, 10 réservations | Équipe | `NOT_FOUND` |
| `admin.accounts.ban` | Mutation | `userId`, `reasonCode`, `reasonNote?` | `{ ok: true }` ou `{ ok: false, code: "ACTIVE_RIDE", bookingId }` | admin | `BAD_REQUEST` soi même, `NOT_FOUND` |
| `admin.accounts.unban` | Mutation | `userId` | `{ ok: true }` | admin | `BAD_REQUEST` non suspendu, `NOT_FOUND` |
| `admin.team.list` | Query | `page` | Comptes `admin` et `support`, `banned` | admin | |
| `admin.team.create` | Mutation | `name`, `email`, `phone` E.164, `role`, `temporaryPassword` 8 à 128 | `{ id, auditWritten: boolean }` | admin | `BAD_REQUEST` téléphone, `CONFLICT` email ou téléphone |
| `admin.team.setRole` | Mutation | `userId`, `role: admin\|support` | `{ ok: true }` | admin | `BAD_REQUEST` soi même ou compte hors équipe |
| `admin.audit.list` | Query | `action?`, `page` | `items` avec nom de l'auteur, nom de la cible, `before`, `after`, `total` | admin | |

`ban` et `unban` servent aussi pour les chauffeurs et l'équipe, depuis leurs fiches. `/admin/equipe` regroupe création, rôle et suspension.

**Déroulé de `ban`**:
1. Refuser si `userId` est celui de l'admin. Lire le compte.
2. Si le compte est déjà suspendu : s'il existe une ligne `account.banned` plus récente que tout `account.unbanned`, rendre `{ ok: true }` sans rien écrire. Sinon, passer à l'étape 4, ce qui répare une suspension interrompue. L'écran affiche alors « Terminer la suspension » au lieu de « Réactiver ».
3. Chercher une course active, toujours sur les deux colonnes, car un compte peut avoir servi aux deux. Comme client : `client_id` avec un statut `PENDING`, `SEARCHING`, `OFFERED`, `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED` ou `IN_PROGRESS`. Comme chauffeur : `driver_id` avec `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED` ou `IN_PROGRESS`. Si oui, rendre `ACTIVE_RIDE` avec la plus récente.
4. `ctx.auth.api.banUser({ headers: ctx.headers, body: { userId, banReason } })`, avec `banReason` valant `code` ou `code: note`.
5. Dans une transaction : si un `driver_profile` existe, passer `is_online` et `is_available` à faux, et ses offres `sent`, `priced` ou `negotiating` à `void`. Écrire `audit_log`.

Si l'étape 5 échoue, l'écran affiche l'erreur, et « Terminer la suspension » reprend le travail. Dans ce cas, l'étape 4 est sautée, car le compte est déjà suspendu.

**Ordre des autres écritures** : l'appel à `auth.api` d'abord, puis la ligne d'audit.
- `unban` et `setRole` peuvent être rejoués. Si l'audit échoue, l'écran affiche l'erreur, et un nouvel essai réécrit la ligne.
- `team.create` ne peut pas être rejoué. Si l'audit échoue, il rend `auditWritten: false`, l'écran dit que le compte existe sans trace, et le serveur journalise l'erreur. Ce risque est accepté pour la démo.
- `team.create` et les scripts cherchent d'abord l'email et le téléphone, puis traduisent `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` et l'erreur d'index unique en `CONFLICT`.

**Value sourcing**:

| Action | Valeur | Source |
|---|---|---|
| Suspension | `before`, `after` | Valeurs lues à l'étape 1 (`{ banned, banReason }`), puis `{ banned: true, reasonCode, reasonNote }` |
| Réactivation | `before`, `after` | `{ banned: true, banReason }`, puis `{ banned: false }` |
| Création | `after` | `{ name, email, role }`, sans mot de passe |
| Changement de rôle | `before`, `after` | `{ role: ancien }`, `{ role: nouveau }` |
| Journal | `target_type`, `target_id` | `"user"`, `userId` |
| Journal | Auteur, cible | `user.name` par `actor_id` et par `target_id` |
| Fiche | Motif de suspension | `ban_reason`, coupé au premier `: ` en code et note |
| Création | `locale` | `fr`, valeur fixe |
| Création | `phone` | Entrée, contrôlée par `domain/phone.ts` |

**Key invariants**:
- Personne ne peut changer son propre rôle ou se suspendre. Si deux admins se retirent leurs droits au même instant, le secours est `admin:create`. Aucun verrou n'est ajouté pour ce cas.
- Aucun chemin n'écrit `user.banned` ou `user.role` directement.
- `client` et `driver` ne sont jamais transformés en `admin` ou `support`, ni l'inverse.

**Security model**: téléphone et email ne sont visibles que de l'équipe. Le mot de passe temporaire n'apparait dans aucun journal, et l'écran ne l'affiche plus après la création. La personne peut le changer sur `/admin/compte`. Toutes les écritures sont réservées à `admin`.

**Critical test scenarios**:
- Happy path : suspendre un client coupe sa session, puis la réactivation lui rend l'accès, verifies **AC-15**, **AC-17**.
- Failure case : suspendre un chauffeur en `IN_PROGRESS` répond `ACTIVE_RIDE` avec le lien, sans ligne d'audit, verifies **AC-16**.
- Failure case : deuxième téléphone identique à la création, message clair, verifies **AC-18**.
- Auth/permission : un admin qui change son propre rôle est refusé, verifies **AC-19**.
- Auth/permission : un support appelle `admin.accounts.ban`, reçoit `FORBIDDEN`, verifies **AC-4** de la spec Socle.
- Journal : chaque geste ci dessus apparait une fois, verifies **AC-20**.

## Build plan

1. Écrire `admin.accounts` en lecture et `/admin/clients` avec leurs pages, satisfies **AC-14**
2. Écrire `ban` et `unban` avec la garde et l'audit, et leurs fenêtres de confirmation, satisfies **AC-15**, **AC-16**, **AC-17**, **AC-20**
3. Écrire `admin.team` et `/admin/equipe`, satisfies **AC-18**, **AC-19**
4. Écrire `admin.audit.list` et `/admin/journal`, satisfies **AC-20**

## Rationale

Refuser pendant une course garde les deux gestes lourds séparés et volontaires : l'admin annule d'abord, puis suspend. Il reste une petite fenêtre entre le contrôle et `banUser`, acceptée pour la démo, car le support verrait une course sans chauffeur joignable et peut l'annuler.
