# 0005.0004. Documents chauffeur : PDF, envoi groupé, bloc refait

## Summary

Le chauffeur peut joindre chaque document en photo, en image de la galerie ou en PDF. Il prépare ses documents, puis les envoie tous d'un seul bouton. Le bloc Documents montre la progression, l'aperçu, le motif de l'équipe et la date d'expiration. Côté back office, l'équipe lit les PDF et saisit la date d'expiration en validant.

Raison courte : le PDF est reconnu par son contenu (comme PNG et JPEG aujourd'hui), avec une limite de 10 Mo pour les documents seulement.

## Feature design

**Data model** : pas de migration. `driver_document.storage_key` accepte `up-doc-<uuid>.pdf`. `expires_at` est désormais écrit par l'équipe seulement : `expiresAt` est retiré de l'entrée de `driver.attachDocument` (aujourd'hui le chauffeur peut l'envoyer). Un document remplacé repart sans date, jusqu'à la prochaine validation. Le motif vient de `verification_decision` (`subject = 'document'`, `subject_id` = id du document), la plus récente.

**Serveur fichiers** (`apps/server/src/files.ts`, `index.ts`) :
- `storeUpload(bytes, kind)` : `doc` accepte aussi `%PDF` (`0x25 0x50 0x44 0x46`) → extension `pdf`. `photo` et `avatar` restent PNG et JPEG.
- Limite par type : 10 Mo pour `doc`, 5 Mo pour `photo` et `avatar`, par un wrapper qui choisit `bodyLimit` selon `:kind`. Dépassement → 413 `{ code: "FILE_TOO_LARGE" }`.
- Droits d'envoi : `doc` et `photo` restent réservés au rôle `driver`, `avatar` est ouvert à tous les rôles. Tous exigent un profil complet.
- `GET /files/:key` : `Content-Type` `application/pdf` pour `.pdf`, `Content-Disposition: inline`, et `Content-Security-Policy: sandbox` (comme pour tous les fichiers). Lecture d'un `up-doc-…` : l'équipe, ou le chauffeur pour qui `driver_document.driver_id = session.user.id AND storage_key = key` existe (même document remplacé ; la requête s'appuie sur l'index `driver_document_driver_id_idx`).
- `UPLOAD_DOC_KEY` (API) accepte `.pdf`.

**API surface**
| Endpoint | Méthode | Entrées | Sorties | Auth | Erreurs |
|---|---|---|---|---|---|
| `/files/doc` | POST | octets (PNG, JPEG, PDF) | `{ key }` | chauffeur | 413, 415 |
| `driver.attachDocument` | mutation | `typeCode`, `storageKey` | rien | chauffeur | inchangé |
| `driver.dossier` | query | rien | par document : `+ fileKind: "image" \| "pdf"`, `+ fileUrl`, `+ sentAt`, `+ expiresAt`, `+ reasonCode`, `+ reasonNote` | chauffeur | rien |
| `admin.drivers.decide` | mutation | `+ expiresAt?: date (AAAA-MM-JJ)`, seulement si `subject = document` et `status = approved` | rien | admin | `BAD_REQUEST` sinon ; `DOCUMENTS_NOT_APPROVED` si la date est déjà passée |
| `admin.drivers.documentUrl` | query | inchangé | `+ fileKind` | équipe | rien |

**App** (`app/(driver)/(tabs)/dossier.tsx`) :
- Toucher une ligne ouvre une `Sheet` : « Prendre une photo » (`launchCameraAsync`), « Choisir une image » (`launchImageLibraryAsync`), « Choisir un PDF » (`expo-document-picker`, `type: "application/pdf"`, `copyToCacheDirectory: true`). Un PDF de plus de 10 Mo est refusé tout de suite, avec un toast, sans envoi.
- État local par type, en mémoire de l'écran : `{ uri, kind: "image" | "pdf", name, status: "ready" | "sending" | "error", error? }`. Il disparaît si l'écran est démonté (accepté : pas de brouillon persistant).
- En tête du bloc : « N sur 4 envoyés » et une barre jaune (N = documents ayant un `driver_document` actif).
- Ligne d'un document : icône ou miniature, nom, état (Prêt · En attente · Validé · À compléter · Refusé · À envoyer), date d'expiration et pastille « Expire bientôt » (`expiresAt` moins de 30 jours après aujourd'hui) ou « Expiré », motif sous la ligne si refusé ou à compléter. Toucher la miniature d'une image envoyée l'ouvre en grand dans une modale (`AuthImage`, cookie envoyé à la main). Un PDF envoyé montre une icône `document-text`, « PDF » et sa date d'envoi, sans s'ouvrir dans l'app : la WebView Android n'affiche pas les PDF, et les ouvrir hors de l'app demanderait une dépendance de plus pour un besoin secondaire.
- Bouton fixe sous la liste : « Envoyer mes documents (N prêts) », désactivé à 0. Il envoie les fichiers un par un (`POST /files/doc` puis `driver.attachDocument`), passe chacun à « sending », puis au retour serveur ou à « error ». À la fin : un toast avec le nombre envoyé, et `dossier.refetch()`.

**Back office** (`apps/web/src/routes/admin/chauffeurs/$driverId.tsx`) :
- `fileKind = pdf` : `<object data={url} type="application/pdf">` de 480 px de haut, avec en secours et en dessous un lien « Ouvrir » (`target="_blank" rel="noopener"`). L'URL `/files/…` demande la session d'équipe : le cookie part de lui même dans le navigateur.
- Le formulaire de décision sur un document ajoute un champ date facultatif « Date d'expiration », visible seulement pour « Valider ». Le serveur enregistre la fin de cette journée dans le fuseau `Indian/Antananarivo`, puis vérifie l'expiration sur la nouvelle valeur (avant d'appliquer la règle `isExpired` existante). Vide veut dire « n'expire pas ».

**Value sourcing**
| Action | Valeur | Source |
|---|---|---|
| Progression | N envoyés | nombre de `requiredDocuments` qui ont un document actif dans `driver.dossier.documents` |
| Progression | total | `driver.dossier.requiredDocuments.length` (4 aujourd'hui) |
| Ligne | état | local (« Prêt », « Envoi », « Erreur ») sinon `driver_document.verification_status`, sinon « À envoyer » |
| Ligne | aperçu envoyé | `fileUrl` (`files.getUrl(storage_key)`) et `fileKind` (extension de la clé) |
| Ligne | date d'envoi | `driver_document.created_at` |
| Ligne | expiration | `driver_document.expires_at` |
| Ligne | « Expire bientôt » | dérivé de `expires_at` et de la date du jour (30 jours, fuseau `Indian/Antananarivo` comme `formatDate`) |
| Ligne | motif | dernière `verification_decision` de ce document : `reason_note`, sinon libellé `reason_code` (nouvelles clés i18n `docReason.<code>` en français et en malagasy, reprises des motifs du back office) |
| Admin | date d'expiration | saisie de l'admin → `decide.expiresAt` |

**Key invariants** : un seul document actif par type (inchangé : l'ancien reçoit `replaced_at`). Le format d'un fichier se décide toujours par son contenu. Un chauffeur ne lit jamais le document d'un autre.

**Critical test scenarios** :
- Préparer un PDF de 2 Mo et une photo, envoyer : deux documents « En attente », progression 2 sur 4, verifies **AC-12**, **AC-13**, **AC-15**
- Couper le réseau pendant l'envoi groupé : le document en échec reste « Prêt » avec son erreur, l'autre est envoyé, verifies **AC-13**
- Envoyer un fichier `.pdf` qui est en fait du texte : 415, verifies **AC-14**
- Envoyer un PDF de 12 Mo : refusé dans l'app ; s'il passe quand même par l'API, 413, verifies **AC-14**
- L'admin valide l'assurance avec une date dans 10 jours : le chauffeur voit « Expire bientôt », verifies **AC-15**, **AC-17**
- L'admin tente de valider avec une date passée : refus `DOCUMENTS_NOT_APPROVED`, rien n'est écrit, verifies **AC-17**
- Un document validé dont la date passe ensuite : « Expiré » côté chauffeur et blocage existant (`DOCUMENT_EXPIRED`), verifies **AC-15**
- `driver.attachDocument` avec `expiresAt` : champ refusé par le schéma, verifies **AC-17**
- Un PDF ouvert dans le back office est servi avec `Content-Security-Policy: sandbox`, verifies **AC-16**
- Fiche chauffeur dans le back office avec un PDF : aperçu intégré et lien « Ouvrir », verifies **AC-16**
- Un chauffeur demande le document d'un autre : 403, verifies **AC-14**
