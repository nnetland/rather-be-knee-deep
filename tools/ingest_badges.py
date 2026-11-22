#!/usr/bin/env python3
"""Add Gemini badge art to src/badge-art.js (P4).

Drop square PNG/JPG/WebP files into badges-in/, each named <resort-id>.png
(e.g. telluride-co.png), then run:

    python3 tools/ingest_badges.py

For each file it finds the coloured field (everything that isn't the white
background or the white die-cut rim), crops it square, scales it to 420x420
and encodes it as WebP, matching the 28 badges already shipped. The entry is
added to BADGE_ART, or replaces an existing one. Alt text comes from
tools/badge-subjects-43.json when the resort is listed there.

Before shipping, look at every badge for real brand marks on clothing or
gear. Generated garment logos reproduce trademarks and must be painted out.
"""
import base64, io, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INBOX = os.path.join(ROOT, "badges-in")
ART = os.path.join(ROOT, "src", "badge-art.js")
SUBJECTS = os.path.join(ROOT, "tools", "badge-subjects-43.json")

def field_bbox(img, tol=40):
    """Bounding box of pixels that are clearly not white."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    xs, ys = [], []
    step = max(1, min(w, h) // 400)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if 255 * 3 - (r + g + b) > tol * 3:
                xs.append(x); ys.append(y)
    if not xs:
        raise ValueError("no coloured field found")
    return min(xs), min(ys), max(xs), max(ys)

def encode(path):
    img = Image.open(path).convert("RGB")
    x0, y0, x1, y1 = field_bbox(img)
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2))
    sq = img.crop(box).resize((420, 420), Image.LANCZOS)
    buf = io.BytesIO()
    sq.save(buf, "WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

def upsert(block_name, src, key, value):
    """Insert or replace "key": "value" inside `const <block_name> = { ... };`."""
    start = src.index(f"const {block_name} = {{")
    end = src.index("\n};", start)
    body = src[start:end]
    line = f'  "{key}": {json.dumps(value)},'
    pat = re.compile(r'^  "' + re.escape(key) + r'": .*,$', re.M)
    if pat.search(body):
        body = pat.sub(lambda m: line, body)
    else:
        body = body + "\n" + line
    return src[:start] + body + src[end:]

def main():
    files = sorted(f for f in os.listdir(INBOX) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
    if not files:
        sys.exit("badges-in/ is empty")
    subjects = json.load(open(SUBJECTS)) if os.path.exists(SUBJECTS) else {}
    src = open(ART).read()
    for f in files:
        rid = os.path.splitext(f)[0]
        src = upsert("BADGE_ART", src, rid, encode(os.path.join(INBOX, f)))
        if rid in subjects:
            src = upsert("BADGE_ART_DESC", src, rid, subjects[rid]["alt"])
        print("added", rid)
    open(ART, "w").write(src)

if __name__ == "__main__":
    main()
