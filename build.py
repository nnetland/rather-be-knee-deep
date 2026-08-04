#!/usr/bin/env python3
"""Build the deployable site into public/.

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
<meta name="theme-color" content="#5B3DF0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0E1020" media="(prefers-color-scheme: dark)">
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
