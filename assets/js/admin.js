// ============================================================
// admin.js — local back-office (runs in the browser, writes to the
// project folder via the File System Access API). No server needed.
// ----------------------------------------------------------------
// Workflow:
//   1. Serve the project (python3 -m http.server 8080) and open
//      http://localhost:8080/admin.html in Chrome or Edge.
//   2. "Connecter le dossier" → pick the project root, grant write access.
//   3. Edit texts / add photos, videos, 360° (file or URL).
//   4. "Enregistrer" → writes media into assets/ and regenerates
//      assets/js/content.js. Reload the visit to see it, then redeploy.
// Source of truth stays assets/js/content.js (also read by the app and by
// generate_audio.py); this panel only rewrites it — calibration (positions,
// viewDir…) is preserved untouched.
// ============================================================

(function () {
  const clone = (x) => JSON.parse(JSON.stringify(x || null));
  const model = {
    hotspots: clone(window.HOTSPOTS) || [],
    panoramas: clone(window.PANORAMAS) || [],
    scenes: clone(window.SCENES) || []
  };

  const supportsFS = 'showDirectoryPicker' in window;
  let dirHandle = null;
  // slot key ("h:0:image", "pano:2") -> { path, file } queued for writing
  const pending = new Map();

  const $ = (s) => document.querySelector(s);
  const connectBtn = $('#connect-btn');
  const saveBtn = $('#save-btn');
  const statusEl = $('#conn-status');
  const hotspotsEl = $('#hotspots');
  const panoramasEl = $('#panoramas');
  const scenesEl = $('#scenes');
  const toastEl = $('#toast');

  const MEDIA = {
    image:    { label: 'Photo',      folder: 'assets/photos' },
    video:    { label: 'Vidéo',      folder: 'assets/videos' },
    photo360: { label: 'Vue 360°',   folder: 'assets/panoramas' }
  };

  // ---- helpers -------------------------------------------------------------
  const ext = (name) => {
    const m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : 'bin';
  };
  const slug = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fichier';

  const esc = (s) => (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (kind || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 4200);
  }

  function setStatus(state) {
    if (state === 'connected') {
      statusEl.textContent = 'Dossier connecté ✓';
      statusEl.className = 'status ok';
      connectBtn.textContent = 'Changer de dossier';
    } else if (state === 'warn') {
      statusEl.textContent = 'Dossier connecté — mais index.html introuvable : es-tu sûr du bon dossier ?';
      statusEl.className = 'status warn';
    } else {
      statusEl.textContent = supportsFS
        ? 'Non connecté — clique « Connecter le dossier »'
        : 'Navigateur non compatible : ouvre cette page dans Chrome ou Edge (les fichiers médias ne pourront pas être enregistrés ici).';
      statusEl.className = 'status ' + (supportsFS ? '' : 'warn');
    }
  }

  // ---- File System Access --------------------------------------------------
  async function getDir(root, parts) {
    let h = root;
    for (const p of parts) h = await h.getDirectoryHandle(p, { create: true });
    return h;
  }
  async function writeFile(pathStr, data) {
    const parts = pathStr.split('/');
    const name = parts.pop();
    const dir = await getDir(dirHandle, parts);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }

  connectBtn.addEventListener('click', async () => {
    if (!supportsFS) { toast('Ouvre cette page dans Chrome ou Edge pour connecter le dossier.', 'err'); return; }
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { dirHandle = null; toast('Permission refusée.', 'err'); return; }
      let ok = true;
      try { await dirHandle.getFileHandle('index.html'); } catch (e) { ok = false; }
      setStatus(ok ? 'connected' : 'warn');
      toast('Dossier connecté.', 'ok');
    } catch (e) { /* user cancelled the picker */ }
  });

  // ---- content.js serialisation -------------------------------------------
  function serializeContent() {
    const h = JSON.stringify(model.hotspots, null, 2);
    const p = JSON.stringify(model.panoramas, null, 2);
    const s = JSON.stringify(model.scenes, null, 2);
    return (
      '// Généré par admin.html — modifie le contenu via l\'interface d\'administration.\n' +
      '// (Édition manuelle possible, mais l\'admin réécrit ce fichier à chaque enregistrement.)\n\n' +
      'const HOTSPOTS = ' + h + ';\n\n' +
      'const PANORAMAS = ' + p + ';\n\n' +
      'const SCENES = ' + s + ';\n\n' +
      'if (typeof window !== \'undefined\') {\n' +
      '  window.HOTSPOTS = HOTSPOTS;\n' +
      '  window.PANORAMAS = PANORAMAS;\n' +
      '  window.SCENES = SCENES;\n' +
      '}\n' +
      'if (typeof module !== \'undefined\') module.exports = { HOTSPOTS, PANORAMAS, SCENES };\n'
    );
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  saveBtn.addEventListener('click', async () => {
    const content = serializeContent();
    if (dirHandle) {
      saveBtn.disabled = true;
      try {
        for (const [, item] of pending) await writeFile(item.path, item.file);
        await writeFile('assets/js/content.js', content);
        pending.clear();
        toast('Enregistré ✓ — recharge la visite pour vérifier, puis redéploie le dossier.', 'ok');
      } catch (e) {
        toast('Erreur d\'écriture : ' + (e && e.message ? e.message : e), 'err');
      } finally {
        saveBtn.disabled = false;
      }
    } else {
      downloadText('content.js', content);
      toast(pending.size
        ? 'content.js téléchargé. Connecte le dossier pour enregistrer aussi les fichiers médias.'
        : 'content.js téléchargé — place-le dans assets/js/ du projet.', 'warn');
    }
  });

  // ---- rendering: hotspots -------------------------------------------------
  function mediaRow(hIndex, h, kind) {
    const cfg = MEDIA[kind];
    const cur = (h.media && h.media[kind]) || '';
    return (
      '<div class="media-row">' +
        '<div class="media-head"><span class="mlabel">' + cfg.label + '</span>' +
          '<span class="mcur">' + (cur ? esc(cur) : '<em>aucun</em>') + '</span>' +
          (cur ? '<button class="link danger" data-clear="' + hIndex + ':' + kind + '">retirer</button>' : '') +
        '</div>' +
        '<div class="media-inputs">' +
          '<label class="filebtn">Choisir un fichier' +
            '<input type="file" data-file="' + hIndex + ':' + kind + '" ' +
            (kind === 'video' ? 'accept="video/*"' : kind === 'image' ? 'accept="image/*"' : 'accept="image/*,video/*"') +
            (supportsFS ? '' : ' disabled') + ' />' +
          '</label>' +
          '<span class="or">ou</span>' +
          '<input type="url" class="urlin" placeholder="https://… (lien externe)" ' +
            'data-url="' + hIndex + ':' + kind + '" value="' + (/^https?:/i.test(cur) ? esc(cur) : '') + '" />' +
        '</div>' +
      '</div>'
    );
  }

  function hotspotCard(h, i) {
    const en = h.en || (h.en = { title: '', eyebrow: '', text: '' });
    return (
      '<details class="card"' + (i === 0 ? ' open' : '') + '>' +
        '<summary><span class="num">' + String(h.num).padStart(2, '0') + '</span>' +
          '<span class="ctitle">' + esc(h.title) + '</span></summary>' +
        '<div class="card-body">' +
          '<div class="cols">' +
            '<div class="col"><h4>Français</h4>' +
              tfield(i, 'title', 'fr', 'Titre', h.title) +
              tfield(i, 'eyebrow', 'fr', 'Sur-titre', h.eyebrow) +
              tarea(i, 'text', 'fr', 'Description', h.text) +
            '</div>' +
            '<div class="col"><h4>English</h4>' +
              tfield(i, 'title', 'en', 'Title', en.title) +
              tfield(i, 'eyebrow', 'en', 'Eyebrow', en.eyebrow) +
              tarea(i, 'text', 'en', 'Description', en.text) +
            '</div>' +
          '</div>' +
          '<h4 class="media-title">Médias</h4>' +
          mediaRow(i, h, 'image') +
          mediaRow(i, h, 'video') +
          mediaRow(i, h, 'photo360') +
        '</div>' +
      '</details>'
    );
  }

  function tfield(i, field, lang, label, val) {
    return '<label class="fld"><span>' + label + '</span>' +
      '<input type="text" data-h="' + i + '" data-field="' + field + '" data-lang="' + lang + '" value="' + esc(val) + '" /></label>';
  }
  function tarea(i, field, lang, label, val) {
    return '<label class="fld"><span>' + label + '</span>' +
      '<textarea rows="5" data-h="' + i + '" data-field="' + field + '" data-lang="' + lang + '">' + esc(val) + '</textarea></label>';
  }

  function renderHotspots() {
    hotspotsEl.innerHTML = model.hotspots.map(hotspotCard).join('');
  }

  // Text edits (event delegation)
  hotspotsEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.h != null && el.dataset.field) {
      const h = model.hotspots[+el.dataset.h];
      if (el.dataset.lang === 'en') { (h.en || (h.en = {}))[el.dataset.field] = el.value; }
      else {
        h[el.dataset.field] = el.value;
        if (el.dataset.field === 'title') { // keep the card header in sync
          const sum = el.closest('.card').querySelector('.ctitle');
          if (sum) sum.textContent = el.value;
        }
      }
    } else if (el.dataset.url) {
      const [hi, kind] = el.dataset.url.split(':');
      setMedia(+hi, kind, el.value.trim() || null, null);
    }
  });

  // File choose + clear (change/click delegation)
  hotspotsEl.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset.file) return;
    const [hi, kind] = el.dataset.file.split(':');
    const file = el.files && el.files[0];
    if (!file) return;
    const path = MEDIA[kind].folder + '/' + model.hotspots[+hi].id + '.' + ext(file.name);
    pending.set(hi + ':' + kind, { path, file });
    setMedia(+hi, kind, path, true);
  });
  hotspotsEl.addEventListener('click', (e) => {
    const clr = e.target.dataset.clear;
    if (!clr) return;
    e.preventDefault();
    const [hi, kind] = clr.split(':');
    pending.delete(hi + ':' + kind);
    setMedia(+hi, kind, null, null);
  });

  function setMedia(hi, kind, value, keepPending) {
    const h = model.hotspots[hi];
    h.media = h.media || { video: null, photo360: null, image: null };
    h.media[kind] = value;
    if (!keepPending && value == null) pending.delete(hi + ':' + kind);
    // if a URL was typed, drop any queued file for this slot
    if (value && /^https?:/i.test(value)) pending.delete(hi + ':' + kind);
    renderHotspots();
  }

  // ---- rendering: panoramas ------------------------------------------------
  function renderPanoramas() {
    const rows = model.panoramas.map((p, i) => {
      const src = (p && p.src) || (typeof p === 'string' ? p : '') || '';
      const label = (p && p.label) || '';
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom</span>' +
            '<input type="text" data-pano="' + i + '" data-pfield="label" value="' + esc(label) + '" placeholder="ex. Cockpit" /></label>' +
          '<div class="media-row"><div class="media-head"><span class="mlabel">Image / vidéo 360°</span>' +
            '<span class="mcur">' + (src ? esc(src) : '<em>aucun</em>') + '</span></div>' +
            '<div class="media-inputs">' +
              '<label class="filebtn">Choisir un fichier<input type="file" accept="image/*,video/*" data-panofile="' + i + '"' + (supportsFS ? '' : ' disabled') + ' /></label>' +
              '<span class="or">ou</span>' +
              '<input type="url" class="urlin" placeholder="https://…" data-pano="' + i + '" data-pfield="src" value="' + (/^https?:/i.test(src) ? esc(src) : '') + '" />' +
              '<button class="link danger" data-panodel="' + i + '">supprimer</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    panoramasEl.innerHTML = rows + '<button class="btn ghost" id="pano-add">+ Ajouter un panorama</button>';
  }

  panoramasEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.pano == null) return;
    const i = +el.dataset.pano;
    let p = model.panoramas[i];
    if (typeof p === 'string' || p == null) { p = { src: typeof p === 'string' ? p : '', label: '' }; model.panoramas[i] = p; }
    p[el.dataset.pfield] = el.value.trim();
    if (el.dataset.pfield === 'src' && /^https?:/i.test(el.value)) pending.delete('pano:' + i);
  });
  panoramasEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.panofile == null) return;
    const i = +el.dataset.panofile;
    const file = el.files && el.files[0];
    if (!file) return;
    const path = 'assets/panoramas/' + slug(file.name.replace(/\.[^.]+$/, '')) + '.' + ext(file.name);
    let p = model.panoramas[i];
    if (typeof p !== 'object' || p == null) { p = { src: '', label: '' }; model.panoramas[i] = p; }
    p.src = path;
    pending.set('pano:' + i, { path, file });
    renderPanoramas();
  });
  panoramasEl.addEventListener('click', (e) => {
    if (e.target.id === 'pano-add') { model.panoramas.push({ src: '', label: '' }); renderPanoramas(); return; }
    const del = e.target.dataset.panodel;
    if (del != null) { pending.delete('pano:' + del); model.panoramas.splice(+del, 1); renderPanoramas(); }
  });

  // ---- rendering: interior 3D scenes (superspl.at embeds) ------------------
  function renderScenes() {
    const rows = model.scenes.map((s, i) => {
      const src = (s && s.src) || (typeof s === 'string' ? s : '') || '';
      const label = (s && s.label) || '';
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom du bouton</span>' +
            '<input type="text" data-scene="' + i + '" data-sfield="label" value="' + esc(label) + '" placeholder="ex. Cellule de vie" /></label>' +
          '<label class="fld"><span>Scène superspl.at (id ou lien)</span>' +
            '<input type="text" data-scene="' + i + '" data-sfield="src" value="' + esc(src) + '" placeholder="a90175ab   ou   https://superspl.at/scene/a90175ab" /></label>' +
          '<button class="link danger" data-scenedel="' + i + '">supprimer</button>' +
        '</div>'
      );
    }).join('');
    scenesEl.innerHTML = rows + '<button class="btn ghost" id="scene-add">+ Ajouter une vue 3D intérieure</button>';
  }
  scenesEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.scene == null) return;
    const i = +el.dataset.scene;
    let s = model.scenes[i];
    if (typeof s !== 'object' || s == null) { s = { src: '', label: '' }; model.scenes[i] = s; }
    s[el.dataset.sfield] = el.value.trim();
  });
  scenesEl.addEventListener('click', (e) => {
    if (e.target.id === 'scene-add') { model.scenes.push({ src: '', label: '' }); renderScenes(); return; }
    const del = e.target.dataset.scenedel;
    if (del != null) { model.scenes.splice(+del, 1); renderScenes(); }
  });

  // ---- boot ----------------------------------------------------------------
  setStatus('idle');
  renderHotspots();
  renderPanoramas();
  renderScenes();
})();
