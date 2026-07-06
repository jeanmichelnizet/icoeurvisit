// ============================================================
// panorama.js — minimal equirectangular 360° viewer (image OU vidéo)
// ----------------------------------------------------------------
// Reuses the already self-hosted Three.js r128 (no extra dependency,
// no version conflict). Maps an equirectangular IMAGE (2:1 JPG/PNG) or
// VIDEO (2:1 MP4/WebM) onto the inside of a sphere and lets the visitor
// look around by dragging. Fully self-contained: own renderer + RAF +
// cleanup. For video, a small bar offers play/pause + sound.
//
//   const v = window.ICPanorama.create(container, url, { onError, type });
//   v.destroy();   // stops the loop, disposes GPU resources, removes canvas
//
// type: 'video' | 'image' (auto-détecté par l'extension si absent).
// Gated by design: nothing runs until someone passes a real media URL.
// ============================================================

(function () {
  if (!window.THREE) return;
  const THREE = window.THREE;

  const isVideoUrl = (u) => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u || '');

  function create(container, url, opts) {
    opts = opts || {};
    if (!container) return { destroy() {} };
    const isVideo = opts.type === 'video' || (opts.type !== 'image' && isVideoUrl(url));

    const width = () => container.clientWidth || 1;
    const height = () => container.clientHeight || 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, width() / height(), 1, 1100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // Sphere seen from the inside (negative X scale flips the normals).
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    let mesh = null;
    let destroyed = false;
    let videoEl = null;
    let controls = null;

    function addMesh(texture) {
      if (destroyed) { texture.dispose && texture.dispose(); return; }
      texture.encoding = THREE.sRGBEncoding;
      mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
      scene.add(mesh);
    }

    if (isVideo) {
      videoEl = document.createElement('video');
      videoEl.src = url;
      videoEl.crossOrigin = 'anonymous';
      videoEl.loop = true;
      videoEl.muted = true;                 // requis pour l'autoplay (surtout mobile)
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', '');
      videoEl.setAttribute('webkit-playsinline', '');
      videoEl.preload = 'auto';
      const texture = new THREE.VideoTexture(videoEl);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      videoEl.addEventListener('loadeddata', () => addMesh(texture), { once: true });
      videoEl.addEventListener('error', () => { if (typeof opts.onError === 'function') opts.onError(); });
      videoEl.play().catch(() => { /* attendra un geste utilisateur */ });
      controls = buildVideoControls(container, videoEl);
    } else {
      new THREE.TextureLoader().load(
        url,
        (texture) => addMesh(texture),
        undefined,
        () => { if (typeof opts.onError === 'function') opts.onError(); }
      );
    }

    // ----- Look-around controls (camera fixed at centre) -----
    let lon = 0, lat = 0;
    let dragging = false, downX = 0, downY = 0, downLon = 0, downLat = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';

    const point = (e) => {
      const t = (e.touches && e.touches[0]) || e;
      return { x: t.clientX, y: t.clientY };
    };
    const onDown = (e) => {
      dragging = true; el.style.cursor = 'grabbing';
      const p = point(e); downX = p.x; downY = p.y; downLon = lon; downLat = lat;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const p = point(e);
      lon = (downX - p.x) * 0.12 + downLon;
      lat = (p.y - downY) * 0.12 + downLat;
    };
    const onUp = () => { dragging = false; el.style.cursor = 'grab'; };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
      renderer.setSize(width(), height());
    };
    window.addEventListener('resize', onResize);

    const target = new THREE.Vector3();
    let raf = null;
    function animate() {
      raf = requestAnimationFrame(animate);
      lat = Math.max(-85, Math.min(85, lat));
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      target.set(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    animate();

    function destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      if (videoEl) { try { videoEl.pause(); } catch (e) {} videoEl.removeAttribute('src'); try { videoEl.load(); } catch (e) {} }
      if (controls && controls.parentNode) controls.parentNode.removeChild(controls);
      geometry.dispose();
      if (mesh) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    }

    return { destroy };
  }

  // Small overlay bar for video: play/pause + mute/unmute.
  function buildVideoControls(container, video) {
    const bar = document.createElement('div');
    bar.className = 'pano-vctrl';
    bar.style.cssText = 'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:6;' +
      'display:flex;gap:10px;background:rgba(4,13,36,.72);backdrop-filter:blur(8px);' +
      'padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14)';
    const mk = (svg, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.style.cssText = 'width:38px;height:38px;border-radius:50%;border:0;cursor:pointer;' +
        'background:rgba(255,255,255,.10);color:#fff;display:flex;align-items:center;justify-content:center';
      b.innerHTML = svg;
      return b;
    };
    const PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    const MUTE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" opacity=".55"/><path d="M19 12a7 7 0 0 0-1.5-4.3l-1.2 1.2A5 5 0 0 1 17 12a5 5 0 0 1-.7 2.6l1.2 1.2A7 7 0 0 0 19 12z" opacity="0"/></svg>';
    const SOUND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4z"/><path d="M14 3.2v2.1A7 7 0 0 1 14 18.7v2.1A9 9 0 0 0 14 3.2z"/></svg>';
    const playBtn = mk(PAUSE, 'Lecture / pause');
    const soundBtn = mk(MUTE, 'Activer le son');
    const sync = () => {
      playBtn.innerHTML = video.paused ? PLAY : PAUSE;
      soundBtn.innerHTML = video.muted ? MUTE : SOUND;
      soundBtn.style.background = video.muted ? 'rgba(255,255,255,.10)' : 'rgba(227,6,19,.55)';
    };
    playBtn.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); sync(); });
    soundBtn.addEventListener('click', () => { video.muted = !video.muted; if (!video.muted) video.play().catch(() => {}); sync(); });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    bar.appendChild(playBtn); bar.appendChild(soundBtn);
    container.appendChild(bar);
    sync();
    return bar;
  }

  window.ICPanorama = { create };
})();
