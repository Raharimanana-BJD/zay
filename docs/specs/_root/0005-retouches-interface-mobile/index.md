# 0005. Retouches de l'interface mobile

**Date**: 2026-11-07
**Status**: In Progress

## Summary

Sept retouches demandées après le nouveau design de l'app : un splash animé, une carte en plein écran, une barre d'onglets en icônes seules, une photo de profil, l'inscription par Google, le PDF pour les documents chauffeur et un bloc Documents refait. Trois d'entre elles touchent aussi le serveur. Le téléphone devient facultatif en base (un compte Google n'en a pas au départ), un nouveau type de fichier « avatar » arrive, et les documents acceptent le PDF jusqu'à 10 Mo. Le back office affiche les PDF et saisit la date d'expiration des documents.

## Structure

| Spec | Ce qu'elle couvre | Décision portée |
|---|---|---|
| [0001-interface-globale](0001-interface-globale.md) | Splash animé, carte plein écran, onglets en icônes | Splash en deux temps (natif fixe, puis écran animé dessiné par l'app) ; un seul composant de carte plein écran partout |
| [0002-photo-profil](0002-photo-profil.md) | Photo de profil, vue par l'autre partie d'une course | Nouveau type de fichier `avatar`, clé rangée dans `user.image` |
| [0003-google-inscription](0003-google-inscription.md) | Connexion et inscription par Google | Téléphone facultatif en base + écran bloquant « Compléter mon profil ». Remplace la règle Google de la spec 0004 (AC-6) |
| [0004-documents-chauffeur](0004-documents-chauffeur.md) | PDF, bloc Documents refait, envoi groupé, expiration | PDF reconnu par son contenu, 10 Mo ; préparer puis tout envoyer ; l'équipe saisit l'expiration |

### Contrat commun aux spécifications filles

**Types de fichiers** (`apps/server/src/files.ts`, route `POST /files/:kind`) :

| Type | Clé | Formats | Taille max | Qui envoie | Qui lit |
|---|---|---|---|---|---|
| `doc` | `up-doc-<uuid>.png\|jpg\|pdf` | PNG, JPEG, PDF | 10 Mo | chauffeur | équipe, et le chauffeur propriétaire du document |
| `photo` | `up-photo-<uuid>.png\|jpg` | PNG, JPEG | 5 Mo | chauffeur | tout compte connecté (inchangé) |
| `avatar` | `up-avatar-<userId>-<uuid>.png\|jpg` | PNG, JPEG | 5 Mo | tout compte connecté au profil complet | la personne, l'équipe, l'autre partie d'une course active |

- Le format se décide toujours sur les premiers octets du fichier, jamais sur le nom ou l'en tête envoyé.
- La clé d'avatar porte l'id de son auteur, pour qu'on ne puisse jamais s'approprier le fichier d'un autre.
- `POST /files/:kind` : limite de taille lue selon `:kind` (un petit wrapper autour de `bodyLimit`), réponse 413 inchangée `{ code: "FILE_TOO_LARGE" }`. L'envoi exige un profil complet.
- `GET /files/:key` : `Content-Type` selon l'extension (`image/png`, `image/jpeg`, `application/pdf`), avec `X-Content-Type-Options: nosniff` (déjà là) et `Content-Security-Policy: sandbox` sur tous les fichiers, pour qu'un PDF piégé ne puisse rien exécuter dans le navigateur de l'équipe. Un refus de droits renvoie 403, un fichier absent 404.
- À changer ensemble : `UPLOAD_KEY` et `PUBLIC_KEY` dans `files.ts` (un avatar ne doit jamais correspondre à `PUBLIC_KEY`), `UPLOAD_DOC_KEY` dans `driver.ts`, et la nouvelle `UPLOAD_AVATAR_KEY`.

**Profil lu par l'app** : `me.get` renvoie en plus `imageUrl` (URL de l'avatar ou `null`) et `isComplete`. `isComplete` vaut `phone IS NOT NULL` (un texte vide est refusé à l'écriture), et toujours `true` pour un rôle d'équipe.

## Requirements

**User stories** :
- En tant qu'utilisateur, je veux un écran d'ouverture à l'image de Zay pendant le chargement.
- En tant que client ou chauffeur, je veux agrandir la carte pour bien voir l'itinéraire et ma position.
- En tant qu'utilisateur, je veux une barre d'onglets plus légère, en icônes seules.
- En tant qu'utilisateur, je veux mettre une photo de profil, et voir celle de l'autre personne pendant une course pour la reconnaître.
- En tant que nouvel utilisateur, je veux créer mon compte avec Google sans remplir de formulaire.
- En tant que chauffeur, je veux envoyer mes papiers en PDF ou en photo, tous d'un coup, et voir clairement où en est mon dossier.
- En tant que membre de l'équipe, je veux lire un PDF dans le back office et noter la date d'expiration d'un document.

**Acceptance criteria** :

*Interface globale (0001)*
- **AC-1** : à l'ouverture, l'app montre un fond jaune Zay (`#f7c910`) avec le logo `Zay` noir, puis trois points noirs animés sous le logo. L'écran disparaît dès que la session est lue, jamais avant 1 seconde. Avec « réduire les animations » activé, les points restent fixes.
- **AC-2** : la barre d'onglets n'affiche que des icônes, avec le point jaune sous l'onglet ouvert. Chaque onglet garde son nom pour le lecteur d'écran.
- **AC-3** : chaque carte (Réserver, suivi de course client, accueil chauffeur, course chauffeur) a un bouton d'agrandissement. Il ouvre la carte en plein écran avec les mêmes repères et le même itinéraire, qui continuent de se mettre à jour. Un bouton Fermer et le retour Android la referment.
- **AC-4** : en plein écran, quatre contrôles : recentrer sur ma position, voir tout le trajet, zoom + et −, et un bandeau résumé (voir 0001 pour son contenu selon l'écran).

*Photo de profil (0002)*
- **AC-5** : dans le profil, toucher l'avatar ouvre un menu « Prendre une photo · Choisir dans la galerie · Retirer la photo » (le dernier seulement s'il y a une photo). La photo est recadrée en carré, envoyée (5 Mo max) et s'affiche aussitôt.
- **AC-6** : pendant une course active, le client voit la photo du chauffeur et le chauffeur celle du client. Sans photo, c'est l'initiale du nom.
- **AC-7** : un fichier avatar n'est lisible que par la personne, l'équipe et l'autre partie d'une course active. Tout autre compte reçoit 403.

*Google (0003)*
- **AC-8** : le bouton « Continuer avec Google » apparaît sur la connexion et l'inscription quand `EXPO_PUBLIC_GOOGLE_SIGN_IN` est vrai. Un compte qui a déjà cet email se connecte.
- **AC-9** : un email Google inconnu crée un compte (nom et email venus de Google, email vérifié, sans téléphone) et ouvre l'écran « Compléter mon profil » : téléphone (format international) et Client ou Chauffeur. Le choix Chauffeur crée le dossier chauffeur (situation « Propriétaire »).
- **AC-10** : tant que le téléphone manque, l'app n'affiche que cet écran (avec « Se déconnecter »), et le serveur refuse avec `PROFILE_INCOMPLETE` les actions client et chauffeur, `driver.register`, `me.report` et l'envoi de fichiers.
- **AC-11** : un téléphone déjà pris affiche `PHONE_TAKEN` sur l'écran de complétion, sans rien enregistrer.

*Documents chauffeur (0004)*
- **AC-12** : toucher un document ouvre « Prendre une photo · Choisir une image · Choisir un PDF ». Le fichier choisi passe à « Prêt », avec son aperçu (miniature, ou icône PDF et nom du fichier), sans être encore envoyé.
- **AC-13** : un seul bouton « Envoyer mes documents (N) » envoie tous les documents prêts. Chacun part seul : un échec laisse ce document « Prêt » avec son erreur, les autres passent « En attente de validation ».
- **AC-14** : le serveur accepte un PDF (contenu qui commence par `%PDF`) jusqu'à 10 Mo pour un document. Au delà : `FILE_TOO_LARGE` ; autre format : `FILE_TYPE_NOT_ALLOWED`.
- **AC-15** : le bloc affiche « N sur 4 envoyés » avec une barre jaune. Chaque document montre son état, le dernier motif de l'équipe s'il est refusé ou à compléter, sa date d'expiration avec « Expire bientôt » (30 jours ou moins) ou « Expiré », et l'aperçu du fichier envoyé.
- **AC-16** : dans le back office, un document PDF s'affiche intégré dans la fiche du chauffeur, avec un lien « Ouvrir » vers un nouvel onglet. Les images restent affichées comme aujourd'hui.
- **AC-17** : en validant un document (« Validé » seulement), l'admin peut saisir sa date d'expiration. Elle est enregistrée dans `driver_document.expires_at` (fin de journée, fuseau `Indian/Antananarivo` ; vide veut dire « n'expire pas »). Une date déjà passée est refusée (`DOCUMENTS_NOT_APPROVED`, règle existante). Le chauffeur ne peut plus fixer cette date lui même.

## Decision

**Chosen option** : retoucher l'existant sur place (pas de réécriture), avec quatre décisions portées par les spécifications filles et une seule migration (`user.phone` devient facultatif).

**Implementation skills** : `expo-overview` (`expo/skills`, `.agents/skills/expo-overview/`) · `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `heroui-native` (`heroui-inc/heroui`, `.agents/skills/heroui-native/`) · `better-auth-best-practices` (`.claude/skills/better-auth-best-practices/`) · `hono` (`.claude/skills/hono/`)

## Rationale

Raisonnement et options : voir [rationale.md](rationale.md).

## Build plan

Approche Tracer Bullet : chaque tranche traverse base, serveur, app et back office avant la suivante. On commence par les tranches sans risque, puis celles qui touchent les données.

1. Onglets en icônes seules (`components/tab-bar.tsx`), satisfies **AC-2**
2. Splash : `app.json` (fond `#f7c910`, `splash-icon.png` noir) + écran animé dans `app/_layout.tsx` à la place de `Loading` au démarrage, satisfies **AC-1**
3. Carte plein écran : composant `MapFullscreen` (modale + contrôles + bandeau), branché sur les quatre cartes ; commandes `zayZoom`, `zayFitAll`, `zayCenter` ajoutées au HTML de `zay-map.tsx`, satisfies **AC-3**, **AC-4**
4. Serveur fichiers : type `avatar`, PDF pour `doc`, droits d'envoi et limites par type, `Content-Type` PDF, en tête `sandbox`, lecture du document par son propriétaire et de l'avatar par l'autre partie d'une course active, satisfies **AC-7**, **AC-14**
5. Photo de profil : hook « before » qui refuse `image` sur `/update-user` et `/sign-up/email`, `me.setImage` / `me.removeImage`, `imageUrl` dans `me.get`, photo de l'autre partie dans `client.booking` et dans la course chauffeur, menu et recadrage dans le profil, avatar dans les écrans de course, satisfies **AC-5**, **AC-6**
6. Migration, dans cet ordre : `phone` en `required: false` dans `packages/auth`, puis `bun run auth:generate` (le schéma `auth.ts` est généré), puis la migration Drizzle. Ensuite, chaque lecture du téléphone gère `null` : back office (liste des chauffeurs, `team.ts`), scripts `seed-*` et `verify-data-model.ts`, satisfies **AC-9**
7. Google : `disableImplicitSignUp: false`, photo Google ignorée, protection contre la prise de compte par liaison, `additionalData` retiré, téléphone exigé sur `/sign-up/email`, envoi d'email dans le contexte tRPC, `me.completeProfile`, garde `PROFILE_INCOMPLETE`, écran « Compléter mon profil » bloquant, bouton sur la connexion et l'inscription, satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**
8. Documents app : `expo-document-picker`, menu à 3 choix, état local « Prêt », envoi groupé, nouveau bloc (progression, aperçu, motif, expiration), satisfies **AC-12**, **AC-13**, **AC-15**
9. Documents API : `driver.dossier` renvoie par document le type de fichier, la date d'envoi, `expiresAt` et le dernier motif de décision ; `expiresAt` retiré de `driver.attachDocument`, satisfies **AC-15**, **AC-17**
10. Back office : aperçu PDF intégré + lien « Ouvrir » ; champ date d'expiration dans la décision sur un document (`admin.drivers.decide`), satisfies **AC-16**, **AC-17**
11. Textes en français et en malagasy pour tout ce qui est nouveau, satisfies **AC-1** à **AC-17**

## Migration plan

**Strategy** : migration additive, sans drapeau.
**Phases** :
1. `ALTER TABLE "user" ALTER COLUMN phone DROP NOT NULL` (l'index unique reste ; Postgres accepte plusieurs valeurs vides). Aucune donnée existante ne change.
2. Déployer le serveur (garde `PROFILE_INCOMPLETE`, Google ouvert), puis l'app.
**Rollback** : revenir au code précédent suffit tant qu'aucun compte Google sans téléphone n'existe. Après, remettre `NOT NULL` exige de compléter ou supprimer ces comptes d'abord.
**Risks** : une ancienne version de l'app qui reçoit un profil sans téléphone. Le seul chemin qui en crée un est Google, absent des anciennes versions (bouton caché).

## Consequences

**Positive** :
- Inscription en deux touches avec Google, sans mot de passe à retenir.
- Les chauffeurs envoient leurs papiers tels qu'ils les ont (PDF de l'assurance, scan du permis).
- La règle « document expiré » devient enfin active, puisque l'équipe saisit les dates.
- Client et chauffeur se reconnaissent au point de rendez vous grâce aux photos.

**Negative / tradeoffs** :
- `phone` facultatif : chaque nouvelle lecture du téléphone doit gérer `null`. Les procédures client et chauffeur s'en protègent par la garde, mais le back office doit afficher « non renseigné ».
- Plus de fichiers sur le disque du serveur (PDF jusqu'à 10 Mo, avatars). Le stockage reste local pour la démo, sans sauvegarde dédiée.
- La lecture d'un avatar ou d'un document coûte une requête en base de plus (vérifier le propriétaire ou la course active).
- Un PDF n'a pas de miniature dans l'app : seulement une icône et un nom.
- Un compte Google n'a pas de mot de passe. « Changer le mot de passe » doit être masqué pour lui.

**Neutral** :
- Nouvelle dépendance : `expo-document-picker` (paquet Expo officiel, nécessite un nouveau build natif).
- La spec 0004 voit sa règle Google (AC-6, « comptes existants seulement ») remplacée par 0003 de cette spec.

## Follow-up

- [ ] Configurer `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` en production, puis passer `EXPO_PUBLIC_GOOGLE_SIGN_IN` à `true` et refaire l'APK.
- [ ] Le téléphone n'est vérifié par aucun code (ni à l'inscription par email, ni par Google). À décider plus tard si un numéro faux devient un problème.
- [ ] Faire relire les nouveaux textes malagasy.
- [ ] Les fichiers envoyés mais jamais rattachés (avatar abandonné, document préparé puis quitté) restent sur le disque. Accepté pour la démo ; un nettoyage périodique sera à prévoir avant un vrai lancement.
- [ ] Le refus de chercher des Agent Skills pour `expo-document-picker` est à noter dans `apps/native/AGENTS.md` (les skills Expo installés le couvrent) : c'est le travail de `/sync`.
