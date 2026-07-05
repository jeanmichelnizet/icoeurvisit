#!/usr/bin/env python3
"""
Pre-generate ElevenLabs audio for every hotspot text in content.js.

Usage:
    export ELEVENLABS_API_KEY=sk_xxx             (or copy .env.example to .env)
    python3 scripts/generate_audio.py            # French  → assets/audio/<id>.mp3
    python3 scripts/generate_audio.py --lang en  # English → assets/audio/en/<id>.mp3

The script parses content.js, extracts each hotspot's text (top-level for
French, `<lang>.text` for other languages), calls the ElevenLabs TTS API, and
writes the resulting MP3 to assets/audio/[<lang>/]<id>.mp3. The same voice_id
is used for every language — the multilingual model handles the accent.

Pre-generation has three advantages over runtime TTS:
  1. The API key never leaves the developer machine.
  2. Audio plays instantly (no roundtrip), even offline once cached.
  3. Zero per-visit API cost regardless of traffic.

Re-run this script every time the hotspot texts change.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT_JS = ROOT / "assets" / "js" / "content.js"
AUDIO_DIR = ROOT / "assets" / "audio"
ENV_FILE = ROOT / ".env"

# ---- Voice settings (tunable) ------------------------------------------------
# Multilingual model handles French correctly.
MODEL_ID = "eleven_multilingual_v2"
# Default voice: "Sam Davies" — cloned voice of the IMOCA Initiatives-Cœur
# former skipper. Override via the ELEVENLABS_VOICE_ID env var in .env.
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "smONmQidMr2FFPVUsEpw")

VOICE_SETTINGS = {
    "stability": 0.55,
    "similarity_boost": 0.75,
    "style": 0.25,
    "use_speaker_boost": True,
}


def load_env():
    """Load API key from env var or .env file."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if key:
        return key
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "ELEVENLABS_API_KEY":
                    return v.strip().strip('"').strip("'")
    return None


def js_obj_to_json(s):
    """Convert a JS object literal (single quotes, bare keys, trailing commas)
    to a strict JSON string the json module can parse."""
    out = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        # Strip JS-style line comments
        if c == '/' and i + 1 < n and s[i + 1] == '/':
            while i < n and s[i] != '\n':
                i += 1
            continue
        # Single-quoted string → double-quoted (escape inner " and \)
        if c == "'":
            j = i + 1
            buf = []
            while j < n and s[j] != "'":
                if s[j] == '\\' and j + 1 < n:
                    buf.append(s[j]); buf.append(s[j + 1]); j += 2; continue
                if s[j] == '"':
                    buf.append('\\"')
                else:
                    buf.append(s[j])
                j += 1
            out.append('"' + ''.join(buf) + '"')
            i = j + 1
            continue
        # Double-quoted string passes through unchanged
        if c == '"':
            j = i + 1
            while j < n and s[j] != '"':
                if s[j] == '\\' and j + 1 < n:
                    j += 2
                else:
                    j += 1
            out.append(s[i:j + 1])
            i = j + 1
            continue
        out.append(c)
        i += 1
    js = ''.join(out)
    # Quote bare keys
    js = re.sub(r'([{,]\s*)([A-Za-z_][\w]*)\s*:', r'\1"\2":', js)
    # Strip trailing commas before } or ]
    js = re.sub(r',\s*([}\]])', r'\1', js)
    return js


def parse_hotspots():
    """Extract the HOTSPOTS array from content.js."""
    src = CONTENT_JS.read_text(encoding="utf-8")
    m = re.search(r"const HOTSPOTS\s*=\s*(\[[\s\S]*?\n\]);", src)
    if not m:
        raise RuntimeError("Could not find HOTSPOTS array in content.js")
    json_str = js_obj_to_json(m.group(1))
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        print("[error] JSON parse failed:", e)
        print("[debug] first 500 chars of converted JSON:")
        print(json_str[:500])
        sys.exit(1)


def synthesize(api_key, text, out_path):
    """Call ElevenLabs TTS and save the MP3."""
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    body = json.dumps({
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": VOICE_SETTINGS,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
            out_path.write_bytes(data)
            return True, len(data)
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}"
    except Exception as e:
        return False, str(e)


def parse_lang(argv):
    """Read the target language from --lang en / --lang=en (default: fr)."""
    for i, a in enumerate(argv):
        if a == "--lang" and i + 1 < len(argv):
            return argv[i + 1]
        if a.startswith("--lang="):
            return a.split("=", 1)[1]
    return "fr"


def hotspot_text(h, lang):
    """French text lives at the top level; other languages under `<lang>.text`."""
    if lang == "fr":
        return h.get("text")
    return (h.get(lang) or {}).get("text")


def main():
    api_key = load_env()
    if not api_key:
        print("ERROR: no ELEVENLABS_API_KEY. Set it in environment or .env file.")
        sys.exit(1)

    lang = parse_lang(sys.argv[1:])
    # French → assets/audio/ ; any other language → assets/audio/<lang>/
    out_dir = AUDIO_DIR if lang == "fr" else AUDIO_DIR / lang
    out_dir.mkdir(parents=True, exist_ok=True)

    hotspots = parse_hotspots()
    print(f"Found {len(hotspots)} hotspots.")
    print(f"Language: {lang} · Voice: {VOICE_ID} · Model: {MODEL_ID}")
    print(f"Output: {out_dir}\n")

    total_bytes = 0
    failed = []
    for i, h in enumerate(hotspots, 1):
        text = hotspot_text(h, lang)
        out = out_dir / f"{h['id']}.mp3"
        if not text:
            print(f"[{i:2}/{len(hotspots)}] {h['id']:<14} ✗ no '{lang}' text (skip)")
            failed.append(h["id"])
            continue
        if out.exists() and out.stat().st_size > 1000 and "--force" not in sys.argv:
            print(f"[{i:2}/{len(hotspots)}] {h['id']:<14} ✓ exists (skip)")
            continue

        print(f"[{i:2}/{len(hotspots)}] {h['id']:<14} → synthesizing…", end="", flush=True)
        ok, info = synthesize(api_key, text, out)
        if ok:
            total_bytes += info
            print(f" ✓ {info // 1024} KB")
        else:
            print(f" ✗ {info}")
            failed.append(h["id"])

        time.sleep(0.4)  # gentle throttle

    print(f"\nDone. {total_bytes // 1024} KB total.")
    if failed:
        print("Failed:", ", ".join(failed))
        sys.exit(2)


if __name__ == "__main__":
    main()
