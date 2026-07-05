// ============================================================
// Analytics — thin abstraction over Plausible (or any provider)
// ----------------------------------------------------------------
// Goals from the comms director:
//   - know which pages are most consulted
//   - know which media type is most engaged with (3D, 360, video, audio, text)
// Implementation:
//   - For now we log events to the console + localStorage (offline buffer)
//   - When Plausible is plugged in, we forward the events via window.plausible
//     (drop-in; no other code change needed).
//   - Privacy: no cookies, no PII, no fingerprinting. RGPD-friendly.
// ============================================================

(function () {
  const STORAGE_KEY = 'ic:events';
  const MAX_BUFFER = 200;

  function read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function write(events) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFER))); }
    catch (e) { /* quota — ignore */ }
  }

  function track(eventName, props) {
    const event = {
      t: Date.now(),
      name: eventName,
      props: props || {},
      page: location.pathname,
      lang: document.documentElement.lang || 'fr'
    };

    // 1. console (dev)
    if (window.console && console.debug) {
      console.debug('[track]', eventName, event.props);
    }
    // 2. forward to Plausible if loaded
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props: event.props });
    }
    // 3. buffer locally (so the comms team can dump it later if needed)
    const events = read();
    events.push(event);
    write(events);
  }

  // Auto-track page view
  document.addEventListener('DOMContentLoaded', () => {
    track('pageview', { path: location.pathname });

    // Auto-track outbound tile clicks
    document.querySelectorAll('[data-track]').forEach(el => {
      el.addEventListener('click', () => track(el.dataset.track));
    });
  });

  // Expose for the visite page
  window.IC = window.IC || {};
  window.IC.track = track;
  window.IC.dumpEvents = () => read();

  // ---- PWA: register the service worker (offline resilience + install) ----
  // Loaded site-wide from here (the one script present on every page).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* SW optional */ });
    });
  }
})();
