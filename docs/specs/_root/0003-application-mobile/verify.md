# Verify: application mobile · spec 0003 · updated 2026-11-06
_Steps derived from the scope `Done when` lines and the cahier scenarios. `/check verify` runs these; `/test` locks the durable ones._

## Commands
- [x] `SEED_PASSWORD=<mot de passe> bun run seed:mobile` depuis `apps/server` → lieux, zones et comptes de test créés
- [x] `bun run verify:mobile` depuis `apps/server` → 42 ok, 0 failed (rôles, zones, scénarios A à G, minuteries, retrait)
- [x] Requêtes HTTP : inscription, `driver.register`, envoi d'un fichier, refus sans session ou si ce n'est pas une image

## UI / manual (deux téléphones, ou un téléphone et un compte qu'on change)
- [ ] Inscription client, puis chauffeur → chacun arrive dans son espace
- [ ] Le chauffeur passe en ligne et disponible, sa position apparaît sur `/admin/carte`
- [ ] Le client choisit un départ et une destination par GPS, carte, quartier et repère → prix par catégorie
- [ ] Un lieu hors de Toliara → refus clair
- [ ] Le chauffeur voit la demande et le compte à rebours, propose un prix hors du tarif indicatif avec un motif
- [ ] Le client compare, fait sa contre proposition, le chauffeur fait sa dernière offre, le client confirme → `ACCEPTED`
- [ ] Le suivi montre le chauffeur, son véhicule, sa position et l'appel. Couper le GPS du chauffeur plus de 2 minutes → position signalée comme ancienne
- [ ] Changement de destination → le prix ne change qu'après l'accord du chauffeur
- [ ] Le chauffeur avance jusqu'à la fin, déclare un montant partiel, le client conteste → visible aussi dans le back office
- [ ] Couper le réseau du client en pleine course, puis le rétablir → bandeau hors ligne, puis la course revient intacte
- [ ] Changer de langue dans le profil → tous les textes suivent
- [ ] Nouveau chauffeur : ajouter un véhicule et les documents → le dossier apparaît sur le web. Après validation, il devient éligible
- [ ] Le chauffeur se retire → le client est prévenu et la recherche repart sans ce chauffeur
