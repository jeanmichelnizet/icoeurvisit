# Initiatives-Cœur — Visite virtuelle (handoff de développement)

App web destinée au QR code sur les pontons des villages de course.
Visiteur scanne → atterrit sur l'app → visite 3D du bateau avec hotspots,
audio Sam Davies, présentation du projet et des partenaires.

## Stack technique

- **HTML/CSS/JS vanilla** (pas de build, pas de bundler, pas de Node)
- **Three.js r128** auto-hébergé dans `assets/vendor/` (chargement du GLB,
  raycasting, OrbitControls) — aucune dépendance CDN au runtime
- **Python 3** (uniquement pour pré-générer les audios via l'API ElevenLabs)
- **ElevenLabs API** pour la synthèse vocale (voix : Sam Davies cloned)

Pourquoi vanilla et pas Next.js / React : le Mac initial n'avait pas Node.
La stack résultante est plus simple, plus rapide à déployer (n'importe quel
hébergeur statique), et plus facile à reprendre n'importe où.

## Pour démarrer sur un autre Mac

```bash
# 1. Récupérer le bundle (ce dossier)
cd /chemin/où/vous/extrayez/initiatives-coeur-visite-3d

# 2. Lancer le serveur local de dev
python3 -m http.server 8080
# → ouvrir http://localhost:8080
```

Python 3 est pré-installé sur macOS depuis Catalina. Si jamais il manque :
```bash
xcode-select --install   # installe les Command Line Tools (inclut python3)
```

## Structure du projet

```
initiatives-coeur-visite-3d/
├── HANDOFF.md              ← ce fichier (à lire en premier)
├── README.md               ← doc utilisateur courte
├── .env.example            ← template (.env n'est PAS exporté pour sécurité)
├── .gitignore
├── index.html              ← landing (atterrissage QR)
├── visite.html             ← visite 3D + hotspots (cœur de l'app)
├── projet.html             ← Violette, calendrier sportif
├── mecenat.html            ← Mécénat Chirurgie Cardiaque
├── sponsors.html           ← Sponsors & mécènes
├── stats.html              ← Dashboard analytics (admin)
├── admin.html              ← Back-office : édite textes + médias, écrit content.js (Chrome/Edge)
├── manifest.webmanifest    ← PWA : app installable (« ajouter à l'écran d'accueil »)
├── sw.js                   ← service worker : offline + cache (shell network-first, assets cache-first)
├── assets/
│   ├── css/styles.css           ← design system complet
│   ├── js/visite.js             ← 3D + hotspots + édition (le cerveau)
│   ├── js/content.js            ← données des 8 hotspots (FR + EN, positions calibrées)
│   ├── js/analytics.js          ← tracking événements
│   ├── js/i18n.js               ← bascule bilingue FR/EN + dictionnaire des pages
│   ├── js/panorama.js           ← viewer 360° équirectangulaire (réutilise Three.js)
│   ├── js/admin.js              ← logique du back-office (File System Access API)
│   ├── models/imoca.glb         ← modèle 3D (~3,5 Mo)
│   ├── audio/                   ← 8 MP3 ElevenLabs (~3,7 Mo)
│   ├── images/                  ← images projet/MCC + sous-dossier sponsors/ (logos)
│   ├── panoramas/               ← images 360° équirectangulaires (à fournir)
│   ├── icons/                   ← favicon.svg + icônes PWA (icon-192/512/180.png)
│   └── vendor/                  ← Three.js r128 auto-hébergé (three.min, OrbitControls, GLTFLoader)
└── scripts/
    └── generate_audio.py        ← régénération des audios via API ElevenLabs
```

## Ce qui est fait ✅

- Visite 3D du bateau avec **8 hotspots calibrés à la main** (positions
  fractionnelles précises dans le GLB)
- Pour chaque hotspot : **viewDir** (angle caméra à l'orbit) et
  **leadLen** (longueur du fil de l'étiquette) calibrés
- **Fils ivoire avec halo noir** pour lisibilité sur tout fond
- **Caméra perpendiculaire au leadDir** pour ne pas masquer l'ancre
- **Animation caméra fluide** à chaque clic de hotspot
- **8 audios ElevenLabs** avec la voix de Sam Davies (cellule de vie / live)
- **Mode édition** `?edit` complet : palette numérique + sliders X/Y/Z +
  capture de vue + slider distance étiquette + ALT-drag pan + bouton copier
- **Snap automatique désactivé** sur les hotspots calibrés (positions exactes)
- **Pages contextuelles** : projet/Violette, mécénat, sponsors
- **Dashboard analytics** local (`stats.html`) avec localStorage,
  prêt à brancher Plausible
- **Tracking événements** : pageview, hotspot:open, audio:play,
  audio:complete, media:view, etc.
- **Version bilingue FR / EN** : bouton dans l’en-tête (bascule live,
  mémorisée dans `localStorage`, forçable via `?lang=en`). Textes de page dans
  `assets/js/i18n.js` (`DICT.fr` / `DICT.en`, attributs `data-i18n`), textes des
  hotspots sous `en:` dans `content.js`. Audio EN lu depuis `assets/audio/en/`.
- **Three.js auto-hébergé** (`assets/vendor/`) + écran d’erreur lisible si le
  moteur 3D ou le modèle ne se charge pas (plus d’écran noir muet).
- **Favicon, Open Graph, emplacement Plausible** prêts sur toutes les pages.
- **Viewer 360° équirectangulaire** (`assets/js/panorama.js`, réutilise Three.js) :
  bouton « 360° » plein cadre (via `PANORAMAS`) et onglet « Vue 360° » par hotspot
  (via `media.photo360`). Gated : repli sur le placeholder tant qu'aucune image n'est fournie.
- **Logos sponsors en drop-in** (`assets/images/sponsors/`) : s'affichent dès dépôt, repli texte.
- **Navigation guidée** dans le panneau (Précédent / compteur `n/8` / Suivant, + flèches clavier).
- **Barre de progression** au chargement du bateau (en plus du %).
- **Back-office local** (`admin.html`) : édite les textes FR/EN et gère les médias
  (photo/vidéo/360°, par fichier ou lien) + la galerie panoramas, puis réécrit
  `assets/js/content.js` **sans perdre la calibration 3D**. Tourne dans le navigateur
  (Chrome/Edge, File System Access API) : servir en local, ouvrir `/admin.html`,
  « Connecter le dossier », éditer, « Enregistrer », recharger, redéployer.
  Repli sans connexion : bouton qui télécharge `content.js`. Gère aussi les vues
  3D intérieures (ci-dessous).
- **Vues 3D intérieures** (`SCENES` dans `content.js`) : scènes Gaussian-splat
  hébergées sur **superspl.at**, affichées en **embed iframe** plein cadre (bouton
  ajouté à côté de 3D / 360° / Vidéo). Pas de refonte Three.js : `visite.js` normalise
  un id / lien de scène en URL d'embed. Gérées dans l'admin (id ou lien). Une scène de
  **test** (`a90175ab`) est branchée — à remplacer/retirer via l'admin.
- **PWA** : installable (`manifest.webmanifest` + icônes) et service worker (`sw.js`) —
  offline + cache. Stratégie : app shell (HTML/JS/CSS) en *network-first* (jamais de version
  périmée), assets lourds (GLB, audio, Three.js, polices) en *cache-first*. Bump `CACHE`
  dans `sw.js` pour tout invalider. **HTTPS requis en prod** (OK sur Netlify/Vercel/CF).

## Ce qui reste à intégrer 🔧

| Élément | Où | Comment |
|---|---|---|
| Vidéo de visite par Violette Dorange | `visite.html` onglet "Vidéo" | Drop-in : renseigner `media.video` (chemin du fichier) sur le hotspot dans `content.js` — l'onglet s'active et lit la vidéo. Repli placeholder sinon |
| Photos 360° Insta One X5 | `assets/panoramas/` | Viewer déjà intégré (`panorama.js`, réutilise Three.js). Déposer les équirectangulaires et les référencer via `PANORAMAS` ou `media.photo360` — cf. le README du dossier |
| Logos officiels des sponsors | `assets/images/sponsors/` | Déposer les fichiers (noms exacts dans le README du dossier) — ils s'affichent automatiquement, repli texte sinon |
| Photos détail par zone | `visite.html` onglet "Photo" | Drop-in : renseigner `media.image` (chemin) sur le hotspot dans `content.js` — l'onglet s'active et affiche la photo. Repli placeholder sinon |
| Plausible Analytics | `<head>` de chaque page | Bloc déjà présent en commentaire : le décommenter et renseigner le domaine. Cf. `README.md` |
| QR code de production | externe | Une fois déployée, générer sur qr-code-generator.com |

## Régénérer les audios après modif de texte

1. Modifier les textes dans `assets/js/content.js`
2. Créer `.env` à partir de `.env.example` et y mettre une nouvelle clé
   ElevenLabs (l'ancienne a été révoquée pour des raisons de sécurité)
3. Lancer :
   ```bash
   rm -f assets/audio/*.mp3
   python3 scripts/generate_audio.py             # audio FR → assets/audio/
   python3 scripts/generate_audio.py --lang en   # audio EN → assets/audio/en/
   ```

L’audio anglais utilise le texte `en.text` de chaque hotspot et la même voix
(Sam Davies étant britannique, l’anglais est natif). Sans clé, l’app EN reste
fonctionnelle en texte seul.

Le script utilise par défaut le voice_id de **Sam Davies** :
`smONmQidMr2FFPVUsEpw`. Pour changer de voix, éditer `VOICE_ID` dans
`scripts/generate_audio.py` ou définir `ELEVENLABS_VOICE_ID` dans `.env`.

## Recalibrer les hotspots si le GLB change

1. Ouvrir `http://localhost:8080/visite.html?edit`
2. Pour chaque hotspot dans la palette :
   - Cliquer le numéro
   - Bouger les sliders X/Y/Z et le slider "distance étiquette"
   - Faire tourner le bateau à l'angle voulu (drag souris)
   - Cliquer "📷 Capturer la vue actuelle"
3. À la fin, cliquer "📋 Copier toutes les positions" — un bloc texte
   propre est dans le presse-papier
4. Coller dans `assets/js/content.js` pour mettre à jour les valeurs

Astuce : `ALT-drag` permet de **déplacer le bateau** dans le viewport
(panoramique caméra) sans tourner la vue. Utile pour recadrer.

## Déploiement

L'app est 100 % statique. Trois options testées :

- **Netlify Drop** (https://app.netlify.com/drop) : drag du dossier
  racine → URL HTTPS instantanée
- **Vercel** : pareil, vercel.com/new
- **Cloudflare Pages** : dashboard CF → Pages → Upload assets

Pour un domaine custom (ex. `visite.initiatives-coeur.fr`) : passer par
l'interface DNS de l'hébergeur, ils guident.

⚠️ **Ne JAMAIS déployer `.env`**. Le `.gitignore` l'exclut.
Avant de drag-drop le dossier sur un hébergeur, vérifiez visuellement
qu'aucun fichier sensible n'y traîne. Une version propre prête à
déployer peut être constituée ainsi :
```bash
mkdir publish
cp -R *.html assets manifest.webmanifest sw.js publish/
zip -qr publish.zip publish
```

## Convention des coordonnées des hotspots

Les positions dans `content.js` sont exprimées en **fractions** de la
bounding box du GLB (0 à 1) :

| Axe | Sens | 0 | 1 |
|---|---|---|---|
| `x` | beam | bâbord | tribord (selon le GLB — voir `__axisMap` console) |
| `y` | vertical | quille basse | sommet du mât/voiles |
| `z` | longueur | poupe | étrave |

`viewDir` utilise les mêmes axes mais en tant que DIRECTION (vecteur unité).
`leadDir` aussi (direction où la bulle flotte depuis l'ancre).

Pour les hotspots qui ont plusieurs ancres (`safrans`), la propriété
s'appelle `anchors: [...]` au lieu de `pos`.

## Sécurité — point d'attention

La clé API ElevenLabs n'est jamais nécessaire à l'exécution de l'app
(les MP3 sont pré-générés). Elle ne sert qu'au moment de la régénération.
Donc :

- **Le `.env` reste sur la machine de dev**, jamais déployé
- Aucun JS de l'app ne fait d'appel API ElevenLabs
- Aucune donnée visiteur n'est envoyée à un serveur (l'analytics est local
  jusqu'à ce que Plausible soit branché côté `<head>`)
- L'app est RGPD-friendly par construction (pas de cookie, pas de tracker
  tiers, pas de fingerprinting)

## Pour reprendre la conversation avec Claude (ou autre LLM)

Le contexte de ce projet est documenté ici. Pour reprendre efficacement :

1. Décrire le projet : "App web pour QR code pontons,
   visite virtuelle de l'IMOCA Initiatives-Cœur de Violette Dorange,
   pour les courses Vendée Arctique 2026 et Route du Rhum 2026"
2. Pointer le dossier `initiatives-coeur-visite-3d/`
3. Mentionner que tout est en HTML/CSS/JS vanilla + Three.js CDN (pas de
   Node, pas de build)
4. Indiquer ce qu'il faut faire (ex. "intégrer la vidéo de Violette
   en remplaçant le placeholder dans visite.js")
