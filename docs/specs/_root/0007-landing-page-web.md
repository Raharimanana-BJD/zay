# 0007. Landing page publique du web

**Date**: 2026-11-08
**Status**: In Progress

## Summary

Le web gagne une page publique sur `/`, qui remplace la redirection vers `/admin`. Elle présente Zay aux habitants et aux chauffeurs de Toliara, sert aussi de vitrine pendant la démo, et pousse vers l'application Android avec un lien APK configurable. Elle existe en français et en malagasy, et reprend l'identité de l'app mobile (fond crème, jaune Zay) avec les deux illustrations du dossier `Resource-zayapp`. C'est une page statique : pas de base de données, pas d'appel tRPC, une seule variable d'environnement obligatoire pour le bouton de téléchargement.

## Context

Aujourd'hui `apps/web/src/routes/index.tsx` redirige `/` vers `/admin`. Un visiteur qui tape l'adresse du site tombe donc sur l'écran de connexion du back office, sans rien qui explique Zay ni comment obtenir l'application. Pour la démo du 9/11/2026, le jury voit le même écran.

Zay n'est publié sur aucun store (scope, section Rendu). L'application Android se distribue par un fichier APK, dont l'adresse n'est pas encore fixée : la mise en ligne de la démo (feature 8) n'a pas de spec. La page doit donc fonctionner avant et après que ce lien existe.

Le produit vise Toliara, où le malagasy est la langue du quotidien. L'app mobile range déjà ses textes en français et en malagasy (`apps/native/lib/i18n/`), mais le web n'a aucune traduction, et le malagasy n'a pas encore été relu par un locuteur (feature 7).

Côté visuel, le back office web suit des tokens blanc et noir (`packages/ui/src/styles/globals.css`), alors que l'app mobile utilise un fond crème `#f5f3ee` et le jaune Zay `#f7c910` (`apps/native/global.css`). `DESIGN-uber.md` reste la référence de mise en page, sous la marque Zay, sans son nom, son logo ni ses polices (spec 0002, AC-7).

## Requirements

**User stories**:
- En tant qu'habitant de Toliara, je veux comprendre en une minute ce que Zay m'apporte, pour décider d'installer l'app.
- En tant que chauffeur de taxi ou de tuk-tuk, je veux savoir comment rejoindre Zay, pour recevoir des courses.
- En tant que visiteur qui parle malagasy, je veux lire la page dans ma langue.
- En tant que membre de l'équipe Zay, je veux atteindre le back office depuis la page publique, pour la démo.

**Acceptance criteria**:
- **AC-1**: `/` affiche la landing page, sans redirection. `/admin` et `/login` fonctionnent comme avant.
- **AC-2**: la page montre, de haut en bas : un en-tête (logo Zay, bouton de langue FR / MG), un héros, la section « Comment ça marche », la section taxi et tuk-tuk, le bloc « Devenez chauffeur », un bandeau final avec le bouton de téléchargement, puis le pied de page.
- **AC-3**: le héros montre un titre, une phrase d'accroche, le bouton « Télécharger l'app », l'illustration `image-1.png` et une capture d'écran de l'app dans un cadre de téléphone.
- **AC-4**: la page met en avant quatre arguments pour les clients : prix connu avant de partir, plusieurs offres de chauffeurs à comparer, suivi du chauffeur en direct sur la carte, paiement en espèces.
- **AC-5**: le bloc « Devenez chauffeur » explique, sans aucun montant : la même app, passer en mode chauffeur, envoyer son dossier (permis, carte grise, assurance), puis recevoir des courses. Il montre l'illustration `image-2.png`.
- **AC-6**: quand `VITE_APK_URL` a une valeur, chaque bouton « Télécharger l'app » est un lien vers cette adresse, qui lance le téléchargement. Sans valeur, chaque bouton est désactivé et affiche « Bientôt disponible », et la page s'affiche quand même sans erreur.
- **AC-7**: la page s'affiche en français à la première visite. Le bouton FR / MG change tous les textes de la page, y compris les textes alternatifs des images, et met à jour l'attribut `lang` de `<html>` (`fr` ou `mg`).
- **AC-8**: le choix de langue est gardé dans le navigateur et réappliqué à la visite suivante. Si le stockage du navigateur est indisponible, la page reste en français et fonctionne.
- **AC-9**: le pied de page affiche « Toliara, Madagascar », l'email `brayjuanico@gmail.com` (lien `mailto:`), le téléphone `+261 38 14 600 78` (lien `tel:`), l'année, et un lien discret « Espace admin » vers `/login`.
- **AC-10**: la page est rendue côté serveur en français, avec un titre, une description et des balises de partage (Open Graph, l'aperçu que montrent WhatsApp et Facebook). L'image de partage et l'adresse canonique sont présentes seulement quand `VITE_SITE_URL` a une valeur.
- **AC-11**: les couleurs de la page sont le crème et le jaune Zay de l'app mobile, sans changer les couleurs du back office.
- **AC-12**: la page est lisible et utilisable à 360 px de large sans défilement horizontal, chaque cible tactile fait au moins 44 px, et les images ont un texte alternatif.

## Options considered

### Option 1: Page statique avec dictionnaires typés maison

Une route `/` rendue côté serveur. Les textes vivent dans deux fichiers TypeScript, `fr.ts` et `mg.ts`, de même forme vérifiée par le typage. Un petit contexte React donne la langue courante et la fonction pour en changer.

**Pros**:
- Aucune dépendance ajoutée, quelques dizaines de lignes.
- Une clé oubliée en malagasy casse la vérification des types, pas l'écran.
- Même principe que `apps/native/lib/i18n/`, donc familier.

**Cons**:
- Pas de pluriels ni de formats avancés (inutiles ici, mais à revoir si le web entier se traduit).
- Le serveur rend toujours le français : un visiteur qui a choisi le malagasy voit le français un court instant au chargement.

### Option 2: Une bibliothèque de traduction (i18next ou équivalent)

Installer une bibliothèque de traduction pour tout le web, et commencer par la landing page.

**Pros**:
- Prête pour traduire le back office plus tard.
- Pluriels, interpolation et détection de langue déjà faits.

**Cons**:
- Une dépendance et une configuration de plus, la veille de la démo, pour une seule page.
- Le back office n'a pas besoin de malagasy (l'équipe travaille en français).

### Option 3: Deux routes, `/` en français et `/mg` en malagasy

Chaque langue a sa propre adresse, rendue côté serveur.

**Pros**:
- Pas de flash de langue, et chaque langue est référencée par les moteurs.

**Cons**:
- Deux routes à garder synchronisées, et le choix « gardé dans le navigateur » devient une redirection.
- Plus de travail pour un gain de référencement faible aujourd'hui.

## Decision

**Chosen option**: Option 1: Page statique avec dictionnaires typés maison

La route `/` devient une landing page rendue côté serveur, avec ses textes dans deux dictionnaires typés `fr` et `mg`, des couleurs propres à la page, et un lien APK lu dans `VITE_APK_URL`.

**Implementation skills**: `shadcn` (`shadcn/ui`, `.agents/skills/shadcn/`) · `web-design-guidelines` (`vercel-labs/agent-skills`, `.agents/skills/web-design-guidelines/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`)

## Rationale

La contrainte qui pèse le plus est le temps : la démo est demain, et la page ne touche ni données ni règles métier. Une page statique avec deux dictionnaires se construit et se relit vite, sans nouvelle dépendance à apprendre. Le typage partagé entre `fr` et `mg` donne la garantie qui compte vraiment ici : aucune clé ne manque en malagasy. Une bibliothèque de traduction (option 2) se justifiera le jour où le web entier devra parler malagasy, pas pour une page. Les routes séparées (option 3) règlent un problème de référencement que Zay n'a pas encore.

Le rendu serveur en français est choisi parce que les aperçus de partage (WhatsApp surtout, très utilisé à Madagascar) et les moteurs lisent le HTML du serveur. Le prix à payer est un court affichage du français avant le malagasy pour qui l'a choisi, ce qui est acceptable pour une vitrine.

Les couleurs crème et jaune viennent de l'app mobile parce que la page vend cette app : le visiteur doit reconnaître ce qu'il installe, et les deux illustrations jaune et brun s'y fondent. Ces couleurs restent limitées à la page, pour ne pas toucher le back office.

Choix faits par l'architecte (avec l'option écartée) :
- **Variable de lien APK** : `VITE_APK_URL`, publique et optionnelle. Écarté : une adresse écrite dans le code, à changer à chaque build.
- **Adresse du site pour le partage** : `VITE_SITE_URL`, publique et optionnelle, parce que l'image Open Graph doit être une adresse complète et que l'hébergement n'est pas encore décidé (feature 8). Écarté : deviner l'adresse depuis la requête, fragile derrière un proxy.
- **Clé de stockage de la langue** : `zay.landing.lang` dans `localStorage`, lue après le premier rendu, chaque lecture et écriture entourée d'un `try/catch`. Écarté : un cookie lu par le serveur, plus juste mais plus de travail.
- **Images** : copiées dans `apps/web/public/landing/`, converties en WebP et réduites (environ 1200 px de large), avec `width` et `height` fixés pour éviter les sauts de mise en page. Écarté : les PNG d'origine (600 Ko à 1,1 Mo chacun).
- **Capture d'écran** : un fichier fourni par toi, posé à `apps/web/public/landing/app-screen.webp` (format portrait, environ 1080 × 2340). Écarté : une fausse interface dessinée en code.
- **Cadre de téléphone** : dessiné en CSS (bord arrondi, encoche simple), sans image de téléphone de marque.

## Feature design

**Data model sketch**:
Aucun. La page ne lit ni n'écrit en base de données.

**State transitions**:
Une seule donnée d'état côté navigateur, la langue : `fr` (par défaut) ↔ `mg`, changée par le bouton FR / MG.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/` (route TanStack Start, rendue côté serveur) | GET | aucun | HTML de la landing page en français | public | aucune erreur propre ; une variable absente dégrade la page sans la casser |
| `/landing/*.webp` (fichiers de `apps/web/public`) | GET | aucun | images | public | 404 si un fichier manque |

Aucun appel tRPC, aucune route serveur dans `apps/server`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Rendu de la page | tous les textes visibles et alternatifs | dictionnaire `apps/web/src/lib/landing/fr.ts` ou `mg.ts`, selon la langue courante |
| Rendu de la page | langue courante | `localStorage["zay.landing.lang"]` si la valeur vaut `fr` ou `mg`, sinon `fr` |
| Rendu de la page | attribut `lang` de `<html>` | dérivé de la langue courante (`fr` au rendu serveur) |
| Bouton « Télécharger l'app » | adresse du lien | `ENV.VITE_APK_URL` (généré par Varlock depuis `apps/web/.env.schema`) |
| Bouton « Télécharger l'app » | état désactivé et libellé « Bientôt disponible » | dérivé de `VITE_APK_URL` vide |
| Pied de page | ville, email, téléphone | constantes de `apps/web/src/lib/landing/contact.ts` : `Toliara, Madagascar`, `brayjuanico@gmail.com`, `+261 38 14 600 78` (lien `tel:+261381460078`) |
| Pied de page | année | `new Date().getFullYear()` au rendu |
| Pied de page | lien « Espace admin » | route existante `/login` |
| Balises `head` | titre et description | dictionnaire `fr` (rendu serveur) |
| Balises `head` | image de partage et adresse canonique | `ENV.VITE_SITE_URL` + `/logo.png` et `/` ; omises si vide |
| Héros et bloc chauffeurs | illustrations | `apps/web/public/landing/hero.webp` (depuis `Resource-zayapp/image-1.png`) et `driver.webp` (depuis `image-2.png`) |
| Héros | capture de l'app | `apps/web/public/landing/app-screen.webp`, fournie par toi |
| En-tête | logo | `apps/web/public/logo.png` (déjà présent) |
| Couleurs | crème, jaune, encre du jaune | `#f5f3ee`, `#f7c910`, `#7a5800`, repris de `apps/native/global.css` et déclarés sous une classe racine de la page |

**Key invariants**:
- `mg.ts` a exactement les mêmes clés que `fr.ts` (`mg` est typé `satisfies LandingCopy`, le type dérivé de `fr`).
- Aucun montant (abonnement, tarif) n'apparaît sur la page.
- Aucune trace de la marque du modèle de design : ni nom, ni logo, ni police (spec 0002, AC-7).
- Les tokens de couleur de la page ne modifient pas `packages/ui/src/styles/globals.css`.
- La page n'importe ni `@zay-app/db` ni `@zay-app/auth`, et n'appelle pas tRPC.

**Security model**:
Page publique, sans session ni donnée personnelle. Les deux variables sont publiques par nature (elles finissent dans le code du navigateur), elles ne portent aucun secret. Les liens externes (APK) n'ouvrent pas de nouvel onglet ; si l'un le fait un jour, il prend `rel="noopener"`. L'email et le téléphone affichés sont publics par choix de l'équipe.

**Configuration required**:
- `VITE_APK_URL` : adresse du fichier APK Android. Publique, type `url`, optionnelle (`@public @type=url @optional`). Vide : boutons « Bientôt disponible ».
- `VITE_SITE_URL` : adresse publique du site, sans barre finale, pour l'image de partage et l'adresse canonique. Publique, type `url`, optionnelle. Vide : ces deux balises sont omises.

Après l'ajout au `.env.schema`, lancer `bun run env:generate`.

**Critical test scenarios**:
- Happy path : ouvrir `/` avec `VITE_APK_URL` rempli, voir toutes les sections dans l'ordre, cliquer « Télécharger l'app » et obtenir l'adresse de l'APK, vérifie **AC-1**, **AC-2**, **AC-3**, **AC-6**.
- Langue : passer en MG, voir tous les textes changer et `<html lang="mg">`, recharger la page et retrouver le malagasy, vérifie **AC-7**, **AC-8**.
- Dégradé : `VITE_APK_URL` vide, les boutons sont désactivés avec « Bientôt disponible » et la page ne montre aucune erreur ; `localStorage` qui lève une exception, la page reste en français, vérifie **AC-6**, **AC-8**.
- Rendu serveur : `curl /` renvoie le HTML français avec titre, description et balises Open Graph ; sans `VITE_SITE_URL`, pas de `og:image` ni de `canonical`, vérifie **AC-10**.
- Régression : `/admin` sans session redirige toujours vers `/login`, vérifie **AC-1**.
- Petit écran : à 360 px, pas de défilement horizontal, cibles de 44 px au moins, vérifie **AC-12**.

## Build plan

Ordre Tracer Bullet : un fil fin de bout en bout d'abord (la vraie route `/` rendue côté serveur, avec le vrai bouton APK), puis chaque section épaissit la page.

1. [x] Ajouter `VITE_APK_URL` et `VITE_SITE_URL` à `apps/web/.env.schema`, puis lancer `bun run env:generate`, satisfies **AC-6**, **AC-10**
2. [x] Remplacer la redirection de `apps/web/src/routes/index.tsx` par la landing page rendue côté serveur, avec l'en-tête (logo), un héros minimal et le bouton « Télécharger l'app » branché sur `VITE_APK_URL` (lien ou « Bientôt disponible »), satisfies **AC-1**, **AC-6**
3. [x] Déclarer les couleurs crème et jaune sous une classe racine de la page, sans toucher les tokens partagés, satisfies **AC-11**
4. [x] Créer `apps/web/src/lib/landing/fr.ts` (tous les textes français), le type `LandingCopy`, et le contexte de langue (`fr` par défaut, `localStorage` protégé, mise à jour de `<html lang>`), satisfies **AC-7**, **AC-8**
5. [x] Copier et convertir les illustrations en `hero.webp` et `driver.webp` dans `apps/web/public/landing/`, et placer la capture `app-screen.webp` fournie par toi, satisfies **AC-3**, **AC-5**
6. [x] Compléter le héros (titre, accroche, illustration, capture dans un cadre de téléphone en CSS), satisfies **AC-3**
7. [x] Construire « Comment ça marche » (choisir sa destination, comparer les offres, suivre le chauffeur, payer en espèces) avec les quatre arguments, satisfies **AC-2**, **AC-4**
8. [x] Construire la section taxi et tuk-tuk, puis le bloc « Devenez chauffeur » sans montant, satisfies **AC-2**, **AC-5**
9. [x] Construire le bandeau final et le pied de page (contact, année, lien « Espace admin »), satisfies **AC-2**, **AC-9**
10. [x] Ajouter les balises `head` de la route (titre, description, Open Graph, `og:image` et `canonical` seulement avec `VITE_SITE_URL`), satisfies **AC-10**
11. [x] Écrire `apps/web/src/lib/landing/mg.ts` (traduction à relire par toi) et le bouton FR / MG dans l'en-tête, satisfies **AC-7**
12. [x] Vérifier le petit écran (360 px), les cibles tactiles, les textes alternatifs et le contraste du texte sur le jaune, satisfies **AC-12**

## Consequences

**Positive**:
- Un visiteur ou le jury comprend Zay et sait comment l'installer, au lieu de tomber sur une connexion admin.
- Le lien APK se change sans toucher au code, dès que la mise en ligne est décidée.
- Le web porte enfin la même identité que l'app mobile.

**Negative / tradeoffs**:
- Le malagasy est traduit par l'IA : il doit être relu avant d'être montré, sinon il peut sonner faux pour un public local.
- Un visiteur qui a choisi le malagasy voit le français un court instant à chaque chargement.
- Deux jeux de couleurs coexistent dans le web (page publique et back office), à garder séparés.
- La capture d'écran vieillit à chaque changement de l'app et doit être refaite à la main.
- L'email et le téléphone de contact sont écrits dans le code : les changer demande un déploiement.

**Neutral**:
- Le titre global « Zay Admin » de `__root.tsx` reste pour le back office ; la route `/` déclare son propre titre.
- Les textes sont propres au web, ils ne partagent pas les fichiers de `apps/native/lib/i18n/`.

## Follow-up

- [ ] Fournir la capture d'écran de l'app (`apps/web/public/landing/app-screen.webp`, portrait) avant ou pendant `/develop`.
- [ ] Relire le malagasy de `mg.ts` par un locuteur avant la démo.
- [ ] Remplir `VITE_APK_URL` et `VITE_SITE_URL` une fois la mise en ligne décidée (feature 8).
- [ ] Après le build, décrire la landing page dans `apps/web/AGENTS.md` (route `/` publique et rendue côté serveur, dossier `src/lib/landing/`).
