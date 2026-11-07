# 0005. Retouches de l'interface mobile : raisonnement

## Context

Le nouveau design mobile vient d'être construit d'après `Resource-zayapp/Zay App Redesign.pdf`. L'essayer a fait ressortir sept demandes. Certaines sont purement visuelles (splash, onglets, carte). D'autres touchent des règles fixées ailleurs :

- **Le téléphone est obligatoire** en base (`user.phone NOT NULL UNIQUE`). C'est pour ça que la spec 0004 limite Google aux comptes existants : Google ne fournit pas de numéro.
- **Le serveur n'accepte que PNG et JPEG**, reconnus par leurs premiers octets, 5 Mo maximum, et seulement de la part d'un chauffeur. Les papiers d'identité ne sont lisibles que par l'équipe.
- **Le back office affiche les documents avec une `<img>`**, qui ne sait pas montrer un PDF.
- **`driver_document.expires_at` n'est rempli par personne.** La règle qui bloque un chauffeur dont un document a expiré ne se déclenche donc jamais.
- **Le splash natif d'Android est une image fixe**, qui ne peut pas s'animer.

L'app vise une démo à Toliara, sur des Android d'entrée de gamme avec une connexion faible. La taille des fichiers et le nombre d'allers retours comptent.

## Options considered

### Téléphone d'un compte créé par Google

**Option A : téléphone facultatif en base + écran bloquant « Compléter mon profil ».** Une migration additive, puis une garde serveur sur les actions métier.
- Pros : aucune donnée fausse en base ; le serveur reste la source de vérité (règle du projet).
- Cons : chaque lecture du téléphone doit gérer `null` ; il faut une garde serveur et un écran de plus.

**Option B : valeur provisoire unique** (par exemple `pending:<uuid>`) dans la colonne obligatoire.
- Pros : pas de migration.
- Cons : une donnée fausse qu'il faut filtrer partout (back office, appels, exports). Un oubli affiche un faux numéro au chauffeur.

### Splash animé

**Option A : splash natif fixe, puis écran animé dessiné par l'app**, avec les mêmes couleurs et la même position du logo, pour un seul écran perçu.
- Pros : aucune dépendance, fonctionne sur tous les Android, l'animation suit le chargement réel.
- Cons : deux éléments à garder identiques (`app.json` et le composant).

**Option B : animation Lottie ou vidéo au démarrage.**
- Pros : animation plus riche.
- Cons : nouvelle dépendance native et un fichier d'animation à produire, pour trois points.

### Envoi des documents

**Option A : préparer chaque document, puis un seul envoi groupé** où chaque fichier part seul. C'est le choix de l'ingénieur.
- Pros : un seul geste final ; un échec n'annule pas les autres.
- Cons : un état local « Prêt » à gérer, perdu si l'app est fermée avant l'envoi.

**Option B : envoi immédiat document par document** (comme aujourd'hui).
- Pros : rien n'est perdu.
- Cons : quatre envois séparés à suivre ; ce n'est pas ce que l'ingénieur a demandé.

### Rangement de l'avatar

**Option A : nouveau type `avatar`.**
- Pros : envoi ouvert à tous les rôles, droits de lecture précis, rien ne change pour les papiers d'identité.
- Cons : un type de plus dans `files.ts`.

**Option B : réutiliser `photo`.**
- Pros : moins de code.
- Cons : envoi réservé aux chauffeurs, photo lisible par tout compte connecté.

## Rationale

- **Téléphone facultatif** : le projet veut que les règles vivent sur le serveur. Une garde `PROFILE_INCOMPLETE` honnête vaut mieux qu'une fausse valeur qui fuit dans l'interface d'un chauffeur. Postgres garde l'unicité même avec plusieurs valeurs vides, donc rien ne se perd.
- **Splash en deux temps** : Android ne peut pas animer son splash natif. Prolonger le même visuel par un écran de l'app est la voie standard d'Expo, sans dépendance de plus. L'écran remplace le `Loading` de démarrage, qui existe déjà.
- **PDF reconnu par son contenu** : on garde la règle actuelle (« le contenu décide, jamais le nom »), qui protège d'un fichier déguisé. Le PDF se lit à `%PDF`. 10 Mo parce qu'un scan de plusieurs pages dépasse vite 5 Mo. Les photos restent à 5 Mo, compressées par l'app.
- **Le chauffeur lit ses propres documents** : c'est nécessaire pour l'aperçu de l'AC-15. Le droit reste limité au propriétaire du document ; l'équipe garde l'accès à tout.
- **L'équipe saisit l'expiration** : une date lue sur la pièce est plus fiable qu'une date déclarée. Cela active une règle qui dormait.
- **Seuil « Expire bientôt » à 30 jours** (choix de l'architecte) : le temps de renouveler une assurance à Madagascar. 15 jours serait trop court pour un renouvellement administratif.
- **Contrôles de carte par commandes JavaScript dans la WebView** (choix de l'architecte), plutôt qu'une deuxième bibliothèque de carte : on reste sur Leaflet, déjà en place et léger.
