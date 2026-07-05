# Panoramas 360°

Images équirectangulaires (ratio **2:1**, JPG ou PNG) prises à l'Insta One X5.
Le viewer 360° réutilise le Three.js déjà embarqué — aucune dépendance à ajouter.

## Deux façons de les afficher

### 1. Bouton « 360° » en haut de la visite (plein cadre)
Déposez vos images ici, puis listez-les dans `assets/js/content.js` :

```js
const PANORAMAS = [
  { src: 'assets/panoramas/cockpit.jpg',  label: 'Cockpit' },
  { src: 'assets/panoramas/pont.jpg',     label: 'Pont' }
];
```

Tant que `PANORAMAS` est vide, le bouton « 360° » garde son message d'attente.
(Actuellement seul le premier panorama de la liste s'ouvre ; une galerie
multi-vues pourra être ajoutée si besoin.)

### 2. Onglet « Vue 360° » d'un hotspot (dans le panneau)
Renseignez le chemin dans le hotspot concerné (`assets/js/content.js`) :

```js
media: { video: null, photo360: 'assets/panoramas/cockpit.jpg', image: null }
```

L'onglet « Vue 360° » s'active automatiquement pour ce hotspot et affiche la vue
immersive ; sinon il reste grisé.

## Conseils de prise de vue
- Export **équirectangulaire** (monoscopique), ratio 2:1 (ex. 5760×2880).
- JPG qualité ~85 % : bon compromis poids/qualité pour le réseau du ponton.
- Éviter les fichiers > 3–4 Mo par vue (chargés à la demande, mais réseau mobile).
