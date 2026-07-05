# Initiatives-Cœur — visite virtuelle du bateau

App web destinée aux visiteurs sur les villages de course (Vendée Arctique aux
Sables-d’Olonne, Route du Rhum à Saint-Malo). Le QR-code disposé sur le ponton
renvoie ici : visite 3D du bateau, audio guidé, présentation du projet et de
ses partenaires.

## Démarrer en local

Aucune installation. Tout est en HTML/CSS/JS statique avec Three.js via CDN.

```bash
# depuis la racine du projet (là où se trouve index.html)
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

(On peut aussi double-cliquer sur `index.html`, mais certains navigateurs
bloquent le chargement du GLB en `file://` — d’où le mini-serveur.)

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Landing (atterrissage QR), 4 tuiles |
| `visite.html` | Visite 3D du bateau + hotspots + audio |
| `projet.html` | Le projet, Violette Dorange, calendrier sportif |
| `mecenat.html` | Mécénat Chirurgie Cardiaque |
| `sponsors.html` | Sponsors & mécènes |
| `stats.html` | Dashboard statistiques (admin) |
| `assets/css/styles.css` | Design system (palette, fonts, composants) |
| `assets/js/visite.js` | Logique 3D + hotspots + panneau |
| `assets/js/content.js` | **Source unique des textes** des 8 hotspots |
| `assets/js/analytics.js` | Tracking événements (local + Plausible) |
| `assets/js/i18n.js` | Bascule bilingue FR/EN + dictionnaire des textes de page |
| `admin.html` + `assets/js/admin.js` | Back-office : éditer textes + médias sans code (Chrome/Edge) |
| `assets/models/imoca.glb` | Modèle 3D du bateau |
| `assets/audio/*.mp3` | Audios ElevenLabs pré-générés |
| `scripts/generate_audio.py` | Régénération des audios ElevenLabs |

## Modifier le contenu

**Textes des hotspots** → `assets/js/content.js`. Modifiez le texte d’un
hotspot, sauvegardez, puis relancez :

```bash
python3 scripts/generate_audio.py
```

Le script ne régénère que les fichiers manquants. Forcer la régénération de
tout : `python3 scripts/generate_audio.py --force`.

**Voix ElevenLabs** : par défaut la voix clonée de **Sam Davies**
(`voice_id` `smONmQidMr2FFPVUsEpw`, modèle multilingue). Pour changer, éditez
`ELEVENLABS_VOICE_ID` dans `.env` après avoir choisi une voix sur
https://elevenlabs.io/voice-library. Vous pourrez aussi y cloner la voix de
Violette pour un rendu plus authentique.

## Version bilingue FR / EN

L’app est bilingue. Le bouton **FR / EN** de l’en-tête bascule toute l’interface
en direct (sans rechargement), et le choix est mémorisé (`localStorage`). On
peut aussi forcer la langue via l’URL : `?lang=en`.

- **Textes de page** (accueil, projet, mécénat, sponsors, habillage de la
  visite) : dans `assets/js/i18n.js`, dictionnaire `DICT.fr` / `DICT.en`. Chaque
  élément traduit porte un attribut `data-i18n="clé"` dans le HTML.
- **Textes des hotspots** : dans `assets/js/content.js`, chaque hotspot a un
  bloc `en: { title, eyebrow, text }` à côté de sa version française.

**Audio anglais** : l’audio FR reste dans `assets/audio/`, l’audio EN est lu
depuis `assets/audio/en/`. Pour le générer (même voix Sam Davies, l’anglais est
sa langue maternelle) :

```bash
python3 scripts/generate_audio.py --lang en   # → assets/audio/en/<id>.mp3
```

Tant que ces fichiers ne sont pas générés, la version EN affiche le texte et
signale l’audio comme « à régénérer » — le reste de l’app fonctionne normalement.

## Ce qui reste à intégrer (placeholders)

| Élément | Où |
|---|---|
| Vidéo de visite par Violette | Renseigner `media.video` sur le hotspot (`content.js`) — l'onglet « Vidéo » s'active tout seul |
| Photos 360° (Insta X5) | Déposer les équirectangulaires dans `assets/panoramas/` puis les référencer (`PANORAMAS` ou `media.photo360`) — cf. le README du dossier. Le viewer est déjà en place. |
| Logos sponsors officiels | `assets/images/sponsors/` — déposer les fichiers (noms dans le README du dossier), affichage automatique |
| Photos détail par zone du bateau | Renseigner `media.image` sur le hotspot (`content.js`) — l'onglet « Photo » s'active tout seul |

Tous les emplacements affichent un cadre pointillé avec une indication du
contenu attendu. Aucune intégration ne casse l’app si un média manque.

## Statistiques

- Le module `analytics.js` enregistre tous les événements localement dans le
  navigateur (`localStorage`), visibles sur `stats.html`.
- **Pour une vraie remontée multi-visiteurs**, créez un compte Plausible
  (https://plausible.io) et ajoutez dans le `<head>` de chaque page :
  ```html
  <script defer data-domain="votre-domaine.fr"
          src="https://plausible.io/js/script.js"></script>
  ```
  `analytics.js` détecte automatiquement Plausible et lui transmet les
  événements. Aucun autre changement requis.

## Hotspots — positions

Les positions des hotspots sont définies dans `content.js` en coordonnées
**fractionnelles** (0 à 1) dans la boîte englobante du modèle. À l’exécution,
`visite.js` détecte automatiquement les axes du GLB et convertit en
coordonnées monde.

Si un hotspot apparaît au mauvais endroit, ajustez les valeurs dans
`content.js` :

```js
pos: { x: 0.50, y: 0.55, z: 0.97 }
//        beam        height      length
//   0=port/1=tribord  0=quille/1=mât  0=poupe/1=étrave
```

## Déploiement

L’app est 100% statique. N’importe quel hébergeur statique convient :

- **Vercel** : `vercel deploy` depuis la racine du projet
- **Netlify** : drag-and-drop du dossier du projet sur netlify.com
- **Cloudflare Pages** ou **GitHub Pages** : pareil
- **Serveur classique** : copier le contenu du dossier dans `/var/www/`

Le `.env` (qui contient la clé ElevenLabs) ne doit **jamais** être déployé —
il n’est utilisé qu’au moment de générer les audios. Le `.gitignore` l’exclut.

## QR-code de production

Une fois déployé, générez un QR-code pointant vers la racine du site
(par exemple https://visite.initiatives-coeur.fr). Imprimez-le en grand
format sur le panneau du ponton.

## Sécurité

La clé ElevenLabs n’est **utilisée que** par le script Python local. Elle
n’est jamais exposée au navigateur. Pensez à la régénérer depuis votre
dashboard ElevenLabs si vous l’avez partagée par messagerie.
