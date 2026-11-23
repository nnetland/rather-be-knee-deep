#!/usr/bin/env python3
"""Rebuild the home splash sticker (BRAND_STICKER_ART) from a square source image.

The home sticker is the one piece of badge art the app draws outside the resort
badges — splash, nav and the resort page's home link — so it has to share their
edge treatment exactly: art out to r=109 inside a white die-cut rim at r=119, on
the badges' 240-unit geometry, rendered at 600x600 with transparent corners.

A sticker generated in Gemini comes back on a white page, with its own rim at
whatever thickness the model felt like and a soft drop shadow outside it. This
script throws that rim away, keeps only the coloured field, and redraws the rim
at the badges' ratio, so the home sticker and the resort badges match.

Usage, from the repo root:

    python3 tools/set_home_sticker.py ~/Downloads/new-sticker.png
    python3 tools/set_home_sticker.py new.png --preview   # write a PNG, don't patch

It rewrites BRAND_STICKER_ART in src/badge-art.js in place. Run assemble.py and
build.py afterwards, as with any badge change.
"""

import argparse
import base64
import io
import math
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BADGE_ART = os.path.join(ROOT, "src", "badge-art.js")

OUT_PX = 600          # rendered size of the sticker
R_RIM = 297.5         # white die-cut rim, = 119/120 of the half-frame
R_ART = 272.5         # coloured field,   = 109/120 of the half-frame
SUPERSAMPLE = 4       # drawn at 4x, then downsampled, so the rim edge stays clean
WHITE = 235           # a channel at or above this counts as the white page/rim


def find_field(im):
    """Centre and radius of the sticker's coloured field, ignoring its own rim.

    Walks outward from the image centre along 180 rays and takes the first radius
    where the page turns white and stays white, which lands on the outside of the
    coloured field rather than on the thin grey line at the edge of the rim.
    """
    px = im.load()
    w, h = im.size
    cx, cy = (w - 1) / 2, (h - 1) / 2
    limit = min(cx, cy)
    radii = []
    for deg in range(0, 360, 2):
        t = math.radians(deg)
        ct, st = math.cos(t), math.sin(t)
        run, first = 0, None
        r = limit * 0.3
        while r < limit:
            x, y = int(round(cx + r * ct)), int(round(cy + r * st))
            if not (0 <= x < w and 0 <= y < h):
                break
            if min(px[x, y][:3]) >= WHITE:
                if run == 0:
                    first = r
                run += 1
                if run >= 10:
                    radii.append(first)
                    break
            else:
                run, first = 0, None
            r += 0.5
    if len(radii) < 90:
        sys.exit("Could not find the sticker's coloured field. Is the source a "
                 "circular sticker on a white page?")
    radii.sort()
    return cx, cy, radii[len(radii) // 2]


def build(src_path):
    im = Image.open(src_path).convert("RGB")
    cx, cy, r = find_field(im)
    # A couple of pixels outward: any rim that sneaks in is white on white, while
    # cropping short would shave the field's outline.
    r += 3
    art = im.crop((int(round(cx - r)), int(round(cy - r)),
                   int(round(cx + r)), int(round(cy + r))))

    s = SUPERSAMPLE
    size = OUT_PX * s
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c, ro, ri = OUT_PX / 2 * s, R_RIM * s, R_ART * s
    ImageDraw.Draw(out).ellipse([c - ro, c - ro, c + ro, c + ro],
                                fill=(255, 255, 255, 255))

    d = int(round(ri * 2))
    inner = art.resize((d, d), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d - 1, d - 1], fill=255)
    out.paste(inner, (int(round(c - ri)), int(round(c - ri))), mask)

    return out.resize((OUT_PX, OUT_PX), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help="square image of a circular sticker on white")
    ap.add_argument("--quality", type=int, default=88)
    ap.add_argument("--preview", metavar="PATH", nargs="?", const="home-sticker.png",
                    help="write a PNG to look at instead of patching badge-art.js")
    args = ap.parse_args()

    sticker = build(args.source)

    if args.preview:
        sticker.save(args.preview)
        print("wrote", args.preview)
        return

    buf = io.BytesIO()
    sticker.save(buf, "WEBP", quality=args.quality, method=6)
    uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

    src = open(BADGE_ART).read()
    pattern = r'(const BRAND_STICKER_ART = ")[^"]*(";)'
    if not re.search(pattern, src):
        sys.exit("BRAND_STICKER_ART not found in src/badge-art.js")
    open(BADGE_ART, "w").write(re.sub(pattern, lambda m: m.group(1) + uri + m.group(2),
                                      src, count=1))
    print("BRAND_STICKER_ART updated (%.1f KB webp)" % (len(buf.getvalue()) / 1024))
    print("now run: python3 assemble.py && python3 build.py")


if __name__ == "__main__":
    main()
