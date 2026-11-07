# Déployer Zay sur Dokploy

La stack est dans `docker-compose.prod.yml` : PostgreSQL avec PostGIS, les migrations, le serveur API et le web. L'application mobile n'en fait pas partie : elle se construit avec EAS et pointe vers l'API.

## Avant de commencer

- Deux enregistrements DNS de type A vers le serveur Dokploy, par exemple `zay.exemple.com` et `api.zay.exemple.com`.
- Au moins 4 Go de RAM et 15 Go de disque libres sur le serveur, à cause du build des images. Un build complet prend une dizaine de minutes.
- Le commit à déployer est poussé sur GitHub, et Dokploy a accès au dépôt.

## Créer le service

1. Dans un projet Dokploy, créer un service **Compose**, de type Docker Compose.
2. Dans **General**, choisir le dépôt et la branche `main`, puis mettre `./docker-compose.prod.yml` comme chemin du Compose.
3. Dans **Environment**, renseigner ces variables :

   ```bash
   POSTGRES_PASSWORD=   # openssl rand -hex 24 (hexadécimal, car il entre dans une URL)
   BETTER_AUTH_SECRET=  # openssl rand -hex 32
   API_DOMAIN=api.zay.exemple.com
   WEB_DOMAIN=zay.exemple.com
   VITE_CARTO_API_KEY=  # clé CARTO, à demander sur https://carto.com/basemaps/apikey/
   SMTP_URL=            # smtp://<utilisateur>:<mot de passe>@<hôte>:<port> ; le @ d'une adresse email s'écrit %40
   MAIL_FROM=           # par exemple : Zay <adresse@gmail.com>
   GOOGLE_CLIENT_ID=    # facultatif : connexion Google (spec 0004 et 0005)
   GOOGLE_CLIENT_SECRET=
   ```

   Pour Gmail : `SMTP_URL=smtp://adresse%40gmail.com:<mot de passe d'application>@smtp.gmail.com:587`. Le mot de passe d'application se crée sur https://myaccount.google.com/apppasswords (la validation en deux étapes doit être active). Gmail limite l'envoi à environ 500 emails par jour.

4. Dans **Domains**, ajouter deux domaines, avec HTTPS et Let's Encrypt :

   | Service | Domaine | Port |
   |---|---|---|
   | `server` | valeur de `API_DOMAIN` | 3000 |
   | `web` | valeur de `WEB_DOMAIN` | 3001 |

5. Lancer **Deploy**. Le service `migrate` s'arrête après avoir appliqué les migrations : c'est normal.

## Après le premier déploiement

Créer le premier admin depuis l'onglet **Terminal** du conteneur `server` :

```bash
bun run admin:create --email <email> --name "<nom>" --phone +261340000000
```

Puis vérifier :

- `https://<API_DOMAIN>/` répond `OK`.
- `https://<WEB_DOMAIN>/login` permet de se connecter, et `/admin` s'ouvre.

## Bon à savoir

- Changer `API_DOMAIN` demande un nouveau build du web, car l'adresse est écrite dans le code du navigateur. Il faut aussi reconstruire l'application mobile avec `EXPO_PUBLIC_SERVER_URL`.
- Changer `VITE_CARTO_API_KEY` demande aussi un nouveau build du web. L'application mobile a sa propre variable, `EXPO_PUBLIC_CARTO_API_KEY`, et doit être reconstruite de son côté.
- Le HTTPS est obligatoire : les cookies de session sont en `Secure` et `SameSite=None`.
- Garder une seule instance de `server`, car le dispatcher tourne dans le processus.
- Les données sont dans les volumes `postgres_data` et `uploads`. Les sauvegardes se règlent dans **Volume Backups**.
- Ne pas changer `POSTGRES_PASSWORD` après le premier déploiement sans le changer aussi dans PostgreSQL : l'image ne le lit qu'à la création du volume.
