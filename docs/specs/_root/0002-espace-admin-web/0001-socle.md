# Socle de l'espace admin

## Summary

Ce socle ferme le web à tout ce qui n'est pas l'équipe, verrouille les routes sensibles de Better Auth, et pose la coquille et le design commun. Il crée aussi le premier admin et les données de test. Sans lui, aucun module ne peut démarrer.

## Requirements

- **AC-1**: `/` redirige vers `/admin`. Sans session, `/admin` et ses sous pages redirigent vers `/login`. Après connexion, on arrive sur `/admin`.
- **AC-2**: Un compte `client` ou `driver` connecté sur `/admin` voit un écran « Accès réservé à l'équipe » avec un bouton de déconnexion, et aucune donnée. Le web n'a plus de formulaire d'inscription, ni `/dashboard`.
- **AC-3**: Un appel HTTP direct à n'importe quelle route `/api/auth/admin/*` répond 404, même pour un admin. Les appels serveur `auth.api.*` continuent de marcher.
- **AC-4**: Une procédure `staffProcedure` appelée par un `client` ou un `driver` répond `FORBIDDEN`. Une procédure `adminProcedure` appelée par un `support` répond `FORBIDDEN`, même si l'interface a été contournée.
- **AC-5**: Un `support` ne voit pas Réglages, Équipe et Journal dans le menu. S'il ouvre leur adresse, il voit « Page réservée aux administrateurs » et aucune donnée.
- **AC-6**: `bun run admin:create` crée un admin capable de se connecter, avec un mot de passe haché, en demandant le mot de passe sans l'accepter en argument. Il refuse un téléphone mal formé, ou un email ou téléphone déjà utilisé, sans rien modifier.
- **AC-7**: Le web respecte les jetons ci dessous : fond blanc, boutons principaux noirs en pilule, cartes à 16 px, police Inter, aucun rouge hors danger et erreurs. Le logo et le favicon sont ceux de Zay. Aucun nom, logo, police ou illustration d'Uber n'apparait, ni dans le code ni dans les fichiers servis.
- **AC-8**: `seed:backoffice` remplit une base migrée et vide avec les données listées ci dessous, sans violer aucune contrainte. Relancé tel quel, il s'arrête sans rien changer. `--reset --yes` efface les données d'exploitation et les comptes, garde la version 1 des réglages et les lieux, et ne recrée rien. Il refuse d'agir si un compte hors `@zay.test` existe.
- **AC-9**: L'application mobile utilise les images Zay pour l'icône, le splash et le favicon. Le logo reste visible en mode sombre sur le splash. L'identifiant du paquet ne change pas.

## Decision

Une mise en page `/admin` en `ssr: false`, comme le `_auth` actuel, garde l'accès dans le navigateur, et le serveur contrôle toujours chaque appel.

## Feature design

**Routes web**

| Adresse | Rôle | Module |
|---|---|---|
| `/` | Public | Redirection vers `/admin` |
| `/login` | Public | Connexion seule |
| `/admin` | Équipe | Tableau de bord |
| `/admin/reservations`, `/admin/reservations/$bookingId` | Équipe | Supervision |
| `/admin/signalements`, `/admin/signalements/$reportId` | Équipe | Signalements |
| `/admin/chauffeurs`, `/admin/chauffeurs/$driverId` | Équipe | Dossiers |
| `/admin/clients`, `/admin/clients/$clientId` | Équipe | Comptes |
| `/admin/compte` | Équipe | Mon compte |
| `/admin/equipe`, `/admin/reglages`, `/admin/journal` | Admin | Sensible |

À retirer : `routes/_auth/`, `components/header.tsx`, `components/sign-up-form.tsx`, le contenu de `routes/index.tsx`, `functions/get-user.ts` et `middleware/auth.ts` s'ils ne servent plus.

`routes/__root.tsx` : `lang="fr"`, sans `className="dark"`, titre « Zay Admin », favicon, et outils de développement seulement avec `import.meta.env.DEV`.

**Coquille** : composant `sidebar` de shadcn, qui devient un menu sous 768 px. Le logo est en haut. Une ligne active porte une barre noire à gauche (`ex-app-shell-row`). En bas : nom, rôle, déconnexion. Les tableaux défilent dans leur propre conteneur sur petit écran.

**Serveur**

| Procédure ou route | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|
| `POST /api/auth/sign-in/email` (existant) | email, mot de passe | session, `user.role` | Public | Identifiants faux, `BANNED_USER` affiché « Compte suspendu » |
| `POST /api/auth/change-password` (existant) | `currentPassword`, `newPassword`, `revokeOtherSessions: true` | ok | Connecté | Mot de passe actuel faux |
| Toutes les `/api/auth/admin/*` | | 404 | Personne | |

`packages/auth/src/index.ts` : `disabledPaths` reçoit toutes les routes `/admin/*` du plugin : `ban-user`, `create-user`, `get-user`, `has-permission`, `impersonate-user`, `list-user-sessions`, `list-users`, `remove-user`, `revoke-user-session`, `revoke-user-sessions`, `set-role`, `set-user-password`, `stop-impersonating`, `unban-user`, `update-user`. Aucun `adminClient` sur le web. `inferAdditionalFields` du web reçoit `role`.

**Jetons de design** : à poser dans `packages/ui/src/styles/globals.css`, seule source pour le web. Le bloc `.dark` n'est plus utilisé par le web.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--background`, `--card`, `--popover` | `#ffffff` | Fonds |
| `--foreground`, `--primary` | `#000000` | Texte, bouton principal |
| `--primary-foreground` | `#ffffff` | Texte sur noir |
| `--secondary`, `--muted`, `--accent`, `--input` | `#efefef` | Boutons discrets, champs, survol |
| `--muted-foreground` | `#5e5e5e` | Texte secondaire, indications de champ |
| `--border` | `#e2e2e2` | Séparateurs |
| `--ring` | `#000000` | Focus visible |
| `--destructive` | `#b91c1c` | Danger et erreurs, seule couleur |
| `--chart-1`, `--chart-2`, `--chart-3` | `#000000`, `#5e5e5e`, `#afafaf` | Séries de courbes |
| `--sidebar` et dérivés | Mêmes valeurs que ci dessus | Barre latérale |

| Forme | Règle |
|---|---|
| Boutons, pastilles, onglets | Pilule `rounded-full` |
| Cartes, fenêtres, messages | 16 px, sans ombre par défaut. Une fenêtre porte `rgba(0,0,0,0.16) 0 4px 16px` |
| Champs | Fond `#efefef`, 8 px, sans bordure visible, focus noir |
| Tableaux | En tête `#efefef` en 14 px graisse 500, cellules 14 px, lignes séparées par `#e2e2e2` |
| Titres | Inter 700, sans capitales forcées ni espacement ajouté : 36 px page, 24 px carte |
| Texte | Inter 400 et 500, 14 ou 16 px |

Une seule action principale noire par écran. Une action dangereuse est un bouton pilule rouge, précédé d'une fenêtre de confirmation.

**Pastilles de statut** : noir plein pour ce qui est en cours, gris clair pour ce qui attend ou est terminé, contour pour le neutre, rouge pour le problème. Une icône lucide accompagne toujours le libellé, car la couleur seule ne suffit pas.

| Pastille | `booking_status` | `verification_status` | `report_status` | `payment_status` |
|---|---|---|---|---|
| Noir | `SEARCHING`, `OFFERED`, `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED`, `IN_PROGRESS` | `approved` | `in_progress` | `paid` |
| Gris | `PENDING`, `COMPLETED` | `pending`, `changes_requested` | `open`, `resolved` | `pending`, `partial` |
| Contour | `CANCELLED`, `EXPIRED` | | `closed` | |
| Rouge | `NO_DRIVER_FOUND`, `DISPUTED` | `rejected`, `suspended` | | `disputed` |

**Images** : `assets/` à la racine reste la source.

| Source | Destination | Usage |
|---|---|---|
| `logo.png` | `apps/web/public/logo.png` | Coquille, page de connexion |
| `favicon.png` | `apps/web/public/favicon.png` | Lien `icon` du `<head>` |
| `logo.png` | `apps/native/assets/images/logo.png` | `expo.icon` et Android `adaptiveIcon.foregroundImage` et `monochromeImage` |
| `splash-icon.png` | `apps/native/assets/images/splash-icon.png` | Remplace l'image de départ |
| `favicon.png` | `apps/native/assets/images/favicon.png` | Remplace l'image de départ |
| `notification-icon.png` | `apps/native/assets/images/notification-icon.png` | En attente de la fonction 4 |

`apps/native/app.json` : `name` vaut `Zay`. `adaptiveIcon.backgroundColor` vaut `#ffffff`, sans `backgroundImage`. Le bloc `dark` du splash passe à `backgroundColor: "#ffffff"`, car le logo noir serait invisible sur le noir actuel. Ne pas toucher `scheme`, `package`, ni `bundleIdentifier`. Ces changements demandent une nouvelle compilation Android.

**Script `admin:create`** : dans `apps/server/scripts/create-admin.ts`, sur le modèle de `db:verify`. Arguments `--email`, `--name`, `--phone`. Le mot de passe se lit par `prompt()`, avec au moins 8 caractères. Il contrôle le téléphone avec `domain/phone.ts`, et cherche d'abord si l'email ou le téléphone existe. Il appelle `auth.api.createUser({ body: { email, password, name, role: "admin", data: { phone, locale: "fr" } } })`, sans session.

**Script `seed:backoffice`** : dans `apps/server/scripts/seed-backoffice.ts`. Tous les emails finissent par `@zay.test`. Il s'arrête si `admin@zay.test` existe.

| Donnée | Contenu |
|---|---|
| Équipe | `admin@zay.test`, `support@zay.test` |
| Mot de passe | Un seul, lu par `prompt()`, pour tous les comptes du seed, afin de tester une connexion ou une suspension |
| Clients | 5, dont un suspendu, créé avec `createUser` et `data: { banned: true, banReason: "fraud" }`, car `banUser` exige une session |
| Chauffeurs | 9, voir la table ci dessous, avec véhicules voiture et tuk-tuk et `driver_position` |
| Réservations | 41 sur 30 jours, voir la table ci dessous, avec devis, groupes, offres, propositions et événements cohérents |
| Paiements | Un par réservation `COMPLETED` ou `DISPUTED` |
| Signalements | Un par statut lié à une réservation, plus un sans réservation |
| Réglages | Une version 2, créée par l'admin de test |
| Fichiers | Trois images marquées « SPÉCIMEN » dans `apps/server/seed-files/`, avec les clés `seed-*.png`. Aucune vraie pièce d'identité |

| Chauffeur | Statut | Documents |
|---|---|---|
| 1 | `pending` | Tout en `pending` |
| 2 | `pending` | Pièces personnelles approuvées, dont une expirée (AC-33) |
| 3 | `changes_requested` | Une pièce en `changes_requested` |
| 4, 5, 6 | `approved` | Tout approuvé. Chacun a une course active |
| 7 | `approved`, `is_simulated` | Tout approuvé. A une course active et 4 courses terminées |
| 8 | `suspended` | Approuvés, dont une pièce expirée (AC-35) |
| 9 | `approved`, en ligne et disponible | Tout approuvé. Porte l'offre ouverte de la réservation `OFFERED` (AC-34) |

| Statut | Nombre | Détail |
|---|---|---|
| `PENDING`, `SEARCHING`, `OFFERED` | 1 de chaque | Récentes |
| `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED`, `IN_PROGRESS` | 1 de chaque | Chauffeurs 4, 5, 6 et 7 |
| `COMPLETED` | 18 | Dont 3 du jour. Paiements : 12 `paid`, 3 `partial`, 2 `pending`, 1 `disputed` |
| `DISPUTED` | 1 | Paiement `paid` |
| `CANCELLED` | 10 | Tous les motifs de `CANCELLATION_REASONS`, dont 2 du jour |
| `EXPIRED` | 2 | |
| `NO_DRIVER_FOUND` | 3 | Dont 1 du jour |

Les dates du jour sont calculées au lancement, dans le fuseau `Indian/Antananarivo`.

`--reset --yes` efface dans l'ordre des clés étrangères, dans une transaction : toutes les données d'exploitation, les comptes, et les réglages de version supérieure à 1. Il garde `district`, `landmark` et `service_zone`. Sans `--yes`, ou si un compte hors `@zay.test` existe, il refuse sans rien effacer. Pour repartir de zéro, tu lances `--reset --yes`, puis de nouveau le seed. Le simulateur et la fonction 29 peuvent le réutiliser. Le seed lit les statuts, tarifs et formules de `@zay-app/api/domain/*`.

**Value sourcing**:

| Action | Valeur | Source |
|---|---|---|
| Garde `/admin` | Rôle | `authClient.getSession()`, `user.role` |
| Coquille | Nom, rôle | Contexte de la route `/admin` |
| Menu | Entrées visibles | `user.role`, confirmé par le serveur à chaque appel |
| Procédures | Droits | `ctx.session.user.role`, relu en base à chaque requête car aucun cache de cookie n'est configuré |
| Mon compte | Nom, email, téléphone | Session |
| `admin:create` | Mot de passe | `prompt()` |

**Key invariants**:
- Un rôle n'entre jamais par un champ public.
- Toute route admin de Better Auth est fermée sur HTTP.
- Le web n'importe ni `@zay-app/db`, ni `@zay-app/auth`.

**Security model**: la garde web n'est qu'un confort, le contrôle réel est dans `staffProcedure` et `adminProcedure`. Les procédures choisissent leurs colonnes et ne renvoient jamais une ligne complète de `user`. Better Auth limite déjà le débit de connexion en production.

**Configuration required**: aucune nouvelle variable.

**Critical test scenarios**:
- Happy path : `admin:create`, connexion, arrivée sur `/admin`, verifies **AC-1**, **AC-6**.
- Failure case : `POST /api/auth/admin/set-role` et `POST /api/auth/admin/set-role/` avec une session admin répondent 404, verifies **AC-3**.
- Auth/permission : un `support` appelle `admin.settings.create` directement, et reçoit `FORBIDDEN`, verifies **AC-4**, **AC-5**.
- Auth/permission : un `client` connecté ne reçoit aucune donnée, verifies **AC-2**.
- Données : deux lancements du seed n'ajoutent rien. `--reset --yes` vide la base, et refuse si un compte hors `@zay.test` existe, verifies **AC-8**.
- Visuel : la coquille en clair, et une recherche des mots `Uber`, `UberMove` dans `apps/` et `packages/` ne trouve rien, verifies **AC-7**.
- Mobile : le splash en mode sombre montre le logo, verifies **AC-9**.

## Build plan

1. Fermer les routes `/admin/*` dans `disabledPaths`, exporter le type `Auth`, ajouter `auth`, `headers` et `files` au contexte, créer `staffProcedure`, `adminProcedure` et `actorFromSession`, satisfies **AC-3**, **AC-4**
2. Écrire `domain/phone.ts`, puis `admin:create` et son script, satisfies **AC-6**
3. Poser les jetons, Inter, et adapter `button`, `input` et `card` dans `packages/ui`. Ajouter avec shadcn `sidebar`, `table`, `dialog`, `alert-dialog`, `select`, `badge`, `tabs`, `textarea` et `pagination`. Copier le logo et le favicon vers le web, satisfies **AC-7**
4. Remplacer les pages de départ : redirection de `/`, `/login` sans inscription, retrait de `_auth` et `header`, satisfies **AC-1**, **AC-2**
5. Créer la mise en page `/admin` avec sa garde, l'écran d'accès réservé, le menu par rôle, la page réservée et `/admin/compte`, satisfies **AC-1**, **AC-2**, **AC-5**
6. Écrire `packages/api/src/domain/booking-status.ts` (voir la spec Supervision), les codes dans `codes.ts`, puis `seed:backoffice` et ses fichiers spécimen, satisfies **AC-8**
7. Copier les images vers le mobile, modifier `app.json`, et vérifier le splash sur une nouvelle compilation, satisfies **AC-9**

## Rationale

Voir [rationale.md](rationale.md).
