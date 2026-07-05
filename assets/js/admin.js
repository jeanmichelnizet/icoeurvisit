// ============================================================
// admin.js — back-office EN LIGNE. Écrit content.json (+ médias) dans
// GitHub en UN SEUL commit (API Git Data) → publication automatique.
// ============================================================

(function () {
  const REPO = 'jeanmichelnizet/icoeurvisit';
  const BRANCH = 'main';
  const NETLIFY_SITE = 'initiatives-coeur-visite.netlify.app';
  const TOKEN_KEY = 'ic:gh-token';

  const clone = (x) => JSON.parse(JSON.stringify(x || null));
  const model = {
    hotspots: clone(window.HOTSPOTS) || [],
    panoramas: clone(window.PANORAMAS) || [],
    scenes: clone(window.SCENES) || []
  };

  let token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY) || null; } catch (e) {}
  const pending = new Map();       // slot -> { path, file } (médias à téléverser)
  const previewURLs = {};          // slot -> objectURL (vignettes locales)

  const $ = (s) => document.querySelector(s);
  const connectBtn = $('#connect-btn');
  const saveBtn = $('#save-btn');
  const statusEl = $('#conn-status');
  const hotspotsEl = $('#hotspots');
  const panoramasEl = $('#panoramas');
  const scenesEl = $('#scenes');
  const toastEl = $('#toast');
  const progEl = $('#admin-progress');
  const progFill = progEl ? progEl.querySelector('span') : null;

  const MEDIA = {
    image:    { label: 'Photo',    folder: 'assets/photos',    accept: 'image/*' },
    video:    { label: 'Vidéo',    folder: 'assets/videos',    accept: 'video/*' },
    photo360: { label: 'Vue 360°', folder: 'assets/panoramas', accept: 'image/*,video/*' }
  };

  // ---- helpers -------------------------------------------------------------
  const ext = (name) => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : 'bin'; };
  const slug = (s) => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fichier';
  const esc = (s) => (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isUrl = (v) => /^https?:/i.test(v || '');
  const isImg = (v, file) => file ? /^image\//.test(file.type) : /\.(jpe?g|png|webp|gif|svg|avif)(\?|$)/i.test(v || '');

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show ' + (kind || '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 5500);
  }

  function setStatus(state) {
    if (state === 'connected') {
      statusEl.textContent = 'Connecté à GitHub ✓';
      statusEl.className = 'status ok';
      connectBtn.textContent = 'Se reconnecter';
    } else {
      statusEl.textContent = 'Non connecté — clique « Se connecter à GitHub »';
      statusEl.className = 'status';
      connectBtn.textContent = 'Se connecter à GitHub';
    }
  }

  // ---- progression ---------------------------------------------------------
  function progOn() { if (progEl) progEl.classList.add('on'); }
  function progSet(pct) { if (progFill) progFill.style.width = Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%'; }
  function progOff() { if (progEl) setTimeout(() => { progEl.classList.remove('on'); progSet(0); }, 500); }

  // ---- vignettes -----------------------------------------------------------
  function setPreview(slot, file) {
    if (previewURLs[slot]) URL.revokeObjectURL(previewURLs[slot]);
    previewURLs[slot] = URL.createObjectURL(file);
  }
  function clearPreview(slot) {
    if (previewURLs[slot]) { URL.revokeObjectURL(previewURLs[slot]); delete previewURLs[slot]; }
  }
  function clearAllPreviews() { Object.keys(previewURLs).forEach(clearPreview); }

  function mediaThumb(slot, value) {
    const pend = pending.get(slot);
    if (!pend && !value) return '';
    const file = pend && pend.file;
    const src = pend ? previewURLs[slot] : value;
    const name = pend ? pend.file.name : value;
    const inner = isImg(value, file)
      ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />'
      : '<span class="filechip">▸</span>';
    return '<div class="thumb">' + inner +
      '<span class="thumb-name">' + esc(name) + (pend ? ' · à enregistrer' : '') + '</span>' +
      '<button class="thumb-x" title="Retirer" data-clear="' + slot + '">×</button></div>';
  }

  // ---- Auth : OAuth GitHub via Netlify (popup) -----------------------------
  function login() {
    const url = 'https://api.netlify.com/auth?provider=github&site_id=' +
      encodeURIComponent(NETLIFY_SITE) + '&scope=repo';
    const popup = window.open(url, 'ic-gh-auth', 'width=620,height=720');
    function onMsg(e) {
      if (typeof e.data !== 'string') return;
      if (e.data === 'authorizing:github') { try { e.source.postMessage(e.data, e.origin); } catch (x) {} return; }
      const m = e.data.match(/^authorization:github:(success|error):([\s\S]+)$/);
      if (!m) return;
      window.removeEventListener('message', onMsg);
      try { popup && popup.close(); } catch (x) {}
      if (m[1] === 'success') {
        try {
          token = JSON.parse(m[2]).token;
          try { sessionStorage.setItem(TOKEN_KEY, token); } catch (x) {}
          setStatus('connected');
          toast('Connecté à GitHub ✓', 'ok');
        } catch (x) { toast('Réponse de connexion illisible.', 'err'); }
      } else { toast('Connexion refusée : ' + m[2], 'err'); }
    }
    window.addEventListener('message', onMsg);
  }
  connectBtn.addEventListener('click', login);

  // ---- Aperçu (modifs en cours, non publiées) ------------------------------
  const previewBtn = $('#preview-btn');
  if (previewBtn) previewBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('ic:preview', JSON.stringify({
        hotspots: model.hotspots, panoramas: model.panoramas, scenes: model.scenes
      }));
    } catch (e) { toast('Aperçu indisponible (stockage du navigateur).', 'err'); return; }
    window.open('visite.html?preview=1', '_blank');
  });

  // ---- GitHub API : commit atomique (Git Data API) -------------------------
  async function gh(path, opts) {
    opts = opts || {};
    // 'no-store' : GitHub marque certaines réponses GET « cache 60s » ; sans ça,
    // le navigateur relit une position de branche périmée → conflit 422 au commit.
    return fetch('https://api.github.com/' + path, Object.assign({ cache: 'no-store' }, opts, {
      headers: Object.assign({ 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' }, opts.headers || {})
    }));
  }
  async function ghJSON(path, opts, what) {
    const r = await gh(path, opts);
    if (!r.ok) {
      let detail = '';
      try { const j = await r.json(); if (j && j.message) detail = ' (' + j.message + ')'; } catch (e) {}
      throw new Error((what || path) + ' → HTTP ' + r.status + detail);
    }
    return r.json();
  }
  const b64text = (str) => btoa(unescape(encodeURIComponent(str)));
  const fileToB64 = (file) => new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => res(String(rd.result).split(',')[1]);
    rd.onerror = rej;
    rd.readAsDataURL(file);
  });

  // Un SEUL commit contenant content.json + tous les médias → pas de conflit 409.
  async function commitAll(files, message, onBlob) {
    const ref = await ghJSON('repos/' + REPO + '/git/ref/heads/' + BRANCH, null, 'branche');
    const baseSha = ref.object.sha;
    const baseCommit = await ghJSON('repos/' + REPO + '/git/commits/' + baseSha, null, 'commit de base');
    const tree = [];
    for (let i = 0; i < files.length; i++) {
      if (onBlob) onBlob(i, files.length);
      const blob = await ghJSON('repos/' + REPO + '/git/blobs',
        { method: 'POST', body: JSON.stringify({ content: files[i].base64, encoding: 'base64' }) }, 'fichier ' + files[i].path);
      tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await ghJSON('repos/' + REPO + '/git/trees',
      { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: tree }) }, 'arbre');
    const commit = await ghJSON('repos/' + REPO + '/git/commits',
      { method: 'POST', body: JSON.stringify({ message: message, tree: newTree.sha, parents: [baseSha] }) }, 'commit');
    await ghJSON('repos/' + REPO + '/git/refs/heads/' + BRANCH,
      { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) }, 'mise à jour de la branche');
  }

  async function save() {
    if (!token) { toast('Connecte-toi à GitHub d’abord.', 'warn'); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    progOn(); progSet(0.06);
    try {
      const items = Array.from(pending.values());
      const files = [];
      for (let i = 0; i < items.length; i++) {
        saveBtn.textContent = 'Envoi ' + (i + 1) + '/' + items.length + '…';
        progSet(0.1 + (i / (items.length + 1)) * 0.55);
        files.push({ path: items[i].path, base64: await fileToB64(items[i].file) });
      }
      saveBtn.textContent = 'Publication…';
      const json = JSON.stringify({ hotspots: model.hotspots, panoramas: model.panoramas, scenes: model.scenes }, null, 2) + '\n';
      files.push({ path: 'content.json', base64: b64text(json) });
      progSet(0.7);
      // GitHub peut renvoyer une position de branche périmée (réplication) →
      // conflit 409/422. On réessaie en relisant la branche à chaque fois.
      let ok = false, tries = 0;
      while (!ok) {
        tries++;
        try {
          await commitAll(files, 'Mise à jour du contenu via l’admin', (i, n) => progSet(0.7 + (i / n) * 0.28));
          ok = true;
        } catch (err) {
          if (/HTTP 4(09|22)/.test(err.message || '') && tries < 5) {
            saveBtn.textContent = 'Nouvel essai ' + tries + '…';
            await new Promise((r) => setTimeout(r, 800 * tries));
          } else { throw err; }
        }
      }
      progSet(1);
      pending.clear(); clearAllPreviews();
      toast('Enregistré ✓ — en ligne dans ~1 minute.', 'ok');
      renderAll();
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/HTTP 40[13]/.test(msg)) {
        token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (x) {}
        setStatus('idle');
        toast('Session GitHub expirée — reconnecte-toi puis réessaie.', 'err');
      } else { toast('Erreur : ' + msg, 'err'); }
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = prev; progOff();
    }
  }
  saveBtn.addEventListener('click', save);

  // ---- rendering: hotspots -------------------------------------------------
  function mediaRow(hIndex, h, kind) {
    const cfg = MEDIA[kind];
    const slot = hIndex + ':' + kind;
    const cur = (h.media && h.media[kind]) || '';
    return (
      '<div class="media-row">' +
        '<div class="media-head"><span class="mlabel">' + cfg.label + '</span>' +
          (cur || pending.has(slot) ? '' : '<span class="mcur"><em>aucun</em></span>') + '</div>' +
        mediaThumb(slot, cur) +
        '<div class="media-inputs">' +
          '<label class="filebtn">Choisir un fichier' +
            '<input type="file" data-file="' + slot + '" accept="' + cfg.accept + '" /></label>' +
          '<span class="or">ou</span>' +
          '<input type="url" class="urlin" placeholder="https://… (lien externe)" ' +
            'data-url="' + slot + '" value="' + (isUrl(cur) ? esc(cur) : '') + '" />' +
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
          mediaRow(i, h, 'image') + mediaRow(i, h, 'video') + mediaRow(i, h, 'photo360') +
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
  function renderHotspots() { hotspotsEl.innerHTML = model.hotspots.map(hotspotCard).join(''); }

  hotspotsEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.h != null && el.dataset.field) {
      const h = model.hotspots[+el.dataset.h];
      if (el.dataset.lang === 'en') { (h.en || (h.en = {}))[el.dataset.field] = el.value; }
      else {
        h[el.dataset.field] = el.value;
        if (el.dataset.field === 'title') {
          const sum = el.closest('.card').querySelector('.ctitle');
          if (sum) sum.textContent = el.value;
        }
      }
    } else if (el.dataset.url) {
      const [hi, kind] = el.dataset.url.split(':');
      setMedia(+hi, kind, el.value.trim() || null, null);
    }
  });
  hotspotsEl.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset.file) return;
    const [hi, kind] = el.dataset.file.split(':');
    const file = el.files && el.files[0];
    if (!file) return;
    const slot = hi + ':' + kind;
    const path = MEDIA[kind].folder + '/' + model.hotspots[+hi].id + '.' + ext(file.name);
    pending.set(slot, { path, file });
    setPreview(slot, file);
    setMedia(+hi, kind, path, true);
  });
  hotspotsEl.addEventListener('click', (e) => {
    const clr = e.target.dataset.clear;
    if (!clr) return;
    e.preventDefault();
    const [hi, kind] = clr.split(':');
    pending.delete(clr); clearPreview(clr);
    setMedia(+hi, kind, null, null);
  });

  function setMedia(hi, kind, value, keepPending) {
    const h = model.hotspots[hi];
    h.media = h.media || { video: null, photo360: null, image: null };
    h.media[kind] = value;
    const slot = hi + ':' + kind;
    if (!keepPending && value == null) { pending.delete(slot); clearPreview(slot); }
    if (value && isUrl(value)) { pending.delete(slot); clearPreview(slot); }
    renderHotspots();
  }

  // ---- rendering: panoramas ------------------------------------------------
  function renderPanoramas() {
    const rows = model.panoramas.map((p, i) => {
      const src = (p && p.src) || (typeof p === 'string' ? p : '') || '';
      const label = (p && p.label) || '';
      const slot = 'pano:' + i;
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom</span>' +
            '<input type="text" data-pano="' + i + '" data-pfield="label" value="' + esc(label) + '" placeholder="ex. Cockpit" /></label>' +
          '<div class="media-row"><div class="media-head"><span class="mlabel">Image / vidéo 360°</span>' +
            (src || pending.has(slot) ? '' : '<span class="mcur"><em>aucun</em></span>') + '</div>' +
            mediaThumb(slot, src) +
            '<div class="media-inputs">' +
              '<label class="filebtn">Choisir un fichier<input type="file" accept="image/*,video/*" data-panofile="' + i + '" /></label>' +
              '<span class="or">ou</span>' +
              '<input type="url" class="urlin" placeholder="https://…" data-pano="' + i + '" data-pfield="src" value="' + (isUrl(src) ? esc(src) : '') + '" />' +
            '</div>' +
          '</div>' +
          '<button class="link danger" data-panodel="' + i + '">supprimer ce panorama</button>' +
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
    if (typeof p !== 'object' || p == null) { p = { src: '', label: '' }; model.panoramas[i] = p; }
    p[el.dataset.pfield] = el.value.trim();
    if (el.dataset.pfield === 'src' && isUrl(el.value)) { pending.delete('pano:' + i); clearPreview('pano:' + i); }
  });
  panoramasEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.panofile == null) return;
    const i = +el.dataset.panofile;
    const file = el.files && el.files[0];
    if (!file) return;
    const slot = 'pano:' + i;
    const path = 'assets/panoramas/' + slug(file.name.replace(/\.[^.]+$/, '')) + '.' + ext(file.name);
    let p = model.panoramas[i];
    if (typeof p !== 'object' || p == null) { p = { src: '', label: '' }; model.panoramas[i] = p; }
    p.src = path;
    pending.set(slot, { path, file }); setPreview(slot, file);
    renderPanoramas();
  });
  panoramasEl.addEventListener('click', (e) => {
    if (e.target.id === 'pano-add') { model.panoramas.push({ src: '', label: '' }); renderPanoramas(); return; }
    const clr = e.target.dataset.clear;
    if (clr) { // × sur la vignette : vide juste la source
      e.preventDefault();
      const i = +clr.split(':')[1];
      pending.delete(clr); clearPreview(clr);
      if (model.panoramas[i]) model.panoramas[i].src = '';
      renderPanoramas(); return;
    }
    const del = e.target.dataset.panodel;
    if (del != null) { pending.delete('pano:' + del); clearPreview('pano:' + del); model.panoramas.splice(+del, 1); renderPanoramas(); }
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
  function renderAll() { renderHotspots(); renderPanoramas(); renderScenes(); }
  setStatus(token ? 'connected' : 'idle');
  renderAll();
})();
