# Vento — planificateur vélo

Application web (PWA) pour préparer ses sorties à vélo : **vent**, **pistes cyclables**, **vélo-taf**, dénivelé, points d'intérêt et **entraînement** (Strava). Elle s'installe sur Android comme une vraie application et exporte les trajets en **GPX** (Garmin, Huawei…).

## Installer sur Android

1. Ouvre l'adresse de l'application dans **Chrome** : `https://<ton-compte>.github.io/<nom-du-depot>/`
2. Menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. L'icône **Vento** apparaît comme une application ; elle s'ouvre en plein écran.

## Fonctions

- **Départ / arrivée** (adresse, point sur la carte, 🏠 maison, 🏢 travail) et point intermédiaire par simple clic ; on peut **tirer le tracé** pour le dévier.
- **Retour / Rétablir** illimités (Ctrl+Z / Ctrl+Y).
- **Itinéraire le plus sûr** (BRouter, profil « très peu de trafic ») avec **score de sécurité** : part de piste cyclable, bande cyclable, rue calme, route à fort trafic.
- **Cartes** : vectorielles modernes (OpenFreeMap : moderne, clair épuré, sombre), CyclOSM, relief avec courbes de niveau, satellite. Choix via le bouton des couches en haut à droite de la carte.
- **Carte des pistes cyclables** : fond atténué + aménagements cyclables OpenStreetMap en couleur.
- **Vélo, course à pied ou marche** : un sélecteur en haut de l'onglet Trajet change l'activité. Routage piéton (chemins et sentiers, randonnée, rues) et durée calculée à partir de ton **allure** (ajustée à la pente et au vent) pour la course et la marche ; export GPX typé.
- **Importer et modifier un GPX** : bouton « Importer un GPX », glisser-déposer sur PC, ou **Partager → Vento** depuis une autre application Android. La trace est conservée telle quelle ; tu la déformes en la tirant, ou tu la **recales sur les routes** (score de sécurité). Les points d'intérêt du fichier sont repris.
- **Mes points d'intérêt** : appui long sur la carte (clic droit sur PC) pour ajouter un repère (fontaine, ravito, vue, danger…) ; ils se modifient, se déplacent, sont enregistrés avec le parcours et exportés dans le GPX.
- **Envoi vers VeloIndoor** (ton appli reliée au home trainer) : bouton « 🚴 VeloIndoor » sur chaque séance (étapes en watts) et sur l'export d'un parcours (profil d'altitude). Sur Android le lien ouvre l'application installée, sinon la version web ; la séance est aussi copiée dans le presse-papiers (« Importer depuis Vento » dans VeloIndoor).
- **Séances pour ROUVY** (page Entraînement) : chaque séance du plan se télécharge en **ERG** (watts exacts, format recommandé), **ZWO** ou **MRC** (% du FTP), trois formats que ROUVY importe (portail Riders → Workouts → Import from file). Les parcours exportés en GPX s'importent aussi dans ROUVY (Routes → Import from file, 200 km / 10 Mo max).
- **Flèches de vent animées** sur la carte (bouton 💨) : le sens des flèches suit le vent, elles défilent d'autant plus vite et changent de couleur (bleu → vert → jaune → rouge) que le vent est fort ; le vent affiché correspond à l'heure de départ choisie.
- **Vent** par tronçon à l'heure de passage, meilleur créneau de départ, comparaison du sens de parcours.
- **Vélo-taf** : enregistre maison et travail, compare chaque jour le vent et la durée aller / retour.
- **Temps estimé** à partir de ta puissance (profil Strava), côtes détectées, météo.
- **Points d'intérêt** : eau, boulangeries, cafés, vélo, gares… (Overpass).
- **Export / import GPX**, sauvegarde locale des parcours ; sur Android, fenêtre d'envoi vers Garmin Connect.
- **Interface téléphone** : carte plein écran, panneau coulissant à onglets (Trajet, Parcours, Vent, Vélo-taf, POI, Moi) et barre d'actions en bas (Retour, Rétablir, Boucle, Pistes, GPX).
- **Synchronisation téléphone ↔ PC** (onglet « Moi ») : maison, travail, vélo-taf, parcours sauvegardés et profil, chiffrés (AES-256) dans le navigateur puis déposés dans un **Gist secret** de ton GitHub (jeton avec la seule permission `gist` + phrase secrète). Le Client ID / Secret de ton application Strava sont synchronisés (chiffrés) pour une connexion en un clic sur chaque appareil ; les jetons de connexion restent sur chaque appareil.
- **Entraînement** (`training.html`) : FTP, courbe de puissance, forme/fatigue, zones, côtes, conseils et plan de la semaine.

## Données et vie privée

Tout est calculé **dans ton navigateur**. Parcours, maison, travail et profil sont enregistrés dans le stockage local de ton appareil, jamais dans ce dépôt. Services externes utilisés : OpenStreetMap / CyclOSM (cartes), BRouter (itinéraires), Open-Meteo (vent, altitude), Overpass (POI et pistes), Nominatim (adresses), Strava (optionnel).

## Connexion Strava (optionnelle, page Entraînement)

1. Crée une application sur <https://www.strava.com/settings/api> ; mets comme **Authorization Callback Domain** : `<ton-compte>.github.io`.
2. Ouvre `training.html`, colle ton Client ID et ton Client Secret (ils restent dans ton navigateur, **ne les mets jamais dans le code**), puis « Se connecter à Strava ».
3. Sans cela, tu peux saisir à la main FTP, poids et FC max.

## Lancer en local sur PC

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
puis ouvre <http://localhost:8765/>.

## Publier / mettre à jour (GitHub Pages)

Dépôt public → **Settings → Pages → Deploy from a branch → `main` / `(root)`**. Chaque `git push` met le site à jour en une minute environ.

Les estimations (durée, vent, FTP, conseils) sont des repères : reste prudent sur la route.
