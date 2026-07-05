#!/usr/bin/env python3
"""
build-content.py — génère assets/js/content.js à partir de content.json.

content.json est la SOURCE éditée par l'éditeur en ligne (et l'admin local).
L'application, elle, charge content.js (synchrone) — inchangée. Ce script fait
le pont, exécuté :
  - en local après une modif de content.json,
  - à la publication (build Netlify : voir netlify.toml).

Écriture atomique : en cas d'erreur, l'ancien content.js reste intact.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content.json")
OUT = os.path.join(ROOT, "assets", "js", "content.js")


def main():
    with open(SRC, encoding="utf-8") as f:
        data = json.load(f)

    hotspots = data.get("hotspots", [])
    panoramas = data.get("panoramas", [])
    scenes = data.get("scenes", [])

    def dump(x):
        return json.dumps(x, ensure_ascii=False, indent=2)

    js = (
        "// Généré automatiquement à partir de content.json — NE PAS ÉDITER À LA MAIN.\n"
        "// (Éditez content.json via l'éditeur en ligne ou l'admin, puis régénérez.)\n\n"
        "// Mode aperçu : sur une URL '?preview', on utilise le contenu déposé par l'admin\n"
        "// dans localStorage (modifs non encore publiées) au lieu du contenu publié.\n"
        "var _pv = (function () {\n"
        "  try {\n"
        "    if (typeof location !== 'undefined' && /[?&]preview\\b/.test(location.search)) {\n"
        "      return JSON.parse(localStorage.getItem('ic:preview') || 'null');\n"
        "    }\n"
        "  } catch (e) {}\n"
        "  return null;\n"
        "})();\n\n"
        "const HOTSPOTS = (_pv && _pv.hotspots) || " + dump(hotspots) + ";\n\n"
        "const PANORAMAS = (_pv && _pv.panoramas) || " + dump(panoramas) + ";\n\n"
        "const SCENES = (_pv && _pv.scenes) || " + dump(scenes) + ";\n\n"
        "if (typeof window !== 'undefined') {\n"
        "  window.HOTSPOTS = HOTSPOTS;\n"
        "  window.PANORAMAS = PANORAMAS;\n"
        "  window.SCENES = SCENES;\n"
        "  if (_pv) {\n"
        "    window.addEventListener('DOMContentLoaded', function () {\n"
        "      var b = document.createElement('div');\n"
        "      b.textContent = 'Aperçu des modifications — non publié';\n"
        "      b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483646;background:#9a6410;color:#fff;font:600 12px/1.2 -apple-system,BlinkMacSystemFont,Arial,sans-serif;text-align:center;padding:9px;letter-spacing:.04em';\n"
        "      document.body.appendChild(b);\n"
        "    });\n"
        "  }\n"
        "}\n"
        "if (typeof module !== 'undefined') module.exports = { HOTSPOTS, PANORAMAS, SCENES };\n"
    )

    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(js)
    os.replace(tmp, OUT)
    print(f"content.js généré : {len(hotspots)} hotspots, {len(panoramas)} panoramas, {len(scenes)} scènes.")


if __name__ == "__main__":
    main()
