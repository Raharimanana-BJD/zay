# 0001. Modèle de données : raisonnement

## Context

> ⚠️ Premise note: ce schéma compte 25 nouvelles tables et la démo est le 9/11/2026, dans trois jours. Le risque est de passer ce temps sur des tables qui ne serviront qu'en fin de plan, alors que ton scope dit de couper en partant du bas de la liste. La réponse retenue est de décrire tout le schéma, mais de ne pas écrire de logique pour une tranche tant qu'elle n'est pas commencée. Une table vide ne coûte presque rien, et une migration cassante coûterait bien plus cher. Si le temps manque pendant la construction, les tables d'abonnement sont les premières à pouvoir attendre, car les ajouter plus tard ne casse rien.

Zay relie des clients et des chauffeurs à Toliara, autour d'une course dont le prix se négocie. Le schéma actuel ne contient que les tables de Better Auth. C'est le choix le plus coûteux à refaire, car chaque tranche du scope en dépend.

Plusieurs contraintes pèsent sur ce choix. Le cahier demande de garder chaque prix, auteur, motif et événement. Deux actions simultanées ne doivent jamais attribuer une course deux fois. Le réseau est instable, donc une même action peut arriver plusieurs fois. Les réglages changent sans toucher aux demandes en cours. Il n'y a pas d'adresse postale, donc un lieu est d'abord un point sur une carte.

Le projet utilise Drizzle `1.0.0-rc.5`, Better Auth et Postgres en local. Aucun hébergeur n'est encore choisi. Le développement se fait seul, avec peu de temps avant la démo. Sans décision commune maintenant, chaque tranche inventerait sa propre façon de stocker son historique.

## Options considered

### Option 1: État actuel plus journaux

Chaque objet garde son état actuel dans une ligne. Des tables en ajout seul gardent l'historique, et des index uniques partiels garantissent les règles de concurrence.

**Pros**:
- Lecture directe de l'état, sans calcul.
- Historique complet, écrit dans la même transaction que l'état.
- Les doubles attributions sont bloquées par la base.

**Cons**:
- L'état et le journal peuvent diverger si le code oublie d'écrire l'un des deux.
- Beaucoup de tables à définir dès le départ.

### Option 2: Event sourcing

Seuls les événements font foi, et l'état est recalculé ou projeté à partir d'eux.

**Pros**:
- L'historique est la source de vérité, et aucune divergence n'est possible.
- On peut reconstruire de nouvelles vues à partir du passé.

**Cons**:
- Il faut écrire et maintenir les projections.
- Les contraintes d'unicité sont plus difficiles à garantir au moment de l'écriture.
- Trop lourd pour le délai.

### Option 3: Colonnes sur quelques tables

Une réservation et ses offres portent toutes leurs valeurs, avec des colonnes d'horodatage et de prix, sans journal.

**Pros**:
- Très peu de tables, très rapide à écrire.

**Cons**:
- Ne répond pas à l'exigence du cahier (§9.10 et §15) : auteur, motif et valeurs successives sont perdus.
- Le changement de destination et le remplacement d'un chauffeur écrasent des données.

## Rationale

L'option 1 répond aux trois forces principales à la fois : un historique complet exigé par le cahier, une garantie de concurrence qui tient même si le code se trompe, et un schéma qu'une seule personne peut construire et comprendre en trois jours. L'event sourcing protège mieux contre la divergence, mais il ajoute des projections, et ses garanties d'unicité sont plus difficiles à obtenir. L'option 3 est plus rapide le premier jour, mais elle perd justement ce que le critère de fin de la fonction demande de garder.

Tes choix précisent ce modèle :

- **Réservation en une table** : un remplacement de chauffeur reste la même réservation, et l'historique se lit sans jointure entre une demande et une course.
- **Un rôle par compte** : les contrôles restent simples. `driver_profile` étant séparé, on pourra assouplir cette règle plus tard sans migration cassante.
- **Réglages versionnés** : la même table donne la règle « ne pas toucher aux demandes en cours » et le journal d'audit, au lieu de deux mécanismes.
- **Offre et propositions** : le dernier prix se lit sur l'offre, et chaque étape reste tracée avec son auteur et son motif.
- **Un devis par catégorie** : cela gère le mode automatique et le changement de destination sans colonnes en plus.
- **Enum de catégories** : le cahier (§5.3) parle de catégories configurables par l'administration. Tu as préféré une liste fixe, car seules deux catégories existent au lancement, et les écrans dynamiques coûteraient bien plus. Les tarifs et capacités restent réglables.
- **Un chauffeur par véhicule** : la gestion de flotte est en version 3 du cahier.
- **Base et serveur** : Postgres garantit la concurrence, et le serveur transforme ce refus en message clair.
- **Identifiant d'action** : la base garantit qu'une action ne s'applique qu'une fois, sans table de clés à nettoyer.
- **Motifs en code plus note** : les listes du cahier vont bouger (§9.4), et ajouter un motif ne demande aucune migration.
- **Pas de vraie suppression** : aucune course ne perd son historique. La politique de conservation pourra plus tard anonymiser les comptes.
- **Notifications reportées** : elles dépendent du choix du temps réel, encore ouvert, et leur ajout ne casse rien.

**PostGIS plutôt que des colonnes simples.** Ma recommandation était des colonnes simples, car une seule ville ne demande pas d'index spatiaux et l'image choisie n'incluait pas PostGIS. Tu as choisi PostGIS, et c'est un choix solide : les calculs de zones et de distance deviennent du SQL éprouvé au lieu de code maison. Le coût à accepter consciemment est la dépendance à l'hébergeur : la fonction 8 doit choisir un service qui propose PostGIS. Aucune de tes images locales (`postgres:16-alpine`, `postgres:17.11-alpine`, `postgres:alpine`) ne contient PostGIS, d'où `postgis/postgis:17-3.6-alpine`. Drizzle fournit le type `geometry` point, mais pas de type `geography` ni de polygone. La spec utilise donc `geometry` en 4326, avec une conversion en `geography` pour les distances en mètres, et un `customType` pour les zones.

**Vraies migrations.** Tu as préféré tout livrer en vraies migrations plutôt que `db:push`. PostGIS exige de toute façon un `CREATE EXTENSION`, et la base en ligne se mettra à jour exactement comme la base locale.

**Protection des journaux.** J'ai retenu une convention de code, sans déclencheur Postgres. Un déclencheur serait plus sûr, mais il compliquerait l'anonymisation future et il n'est pas indispensable pour la démo. Si un litige réel doit s'appuyer sur ces journaux, ce choix mérite d'être revu avant un vrai lancement.
