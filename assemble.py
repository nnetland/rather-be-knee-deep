#!/usr/bin/env python3
"""Assembles build/src/*.js + styles.css + shell.html into the single
self-contained deliverable: build/rather-be-knee-deep.html
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "src")

def read(name):
    with open(os.path.join(SRC, name)) as f:
        return f.read()

shell = read("shell.html")
replacements = {
    "/*__STYLES__*/": read("styles.css"),
    "/*__DATA_JS__*/": read("data.js"),
    "/*__ICONS_JS__*/": read("icons.js"),
    "/*__BADGES_JS__*/": read("badges.js"),
    "/*__ENGINE_JS__*/": read("engine.js"),
    "/*__NOAA_JS__*/": read("noaa.js"),
    "/*__APP_JS__*/": read("app.js"),
    "/*__APP_CHASE_JS__*/": read("app-chase.js"),
    "/*__APP_NICOLES_JS__*/": read("app-nicoles.js"),
}

out = shell
for token, content in replacements.items():
    if token not in out:
        raise SystemExit(f"Missing token in shell.html: {token}")
    out = out.replace(token, content)

outfile = os.path.join(BASE, "rather-be-knee-deep.html")
with open(outfile, "w") as f:
    f.write(out)

print("Wrote", outfile, "(", len(out), "bytes )")
