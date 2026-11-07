# 0005.0001. Interface globale : splash, carte plein écran, onglets

## Summary

Trois retouches visuelles, sans changement de données. Le splash devient jaune avec le logo noir et trois points animés. Chaque carte peut s'agrandir en plein écran, avec quatre contrôles. La barre d'onglets ne garde que les icônes.

Raison courte : Android ne sait pas animer son splash natif, donc on le prolonge par un écran identique dessiné par l'app. Les contrôles de carte passent par des commandes envoyées à la carte Leaflet existante, sans nouvelle bibliothèque.

## Feature design

### Splash (AC-1)

- `app.json`, plugin `expo-splash-screen` : `backgroundColor` et `dark.backgroundColor` à `#f7c910`, `image` : `./assets/images/splash-icon.png` (copie de `Resource-zayapp/splash-icon.png`, logo noir), `imageWidth` 200. Il faut refaire le build natif.
- Composant `components/splash.tsx` : même fond, même logo, même taille et même centre que le natif, et trois points noirs de 10 px sous le logo. Chaque point monte et descend (Reanimated, boucle de 900 ms, décalage de 150 ms). `useReducedMotion()` vrai → points fixes.
- `app/_layout.tsx` : `SplashScreen.preventAutoHideAsync()` au chargement du module. Le composant appelle `SplashScreen.hideAsync()` à son premier affichage, pour éviter un saut entre les deux. Il reste affiché tant que la session est en lecture (`authClient.useSession().isPending`), OU qu'une session existe et que `me.get` n'a pas encore répondu (le rôle et `isComplete` en dépendent), OU que moins de 1000 ms se sont écoulées depuis son montage. Il s'efface ensuite en fondu (200 ms). Si `me.get` échoue (réseau), on garde le comportement actuel : le rôle de la session stockée. Il remplace le `Loading` du démarrage seulement ; les autres `Loading` ne changent pas.

### Onglets (AC-2)

- `components/tab-bar.tsx` : on retire le texte. L'icône passe à 24 px, avec le point jaune dessous. `accessibilityLabel` garde `options.title`. La hauteur de la barre baisse d'autant (vérifier `TAB_BAR_SPACE` dans `reserver.tsx`).

### Carte plein écran (AC-3, AC-4)

- `ZayMap` reçoit une prop `fullscreen?: { summary?: MapSummary; locate?: () => Promise<MapCoordinates | null> }`. Avec elle, un bouton rond blanc (icône `expand`, 44 px, coin haut droit) ouvre `MapFullscreen`.
- `MapFullscreen` : une `Modal` plein écran (`animationType="fade"`, `statusBarTranslucent`) qui monte une deuxième `ZayMap` avec les mêmes `markers`, `line` et `center` que la carte d'origine. Comme elle reçoit les mêmes props, elle se met à jour en même temps. Bouton Fermer (icône `close`, haut gauche) ; `onRequestClose` gère le retour Android.
- Commandes ajoutées au HTML de `zay-map.tsx` et appelées par `injectJavaScript` : `zayZoom(+1|-1)`, `zayFitAll()` (cadre sur tous les repères et la ligne, marge de 48 px), `zayCenter(lat, lng)` (zoom 16).
- Contrôles (colonne de boutons ronds blancs, à droite, au dessus du bandeau) : recentrer, voir tout, zoom +, zoom −. Recentrer appelle `locate()`. Côté client, `currentPlace()` demande la permission de localisation si elle n'a pas encore été demandée (comportement actuel de `place-picker.tsx`) ; côté chauffeur, la position vient de `useDriverPosition`, qui a déjà la permission. Sans position (refus ou erreur), un toast « Position introuvable » et rien ne bouge.
- Bandeau résumé : carte blanche arrondie en bas, au dessus de la zone sûre. Rien n'est affiché si `summary` est absent.

**Value sourcing**
| Écran | Valeur | Source |
|---|---|---|
| Réserver | titre du bandeau | `t("home.estimate")` avec `quote.data.distanceM` (déjà lu) |
| Réserver | prix | `quote.data.quotes` de la catégorie choisie (automatique → le plus bas) ; absent sans devis |
| Réserver | ma position (recentrer) | `currentPlace()` de `place-picker.tsx` (GPS du téléphone) |
| Suivi client `booking/[id]` | statut | `client.booking` → `status`, libellé `status.<STATUS>` |
| Suivi client | prix convenu | `client.booking` → `agreedPriceAr` (`formatAr`, « — » si nul) |
| Suivi client | trajet | `client.booking` → `pickup.label` → `destination.label` |
| Suivi client | ma position | `currentPlace()` (GPS du téléphone) |
| Accueil chauffeur | statut | « En ligne » ou « Hors ligne » depuis `driver.home` → `isOnline` ; s'il y a une offre : `driver.newRequest` |
| Accueil chauffeur | ma position | `useDriverPosition` → `coords` (déjà lu) |
| Course chauffeur `ride/[id]` | statut, prix, trajet | `driver.ride` → statut, `agreedPriceAr`, `pickup`, `destination` |
| Course chauffeur | ma position | `useDriverPosition` → `coords` |

**Key invariants** : une carte en plein écran affiche exactement les mêmes données que la petite. Fermer ne perd ni la saisie ni l'état de l'écran dessous.

**Critical test scenarios** :
- Ouverture à froid : jaune, logo, points qui bougent, puis l'écran de connexion ou l'espace du rôle, verifies **AC-1**
- Lecteur d'écran sur la barre : chaque onglet est annoncé par son nom, verifies **AC-2**
- Suivi d'une course en plein écran : le repère du chauffeur bouge pendant que la carte est agrandie ; « voir tout » cadre les trois repères, verifies **AC-3**, **AC-4**
- Position refusée : recentrer affiche le toast et la carte ne bouge pas, verifies **AC-4**
