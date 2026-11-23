#!/usr/bin/env python3
"""Generate resort badge art with the Gemini image API, straight into badges-in/.

Replaces the hand loop of prompting Gemini in the browser, downloading each
image and renaming it. Reads the subject and field colour for each resort from
tools/badge-subjects.json, sends three already-approved badges as style
references, and writes <resort-id>.png so tools/ingest_badges.py can pick it up
with no renaming step.

Stdlib only — no pip install. Needs a Gemini API key from
https://aistudio.google.com/apikey in GEMINI_API_KEY.

Usage, from the repo root:

    export GEMINI_API_KEY=...

    python3 tools/generate_badges.py --list-models      # what this key can call
    python3 tools/generate_badges.py --missing --dry-run
    python3 tools/generate_badges.py --missing          # everything with no art yet
    python3 tools/generate_badges.py --ids red-lodge-mt,alyeska-ak
    python3 tools/generate_badges.py --ids vail-co --force   # redo one that has art

Image generation is paid — there is no free tier for it. At the time of
writing Nano Banana Pro runs about $0.13 per 1K/2K image, so a full sweep of
the remaining badges is a few dollars. Check current pricing before a big run.
"""

import argparse
import base64
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBJECTS = os.path.join(ROOT, "tools", "badge-subjects.json")
BADGE_ART = os.path.join(ROOT, "src", "badge-art.js")
OUT_DIR = os.path.join(ROOT, "badges-in")

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-3-pro-image"

# Shipped badges used as style references. Pro takes up to 3 style references,
# so keep this at three. They are pulled out of src/badge-art.js, which means
# the references are always the real thing rather than a stale export.
DEFAULT_REFS = ["arapahoe-basin-co", "snowbasin-ut", "vail-co"]

PROMPT = """\
Look at the attached sticker illustrations. They are one design system. Study their \
shared drawing language — not their subjects — and produce a new illustration in \
exactly that style.

Make a square image of a circular die-cut vinyl sticker, centred, on a plain white \
background, with a thin pure-white rim around the sticker's edge.

Inside the rim, one solid flat field of colour: {hex}. The field is completely empty — \
no scene, no landscape, no horizon, no ground, no snow, no mountains, no background \
objects of any kind.

Centred on that field, floating with clear empty space around it, draw a single \
character caught mid-action: {gag}. Show the moment, not a portrait — a limb, prop or \
spray of snow in motion. The character should fill roughly 65% of the circle's width \
and 75% of its height, sitting slightly above centre, never touching the rim.

Match the reference images on all of the following:

Flat vector cartoon. Thick black outlines of even weight on every shape. Completely \
flat colour fills — no gradients, no shading, no texture, no gloss, no highlights. \
Interior detail lines in the same black at about half the outline weight. Rounded \
bulbous rubber-hose forms; noodle limbs with no visible elbows or knees; simple mitten \
hands with three or four stubby rounded fingers. Animals are drawn with human hands, \
human posture and human props.

The face is the most important part. Large white almond-shaped eyes with a heavy black \
upper-lid arc pressing down across the top, half-lidded, and a solid black oval pupil \
pushed to one side so plenty of white shows around it — a sideways, knowing, deadpan \
glance. A small black lash flick at the outer corner. The expression is wry and \
self-aware, with attitude — never innocent, never cute, never a wide open smile. The \
mouth is a single simple curved line or small solid lips. No teeth. The nose is one \
short hooked line with no nostrils. If the character wears sunglasses or goggles, the \
lenses are translucent and the eyes are clearly visible behind them.

Colour is assigned for harmony, not realism: skin and fur are flat light grey, and \
limbs may be any colour from the palette. Use four to six colours only.

A soft dark drop shadow sits directly beneath the character, offset slightly down, low \
opacity, slightly blurred — a layered cut-paper sticker feel.

Do not put any text, letters, words or numbers anywhere in the image. Do not put any \
brand logos, wordmarks, monograms or manufacturer badges on clothing, gear or props — \
no real-world brands of any kind. Do not draw a border or frame other than the white \
die-cut rim. Do not make it photorealistic or 3D. No scenery, no multiple characters, \
no cute big-eyed kawaii style, no realistic skin tones, no outlines of varying \
thickness.\
"""


# --- reading the repo -------------------------------------------------------

def load_subjects():
    with open(SUBJECTS) as f:
        return json.load(f)


def load_shipped_art():
    """{resort id: (mime, raw bytes)} for every badge already wired into the app."""
    if not os.path.exists(BADGE_ART):
        return {}
    with open(BADGE_ART) as f:
        src = f.read()
    start = src.find("const BADGE_ART =")
    end = src.find("const BADGE_ART_DESC")
    if start < 0:
        return {}
    block = src[start:end if end > start else len(src)]
    out = {}
    for rid, mime, b64 in re.findall(
        r'"([a-z0-9-]+)":\s*"data:(image/[a-z]+);base64,([^"]+)"', block
    ):
        out[rid] = (mime, base64.b64decode(b64))
    return out


# --- the API ----------------------------------------------------------------

def api_key():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        sys.exit(
            "No API key. Get one at https://aistudio.google.com/apikey, then:\n"
            "  export GEMINI_API_KEY=..."
        )
    return key


def request(url, key, payload=None, method="GET", timeout=300):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("x-goog-api-key", key)
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def list_models(key):
    seen, page = [], None
    while True:
        url = API_ROOT + "/models?pageSize=200"
        if page:
            url += "&pageToken=" + page
        body = request(url, key)
        seen.extend(body.get("models", []))
        page = body.get("nextPageToken")
        if not page:
            break
    return seen


def extract_image(body):
    """Pull the first inline image out of a generateContent response."""
    for cand in body.get("candidates", []):
        content = cand.get("content") or {}
        for part in content.get("parts", []):
            blob = part.get("inlineData") or part.get("inline_data")
            if blob and blob.get("data"):
                return base64.b64decode(blob["data"])
    # No image: surface whatever the model said instead, it is usually a refusal
    # or a safety block and the reason matters.
    for cand in body.get("candidates", []):
        if cand.get("finishReason") not in (None, "STOP"):
            raise RuntimeError("finishReason=%s" % cand["finishReason"])
        for part in (cand.get("content") or {}).get("parts", []):
            if part.get("text"):
                raise RuntimeError("text instead of image: " + part["text"][:300])
    if body.get("promptFeedback", {}).get("blockReason"):
        raise RuntimeError("blocked: " + body["promptFeedback"]["blockReason"])
    raise RuntimeError("no image in response: " + json.dumps(body)[:300])


def generate(key, model, prompt, refs, size, timeout):
    parts = [{"text": prompt}]
    for mime, raw in refs:
        parts.append({
            "inline_data": {
                "mime_type": mime,
                "data": base64.b64encode(raw).decode(),
            }
        })
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": "1:1", "imageSize": size},
        },
    }
    url = "%s/models/%s:generateContent" % (API_ROOT, model)
    return extract_image(request(url, key, payload, method="POST", timeout=timeout))


def generate_with_retry(key, model, prompt, refs, size, timeout, tries=4):
    last = None
    for attempt in range(tries):
        try:
            return generate(key, model, prompt, refs, size, timeout)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:400]
            last = "HTTP %s: %s" % (e.code, detail)
            if e.code in (400, 401, 403, 404):
                break  # bad key, bad model or bad request — retrying will not help
        except Exception as e:  # noqa: BLE001 - report anything else and retry
            last = "%s: %s" % (type(e).__name__, e)
        if attempt < tries - 1:
            wait = (2 ** attempt) * 5 + random.uniform(0, 3)
            print("      retry in %.0fs (%s)" % (wait, last))
            time.sleep(wait)
    raise RuntimeError(last)


# --- main -------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ids", help="comma-separated resort ids")
    ap.add_argument("--missing", action="store_true",
                    help="every resort with no art in src/badge-art.js yet")
    ap.add_argument("--limit", type=int, help="stop after this many")
    ap.add_argument("--force", action="store_true",
                    help="regenerate even if the resort already has art")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--size", default="2K", choices=["1K", "2K", "4K"])
    ap.add_argument("--refs", default=",".join(DEFAULT_REFS),
                    help="shipped badge ids to send as style references (max 3)")
    ap.add_argument("--delay", type=float, default=2.0,
                    help="seconds between calls")
    ap.add_argument("--timeout", type=float, default=300.0)
    ap.add_argument("--dry-run", action="store_true",
                    help="print what would be sent, call nothing")
    ap.add_argument("--list-models", action="store_true",
                    help="list the models this key can call, then exit")
    args = ap.parse_args()

    if args.list_models:
        for m in list_models(api_key()):
            name = m.get("name", "").replace("models/", "")
            methods = ",".join(m.get("supportedGenerationMethods", []))
            print("%-36s %s" % (name, methods))
        return

    subjects = load_subjects()
    shipped = load_shipped_art()

    if args.ids:
        ids = [i.strip() for i in args.ids.split(",") if i.strip()]
    elif args.missing:
        ids = [r for r in subjects if r not in shipped]
    else:
        ap.error("pass --ids or --missing")

    unknown = [i for i in ids if i not in subjects]
    if unknown:
        sys.exit("not in badge-subjects.json: " + ", ".join(unknown))

    if not args.force:
        skipped = [i for i in ids if i in shipped]
        ids = [i for i in ids if i not in shipped]
        if skipped:
            print("already have art, skipping %d (use --force to redo): %s"
                  % (len(skipped), ", ".join(skipped)))

    ids.sort()
    if args.limit:
        ids = ids[:args.limit]
    if not ids:
        print("nothing to do")
        return

    ref_ids = [r.strip() for r in args.refs.split(",") if r.strip()][:3]
    missing_refs = [r for r in ref_ids if r not in shipped]
    if missing_refs:
        sys.exit("reference badges have no art yet: " + ", ".join(missing_refs))
    refs = [shipped[r] for r in ref_ids]

    os.makedirs(OUT_DIR, exist_ok=True)
    print("model %s at %s, %d badge%s, references: %s\n"
          % (args.model, args.size, len(ids), "" if len(ids) == 1 else "s",
             ", ".join(ref_ids)))

    key = None if args.dry_run else api_key()
    ok, failed = [], []

    for n, rid in enumerate(ids, 1):
        entry = subjects[rid]
        prompt = PROMPT.format(hex=entry["hex"], gag=entry["gag"])
        print("[%d/%d] %s  %s" % (n, len(ids), rid, entry["hex"]))
        print("      %s" % entry["gag"])

        if args.dry_run:
            continue

        try:
            raw = generate_with_retry(key, args.model, prompt, refs,
                                      args.size, args.timeout)
        except Exception as e:  # noqa: BLE001 - one bad badge must not stop the run
            print("      FAILED: %s" % e)
            failed.append(rid)
            continue

        path = os.path.join(OUT_DIR, rid + ".png")
        with open(path, "wb") as f:
            f.write(raw)
        print("      wrote badges-in/%s.png (%.1f MB)" % (rid, len(raw) / 1e6))
        ok.append(rid)

        if n < len(ids) and args.delay:
            time.sleep(args.delay)

    if args.dry_run:
        print("\ndry run — nothing sent")
        return

    print("\n%d written, %d failed" % (len(ok), len(failed)))
    if failed:
        print("retry with:\n  python3 tools/generate_badges.py --ids %s"
              % ",".join(failed))
    if ok:
        print("\nNow tell Claude the batch is in, or run it yourself:\n"
              "  python3 tools/ingest_badges.py && python3 build.py")


if __name__ == "__main__":
    main()
