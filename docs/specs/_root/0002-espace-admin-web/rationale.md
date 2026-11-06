# 0002. Espace admin du web : raisonnement

## Context

> ⚠️ Premise note : ce sujet couvre six décisions liées, d'où une spec parapluie. Il est aussi très large pour une démo le 9/11, soit dans 3 jours, alors que les fonctions 3, 4, 5, 8 et 9 ne sont pas commencées. Ton plan dit de couper en partant du bas, et le back office est tout en bas. Si tu le construis avant la fonction 9, tu risques un back office complet sans vraie course à superviser. Tu as choisi de garder les cinq modules. La spec le permet, et nomme un ordre de coupe, mais la première course devrait rester prioritaire sur tout ce qui est ici.

> Hypothèses sans spec : le stockage de fichiers (fonction 22) et le cycle de statuts en code (fonction 9). Le premier est isolé derrière un port, le second est écrit une seule fois dans `transitionBooking`.

Le web contient encore les pages de départ, et `protectedProcedure` ne contrôle aucun rôle. Le cahier (§3.4) demande de fixer les droits du support avant de construire. La spec 0001 a déjà livré les tables, les journaux et le plugin `admin`, sans aucun endpoint.

Forces principales :
- Les règles métier doivent rester sur le serveur.
- Les écritures de comptes passent par Better Auth, qui coupe aussi les sessions.
- Le plugin `admin` expose ses routes sur HTTP à tout admin connecté. `/admin/set-role` et `/admin/update-user` contourneraient donc `audit_log`.
- Les fonctions dont les écrans dépendent (9, 17, 19, 22) n'existent pas encore.
- Une seule personne construit, avec très peu de temps.

## Options considered

### Option 1 : routeur `admin` unique, socle et modules, sans migration

Des procédures tRPC dédiées lisent par Drizzle et écrivent par des fonctions de domaine. Better Auth n'est appelé que par `auth.api`.

**Pros**: une seule règle de droits ; écritures et journal dans le même endroit ; aucun changement de schéma.
**Cons**: plus de procédures à écrire ; une petite fenêtre entre la vérification et `banUser`.

### Option 2 : réutiliser le client admin de Better Auth dans le web

`authClient.admin.listUsers`, `banUser` et `setRole`, directement depuis le navigateur.

**Pros**: la gestion de comptes est presque gratuite.
**Cons**: la garde sur course active et `audit_log` deviendraient contournables ; le rôle `support`, sans droit dans le plugin, ne pourrait rien lire.

### Option 3 : un `ac` et des rôles personnalisés dans le plugin

Déclarer `support`, `client` et `driver` dans `createAccessControl`.

**Pros**: des permissions déclaratives et standard.
**Cons**: un second système de droits à côté de tRPC, pour des règles (course active, dossier complet) qu'il ne sait pas exprimer.

### Option 4 : une table de permissions en base

Des droits modifiables depuis l'interface.

**Pros**: le plus souple.
**Cons**: une migration et des écrans pour un besoin qui tient en deux rôles.

## Rationale

L'option 1 est la seule qui garde ensemble l'action, sa garde et sa trace. Deux rôles fixes tiennent en deux procédures : c'est simple à relire, et simple à vérifier.

Décisions de détail :
- **`disabledPaths` sur toutes les routes `/admin/*`** : le code de Better Auth 1.7.12 ne teste cette liste que dans le routeur HTTP. Les appels serveur `auth.api` continuent donc de marcher.
- **`createUser` pour les scripts** : sans session ni requête, il est permis côté serveur, et il hache le mot de passe.
- **Pas de liste `roles` dans le plugin** : sans elle, `setRole` accepte `support`, et `hasPermission` refuse tout rôle inconnu. C'est le comportement voulu. Ce point dépend de la version : à revérifier à chaque mise à jour de Better Auth, ce que `/check verify` couvre avec AC-3 et AC-19.
- **Pagination par page** plutôt que curseur : le volume est faible, et les numéros de page sont plus pratiques au support.
- **Paiement résolu : `declared_amount_ar` prend le montant retenu.** Les revenus de la spec 0001 lisent cette colonne, donc ils suivent la décision. Le montant d'origine reste dans le `payment_event` `declared`. L'autre option, une colonne `retained_amount_ar`, demanderait une migration.
- **Documents courants** : la phrase de 0001 « ses documents courants » est lue ainsi : les pièces personnelles (`vehicle_id` nul) pour le chauffeur, et les pièces du véhicule pour ce véhicule. Sinon, un second véhicule en attente bloquerait un chauffeur déjà prêt.
- **Design** : tu as demandé de cloner l'interface d'Uber. La spec reprend le langage visuel de `DESIGN-uber.md`. Elle exclut le nom, le logo, les illustrations et la police UberMove, qui sont protégés, et le back office d'Uber n'est pas public. Elle garde ta marque.
- **Rouge** : `DESIGN-uber.md` interdit tout accent, mais il décrit des pages vitrine. Une action de suspension exige un repère. L'écart est limité au danger et aux erreurs.
- **`--mute` `#afafaf`** : ce gris a un contraste de 2,2:1 sur blanc, sous le minimum de 4,5:1. Il ne sert donc qu'aux éléments décoratifs, et les textes de faible importance et les indications de champ utilisent `#5e5e5e`.
- **Champs de saisie** : `DESIGN-uber.md` se contredit (`rounded.none` dans l'en-tête, 8 px dans le texte). La spec suit 8 px.
- **Contre vérification** : une relecture par un autre modèle a trouvé des trous sur le téléphone, le double clic, un accès du support aux comptes admin, le seed et les erreurs par champ. Tu as accepté les corrections recommandées. Elle a aussi conduit à placer la gestion de l'équipe en tête de la liste de coupe, car `admin:create` et le seed fournissent déjà les rôles.
