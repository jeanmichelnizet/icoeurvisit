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
        "const HOTSPOTS = " + dump(hotspots) + ";\n\n"
        "const PANORAMAS = " + dump(panoramas) + ";\n\n"
        "const SCENES = " + dump(scenes) + ";\n\n"
        "if (typeof window !== 'undefined') {\n"
        "  window.HOTSPOTS = HOTSPOTS;\n"
        "  window.PANORAMAS = PANORAMAS;\n"
        "  window.SCENES = SCENES;\n"
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
