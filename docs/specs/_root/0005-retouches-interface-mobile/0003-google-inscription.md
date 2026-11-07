# 0005.0003. Connexion et inscription par Google

## Summary

Google ouvre désormais aussi les nouveaux comptes, et plus seulement les comptes existants. Comme Google ne donne pas de numéro, le téléphone devient facultatif en base. Un écran bloquant « Compléter mon profil » demande le téléphone et le rôle (Client ou Chauffeur) avant tout le reste. Cette spec remplace la règle Google de la spec 0004 (AC-6 et sa contrainte « comptes existants seulement »).

Raison courte : une garde serveur honnête vaut mieux qu'un faux numéro en base. Le serveur reste juge (règle du projet).

## Feature design

**Data model** : `user.phone` devient nullable (unique conservé). Un utilisateur est « complet » si `phone IS NOT NULL` ; un texte vide est refusé partout à l'écriture ; un rôle d'équipe est toujours complet. Le compte Google est créé avec le rôle par défaut `client` (plugin `admin`, `defaultRole: "client"`), `emailVerified: true`, `image: null`, et la langue par défaut `fr` (corrigée à la complétion).

**Ordre de la migration** : `phone` en `required: false` dans les champs additionnels de `packages/auth`, puis `bun run auth:generate` (le schéma `packages/db/src/schema/auth.ts` est généré, on ne l'édite pas), puis la migration Drizzle. Ensuite, chaque lecture du téléphone gère `null` (« non renseigné » dans le back office : liste des chauffeurs, `team.ts` ; scripts `seed-*`, `verify-data-model.ts`).

**Auth** (`packages/auth/src/index.ts`) : `socialProviders.google.disableImplicitSignUp` passe à `false`. Le lien de compte (`accountLinking`, Google de confiance) ne change pas : un email existant se connecte sur son compte. Le champ additionnel `phone` passe à `required: false`. Le hook « before » change sur trois points :
- `/sign-up/email` sans `phone`, ou avec un `phone` vide, renvoie 400 (aujourd'hui le hook sort simplement quand `phone` n'est pas un texte) ;
- `/sign-in/social` : `additionalData` est retiré de la requête, pour que personne n'injecte un téléphone ou un rôle ;
- `image` est refusé sur `/update-user` et `/sign-up/email` (voir 0002).

**Prise de compte par liaison** : quand Google se lie à un compte existant dont l'email n'est pas encore vérifié, on supprime ses comptes `credential` (mot de passe) et ses sessions, puis on marque l'email vérifié (hook de base de données sur la création d'un `account` `google`). Ainsi, un compte créé d'avance sur l'email de quelqu'un d'autre ne garde pas le mot de passe de l'attaquant.

**API surface**
| Endpoint | Méthode | Entrées | Sorties | Auth | Erreurs |
|---|---|---|---|---|---|
| `/api/auth/sign-in/social` | POST | `provider: "google"`, `callbackURL: "/"`, `errorCallbackURL: "/connexion?error=google"` | redirection | public | retour `?error=…` |
| `me.get` | query | rien | `+ isComplete: boolean` | session | rien |
| `me.completeProfile` | mutation | `phone` (E.164), `role: "client" \| "driver"`, `locale` | rien | session, profil incomplet | `CONFLICT PHONE_TAKEN`, `BAD_REQUEST` si déjà complet |

`me.completeProfile` fait tout dans une transaction :
- écrire `phone` ; une violation d'unicité (code Postgres `23505`, lu sur `error.cause` de l'erreur Drizzle) donne `PHONE_TAKEN` ;
- si `role = driver`, appeler `registerDriver(tx, userId, "owner")`, une fonction partagée sortie de `driver.register` (avec ses contrôles `CLIENT_HAS_BOOKINGS` et de rôle) ;
- `locale` vient de l'écran.

Ensuite, l'email de bienvenue part par un `mailer` ajouté au contexte tRPC (`createContext` le reçoit de `services.ts`, comme `files`). Il ne bloque jamais. L'app recharge alors la session (`authClient.getSession()`) et invalide `me.get`, pour que le changement de rôle s'affiche.

**Garde** : un middleware `completeProfile` relit `user.phone` en base (jamais la session en cache) et refuse avec `FORBIDDEN PROFILE_INCOMPLETE` quand il est vide. Il s'applique à `clientProcedure`, `driverProcedure`, `driver.register` et `me.report`. La même vérification protège `POST /files/*`. Restent ouverts : `me.get`, `me.setLocale`, `me.completeProfile` et la déconnexion.

**App** : `app/_layout.tsx` lit `me.get.isComplete`. S'il est faux, un groupe protégé ne laisse voir que `app/(auth)/completer.tsx` : titre « Compléter mon profil », `Field` téléphone (`+261` par défaut), `Segment` Client ou Chauffeur, bouton « Continuer », lien « Se déconnecter ». Le bouton Google (`variant="secondary"`, icône `logo-google`) apparaît sur `connexion.tsx` et `inscription.tsx` quand `EXPO_PUBLIC_GOOGLE_SIGN_IN` est vrai. Il appelle `authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/connexion?error=google" })`. Le client Expo de Better Auth (`expoClient`, déjà en place) ouvre le navigateur par `expo-web-browser` (à ajouter aux dépendances) et transforme ces chemins en liens `zay-app://`. Un échec ou une annulation affiche le toast `auth.googleFailed` (texte à revoir : il ne parle plus de compte inexistant) ; un compte bloqué voit `auth.signInFailed`. Le profil masque « Changer le mot de passe » pour un compte sans mot de passe (pas de compte `credential` : `authClient.listAccounts()`).

**Value sourcing**
| Action | Valeur | Source |
|---|---|---|
| Compte Google | nom, email | profil Google (Better Auth) |
| Compte Google | rôle initial | `admin({ defaultRole: "client" })` |
| Complétion | téléphone, rôle | saisie de l'écran `completer.tsx` |
| Complétion | situation chauffeur | constante `owner` (modifiable ensuite dans le Dossier) |
| Complétion | langue | `useI18n().locale` |
| Garde | profil complet | `user.phone IS NOT NULL` |
| Bouton visible | oui ou non | `EXPO_PUBLIC_GOOGLE_SIGN_IN` |

**Security model** : seul l'utilisateur complète son propre profil, une seule fois. Un rôle d'équipe ne s'obtient jamais par ici (`role` limité à `client | driver`). Un compte Google complet passe par les mêmes contrôles que les autres.

**Configuration required** :
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (serveur) : déjà déclarés par la spec 0004. Ils doivent être renseignés en production, avec l'URI de retour `<BETTER_AUTH_URL>/api/auth/callback/google` enregistrée dans la console Google.
- `EXPO_PUBLIC_GOOGLE_SIGN_IN` (mobile) : à passer à `true` dans l'APK de production une fois Google configuré.

**Critical test scenarios** :
- Email Google inconnu : compte créé, écran de complétion, choix Chauffeur → espace chauffeur avec dossier « Propriétaire », verifies **AC-9**
- Email Google déjà inscrit par mot de passe : connexion directe, pas d'écran de complétion, verifies **AC-8**
- Profil incomplet qui appelle `client.createBooking` : `PROFILE_INCOMPLETE`, verifies **AC-10**
- Téléphone déjà pris : `PHONE_TAKEN`, aucun champ modifié, verifies **AC-11**
- Compte email non vérifié créé par un tiers, puis connexion Google de la vraie personne : l'ancien mot de passe ne marche plus, verifies **AC-8**
- `/update-user` avec `image` : 400, verifies **AC-7**
