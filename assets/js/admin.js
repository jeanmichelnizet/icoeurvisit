// ============================================================
// admin.js — back-office EN LIGNE (GitHub Pages). Écrit content.json +
// content.js (+ médias) dans GitHub en UN SEUL commit → publication auto.
// Connexion par jeton GitHub (collé une fois, gardé dans ce navigateur).
// Vignettes : média « en ligne » (liseré vert) + nouveau « à enregistrer » (rouge).
// ============================================================

(function () {
  const REPO = 'jeanmichelnizet/icoeurvisit';
  const BRANCH = 'main';
  const TOKEN_KEY = 'ic:gh-token';

  const clone = (x) => JSON.parse(JSON.stringify(x || null));
  const model = {
    hotspots: clone(window.HOTSPOTS) || [],
    panoramas: clone(window.PANORAMAS) || [],
    scenes: clone(window.SCENES) || [],
    videos360: clone(window.VIDEOS360) || []
  };
  // Instantané de ce qui est EN LIGNE (immuable) — pour les vignettes vertes.
  const published = clone(window.HOTSPOTS) || [];
  const publishedPanos = clone(window.PANORAMAS) || [];
  // Chaque point a media.images (tableau) — compat avec l'ancien media.image unique.
  [model.hotspots, published].forEach((list) => (list || []).forEach((h) => {
    if (!h.media) h.media = { video: null, photo360: null, image: null };
    if (!Array.isArray(h.media.images)) h.media.images = h.media.image ? [h.media.image] : [];
  }));

  let token = null;
  try { token = localStorage.getItem(TOKEN_KEY) || null; } catch (e) {}
  const pending = new Map();   // slot -> { path, file }
  const previewURLs = {};      // slot -> objectURL

  const $ = (s) => document.querySelector(s);
  const connectBtn = $('#connect-btn');
  const saveBtn = $('#save-btn');
  const statusEl = $('#conn-status');
  const hotspotsEl = $('#hotspots');
  const panoramasEl = $('#panoramas');
  const scenesEl = $('#scenes');
  const videos360El = $('#videos360');
  const toastEl = $('#toast');
  const progEl = $('#admin-progress');
  const progFill = progEl ? progEl.querySelector('span') : null;
  const bannerEl = $('#pub-banner');

  const MEDIA = {
    image:    { label: 'Photo',    folder: 'assets/photos',    accept: 'image/*' },
    video:    { label: 'Vidéo',    folder: 'assets/videos',    accept: 'video/*' },
    photo360: { label: 'Vue 360°', folder: 'assets/panoramas', accept: 'image/*,video/*' }
  };

  // Base du site (racine « / » ou sous-dossier « /icoeurvisit/ ») pour résoudre les vignettes.
  const BASE = location.pathname.replace(/[^/]*$/, '');
  const mediaUrl = (v) => (v && !/^(https?:|blob:|\/)/i.test(v)) ? BASE + v : v;

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

  function progOn() { if (progEl) progEl.classList.add('on'); }
  function progSet(pct) { if (progFill) progFill.style.width = Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%'; }
  function progOff() { if (progEl) setTimeout(() => { progEl.classList.remove('on'); progSet(0); }, 500); }

  // Bandeau de publication : orange « en cours » → vert « à jour » → disparaît.
  let bannerTimer = null;
  function showBanner(kind, text) { if (bannerEl) { bannerEl.textContent = text; bannerEl.className = 'show ' + kind; } }
  function hideBanner() { if (bannerEl) bannerEl.className = ''; }
  async function pollLive(target, maxMs) {
    const start = Date.now();
    while (Date.now() - start < (maxMs || 150000)) {
      try {
        const r = await fetch('content.json?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) { const t = await r.text(); if (t.trim() === target.trim()) return true; }
      } catch (e) {}
      await new Promise((res) => setTimeout(res, 4000));
    }
    return false;
  }

  function setPreview(slot, file) { if (previewURLs[slot]) URL.revokeObjectURL(previewURLs[slot]); previewURLs[slot] = URL.createObjectURL(file); }
  function clearPreview(slot) { if (previewURLs[slot]) { URL.revokeObjectURL(previewURLs[slot]); delete previewURLs[slot]; } }
  function clearAllPreviews() { Object.keys(previewURLs).forEach(clearPreview); }

  // Une vignette. variant : 'online' (vert) | 'new' (rouge).
  function thumbBox(rawSrc, file, variant, label, clearAttr) {
    const inner = isImg(rawSrc, file)
      ? '<img src="' + esc(mediaUrl(rawSrc)) + '" alt="" onerror="this.style.display=\'none\'" />'
      : '<span class="filechip">▸</span>';
    return '<div class="thumb ' + variant + '">' + inner +
      '<span class="thumb-name">' + esc(label) + '</span>' +
      '<button class="thumb-x" title="Retirer" ' + clearAttr + '>×</button></div>';
  }

  // ---- Auth : jeton GitHub --------------------------------------------------
  function login() {
    const t = window.prompt(
      'Colle ton jeton d’accès GitHub (commence par ghp_… ou github_pat_…).\n\n' +
      'Il reste enregistré dans CE navigateur uniquement, jamais publié.\n' +
      'Pour en créer un : github.com/settings/tokens → « Generate new token (classic) » → coche « repo ».',
      token || '');
    if (t == null) return;
    const clean = t.trim();
    if (!clean) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} setStatus('idle'); return; }
    token = clean;
    gh('user').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((u) => {
        try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
        setStatus('connected');
        toast('Connecté à GitHub' + (u && u.login ? ' (' + u.login + ')' : '') + ' ✓', 'ok');
      })
      .catch(() => { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} setStatus('idle'); toast('Jeton invalide ou sans accès « repo ». Réessaie.', 'err'); });
  }
  connectBtn.addEventListener('click', login);

  // ---- Aperçu (modifs en cours) --------------------------------------------
  const previewBtn = $('#preview-btn');
  if (previewBtn) previewBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('ic:preview', JSON.stringify({ hotspots: model.hotspots, panoramas: model.panoramas, scenes: model.scenes, videos360: model.videos360 }));
    } catch (e) { toast('Aperçu indisponible (stockage du navigateur).', 'err'); return; }
    window.open('visite.html?preview=1', '_blank');
  });

  // ---- GitHub API : commit atomique ----------------------------------------
  async function gh(path, opts) {
    opts = opts || {};
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
  const fileToB64 = (file) => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = rej; rd.readAsDataURL(file); });

  async function commitAll(files, message, onBlob) {
    const ref = await ghJSON('repos/' + REPO + '/git/ref/heads/' + BRANCH, null, 'branche');
    const baseSha = ref.object.sha;
    const baseCommit = await ghJSON('repos/' + REPO + '/git/commits/' + baseSha, null, 'commit de base');
    const tree = [];
    for (let i = 0; i < files.length; i++) {
      if (onBlob) onBlob(i, files.length);
      const blob = await ghJSON('repos/' + REPO + '/git/blobs', { method: 'POST', body: JSON.stringify({ content: files[i].base64, encoding: 'base64' }) }, 'fichier ' + files[i].path);
      tree.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const newTree = await ghJSON('repos/' + REPO + '/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: tree }) }, 'arbre');
    const commit = await ghJSON('repos/' + REPO + '/git/commits', { method: 'POST', body: JSON.stringify({ message: message, tree: newTree.sha, parents: [baseSha] }) }, 'commit');
    await ghJSON('repos/' + REPO + '/git/refs/heads/' + BRANCH, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) }, 'mise à jour de la branche');
  }

  function buildContentJs() {
    const d = (x) => JSON.stringify(x, null, 2);
    return (
      "// Généré par l'admin — NE PAS ÉDITER À LA MAIN.\n\n" +
      "var _pv = (function () {\n  try {\n    if (typeof location !== 'undefined' && /[?&]preview\\b/.test(location.search)) {\n      return JSON.parse(localStorage.getItem('ic:preview') || 'null');\n    }\n  } catch (e) {}\n  return null;\n})();\n\n" +
      "const HOTSPOTS = (_pv && _pv.hotspots) || " + d(model.hotspots) + ";\n\n" +
      "const PANORAMAS = (_pv && _pv.panoramas) || " + d(model.panoramas) + ";\n\n" +
      "const SCENES = (_pv && _pv.scenes) || " + d(model.scenes) + ";\n\n" +
      "const VIDEOS360 = (_pv && _pv.videos360) || " + d(model.videos360) + ";\n\n" +
      "if (typeof window !== 'undefined') {\n  window.HOTSPOTS = HOTSPOTS;\n  window.PANORAMAS = PANORAMAS;\n  window.SCENES = SCENES;\n  window.VIDEOS360 = VIDEOS360;\n" +
      "  if (_pv) {\n    window.addEventListener('DOMContentLoaded', function () {\n      var b = document.createElement('div');\n      b.textContent = 'Aperçu des modifications — non publié';\n      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#9a6410;color:#fff;font:600 12px/1.2 -apple-system,Arial,sans-serif;text-align:center;padding:9px';\n      document.body.appendChild(b);\n    });\n  }\n}\n" +
      "if (typeof module !== 'undefined') module.exports = { HOTSPOTS, PANORAMAS, SCENES, VIDEOS360 };\n"
    );
  }

  async function save() {
    if (!token) { toast('Connecte-toi à GitHub d’abord.', 'warn'); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    progOn(); progSet(0.06);
    try {
      // media.image (compat) = première photo de la galerie
      model.hotspots.forEach((h) => { if (h.media) h.media.image = (h.media.images && h.media.images[0]) || null; });
      const items = Array.from(pending.values());
      const files = [];
      for (let i = 0; i < items.length; i++) {
        saveBtn.textContent = 'Envoi ' + (i + 1) + '/' + items.length + '…';
        progSet(0.1 + (i / (items.length + 1)) * 0.5);
        files.push({ path: items[i].path, base64: await fileToB64(items[i].file) });
      }
      saveBtn.textContent = 'Publication…';
      const json = JSON.stringify({ hotspots: model.hotspots, panoramas: model.panoramas, scenes: model.scenes, videos360: model.videos360 }, null, 2) + '\n';
      files.push({ path: 'content.json', base64: b64text(json) });
      files.push({ path: 'assets/js/content.js', base64: b64text(buildContentJs()) });
      progSet(0.7);
      let ok = false, tries = 0;
      while (!ok) {
        tries++;
        try { await commitAll(files, 'Mise à jour du contenu via l’admin', (i, n) => progSet(0.7 + (i / n) * 0.28)); ok = true; }
        catch (err) {
          if (/HTTP 4(09|22)/.test(err.message || '') && tries < 5) { saveBtn.textContent = 'Nouvel essai ' + tries + '…'; await new Promise((r) => setTimeout(r, 800 * tries)); }
          else { throw err; }
        }
      }
      progSet(1);
      // Ce qui vient d'être enregistré devient « en ligne ».
      pending.clear(); clearAllPreviews();
      published.length = 0; clone(model.hotspots).forEach((h) => published.push(h));
      publishedPanos.length = 0; clone(model.panoramas).forEach((p) => publishedPanos.push(p));
      toast('Enregistré ✓', 'ok');
      renderAll();
      // Bandeau : publication en cours (orange) → site à jour (vert) → disparaît après 5 s.
      if (bannerTimer) clearTimeout(bannerTimer);
      showBanner('pub', 'Publication en cours…');
      pollLive(json).then((live) => {
        showBanner('ok', live ? 'Site à jour ✓' : 'Publié — visible d’ici ~1 min ✓');
        bannerTimer = setTimeout(hideBanner, 5000);
      });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      if (/HTTP 40[13]/.test(msg)) { token = null; try { localStorage.removeItem(TOKEN_KEY); } catch (x) {} setStatus('idle'); toast('Session GitHub expirée — reconnecte-toi puis réessaie.', 'err'); }
      else toast('Erreur : ' + msg, 'err');
    } finally { saveBtn.disabled = false; saveBtn.textContent = prev; progOff(); }
  }
  saveBtn.addEventListener('click', save);

  // ---- rendering: hotspots -------------------------------------------------
  function mediaRow(hIndex, h, kind) {
    const cfg = MEDIA[kind];
    const slot = hIndex + ':' + kind;
    const onlineVal = (published[hIndex] && published[hIndex].media && published[hIndex].media[kind]) || '';
    const pend = pending.get(slot);
    const curVal = (h.media && h.media[kind]) || '';
    const newUrl = (!pend && curVal && curVal !== onlineVal && isUrl(curVal)) ? curVal : '';
    const removed = !!onlineVal && !curVal && !pend;

    let thumbs = '';
    if (onlineVal && !removed) thumbs += thumbBox(onlineVal, null, 'online', 'En ligne', 'data-clear="online:' + slot + '"');
    else if (removed) thumbs += '<div class="thumb removed"><span class="filechip">✕</span><span class="thumb-name">retiré — sera supprimé</span><button class="link" data-restore="' + slot + '">annuler</button></div>';
    if (pend) thumbs += thumbBox(previewURLs[slot], pend.file, 'new', pend.file.name + ' · à enregistrer', 'data-clear="new:' + slot + '"');
    else if (newUrl) thumbs += thumbBox(newUrl, null, 'new', 'nouveau lien · à enregistrer', 'data-clear="new:' + slot + '"');

    const hasAny = onlineVal || pend || newUrl;
    return (
      '<div class="media-row">' +
        '<div class="media-head"><span class="mlabel">' + cfg.label + '</span>' +
          (hasAny ? '' : '<span class="mcur"><em>aucun</em></span>') + '</div>' +
        thumbs +
        '<div class="media-inputs">' +
          '<label class="filebtn">Choisir un fichier<input type="file" data-file="' + slot + '" accept="' + cfg.accept + '" /></label>' +
          '<span class="or">ou</span>' +
          '<input type="url" class="urlin" placeholder="https://… (lien externe)" data-url="' + slot + '" value="' + (newUrl ? esc(newUrl) : '') + '" />' +
        '</div>' +
      '</div>'
    );
  }

  // Galerie photo (plusieurs images par point) : vignettes vertes (en ligne) + rouges (à enregistrer).
  function imageGallery(hIndex, h) {
    const online = new Set((published[hIndex] && published[hIndex].media && published[hIndex].media.images) || []);
    const imgs = (h.media && h.media.images) || [];
    const thumbs = imgs.map((src, k) => {
      const isNew = !online.has(src);
      const raw = pending.has(src) ? previewURLs[src] : src;
      const file = pending.has(src) ? (pending.get(src) || {}).file : null;
      return thumbBox(raw, file, isNew ? 'new' : 'online', isNew ? 'à enregistrer' : 'En ligne', 'data-imgdel="' + hIndex + '|' + k + '"');
    }).join('');
    return (
      '<div class="media-row">' +
        '<div class="media-head"><span class="mlabel">Photos</span>' +
          (imgs.length ? '' : '<span class="mcur"><em>aucune</em></span>') + '</div>' +
        thumbs +
        '<div class="media-inputs">' +
          '<label class="filebtn">Ajouter une photo<input type="file" data-imgadd="' + hIndex + '" accept="image/*" /></label>' +
          '<span class="or">ou</span>' +
          '<input type="url" class="urlin" placeholder="https://… (lien) — Entrée pour ajouter" data-imgurl="' + hIndex + '" />' +
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
            '<div class="col"><h4>Français</h4>' + tfield(i, 'title', 'fr', 'Titre', h.title) + tfield(i, 'eyebrow', 'fr', 'Sur-titre', h.eyebrow) + tarea(i, 'text', 'fr', 'Description', h.text) + '</div>' +
            '<div class="col"><h4>English</h4>' + tfield(i, 'title', 'en', 'Title', en.title) + tfield(i, 'eyebrow', 'en', 'Eyebrow', en.eyebrow) + tarea(i, 'text', 'en', 'Description', en.text) + '</div>' +
          '</div>' +
          '<h4 class="media-title">Médias</h4>' +
          imageGallery(i, h) + mediaRow(i, h, 'video') + mediaRow(i, h, 'photo360') +
        '</div>' +
      '</details>'
    );
  }
  function tfield(i, field, lang, label, val) { return '<label class="fld"><span>' + label + '</span><input type="text" data-h="' + i + '" data-field="' + field + '" data-lang="' + lang + '" value="' + esc(val) + '" /></label>'; }
  function tarea(i, field, lang, label, val) { return '<label class="fld"><span>' + label + '</span><textarea rows="5" data-h="' + i + '" data-field="' + field + '" data-lang="' + lang + '">' + esc(val) + '</textarea></label>'; }
  function renderHotspots() { hotspotsEl.innerHTML = model.hotspots.map(hotspotCard).join(''); }

  function ensureMedia(hi) {
    const h = model.hotspots[hi];
    if (!h.media) h.media = { video: null, photo360: null, image: null };
    if (!Array.isArray(h.media.images)) h.media.images = [];
    return h.media;
  }
  function onlineMedia(hi, kind) { return (published[hi] && published[hi].media && published[hi].media[kind]) || null; }
  // Nom de fichier UNIQUE pour chaque photo ajoutée (les photos d'iPhone s'appellent
  // souvent toutes « image.jpg » → sans ça, deux photos écrasent la même vignette).
  function uniqueImagePath(hi, file) {
    const id = model.hotspots[hi].id;
    const base = 'assets/photos/' + id + '-' + slug(file.name.replace(/\.[^.]+$/, ''));
    const e = ext(file.name);
    const taken = new Set(model.hotspots[hi].media.images);
    pending.forEach((_v, k) => taken.add(k));
    let p = base + '.' + e, n = 1;
    while (taken.has(p)) { n++; p = base + '-' + n + '.' + e; }
    return p;
  }

  hotspotsEl.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.h != null && el.dataset.field) {
      const h = model.hotspots[+el.dataset.h];
      if (el.dataset.lang === 'en') { (h.en || (h.en = {}))[el.dataset.field] = el.value; }
      else { h[el.dataset.field] = el.value; if (el.dataset.field === 'title') { const sum = el.closest('.card').querySelector('.ctitle'); if (sum) sum.textContent = el.value; } }
    } else if (el.dataset.url != null) {
      const [hi, kind] = el.dataset.url.split(':');
      pending.delete(hi + ':' + kind); clearPreview(hi + ':' + kind);
      ensureMedia(+hi)[kind] = el.value.trim() || onlineMedia(+hi, kind);
      // pas de re-render pendant la frappe (garder le focus)
    }
  });
  hotspotsEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.file) {
      const [hi, kind] = el.dataset.file.split(':');
      const file = el.files && el.files[0];
      if (!file) return;
      const slot = hi + ':' + kind;
      const path = MEDIA[kind].folder + '/' + model.hotspots[+hi].id + '.' + ext(file.name);
      pending.set(slot, { path, file }); setPreview(slot, file);
      ensureMedia(+hi)[kind] = path;
      renderHotspots();
    } else if (el.dataset.imgadd != null) {           // ajouter une photo à la galerie
      const hi = +el.dataset.imgadd; const file = el.files && el.files[0]; if (!file) return;
      ensureMedia(hi);
      const path = uniqueImagePath(hi, file);
      model.hotspots[hi].media.images.push(path);
      pending.set(path, { path, file }); setPreview(path, file);
      el.value = '';                                  // autorise à re-choisir le même fichier ensuite
      renderHotspots();
    } else if (el.dataset.imgurl != null) {           // ajouter une photo par lien
      const hi = +el.dataset.imgurl; ensureMedia(hi); const v = el.value.trim();
      if (v && !model.hotspots[hi].media.images.includes(v)) model.hotspots[hi].media.images.push(v);
      el.value = '';
      renderHotspots();
    } else if (el.dataset.url != null) { renderHotspots(); }
  });
  hotspotsEl.addEventListener('click', (e) => {
    const imgdel = e.target.dataset.imgdel;
    if (imgdel) {
      e.preventDefault();
      const parts = imgdel.split('|'); const hi = +parts[0], k = +parts[1];
      const removed = ensureMedia(hi).images.splice(k, 1)[0];
      if (pending.has(removed)) { pending.delete(removed); clearPreview(removed); }
      renderHotspots(); return;
    }
    const clr = e.target.dataset.clear, restore = e.target.dataset.restore;
    if (clr) {
      e.preventDefault();
      const p = clr.split(':'); const which = p[0], hi = +p[1], kind = p[2]; const slot = p[1] + ':' + p[2];
      pending.delete(slot); clearPreview(slot);
      ensureMedia(hi)[kind] = (which === 'new') ? onlineMedia(hi, kind) : null;
      renderHotspots();
    } else if (restore != null) {
      e.preventDefault();
      const [hi, kind] = restore.split(':');
      ensureMedia(+hi)[kind] = onlineMedia(+hi, kind);
      renderHotspots();
    }
  });

  // ---- rendering: panoramas ------------------------------------------------
  function renderPanoramas() {
    const rows = model.panoramas.map((p, i) => {
      const src = (p && p.src) || (typeof p === 'string' ? p : '') || '';
      const label = (p && p.label) || '';
      const slot = 'pano:' + i;
      const onlineVal = (publishedPanos[i] && publishedPanos[i].src) || '';
      const pend = pending.get(slot);
      const newUrl = (!pend && src && src !== onlineVal && isUrl(src)) ? src : '';
      let thumbs = '';
      if (onlineVal) thumbs += thumbBox(onlineVal, null, 'online', 'En ligne', 'data-panoclear="online:' + i + '"');
      if (pend) thumbs += thumbBox(previewURLs[slot], pend.file, 'new', pend.file.name + ' · à enregistrer', 'data-panoclear="new:' + i + '"');
      else if (newUrl) thumbs += thumbBox(newUrl, null, 'new', 'nouveau lien · à enregistrer', 'data-panoclear="new:' + i + '"');
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom</span><input type="text" data-pano="' + i + '" data-pfield="label" value="' + esc(label) + '" placeholder="ex. Cockpit" /></label>' +
          '<div class="media-row"><div class="media-head"><span class="mlabel">Image / vidéo 360°</span>' +
            (onlineVal || pend || newUrl ? '' : '<span class="mcur"><em>aucun</em></span>') + '</div>' +
            thumbs +
            '<div class="media-inputs">' +
              '<label class="filebtn">Choisir un fichier<input type="file" accept="image/*,video/*" data-panofile="' + i + '" /></label>' +
              '<span class="or">ou</span>' +
              '<input type="url" class="urlin" placeholder="https://…" data-pano="' + i + '" data-pfield="src" value="' + (newUrl ? esc(newUrl) : '') + '" />' +
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
    let p = model.panoramas[i]; if (typeof p !== 'object' || p == null) { p = { src: '', label: '' }; model.panoramas[i] = p; }
    if (el.dataset.pfield === 'src') { pending.delete('pano:' + i); clearPreview('pano:' + i); p.src = el.value.trim() || (publishedPanos[i] && publishedPanos[i].src) || ''; }
    else p[el.dataset.pfield] = el.value.trim();
  });
  panoramasEl.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.panofile != null) {
      const i = +el.dataset.panofile; const file = el.files && el.files[0]; if (!file) return;
      const slot = 'pano:' + i; const path = 'assets/panoramas/' + slug(file.name.replace(/\.[^.]+$/, '')) + '.' + ext(file.name);
      let p = model.panoramas[i]; if (typeof p !== 'object' || p == null) { p = { src: '', label: '' }; model.panoramas[i] = p; }
      p.src = path; pending.set(slot, { path, file }); setPreview(slot, file);
      renderPanoramas();
    } else if (el.dataset.pano != null && el.dataset.pfield === 'src') { renderPanoramas(); }
  });
  panoramasEl.addEventListener('click', (e) => {
    if (e.target.id === 'pano-add') { model.panoramas.push({ src: '', label: '' }); renderPanoramas(); return; }
    const pc = e.target.dataset.panoclear;
    if (pc) {
      e.preventDefault();
      const which = pc.split(':')[0], i = +pc.split(':')[1]; const slot = 'pano:' + i;
      pending.delete(slot); clearPreview(slot);
      if (model.panoramas[i]) model.panoramas[i].src = (which === 'new') ? ((publishedPanos[i] && publishedPanos[i].src) || '') : '';
      renderPanoramas(); return;
    }
    const del = e.target.dataset.panodel;
    if (del != null) { pending.delete('pano:' + del); clearPreview('pano:' + del); model.panoramas.splice(+del, 1); renderPanoramas(); }
  });

  // ---- rendering: scenes 3D (superspl.at) ----------------------------------
  function renderScenes() {
    const rows = model.scenes.map((s, i) => {
      const src = (s && s.src) || (typeof s === 'string' ? s : '') || '';
      const label = (s && s.label) || '';
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom du bouton</span><input type="text" data-scene="' + i + '" data-sfield="label" value="' + esc(label) + '" placeholder="ex. Cellule de vie" /></label>' +
          '<label class="fld"><span>Scène superspl.at (id ou lien)</span><input type="text" data-scene="' + i + '" data-sfield="src" value="' + esc(src) + '" placeholder="a90175ab   ou   https://superspl.at/scene/a90175ab" /></label>' +
          '<button class="link danger" data-scenedel="' + i + '">supprimer</button>' +
        '</div>'
      );
    }).join('');
    scenesEl.innerHTML = rows + '<button class="btn ghost" id="scene-add">+ Ajouter une vue 3D intérieure</button>';
  }
  scenesEl.addEventListener('input', (e) => {
    const el = e.target; if (el.dataset.scene == null) return;
    const i = +el.dataset.scene; let s = model.scenes[i]; if (typeof s !== 'object' || s == null) { s = { src: '', label: '' }; model.scenes[i] = s; }
    s[el.dataset.sfield] = el.value.trim();
  });
  scenesEl.addEventListener('click', (e) => {
    if (e.target.id === 'scene-add') { model.scenes.push({ src: '', label: '' }); renderScenes(); return; }
    const del = e.target.dataset.scenedel;
    if (del != null) { model.scenes.splice(+del, 1); renderScenes(); }
  });

  // ---- rendering: vidéos 360° (fichier équirectangulaire OU lien) ----------
  function renderVideos360() {
    if (!videos360El) return;
    const rows = model.videos360.map((s, i) => {
      const src = (s && s.src) || (typeof s === 'string' ? s : '') || '';
      const label = (s && s.label) || '';
      const slot = 'vid360:' + i;
      const pend = pending.get(slot);
      const isYT = /youtu\.?be|youtube\.com/i.test(src);
      const isFileSrc = src && !/^https?:\/\//i.test(src);   // chemin relatif = fichier auto-hébergé
      let thumb = '';
      if (pend) {
        thumb = '<div class="thumb new"><span class="filechip">▸</span><span class="thumb-name">' + esc(pend.file.name) + ' · à enregistrer</span>' +
          '<button class="thumb-x" title="Retirer" data-vidclear="' + i + '">×</button></div>';
      } else if (src) {
        const note = isYT ? ' · ⚠ YouTube (s’affiche à plat, pas de navigation)' : ' · en ligne ✓';
        thumb = '<div class="thumb online"><span class="filechip">▸</span><span class="thumb-name">' + esc(src.split('/').pop()) + note + '</span></div>';
      }
      return (
        '<div class="pano">' +
          '<label class="fld"><span>Nom du bouton</span><input type="text" data-vid="' + i + '" data-vfield="label" value="' + esc(label) + '" placeholder="ex. Pont avant" /></label>' +
          '<div class="media-row">' +
            '<div class="media-head"><span class="mlabel">Vidéo 360° (fichier .mp4 équirectangulaire, ≤100 Mo)</span>' +
              (src || pend ? '' : '<span class="mcur"><em>aucune</em></span>') + '</div>' +
            thumb +
            '<div class="media-inputs">' +
              '<label class="filebtn">Choisir un fichier vidéo<input type="file" accept="video/*" data-vidfile="' + i + '" /></label>' +
              '<span class="or">ou</span>' +
              '<input type="url" class="urlin" placeholder="https://… (lien direct .mp4)" data-vid="' + i + '" data-vfield="src" value="' + (isFileSrc || isYT ? '' : esc(src)) + '" />' +
            '</div>' +
          '</div>' +
          '<button class="link danger" data-viddel="' + i + '">supprimer</button>' +
        '</div>'
      );
    }).join('');
    videos360El.innerHTML = rows + '<button class="btn ghost" id="vid-add">+ Ajouter une vidéo 360°</button>';
  }
  if (videos360El) {
    videos360El.addEventListener('input', (e) => {
      const el = e.target; if (el.dataset.vid == null) return;
      const i = +el.dataset.vid; let s = model.videos360[i]; if (typeof s !== 'object' || s == null) { s = { src: '', label: '' }; model.videos360[i] = s; }
      if (el.dataset.vfield === 'src') { pending.delete('vid360:' + i); clearPreview('vid360:' + i); s.src = el.value.trim(); }
      else s[el.dataset.vfield] = el.value.trim();
    });
    videos360El.addEventListener('change', (e) => {
      const el = e.target; if (el.dataset.vidfile == null) return;
      const i = +el.dataset.vidfile; const file = el.files && el.files[0]; if (!file) return;
      const slot = 'vid360:' + i;
      const path = 'assets/videos360/' + slug(file.name.replace(/\.[^.]+$/, '')) + '.' + ext(file.name);
      let s = model.videos360[i]; if (typeof s !== 'object' || s == null) { s = { src: '', label: '' }; model.videos360[i] = s; }
      s.src = path; pending.set(slot, { path, file });
      el.value = '';
      renderVideos360();
    });
    videos360El.addEventListener('click', (e) => {
      if (e.target.id === 'vid-add') { model.videos360.push({ src: '', label: '' }); renderVideos360(); return; }
      const del = e.target.dataset.viddel;
      if (del != null) { pending.delete('vid360:' + del); clearPreview('vid360:' + del); model.videos360.splice(+del, 1); renderVideos360(); return; }
      const clr = e.target.dataset.vidclear;
      if (clr != null) { pending.delete('vid360:' + clr); clearPreview('vid360:' + clr); if (model.videos360[+clr]) model.videos360[+clr].src = ''; renderVideos360(); }
    });
  }

  // ---- boot ----------------------------------------------------------------
  function renderAll() { renderHotspots(); renderPanoramas(); renderScenes(); renderVideos360(); }
  setStatus(token ? 'connected' : 'idle');
  renderAll();
})();
