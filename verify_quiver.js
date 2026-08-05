#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_quiver.js — Quiver Check model + forecast-bucketing verification.
//
// Two halves:
//   1. A sweep of the recommendation model across every resort in the dataset
//      crossed with a grid of synthetic conditions, asserting the properties
//      the model is supposed to have rather than spot-checking outputs.
//   2. A test of noaa.js's new per-day bucketing against a synthetic
//      gridpoint response, because that code path involves timezone maths and
//      interval apportioning and is the most bug-prone thing added.
//
// Runs in plain node with no browser and no network — quiver.js is pure by
// design specifically so this is possible.
// ---------------------------------------------------------------------------
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = path.join(__dirname, "src");
let failures = 0;
let checks = 0;

function assert(cond, msg) {
  checks += 1;
  if (!cond) { failures += 1; console.error("  FAIL:", msg); }
}

function loadContext(extra) {
  const ctx = vm.createContext(Object.assign({ console, Intl, Date, Math, JSON, setTimeout, clearTimeout, AbortController }, extra || {}));
  for (const f of ["data.js", "icons.js", "engine.js", "noaa.js", "quiver.js"]) {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), "utf8"), ctx, { filename: f });
  }
  return ctx;
}

const ctx = loadContext();
const RESORTS = vm.runInContext("RESORTS", ctx);
const SKI_CALLS = vm.runInContext("SKI_CALLS", ctx);
const quiverCheck = vm.runInContext("quiverCheck", ctx);
const buildDayFrame = vm.runInContext("buildDayFrame", ctx);

// A mid-season date, so the early/spring overrides don't fire unless a test
// deliberately asks for them.
const MIDWINTER = new Date(2027, 0, 20, 12);

function makeDay(dateKey, snowIn, highF, slrTarget) {
  // precipIn is derived from the requested snow-to-liquid ratio so the
  // density path under test is the real one (the ratio), not the temperature
  // fallback.
  return {
    dateKey,
    snowIn,
    precipIn: slrTarget ? Math.round((snowIn / slrTarget) * 100) / 100 : 0,
    highF,
    lowF: highF - 12,
    isLive: true,
    hasData: true,
  };
}

function scenario(resort, { snow = 0, lead = [0, 0], highF = 22, slr = 10, now = MIDWINTER } = {}) {
  const frame = buildDayFrame(now, null, true);
  const keys = frame.map((d) => d.dateKey);
  const priorDays = lead.map((s, i) => makeDay(keys[i], s, highF, slr));
  const day = makeDay(keys[lead.length], snow, highF, slr);
  return quiverCheck(resort, day, priorDays, now);
}

const BAD_TOKENS = ["undefined", "NaN", "null", "[object", "{{", "Infinity", "Editorial judgment", "Sourced:", "in this dataset"];

function allStrings(result) {
  return [
    result.call.label, result.call.tagline, result.call.waistLabel, result.call.plain, result.call.ifYouDont,
    ...result.reasons, ...result.caveats,
    ...(result.aside ? [result.aside.label, result.aside.text] : []),
  ];
}

// ---------------------------------------------------------------------------
console.log("\n1. Shape and copy integrity across every resort × condition grid");
// ---------------------------------------------------------------------------
// Three dates, not one: the early-season and spring override branches are
// only reachable on a calendar that puts the resort near its own published
// open or close date, so a mid-January-only sweep would leave two of the
// model's five branches completely unexercised.
const DATES = [
  { label: "midwinter", now: MIDWINTER },
  { label: "early", now: new Date(2026, 10, 20, 12) },
  { label: "spring", now: new Date(2027, 3, 8, 12) },
];
const GRID = [];
for (const snow of [0, 1, 3, 6, 10, 14, 20, 30]) {
  for (const highF of [5, 18, 26, 33, 40, 46]) {
    for (const slr of [6, 10, 18]) {
      for (const d of DATES) {
        GRID.push({ snow, highF, slr, now: d.now, lead: [snow > 0 ? snow / 3 : 0, 0] });
      }
    }
  }
}
let cases = 0;
for (const resort of RESORTS) {
  for (const g of GRID) {
    const r = scenario(resort, g);
    cases += 1;
    if (!r.call) { assert(false, `${resort.id} ${JSON.stringify(g)} produced no call`); continue; }
    for (const s of allStrings(r)) {
      if (typeof s !== "string" || !s.length) { assert(false, `${resort.id}: empty string in output`); break; }
      for (const bad of BAD_TOKENS) {
        if (s.includes(bad)) { assert(false, `${resort.id} ${JSON.stringify(g)}: copy leaked "${bad}" -> ${s}`); break; }
      }
    }
    if (r.reasons.length < 2) assert(false, `${resort.id} ${JSON.stringify(g)}: only ${r.reasons.length} reason(s)`);
  }
}
console.log(`   ${cases} cases across ${RESORTS.length} resorts`);

// ---------------------------------------------------------------------------
console.log("\n2. Monotonicity — more snow never recommends a narrower ski");
// ---------------------------------------------------------------------------
for (const resort of RESORTS) {
  let prevRank = -1;
  let prevSnow = null;
  for (const snow of [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30]) {
    const r = scenario(resort, { snow, lead: [0, 0], highF: 22, slr: 10 });
    const rank = r.call.rank;
    if (rank == null) { prevSnow = snow; continue; } // rock-skis / bumps sit outside the width ladder
    if (prevRank !== -1 && rank < prevRank) {
      assert(false, `${resort.id}: ${prevSnow}" -> ${snow}" narrowed the call (${prevRank} -> ${rank})`);
    }
    prevRank = rank;
    prevSnow = snow;
  }
}
assert(true, "monotonic width sweep completed");

// ---------------------------------------------------------------------------
console.log("\n3. Density — light snow is never treated as needing less float than heavy");
// ---------------------------------------------------------------------------
for (const resort of RESORTS) {
  for (const snow of [8, 12, 18, 24]) {
    const blower = scenario(resort, { snow, lead: [0, 0], highF: 10, slr: 18 });
    const cement = scenario(resort, { snow, lead: [0, 0], highF: 30, slr: 6 });
    if (blower.call.rank != null && cement.call.rank != null) {
      assert(blower.call.rank >= cement.call.rank,
        `${resort.id} at ${snow}": light snow (${blower.call.label}) narrower than heavy (${cement.call.label})`);
    }
    assert(blower.conditions.floatScore > cement.conditions.floatScore,
      `${resort.id} at ${snow}": float score should be higher for lighter snow`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n4. Terrain — a day-trip hill never out-widths a deep-snow destination");
// ---------------------------------------------------------------------------
const dayTrip = RESORTS.filter((r) => r.scale === "day-trip");
const powHouse = RESORTS.filter((r) => (r.best_for_tags || []).includes("deep-powder") && (r.best_for_tags || []).includes("steeps"));
assert(dayTrip.length > 0 && powHouse.length > 0, "dataset contains both day-trip hills and deep-snow destinations");
for (const snow of [6, 10, 14, 20]) {
  for (const d of dayTrip) {
    for (const p of powHouse) {
      const dr = scenario(d, { snow, lead: [0, 0] });
      const pr = scenario(p, { snow, lead: [0, 0] });
      if (dr.call.rank != null && pr.call.rank != null) {
        assert(dr.call.rank <= pr.call.rank,
          `${snow}": day-trip ${d.id} (${dr.call.label}) wider than ${p.id} (${pr.call.label})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n5. Overrides fire only in their documented conditions");
// ---------------------------------------------------------------------------
for (const resort of RESORTS) {
  for (const g of GRID) {
    const r = scenario(resort, g);
    const c = r.conditions;
    if (r.call.id === "rock-skis") {
      assert(c.rainRisk || c.phase === "early",
        `${resort.id}: rock-skis called without rain risk or early season (${JSON.stringify(g)})`);
      assert(c.floatScore < 7, `${resort.id}: rock-skis called on a powder day (float ${c.floatScore})`);
    }
    if (r.call.id === "slush") {
      assert(c.phase === "spring" && c.highF >= 38,
        `${resort.id}: slush called outside spring/warm (${c.phase}, ${c.highF}F)`);
    }
    if (r.call.id === "bumps") {
      assert(c.dryStreak >= 2 && (c.phase === "mid" || c.phase === "spring"),
        `${resort.id}: bumps called without a visible dry streak in mid or spring season`);
      assert(c.floatScore < 2, `${resort.id}: bumps called on a soft-snow day (float ${c.floatScore})`);
      assert(r.caveats.some((t) => t.includes("inference")),
        `${resort.id}: a bump call must declare itself an inference`);
    }
    if (r.call.id === "pow-boats") {
      assert(c.floatScore >= 24, `${resort.id}: pow-boats below the float threshold (${c.floatScore})`);
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n6. No self-contradiction between the call and its own reasons");
// ---------------------------------------------------------------------------
// The bug class this guards against is the one already fixed once in this
// codebase (build-notes.md critical fix #2: Keystone rendering "Experts: a
// real strength" directly above Nicole's take saying it has no advanced
// terrain). Here the equivalent failure would be a groomer/rock-ski call
// sitting above a sentence about floating in deep snow.
const FLOAT_WORDS = ["rewards float", "float rather than", "stay up in fresh"];
for (const resort of RESORTS) {
  for (const g of GRID) {
    const r = scenario(resort, g);
    const narrow = ["skinny", "bumps", "rock-skis"].includes(r.call.id);
    if (!narrow) continue;
    for (const reason of r.reasons) {
      for (const w of FLOAT_WORDS) {
        assert(!reason.includes(w), `${resort.id}: "${r.call.label}" justified with float language -> ${reason}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n7. Honesty — the typical-season path never claims a measured ratio");
// ---------------------------------------------------------------------------
const historicalDailyForecast = vm.runInContext("historicalDailyForecast", ctx);
for (const resort of RESORTS.slice(0, 25)) {
  const fc = historicalDailyForecast(resort, MIDWINTER);
  assert(fc.isLive === false, `${resort.id}: historical forecast must be flagged not-live`);
  const uniq = new Set(fc.days.map((d) => d.snowIn));
  assert(uniq.size === 1, `${resort.id}: typical-season days must be flat, got ${uniq.size} distinct values`);
  const r = quiverCheck(resort, fc.days[3], fc.days.slice(0, 3), MIDWINTER);
  assert(r.caveats.some((t) => t.includes("typical snowfall for this time of year")),
    `${resort.id}: fallback path must carry the not-a-forecast caveat`);
  // The badge says "Not a live forecast"; no sentence underneath it may then
  // turn round and describe the same numbers as a forecast.
  for (const reason of r.reasons) {
    assert(!/\bforecast\b/i.test(reason),
      `${resort.id}: typical-season reason claims a forecast -> ${reason}`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n8. Lead-in honesty — a missing lead-in is declared, not assumed dry");
// ---------------------------------------------------------------------------
{
  const resort = RESORTS.find((r) => r.id === "alta-ut") || RESORTS[0];
  const frame = buildDayFrame(MIDWINTER, null, true);
  const today = quiverCheck(resort, makeDay(frame[0].dateKey, 4, 20, 12), [], MIDWINTER);
  assert(today.conditions.leadDaysObserved === 0, "day 0 has no observable lead-in");
  assert(today.caveats.some((t) => t.includes("only runs forward")),
    "a zero-day lead-in must be surfaced as a caveat");

  const later = quiverCheck(resort,
    makeDay(frame[3].dateKey, 4, 20, 12),
    [makeDay(frame[0].dateKey, 2, 20, 12), makeDay(frame[1].dateKey, 3, 20, 12), makeDay(frame[2].dateKey, 5, 20, 12)],
    MIDWINTER);
  assert(later.conditions.leadDaysObserved === 2, "a mid-window day sees a full 48h lead-in");
  assert(later.conditions.stormTotal === 12, `storm total should be 4+3+5=12, got ${later.conditions.stormTotal}`);
  assert(!later.caveats.some((t) => t.includes("only runs forward")),
    "a full lead-in must not carry the missing-lead-in caveat");
}

// ---------------------------------------------------------------------------
console.log("\n9. Crowd caveat fires on powder days at crowded resorts only");
// ---------------------------------------------------------------------------
{
  const brutal = RESORTS.filter((r) => r.crowd_level === "brutal");
  assert(brutal.length > 0, "dataset contains brutal-crowd resorts");
  for (const r of brutal) {
    const pow = scenario(r, { snow: 14, lead: [4, 0], slr: 15, highF: 15 });
    assert(pow.caveats.some((t) => t.includes("tracked out")), `${r.id}: expected a crowd caveat on a powder day`);
    const quiet = scenario(r, { snow: 0, lead: [0, 0], highF: 20 });
    assert(!quiet.caveats.some((t) => t.includes("tracked out")), `${r.id}: crowd caveat should not fire on a firm day`);
  }
}

// ---------------------------------------------------------------------------
console.log("\n10. NOAA per-day bucketing");
// ---------------------------------------------------------------------------
// A synthetic gridpoint response exercising the two things most likely to be
// wrong: intervals that straddle local midnight, and a non-UTC resort
// timezone. Denver is UTC-7, so a 6-hour block starting 21:00Z on the 20th
// runs 14:00–20:00 local on the 20th and belongs entirely to that day, while
// a block starting 03:00Z on the 21st runs 20:00 local on the 20th to 02:00
// local on the 21st and must split 4 hours / 2 hours across the two.
{
  const base = new Date("2027-01-20T21:00:00Z");
  const gridResponse = {
    properties: {
      snowfallAmount: {
        values: [
          { validTime: "2027-01-20T21:00:00+00:00/PT6H", value: 152.4 },   // 6" — all on the 20th local
          { validTime: "2027-01-21T03:00:00+00:00/PT6H", value: 152.4 },   // 6" — 4h on the 20th, 2h on the 21st
        ],
      },
      quantitativePrecipitation: {
        values: [{ validTime: "2027-01-20T21:00:00+00:00/PT6H", value: 15.24 }], // 0.6"
      },
      temperature: {
        values: [
          { validTime: "2027-01-20T21:00:00+00:00/PT6H", value: -10 },
          { validTime: "2027-01-21T03:00:00+00:00/PT6H", value: -18 },
        ],
      },
    },
  };
  const points = { properties: { gridId: "BOU", gridX: 10, gridY: 20, timeZone: "America/Denver" } };

  const fetchCtx = loadContext({
    fetch: async (url) => ({
      ok: true,
      json: async () => (String(url).includes("/points/") ? points : gridResponse),
    }),
  });
  const resort = vm.runInContext("RESORTS.find(r => r.id === 'vail-co')", fetchCtx);
  const fetchLiveDailyForecast = vm.runInContext("fetchLiveDailyForecast", fetchCtx);
  const localDayKey = vm.runInContext("localDayKey", fetchCtx);

  // Freeze "now" onto the synthetic storm so the 7-day frame contains it.
  const realNow = Date.now;
  vm.runInContext(`Date.now = () => ${base.getTime()};`, fetchCtx);
  const origDate = global.Date;
  class FrozenDate extends origDate {
    constructor(...args) { super(...(args.length ? args : [base.getTime()])); }
    static now() { return base.getTime(); }
  }
  fetchCtx.Date = FrozenDate;

  fetchLiveDailyForecast(resort).then((res) => {
    const d20 = res.days.find((d) => d.dateKey === localDayKey(base, "America/Denver"));
    assert(!!d20, "the storm day appears in the frame");
    if (d20) {
      // 6" fully on the 20th, plus 4 of the second block's 6 hours = 4".
      assert(Math.abs(d20.snowIn - 10) < 0.15, `expected ~10" on the storm day, got ${d20.snowIn}"`);
      assert(Math.abs(d20.precipIn - 0.6) < 0.02, `expected ~0.6" liquid, got ${d20.precipIn}"`);
      assert(d20.highF === 14, `expected a 14F high (-10C), got ${d20.highF}`);
      assert(d20.lowF === 0, `expected a 0F low (-18C), got ${d20.lowF}`);
    }
    const d21 = res.days.find((d) => d.dateKey === localDayKey(new Date(base.getTime() + 86400000), "America/Denver"));
    if (d21) assert(Math.abs(d21.snowIn - 2) < 0.15, `expected ~2" spilling into the next day, got ${d21.snowIn}"`);
    assert(res.isLive === true, "a successful live fetch is flagged live");
    assert(res.timeZone === "America/Denver", "the grid timezone is carried through");

    // ISO durations
    const parseIsoDurationHours = vm.runInContext("parseIsoDurationHours", fetchCtx);
    assert(parseIsoDurationHours("PT1H") === 1, "PT1H");
    assert(parseIsoDurationHours("PT6H") === 6, "PT6H");
    assert(parseIsoDurationHours("P1D") === 24, "P1D");
    assert(parseIsoDurationHours("P1DT6H") === 30, "P1DT6H");
    assert(parseIsoDurationHours("") === 1, "malformed duration defaults to 1h rather than 0");

    Date.now = realNow;
    finish();
  }).catch((e) => { assert(false, `bucketing test threw: ${e.stack || e}`); finish(); });
}

function finish() {
  // -------------------------------------------------------------------------
  console.log("\n11. Worked examples — sanity against how these days actually ski");
  // -------------------------------------------------------------------------
  const show = (rid, opts, note) => {
    const resort = RESORTS.find((r) => r.id === rid);
    if (!resort) { assert(false, `missing resort ${rid}`); return null; }
    const r = scenario(resort, opts);
    console.log(`   ${resort.name.padEnd(22)} ${String(opts.snow + '"').padStart(4)} @ ${String(opts.slr || 10) + ":1"}  ->  ${r.call.label.padEnd(17)} (float ${r.conditions.floatScore})   ${note}`);
    return r;
  };
  const a = show("alta-ut", { snow: 14, lead: [4, 0], slr: 18, highF: 12 }, "deep + cold + steeps");
  assert(a && a.call.id === "pow-boats", "Alta, 18\" of blower, should call for the widest ski");

  const b = show("mt-baker-wa", { snow: 18, lead: [4, 0], slr: 7, highF: 30 }, "deep but maritime and heavy");
  assert(b && b.call.id === "fatties", "Baker on a heavy 22\" is a fat-ski day, not a boat day");
  assert(b && b.caveats.some((t) => t.includes("Heavy snow is hard work")), "heavy deep snow should carry the stiffness note");

  const c = show("vail-co", { snow: 6, lead: [1, 0], slr: 12, highF: 18 }, "a normal storm day");
  assert(c && ["midfat", "fatties"].includes(c.call.id), "7\" at Vail should land mid-fat");

  const d = show("buck-hill-mn", { snow: 4, lead: [1, 0], slr: 10, highF: 20 }, "a Midwest day-trip hill");
  assert(d && ["daily", "midfat"].includes(d.call.id), "5\" at a 300-foot hill is not a fat-ski day");

  const e = show("killington-vt", { snow: 0, lead: [0, 0], highF: 24 }, "dry and firm");
  assert(e && ["skinny", "bumps"].includes(e.call.id), "a dry firm day should be narrow");

  const f = show("copper-mountain-co", { snow: 0, lead: [0, 0], highF: 46, now: new Date(2027, 3, 10, 12) }, "spring, 46F");
  assert(f && f.call.id === "slush", "a warm April day should be a spring-ski call");

  const g = show("keystone-co", { snow: 0, lead: [0, 0], highF: 20, now: new Date(2026, 10, 8, 12) }, "just-opened, thin cover");
  assert(g && g.call.id === "rock-skis", "opening week with no new snow should be a rock-ski call");

  const h = show("jackson-hole-wy", { snow: 2, lead: [8, 0], slr: 14, highF: 16 }, "storm ended before you got there");
  assert(h && h.conditions.stormTotal === 10, `expected a 10" storm total, got ${h && h.conditions.stormTotal}`);

  // Every call in the taxonomy should be reachable from real dataset inputs —
  // an unreachable call is dead copy that will never be reviewed.
  const reached = new Set();
  for (const resort of RESORTS) for (const opts of GRID) reached.add(scenario(resort, opts).call.id);
  for (const id of Object.keys(SKI_CALLS)) {
    assert(reached.has(id), `"${SKI_CALLS[id].label}" is unreachable from any modelled condition`);
  }
  console.log(`   all ${Object.keys(SKI_CALLS).length} calls reachable: ${Array.from(reached).sort().join(", ")}`);

  console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
}
