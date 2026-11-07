# 0005.0002. Photo de profil

## Summary

Tout utilisateur peut ajouter, changer ou retirer une photo de profil, prise avec la caméra ou choisie dans la galerie, puis recadrée en carré. Pendant une course active, chacun voit la photo de l'autre. La photo est facultative pour tous, chauffeurs compris.

Raison courte : un type de fichier `avatar` à part garde intactes les règles strictes des papiers d'identité, et ouvre l'envoi à tous les rôles.

## Feature design

**Data model** : `user.image` (texte, nullable, déjà présent) contient la clé `up-avatar-<userId>-<uuid>.png|jpg`, jamais une URL. L'URL se calcule à la lecture (`files.getUrl`). Seul `me.setImage` écrit ce champ : le hook « before » de Better Auth refuse `image` sur `/update-user` et `/sign-up/email` (400), et un compte Google est créé avec `image: null` (`mapProfileToUser`), car la photo Google est une URL externe que l'on n'utilise pas.

**API surface**
| Endpoint | Méthode | Entrées | Sorties | Auth | Erreurs |
|---|---|---|---|---|---|
| `/files/avatar` | POST | octets de l'image | `{ key }` (contient l'id du demandeur) | session, tout rôle, profil complet | 413 `FILE_TOO_LARGE` (> 5 Mo), 415 `FILE_TYPE_NOT_ALLOWED`, 403 `PROFILE_INCOMPLETE` |
| `me.setImage` | mutation | `storageKey` (regex `up-avatar-<id du demandeur>-…`) | rien | session | `BAD_REQUEST` si la clé n'est pas celle du demandeur ou n'existe pas sur le disque |
| `me.removeImage` | mutation | rien | rien | session | rien |
| `me.get` | query | rien | `+ imageUrl: string \| null` | session | rien |
| `client.booking` | query | `id` | `driver.imageUrl` | client propriétaire | rien |
| `driver.ride` | query | `id` | `clientImageUrl` | chauffeur de la course | rien |
| `/files/:key` (avatar) | GET | clé | image | voir sécurité | 401, 403, 404 |

`me.setImage` et `me.removeImage` effacent du disque l'ancien fichier avatar, seulement si l'ancienne valeur correspond à `UPLOAD_AVATAR_KEY` pour ce même utilisateur (jamais une URL ni le fichier d'un autre). Une suppression qui échoue est ignorée, elle ne bloque jamais.

`client.booking.driver.imageUrl` n'existe qu'une fois un chauffeur attribué (statut `ACCEPTED` ou après). La photo du client n'apparaît pas dans les demandes de course ni dans les offres reçues par le chauffeur : seulement dans `driver.ride`.

**Value sourcing**
| Action | Valeur | Source |
|---|---|---|
| Profil | photo affichée | `me.get.imageUrl` ← `user.image` |
| Profil | initiale de secours | première lettre de `me.get.name` (déjà en place) |
| Suivi client | photo du chauffeur | `client.booking.driver.imageUrl` ← `user.image` du chauffeur attribué |
| Course chauffeur | photo du client | `driver.ride.clientImageUrl` ← `user.image` du client |
| Envoi | image recadrée | `expo-image-picker`, `allowsEditing: true`, `aspect: [1, 1]`, `quality: 0.6` |

**Security model** (`GET /files/up-avatar-…`) : session obligatoire. Lecture permise si (a) `user.image` du demandeur est cette clé, (b) le demandeur est de l'équipe (`isStaffRole`), ou (c) un `booking` a cette clé comme avatar de son client ou de son chauffeur attribué, avec le demandeur comme autre partie, et un statut dans `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED`, `IN_PROGRESS`. Sinon 403. Les images de l'app passent par `AuthImage` (cookie envoyé à la main).

**UX** : l'avatar du profil devient touchable (petite pastille caméra jaune en bas à droite). Le menu est une `Sheet` à 2 ou 3 lignes. Pendant l'envoi, un spinner sur l'avatar. Une erreur affiche un toast et garde l'ancienne photo. Dans les écrans de course, l'avatar de 48 px s'affiche à côté du nom de l'autre partie.

**Critical test scenarios** :
- Changer de photo depuis la galerie : la nouvelle s'affiche, l'ancien fichier disparaît du disque, verifies **AC-5**
- Pendant une course acceptée, le client voit la photo du chauffeur ; une fois la course terminée, la même URL renvoie 403, verifies **AC-6**, **AC-7**
- Un autre client demande l'avatar : 403, verifies **AC-7**
