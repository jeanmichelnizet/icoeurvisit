// Verrou d'accès léger — actif uniquement sur le site publié.
// En local (localhost / IP privée) il se désactive tout seul → dev sans mot de passe.
// Le mot de passe n'est pas en clair : on compare son empreinte SHA-256.
// Protection "de courtoisie" (empêche l'accès par hasard + l'indexation) ;
// pas une barrière contre un utilisateur très technique.
(function () {
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '' ||
      /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return;

  var KEY = 'ic:gate';
  var HASH = '30b59239b9c553ecb8985bfa1c162b10fdd243c0a2228906d613d39d2a866278';
  try { if (localStorage.getItem(KEY) === HASH) return; } catch (e) {}

  var s = document.createElement('style');
  s.textContent = 'html.ic-locked{background:#040d24}html.ic-locked body{visibility:hidden}#ic-gate{visibility:visible}';
  (document.head || document.documentElement).appendChild(s);
  document.documentElement.classList.add('ic-locked');

  function sha(t) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('');
    });
  }

  function build() {
    var o = document.createElement('div');
    o.id = 'ic-gate';
    o.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#040d24;color:#eef2f8;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif');
    o.innerHTML =
      '<form id="icf" style="width:min(340px,86vw);text-align:center">' +
      '<div style="font-size:32px;color:#E30613;margin-bottom:12px">♥</div>' +
      '<div style="font:600 20px/1.3 Georgia,serif;margin:0 0 6px">Initiatives-Cœur</div>' +
      '<div style="color:#9fb0c8;font-size:14px;margin:0 0 20px">Accès protégé — entrez le mot de passe.</div>' +
      '<input id="icp" type="password" placeholder="Mot de passe" autocomplete="current-password" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid #2a3a54;background:#0b1b34;color:#fff;font-size:15px;box-sizing:border-box" />' +
      '<button style="width:100%;margin-top:12px;padding:12px;border:0;border-radius:10px;background:#E30613;color:#fff;font-size:15px;font-weight:600;cursor:pointer">Entrer</button>' +
      '<div id="ice" style="color:#ff6b74;font-size:13px;height:16px;margin:10px 0 0"></div>' +
      '</form>';
    document.body.appendChild(o);
    var p = o.querySelector('#icp'), e = o.querySelector('#ice');
    try { p.focus(); } catch (er) {}
    o.querySelector('#icf').addEventListener('submit', function (ev) {
      ev.preventDefault();
      sha(p.value).then(function (hh) {
        if (hh === HASH) {
          try { localStorage.setItem(KEY, HASH); } catch (er) {}
          document.documentElement.classList.remove('ic-locked');
          if (o.parentNode) o.parentNode.removeChild(o);
          window.dispatchEvent(new Event('resize'));
        } else {
          e.textContent = 'Mot de passe incorrect.';
          p.value = ''; p.focus();
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
