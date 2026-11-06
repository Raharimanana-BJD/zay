# Scope: Zay

Zay est une plateforme de réservation de taxis et de tuk-tuks à Toliara. Elle relie les clients et les chauffeurs dans une même application mobile, et donne à l'administration un back office web. Le détail fonctionnel se trouve dans `cahier_des_charges_plateforme_taxi_toliara.md`.

**Build approach:** Tracer Bullet (une vraie course marche d'abord de bout en bout, puis chaque tranche renforce ce fil).
**Workflow:** Alpha (`/check verify` après `/develop`). Le niveau de rigueur par défaut du projet. `/architect` est le premier arrêt conseillé pour une fonction avec une vraie décision, mais tu peux le passer si tu sais déjà comment la construire. Toute fonction peut porter son propre niveau (par exemple `· Beta`) pour en faire plus ou moins.

_Ce sont des recommandations pour garder une construction ordonnée, pas des obligations. Passe ce qui ne convient pas. C'est toi qui décides quand une fonction est `done`._

## Cible et décisions déjà prises

- **Rendu :** une démo complète qui marche, le 9/11/2026. Parcours montré sur un téléphone Android et sur le web, avec le serveur en ligne. Pas de publication sur un store, pas d'enquête terrain : les tarifs et les zones sont des valeurs de test configurables.
- **Si le temps manque :** coupe en partant du bas de la liste. L'ordre garantit qu'une course complète marche déjà.
- **Applications :** une seule application mobile avec deux rôles (client et chauffeur). L'administration et son équipe travaillent uniquement sur le web.
- **Connexion :** email et mot de passe.
- **Revenus :** abonnement chauffeur payé par Mobile Money. Les courses restent payées en espèces.
- **Langues :** français et malagasy.
- **Démo :** des chauffeurs simulés, pilotés depuis le web.
- **Règles ajoutées au cahier :** la recherche se met en pause tant qu'une offre est ouverte, une seule négociation à la fois, un chauffeur reste bloqué tant que son offre est ouverte, un lieu a toujours un point sur la carte (la description reste un complément), et un groupe d'un seul chauffeur est accepté.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Socle du projet | Foundation | existing |
| 1 | Normes et contexte du projet | Foundation | planned |
| 2 | Modèle de données | Foundation | in-progress |
| 3 | Application unique à deux rôles | Foundation | planned |
| 4 | Temps réel et notifications | Foundation | planned |
| 5 | Carte et itinéraires | Foundation | planned |
| 6 | Design system | Foundation | planned |
| 7 | Français et malagasy | Foundation | planned |
| 8 | Mise en ligne de la démo | Foundation | planned |
| 9 | Première course complète | Slice 1 | planned |
| 10 | Simulateur de chauffeurs | Slice 2 | planned |
| 11 | Distribution par groupes | Slice 3 | planned |
| 12 | Comparaison et attribution | Slice 3 | planned |
| 13 | Négociation encadrée | Slice 3 | planned |
| 14 | Catégories et capacité | Slice 4 | planned |
| 15 | Lieux et zones | Slice 4 | planned |
| 16 | Suivi du chauffeur | Slice 5 | planned |
| 17 | Annulations et incidents | Slice 5 | planned |
| 18 | Changement de destination | Slice 5 | planned |
| 19 | Paiement en espèces | Slice 5 | planned |
| 20 | Historique et revenus | Slice 5 | planned |
| 21 | Connexion instable | Slice 5 | planned |
| 22 | Dossier chauffeur et véhicules | Slice 6 | planned |
| 30 | Socle de l'espace admin | Slice 6 | in-progress |
| 23 | Validation des dossiers | Slice 6 | in-progress |
| 24 | Supervision et signalements | Slice 7 | in-progress |
| 25 | Réglages de tarifs et de distribution | Slice 7 | in-progress |
| 26 | Comptes et rôles d'accès | Slice 7 | in-progress |
| 27 | Statistiques essentielles | Slice 7 | in-progress |
| 28 | Abonnement chauffeur Mobile Money | Slice 8 | planned |
| 29 | Données de démo et répétition | Slice 9 | planned |

## Déjà en place

### A. Socle du projet · existing
Monorepo avec serveur, application mobile, web et base de données, déjà configuré avec la connexion par email et Ultracite. code in `apps/` et `packages/`

## Foundations

### 1. Normes et contexte du projet
Compléter le contexte que lisent tous les outils : aujourd'hui `AGENTS.md` ne contient que les règles Ultracite et rien sur Zay.
**Done when:** `AGENTS.md` décrit le produit, la pile technique, l'approche et les commandes, et Ultracite passe sans erreur.
- [ ] Capturer les conventions : `/audit`

### 2. Modèle de données · Beta · in-progress
Les entités de toute la plateforme : utilisateurs, chauffeurs, véhicules, réservations, offres, événements, paiements et abonnements. C'est la chose la plus chère à refaire.
spec [0001](../../specs/_root/0001-modele-donnees/index.md) · code in `packages/db/src/schema/`
**Done when:** le schéma couvre toutes les tranches ci dessous sans migration cassante, et garde l'historique des prix et des événements.
- [x] Design it (spec): `/architect modèle de données`
- [x] Build it: `/develop modèle de données`
  - [x] Socle : image PostGIS, extension et migrations (AC-1, AC-11)
  - [x] Comptes : plugin `admin`, téléphone et formulaires d'inscription (AC-2)
  - [x] Schéma complet, index partiels, CHECK et réglages de test (AC-1, AC-3 à AC-13, AC-15)
  - [x] Script de vérification d'une course complète et des refus attendus (AC-3 à AC-15)
- [x] Verify it: `/check verify modèle de données`
- [ ] Test it: `/test modèle de données`

### 3. Application unique à deux rôles · needs a decision
Une même application pour le client et le chauffeur, avec ses espaces, sa navigation et le choix du rôle à l'inscription. Elle remplace les écrans de départ du projet.
**Done when:** après connexion, un client et un chauffeur arrivent chacun dans leur espace, et un rôle ne peut pas ouvrir les écrans ni appeler les actions de l'autre.
- [ ] Design it (spec): `/architect application unique à deux rôles`

### 4. Temps réel et notifications · needs a decision
Comment demandes, offres et statuts arrivent sur les téléphones, y compris quand l'application est en arrière plan et sur un réseau faible.
**Done when:** un événement du serveur atteint le bon téléphone en quelques secondes, et une notification en retard ne permet jamais d'agir sur une offre expirée.
- [ ] Design it (spec): `/architect temps réel et notifications`

### 5. Carte et itinéraires · needs a decision
Afficher une carte de Toliara, placer un point, et obtenir une distance d'itinéraire. Le tarif en dépend.
**Done when:** on peut placer départ et destination sur une carte de Toliara et obtenir une distance, avec un calcul de secours si le service de carte échoue.
- [ ] Design it (spec): `/architect carte et itinéraires`

### 6. Design system · needs a decision
Le langage visuel commun au mobile et au web, lisible sur petit écran et simple à utiliser en conduite. À décider : garder ou non `DESIGN-shopify.md` comme référence.
**Done when:** couleurs, textes et composants de base sont définis pour le mobile et le web, et les montants en ariary s'affichent de la même façon partout.
- [ ] Design it (spec): `/architect design system`

### 7. Français et malagasy · needs a decision
Ranger tous les textes dans des fichiers de langue avant de construire les écrans, pour éviter de les reprendre ensuite.
**Done when:** on change de langue depuis le profil, et les textes, erreurs et notifications suivent. Le malagasy est relu par un locuteur.
- [ ] Design it (spec): `/architect français et malagasy`

### 8. Mise en ligne de la démo · needs a decision
Un serveur, une base et un back office accessibles en ligne, plus une application Android installable. Faite tôt pour découvrir les problèmes de déploiement avant le dernier jour.
**Done when:** l'application Android installée sur un vrai téléphone parle au serveur en ligne, et le back office s'ouvre dans un navigateur.
- [ ] Design it (spec): `/architect mise en ligne de la démo`

## Slice 1: La course de bout en bout

### 9. Première course complète · Beta · needs a decision
Le fil complet, volontairement étroit : un client demande une voiture, un chauffeur déjà validé la reçoit et accepte le tarif indicatif, puis le serveur fait avancer la course jusqu'à la fin. Cette tranche contient aussi le cycle des statuts et le calcul du tarif.
**Done when:** une course passe de la demande à `COMPLETED` entre deux comptes réels, le serveur refuse toute transition interdite, et un double clic ne crée pas deux réservations.
- [ ] Design it (spec): `/architect première course complète`

## Slice 2: Pouvoir tester seul

### 10. Simulateur de chauffeurs
Depuis le web, piloter des chauffeurs de test qui répondent, négocient et se déplacent, en passant par les mêmes règles serveur que les vrais. Il arrive tôt, car il te permet aussi de tester seul toutes les tranches suivantes.
**Done when:** un admin fait répondre et bouger plusieurs chauffeurs de test, et le simulateur est réservé aux admins et désactivable.
- [ ] Construire : `/develop simulateur de chauffeurs`

## Slice 3: Distribution et prix

### 11. Distribution par groupes · Beta · needs a decision
Solliciter 1 à 3 chauffeurs éligibles par groupe, 20 secondes par groupe, 3 secondes de pause, 4 groupes maximum. Cette tranche définit aussi le cycle de vie d'une offre et la pause de recherche.
**Done when:** les délais sont tenus par le serveur, un chauffeur ayant refusé n'est pas sollicité à nouveau, et s'il n'y a aucun chauffeur le client l'apprend avec `NO_DRIVER_FOUND`.
- [ ] Design it (spec): `/architect distribution par groupes`

### 12. Comparaison et attribution · Beta
Le client compare les offres et choisit. Le premier qui répond ne gagne pas automatiquement. S'appuie sur la spec de la distribution.
**Done when:** deux confirmations simultanées donnent un seul chauffeur attribué, un chauffeur ne peut pas être sur deux courses, et les autres offres deviennent caduques (scénario E).
- [ ] Construire : `/develop comparaison et attribution`

### 13. Négociation encadrée · Beta · needs a decision
Accepter, refuser ou faire une contre proposition, une maximum par partie, dans la limite de ±20 %, avec les motifs d'ajustement.
**Done when:** un prix hors limite ou une offre expirée sont refusés par le serveur, le prix est verrouillé après accord, et chaque action garde son auteur et son heure (scénario D).
- [ ] Design it (spec): `/architect négociation encadrée`

## Slice 4: Le vrai choix du client

### 14. Catégories et capacité
Voiture, tuk-tuk ou automatique, le nombre de passagers et un tarif par catégorie.
**Done when:** une catégorie choisie n'est jamais remplacée, le mode automatique identifie clairement chaque offre, et un véhicule trop petit n'est pas proposé (scénarios A, B et C).
- [ ] Construire : `/develop catégories et capacité`

### 15. Lieux et zones
Choisir un lieu par GPS, carte, quartier ou repère, avec une description en complément. L'administration gère les quartiers, les repères et les zones de service.
**Done when:** le client donne un lieu sans adresse postale et le tarif se calcule, un lieu hors zone est refusé clairement, et l'admin modifie quartiers et zones sans mise à jour de l'application.
- [ ] Construire : `/develop lieux et zones`

## Slice 5: Une course fiable

### 16. Suivi du chauffeur
Voir l'identité du chauffeur, son véhicule, sa position et l'avancement, et pouvoir l'appeler.
**Done when:** la position se met à jour pendant la course, et une position ancienne est signalée comme telle, jamais présentée comme actuelle.
- [ ] Construire : `/develop suivi du chauffeur`

### 17. Annulations et incidents · needs a decision
Annulation par le client ou le chauffeur, client absent, chauffeur absent, et signalement d'un problème. Le cahier laisse ouverts les délais d'attente et le remplacement d'un chauffeur.
**Done when:** chaque annulation garde son auteur et son motif, sans pénalité, l'autre partie est prévenue, et un chauffeur qui annule ne laisse pas le client sans issue.
- [ ] Design it (spec): `/architect annulations et incidents`

### 18. Changement de destination
Avant la prise en charge, recalculer le tarif et demander l'accord des deux parties. Si l'une refuse, la destination et le prix ne changent pas.
**Done when:** le nouveau prix ne s'applique qu'après l'accord du client et du chauffeur, et la modification est historisée.
- [ ] Construire : `/develop changement de destination`

### 19. Paiement en espèces · needs a decision
Séparer prix convenu, montant payé et statut du paiement. Le chauffeur déclare le montant, le client peut contester.
**Done when:** terminer une course ne marque pas le paiement comme reçu, un paiement partiel ou contesté se voit clairement, et une déclaration manquante ne bloque pas le chauffeur (scénario G).
- [ ] Design it (spec): `/architect paiement en espèces`

### 20. Historique et revenus
Le client revoit ses courses, le chauffeur voit son historique et ses recettes du jour.
**Done when:** chaque course affiche date, trajet, catégorie, prix et état du paiement, et les recettes distinguent montants convenus et montants encaissés.
- [ ] Construire : `/develop historique et revenus`

### 21. Connexion instable · Beta
Renforcer le fil complet face aux coupures de réseau, selon les règles de la fondation temps réel.
**Done when:** une course confirmée revient intacte après une coupure, les événements se synchronisent au retour du réseau, et une action envoyée deux fois n'agit qu'une fois (scénario F).
- [ ] Construire : `/develop connexion instable`

## Slice 6: Faire entrer les chauffeurs

### 22. Dossier chauffeur et véhicules · needs a decision
Le chauffeur complète son profil et sa relation professionnelle, envoie ses documents, enregistre ses véhicules et choisit celui qu'il utilise. Il passe en ligne et disponible.
**Done when:** le chauffeur envoie un dossier complet et suit son état, et seul un chauffeur disponible avec compte et véhicule validés reçoit des demandes.
- [ ] Design it (spec): `/architect dossier chauffeur et véhicules`

### 30. Socle de l'espace admin · in-progress · from spec 0002
Fermer le web à tout ce qui n'est pas l'équipe, poser la coquille `/admin`, le design noir et blanc, le premier admin et les données de test. Les fonctions 23 à 27 s'y branchent.
spec [0002](../../specs/_root/0002-espace-admin-web/0001-socle.md) · code in `apps/web/src/routes/admin/`, `packages/api/src/domain/`, `apps/server/scripts/`
**Done when:** seule l'équipe entre dans `/admin`, un support ne peut pas appeler une action admin, le design suit `DESIGN-uber.md` sous la marque Zay, et le seed remplit chaque écran.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop socle de l'espace admin`
  - [x] Accès : routes fermées, rôles, contexte tRPC, `admin:create` (AC-3, AC-4, AC-6)
  - [x] Coquille et design : jetons, Inter, `/login`, `/admin`, menu par rôle (AC-1, AC-2, AC-5, AC-7)
  - [x] Données de test : `seed:backoffice` et `booking-status.ts` (AC-8)
  - [x] Images et `app.json` du mobile (AC-9)
- [x] Verify it: `/check verify socle de l'espace admin`

### 23. Validation des dossiers · in-progress
Dans le web, consulter un dossier, puis approuver, rejeter, demander un complément ou suspendre.
spec [0002](../../specs/_root/0002-espace-admin-web/0005-validation-dossiers.md) · code in `packages/api/src/routers/admin/drivers.ts`, `apps/web/src/routes/admin/chauffeurs/`
**Done when:** chaque décision met à jour l'éligibilité aux demandes et reste dans l'historique, et le chauffeur voit le résultat dans son application.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop validation des dossiers`
  - [x] Fichiers : port `FileAccess` et route `/files/:key` (AC-31)
  - [x] Lecture : liste, détail et documents (AC-30, AC-31, AC-36)
  - [x] Décisions, suspension d'activité et réactivation (AC-32 à AC-36)
- [ ] Verify it: `/check verify validation des dossiers`

## Slice 7: Le back office

### 24. Supervision et signalements · in-progress
Voir les réservations, leurs statuts, leurs événements et les annulations, et traiter les signalements.
spec [0002](../../specs/_root/0002-espace-admin-web/0004-supervision-signalements.md) · code in `packages/api/src/routers/admin/bookings.ts`, `reports.ts`, `apps/web/src/routes/admin/reservations/`, `signalements/`
**Done when:** l'équipe retrouve une réservation et son historique complet, et fait avancer un signalement jusqu'à sa clôture.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop supervision et signalements`
  - [x] Lecture des réservations et chronologie (AC-21, AC-22)
  - [x] Annulation et litige (AC-23 à AC-26)
  - [x] Résolution d'un paiement contesté (AC-27)
  - [x] Signalements (AC-28, AC-29)
- [x] Verify it: `/check verify supervision et signalements`

### 25. Réglages de tarifs et de distribution · Beta · in-progress
Modifier tarifs, limite de prix, délais et tailles de groupe sans mise à jour de l'application, avec un journal d'audit.
spec [0002](../../specs/_root/0002-espace-admin-web/0002-reglages.md) · code in `packages/api/src/routers/admin/settings.ts`, `apps/web/src/routes/admin/_reserve/reglages.tsx`
**Done when:** un nouveau réglage s'applique aux nouvelles demandes sans toucher celles en cours, et chaque changement garde son auteur et ses anciennes valeurs.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop réglages de tarifs et de distribution`
  - [x] Routeur `admin.settings` et ses contrôles (AC-10 à AC-13)
  - [x] Formulaire, comparaison et conflit (AC-10, AC-12, AC-13)
  - [x] Historique des versions (AC-13)
- [ ] Verify it: `/check verify réglages de tarifs et de distribution`
- [ ] Test it: `/test réglages de tarifs et de distribution`

### 26. Comptes et rôles d'accès · in-progress
Gérer clients et chauffeurs, suspendre et réactiver, et distinguer administrateur et support.
spec [0002](../../specs/_root/0002-espace-admin-web/0003-comptes-equipe.md) · code in `packages/api/src/routers/admin/accounts.ts`, `team.ts`, `audit.ts`, `apps/web/src/routes/admin/clients/`, `_reserve/`
**Done when:** un compte suspendu ne peut plus agir, et un compte support traite les signalements sans pouvoir changer les réglages sensibles.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop comptes et rôles d'accès`
  - [x] Clients en lecture (AC-14)
  - [x] Suspension et réactivation avec audit (AC-15 à AC-17)
  - [x] Comptes équipe et rôles, à couper en premier (AC-18, AC-19)
  - [x] Journal (AC-20)
- [ ] Verify it: `/check verify comptes et rôles d'accès`

### 27. Statistiques essentielles · in-progress
Un tableau de bord simple sur les réservations, les annulations, les recherches sans chauffeur et l'activité des chauffeurs.
spec [0002](../../specs/_root/0002-espace-admin-web/0006-statistiques.md) · code in `packages/api/src/routers/admin/dashboard.ts`, `apps/web/src/routes/admin/index.tsx`
**Done when:** le tableau de bord affiche ces chiffres à partir des vraies données, avec des états vides propres.
- [x] Design it (spec): `/architect espace admin web`
- [x] Build it: `/develop statistiques essentielles`
  - [x] Requête `admin.dashboard.stats` (AC-37 à AC-39)
  - [x] Tuiles, période, filtre et états (AC-37, AC-39, AC-40)
  - [x] Courbes et barres (AC-38)
- [ ] Verify it: `/check verify statistiques essentielles`

## Slice 8: Les revenus

### 28. Abonnement chauffeur Mobile Money · Beta · needs a decision
Le chauffeur paie son abonnement par Mobile Money dans l'application. Le cahier place Mobile Money en version 2 : c'est donc un ajout, et seul l'abonnement est concerné. Il dépend d'un prestataire et de son accès de test.
**Done when:** un paiement réussi prolonge l'abonnement, un paiement échoué ou en double ne le prolonge pas à tort, l'admin voit les paiements, et un chauffeur expiré ne reçoit plus de demandes.
- [ ] Design it (spec): `/architect abonnement chauffeur Mobile Money`

## Slice 9: Préparer le jour J

### 29. Données de démo et répétition
Des comptes, chauffeurs, zones et tarifs de test prêts à charger, et une répétition complète sur le téléphone et le serveur en ligne.
**Done when:** les scénarios A à G du §21 du cahier passent sur l'environnement en ligne, et les données de démo se rechargent en une commande.
- [ ] Construire : `/develop données de démo et répétition`

## Deferred

Hors de cette version, gardé ici pour que le plan reste honnête.
- **Étude terrain :** vrais tarifs, zones et capacités à Toliara
- **Vrai lancement :** publication sur le store, documents légaux, politique de données · GA · needs a decision
- **Vérification du téléphone par SMS :** · needs a decision
- **Sécurité du back office :** changement forcé du mot de passe temporaire, double authentification pour les admins · from spec 0002
- **Protections issues de la relecture :** bouton d'urgence, numéros cachés avant attribution, une seule demande active par client
- **Changement de destination pendant la course :** · needs a decision
- **Version 2 du cahier :** réservation à l'avance, favoris, avis, statistiques de revenus détaillées, dépenses et maintenance, Mobile Money pour les courses, promotions
- **Version 3 du cahier :** plusieurs villes, flotte et propriétaires, fidélité, analyses avancées, tarification avancée, partenariats

## Legend

**The decision box.** Chaque fonction conçue porte une seule case dont le libellé finit par `(spec)`. Les autres cases sont des cases d'exécution.

**Cycle de vie d'une fonction :**

| State | Set by | La fonction affiche |
|---|---|---|
| `planned` · needs a decision | `/scope` | une case : `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | `/architect` à la capture de la spec | `Design it` cochée, spec liée, `Build it: /develop <feature>` avec 2 à 5 étapes, puis les cases de fin selon le niveau |
| `in-progress` (building) | `/develop` | les étapes se cochent une à une, le chemin du code est rempli |
| `in-progress` (verified) | `/check verify` | `Build it` et `Verify it` cochées |
| `done` | toi, quand tu le décides ; `/sync` réconcilie | fin conseillée : `Prototype` après `/develop`, `Alpha` après `/check verify`, `Beta` et `GA` après `/test` |

- **Prochaine étape :** la première case non cochée.
- **needs a decision :** passe d'abord par `/architect`, sinon va directement à `/develop` (ou `/audit` pour les normes). Le tag disparaît une fois la spec capturée.
- **Les tâches détaillées** vivent dans le `## Build plan` de la spec, pas ici.
- **Statuts :** `planned` → `in-progress` → `done`, plus `existing` (avant ce processus) et `dropped` (retiré, gardé pour l'historique).
- **Tag de niveau** à côté d'un titre (par exemple `· Beta`) : remplace le niveau par défaut pour cette fonction.
- **Workflow :** ce qui suit `/develop`. **Prototype** rien, **Alpha** `/check verify`, **Beta** `/check verify` puis `/test`, **GA** ajoute `/check review` puis `/document`. Une fonction construite sur une spec `Assumed` reste signalée, sans bloquer `done`.
- **Ligne de renvoi** (`spec <n> · code in <path>`) : le lien de spec est ajouté par `/architect`, le chemin du code par `/develop`.
