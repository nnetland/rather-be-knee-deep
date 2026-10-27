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

def openings_json():
    """research/openings-2026-27.json -> {id: {date, status}} for the bundle.
    Sources stay in the research file; the app only needs the date. Entries
    with no published date are kept: "researched, nothing announced" is a
    different fact from "never looked" (see openings.js)."""
    import json
    path = os.path.join(BASE, "research", "openings-2026-27.json")
    if not os.path.exists(path):
        return "{}"
    rows = json.load(open(path))
    slim = {r["id"]: {"date": r.get("date"), "status": r.get("status")} for r in rows}
    return json.dumps(slim, separators=(",", ":"), sort_keys=True)

shell = read("shell.html")
replacements = {
    "/*__STYLES__*/": read("styles.css"),
    "/*__DATA_JS__*/": read("data.js"),
    "/*__ICONS_JS__*/": read("icons.js"),
    "/*__BADGES_JS__*/": read("badges.js"),
    "/*__ENGINE_JS__*/": read("engine.js"),
    "/*__NOAA_JS__*/": read("noaa.js"),
    "/*__OPENINGS_JS__*/": read("openings.js").replace(
        "/*__OPENINGS_JSON__*/{}", openings_json()),
    "/*__QUIVER_JS__*/": read("quiver.js"),
    "/*__RANTS_JS__*/": read("rants.js"),
    "/*__APP_JS__*/": read("app.js"),
    "/*__APP_CHASE_JS__*/": read("app-chase.js"),
    "/*__APP_QUIVER_JS__*/": read("app-quiver.js"),
    "/*__APP_NICOLES_JS__*/": read("app-nicoles.js"),
    "/*__APP_RANTS_JS__*/": read("app-rants.js"),
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
