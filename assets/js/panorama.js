// ============================================================
// panorama.js — minimal equirectangular 360° viewer
// ----------------------------------------------------------------
// Reuses the already self-hosted Three.js r128 (no extra dependency,
// no version conflict). Maps an equirectangular image (2:1 JPG/PNG)
// onto the inside of a sphere and lets the visitor look around by
// dragging. Fully self-contained: own renderer + RAF + cleanup.
//
//   const v = window.ICPanorama.create(container, url, { onError });
//   v.destroy();   // stops the loop, disposes GPU resources, removes canvas
//
// Gated by design: nothing runs until someone passes a real image URL.
// ============================================================

(function () {
  if (!window.THREE) return;
  const THREE = window.THREE;

  function create(container, url, opts) {
    opts = opts || {};
    if (!container) return { destroy() {} };

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
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        if (destroyed) { texture.dispose(); return; }
        texture.encoding = THREE.sRGBEncoding;
        mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
        scene.add(mesh);
      },
      undefined,
      () => { if (typeof opts.onError === 'function') opts.onError(); }
    );

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

  window.ICPanorama = { create };
})();
