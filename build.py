#!/usr/bin/env python3
"""Build the deployable site into public/.

    theme-color is a single dark value: the app no longer follows the OS
    colour scheme, so a light-scheme theme-color would tint the browser
    chrome purple around a page that is always dark.

Runs assemble.py to stitch src/ into one self-contained HTML file, then
injects the hosting-only <head> tags (icons, manifest, share image) and
writes the result to public/index.html.

    python build.py
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent
HEAD_EXTRAS = """<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0E1020">
<meta name="apple-mobile-web-app-title" content="Knee Deep">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta property="og:image" content="/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="/og-image.png">
"""

subprocess.run([sys.executable, str(ROOT / "assemble.py")], check=True)

built = ROOT / "rather-be-knee-deep.html"
html = built.read_text()

if 'rel="manifest"' not in html:
    anchor = '<meta property="og:type"'
    if anchor not in html:
        raise SystemExit("Could not find the og:type tag to anchor head injection.")
    html = html.replace(anchor, HEAD_EXTRAS + anchor, 1)

out = ROOT / "public" / "index.html"
out.write_text(html)
print(f"Wrote {out} ({len(html.encode()):,} bytes)")

for required in ("icon.svg", "manifest.webmanifest", "og-image.png", "apple-touch-icon.png"):
    if not (ROOT / "public" / required).exists():
        print(f"  WARNING: public/{required} is missing")

# ---------------------------------------------------------------------------
# Per-resort share pages (2026-11-21, Director's call): when a pick is shared
# by text or DM, the link preview should show that resort's badge. Link
# crawlers don't run JavaScript or see the #result= hash, so every resort gets
# a tiny static page at /r/<id> carrying its own og:image (public/og/<id>.jpg,
# rendered from the badge by tools/render_og.js). A person who taps the link
# is sent straight on to the app with the hash intact.
# ---------------------------------------------------------------------------
import html as _html
import json as _json

SITE = "https://rather-be-knee-deep.web.app"
_data = (ROOT / "src" / "data.js").read_text()
_start = _data.index("[", _data.index("RESORTS"))
_resorts, _ = _json.JSONDecoder().raw_decode(_data[_start:])
_outdir = ROOT / "public" / "r"
_outdir.mkdir(exist_ok=True)
_made = 0
for _r in _resorts:
    _rid = _r["id"]
    if not (ROOT / "public" / "og" / f"{_rid}.jpg").exists():
        continue
    _place = _r["state_province"] + (", Canada" if _r.get("country") == "Canada" else "")
    _title = _html.escape(f"{_r['name']} — a ski trip pick")
    _desc = _html.escape(f"{_r['name']}, {_place}. See why it's the pick.")
    _img = f"{SITE}/og/{_rid}.jpg"
    (_outdir / f"{_rid}.html").write_text(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>{_title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Rather Be Knee Deep">
<meta property="og:title" content="{_title}">
<meta property="og:description" content="{_desc}">
<meta property="og:url" content="{SITE}/r/{_rid}">
<meta property="og:image" content="{_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{_img}">
<meta name="theme-color" content="#0E1020">
<script>location.replace("/" + location.hash);</script>
</head><body style="background:#14101F;color:#F5F2FF;font-family:system-ui,sans-serif">
<p><a href="/" style="color:#8C78F5">Open {_title}</a></p>
</body></html>
""")
    _made += 1
print(f"Wrote {_made} share pages to public/r/")
