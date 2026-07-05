#!/usr/bin/env bash
# ============================================================
# deploy.sh — publie le site sur Netlify via l'API (sans CLI/Node).
# À relancer après chaque changement.
#
# Ajoute au passage un verrou d'accès léger (mot de passe, injecté
# UNIQUEMENT dans la version publiée — le dev local reste sans verrou)
# et met les pages en noindex.
#
# Requiert dans .env :
#   NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, SITE_AUTH_PASS
# .env n'est JAMAIS inclus dans le déploiement.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

STAGE="$(mktemp -d)"
ZIPDIR="$(mktemp -d)"
ZIP="$ZIPDIR/site.zip"
trap 'rm -rf "$STAGE" "$ZIPDIR"' EXIT

# 1) fichiers publics (sans fichiers sensibles)
cp -R *.html assets manifest.webmanifest sw.js "$STAGE"/

# 2) verrou d'accès : gate.js avec l'empreinte SHA-256 du mot de passe
HASH=$(printf '%s' "$SITE_AUTH_PASS" | shasum -a 256 | awk '{print $1}')
sed "s/__HASH__/$HASH/" scripts/gate.template.js > "$STAGE/assets/js/gate.js"

# 3) injecter le verrou + noindex dans le <head> de chaque page publiée
python3 - "$STAGE" <<'PY'
import sys, glob, os
stage = sys.argv[1]
inj = ('<meta name="robots" content="noindex,nofollow" />\n'
       '<script src="assets/js/gate.js"></script>\n')
for f in glob.glob(os.path.join(stage, '*.html')):
    s = open(f, encoding='utf-8').read()
    if 'assets/js/gate.js' not in s:
        s = s.replace('<head>', '<head>\n' + inj, 1)
        open(f, 'w', encoding='utf-8').write(s)
PY

# 4) zip + envoi à l'API Netlify
( cd "$STAGE" && zip -qr "$ZIP" . )
echo "Déploiement ($(du -sh "$ZIP" | awk '{print $1}')) vers ${NETLIFY_SITE_NAME:-site} ..."
RESP=$(curl -s -X POST "https://api.netlify.com/api/v1/sites/$NETLIFY_SITE_ID/deploys" \
  -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/zip" \
  --data-binary @"$ZIP")
DID=$(printf '%s' "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
echo "  deploy id : ${DID:-?}"

# 5) attendre l'état 'ready'
if [ -n "$DID" ]; then
  for i in $(seq 1 20); do
    STATE=$(curl -s "https://api.netlify.com/api/v1/deploys/$DID" -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state','?'))")
    [ "$STATE" = "ready" ] && { echo "  state     : ready ✓"; break; }
    [ "$STATE" = "error" ] && { echo "  state     : error ✗"; break; }
    sleep 3
  done
fi
echo "  URL       : https://${NETLIFY_SITE_NAME:-}.netlify.app"
