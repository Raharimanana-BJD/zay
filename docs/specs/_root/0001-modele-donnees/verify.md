# Verify: Modèle de données · spec 0001 · updated 2026-11-06
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Web, `/login`, créer un compte sans téléphone ou avec `0340000000` → message de format, aucun compte → AC-2
- [x] Web, créer un compte avec `+261340000001` → compte créé, `user.role = client`, `user.locale = fr` → AC-2
- [x] Web, recréer un compte avec le même téléphone → message clair « already used » → AC-2
- [x] Mobile, mêmes trois essais sur l'écran d'inscription → même résultat → AC-2

## Commands
- [x] `bun run db:verify` → 67 contrôles réussis, 0 échec, dans une base jetable → AC-2 à AC-15
- [x] Sur un volume vide : `bun run db:down`, supprimer le volume, `bun run db:start`, `bun run db:migrate` → PostGIS, 25 nouvelles tables, version 1 des réglages → AC-1
- [x] `bun run db:generate` → « No schema changes » → AC-1
- [x] `bun run check-types` → aucune erreur

## Sources des valeurs
- [x] Réglages : les valeurs de `settings_version` et `category_fare` correspondent au tableau de la spec → seed_settings
- [x] `role` : un `role` envoyé à l'inscription est refusé, y compris vide → AC-2
- [x] `phone`, `locale` : `locale: en` est refusé, sans `locale` la valeur est `fr` → AC-2
- [x] `amount_ar`, `min_ar`, `max_ar` : 3300 Ar à 20 % et arrondi 100 donnent 2700 et 3900, et une part incluse ne compte pas → AC-14
- [ ] Attribution : `driver_id`, `vehicle_id`, `agreed_price_ar` viennent de l'offre acceptée → AC-4
- [x] Offre : `offer.category` reste celle de l'offre même si le véhicule change plus tard → AC-3
- [x] Changement de destination : le lieu, le prix et le devis actif ne bougent qu'après les deux accords → AC-8
- [ ] Fin de course : `payment.agreed_amount_ar` vaut `booking.agreed_price_ar`, et le statut commence à `pending` → AC-9
- [ ] Recettes du jour : une course terminée à 22 h UTC compte pour le lendemain dans `Indian/Antananarivo` (à contrôler avec la fonction qui calcule les recettes)
- [ ] Les autres lignes de Value sourcing (distance, éligibilité, abonnement, traductions) reposent sur des fonctions suivantes : à contrôler avec chacune d'elles

## Acceptance-criteria coverage
- AC-1 : commandes ci dessus, et début de `db:verify`
- AC-2 : écrans ci dessus, et section AC-2 de `db:verify`
- AC-3 à AC-15 : section de même nom dans `db:verify`
