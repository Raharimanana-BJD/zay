# Verify: compléter l'authentification · spec 0004 · updated 2026-11-07
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._
_Start PostgreSQL and Mailpit (`bun run db:start`), then the server. Mails show up at http://localhost:8026._

## UI / manual
- [ ] Mobile : crée un compte client → écran « Vérifiez votre email », aucun accès à l'espace client → AC-1
- [ ] Mobile : saisis un mauvais code → « Code incorrect » ; saisis le bon code (Mailpit) → arrivée dans l'espace client → AC-2
- [ ] Mobile : crée un compte chauffeur, vérifie le code → arrivée dans l'espace chauffeur, avec la relation choisie → AC-1, AC-2
- [ ] Mobile : connecte un compte non vérifié → écran de code, un nouveau code arrive dans Mailpit → AC-2
- [ ] Après la vérification, un seul email « Bienvenue sur Zay » arrive, dans la langue du compte (fr ou mg) → AC-3
- [ ] Mobile « Mot de passe oublié ? » : email → code → nouveau mot de passe → retour à la connexion, l'ancien mot de passe est refusé → AC-4
- [ ] Web `/login` → « Mot de passe oublié ? » → `/mot-de-passe-oublie` : même parcours → AC-4
- [ ] Mobile Profil → Sécurité → « Changer le mot de passe » : mauvais mot de passe actuel refusé, le bon change le mot de passe → AC-5
- [ ] Web `/admin/compte` : changer le mot de passe ferme les autres sessions → AC-5
- [ ] Avec `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sur le serveur et `EXPO_PUBLIC_GOOGLE_SIGN_IN=true` : Google avec l'email d'un compte existant → connecté ; avec un email inconnu → message « Aucun compte Zay », aucun compte créé → AC-6
- [ ] Un membre créé depuis `/admin/equipe` se connecte sans code → AC-7

## Commands
- [ ] `POST /api/auth/sign-up/email` → 200 avec `"token": null`, un email de code dans Mailpit → AC-1
- [ ] `POST /api/auth/sign-in/email` sur un compte non vérifié → 403 `EMAIL_NOT_VERIFIED` → AC-2
- [ ] `POST /api/auth/email-otp/reset-password` avec le bon code → 200, l'ancienne session renvoie `null` à `get-session` → AC-4
- [ ] `POST /api/auth/sign-in/email-otp` → 404 (route fermée) → spec, Assumption
- [ ] `bun run admin:create` puis `bun run seed:backoffice` → ces comptes se connectent sans code → AC-7
- [ ] `bun run db:verify` → 67 checks passed → non regression
- [ ] `grep -rn "@zay-app/email\|@zay-app/auth\"" apps/native apps/web --include='*.ts*'` → rien ; `grep -rn "process.env\|ENV" packages/email/src` → rien → AC-8

## Acceptance-criteria coverage
- AC-1 … UI 1, 3 · Commands 1
- AC-2 … UI 2, 3, 4 · Commands 2
- AC-3 … UI 5
- AC-4 … UI 6, 7 · Commands 3
- AC-5 … UI 8, 9
- AC-6 … UI 10
- AC-7 … UI 11 · Commands 5
- AC-8 … Commands 7
