#!/usr/bin/env python3
"""Prepares data.js: merges resorts.json + nicoles-list.json hot takes + curated lat/lon
coordinates into a single JS data module embedded in the final app.

Coordinates are curated from general geographic knowledge of these named, well-known ski
areas (approximate resort base/village locations, sufficient for NOAA gridpoint resolution
~2.5km and for coarse origin-distance estimates). Where confidence in a coordinate is not
reasonably high, it is left null and that resort is marked forecast-unavailable rather than
guessed, per the build brief.
"""
import json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
resorts = json.load(open(os.path.join(BASE, "research", "resorts.json")))
nicoles = json.load(open(os.path.join(BASE, "research", "nicoles-list.json")))

# Curated approximate coordinates (lat, lon) for every resort in resorts.json.
COORDS = {
    "vail-co": (39.6403, -106.3742),
    "beaver-creek-co": (39.6042, -106.5165),
    "breckenridge-co": (39.4817, -106.0384),
    "keystone-co": (39.6061, -105.9433),
    "aspen-snowmass-co": (39.2084, -106.9490),
    "steamboat-co": (40.4850, -106.8317),
    "telluride-co": (37.9375, -107.8123),
    "crested-butte-co": (38.8697, -106.9878),
    "winter-park-co": (39.8868, -105.7625),
    "arapahoe-basin-co": (39.6425, -105.8719),
    "wolf-creek-co": (37.4719, -106.7916),
    "copper-mountain-co": (39.5022, -106.1500),
    "loveland-co": (39.6803, -105.8974),
    "park-city-ut": (40.6461, -111.4980),
    "deer-valley-ut": (40.6374, -111.4783),
    "alta-ut": (40.5884, -111.6386),
    "snowbird-ut": (40.5830, -111.6556),
    "solitude-ut": (40.6199, -111.5919),
    "powder-mountain-ut": (41.3797, -111.7838),
    "snowbasin-ut": (41.2160, -111.8570),
    "jackson-hole-wy": (43.5875, -110.8279),
    "grand-targhee-wy": (43.7904, -110.9575),
    "big-sky-mt": (45.2871, -111.4010),
    "whitefish-mt": (48.4903, -114.3567),
    "bridger-bowl-mt": (45.8177, -110.9036),
    "red-lodge-mt": (45.1966, -109.4243),
    "sun-valley-id": (43.6963, -114.3517),
    "schweitzer-id": (48.3670, -116.6222),
    "taos-nm": (36.5960, -105.4522),
    "palisades-tahoe-ca": (39.1968, -120.2358),
    "heavenly-ca": (38.9353, -119.9400),
    "mammoth-mountain-ca": (37.6308, -119.0326),
    "kirkwood-ca": (38.6850, -120.0654),
    "mt-bachelor-or": (43.9792, -121.6883),
    "timberline-or": (45.3311, -121.7113),
    "crystal-mountain-wa": (46.9354, -121.4744),
    "stevens-pass-wa": (47.7448, -121.0890),
    "mt-baker-wa": (48.8599, -121.6789),
    "stowe-vt": (44.5303, -72.7815),
    "killington-vt": (43.6045, -72.8201),
    "sugarbush-vt": (44.1359, -72.8992),
    "jay-peak-vt": (44.9241, -72.5286),
    "stratton-vt": (43.1134, -72.9081),
    "okemo-vt": (43.4009, -72.7157),
    "sunday-river-me": (44.4737, -70.8573),
    "sugarloaf-me": (45.0314, -70.3131),
    "loon-mountain-nh": (44.0559, -71.6216),
    "alyeska-ak": (60.9583, -149.0956),
    "lutsen-mn": (47.6693, -90.7415),
    "giants-ridge-mn": (47.6408, -92.1732),
    "afton-alps-mn": (44.8394, -92.7891),
    "buck-hill-mn": (44.7397, -93.2836),
    "welch-village-mn": (44.5711, -92.6604),
    "wild-mountain-mn": (45.5175, -92.7327),
    "andes-tower-hills-mn": (45.4489, -95.3355),
    "mount-bohemia-mi": (47.8886, -87.9673),
    "big-powderhorn-mi": (46.4930, -90.1284),
    "whitecap-mountains-wi": (46.4488, -90.4562),
    "powder-ridge-ct": (41.4934, -72.6743),
    "indianhead-mi": (46.5497, -90.1039),
    "blackjack-mi": (46.5391, -90.0672),
    # Canada — no NOAA coverage, but coordinates still useful for origin-distance estimates
    "whistler-blackcomb-bc": (50.1163, -122.9574),
    "revelstoke-bc": (50.9981, -118.1957),
    "big-white-bc": (49.7314, -118.9330),
    "sun-peaks-bc": (50.8837, -119.8898),
    "fernie-bc": (49.4631, -115.0890),
    "lake-louise-ab": (51.4254, -116.1773),
    "banff-sunshine-ab": (51.0762, -115.7859),
    "kicking-horse-bc": (51.2985, -117.0470),
    "panorama-bc": (50.4587, -116.2378),
    "mont-tremblant-qc": (46.2093, -74.5852),
}

missing = [r["id"] for r in resorts if r["id"] not in COORDS]
if missing:
    print("WARNING: no coordinates for:", missing)

for r in resorts:
    lat, lon = COORDS.get(r["id"], (None, None))
    r["lat"] = lat
    r["lon"] = lon

# Join Nicole's hot takes onto resort records (only where a real take exists)
by_id = {r["id"]: r for r in resorts}
take_count = 0
for row in nicoles:
    rid = row.get("resort_id")
    if rid and rid in by_id and row.get("nicoles_take"):
        by_id[rid]["hot_take"] = {
            "text": row["nicoles_take"],
            "rating": row.get("overall_rating"),
        }
        take_count += 1

for r in resorts:
    r.setdefault("hot_take", None)

# Dedupe nicoles-list.json rows by resort_id (source sheet has one duplicate: park-city-ut)
seen = set()
nicoles_deduped = []
for row in nicoles:
    rid = row.get("resort_id")
    key = rid or row.get("resort_place")
    if key in seen:
        continue
    seen.add(key)
    nicoles_deduped.append(row)

# Region hub coordinates for the Q4 coarse region grid / Chase-the-Snow origin chip
REGIONS = [
    {"id": "denver", "label": "Denver & the Rockies", "lat": 39.7392, "lon": -104.9903},
    {"id": "saltlake", "label": "Salt Lake & Utah", "lat": 40.7608, "lon": -111.8910},
    {"id": "seattle", "label": "Seattle & Portland", "lat": 47.2494, "lon": -122.4779},
    {"id": "bayarea", "label": "SF Bay Area", "lat": 37.7749, "lon": -122.4194},
    {"id": "socal", "label": "LA, SoCal & Vegas", "lat": 34.6, "lon": -117.0},
    {"id": "chicago", "label": "Chicago & the Midwest", "lat": 41.8781, "lon": -87.6298},
    {"id": "northeast", "label": "NYC, Boston & the Northeast", "lat": 42.0, "lon": -72.5},
    {"id": "midatlantic", "label": "DC & the Mid-Atlantic", "lat": 38.9072, "lon": -77.0369},
    {"id": "toronto", "label": "Toronto & Eastern Canada", "lat": 43.6532, "lon": -79.3832},
    {"id": "vancouver", "label": "Vancouver & Western Canada", "lat": 49.2827, "lon": -123.1207},
    {"id": "elsewhere", "label": "Somewhere else", "lat": None, "lon": None},
]

out = {
    "resorts": resorts,
    "nicolesList": nicoles_deduped,
    "regions": REGIONS,
}

outfile = os.path.join(BASE, "build", "src", "data.js")
with open(outfile, "w") as f:
    f.write("// Auto-generated by build/prep_data.py — do not hand-edit, regenerate instead.\n")
    f.write("const RESORTS = " + json.dumps(resorts, indent=None) + ";\n")
    f.write("const NICOLES_LIST = " + json.dumps(nicoles_deduped, indent=None) + ";\n")
    f.write("const REGIONS = " + json.dumps(REGIONS, indent=None) + ";\n")

print("Wrote", outfile)
print("Resorts:", len(resorts), "| with hot take:", take_count, "| Nicole's list rows (deduped):", len(nicoles_deduped))
print("Resorts missing coords:", len(missing))
