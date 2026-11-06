# Verify: Socle de l'espace admin · spec 0002 · updated 2026-11-06, passé par /check verify
_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Ces étapes écrivent dans la base. Lance les sur une base de test, car `--reset --yes` efface tous les comptes.

## UI / manual
- [x] Sans session, ouvre `/`, `/admin` et `/admin/compte` → chaque adresse arrive sur `/login` → AC-1
- [x] Connecte toi avec un admin sur `/login` → tu arrives sur `/admin` → AC-1
- [x] Connecte toi avec `client1@zay.test` → « Accès réservé à l'équipe », un bouton de déconnexion, aucun menu ni aucune donnée → AC-2
- [x] Ouvre `/dashboard`, et regarde `/login` → page introuvable, et aucun lien ni formulaire d'inscription → AC-2
- [x] Connecte toi avec `support@zay.test` → Réglages, Équipe et Journal sont absents du menu → AC-5
- [x] En support, ouvre `/admin/reglages`, `/admin/equipe` et `/admin/journal` → « Page réservée aux administrateurs » et aucune donnée → AC-5
- [x] Regarde `/login`, `/admin` et `/admin/compte` → fond blanc, boutons noirs en pilule, cartes à 16 px, police Inter, rouge seulement sur les erreurs, logo et favicon Zay → AC-7
- [x] Passe en largeur 390 px → le menu devient un panneau, se ferme après un clic, et la page ne défile pas de côté → AC-7
- [x] Connecte toi avec `client5@zay.test`, le compte suspendu → « Compte suspendu », et le formulaire garde la saisie → AC-2
- [x] Sur `/admin/compte`, change le mot de passe avec un mot de passe actuel faux, puis avec le bon → une erreur en français, puis un message de réussite, et l'autre session est fermée → Value sourcing, Mon compte
- [x] Compare le nom, l'email, le téléphone et le rôle de `/admin/compte` et de la coquille avec la ligne de `user` en base, pour un admin puis un support → les valeurs sont identiques → Value sourcing, Coquille et Mon compte
- [x] Change le rôle d'un compte en base de `support` à `admin`, puis recharge `/admin` → le menu suit le nouveau rôle → Value sourcing, Garde et Menu
- [x] Sur une nouvelle compilation Android, mets le téléphone en mode sombre et lance l'application → le logo reste visible sur le splash, l'icône est celle de Zay, et le paquet reste `com.anonymous.zayapp` → AC-9

## Commands
- [x] `POST /api/auth/admin/<route>` et `GET`, avec une session admin, sur les 15 routes du plugin → 404 partout, aussi pour `set-role/` → AC-3
- [x] Appelle une procédure `staffProcedure` et une `adminProcedure` avec chaque rôle → `client` et `driver` : `FORBIDDEN` aux deux. `support` : réussit puis `FORBIDDEN`. `admin` : réussit aux deux. Sans session : `UNAUTHORIZED` → AC-4
- [x] Change le rôle d'un compte en base entre deux appels, sans te reconnecter → le droit suit dès l'appel suivant → Value sourcing, Procédures
- [x] `bun run admin:create --email a@zay.test --name Test --phone +261340000001`, puis connexion → le compte fonctionne, et `account.password` est haché → AC-6
- [x] Relance `admin:create` avec le même email, le même téléphone, un téléphone `123`, puis un mot de passe trop court → refus, code de sortie 1, et aucune ligne ajoutée → AC-6
- [x] Vérifie que `admin:create` n'a pas d'option de mot de passe → le mot de passe vient seulement de `prompt()` → AC-6, Value sourcing, `admin:create`
- [x] Sur une base migrée et vide, `bun run seed:backoffice` → 16 comptes, 41 réservations, 9 chauffeurs, 5 signalements, réglages en version 2, et les nombres par statut de la spec → AC-8
- [x] Relance `bun run seed:backoffice` → il s'arrête, et rien ne change → AC-8
- [x] Lance le seed à deux heures différentes de la journée à Antananarivo → 3 courses terminées, 2 annulations et 1 recherche sans chauffeur tombent le jour même dans ce fuseau, et aucune date n'est dans le futur → AC-8
- [x] Ajoute un compte hors `@zay.test`, puis lance `--reset --yes` et le seed → refus, et rien n'est effacé ni créé → AC-8
- [x] `bun run seed:backoffice --reset` sans `--yes` → refus, et rien n'est effacé → AC-8
- [x] `bun run seed:backoffice --reset --yes` → aucun compte ni réservation, mais la version 1 des réglages, ses tarifs et les lieux restent → AC-8
- [x] Cherche `Uber` et `UberMove` dans `apps/` et `packages/`, sans `node_modules` ni `dist` → aucun résultat → AC-7
- [x] Cherche `@zay-app/db` et `@zay-app/auth` dans `apps/web/src` → aucun résultat → Key invariants
- [x] `bun run check-types`, `bun run build` et `bun run db:verify` → tout passe → non régression

## Acceptance-criteria coverage
- AC-1 : les deux premières étapes manuelles
- AC-2 : les étapes manuelles client, `/dashboard` et compte suspendu
- AC-3 : première commande
- AC-4 : deuxième commande
- AC-5 : les deux étapes manuelles support
- AC-6 : les trois commandes `admin:create`
- AC-7 : les deux étapes visuelles, et la recherche de mots
- AC-8 : les six commandes du seed
- AC-9 : dernière étape manuelle, qui demande une nouvelle compilation Android

---

# Verify: Modules de l'espace admin · spec 0002 · updated 2026-11-06
_Étapes pour les fonctions 23 à 27. Elles restent à cocher par `/check verify <fonction>`. Lance les sur une base de test, après `bun run seed:backoffice`._

## Réglages (fonction 25)
- [ ] Sur `/admin/reglages`, change une valeur, vérifie la comparaison, saisis une note et enregistre → une nouvelle version et ses deux tarifs existent, avec son auteur, et les anciennes lignes sont intactes → AC-10
- [ ] Après ce changement, regarde une réservation existante → elle garde sa version de réglages → AC-11
- [ ] Mets le minimum du groupe au dessus du maximum, une note vide, puis ne change rien → message par champ, puis message « aucune valeur », et aucune version créée → AC-12
- [ ] Ouvre le formulaire, crée une version ailleurs, puis enregistre → `SETTINGS_CHANGED`, un bouton Recharger, et l'historique montre auteur, date, note et valeurs → AC-13

## Comptes et équipe (fonction 26)
- [ ] Sur `/admin/clients`, cherche par nom, email et téléphone, filtre les suspendus, ouvre un client → identité, état et 10 réservations. Un identifiant de chauffeur répond `NOT_FOUND` → AC-14
- [ ] Suspends un client sans course active → sa session tombe, il ne peut plus se connecter, et `account.banned` existe. Un chauffeur passe hors ligne et ses offres ouvertes en `void` → AC-15
- [ ] Suspends un compte en course → refus, rien ne change, et un lien mène à la réservation → AC-16
- [ ] Réactive ce compte, puis réactive un compte actif → connexion possible et `account.unbanned`, puis refus → AC-17
- [ ] Crée un compte équipe, puis essaie un téléphone mal formé et un doublon → connexion possible, `team.created` sans mot de passe, puis messages clairs → AC-18
- [ ] Change le rôle d'un collègue, puis essaie ton propre compte et un client → le droit suit dès la requête suivante, `team.role_changed`, puis refus → AC-19
- [ ] Lis `/admin/journal` et filtre par action → auteur, action, cible, date, avant et après. Te suspendre toi même est refusé → AC-20

## Supervision et signalements (fonction 24)
- [x] Filtre `/admin/reservations` par statut, période et recherche, puis ajoute une réservation en base → la liste suit, et la ligne apparaît en 10 s sans recharger → AC-21
- [x] Ouvre une réservation → client, chauffeur, véhicule, lieux, catégories, devis, offres, version, paiement et événements avec auteur, heure et motif → AC-22
- [x] Annule une réservation `ACCEPTED`, et une `OFFERED` → chauffeur et prix gardés, offres ouvertes `void`, groupes `closed`, événement avec auteur et motif → AC-23
- [x] Change le statut en base avant de confirmer, puis annule une course terminée → `BOOKING_STATUS_CHANGED`, et l'écran affiche l'état réel → AC-24
- [x] Rejoue la même action avec le même `clientRequestId` → un seul événement → AC-25
- [x] Ouvre puis ferme un litige → `dispute_opened`, `dispute_closed`, et `completed_at` inchangé → AC-26
- [x] Résous un paiement contesté à 0, à une partie, puis au prix convenu → `pending`, `partial`, `paid`. Au dessus du prix convenu, c'est refusé et rien n'est écrit. Sur un autre statut, c'est refusé → AC-27
- [x] Filtre `/admin/signalements`, et prends en charge à deux en même temps → une seule réussite, l'autre voit `REPORT_STATUS_CHANGED` → AC-28
- [x] Ajoute une note, résous, rouvre, clos → un `report_event` par geste, et `closed` refuse tout → AC-29

## Validation des dossiers (fonction 23)
- [ ] Filtre `/admin/chauffeurs`, ouvre un dossier → repères simulé et hors ligne, véhicules, documents, décisions. Un identifiant sans profil répond `NOT_FOUND` → AC-30
- [ ] Ouvre un document, puis un fichier absent, puis `GET /files/<clé>` sans session et en client → image, puis « Fichier indisponible », puis 401 et 403 → AC-31
- [ ] Décide sur un document et un véhicule, sans motif puis avec, puis sur un document remplacé → statut et décision ensemble, refus sans motif, `VERIFICATION_STATUS_CHANGED` → AC-32
- [ ] Ouvre le chauffeur 2 → Approuver est désactivé avec l'explication, et le serveur répond `DOCUMENTS_NOT_APPROVED` → AC-33
- [ ] Suspends un chauffeur en course avec une offre ouverte → offre `void`, course continue, compte connecté → AC-34
- [ ] Fais expirer une pièce, puis réactive le chauffeur 8 → refus. Sans pièce expirée, retour à `approved` avec une décision → AC-35
- [ ] En support, ouvre un dossier et appelle `decide` → lecture et documents visibles, aucun bouton, `FORBIDDEN` → AC-36

## Statistiques (fonction 27)
- [ ] Compare chaque tuile à une requête SQL, sur Aujourd'hui, 7 et 30 jours → mêmes nombres → AC-37
- [ ] Regarde la courbe et les barres → 24 heures ou 7 et 30 jours sans trou, fuseau `Indian/Antananarivo`, valeurs lisibles sans survol → AC-38
- [ ] Décoche « Inclure les chauffeurs simulés » → seules courses terminées, offres, courses actives et chauffeurs en ligne baissent → AC-39
- [ ] Sur une base sans réservation, puis avec l'API en échec → zéros et message, puis erreur avec Réessayer. Les chiffres suivent en 10 s → AC-40
