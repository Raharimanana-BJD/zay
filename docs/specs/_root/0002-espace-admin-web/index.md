# 0002. Espace admin du web

**Date**: 2026-11-06
**Status**: In Progress

## Summary

Cette spec crée le back office de Zay sous `/admin`, réservé à l'équipe. Elle fixe un socle commun (accès, rôles, coquille, design noir et blanc inspiré de `DESIGN-uber.md`) et cinq modules : validation des dossiers, supervision et signalements, réglages, comptes, statistiques. Toutes les règles restent sur le serveur, dans un routeur tRPC `admin`, et aucune migration n'est nécessaire. Le script `seed:backoffice` permet de construire et de montrer chaque écran avant que les fonctions 9, 17 et 22 existent.

## Structure

| Spec enfant | Contenu | Fonction du scope |
|---|---|---|
| [0001-socle.md](0001-socle.md) | Accès, rôles, coquille, design, images, comptes de départ, données de test | Socle, nouvelle ligne du scope |
| [0002-reglages.md](0002-reglages.md) | Tarifs et paramètres versionnés | 25 |
| [0003-comptes-equipe.md](0003-comptes-equipe.md) | Clients, suspension, comptes équipe, journal d'audit | 26 |
| [0004-supervision-signalements.md](0004-supervision-signalements.md) | Réservations, annulation, litige, paiement contesté, signalements | 24 |
| [0005-validation-dossiers.md](0005-validation-dossiers.md) | Chauffeurs, véhicules, documents, décisions, suspension d'activité | 23 |
| [0006-statistiques.md](0006-statistiques.md) | Tableau de bord, chiffres et courbes | 27 |

Le simulateur (fonction 10) et les zones (fonction 15) gardent leur propre logique. Ils se branchent dans la coquille avec `/admin/simulateur` et `/admin/zones`.

## Requirements

**User stories**:
- En tant qu'administrateur, je veux piloter toute la plateforme depuis un seul espace web, sans mettre à jour l'application mobile.
- En tant que membre du support, je veux suivre les réservations et traiter les signalements, sans pouvoir toucher aux réglages sensibles.
- En tant que responsable de la démo, je veux que chaque écran ait des données crédibles dès sa construction.

**Acceptance criteria**: chaque spec enfant porte les siens, numérotés sans doublon dans tout ce dossier.

| Spec enfant | Critères |
|---|---|
| Socle | AC-1 à AC-9 |
| Réglages | AC-10 à AC-13 |
| Comptes et équipe | AC-14 à AC-20 |
| Supervision et signalements | AC-21 à AC-29 |
| Validation des dossiers | AC-30 à AC-36 |
| Statistiques | AC-37 à AC-40 |

## Decision

**Chosen option**: Option 1 : un routeur `admin` unique, un socle commun et des modules branchés dessus, sans migration.

Le web reste un client tRPC léger. `packages/api` porte tous les contrôles, et les écritures sensibles de Better Auth passent seulement par des appels serveur.

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `web-design-guidelines` (`vercel-labs/agent-skills`, `.agents/skills/web-design-guidelines/`) · `recharts` (`andy-spike/skills`, `.agents/skills/recharts/`)

Choix techniques que cette spec arrête :

| Sujet | Choix | Pourquoi | Autre option |
|---|---|---|---|
| Listes | Pagination par `page`, 25 lignes, avec `total` | Les numéros de page conviennent à un back office à faible volume | Curseur |
| État des listes | Filtres et page dans l'adresse, par `validateSearch` et Zod | Une vue se partage et survit à un rechargement | État React local |
| Tableaux | Composant `table` de shadcn, sans TanStack Table | Le tri et le filtre se font sur le serveur | TanStack Table |
| Fenêtres | `dialog` et `alert-dialog` de shadcn, jamais `confirm()` | Accessibles et conformes au design | Fenêtres du navigateur |
| Courbes | Composant `chart` de shadcn sur Recharts, installé dans `packages/ui` | Tu as choisi les courbes, et ce composant reprend les jetons de couleur | Recharts seul |
| Police | Inter, `@fontsource-variable/inter` dans `apps/web` | Hébergée avec l'app, et conseillée par `DESIGN-uber.md` | Geist |
| Idempotence | Un `clientRequestId` par ouverture de formulaire, là où le schéma l'accepte | Un double clic n'agit qu'une fois | Bouton désactivé seul |
| Erreur métier à afficher | Résultat `{ ok: false, code, ... }` si l'écran a besoin de données ou de messages par champ. Sinon `TRPCError` dont `message` est le code seul, traduit par `labels.ts` | Pas de formateur d'erreur à ajouter | `errorFormatter` tRPC |
| Téléphone | Un seul schéma E.164 dans `packages/api/src/domain/phone.ts`, utilisé par `team.create` et les scripts | `createUser` ne lance pas `validator.input`, ni le hook `before` | Exporter la règle depuis `packages/auth` |

## Feature design

**Contrat commun à tous les modules**

*Routeur.* `appRouter.admin` vient de `packages/api/src/routers/admin/index.ts`, qui assemble `settings`, `accounts`, `team`, `audit`, `bookings`, `reports`, `drivers` et `dashboard`, chacun dans son fichier.

*Procédures.* Dans `packages/api/src/index.ts` :
- `staffProcedure` : `protectedProcedure`, plus un rôle `admin` ou `support`. Sinon `FORBIDDEN`.
- `adminProcedure` : `protectedProcedure`, plus le rôle `admin`. Sinon `FORBIDDEN`.

*Auteur d'une action.* `actorFromSession(session)`, dans `packages/api/src/domain/staff.ts`, rend `{ actorKind: "admin" | "support", actorId: session.user.id }`.

*Contexte tRPC.* `Context` reçoit en plus :
- `auth`, du nouveau type `Auth` exporté par `@zay-app/auth`, pour appeler `auth.api.*` ;
- `headers`, la requête d'origine, à transmettre à ces appels ;
- `files`, le port de fichiers décrit dans la spec Validation.

`apps/server/src/context.ts` les remplit. Le paquet API ne crée toujours aucun client.

**Droits par rôle**

| Action | `admin` | `support` |
|---|---|---|
| Voir le tableau de bord, les réservations, les signalements, les clients, les chauffeurs, les dossiers et leurs documents | Oui | Oui |
| Annuler une réservation, ouvrir ou fermer un litige, résoudre un paiement contesté | Oui | Oui |
| Traiter les signalements | Oui | Oui |
| Changer son propre mot de passe | Oui | Oui |
| Modifier les réglages, voir leur historique | Oui | Non |
| Décider sur un dossier, suspendre une activité | Oui | Non |
| Suspendre ou réactiver un compte | Oui | Non |
| Créer un compte équipe, changer un rôle | Oui | Non |
| Lire `audit_log` | Oui | Non |

`client`, `driver` et un rôle vide n'ont aucun droit ici.

**Modèle de données**: aucune table et aucune colonne en plus. Les tables viennent de la spec [0001](../0001-modele-donnees/index.md). Seul `packages/api/src/domain/codes.ts` grandit :

| Liste | Valeurs ajoutées |
|---|---|
| `SUSPENSION_REASONS` (nouvelle) | `safety`, `fraud`, `document_issue`, `behavior`, `other` |
| `CANCELLATION_REASONS` | `support_intervention` |
| `DISPUTE_REASONS` (nouvelle) | `payment`, `price`, `behavior`, `other` |
| `PAYMENT_RESOLUTION_REASONS` (nouvelle) | `driver_confirmed`, `client_confirmed`, `agreement`, `other` |
| `DRIVER_DOCUMENT_TYPES` (nouvelle) | `driving_license`, `national_id`, `vehicle_registration`, `insurance` |
| `BOOKING_EVENT_TYPES` | `dispute_opened`, `dispute_closed` |
| `AUDIT_ACTIONS` (nouvelle) | `account.banned`, `account.unbanned`, `team.created`, `team.role_changed` |

Partout, un code `other` exige une note de 1 à 500 caractères, et les autres codes acceptent une note facultative de même longueur.

**Conventions d'écran**
- Chaque liste a ses états chargement, vide et erreur avec un bouton Réessayer.
- Une action réussie affiche un message et rafraîchit les données concernées. Une erreur serveur s'affiche en français, et le formulaire garde sa saisie.
- Un montant s'affiche en ariary entier avec séparateur d'espaces (`12 500 Ar`), et une date dans le fuseau `Indian/Antananarivo`, quel que soit le navigateur.
- Réservations, signalements et tableau de bord se rafraîchissent toutes les 10 s avec `refetchInterval`. Par défaut, TanStack Query met cette actualisation en pause quand l'onglet est caché.
- Tous les libellés de codes, de statuts et d'erreurs sont dans `apps/web/src/lib/labels.ts`, en français. Il importe `codes.ts` en type seul, avec un `Record<(typeof CODES)[number], string>`, et ses clés remplissent les listes déroulantes. Le web n'importe aucune valeur de `@zay-app/api`.
- Sauf mention contraire, une liste trie par `created_at DESC, id DESC`.
- Une recherche `q` retire les espaces autour, échappe `%` et `_`, puis utilise `ILIKE %q%`.
- Un filtre de dates inclut tout le dernier jour, dans le fuseau `Indian/Antananarivo`.
- `user.banned` se lit avec `coalesce(banned, false)`, car la colonne accepte le vide.

**Security model**: cahier §3.3, §3.4 et §6.4. Aucune norme de conformité n'est retenue pour la démo. Les détails sont dans la spec Socle.

## Build plan

Approche Tracer Bullet : le fil complet passe d'abord par une vraie écriture, puis chaque module l'élargit. L'ordre va de ce qui ne dépend de rien vers ce qui dépend le plus des autres fonctions.

1. **Socle, étapes 1 à 5**, jusqu'à la connexion d'un admin à une coquille vide.
2. **Réglages, en entier** : le premier fil de bout en bout (formulaire, tRPC, contrôle du rôle, nouvelle version en base).
3. **Comptes et équipe**, avec le journal d'audit.
4. **Socle, étape 6** : `seed:backoffice`.
5. **Supervision et signalements**.
6. **Validation des dossiers**.
7. **Statistiques**.
8. **Socle, étape 7** : les images et `app.json` du mobile.

Chaque spec enfant détaille ses tâches, et chaque tâche nomme ses critères.

**Si le temps manque**, coupe dans cet ordre. Ces gestes gardent quelque chose à montrer et ne cassent rien :
1. La création de comptes équipe et le changement de rôle (`admin:create` et le seed fournissent déjà les deux rôles).
2. Les courbes de Statistiques (les tuiles restent).
3. La page Journal (les lignes restent écrites).
4. La résolution d'un paiement contesté.

## Consequences

**Positive**:
- Une seule règle de droits, vérifiée sur le serveur et reprise par l'interface.
- Les fonctions 10 et 15 trouvent leur place dans la coquille.
- Le seed sert aussi à la fonction 29.

**Negative / tradeoffs**:
- Le scope entier reste très chargé pour le 9/11. Ce back office ne remplace pas la première vraie course (fonction 9).
- Tant que les fonctions 9, 17 et 22 manquent, supervision et validation montrent des données du seed. Cela doit rester clair dans ton discours de démo.
- Les appels `auth.api` et les écritures qui les suivent ne sont pas dans une même transaction, voir la spec Comptes.
- `DESIGN-uber.md` décrit des pages vitrine. Les écrans de back office sont donc une interprétation de ses blocs `ex-*`.
- Le contexte tRPC grandit de trois champs, que `packages/api/AGENTS.md` devra décrire.

**Neutral**:
- La page d'inscription web disparait. Le point d'accès d'inscription reste ouvert pour le mobile.
- Le web passe en clair uniquement, avec Inter.

## Follow-up

- [ ] Fonction 6 : `DESIGN-uber.md` est désormais la référence commune, et la question Shopify est réglée. Il reste à écrire le thème HeroUI Native et les écrans mobiles. La ligne du scope et `AGENTS.md` citent encore `DESIGN-shopify.md`.
- [ ] Fonction 22 : fournir le vrai port `files` avec des URL opaques, et les retours à `pending` quand un chauffeur renvoie une pièce.
- [ ] Fonction 8 : déployer le serveur avec `bun run start` et embarquer `apps/server/seed-files/`. Le binaire de `compile` ne trouverait pas ce dossier.
- [ ] Fonction 11 : quand une offre passe à `void`, la distribution doit savoir reprendre la recherche si la réservation reste en `OFFERED`.
- [ ] Fonction 9 : réutiliser `transitionBooking`, sans en écrire une seconde version. Seule l'action de fin de course crée la ligne `payment`, jamais `transitionBooking`, car fermer un litige repasse aussi à `COMPLETED`.
- [ ] Fonction 4 : prévenir les téléphones après une annulation ou une décision. Aujourd'hui, ils ne le voient qu'à la lecture suivante.
- [ ] Vrai lancement : forcer le changement du mot de passe temporaire, et la double authentification pour les admins.
- [ ] Vrai lancement : traduire le back office si une équipe malagasyphone l'utilise, et ajouter un index sur `booking.created_at` si le volume le demande.
- [ ] `recharts` (`.agents/skills/recharts/`) n'est pas encore listé dans `apps/web/AGENTS.md`. Les exemples de ce skill utilisent `npm` et des couleurs vives : ici, on utilise Bun et les jetons de la spec Socle.

## Rationale

Le raisonnement et les options sont dans [rationale.md](rationale.md).
