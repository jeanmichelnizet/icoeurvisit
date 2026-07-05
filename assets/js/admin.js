// ============================================================
// admin.js — back-office EN LIGNE. Écrit content.json (+ médias) dans
// GitHub via l'API, ce qui déclenche la publication automatique Netlify.
// ----------------------------------------------------------------
// Connexion : « Se connecter à GitHub » ouvre l'OAuth Netlify (le même
// que celui configuré pour le site) → jeton stocké pour la session.
// Enregistrer : commit de content.json (+ upload des photos) sur la
// branche main → build Netlify → site à jour en ~1 minute.
// La calibration 3D des points (positions, angles) est préservée : ce
// panneau ne touche qu'aux textes, médias, scènes et panoramas.
// ============================================================

(function () {
  // ---- Configuration du dépôt / site ---------------------------------------
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
  // slot key ("h:0:image", "pano:2") -> { path, file } à téléverser
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
    image:    { label: 'Photo',    folder: 'assets/photos' },
    video:    { label: 'Vidéo',    folder: 'assets/videos' },
    photo360: { label: 'Vue 360°', folder: 'assets/panoramas' }
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
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 5000);
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

  // ---- Auth : OAuth GitHub via Netlify (popup) -----------------------------
  function login() {
    const url = 'https://api.netlify.com/auth?provider=github&site_id=' +
      encodeURIComponent(NETLIFY_SITE) + '&scope=repo';
    const popup = window.open(url, 'ic-gh-auth', 'width=620,height=720');
    function onMsg(e) {
      if (typeof e.data !== 'string') return;
      // Poignée de main du protocole netlify-auth
      if (e.data === 'authorizing:github') {
        try { e.source.postMessage(e.data, e.origin); } catch (x) {}
        return;
      }
      const m = e.data.match(/^authorization:github:(success|error):([\s\S]+)$/);
      if (!m) return;
      window.removeEventListener('message', onMsg);
      try { popup && popup.close(); } catch (x) {}
      if (m[1] === 'success') {
        try {
          const d = JSON.parse(m[2]);
          token = d.token;
          try { sessionStorage.setItem(TOKEN_KEY, token); } catch (x) {}
          setStatus('connected');
          toast('Connecté à GitHub ✓', 'ok');
        } catch (x) { toast('Réponse de connexion illisible.', 'err'); }
      } else {
        toast('Connexion refusée : ' + m[2], 'err');
      }
    }
    window.addEventListener('message', onMsg);
  }
  connectBtn.addEventListener('click', login);

  // ---- Aperçu : ouvre la visite avec les modifs EN COURS (non publiées) -----
  const previewBtn = $('#preview-btn');
  if (previewBtn) previewBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('ic:preview', JSON.stringify({
        hotspots: model.hotspots, panoramas: model.panoramas, scenes: model.scenes
      }));
    } catch (e) { toast('Aperçu indisponible (stockage du navigateur).', 'err'); return; }
    window.open('visite.html?preview=1', '_blank');
  });

  // ---- GitHub API ----------------------------------------------------------
  async function gh(path, opts) {
    opts = opts || {};
    const r = await fetch('https://api.github.com/' + path, Object.assign({}, opts, {
      headers: Object.assign({
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github+json'
      }, opts.headers || {})
    }));
    return r;
  }
  async function getSha(path) {
    const r = await gh('repos/' + REPO + '/contents/' + encodeURI(path) + '?ref=' + BRANCH);
    if (r.status === 200) { const j = await r.json(); return j.sha; }
    return null;
  }
  async function putFile(path, base64, message) {
    const sha = await getSha(path);
    const body = { message: message, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    const r = await gh('repos/' + REPO + '/contents/' + encodeURI(path), {
      method: 'PUT', body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('écriture ' + path + ' → HTTP ' + r.status);
    return r.json();
  }
  const b64text = (str) => btoa(unescape(encodeURIComponent(str)));
  const fileToB64 = (file) => new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => res(String(rd.result).split(',')[1]);
    rd.onerror = rej;
    rd.readAsDataURL(file);
  });

  saveBtn.addEventListener('click', async () => {
    if (!token) { toast('Connecte-toi à GitHub d’abord.', 'warn'); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = 'Enregistrement…';
    try {
      // 1. téléverser les médias en attente
      for (const [, item] of pending) {
        const b = await fileToB64(item.file);
        await putFile(item.path, b, 'Média : ' + item.path);
      }
      // 2. committer content.json (source éditable)
      const json = JSON.stringify({
        hotspots: model.hotspots,
        panoramas: model.panoramas,
        scenes: model.scenes
      }, null, 2) + '\n';
      await putFile('content.json', b64text(json), 'Mise à jour du contenu via l’admin');
      pending.clear();
      toast('Enregistré ✓ — publication en cours, en ligne dans ~1 minute.', 'ok');
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/HTTP 40[13]/.test(msg)) {
        toast('Session GitHub expirée — reconnecte-toi puis réessaie.', 'err');
        token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (x) {}
        setStatus('idle');
      } else {
        toast('Erreur : ' + msg, 'err');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = prev;
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
            ' /></label>' +
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
              '<label class="filebtn">Choisir un fichier<input type="file" accept="image/*,video/*" data-panofile="' + i + '" /></label>' +
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
  setStatus(token ? 'connected' : 'idle');
  renderHotspots();
  renderPanoramas();
  renderScenes();
})();
