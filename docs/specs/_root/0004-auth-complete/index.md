# 0004. Compléter l'authentification par codes envoyés par email

**Date**: 2026-11-07
**Status**: In Progress

## Summary

Zay vérifie chaque adresse email avec un code à 6 chiffres avant d'ouvrir un compte, et le même type de code sert pour le mot de passe oublié. Les emails partent du serveur par SMTP (Nodemailer), avec des modèles React Email en français et en malagasy. Pour la démo, c'est Gmail qui envoie. La partie 1 (vérification, mot de passe oublié et changé, bienvenue, Google pour les comptes existants) est construite. La partie 2 (changer d'email, supprimer son compte) est spécifiée ici et sera construite après la démo du 9/11.

## Requirements

**User stories**:
- En tant que client ou chauffeur, je veux confirmer mon email par un code, pour que personne ne crée un compte avec mon adresse.
- En tant qu'utilisateur qui a oublié son mot de passe, je veux en choisir un nouveau avec un code reçu par email, sans quitter l'application.
- En tant qu'utilisateur connecté, je veux changer mon mot de passe et déconnecter mes autres appareils.
- En tant qu'utilisateur qui a déjà un compte, je veux me connecter avec Google sur le mobile.
- En tant que membre de l'équipe, je veux me connecter sans code, puisque mon compte est créé par un administrateur.
- En tant qu'utilisateur, je veux changer mon adresse email (partie 2).
- En tant qu'utilisateur, je veux supprimer mon compte sans effacer l'historique des courses (partie 2).

**Acceptance criteria** (partie 1, construite) :
- **AC-1** : à l'inscription, un email avec un code à 6 chiffres part, et aucune session ne s'ouvre avant la vérification.
- **AC-2** : un compte non vérifié qui se connecte est refusé (`EMAIL_NOT_VERIFIED`) et reçoit un nouveau code ; le bon code ouvre la session, un mauvais code est refusé, et après 3 essais il faut un nouveau code.
- **AC-3** : après la vérification, un email de bienvenue part une seule fois.
- **AC-4** : mot de passe oublié : un code part, le code et un nouveau mot de passe (8 caractères au moins) remplacent l'ancien, et les sessions ouvertes sont fermées.
- **AC-5** : un compte connecté change son mot de passe en donnant l'actuel ; les autres sessions sont fermées.
- **AC-6** : Google connecte un compte existant avec le même email ; un email inconnu est refusé sans créer de compte. *(Remplacé par la spec [0005](../0005-retouches-interface-mobile/0003-google-inscription.md) : Google crée aussi les nouveaux comptes.)*
- **AC-7** : les comptes créés par l'équipe, `admin:create` et les seeds se connectent sans vérification.
- **AC-8** : `packages/email` ne lit aucune variable d'env, et le mobile et le web n'importent ni `@zay-app/email` ni `@zay-app/auth`.
- **AC-9** : si le SMTP échoue, la route qui envoie un code répond quand même comme d'habitude, l'erreur est écrite dans les logs du serveur sans le code, et l'utilisateur peut demander un nouveau code.

**Acceptance criteria** (partie 2, à construire après la démo) :
- **AC-10** : un utilisateur connecté demande à changer d'email ; un code part à la nouvelle adresse seulement. Le bon code remplace l'email, le marque vérifié, et un email d'avis part à l'ancienne adresse. Une adresse déjà prise reçoit la même réponse qu'une adresse libre, et aucun code ne part.
- **AC-11** : un utilisateur connecté demande à supprimer son compte ; un code part à son email. Le bon code anonymise le compte : nom `Compte supprimé`, email et téléphone remplacés par des valeurs propres à ce compte, documents et photos du dossier chauffeur effacés, sessions et moyens de connexion (mot de passe, Google) supprimés, compte bloqué. Les courses, offres, paiements et journaux restent.
- **AC-12** : la suppression est refusée avec `ACCOUNT_HAS_ACTIVE_RIDE` quand le client a une réservation non terminée, ou quand le chauffeur a une course active ou une offre ouverte ; elle est refusée avec `STAFF_ACCOUNT` pour un rôle de l'équipe.
- **AC-13** : après une suppression, l'ancienne adresse et l'ancien numéro peuvent servir à créer un nouveau compte, et le back office affiche `Compte supprimé` dans l'historique.

## Decision

**Chosen option**: Option 1 : codes à 6 chiffres via le plugin `emailOTP` de Better Auth, emails envoyés par Nodemailer et rendus par React Email, dans un paquet `packages/email` injecté par le serveur.

Better Auth garde toute la logique d'auth (codes, sessions, limites), le serveur fournit l'envoi d'email, et les deux flux de la partie 2 suivent le même modèle de code par email.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `email-and-password-best-practices` (`better-auth/skills`, `.agents/skills/email-and-password-best-practices/`) · `heroui-native` (`.agents/skills/heroui-native/`)

**Choix fixés pendant la conversation** :
- Codes à 6 chiffres partout, aucun lien profond ni page web pour le mobile.
- Email non vérifié = connexion refusée. Les comptes d'équipe, de scripts et les comptes existants avant cette règle sont vérifiés d'office.
- Google : mobile seulement, comptes existants seulement (le téléphone reste obligatoire).
- SMTP de production : Gmail avec un mot de passe d'application, expéditeur = l'adresse Gmail elle même. `no-reply@zay.mg` attendra un fournisseur avec domaine vérifié.
- Échec SMTP : réponse normale, erreur dans les logs (voir AC-9).
- Limites de débit en mémoire (une seule instance sur Dokploy).
- Changement d'email : code à la nouvelle adresse seulement, avis à l'ancienne.
- Suppression : anonymisation confirmée par code, refusée pendant une course et pour l'équipe.

**Choix techniques tranchés ici** (pick, pourquoi, second choix) :
- Durée du code 10 minutes, 3 essais, stocké haché (`storeOTP: "hashed"`). Un réseau mobile lent à Toliara justifie plus que les 5 minutes par défaut ; le hachage protège les codes si la base fuit. Second choix : 5 minutes en clair.
- L'envoi n'est pas attendu dans la réponse (`void mailer.sendOtp(...)`). La réponse prend le même temps, que le compte existe ou non. Second choix : attendre l'envoi, plus simple à suivre mais révèle les comptes.
- `packages/auth` déclare un type `AuthMailer` et ne dépend pas de `packages/email`. Le serveur branche l'un sur l'autre. Second choix : importer `@zay-app/email` dans l'auth, ce qui couple deux paquets sans gain.
- Partie 2, suppression : procédures tRPC `me.requestDeletion` et `me.confirmDeletion` dans `packages/api`, avec un code haché gardé dans la table `verification` existante (identifiant `delete-account:<userId>`, valeur `<hash>:<essais>`, expiration 10 minutes). Le mailer arrive par le `Context` de l'API, comme `files`. Second choix : la route `delete-user` de Better Auth, rejetée car elle envoie un lien et efface la ligne pour de bon.
- Partie 2, changement d'email : option `changeEmail: { enabled: true, verifyCurrentEmail: false }` du plugin `emailOTP`, en rouvrant `/email-otp/request-email-change` et `/email-otp/change-email`. L'avis à l'ancienne adresse part d'un hook `after` sur `/email-otp/change-email`, avec l'ancienne adresse lue dans la session par un hook `before`. Second choix : une procédure tRPC maison, inutile puisque Better Auth couvre déjà le flux.
- Valeurs d'anonymisation : email `deleted-<userId>@zay.invalid` (domaine réservé, jamais livrable), téléphone `deleted:<userId>` (unique, hors format E.164 donc jamais saisissable). Les validateurs d'entrée ne voient pas ces valeurs, car l'écriture passe par Drizzle.

## Rationale

Le raisonnement et les options sont dans [rationale.md](rationale.md).

## Feature design

**Data model sketch** :
- Aucune nouvelle table. La partie 1 utilise `user.email_verified` et la table `verification` de Better Auth (codes hachés, expiration).
- Migration de données `20261107092958_verify_existing_accounts` : tous les comptes non vérifiés au moment du déploiement deviennent vérifiés.
- Partie 2, suppression : `user.name`, `user.email`, `user.phone`, `user.image` réécrits ; `user.banned = true`, `user.ban_reason = 'account_deleted'` ; lignes `session` et `account` du compte effacées ; `driver_document` et photos de véhicule : fichiers effacés du stockage, clés mises à `null` quand la colonne l'accepte. Les autres tables gardent leur clé étrangère vers `user.id`. Si une colonne de clé de fichier est `NOT NULL`, ce cas remonte à `/architect` avant le build plutôt que d'improviser.

**State transitions** :
- Compte : `non vérifié` → (bon code) → `vérifié` → (suppression confirmée) → `supprimé` (bloqué, définitif).
- Code : `émis` → `utilisé` | `expiré` (10 min) | `épuisé` (3 essais). Un nouveau code remplace l'ancien.

**API surface** :
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/sign-up/email` | POST | name, email, password, phone, locale | user, `token: null` | public | 400 `PHONE_NUMBER_ALREADY_USED` |
| `/api/auth/sign-in/email` | POST | email, password | session | public | 403 `EMAIL_NOT_VERIFIED`, 401 |
| `/api/auth/email-otp/send-verification-otp` | POST | email, type `email-verification` | success | public | 429 |
| `/api/auth/email-otp/verify-email` | POST | email, otp | session, user | public | 400 `INVALID_OTP`, `OTP_EXPIRED`, 403 `TOO_MANY_ATTEMPTS` |
| `/api/auth/email-otp/request-password-reset` | POST | email | success (même réponse si inconnu) | public | 429 |
| `/api/auth/email-otp/reset-password` | POST | email, otp, password | success | public | 400 `INVALID_OTP` |
| `/api/auth/change-password` | POST | currentPassword, newPassword, revokeOtherSessions | session | session | 400 `INVALID_PASSWORD` |
| `/api/auth/sign-in/social` | POST | provider `google`, callbackURL, errorCallbackURL | redirect | public | `signup_disabled` au retour |
| `/api/auth/email-otp/request-email-change` (partie 2) | POST | newEmail | success | session | 429 |
| `/api/auth/email-otp/change-email` (partie 2) | POST | newEmail, otp | user | session | 400 `INVALID_OTP` |
| tRPC `me.requestDeletion` (partie 2) | mutation | aucun | `{ sent: true }` | session client ou chauffeur | `ACCOUNT_HAS_ACTIVE_RIDE`, `STAFF_ACCOUNT` |
| tRPC `me.confirmDeletion` (partie 2) | mutation | code | `{ deleted: true }` | session client ou chauffeur | `INVALID_CODE`, `CODE_EXPIRED`, `ACCOUNT_HAS_ACTIVE_RIDE` |

Routes fermées (`CLOSED_PATHS`) : `/sign-in/email-otp` toujours ; `/email-otp/request-email-change` et `/email-otp/change-email` jusqu'à la partie 2 ; toutes les routes HTTP du plugin admin.

**Value sourcing** :
| Action | Value produced / displayed | Source |
|---|---|---|
| Envoi de code | code à 6 chiffres | généré par `emailOTP` (`otpLength: 6`) |
| Envoi de code | langue de l'email | colonne `user.locale` lue par email ; `fr` si aucun compte |
| Envoi de code | durée affichée | constante `OTP_MINUTES = 10` dans `packages/auth` |
| Envoi de code | expéditeur, serveur SMTP | env serveur `MAIL_FROM`, `SMTP_URL` |
| Bienvenue | nom, langue | `user.name`, `user.locale` passés par `afterEmailVerification` |
| Vérification | session ouverte | `autoSignInAfterVerification: true` |
| Inscription chauffeur | relation d'emploi | paramètre de route `relation` passé de l'écran d'inscription à l'écran de code |
| Google | autorisé ou non | existence d'un `user` avec le même email (`disableImplicitSignUp`) |
| Bouton Google visible | oui ou non | env mobile `EXPO_PUBLIC_GOOGLE_SIGN_IN` |
| Avis de changement d'email (partie 2) | ancienne adresse | `session.user.email` lu dans le hook `before` |
| Suppression (partie 2) | course active | `booking.status` comparé aux statuts non terminés de `domain/booking-status.ts` et à `ACTIVE_RIDE` de `domain/dispatch.ts` ; offres ouvertes de `domain/offers.ts` |
| Suppression (partie 2) | rôle d'équipe | `isStaffRole(user.role)` de `domain/staff.ts` |
| Suppression (partie 2) | valeurs anonymes | dérivées de `user.id` (voir Decision) |

**Key invariants** :
- Aucune session pour un compte dont `email_verified` est faux.
- Un code ne sert qu'une fois ; 3 mauvais essais l'épuisent.
- Le code n'apparaît jamais dans les logs ni dans une réponse.
- Le mobile et le web n'appellent que les routes HTTP ; l'envoi d'email n'existe que dans le serveur.
- Un compte supprimé ne se reconnecte jamais (bloqué, sans mot de passe ni lien Google), et ses courses restent.

**Security model** :
- Routes de code publiques mais limitées en débit (plugin : 3 envois par minute ; Better Auth : limite globale en mémoire en production).
- Réponses identiques pour un email connu ou inconnu (mot de passe oublié, changement d'email).
- Codes hachés en base, valables 10 minutes.
- Changement de mot de passe et réinitialisation ferment les autres sessions.
- Partie 2 : suppression seulement pour son propre compte, rôle `client` ou `driver`, confirmée par code.
- Données personnelles : nom, email, téléphone et pièces d'identité. La suppression les efface ; c'est la base d'une future demande d'effacement (RGPD ou règles des stores).

**Configuration required** :
- `SMTP_URL` (serveur) : en production `smtps://<compte>@gmail.com:<mot-de-passe-application>@smtp.gmail.com:465` (le `@` du compte s'écrit `%40`) ; en local `smtp://localhost:1026` (Mailpit).
- `MAIL_FROM` (serveur) : en production `Zay <compte@gmail.com>`, la même adresse que le compte SMTP.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (serveur, facultatifs) : client OAuth de type web, URI de retour `<BETTER_AUTH_URL>/api/auth/callback/google`.
- `EXPO_PUBLIC_GOOGLE_SIGN_IN` (mobile, facultatif) : affiche le bouton Google.

**Critical test scenarios** :
- Happy path : inscription, code de Mailpit, session ouverte, bienvenue reçue, vérifie **AC-1**, **AC-2**, **AC-3**.
- Failure case : trois mauvais codes puis le bon, refusé avec `TOO_MANY_ATTEMPTS`, vérifie **AC-2**.
- Failure case : SMTP arrêté pendant une inscription, réponse 200 et erreur dans les logs, vérifie **AC-9**.
- Auth/permission : un admin qui demande la suppression de son compte reçoit `STAFF_ACCOUNT`, vérifie **AC-12**.
- Données : après suppression, la course reste visible dans le back office avec `Compte supprimé`, vérifie **AC-11**, **AC-13**.

## Build plan

Partie 1 (construite le 2026-11-07) :
1. Paquet `packages/email` : `createMailer`, modèles code et bienvenue, textes fr et mg, satisfies **AC-1**, **AC-3**, **AC-8**.
2. `packages/auth` : plugin `emailOTP`, `requireEmailVerification`, bienvenue après vérification, Google sans inscription implicite, routes fermées, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-6**, **AC-9**.
3. Serveur : env `SMTP_URL`, `MAIL_FROM`, Google ; branchement du mailer ; comptes d'équipe et de scripts vérifiés ; migration des comptes existants, satisfies **AC-7**, **AC-9**.
4. Mobile : écran de code, mot de passe oublié, bouton Google, changement de mot de passe dans le profil, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**.
5. Web : page `/mot-de-passe-oublie`, libellés des erreurs de code, satisfies **AC-4**, **AC-5**.

Partie 2 (après la démo) :
6. Modèle React Email « adresse changée » et « code de suppression » (fr, mg), satisfies **AC-10**, **AC-11**.
7. Changement d'email : option `changeEmail`, routes rouvertes, type `change-email` envoyé, hooks d'avis à l'ancienne adresse ; écran mobile dans le profil, satisfies **AC-10**.
8. Mailer dans le `Context` de l'API ; procédures `me.requestDeletion` et `me.confirmDeletion` avec contrôle des courses et du rôle, anonymisation en une transaction, effacement des fichiers après la transaction, satisfies **AC-11**, **AC-12**, **AC-13**.
9. Écran mobile de suppression (avertissement, code, confirmation) et libellé `Compte supprimé` dans le back office, satisfies **AC-11**, **AC-13**.

## Migration plan

**Strategy** : no migration needed for schema ; une migration de données.
**Phases** :
1. Déployer le serveur avec la migration `verify_existing_accounts` et un vrai `SMTP_URL`. La migration tourne avant que la nouvelle règle refuse quiconque.
**Rollback** : revenir au commit précédent suffit ; les comptes marqués vérifiés le restent, ce qui est sans danger.
**Risks** : un `SMTP_URL` absent ou faux en production laisse les nouveaux comptes sans code. Vérifier un envoi réel juste après le déploiement.

## Consequences

**Positive** :
- Plus de comptes créés avec l'adresse de quelqu'un d'autre, et un mot de passe oublié se règle dans l'application.
- Toute la logique d'auth reste dans Better Auth ; Zay n'écrit que l'envoi et les écrans.
- Le paquet email sert ensuite aux autres notifications (reçus, validation de dossier).

**Negative / tradeoffs** :
- Un utilisateur sans accès à son email ne peut plus créer de compte ni se connecter : le support passe par l'équipe.
- Gmail limite l'envoi (environ 500 par jour pour un compte personnel) et l'expéditeur est une adresse Gmail, moins crédible et plus souvent classée en spam. Acceptable pour la démo, pas pour un lancement.
- Les limites de débit en mémoire repartent à zéro à chaque redémarrage et ne tiennent pas avec plusieurs instances.
- Google ne crée pas de compte : un nouvel utilisateur doit d'abord passer par email et mot de passe.

**Neutral** :
- La migration fait confiance aux comptes existants sans les vérifier.
- `verify-data-model.ts` crée l'auth sans vérification obligatoire pour tester les règles de données.

## Follow-up

- [ ] Avant le lancement public, passer à un fournisseur SMTP avec domaine vérifié (Brevo ou Resend, SPF et DKIM sur `zay.mg`) et `MAIL_FROM = Zay <no-reply@zay.mg>`.
- [ ] Mettre `SMTP_URL` et `MAIL_FROM` Gmail sur Dokploy avant le 9/11, puis tester un envoi réel.
- [ ] Faire relire les textes malagasy de l'app et des emails par un locuteur.
- [ ] Terminer `/check verify` sur le mobile (écrans de code, mot de passe oublié, profil).
- [ ] Aucune ligne du scope ne porte l'auth : l'inscrire avec `/scope` (partie 2 incluse) pour la suivre.
- [ ] `/sync` : mettre à jour `packages/auth/AGENTS.md` (plugin, `AuthMailer`, routes fermées) et ajouter un `packages/email/AGENTS.md`.
- [ ] Si le serveur passe à plusieurs instances, déplacer les limites de débit en base (`rateLimit.storage: "database"`).
