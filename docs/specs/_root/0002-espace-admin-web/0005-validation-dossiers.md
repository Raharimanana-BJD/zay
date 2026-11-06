# Validation des dossiers

## Summary

L'équipe consulte le dossier d'un chauffeur, ses véhicules et ses documents. Un admin décide élément par élément, et le chauffeur n'est approuvé que quand ses pièces le sont. Il peut aussi suspendre l'activité d'un chauffeur ou d'un véhicule, sans couper son compte. Les fichiers passent par un port, que la fonction 22 remplira avec le vrai stockage.

## Requirements

- **AC-30**: L'équipe liste les chauffeurs, 25 par page, avec filtre par `verification_status`, recherche sur nom ou téléphone, et un repère pour les chauffeurs simulés et hors ligne. Un identifiant sans `driver_profile` répond `NOT_FOUND`. Le détail montre la relation professionnelle, les véhicules non archivés, les documents courants, et l'historique complet des décisions, le plus récent d'abord.
- **AC-31**: Un membre de l'équipe ouvre un document et voit le fichier par une URL temporaire. Un fichier introuvable affiche « Fichier indisponible », sans casser la page. Sans session équipe, l'URL répond 401 ou 403.
- **AC-32**: Un admin décide sur un document ou un véhicule (`approved`, `rejected`, `changes_requested`). Le statut change et une ligne `verification_decision` existe, avec auteur, motif et note, dans la même transaction. `rejected` et `changes_requested` exigent un motif, facultatif sur `approved`. Une transition interdite, un document remplacé, ou un document ou véhicule archivé sont refusés avec `VERIFICATION_STATUS_CHANGED`.
- **AC-33**: Approuver un chauffeur est refusé avec `DOCUMENTS_NOT_APPROVED` s'il n'a aucune pièce personnelle courante, ou si l'une n'est pas approuvée ou est expirée. Le bouton est désactivé avec l'explication, et le serveur refuse même si l'écran est contourné. Approuver un véhicule suit la même règle avec ses pièces à lui. Approuver un document déjà expiré est refusé avec le même code.
- **AC-34**: Un admin suspend l'activité d'un chauffeur ou d'un véhicule avec un motif de `SUSPENSION_REASONS`. Ses offres ouvertes passent à `void`, et une course active continue. Le compte reste connecté.
- **AC-35**: Réactiver un chauffeur ou un véhicule suspendu repasse à `approved` avec une nouvelle décision, après le même contrôle qu'AC-33.
- **AC-36**: Un support voit tout en lecture, documents compris, et n'a aucun bouton de décision. S'il appelle la procédure, il reçoit `FORBIDDEN`. Un véhicule archivé ne reçoit aucune décision.

## Decision

Une décision par élément, sur le modèle de `verification_decision`. Le port `FileAccess` isole le stockage : le seed sert les fichiers depuis le serveur en attendant la fonction 22.

## Feature design

**State transitions**:

| Sujet | Depuis | Vers |
|---|---|---|
| Document | `pending`, `changes_requested` | `approved`, `rejected`, `changes_requested` |
| Véhicule, chauffeur | `pending`, `changes_requested` | `approved`, `rejected`, `changes_requested` |
| Véhicule, chauffeur | `approved` | `suspended` |
| Véhicule, chauffeur | `suspended` | `approved` |

- Un même statut que l'actuel est refusé, ce qui couvre le double clic.
- `rejected` et un document `approved` n'ont pas de sortie ici. La fonction 22 les remet à `pending` quand une pièce est remplacée.
- Un document ne se suspend pas : on suspend le chauffeur ou son véhicule.

**Pièces prises en compte**:
- Pour un chauffeur : ses `driver_document` avec `replaced_at` nul et `vehicle_id` nul. Il en faut au moins une.
- Pour un véhicule : celles avec `replaced_at` nul et ce `vehicle_id`. Il en faut au moins une.
- Une pièce est expirée si `expires_at` est avant l'heure du serveur. L'écran le signale en rouge.

**API surface**:

| Procédure | Type | Entrée | Sortie | Accès | Erreurs |
|---|---|---|---|---|---|
| `admin.drivers.list` | Query | `q?`, `status?`, `page` | `items` (`userId`, nom, téléphone, statut, `isOnline`, `isAvailable`, `isSimulated`, `banned`), `total` | Équipe | |
| `admin.drivers.get` | Query | `driverId` | Profil, véhicules, documents, décisions avec auteur, 10 réservations, `canApprove` et `blockers` (`{ documentId, code }[]`) | Équipe | `NOT_FOUND` |
| `admin.drivers.documentUrl` | Query | `documentId` | `url`, `expiresAt` | Équipe | `NOT_FOUND` |
| `admin.drivers.decide` | Mutation | `subject`, `subjectId`, `status`, `reasonCode?`, `reasonNote?` | `status`, `decisionId` | admin | `CONFLICT` `VERIFICATION_STATUS_CHANGED`, `DOCUMENTS_NOT_APPROVED`, `BAD_REQUEST` motif |
| `GET /files/:key` (Hono) | HTTP | `key` | Fichier | Session équipe | 401, 403, 404 |

**Port de fichiers** (`packages/api/src/domain/files.ts`) :

```ts
export type FileAccess = {
  getUrl(storageKey: string): Promise<{ url: string; expiresAt: Date } | null>;
};
```

Implémentation temporaire dans `apps/server/src/files.ts` :
- Le dossier est `new URL("../seed-files/", import.meta.url)`, ce qui marche depuis `src/` et `dist/`. Le binaire de `compile` n'est pas pris en charge.
- Seules les clés qui respectent `^seed-[a-z0-9-]+\.(png|jpg)$` sont acceptées, ce qui bloque toute sortie du dossier.
- `getUrl` rend `${ENV.BETTER_AUTH_URL}/files/<key>`, et `null` si le fichier n'existe pas. `expiresAt` vaut l'heure du serveur plus 5 minutes, à titre indicatif : ici, c'est la session qui protège.
- La route lit la session par `auth.api.getSession`, contrôle le rôle, et sert depuis `apps/server/seed-files/` avec `Cache-Control: private, no-store`.

La fonction 22 remplace l'implémentation, sans toucher les écrans.

**Verrou** : chaque `decide` commence sa transaction par un `FOR UPDATE` sur la ligne `driver_profile` du chauffeur concerné. Ainsi, une approbation ne peut pas passer pendant qu'une décision sur l'une de ses pièces s'enregistre, et le second double clic voit le nouveau statut.

**Effets d'une décision**, dans la même transaction que la ligne de journal :

| Décision | Effet |
|---|---|
| Chauffeur `suspended` | Ses offres `sent`, `priced`, `negotiating` passent à `void` |
| Véhicule `suspended` | Les offres de ce `vehicle_id` dans ces états passent à `void` |

`is_available` ne change pas : l'éligibilité lit `verification_status`, et la règle de 0001 interdit de changer `is_available` pendant une course.

**Value sourcing**:

| Action | Valeur | Source |
|---|---|---|
| Décision | `decided_by` | `ctx.session.user.id` |
| Décision | `subject_id` | Entrée, `driver_profile.user_id`, `vehicle.id` ou `driver_document.id` |
| Décision | Liste de motifs | `VERIFICATION_REJECTION_REASONS` ou `SUSPENSION_REASONS` selon `status` |
| Détail | Historique | `verification_decision` où `subject_id` est le chauffeur, ses véhicules ou ses documents |
| Détail | Type de document | `type_code`, libellé dans `labels.ts` |
| Expiration | Heure de référence | Heure du serveur, jamais celle du navigateur. `drivers.get` rend `isExpired` |
| Bouton Approuver | État et raison | `drivers.get` rend `canApprove` et `blockers`, pour le chauffeur et chaque véhicule |
| Détail | URL de fichier | `ctx.files.getUrl(storage_key)` |

**Key invariants**:
- Un changement de `verification_status` et sa décision sont dans la même transaction.
- Un chauffeur n'est jamais `approved` avec une pièce personnelle courante non approuvée ou expirée, au moment de la décision.
- Une décision n'est jamais modifiée.

**Security model**: l'API ne renvoie jamais `storage_key` comme un champ. L'URL temporaire du seed le contient, ce qui est sans danger pour des spécimens, et la fonction 22 rendra des URL opaques. Les pièces sont sensibles : pas d'URL publique, pas de cache. `decide` est réservé à `admin`, toute lecture à l'équipe.

**Critical test scenarios**:
- Happy path : approuver les documents, puis le véhicule, puis le chauffeur, verifies **AC-32**, **AC-33**.
- Failure case : approuver un chauffeur avec une pièce expirée répond `DOCUMENTS_NOT_APPROVED`, verifies **AC-33**.
- Failure case : `rejected` sans motif est refusé, verifies **AC-32**.
- Suspension : l'offre ouverte d'un premier chauffeur passe à `void`. Un second chauffeur suspendu en pleine course la garde en `IN_PROGRESS`, verifies **AC-34**.
- Réactivation : refusée si une pièce a expiré entre temps, verifies **AC-35**.
- Auth/permission : `GET /files/seed-x.png` sans session répond 401, avec un client répond 403, et `../` répond 404, verifies **AC-31**.
- Auth/permission : un support reçoit `FORBIDDEN` sur `decide`, verifies **AC-36**.

## Build plan

1. Écrire `FileAccess`, son implémentation et la route `/files/:key`, satisfies **AC-31**
2. Écrire `admin.drivers.list`, `get` et `documentUrl`, avec `canApprove` et `blockers`, satisfies **AC-30**, **AC-31**, **AC-33**
3. Construire `/admin/chauffeurs` et le détail, avec la visionneuse de document, satisfies **AC-30**, **AC-31**, **AC-36**
4. Écrire `admin.drivers.decide`, ses transitions, ses effets et les fenêtres de décision, satisfies **AC-32**, **AC-33**, **AC-34**, **AC-35**, **AC-36**

## Rationale

Décider élément par élément dit au chauffeur quoi corriger, et suit le schéma existant. Le port évite d'arrêter un choix de stockage avant la fonction 8, sans bloquer la validation.
