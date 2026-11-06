# 0001. Modèle de données de la plateforme Zay

**Date**: 2026-11-06
**Status**: In Progress

## Summary

Cette spec fixe toutes les tables de Zay, de l'inscription jusqu'à l'abonnement chauffeur. Chaque réservation garde son état actuel dans une ligne, et chaque changement important s'ajoute à un journal qui n'est jamais réécrit. Postgres bloque lui même les doubles attributions, grâce à des index uniques partiels (une règle d'unicité qui ne vaut que pour certaines lignes). Tout arrive en une fois, en vraies migrations, pour que les tranches suivantes n'aient pas à casser le schéma.

## Requirements

**User stories**:
- En tant que développeur des tranches suivantes, je veux un schéma complet, pour construire chaque fonction sans migration cassante.
- En tant qu'administrateur, je veux retrouver l'historique complet d'une réservation, de ses prix et de ses décisions, pour traiter un litige.
- En tant que client ou chauffeur, je veux qu'une course confirmée ne soit jamais attribuée deux fois, même sur un réseau instable.

**Acceptance criteria**:
- **AC-1**: Sur une base vide, `bun run db:start` puis `bun run db:migrate` créent PostGIS, les 25 nouvelles tables et la version 1 des réglages. Ensuite, `bun run db:generate` ne détecte aucune différence.
- **AC-2**: L'inscription exige un téléphone au format international. Un téléphone déjà utilisé est refusé avec un message clair, y compris lors d'une modification du profil. Une inscription envoyée avec un champ `role` est refusée et ne crée aucun compte. Sans ce champ, le compte est `client`.
- **AC-3**: Une course complète peut s'enregistrer de `PENDING` à `COMPLETED` entre deux comptes réels, avec son devis, son groupe, son offre, ses propositions, ses événements et son paiement.
- **AC-4**: Deux confirmations simultanées sur une réservation donnent une seule offre `accepted`. Un chauffeur ne peut pas être affecté à deux réservations actives.
- **AC-5**: Un chauffeur ne peut avoir qu'une seule offre ouverte. Il ne peut pas être sollicité deux fois pour la même réservation, sauf si son offre précédente est `void`. Une réservation ne peut avoir qu'une seule négociation en cours.
- **AC-6**: Une action renvoyée avec le même `client_request_id` par le même auteur ne crée pas de seconde ligne dans `booking`, `offer_proposal`, `booking_event`, `payment_event` ou `report`, et le serveur peut renvoyer le résultat d'origine.
- **AC-7**: Une nouvelle version des réglages ne change ni le devis ni la version liée à une réservation existante, et garde son auteur. Les anciennes valeurs restent lisibles.
- **AC-8**: Une réservation en mode automatique a un devis actif par catégorie. Une demande de changement de destination ne modifie ni le lieu, ni le prix, ni le devis actif. Seuls les deux accords l'appliquent : l'ancien devis est alors gardé comme remplacé, et l'ancien lieu, le nouveau lieu et les deux accords restent enregistrés. Un refus ou une expiration ne change rien.
- **AC-9**: Le prix convenu, le montant déclaré et le statut du paiement sont trois valeurs distinctes. Le paiement d'une course qui se termine commence à `pending`.
- **AC-10**: Supprimer un compte, un véhicule ou un réglage lié à une course est refusé par la base. Une immatriculation peut être réutilisée seulement si l'ancien véhicule est archivé.
- **AC-11**: Le départ et la destination ont toujours un point. Le serveur peut calculer une distance en mètres et savoir si un point est dans une `service_zone`.
- **AC-12**: Une référence de prestataire déjà connue est refusée, et un paiement d'abonnement ne peut donner qu'une seule période.
- **AC-13**: Quand un chauffeur attribué se retire avant la prise en charge, la même réservation revient à `SEARCHING`. Les chauffeurs écartés à l'attribution peuvent être sollicités à nouveau, mais pas celui qui s'est retiré, ni ceux qui ont refusé.
- **AC-14**: `min_ar` et `max_ar` restent toujours dans la limite de variation, après arrondi.
- **AC-15**: Une journalisation avec `actor_kind` autre que `system` exige un `actor_id`.

## Decision

**Chosen option**: Option 1: État actuel plus journaux, sur Postgres et PostGIS.

Une ligne garde l'état actuel de chaque objet, des tables en ajout seul gardent l'historique, et les règles de concurrence critiques sont garanties par la base.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `email-and-password-best-practices` (`better-auth/skills`, `.agents/skills/email-and-password-best-practices/`)

Choix techniques que cette spec arrête :

| Sujet | Choix | Pourquoi | Autre option |
|---|---|---|---|
| Identifiants | `uuid` remplis par `Bun.randomUUIDv7()` | Le serveur tourne sur Bun, donc aucune dépendance en plus | Paquet `uuid` |
| Points | `geometry(Point, 4326)` en mode `xy` (`x` longitude, `y` latitude) | Colonne native de Drizzle | Type `geography` personnalisé |
| Distances | `ST_Distance(a::geography, b::geography)` | Résultat en mètres | Calcul de Haversine dans le code |
| Zones | `geometry(MultiPolygon, 4326)` en `customType` Drizzle | Drizzle ne fournit que le type point | GeoJSON dans une colonne `jsonb` |
| Dates | `timestamp with time zone` | Pas d'ambiguïté entre serveur et téléphones | `timestamp` simple |
| Montants | Entier en ariary (`integer`) | L'ariary se manipule sans décimales ici | `numeric` |
| Statuts stables | `pgEnum` | Valeurs connues, ajout simple | Texte contrôlé par le code |
| Journaux en ajout seul | Convention de code, sans fonction de mise à jour | Suffisant pour la démo | Déclencheur Postgres |

## Feature design

**Data model sketch**:

Sauf mention contraire, chaque nouvelle table a `id uuid` en clé primaire et `created_at` obligatoire. Les tables à état ont aussi `updated_at`. Toutes les clés étrangères sont en `ON DELETE RESTRICT`. `?` signifie facultatif.

*Enums*

| Enum | Valeurs |
|---|---|
| `vehicle_category` | `car`, `tuk_tuk` |
| `requested_category` | `car`, `tuk_tuk`, `auto` |
| `employment_relation` | `owner`, `renter`, `employee` |
| `verification_status` | `pending`, `approved`, `rejected`, `changes_requested`, `suspended` |
| `verification_subject` | `driver`, `vehicle`, `document` |
| `zone_kind` | `pickup`, `destination`, `driver` |
| `booking_status` | `PENDING`, `SEARCHING`, `OFFERED`, `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `NO_DRIVER_FOUND`, `DISPUTED` |
| `actor_kind` | `client`, `driver`, `admin`, `support`, `system` |
| `distance_source` | `route`, `fallback` |
| `dispatch_group_status` | `active`, `paused`, `exhausted`, `closed` |
| `offer_status` | `sent`, `priced`, `negotiating`, `accepted`, `refused`, `expired`, `void`, `withdrawn` |
| `proposal_kind` | `accept`, `propose`, `counter`, `refuse` |
| `destination_change_status` | `pending`, `applied`, `refused`, `expired` |
| `payment_status` | `pending`, `partial`, `paid`, `disputed` |
| `payment_method` | `cash` |
| `payment_event_kind` | `declared`, `disputed`, `resolved` |
| `report_status` | `open`, `in_progress`, `resolved`, `closed` |
| `subscription_payment_status` | `pending`, `succeeded`, `failed` |

*Comptes (générés par Better Auth, ne pas modifier `auth.ts` à la main)*

| Table | Ajouts | Source |
|---|---|---|
| `user` | `role text?` (`client`, `driver`, `admin`, `support`), `banned`, `ban_reason?`, `ban_expires?` | Plugin `admin` avec `defaultRole: "client"`. La valeur par défaut vient de Better Auth, pas de la base, donc tout script qui insère directement dans `user` doit renseigner `role` |
| `user` | `phone text` obligatoire et unique, `locale text` défaut `fr` (`fr`, `mg`) | `additionalFields`, avec `validator.input` pour le format |
| `session` | `impersonated_by?` | Plugin `admin` |

Les tables `account` et `verification` ne changent pas.

*Chauffeurs*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `driver_profile` | `user_id text` clé primaire, `employment_relation`, `verification_status` défaut `pending`, `is_online` défaut faux, `is_available` défaut faux, `is_simulated` défaut faux, `active_vehicle_id?` | 1:1 `user`. CHECK : `is_available` implique `is_online` |
| `vehicle` | `driver_id`, `category`, `make?`, `model`, `registration?`, `capacity`, `photo_key?`, `features jsonb` défaut `[]`, `verification_status` défaut `pending`, `archived_at?` | N:1 `driver_profile`. Unique `registration` où `archived_at` est nul et `registration` non nul. CHECK : `capacity >= 1` |
| `driver_document` | `driver_id`, `vehicle_id?`, `type_code text`, `storage_key`, `expires_at?`, `verification_status` défaut `pending`, `replaced_at?` | N:1 chauffeur, N:1 véhicule facultatif. Le document courant est celui dont `replaced_at` est nul |
| `verification_decision` | `subject verification_subject`, `subject_id text`, `status verification_status`, `reason_code?`, `reason_note?`, `decided_by` | Journal. `decided_by` vers `user`. Index `(subject, subject_id, created_at)` |
| `driver_position` | `driver_id` clé primaire, `point`, `accuracy_m?`, `recorded_at` (heure du téléphone), `received_at` (heure du serveur) | 1:1 chauffeur. Un envoi ne remplace la ligne que si son `recorded_at` est plus récent. Index GiST sur `point` |

`active_vehicle_id` est la seule colonne de ce groupe qui crée un lien circulaire avec `vehicle` : elle s'ajoute par `foreignKey` différé dans le fichier de schéma.

*Lieux*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `district` | `name`, `point`, `archived_at?` | Nom unique hors archives |
| `landmark` | `name`, `point`, `district_id?`, `archived_at?` | N:1 quartier facultatif |
| `service_zone` | `kind zone_kind`, `name`, `area`, `is_active` défaut vrai | Index GiST sur `area` |

*Réglages (jamais modifiés, seulement versionnés)*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `settings_version` | `version int`, `price_variation_pct`, `group_min_drivers`, `group_max_drivers`, `driver_response_s`, `group_pause_s`, `max_groups`, `client_response_s`, `driver_counter_response_s`, `gps_max_age_s`, `change_note?`, `created_by?` | `version` unique. La version courante est la plus haute. `created_by` nul pour la version 1. CHECK : `group_min_drivers <= group_max_drivers`, `price_variation_pct` entre 0 et 100 |
| `category_fare` | `settings_version_id`, `category`, `base_fare_ar`, `per_km_ar`, `included_m`, `rounding_ar`, `max_capacity` | Clé primaire `(settings_version_id, category)`. CHECK : `rounding_ar > 0` |

*Course*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `booking` | `client_id`, `client_request_id uuid`, `requested_category`, `passengers`, `status` défaut `PENDING`, `settings_version_id`, `driver_id?`, `vehicle_id?`, `agreed_price_ar?`, `pickup_point`, `pickup_note?`, `pickup_district_id?`, `pickup_landmark_id?`, `destination_point`, `destination_note?`, `destination_district_id?`, `destination_landmark_id?`, `status_changed_at`, `completed_at?` | Unique `(client_id, client_request_id)`. Unique `driver_id` où `status` est `ACCEPTED`, `DRIVER_ARRIVING`, `ARRIVED` ou `IN_PROGRESS`. CHECK : `passengers >= 1`. CHECK : ces quatre statuts, `COMPLETED` et `DISPUTED` exigent `driver_id`, `vehicle_id` et `agreed_price_ar`. Index `(client_id, created_at)`, `(driver_id, created_at)`, `(status)` |
| `booking_event` | `booking_id`, `type text`, `from_status?`, `to_status?`, `actor_kind`, `actor_id?`, `reason_code?`, `reason_note?`, `data jsonb?`, `client_request_id?` | Journal. Unique `(actor_id, client_request_id)`. CHECK : `actor_id` obligatoire si `actor_kind` n'est pas `system`. Index `(booking_id, created_at)` |
| `fare_quote` | `booking_id`, `category`, `settings_version_id`, `distance_m`, `distance_source`, `amount_ar`, `min_ar`, `max_ar`, `replaced_at?` | Unique `(booking_id, category)` où `replaced_at` est nul |
| `destination_change` | `booking_id`, `old_point`, `old_note?`, `old_district_id?`, `old_landmark_id?`, `new_point`, `new_note?`, `new_district_id?`, `new_landmark_id?`, `new_distance_m`, `new_distance_source`, `settings_version_id`, `old_price_ar`, `new_price_ar`, `fare_quote_id?`, `requested_by`, `client_accepted_at?`, `driver_accepted_at?`, `status`, `expires_at` | N:1 réservation. Un seul `pending` par réservation. `fare_quote_id` est rempli seulement quand le changement passe à `applied` |

*Distribution*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `dispatch_group` | `booking_id`, `sequence`, `status`, `started_at`, `expires_at`, `ended_at?` | Unique `(booking_id, sequence)` |
| `offer` | `booking_id`, `group_id`, `driver_id`, `vehicle_id`, `fare_quote_id`, `category`, `status` défaut `sent`, `current_price_ar?`, `expires_at` | Unique `(booking_id, driver_id)` où `status` n'est pas `void`. Unique `driver_id` où `status` est `sent`, `priced` ou `negotiating`. Unique `booking_id` où `status` est `negotiating`. Unique `booking_id` où `status` est `accepted` |
| `offer_proposal` | `offer_id`, `actor_kind`, `actor_id`, `kind`, `amount_ar?`, `reason_code?`, `reason_note?`, `client_request_id?` | Journal. Unique `(actor_id, client_request_id)`. Index `(offer_id, created_at)` |

*Paiement*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `payment` | `booking_id`, `method` défaut `cash`, `agreed_amount_ar`, `declared_amount_ar?`, `status` défaut `pending` | `booking_id` unique. CHECK : `declared_amount_ar >= 0` |
| `payment_event` | `payment_id`, `kind`, `amount_ar?`, `actor_kind`, `actor_id?`, `reason_code?`, `reason_note?`, `client_request_id?` | Journal. Unique `(actor_id, client_request_id)`. CHECK : `actor_id` obligatoire si `actor_kind` n'est pas `system` |

*Support*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `report` | `booking_id?`, `author_id`, `type_code`, `description?`, `status` défaut `open`, `assignee_id?`, `client_request_id` | Unique `(author_id, client_request_id)`. Index `(status, created_at)` |
| `report_event` | `report_id`, `actor_id`, `from_status?`, `to_status?`, `note?` | Journal |
| `audit_log` | `actor_id?`, `action text`, `target_type`, `target_id`, `before jsonb?`, `after jsonb?` | Journal. Index `(target_type, target_id, created_at)` |

*Abonnement*

| Table | Colonnes | Liens et contraintes |
|---|---|---|
| `subscription_plan` | `name`, `price_ar`, `duration_days`, `is_active` | CHECK : prix et durée positifs |
| `subscription_payment` | `driver_id`, `plan_id`, `amount_ar`, `provider`, `provider_reference?`, `status` défaut `pending`, `client_request_id`, `confirmed_at?` | Unique `(provider, provider_reference)`. Unique `(driver_id, client_request_id)` |
| `subscription_period` | `driver_id`, `payment_id`, `starts_at`, `ends_at` | `payment_id` unique. Index `(driver_id, ends_at)` |

*Organisation des fichiers dans `packages/db/src/schema/`*

`enums.ts`, `columns.ts` (`newId`, `point`, `multiPolygon`), `drivers.ts`, `places.ts`, `settings.ts`, `bookings.ts`, `dispatch.ts`, `payments.ts`, `support.ts`, `subscriptions.ts`, tous exportés par `index.ts`.

*Listes de codes*

`packages/api/src/domain/codes.ts` regroupe ces listes, que le serveur contrôle et que les fichiers de langue traduisent. Une fonction peut y ajouter des valeurs sans migration.

| Liste | Valeurs de départ |
|---|---|
| `booking_event.type` | `status_changed`, `driver_assigned`, `driver_replaced`, `destination_requested`, `destination_applied`, `destination_refused`, `destination_expired` |
| Motifs d'annulation | `client_changed_mind`, `driver_unavailable`, `client_absent`, `driver_absent`, `other` |
| Motifs d'ajustement de prix | `distance_differs`, `difficult_road`, `difficult_destination`, `other` |
| `report.type_code` | `client_absent`, `driver_absent`, `payment_issue`, `safety`, `help`, `other` |
| Motifs de rejet de dossier | `document_unreadable`, `document_expired`, `information_mismatch`, `other` |

**State transitions**:

Ce tableau est le contrat de stockage. La fonction 9 écrit le contrôle côté serveur, et les fonctions 11, 13 et 17 précisent leurs déclencheurs.

| Depuis | Vers |
|---|---|
| `PENDING` | `SEARCHING`, `CANCELLED`, `EXPIRED` |
| `SEARCHING` | `OFFERED`, `NO_DRIVER_FOUND`, `CANCELLED`, `EXPIRED` |
| `OFFERED` | `SEARCHING`, `ACCEPTED`, `NO_DRIVER_FOUND`, `CANCELLED`, `EXPIRED` |
| `ACCEPTED` | `DRIVER_ARRIVING`, `CANCELLED`, `SEARCHING` (remplacement) |
| `DRIVER_ARRIVING` | `ARRIVED`, `CANCELLED`, `SEARCHING` (remplacement) |
| `ARRIVED` | `IN_PROGRESS`, `CANCELLED`, `SEARCHING` (remplacement) |
| `IN_PROGRESS` | `COMPLETED`, `CANCELLED` (support) |
| `COMPLETED` | `DISPUTED` (support) |
| `DISPUTED` | `COMPLETED` (support) |

Un retour à `SEARCHING` vide `driver_id`, `vehicle_id` et `agreed_price_ar`, et ajoute un événement `driver_replaced` dont `data` contient `previous_driver_id`, `previous_vehicle_id` et `previous_price_ar`. L'offre acceptée passe à `withdrawn`, ce qui bloque ce chauffeur pour cette réservation. Les offres écartées à l'attribution étant `void`, leurs chauffeurs restent sollicitables. La recherche reçoit de nouveau `max_groups` groupes, et `sequence` continue. Une réservation `CANCELLED` garde son chauffeur et son prix.

Offre : `sent` → `priced` → `negotiating` → `accepted`. Depuis n'importe quel état ouvert (`sent`, `priced`, `negotiating`), elle peut passer à `refused`, `expired` ou `void`. Une offre `accepted` peut seulement passer à `withdrawn`.

**Règles de décision**:

| Sujet | Règle |
|---|---|
| Changement de destination | Demandé par le client, et seulement en `ACCEPTED` ou `DRIVER_ARRIVING`. Le nouveau lieu est de nouveau contrôlé par les zones. Le prix proposé est le nouveau `amount_ar` calculé pour la catégorie du véhicule, avec la version de réglages de la réservation. Un `pending` expire à `expires_at`, ou dès que la réservation quitte ces deux statuts |
| Application d'un changement | Dans une transaction : remplit `replaced_at` sur tous les devis actifs, crée le nouveau devis, met à jour le lieu et `agreed_price_ar`, puis ajoute `destination_applied`. Si la réservation retourne ensuite à `SEARCHING`, le serveur recalcule un devis par catégorie demandée |
| Attribution | La réservation copie `driver_id`, `vehicle_id` et `current_price_ar` de l'offre acceptée, qui garde sa propre `category` |
| Proposition de prix | Doit être un multiple de `rounding_ar`, entre `min_ar` et `max_ar` |
| Capacité | Au moment de la demande, une catégorie dont `max_capacity` est trop petite ne reçoit pas de devis. Si aucune ne convient, la demande est refusée. L'éligibilité d'un véhicule utilise `passengers <= vehicle.capacity`, et `vehicle.capacity` ne peut pas dépasser `max_capacity` |
| Zones | S'il n'existe aucune zone active du type concerné, tout lieu est accepté. Sinon, le point doit être dans une zone active de ce type. Les zones `driver` filtrent l'éligibilité à partir de `driver_position` |
| Validation | `verification_status` décide de l'éligibilité, et `banned` bloque le compte. Un chauffeur est approuvé seulement si ses documents courants sont approuvés. Un document expiré rend le chauffeur inéligible. Modifier `category`, `capacity` ou `registration` d'un véhicule approuvé le remet à `pending`. Une suspension fait passer ses offres ouvertes à `void` |
| Disponibilité | `is_available` ne change pas pendant une course. La course active exclut le chauffeur grâce à l'index de `booking` |
| Délai d'une offre | `sent` : `driver_response_s`. Après une proposition du chauffeur : `client_response_s`. Après une contre proposition du client : `driver_counter_response_s`. La pause d'un groupe appartient à la spec de la fonction 11 |
| Renvoi d'une action | `INSERT ... ON CONFLICT DO NOTHING`, puis lecture et renvoi de la ligne existante. Une action qui écrit plusieurs événements met `client_request_id` sur la première ligne seulement. Une demande de changement de destination est protégée par son événement `destination_requested` |
| Reprise après coupure | Le téléphone relit les événements dans l'ordre de `booking_event.id` (UUID v7). Il ne garde pas de file d'actions hors ligne : seul un renvoi immédiat de la même action est permis |
| Paiement | Ligne créée au passage à `COMPLETED`. Aucune déclaration, ou déclaration à 0 : `pending`. Déclaré inférieur au prix convenu : `partial`. Déclaré égal ou supérieur : `paid`. Une contestation du client donne `disputed`. Après `resolved`, le statut se recalcule à partir du montant retenu |
| Litige | Une contestation de paiement ne change pas `booking.status`. Seul le support passe une réservation à `DISPUTED` puis la rend à `COMPLETED`. L'historique et les revenus incluent ces deux statuts |
| Après `NO_DRIVER_FOUND` | Modifier sa demande crée une nouvelle réservation |
| Chauffeurs simulés | Vrais comptes `user` et `driver_profile` avec `is_simulated`, un numéro fictif unique et un mot de passe aléatoire jamais communiqué. Leurs actions utilisent `actor_kind = driver`, avec l'admin dans `data.simulated_by`. Fonction 10 : interrupteur par `DRIVER_SIMULATOR_ENABLED`. Les statistiques les incluent, avec un filtre possible, sinon elles resteraient vides pendant la démo |
| `audit_log` | Changements de rôle, suspensions et réactivations, zones, quartiers, repères, formules d'abonnement, activation du simulateur. Les réglages et les décisions de validation ont déjà leur propre historique |
| GPS | Fraîcheur : `received_at` plus récent que `gps_max_age_s` de la dernière version. Seuil de précision et rayon de recherche : hors de la démo, volontairement |
| Création d'un chauffeur | Le rôle `driver` et `driver_profile` appartiennent à la fonction 3. Un chauffeur validé de développement est créé par un script de la fonction 9, que la fonction 29 complétera |
| Abonnement | Contrôlé dans l'éligibilité seulement une fois la fonction 28 construite. Période valide si `starts_at <= maintenant < ends_at` |

**API surface**:

Cette fonction n'ajoute aucun endpoint tRPC. Sa surface est le schéma, plus le changement du flux d'inscription existant.

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/sign-up/email` (existant) | POST | `name`, `email`, `password`, `phone:string` (req), `locale:fr\|mg` (opt) | Session, `user` avec `role: client` | Public | 400 téléphone invalide ou champ `role` envoyé, téléphone ou email déjà utilisé |

Le choix du rôle chauffeur à l'inscription appartient à la fonction 3. Le format du téléphone (E.164, le format international, par exemple `+261...`) et celui de `locale` sont contrôlés par `validator.input`, qui couvre aussi `/update-user`. L'unicité est vérifiée par un hook `before` pour donner un message clair, et l'erreur de l'index unique reçoit le même message si deux inscriptions arrivent en même temps.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Migration | Valeurs de la version 1 des réglages | Migration `seed_settings`, valeurs de test ci dessous |
| Inscription | `role` | `defaultRole: "client"` du plugin `admin`, jamais une entrée |
| Inscription | `phone`, `locale` | Entrées du formulaire, `locale` vaut `fr` par défaut |
| Création d'une réservation | `settings_version_id` | La plus haute `settings_version.version` |
| Création d'une réservation | `distance_m`, `distance_source` | Service décidé dans la spec de la fonction 5 |
| Devis | `amount_ar` | `base_fare_ar + (max(distance_m − included_m, 0) / 1000) × per_km_ar`, arrondi au plus proche multiple de `rounding_ar` |
| Devis | `min_ar` | `amount_ar × (100 − price_variation_pct) / 100`, arrondi vers le haut à un multiple de `rounding_ar` |
| Devis | `max_ar` | `amount_ar × (100 + price_variation_pct) / 100`, arrondi vers le bas à un multiple de `rounding_ar` |
| Offre | `vehicle_id` | `driver_profile.active_vehicle_id` au moment de l'envoi |
| Offre | `category` | `vehicle.category` |
| Offre | `fare_quote_id` | Le devis actif de la réservation pour cette catégorie |
| Offre | `current_price_ar` | `accept` : `fare_quote.amount_ar`. `propose` et `counter` : `offer_proposal.amount_ar` |
| Offre | `expires_at` | Heure du serveur plus le délai de l'état, voir Règles de décision |
| Attribution | `driver_id`, `vehicle_id`, `agreed_price_ar` | L'offre acceptée, dans la même transaction |
| Changement de destination | `new_distance_m`, `new_distance_source` | Service de la fonction 5 |
| Changement de destination | `new_price_ar`, `settings_version_id` | Nouveau `amount_ar`, avec `booking.settings_version_id` |
| Changement de destination | `expires_at` | Heure du serveur plus `client_response_s` |
| Fin de course | `payment.agreed_amount_ar`, `completed_at` | `booking.agreed_price_ar`, heure du serveur |
| Historique | Libellé d'un lieu | `landmark.name`, sinon `district.name`, sinon la note, sinon un texte générique traduit |
| Historique | Catégorie d'une course | `offer.category` de l'offre acceptée ou retirée, pas `vehicle.category` |
| Historique d'un chauffeur remplacé | Courses concernées | Ses offres `withdrawn` |
| Recettes du jour | Jour | `booking.completed_at`, dans le fuseau `Indian/Antananarivo` |
| Comparaison et suivi | Identité, téléphone, véhicule | `user.name`, `user.phone` après attribution seulement, `vehicle`, `photo_key` |
| Comparaison et suivi | Distance jusqu'au client | Calculée à la lecture entre `driver_position` et `pickup_point`. Pas d'estimation de durée pour la démo |
| Statistiques | Activité des chauffeurs | En ligne maintenant (`is_online`), offres reçues (`offer`), courses terminées (`booking`). L'historique de connexion n'est pas conservé |
| Éligibilité | Position récente | `driver_position.received_at` et `gps_max_age_s` de la dernière version |
| Éligibilité | Abonnement valide (à partir de la fonction 28) | Une `subscription_period` en cours |
| Abonnement | `amount_ar`, `starts_at`, `ends_at` | `plan.price_ar`, le plus tard entre maintenant et la dernière `ends_at`, puis `starts_at + plan.duration_days` |
| Limite de contre proposition | Nombre par partie | Calculé depuis `offer_proposal` où `kind = counter` et `actor_kind` |
| Revenus | Montants convenus et encaissés | `payment.agreed_amount_ar` et `payment.declared_amount_ar` |
| Photos et documents | `photo_key`, `storage_key` | Clé rendue par le service de fichiers, choisi dans la spec de la fonction 22 |
| Traduction des motifs | Libellé | Fichiers de langue (fonction 7), par `reason_code` |

Valeurs de test de `seed_settings` (à ajuster depuis le back office) :

| Réglage | Valeur |
|---|---|
| `price_variation_pct` | 20 |
| `group_min_drivers`, `group_max_drivers` | 1, 3 |
| `driver_response_s`, `group_pause_s`, `max_groups` | 20, 3, 4 |
| `client_response_s`, `driver_counter_response_s` | 30, 30 |
| `gps_max_age_s` | 120 |
| Voiture : base, km, inclus, arrondi, capacité | 3000 Ar, 1000 Ar, 0 m, 100 Ar, 4 |
| Tuk-tuk : base, km, inclus, arrondi, capacité | 1500 Ar, 600 Ar, 0 m, 100 Ar, 3 |

**Key invariants**:

Garanties par la base :
- Une réservation a au plus une offre `accepted`.
- Un chauffeur a au plus une réservation active et au plus une offre ouverte.
- Une réservation a au plus une négociation en cours, et sollicite un chauffeur une seule fois.
- Une réservation active, terminée ou en litige a un chauffeur, un véhicule et un prix convenu.
- Un événement ou un paiement attribué à une personne garde son auteur.
- Une réservation a toujours un point de départ et un point de destination.
- Une réservation a un seul paiement, et un paiement d'abonnement donne une seule période.
- Aucune suppression n'emporte d'historique.

Garanties par le serveur (fonctions suivantes) :
- `settings_version`, `category_fare`, `fare_quote` et les journaux ne sont jamais modifiés, sauf `fare_quote.replaced_at`.
- Chaque changement de `booking.status` ajoute une ligne à `booking_event` dans la même transaction.
- Une proposition respecte `min_ar` et `max_ar`, et une contre proposition par partie au maximum.
- Toute expiration se compare à l'heure du serveur, jamais à celle du téléphone.
- `offer.category` correspond à la catégorie de son `fare_quote`.

**Security model**:

- Le rôle n'est jamais une entrée du client. Le plugin `admin` le protège à l'inscription, et seul un endpoint serveur peut le changer.
- Le plugin `admin` n'attribue ses droits qu'au rôle `admin`, et `support` reste sans droit de ce plugin.
- Les données sensibles sont `user.phone`, `user.email`, `driver_position`, `driver_document.storage_key` et les notes libres. Les procédures tRPC doivent choisir leurs colonnes explicitement, et ne jamais renvoyer une ligne entière de `user`.
- Aucune table ne stocke de secret de prestataire ni de numéro Mobile Money complet.
- Une suspension passe par `auth.api.banUser`, qui coupe aussi les sessions. Ne jamais écrire `user.banned` directement. Une action sensible d'admin écrit dans `audit_log`.
- `/admin/remove-user` est désactivée, car aucun compte n'est vraiment supprimé.
- `user.phone` n'est visible par l'autre partie qu'après l'attribution.
- Le mot de passe du `docker-compose.yml` reste réservé au local.
- Aucune norme de conformité n'est retenue pour la démo. La politique de conservation et de suppression reste à décider avant un vrai lancement (cahier §15).

**Configuration required**: aucune nouvelle variable d'environnement pour cette fonction. `drizzle.config.ts` reçoit `extensionsFilters: ["postgis"]`, pour que Drizzle Kit ignore les tables internes de PostGIS. La fonction 10 ajoutera `DRIVER_SIMULATOR_ENABLED`.

**Critical test scenarios**:
- Happy path : une course de `PENDING` à `COMPLETED` avec tous ses enregistrements, verifies **AC-3**.
- Failure case : deux transactions acceptent deux offres d'une même réservation en même temps, et une seule réussit, verifies **AC-4**.
- Failure case : le même `client_request_id` envoyé deux fois crée une seule réservation, verifies **AC-6**.
- Failure case : un chauffeur qui a une offre ouverte n'en reçoit pas une seconde, verifies **AC-5**.
- Auth/permission : une inscription avec `role: "admin"` est refusée et ne crée aucun compte, verifies **AC-2**.
- Remplacement : après le retrait du chauffeur attribué, un chauffeur écarté peut recevoir une nouvelle offre, et celui qui s'est retiré ne le peut pas, verifies **AC-13**.
- Arrondi : avec un tarif de 3300 Ar, une limite de 20 % et un arrondi de 100 Ar, `min_ar` vaut 2700 et `max_ar` vaut 3900, verifies **AC-14**.
- Journal : un événement `actor_kind = client` sans `actor_id` est refusé par la base, verifies **AC-15**.
- Données : un nouveau réglage ne change pas une réservation existante, verifies **AC-7**.
- Géographie : un point dans une zone et un point en dehors sont bien distingués, et une distance connue entre Toliara centre et un repère est juste à quelques mètres près, verifies **AC-11**.

## Build plan

Ta décision est de tout livrer en une migration de schéma. Pour respecter le Tracer Bullet, l'ordre prouve d'abord la chaîne complète (image, extension, migration, inscription), puis le plan vérifie une course réelle sur les tables.

1. Remplacer l'image par `postgis/postgis:17-3.6-alpine` dans `packages/db/docker-compose.yml`, et ajouter `extensionsFilters: ["postgis"]` à `drizzle.config.ts`, satisfies **AC-1**, **AC-11**
2. Créer avec `drizzle-kit generate --custom` la migration `enable_postgis` (`CREATE EXTENSION IF NOT EXISTS postgis`), et l'appliquer, satisfies **AC-1**
3. Ajouter à `createAuth` le plugin `admin` avec `defaultRole: "client"`, `phone` et `locale` avec leurs validateurs, le hook d'unicité, et désactiver `/admin/remove-user`. Fixer `auth:generate` sur la version de Better Auth du projet au lieu de `auth@latest`, puis le lancer, satisfies **AC-2**
4. Ajouter `inferAdditionalFields` aux deux clients d'authentification, et le téléphone aux formulaires d'inscription de `apps/web` et `apps/native`, car ce champ devient obligatoire, satisfies **AC-2**
5. Écrire `enums.ts` et `columns.ts`, puis les tables de `drivers.ts`, `places.ts`, `settings.ts`, `bookings.ts`, `dispatch.ts`, `payments.ts`, `support.ts` et `subscriptions.ts`, avec les relations dans `relations.ts`, et les listes de `packages/api/src/domain/codes.ts`, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-15**
6. Si la base locale contient déjà des tables créées par `db:push`, repartir d'un volume vide. Générer et appliquer la migration du schéma, en vérifiant dans le SQL chaque index partiel et chaque CHECK, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-10**, **AC-15**
7. Créer la migration personnalisée `seed_settings` avec les valeurs de test. Elle donne explicitement les identifiants (`gen_random_uuid()` convient pour ces lignes) et les dates, car ces colonnes n'ont pas de valeur par défaut en base, satisfies **AC-1**, **AC-7**
8. Écrire un script de vérification qui enregistre une course complète, puis tente les doubles attributions, les doublons, le remplacement d'un chauffeur et les suppressions interdites. Il vérifie aussi `ST_SRID(point) = 4326` après une insertion par Drizzle, et les arrondis de `min_ar` et `max_ar`, satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-14**, **AC-15**

## Consequences

**Positive**:
- Les tranches suivantes ajoutent de la logique sans casser le schéma.
- Les doubles attributions sont bloquées même en cas d'erreur dans le code.
- L'historique des prix, des décisions et des événements est complet dès la première course.

**Negative / tradeoffs**:
- 25 tables arrivent avant la première course, donc une erreur de conception se verra tard. Certaines ne serviront qu'en fin de plan, comme l'abonnement.
- PostGIS impose un hébergeur qui le propose, ce qui réduit le choix pour la fonction 8.
- L'image PostGIS est suivie par version mineure, donc Postgres n'est plus fixé exactement à 17.11.
- Le téléphone obligatoire casse les formulaires d'inscription actuels jusqu'à l'étape 4.
- Les journaux ne sont protégés que par convention de code, donc une erreur de code pourrait les réécrire.
- Une refonte par `db:push` n'est plus la voie normale : tout changement passe par une migration.

**Neutral**:
- Les migrations `enable_postgis` et `seed_settings` sont écrites à la main.
- Les tables de notifications arriveront avec la fonction 4, et le service de fichiers avec la fonction 22.

## Follow-up

- [ ] Choisir un hébergeur Postgres qui propose PostGIS dans la spec de la fonction 8.
- [ ] Mettre à jour `packages/db/AGENTS.md` et `packages/auth/AGENTS.md` après la construction (image, PostGIS, migrations, plugin `admin`).
- [ ] Remplacer les valeurs de test des réglages après l'étude terrain.
- [ ] Le cahier (§8.1) dit 2 à 3 chauffeurs par groupe, et ton scope accepte un groupe d'un seul chauffeur. Cette spec suit le scope (`group_min_drivers = 1`). Le cahier reste à aligner.
- [ ] Décider la politique de conservation et d'anonymisation avant un vrai lancement.
- [ ] AC-13, AC-14 et AC-15 ont été ajoutés après la contre vérification, et AC-2 a été corrigé pour suivre le comportement réel de Better Auth.
- [ ] Ajouter plus tard un seuil de précision GPS et un rayon de recherche, après les tests terrain (cahier §8.2).
- [ ] Ajouter un journal de disponibilité si les statistiques d'activité passée deviennent nécessaires, car ces données ne sont pas conservées pour l'instant.

## Rationale

Le raisonnement et les options sont dans [rationale.md](rationale.md).
