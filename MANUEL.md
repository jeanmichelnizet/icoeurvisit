# Manuel d'utilisation — Visite virtuelle Initiatives-Cœur

## 1. Adresses & mots de passe

| | |
|---|---|
| **Site public** | https://jeanmichelnizet.github.io/icoeurvisit/ |
| **Mot de passe visiteur** | `Coeur-XllTfOQ` |
| **Administration (éditeur)** | https://jeanmichelnizet.github.io/icoeurvisit/admin.html |
| **Dépôt du code (GitHub)** | https://github.com/jeanmichelnizet/icoeurvisit |

Le **mot de passe visiteur** protège l'accès au site (à donner aux personnes qui doivent le voir, ex. Ulysse). Il ne rend rien public : le site reste privé et non référencé sur Google.

## 2. Les deux niveaux d'accès

- **Mot de passe visiteur** (`Coeur-XllTfOQ`) : pour *voir* le site et pour *ouvrir* l'admin.
- **Connexion GitHub** (ton compte `jeanmichelnizet`) : nécessaire uniquement pour **enregistrer** des modifications dans l'admin.

## 3. Modifier le contenu — pas à pas

1. Ouvre **https://initiatives-coeur-visite.netlify.app/admin.html**
2. Saisis le **mot de passe visiteur** (`Coeur-XllTfOQ`).
3. Clique **« Se connecter à GitHub »** → autorise (à faire une fois par session).
4. Modifie ce que tu veux (voir §4).
5. Clique **« Enregistrer »**.
6. ✅ Le site se met à jour **tout seul en ~1 minute**. Recharge la page pour vérifier.

> Fonctionne depuis **n'importe quel navigateur** (ordi, mobile). Aucun logiciel à installer.

## 4. Ce que tu peux modifier

### Les 8 points de la visite 3D (les pastilles numérotées)
- **Titre**, **sur-titre**, **description** — en **français** et en **anglais**.
- **Médias** associés à chaque point : une **Photo**, une **Vidéo**, une **Vue 360°**.
- 🔒 La **position 3D** des points (leur emplacement sur le bateau) n'est **pas** modifiable ici : elle est verrouillée et préservée automatiquement, pour ne jamais casser la calibration.

### Vues 3D intérieures (superspl.at)
- Ajouter / retirer des scènes 3D d'intérieur. Chaque scène ajoute un **bouton** dans la visite (à côté de « 3D / 360° / Vidéo »).
- Renseigner l'**id** de la scène (ex. `a90175ab`) **ou** son **lien** complet (`https://superspl.at/scene/…`).

### Panoramas 360° (le bouton « 360° » plein écran)
- Images ou vidéos **équirectangulaires** ouvertes en plein cadre depuis le bouton « 360° » en haut de la visite.

## 5. Types de fichiers & recommandations

| Contenu | Formats | Recommandation |
|---|---|---|
| **Photo** (d'un point) | JPG, PNG, WEBP | Idéal **< 1–2 Mo** (compresse avant). Téléversée directement. |
| **Photo 360°** | JPG équirectangulaire, ratio **2:1** (ex. 5760×2880) | Fichier **ou** lien. |
| **Vidéo** | MP4 | ⚠️ Vidéo **lourde** → mieux vaut l'héberger ailleurs (Vimeo/YouTube **non répertorié**) et coller le **lien**, plutôt que de la téléverser (garde le site rapide). |
| **Vue 3D intérieure** | — | Pas de fichier : un **id / lien superspl.at**. |
| **Logos sponsors** | SVG ou PNG (fond transparent) | Gérés séparément (dossier `assets/images/sponsors/`), pas encore dans l'admin. |

### Fichier téléversé ou lien externe ?
Chaque média propose **« Choisir un fichier »** *ou* un champ **lien** :
- **Petite photo** → téléverse le fichier (le plus simple).
- **Gros média (vidéo)** → héberge-le ailleurs et colle le **lien**.

## 6. Bon à savoir

- Chaque **« Enregistrer »** crée une version dans GitHub : **tout est historisé** et récupérable en cas d'erreur.
- **Version anglaise (EN)** : les textes EN sont là ; l'**audio EN** n'est pas encore généré (voix française uniquement pour l'instant).
- **Ne partage pas** le mot de passe visiteur publiquement tant que le site n'est pas destiné à être ouvert à tous.
- Le **dev local** (sur le Mac) n'a pas de mot de passe : le verrou ne s'active qu'en ligne.

## 7. En cas de souci

| Symptôme | Solution |
|---|---|
| « Session GitHub expirée » à l'enregistrement | Reclique **« Se connecter à GitHub »**, puis réessaie. |
| Une modif n'apparaît pas | Attends **1–2 min** (publication en cours), puis recharge avec **Cmd + Shift + R**. |
| La connexion GitHub échoue | Vérifie que tu es connecté au bon compte GitHub (`jeanmichelnizet`). |
| Besoin de revenir en arrière | Toutes les versions sont dans GitHub (dossier du dépôt) — dis-le-moi, je peux restaurer. |
