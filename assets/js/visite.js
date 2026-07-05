// ============================================================
// visite.js — 3D boat viewer + leader-line hotspots + panel
// ============================================================

(function () {
  // Fail loudly-but-gracefully: if the 3D engine didn't load (corrupt asset,
  // blocked script, incompatible browser), show a readable message on the
  // loader instead of leaving the visitor on a silent black screen.
  function fatal(msg) {
    console.error('[visite]', msg);
    const el = document.getElementById('loader');
    if (el) {
      el.classList.remove('hidden');
      el.style.display = '';
      const spinner = el.querySelector('.spinner');
      if (spinner) spinner.style.display = 'none';
      const lbl = el.querySelector('.label');
      // Inline IC.t lookup (not the T() helper, which is defined later and
      // would be in its temporal dead zone if the engine fails this early).
      if (lbl) lbl.textContent = (window.IC && window.IC.t && window.IC.t('visite.err.engine')) ||
        'Impossible de charger la visite 3D. Vérifiez votre connexion et rechargez la page.';
    }
  }
  if (!window.THREE) return fatal('Three.js not loaded');
  if (!window.THREE.OrbitControls) return fatal('OrbitControls not loaded');
  if (!window.THREE.GLTFLoader) return fatal('GLTFLoader not loaded');
  const THREE = window.THREE;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ----- DOM refs -----
  const $ = (sel) => document.querySelector(sel);
  const canvasHost = $('#three-canvas');
  const loader = $('#loader');
  const loaderBarFill = $('#loader-bar-fill');
  const leadersSvg = $('#leaders-svg');
  const hotspotsLayer = $('#hotspots-layer');
  const hotspotList = $('#hotspot-list');
  const hint = $('#hint');
  const panel = $('#panel');
  const scrim = $('#scrim');
  const panelClose = $('#panel-close');
  const panelEyebrow = $('#panel-eyebrow');
  const panelTitle = $('#panel-title');
  const panelText = $('#panel-text');
  const audioBtn = $('#audio-btn');
  const audioLabel = $('#audio-label');
  const audioProgress = $('#audio-progress-fill');
  const mediaContent = $('#media-content');
  const panelPrev = $('#panel-prev');
  const panelNext = $('#panel-next');
  const panelNavCount = $('#panel-nav-count');
  const track = (window.IC && window.IC.track) || (() => {});

  // ----- i18n helpers (current language is owned by i18n.js) -----
  const T = (key, fallback) =>
    (window.IC && window.IC.t && window.IC.t(key)) || fallback;
  const curLang = () =>
    (window.IC && window.IC.getLang && window.IC.getLang()) || 'fr';
  const tr = (h, field) => {
    if (curLang() === 'en' && h.en && h.en[field]) return h.en[field];
    return h[field];
  };
  // English audio lives in assets/audio/en/ ; French stays at the root.
  const audioSrc = (h) =>
    curLang() === 'en' ? `assets/audio/en/${h.id}.mp3` : `assets/audio/${h.id}.mp3`;

  // URL params: ?edit, ?flipz, ?flipx
  const params = new URLSearchParams(location.search);
  const EDIT_MODE = params.has('edit');
  let flipZ = params.has('flipz');
  let flipX = params.has('flipx');
  // Respect the OS "reduce motion" setting: no auto-rotation, no camera tweens.
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (EDIT_MODE) document.body.classList.add('edit-mode');

  // ----- Scene -----
  const scene = new THREE.Scene();
  scene.background = null;
  scene.add(new THREE.HemisphereLight(0xb6c7ff, 0x0a0f1a, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff6677, 0.45);
  rim.position.set(-6, 3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xa8c3ff, 0.35);
  fill.position.set(2, -4, 3);
  scene.add(fill);

  // ----- Camera + renderer -----
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(8, 4, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  canvasHost.appendChild(renderer.domElement);

  // ----- Controls -----
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 60;
  controls.minPolarAngle = Math.PI * 0.10;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.enablePan = true;                         // enabled for ALT-drag pan
  controls.screenSpacePanning = true;
  controls.autoRotate = !EDIT_MODE && !reduceMotion;
  controls.autoRotateSpeed = 0.5;
  // Default: left-drag rotates. When ALT is held the same left-drag pans.
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' || e.altKey) {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      renderer.domElement.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' || !e.altKey) {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      renderer.domElement.style.cursor = '';
    }
  });

  let userInteracted = false;
  function stopAutoRotate() {
    if (userInteracted) return;
    userInteracted = true;
    controls.autoRotate = false;
    if (hint) hint.classList.add('hidden');
  }
  renderer.domElement.addEventListener('pointerdown', stopAutoRotate, { once: true });
  renderer.domElement.addEventListener('wheel', stopAutoRotate, { once: true, passive: true });

  // ============================================================
  // Load GLB
  // ============================================================
  const gltfLoader = new THREE.GLTFLoader();
  let boatGroup = null;
  let boatBox = new THREE.Box3();
  let boatSize = new THREE.Vector3();
  let boatCenter = new THREE.Vector3();
  let longestDim = 1;
  let hotspotNodes = [];

  gltfLoader.load(
    'assets/models/imoca.glb',
    (gltf) => {
      boatGroup = gltf.scene;
      boatGroup.traverse((obj) => {
        if (obj.isMesh && obj.material) obj.material.side = THREE.FrontSide;
      });

      // Center & scale: longest dim → 10 units
      boatGroup.updateMatrixWorld(true);
      boatBox.setFromObject(boatGroup);
      boatBox.getSize(boatSize);
      boatBox.getCenter(boatCenter);
      const initialLongest = Math.max(boatSize.x, boatSize.y, boatSize.z);
      const scale = 10 / initialLongest;
      boatGroup.scale.multiplyScalar(scale);
      boatGroup.position.sub(boatCenter.clone().multiplyScalar(scale));

      boatGroup.updateMatrixWorld(true);
      boatBox.setFromObject(boatGroup);
      boatBox.getSize(boatSize);
      boatBox.getCenter(boatCenter);
      longestDim = Math.max(boatSize.x, boatSize.y, boatSize.z);

      // glTF convention: Y is up. Length = longer of X/Z, beam = shorter.
      const lengthAx = boatSize.x >= boatSize.z ? 'x' : 'z';
      const beamAx = lengthAx === 'x' ? 'z' : 'x';
      window.__axisMap = { length: lengthAx, beam: beamAx, height: 'y' };

      console.log('[boat] bbox size:', boatSize, 'center:', boatCenter);
      console.log('[boat] axis map:', window.__axisMap);
      console.log('[boat] longest dim:', longestDim.toFixed(2));

      scene.add(boatGroup);

      buildHotspots();

      // Fit camera — compute the distance to fit both vertical (incl. mast/sails)
      // and horizontal (boat length) extents, with margin for the leader labels.
      // The look-target sits at deck level (≈ 22% from bbox bottom) so the
      // hull is visually dominant rather than the sails.
      const aspect = window.innerWidth / window.innerHeight;
      const fovTanV = Math.tan(camera.fov * Math.PI / 360);
      const fovTanH = fovTanV * aspect;
      const distForHeight = (boatSize.y * 0.55) / fovTanV;
      const lengthAxis = window.__axisMap.length;
      const distForLength = (boatSize[lengthAxis] * 0.55) / fovTanH;
      const distance = Math.max(distForHeight, distForLength) * 1.55;

      const deckY = boatBox.min.y + boatSize.y * 0.22;
      camera.position.set(
        distance * 0.50,
        deckY + boatSize.y * 0.22,
        distance * 0.80
      );
      controls.target.set(boatCenter.x, deckY, boatCenter.z);
      controls.update();

      loader.classList.add('hidden');
      setTimeout(() => loader.style.display = 'none', 700);

      track('boat:loaded', { ms: performance.now() | 0 });
    },
    (xhr) => {
      const pct = xhr.total ? ((xhr.loaded / xhr.total) * 100) | 0 : null;
      if (pct !== null) {
        const lbl = loader.querySelector('.label');
        if (lbl) lbl.textContent = `${T('visite.loading', 'Chargement')} · ${pct}%`;
        if (loaderBarFill) loaderBarFill.style.width = pct + '%';
      } else if (loaderBarFill) {
        // Total unknown (e.g. gzipped without Content-Length): hide the bar,
        // the spinner already conveys indeterminate progress.
        loaderBarFill.parentElement.style.display = 'none';
      }
    },
    (err) => {
      console.error('GLB load error:', err);
      const spinner = loader.querySelector('.spinner');
      if (spinner) spinner.style.display = 'none';
      loader.querySelector('.label').textContent = T('visite.err.model', 'Impossible de charger le modèle du bateau. Vérifiez votre connexion et rechargez la page.');
    }
  );

  // ============================================================
  // Hotspot construction
  // ============================================================

  function fractionalToWorld(pos) {
    const axes = window.__axisMap || { length: 'z', beam: 'x', height: 'y' };
    const out = new THREE.Vector3();
    const fx = flipX ? (1 - pos.x) : pos.x;
    const fz = flipZ ? (1 - pos.z) : pos.z;
    out[axes.beam]   = boatBox.min[axes.beam]   + fx    * boatSize[axes.beam];
    out[axes.height] = boatBox.min[axes.height] + pos.y * boatSize[axes.height];
    out[axes.length] = boatBox.min[axes.length] + fz    * boatSize[axes.length];
    return out;
  }

  // Snap an anchor point to the actual boat surface by raycasting from
  // a far point in the outward direction toward the boat. Ensures the
  // leader line always lands on the hull / rig rather than floating in air.
  // Hotspots can opt out via `snapToSurface: false` (eg. interior).
  const _snapRaycaster = new THREE.Raycaster();
  // overrideSnapDir lets a single anchor override the hotspot-level snapDir
  // (needed for multi-anchor hotspots like the rudders where each side
  // must be snapped from its own direction).
  function snapToBoat(anchorWorld, hotspot, overrideSnapDir) {
    if (!boatGroup) return anchorWorld;
    if (hotspot && hotspot.snapToSurface === false) return anchorWorld;
    let outward;
    const dir = overrideSnapDir || (hotspot && hotspot.snapDir);
    if (dir) {
      outward = fractionalDirToWorld(dir);
    } else {
      outward = new THREE.Vector3().subVectors(anchorWorld, boatCenter);
      if (outward.length() < 0.001) outward.set(0, 1, 0);
      outward.normalize();
    }
    const farStart = anchorWorld.clone().add(outward.clone().multiplyScalar(longestDim * 1.5));
    _snapRaycaster.set(farStart, outward.clone().negate());
    _snapRaycaster.far = longestDim * 3;
    const hits = _snapRaycaster.intersectObject(boatGroup, true);
    if (hits.length > 0) return hits[0].point.clone();
    return anchorWorld;
  }

  // Convert a fractional direction (beam/height/length) into a world-space
  // unit vector, respecting the detected axis map and flip flags.
  function fractionalDirToWorld(dir) {
    const axes = window.__axisMap || { length: 'z', beam: 'x', height: 'y' };
    const out = new THREE.Vector3();
    let fx = dir.x;
    let fz = dir.z;
    if (flipX) fx = -fx;
    if (flipZ) fz = -fz;
    out[axes.beam]   = fx;
    out[axes.height] = dir.y;
    out[axes.length] = fz;
    if (out.length() < 0.001) out.set(0, 1, 0);
    return out.normalize();
  }

  function leaderOffset(anchorWorld, hotspot) {
    // 1. If hotspot defines a leadDir, use it (semantic, predictable).
    // 2. Otherwise push outward from boat center.
    let dir;
    if (hotspot && hotspot.leadDir) {
      dir = fractionalDirToWorld(hotspot.leadDir);
    } else {
      dir = new THREE.Vector3().subVectors(anchorWorld, boatCenter);
      if (dir.length() < 0.001) dir.set(0, 1, 0);
      dir.normalize();
    }
    // Use hull-scale distance (not "longest dim" which is dominated by mast/sails).
    // We pick a distance proportional to the beam, which is the smallest planar dim.
    const axes = window.__axisMap || { length: 'z', beam: 'x', height: 'y' };
    const hullScale = Math.min(boatSize[axes.length], boatSize[axes.beam] * 3);
    // Per-hotspot length multiplier (default 1.0). Tunable via the edit slider.
    const lenFactor = (hotspot && typeof hotspot.leadLen === 'number') ? hotspot.leadLen : 1.0;
    const distance = hullScale * 0.45 * lenFactor;
    return dir.multiplyScalar(distance);
  }

  function getRawAnchors(h) {
    // Returns the list of fractional anchor positions for a hotspot.
    // Supports `anchors` (array, each item may include its own snapDir)
    // or single `pos`.
    return h.anchors && h.anchors.length ? h.anchors : [h.pos];
  }

  function snapAnchor(anchorObj, hotspot) {
    const world = fractionalToWorld({ x: anchorObj.x, y: anchorObj.y, z: anchorObj.z });
    // In edit mode the user controls the anchor by hand — snap would
    // fight with the sliders, so we keep the raw fractional position.
    if (EDIT_MODE) return world;
    return snapToBoat(world, hotspot, anchorObj.snapDir);
  }

  function buildHotspots() {
    leadersSvg.innerHTML = '';
    hotspotsLayer.innerHTML = '';
    hotspotList.innerHTML = '';
    hotspotNodes = [];

    HOTSPOTS.forEach((h) => {
      const rawAnchors = getRawAnchors(h);
      const anchorWorlds = rawAnchors.map(p => snapAnchor(p, h));
      // The label floats from the centroid of the anchors.
      const centroid = new THREE.Vector3();
      anchorWorlds.forEach(a => centroid.add(a));
      centroid.divideScalar(anchorWorlds.length);
      const labelOffset = leaderOffset(centroid, h);
      const labelWorld = centroid.clone().add(labelOffset);

      // SVG lines + anchor dots (one per anchor)
      const lines = [];
      const anchors = [];
      anchorWorlds.forEach(() => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'leader-line');
        leadersSvg.appendChild(line);
        const anch = document.createElementNS(SVG_NS, 'circle');
        anch.setAttribute('class', 'leader-anchor');
        anch.setAttribute('r', '4');
        leadersSvg.appendChild(anch);
        lines.push(line);
        anchors.push(anch);
      });

      // Single DOM bubble per hotspot
      const bubble = document.createElement('button');
      bubble.className = 'hotspot';
      bubble.dataset.id = h.id;
      bubble.setAttribute('aria-label', tr(h, 'title'));
      bubble.innerHTML = `<span class="num">${String(h.num).padStart(2, '0')}</span><span class="lbl">${tr(h, 'title')}</span>`;
      bubble.addEventListener('click', (e) => {
        if (document.body.classList.contains('edit-mode')) {
          e.preventDefault();
          selectForEdit(h);
          return;
        }
        e.stopPropagation();
        openHotspot(h);
      });
      hotspotsLayer.appendChild(bubble);

      // Mobile-friendly chip list
      const chip = document.createElement('button');
      chip.className = 'hotspot-chip';
      chip.dataset.id = h.id;
      chip.innerHTML = `<span class="chip-num">${String(h.num).padStart(2, '0')}</span>${tr(h, 'title')}`;
      chip.addEventListener('click', () => {
        if (document.body.classList.contains('edit-mode')) {
          // In edit mode the side panel would cover the calibration toolbar.
          // Selecting for edit only (no panel) keeps the workflow clean.
          if (typeof window.selectForEdit === 'function') window.selectForEdit(h, 0);
        } else {
          openHotspot(h);
        }
      });
      hotspotList.appendChild(chip);

      hotspotNodes.push({ data: h, anchorWorlds, centroid, labelWorld, lines, anchors, bubble, chip });
    });
  }

  // Recompute world positions for a single hotspot (used in edit mode)
  function recomputeHotspot(node) {
    const rawAnchors = getRawAnchors(node.data);
    node.anchorWorlds = rawAnchors.map(p => snapAnchor(p, node.data));
    const c = new THREE.Vector3();
    node.anchorWorlds.forEach(a => c.add(a));
    c.divideScalar(node.anchorWorlds.length);
    node.centroid = c;
    const off = leaderOffset(c, node.data);
    node.labelWorld = c.clone().add(off);
  }

  // ============================================================
  // Per-frame projection
  // ============================================================
  function projectAll() {
    if (!boatGroup || !hotspotNodes.length) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    leadersSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    leadersSvg.setAttribute('width', w);
    leadersSvg.setAttribute('height', h);

    const camDist = camera.position.distanceTo(boatCenter);

    hotspotNodes.forEach((n) => {
      // Project the bubble (centroid + leader offset)
      const lb = n.labelWorld.clone().project(camera);
      const bx = ( lb.x * 0.5 + 0.5) * w;
      const by = (-lb.y * 0.5 + 0.5) * h;
      const bubbleOff = lb.z > 1 || lb.z < -1 || bx < -120 || by < -120 || bx > w + 120 || by > h + 120;

      n.bubble.style.display = bubbleOff ? 'none' : '';
      if (!bubbleOff) {
        n.bubble.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -50%)`;
      }

      // The bubble's "behind" is determined by its centroid depth
      const centroidDist = camera.position.distanceTo(n.centroid);
      const bubbleBehind = centroidDist > camDist + longestDim * 0.10;
      n.bubble.classList.toggle('behind', bubbleBehind);

      // Project each anchor and update its line + dot
      n.anchorWorlds.forEach((aw, i) => {
        const ap = aw.clone().project(camera);
        const ax = ( ap.x * 0.5 + 0.5) * w;
        const ay = (-ap.y * 0.5 + 0.5) * h;
        const anchorOff = ap.z > 1 || ap.z < -1 || bubbleOff;

        n.lines[i].style.display = anchorOff ? 'none' : '';
        n.anchors[i].style.display = anchorOff ? 'none' : '';
        if (anchorOff) return;

        n.lines[i].setAttribute('x1', ax);
        n.lines[i].setAttribute('y1', ay);
        n.lines[i].setAttribute('x2', bx);
        n.lines[i].setAttribute('y2', by);
        n.anchors[i].setAttribute('cx', ax);
        n.anchors[i].setAttribute('cy', ay);

        const anchorDist = camera.position.distanceTo(aw);
        const behind = anchorDist > camDist + longestDim * 0.10;
        n.lines[i].classList.toggle('behind', behind);
        n.anchors[i].classList.toggle('behind', behind);
      });
    });
  }

  // ============================================================
  // Camera animation — smoothly orbit the boat to the hotspot's
  // best viewing angle when the visitor clicks a bubble.
  // ============================================================
  let camAnim = null;
  function focusHotspot(hotspot) {
    if (!boatGroup) return;
    // Use the actual centroid of all anchors (handles multi-anchor hotspots
    // like the rudders that have one bubble for two anchors).
    const node = hotspotNodes.find(n => n.data.id === hotspot.id);
    const anchor = node ? node.centroid.clone() : snapToBoat(fractionalToWorld(hotspot.pos), hotspot);
    const dirWorld = fractionalDirToWorld(hotspot.leadDir || { x: 0, y: 0.5, z: 1 });

    const axes = window.__axisMap;
    const hullScale = Math.min(boatSize[axes.length], boatSize[axes.beam] * 3);
    const camDist = hullScale * 1.5;

    // Camera direction:
    //   1. If the hotspot defines a viewDir, use it (most reliable — boat
    //      photography angle tuned per part by the comms team).
    //   2. Otherwise fall back to a heuristic perpendicular to leadDir.
    let camDirection;
    if (hotspot.viewDir) {
      camDirection = fractionalDirToWorld(hotspot.viewDir);
    } else {
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dirWorld.dot(up)) > 0.92) {
        camDirection = new THREE.Vector3(1, 0.3, 0.5).normalize();
      } else {
        camDirection = new THREE.Vector3().crossVectors(up, dirWorld).normalize();
        camDirection.y = 0.30;
        camDirection.normalize();
      }
    }

    const camTarget = anchor.clone().add(camDirection.clone().multiplyScalar(camDist));
    camTarget.y = Math.max(camTarget.y, boatBox.min.y + boatSize.y * 0.10);

    controls.autoRotate = false;
    if (hint) hint.classList.add('hidden');
    tweenCamera(camera.position.clone(), camTarget, controls.target.clone(), anchor.clone(), 1100);
  }

  function tweenCamera(fromPos, toPos, fromTgt, toTgt, durationMs) {
    if (camAnim) cancelAnimationFrame(camAnim);
    if (reduceMotion) {
      camera.position.copy(toPos);
      controls.target.copy(toTgt);
      controls.update();
      camAnim = null;
      return;
    }
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const fromPosC = fromPos.clone();
    const fromTgtC = fromTgt.clone();
    function tick() {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const e = easeOut(t);
      camera.position.lerpVectors(fromPosC, toPos, e);
      controls.target.lerpVectors(fromTgtC, toTgt, e);
      controls.update();
      if (t < 1) camAnim = requestAnimationFrame(tick);
      else camAnim = null;
    }
    tick();
  }

  // Cancel any active camera animation if the user grabs the boat
  renderer.domElement.addEventListener('pointerdown', () => {
    if (camAnim) { cancelAnimationFrame(camAnim); camAnim = null; }
  });

  // ============================================================
  // Panel
  // ============================================================
  let currentHotspotId = null;
  let panelOpener = null;   // element to return focus to when the panel closes
  const audio = new Audio();
  audio.preload = 'none';
  let audioStartedAt = 0;
  let audioDurationLogged = false;
  let panelPano = null;
  function destroyPanelPano() { if (panelPano) { panelPano.destroy(); panelPano = null; } }

  function openHotspot(h) {
    const wasOpen = panel.classList.contains('open');
    if (!wasOpen) panelOpener = document.activeElement;
    currentHotspotId = h.id;
    panelEyebrow.textContent = tr(h, 'eyebrow');
    panelTitle.textContent = tr(h, 'title');
    panelText.textContent = tr(h, 'text');

    audio.pause();
    audio.currentTime = 0;
    audioProgress.style.width = '0%';
    audioBtn.dataset.state = 'idle';
    audioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    audio.src = audioSrc(h);
    audioLabel.textContent = T('visite.audio.listen', 'Écouter la description');
    audioDurationLogged = false;

    // Enable only the media tabs that actually have content for this hotspot.
    const media = h.media || {};
    document.querySelectorAll('.media-tab').forEach(tab => {
      const m = tab.dataset.media;
      if (m === 'text') { tab.disabled = false; return; }
      const key = m === '360' ? 'photo360' : m;   // 'video' | 'image' | 'photo360'
      tab.disabled = !media[key];
    });

    setMediaTab('text', h);
    updatePanelNav(h);

    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    scrim.classList.add('visible');
    // On first open, move focus into the dialog (not on hotspot-to-hotspot
    // navigation, so the Next/Prev buttons stay focused for quick browsing).
    if (!wasOpen && panelClose && panelClose.focus) panelClose.focus();
    document.body.classList.add('has-active-hotspot');
    document.querySelectorAll('.hotspot-chip').forEach(c => c.classList.toggle('active', c.dataset.id === h.id));
    hotspotNodes.forEach(n => {
      const isActive = n.data.id === h.id;
      n.bubble.classList.toggle('active', isActive);
      n.lines.forEach(l => l.classList.toggle('active', isActive));
      n.anchors.forEach(a => a.classList.toggle('active', isActive));
    });

    // Orbit the boat to the best perspective for this hotspot
    focusHotspot(h);

    track('hotspot:open', { id: h.id, num: h.num, title: h.title });
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('visible');
    document.body.classList.remove('has-active-hotspot');
    document.querySelectorAll('.hotspot-chip').forEach(c => c.classList.remove('active'));
    hotspotNodes.forEach(n => {
      n.bubble.classList.remove('active');
      n.lines.forEach(l => l.classList.remove('active'));
      n.anchors.forEach(a => a.classList.remove('active'));
    });
    audio.pause();
    destroyPanelPano();
    if (currentHotspotId) track('hotspot:close', { id: currentHotspotId });
    currentHotspotId = null;
    // Return focus to whatever opened the panel (keyboard/screen-reader users).
    if (panelOpener && panelOpener.focus) { try { panelOpener.focus(); } catch (e) { /* gone */ } }
    panelOpener = null;
  }

  panelClose.addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  // Keep Tab focus within the open panel (focus trap for the dialog).
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !panel.classList.contains('open')) return;
    const focusables = panel.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const list = Array.prototype.filter.call(focusables, el => el.offsetParent !== null);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ----- Guided-tour navigation (previous / next through the 8 hotspots) -----
  function hotspotIndex(id) { return HOTSPOTS.findIndex(h => h.id === id); }
  function updatePanelNav(h) {
    const idx = hotspotIndex(h.id);
    if (panelNavCount) panelNavCount.textContent = `${idx + 1} / ${HOTSPOTS.length}`;
    if (panelPrev) panelPrev.disabled = idx <= 0;
    if (panelNext) panelNext.disabled = idx >= HOTSPOTS.length - 1;
  }
  function gotoOffset(delta) {
    const idx = hotspotIndex(currentHotspotId);
    if (idx < 0) return;
    const next = HOTSPOTS[idx + delta];
    if (next) openHotspot(next);
  }
  if (panelPrev) panelPrev.addEventListener('click', () => gotoOffset(-1));
  if (panelNext) panelNext.addEventListener('click', () => gotoOffset(1));
  document.addEventListener('keydown', (e) => {
    if (!currentHotspotId) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); gotoOffset(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); gotoOffset(-1); }
  });

  // Audio
  audioBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        audioBtn.dataset.state = 'playing';
        audioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
        audioLabel.textContent = T('visite.audio.playing', 'Lecture en cours…');
        audioStartedAt = Date.now();
        track('audio:play', { id: currentHotspotId });
      }).catch(() => {
        audioLabel.textContent = T('visite.audio.generating', 'Audio en cours de génération…');
      });
    } else {
      audio.pause();
      audioBtn.dataset.state = 'paused';
      audioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
      audioLabel.textContent = T('visite.audio.paused', 'En pause');
      track('audio:pause', { id: currentHotspotId, ms: Date.now() - audioStartedAt });
    }
  });
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) audioProgress.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('ended', () => {
    audioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    audioLabel.textContent = T('visite.audio.done', 'Description terminée');
    audioProgress.style.width = '0%';
    if (!audioDurationLogged) {
      audioDurationLogged = true;
      track('audio:complete', { id: currentHotspotId, s: audio.duration | 0 });
    }
  });
  audio.addEventListener('error', () => {
    audioLabel.textContent = T('visite.audio.error', 'Audio à régénérer · scripts/generate_audio.py');
  });

  // Media tabs
  document.querySelectorAll('.media-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.disabled) return;
      const hs = HOTSPOTS.find(h => h.id === currentHotspotId);
      if (!hs) return;
      setMediaTab(tab.dataset.media, hs);
    });
  });

  function panoPlaceholder360() {
    return `<div class="media-placeholder">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/></svg></div>
        <div class="label">${T('visite.ph.360.label', 'Photo 360° · à tourner')}</div>
        <div class="note">${T('visite.ph.360.note', 'Les prises 360° de l’Insta X5 seront affichées en navigation immersive.')}</div></div>`;
  }
  function videoPlaceholder() {
    return `<div class="media-placeholder">
        <div class="icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
        <div class="label">${T('visite.ph.video.label', 'Vidéo Violette · à intégrer')}</div>
        <div class="note">${T('visite.ph.video.note', 'Le montage de la visite par Violette Dorange sera glissé ici.')}</div></div>`;
  }
  function imagePlaceholder() {
    return `<div class="media-placeholder">
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/></svg></div>
        <div class="label">${T('visite.ph.image.label', 'Photo détail · à fournir')}</div>
        <div class="note">${T('visite.ph.image.note', 'Une photo HD de la zone du bateau viendra illustrer le descriptif.')}</div></div>`;
  }

  // Galerie photo : une ou plusieurs images, avec flèches ‹ › si plusieurs.
  function renderGallery(imgs, alt) {
    let i = 0;
    function draw() {
      mediaContent.innerHTML = '<div class="media-photo gallery">' +
        '<img src="' + imgs[i] + '" alt="' + esc(alt || '') + '" />' +
        (imgs.length > 1
          ? '<button class="gal-prev" type="button" aria-label="Photo précédente">‹</button>' +
            '<button class="gal-next" type="button" aria-label="Photo suivante">›</button>' +
            '<span class="gal-count">' + (i + 1) + ' / ' + imgs.length + '</span>'
          : '') +
        '</div>';
      if (imgs.length > 1) {
        mediaContent.querySelector('.gal-prev').addEventListener('click', () => { i = (i - 1 + imgs.length) % imgs.length; draw(); });
        mediaContent.querySelector('.gal-next').addEventListener('click', () => { i = (i + 1) % imgs.length; draw(); });
      }
    }
    draw();
  }

  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function setMediaTab(media, hs) {
    document.querySelectorAll('.media-tab').forEach(t => {
      const on = t.dataset.media === media;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    destroyPanelPano();
    track('media:view', { id: hs.id, media });
    if (media === 'text') {
      mediaContent.innerHTML = '';
      panelText.style.display = 'block';
      return;
    }
    panelText.style.display = 'none';
    if (media === 'video') {
      const url = hs.media && hs.media.video;
      mediaContent.innerHTML = url
        ? `<div class="media-video"><video controls playsinline preload="metadata" src="${url}"></video></div>`
        : videoPlaceholder();
    } else if (media === '360') {
      const url = hs.media && hs.media.photo360;
      if (url && window.ICPanorama) {
        mediaContent.innerHTML = '<div class="pano-embed" id="pano-embed"></div>';
        panelPano = window.ICPanorama.create(document.getElementById('pano-embed'), url, {
          onError: () => { destroyPanelPano(); mediaContent.innerHTML = panoPlaceholder360(); }
        });
      } else {
        mediaContent.innerHTML = panoPlaceholder360();
      }
    } else if (media === 'image') {
      const imgs = (hs.media && hs.media.images && hs.media.images.length)
        ? hs.media.images
        : ((hs.media && hs.media.image) ? [hs.media.image] : []);
      if (imgs.length) renderGallery(imgs, tr(hs, 'title'));
      else mediaContent.innerHTML = imagePlaceholder();
    }
  }

  // ============================================================
  // Mode switcher — 3D · 360° · Vidéo · vues intérieures (embeds)
  // ============================================================
  const modeSwitch = document.querySelector('.mode-switch');

  // Build an embed URL from a superspl.at id / scene URL / any embed URL.
  function splatEmbedUrl(v) {
    if (!v) return null;
    v = String(v).trim();
    const m = v.match(/superspl\.at\/(?:s\?id=|scene\/)([a-z0-9]+)/i);
    if (m) return 'https://superspl.at/s?id=' + m[1];
    if (/^https?:\/\//i.test(v)) return v;                        // any full embed URL
    if (/^[a-z0-9]{4,}$/i.test(v)) return 'https://superspl.at/s?id=' + v;  // bare id
    return null;
  }

  let stagePano = null;
  function closeStagePano() {
    if (stagePano) { stagePano.destroy(); stagePano = null; }
    const host = document.getElementById('pano-stage');
    if (host) host.style.display = 'none';
  }
  function openStagePano(url) {
    const stage = document.querySelector('.visite-stage');
    if (!stage || !window.ICPanorama) return false;
    let host = document.getElementById('pano-stage');
    if (!host) {
      host = document.createElement('div');
      host.id = 'pano-stage';
      host.className = 'pano-stage';
      stage.appendChild(host);
    }
    host.style.display = 'block';
    if (stagePano) stagePano.destroy();
    stagePano = window.ICPanorama.create(host, url, { onError: closeStagePano });
    return true;
  }

  // Interior 3D scenes (Gaussian splats) shown as a full-stage iframe embed.
  function closeScene() {
    const host = document.getElementById('scene-stage');
    if (host) {
      host.style.display = 'none';
      const f = host.querySelector('.scene-frame');
      if (f) f.innerHTML = '';   // unload the iframe
    }
  }
  function openScene(url) {
    const stage = document.querySelector('.visite-stage');
    if (!stage || !url) return false;
    let host = document.getElementById('scene-stage');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scene-stage';
      host.className = 'scene-stage';
      host.innerHTML = '<div class="scene-frame"></div>';
      stage.appendChild(host);
    }
    host.querySelector('.scene-frame').innerHTML =
      '<iframe class="scene-iframe" src="' + url + '" allow="fullscreen; xr-spatial-tracking" ' +
      'allowfullscreen loading="lazy" title="Vue 3D intérieure"></iframe>';
    host.style.display = 'block';
    return true;
  }

  function setActiveBtn(btn) {
    if (!modeSwitch) return;
    modeSwitch.querySelectorAll('button').forEach(x => {
      const on = x === btn;
      x.classList.toggle('active', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }
  function goto3d() {
    closeStagePano();
    closeScene();
    setActiveBtn(modeSwitch && modeSwitch.querySelector('[data-mode="3d"]'));
  }

  // Add one mode button per interior scene declared in content.js (SCENES).
  (window.SCENES || []).forEach((s) => {
    const url = splatEmbedUrl(s && (s.src || s));
    if (!url || !modeSwitch) return;
    const btn = document.createElement('button');
    btn.dataset.mode = 'scene';
    btn.dataset.sceneUrl = url;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.textContent = (s && s.label) || 'Vue 3D';
    modeSwitch.appendChild(btn);
  });

  if (modeSwitch) modeSwitch.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const mode = b.dataset.mode;
    track('mode:switch', { mode });
    // Changer de vue (intérieure / 360° / vidéo…) referme le panneau d'un point ouvert.
    closePanel();
    if (mode === '3d') { goto3d(); return; }
    if (mode === 'scene') {
      closeStagePano();
      if (openScene(b.dataset.sceneUrl)) setActiveBtn(b); else goto3d();
      return;
    }
    if (mode === '360') {
      closeScene();
      const first = (window.PANORAMAS && window.PANORAMAS[0]) || null;
      const url = first && (first.src || first);   // accepts ['url'] or [{ src }]
      if (url && openStagePano(url)) { setActiveBtn(b); return; }
      alert(T('visite.alert.360', 'La galerie 360° (Insta X5) sera disponible dès que les prises auront été tournées.'));
      goto3d();
      return;
    }
    // video — placeholder until the edit is provided
    closeScene();
    alert(T('visite.alert.video', 'La vidéo de visite par Violette sera intégrée dès qu’elle sera fournie.'));
    goto3d();
  });

  // ============================================================
  // Language switch — re-render labels + open panel without reload
  // ============================================================
  window.addEventListener('ic:langchange', () => {
    // Bubble + chip labels
    hotspotNodes.forEach(n => {
      const lbl = n.bubble.querySelector('.lbl');
      if (lbl) lbl.textContent = tr(n.data, 'title');
      n.bubble.setAttribute('aria-label', tr(n.data, 'title'));
      n.chip.innerHTML = `<span class="chip-num">${String(n.data.num).padStart(2, '0')}</span>${tr(n.data, 'title')}`;
      n.chip.classList.toggle('active', n.data.id === currentHotspotId);
    });
    // Re-render the open panel in the new language and swap the audio track
    if (currentHotspotId) {
      const h = HOTSPOTS.find(x => x.id === currentHotspotId);
      if (h) {
        panelEyebrow.textContent = tr(h, 'eyebrow');
        panelTitle.textContent = tr(h, 'title');
        panelText.textContent = tr(h, 'text');
        audio.pause();
        audio.currentTime = 0;
        audio.src = audioSrc(h);
        audioProgress.style.width = '0%';
        audioBtn.dataset.state = 'idle';
        audioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        audioLabel.textContent = T('visite.audio.listen', 'Écouter la description');
      }
    }
  });

  // ============================================================
  // EDIT MODE (?edit) — palette + sliders + drag + export
  // ============================================================
  if (EDIT_MODE) {
    const xRange = $('#edit-x');
    const yRange = $('#edit-y');
    const zRange = $('#edit-z');
    const xVal = $('#edit-x-val');
    const yVal = $('#edit-y-val');
    const zVal = $('#edit-z-val');
    const leadLenRange = $('#edit-lead-len');
    const leadLenVal = $('#edit-lead-len-val');
    const selInfo = $('#edit-selected');
    const palette = $('#edit-palette');
    const flipZBtn = $('#edit-flip-z');
    const flipXBtn = $('#edit-flip-x');
    const captureBtn = $('#edit-capture-view');
    const exportBtn = $('#edit-export');
    const quitBtn = $('#edit-quit');
    let selected = null;   // { hotspot, anchorIndex }

    // Returns a ref to the editable anchor object (pos or anchors[i])
    function anchorRef(hotspot, anchorIndex) {
      if (hotspot.anchors && hotspot.anchors.length) return hotspot.anchors[anchorIndex];
      return hotspot.pos;
    }
    function anchorCount(hotspot) {
      return (hotspot.anchors && hotspot.anchors.length) ? hotspot.anchors.length : 1;
    }

    // Build palette: one button per anchor (handles multi-anchor like safrans → 8a / 8b)
    function buildPalette() {
      palette.innerHTML = '';
      HOTSPOTS.forEach(h => {
        const n = anchorCount(h);
        for (let i = 0; i < n; i++) {
          const suffix = n > 1 ? String.fromCharCode(97 + i) : '';   // 'a','b'
          const btn = document.createElement('button');
          btn.className = 'palette-btn';
          btn.textContent = h.num + suffix;
          btn.title = h.title + (suffix ? ` (ancre ${suffix})` : '');
          btn.dataset.hotspotId = h.id;
          btn.dataset.anchorIndex = i;
          btn.addEventListener('click', () => selectForEdit(h, i));
          palette.appendChild(btn);
        }
      });
    }

    function refreshPaletteSelection() {
      palette.querySelectorAll('.palette-btn').forEach(b => {
        const isSel = selected
          && b.dataset.hotspotId === selected.hotspot.id
          && parseInt(b.dataset.anchorIndex, 10) === selected.anchorIndex;
        b.classList.toggle('selected', isSel);
      });
    }

    function updateSliderValues(a) {
      xRange.value = a.x; yRange.value = a.y; zRange.value = a.z;
      xVal.textContent = a.x.toFixed(3);
      yVal.textContent = a.y.toFixed(3);
      zVal.textContent = a.z.toFixed(3);
    }

    function selectForEdit(hotspot, anchorIndex) {
      anchorIndex = anchorIndex || 0;
      selected = { hotspot, anchorIndex };
      const a = anchorRef(hotspot, anchorIndex);
      const suffix = anchorCount(hotspot) > 1 ? String.fromCharCode(97 + anchorIndex) : '';
      const hasView = hotspot.viewDir ? ' · vue ✓' : '';
      selInfo.textContent = `#${hotspot.num}${suffix} · ${hotspot.title}${hasView}`;
      [xRange, yRange, zRange, leadLenRange].forEach(r => r.disabled = false);
      captureBtn.disabled = false;
      updateSliderValues(a);
      // Initialise the leader-length slider with the hotspot's current value
      const currentLen = (typeof hotspot.leadLen === 'number') ? hotspot.leadLen : 1.0;
      leadLenRange.value = currentLen;
      leadLenVal.textContent = currentLen.toFixed(2);
      refreshPaletteSelection();
      // Highlight selected bubble
      hotspotNodes.forEach(n => n.bubble.style.outline = (n.data.id === hotspot.id) ? '2px solid #ff2c3a' : '');
      // NOTE: no camera animation in edit mode — keep the boat at its
      // current orientation so you can see the slider effect in place.
      // Rotate manually with mouse drag when you need a different angle.
    }

    // Capture the current camera direction (relative to the selected
    // hotspot's centroid) and store it as that hotspot's viewDir.
    function captureViewAngle() {
      if (!selected) return;
      const node = hotspotNodes.find(n => n.data.id === selected.hotspot.id);
      if (!node) return;
      const worldDir = new THREE.Vector3()
        .subVectors(camera.position, node.centroid)
        .normalize();
      // World direction → fractional (inverse of fractionalDirToWorld)
      const axes = window.__axisMap;
      let fx = worldDir[axes.beam];
      const fy = worldDir[axes.height];
      let fz = worldDir[axes.length];
      if (flipX) fx = -fx;
      if (flipZ) fz = -fz;
      const round = (v) => Math.round(v * 1000) / 1000;
      selected.hotspot.viewDir = { x: round(fx), y: round(fy), z: round(fz) };
      const v = selected.hotspot.viewDir;
      const label = `✓ vue capturée · (${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`;
      captureBtn.textContent = label;
      const suffix = anchorCount(selected.hotspot) > 1
        ? String.fromCharCode(97 + selected.anchorIndex) : '';
      selInfo.textContent = `#${selected.hotspot.num}${suffix} · ${selected.hotspot.title} · vue ✓`;
      setTimeout(() => { captureBtn.textContent = '📷 Capturer la vue actuelle'; }, 2400);
    }
    captureBtn.addEventListener('click', captureViewAngle);
    window.selectForEdit = selectForEdit;

    function applyChange() {
      if (!selected) return;
      const a = anchorRef(selected.hotspot, selected.anchorIndex);
      a.x = parseFloat(xRange.value);
      a.y = parseFloat(yRange.value);
      a.z = parseFloat(zRange.value);
      xVal.textContent = a.x.toFixed(3);
      yVal.textContent = a.y.toFixed(3);
      zVal.textContent = a.z.toFixed(3);
      const node = hotspotNodes.find(n => n.data.id === selected.hotspot.id);
      if (node) recomputeHotspot(node);
    }
    [xRange, yRange, zRange].forEach(r => r.addEventListener('input', applyChange));

    // Leader-length slider — affects only the selected hotspot
    leadLenRange.addEventListener('input', () => {
      if (!selected) return;
      const v = parseFloat(leadLenRange.value);
      selected.hotspot.leadLen = v;
      leadLenVal.textContent = v.toFixed(2);
      const node = hotspotNodes.find(n => n.data.id === selected.hotspot.id);
      if (node) recomputeHotspot(node);
    });

    flipZBtn.addEventListener('click', () => {
      flipZ = !flipZ;
      hotspotNodes.forEach(n => recomputeHotspot(n));
      flipZBtn.style.background = flipZ ? '#E30613' : 'transparent';
      flipZBtn.style.color = flipZ ? '#fff' : 'var(--ivory)';
    });
    flipXBtn.addEventListener('click', () => {
      flipX = !flipX;
      hotspotNodes.forEach(n => recomputeHotspot(n));
      flipXBtn.style.background = flipX ? '#E30613' : 'transparent';
      flipXBtn.style.color = flipX ? '#fff' : 'var(--ivory)';
    });

    // Format all current positions + view angles as a copy-pastable block
    function formatPositions() {
      const f = (v) => v.toFixed(3);
      const lines = HOTSPOTS.map(h => {
        let body;
        if (h.anchors && h.anchors.length) {
          const list = h.anchors.map((a, i) => {
            const letter = String.fromCharCode(97 + i);
            return `  ${h.id}/${letter}: { x: ${f(a.x)}, y: ${f(a.y)}, z: ${f(a.z)} }`;
          }).join('\n');
          body = list;
        } else {
          body = `  ${h.id}: { x: ${f(h.pos.x)}, y: ${f(h.pos.y)}, z: ${f(h.pos.z)} }`;
        }
        let extras = '';
        if (h.viewDir) {
          extras += `\n  ${h.id}.viewDir: { x: ${f(h.viewDir.x)}, y: ${f(h.viewDir.y)}, z: ${f(h.viewDir.z)} }`;
        }
        if (typeof h.leadLen === 'number' && Math.abs(h.leadLen - 1.0) > 0.001) {
          extras += `\n  ${h.id}.leadLen: ${f(h.leadLen)}`;
        }
        return `// #${h.num} ${h.title}\n${body}${extras}`;
      }).join('\n\n');
      return `// Positions + angles de vue calibrés (flipX=${flipX}, flipZ=${flipZ})\n\n${lines}\n`;
    }

    exportBtn.addEventListener('click', () => {
      const blob = formatPositions();
      navigator.clipboard.writeText(blob).then(() => {
        exportBtn.textContent = '✓ copié — collez-moi ça';
        setTimeout(() => exportBtn.textContent = '📋 Copier toutes les positions', 2200);
      }).catch(() => {
        // Fallback: open in a new window so the user can copy manually
        const w = window.open('', '_blank');
        w.document.write('<pre style="white-space:pre-wrap;font:13px ui-monospace,monospace;padding:20px">' + blob.replace(/</g, '&lt;') + '</pre>');
      });
    });

    quitBtn.addEventListener('click', () => { location.search = ''; });

    // Pointer-drag on a bubble — selects primary anchor and lets you drag
    let dragData = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function pickWorldOnPlane(clientX, clientY, planeNormal, planePoint) {
      pointer.x = (clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);
      const hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hit);
      return hit;
    }

    function worldToFractional(world) {
      const axes = window.__axisMap;
      const fx = (world[axes.beam]   - boatBox.min[axes.beam])   / boatSize[axes.beam];
      const fy = (world[axes.height] - boatBox.min[axes.height]) / boatSize[axes.height];
      const fz = (world[axes.length] - boatBox.min[axes.length]) / boatSize[axes.length];
      return {
        x: flipX ? 1 - fx : fx,
        y: fy,
        z: flipZ ? 1 - fz : fz
      };
    }

    hotspotsLayer.addEventListener('pointerdown', (e) => {
      const bubble = e.target.closest('.hotspot');
      if (!bubble) return;
      const node = hotspotNodes.find(n => n.bubble === bubble);
      if (!node) return;
      e.preventDefault();
      e.stopPropagation();
      const anchorIndex = selected && selected.hotspot.id === node.data.id ? selected.anchorIndex : 0;
      selectForEdit(node.data, anchorIndex);
      bubble.classList.add('dragging');
      controls.enabled = false;
      const targetAnchor = node.anchorWorlds[anchorIndex] || node.centroid;
      const planeNormal = new THREE.Vector3().subVectors(camera.position, targetAnchor).normalize();
      dragData = { node, anchorIndex, planeNormal, planePoint: targetAnchor.clone() };
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragData) return;
      const world = pickWorldOnPlane(e.clientX, e.clientY, dragData.planeNormal, dragData.planePoint);
      if (!world) return;
      const frac = worldToFractional(world);
      frac.x = Math.max(0, Math.min(1, frac.x));
      frac.y = Math.max(0, Math.min(1, frac.y));
      frac.z = Math.max(0, Math.min(1, frac.z));
      const a = anchorRef(dragData.node.data, dragData.anchorIndex);
      a.x = frac.x; a.y = frac.y; a.z = frac.z;
      recomputeHotspot(dragData.node);
      updateSliderValues(a);
    });
    window.addEventListener('pointerup', () => {
      if (dragData) {
        dragData.node.bubble.classList.remove('dragging');
        controls.enabled = true;
        dragData = null;
      }
    });

    buildPalette();
  }

  // ============================================================
  // Resize + animation loop
  // ============================================================
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    projectAll();
    renderer.render(scene, camera);
  }
  animate();

  setTimeout(() => hint && hint.classList.add('hidden'), 4000);
})();
