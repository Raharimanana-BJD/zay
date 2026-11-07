# 0004. Rationale : compléter l'authentification

## Context

Zay se connectait par email et mot de passe, sans vérifier l'adresse. N'importe qui pouvait ouvrir un compte avec l'email d'un autre, et un mot de passe oublié n'avait aucune issue : il fallait passer par l'équipe. Le mobile (Expo) sert les clients et les chauffeurs, le web sert seulement l'équipe. La démo a lieu le 9/11/2026, sur un téléphone Android, avec le serveur en ligne sur Dokploy.

Les contraintes sont fortes. Le mobile n'a pas de domaine web pour des liens profonds fiables, et beaucoup d'utilisateurs lisent leurs emails sur le même téléphone, avec un réseau lent. Le téléphone est obligatoire et unique pour chaque compte, car le chauffeur et le client s'appellent. L'auth repose déjà sur Better Auth, et les règles du projet interdisent aux applications d'importer les paquets serveur. Les paquets partagés ne lisent pas l'env.

Ce module a d'abord été construit sur une hypothèse (`/develop`, statut `Assumed`), puis ratifié ici. Les choix de flux, de codes et de blocage de connexion venaient de l'ingénieur ; la ratification a ajouté la production (fournisseur SMTP, expéditeur, échecs d'envoi), les limites de débit, la confiance donnée aux comptes existants, et deux flux à construire plus tard : le changement d'email et la suppression du compte.

## Options considered

### Option 1 : codes par email avec le plugin `emailOTP`, Nodemailer et React Email

Better Auth génère, hache, limite et vérifie les codes. Le serveur fournit l'envoi par SMTP, avec des modèles React Email. Le même mécanisme sert à la vérification, au mot de passe oublié, et plus tard au changement d'email.

**Pros** :
- Marche à l'identique sur mobile et sur web, sans lien profond ni page intermédiaire.
- Aucune table nouvelle : la table `verification` existe déjà.
- SMTP standard : on change de fournisseur en changeant une variable.

**Cons** :
- Saisir un code est un peu plus lent que toucher un lien.
- Un code à 6 chiffres se devine plus facilement qu'un jeton long ; il faut des essais limités et une expiration courte.

### Option 2 : liens de vérification et de réinitialisation (flux par défaut de Better Auth)

L'email contient un lien vers le serveur, qui redirige vers l'application ou une page web.

**Pros** :
- Un seul toucher pour l'utilisateur.
- Jeton long, donc très difficile à deviner.

**Cons** :
- Sur mobile, il faut des liens profonds ou une page web relais, et le lien ouvert dans le navigateur d'un autre appareil ne connecte pas l'application.
- Deux parcours différents à maintenir (mobile et web).

### Option 3 : un service d'email par API (SDK d'un fournisseur)

Envoyer par l'API HTTP d'un fournisseur au lieu de SMTP.

**Pros** :
- Statistiques de livraison et webhooks.

**Cons** :
- Lie le code à un fournisseur. Pour la démo, l'ingénieur a choisi Gmail, qui ne s'utilise que par SMTP.

## Rationale

Le code à 6 chiffres répond à la contrainte mobile : il ne demande ni domaine, ni lien profond, ni page web, et il fonctionne quand l'email est lu sur un autre appareil. Le plugin `emailOTP` de Better Auth donne le hachage, les essais limités et l'expiration sans code maison, ce qui évite le piège classique de l'auth faite à la main. La durée passe à 10 minutes pour tenir compte du réseau lent, et les 3 essais compensent la faible longueur du code.

Nodemailer avec SMTP garde l'envoi indépendant du fournisseur. C'est ce qui permet de démarrer avec Gmail pour la démo, puis de passer à un fournisseur avec domaine vérifié sans toucher au code. L'ingénieur a préféré Gmail à Brevo, qui était recommandé. Gmail marche pour la démo, mais il impose son adresse comme expéditeur (le `no-reply@zay.mg` souhaité serait réécrit), limite le volume, et ses mails partent plus souvent en spam. Ce compromis est accepté consciemment et noté en Follow-up pour le lancement.

Bloquer la connexion des comptes non vérifiés est plus strict que nécessaire pour une démo, mais c'est le choix de l'ingénieur, et il protège contre les comptes au nom d'autrui. Le coût est compensé de deux façons. Les comptes créés par l'équipe sont vérifiés d'office, puisque l'équipe se porte garante de l'adresse. Une migration fait aussi confiance à tous les comptes existants, pour que personne ne soit bloqué au déploiement. Les réponses ne changent pas quand l'envoi échoue, sinon le temps de réponse révélerait quels emails ont un compte. L'échec est écrit dans les logs, et l'utilisateur peut redemander un code.

Pour la partie 2, la suppression anonymise au lieu d'effacer, car le modèle de données (spec 0001) doit garder l'historique des prix et des événements. Elle passe par une procédure tRPC maison plutôt que par la route `delete-user` de Better Auth, qui envoie un lien et efface la ligne. La confirmation par code fonctionne aussi pour un compte lié à Google sans mot de passe. Le changement d'email réutilise le plugin `emailOTP`, qui couvre déjà ce flux. Le code part seulement à la nouvelle adresse, pour ne pas bloquer quelqu'un qui a perdu l'ancienne boîte, et un avis à l'ancienne adresse permet de repérer un changement non voulu.
