# Logos officiels des sponsors

Déposez ici les logos. Ils s'affichent **automatiquement** sur `sponsors.html`
dès que le fichier existe (aucune modification de code nécessaire). Tant qu'un
fichier manque, la carte affiche le nom en texte.

## Noms de fichiers attendus

| Sponsor | Fichier (SVG préféré, PNG accepté) |
|---|---|
| Chocolats du Cœur | `chocolats-du-coeur.svg` (ou `.png`) |
| K-Line | `k-line.svg` (ou `.png`) |

Le viewer tente d'abord le `.svg`, puis le `.png`, sinon il retombe sur le texte.

## Conseils

- **Fond transparent** (les cartes sont sur fond sombre). Un logo sur fond blanc
  opaque fera un pavé blanc.
- Hauteur d'affichage plafonnée à ~52 px : fournissez un logo lisible à cette
  taille (SVG idéalement, sinon PNG @2x, largeur ≈ 300–500 px).

## Ajouter un nouveau sponsor

1. Dupliquer une `.sponsor-card` dans `sponsors.html` (bloc `<img>` + `.logo` + `.role`).
2. Adapter `alt`, le nom texte, et les deux `src` (`.svg` puis `.png`) au slug du sponsor.
