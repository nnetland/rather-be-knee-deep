// ---------------------------------------------------------------------------
// DEMO SNOW — an invented season, so the forecast-driven modes can be built
// and reviewed out of season.
//
// Why this exists. Chase the Snow and Quiver Check both read a live 7-day
// NOAA forecast. From roughly May to November there is nothing to read: every
// resort is closed, the app correctly refuses to rank or recommend, and both
// modes render an off-season screen. That is the right product behaviour and
// it makes the two most data-heavy features impossible to iterate on for half
// the year. Director's call, 2026-08-05: fill the dead window with an openly
// invented dataset rather than wait for winter.
//
// --- The rules this operates under -----------------------------------------
// R8 (data honesty) is the app's hardest constraint, so suspending it needs
// to be bounded, visible, and self-reversing. Three properties enforce that,
// and verify_demo.js asserts all three:
//
//   1. It only fills a gap it can't be wrong about. Demo mode activates
//      solely when the REAL calendar says the season is over — the one state
//      in which there is no true answer to displace. It never overrides a
//      live forecast, and it never replaces the honest typical-season
//      fallback during the season (Canada's tier, or a NOAA outage in
//      February, both still behave exactly as shipped).
//
//   2. It turns itself off. There is no flag to remember. Once enough of the
//      pool is open for classifySeasonState() to stop saying "off-season" —
//      around mid-November — DEMO.active() goes false on its own and the real
//      forecast path takes over untouched.
//
//   3. Nothing it generates can render unlabelled. Every value carries
//      `isDemo: true` alongside `isLive: false`, the app shows a persistent
//      banner on any screen using it, and each card carries its own badge.
//
// --- Why invented rather than last season's real numbers -------------------
// Real per-day history would be better and isn't reachable: NOAA's forecast
// API is forward-only, and the archives that do carry daily snowfall (NCEI,
// SNOTEL) aren't reachable from the build environment. So this is generated —
// but generated FROM the real dataset, not from nothing. Each resort's
// invented season is scaled to its own published annual snowfall, its own
// open/close window, its base elevation, its latitude, and the snow character
// of its region. Alta gets a deep, cold, high-ratio season; Baker gets a
// deeper, wetter, low-ratio one; Buck Hill gets a thin Midwestern one. That
// matters because the point is iterating on the models that read this data,
// and a model tuned against uniform noise is tuned against nothing.
//
// --- Removing this ---------------------------------------------------------
// Set DEMO_ENABLED to false, or delete this file and its token from
// assemble.py. Every call site is guarded by DEMO.active().
// ---------------------------------------------------------------------------

const DEMO_ENABLED = true;

// Where the clock sits when demo mode is on. Mid-January by default: deep
// enough into every resort's season that the season-phase logic reports
// "mid", which is the most useful default for iterating. The dev controls
// move this within the season; they can't move it outside it, because a demo
// date in August would just reproduce the off-season screen this exists to
// escape.
const DEMO_DEFAULT_DATE = "2027-01-20";
const DEMO_DATE_MIN = "2026-11-01";
const DEMO_DATE_MAX = "2027-05-31";

// Regional snow character. Snow-to-liquid ratio is the single most
// consequential thing about a snowpack for a ski recommendation — it's what
// separates blower from cement — and it varies by region far more than by
// resort. Continental interior snowpacks run dry and light; maritime ranges
// run heavy and wet; the Northeast and Midwest sit between. These are the
// real regional characters, applied by state or province.
const DEMO_SNOW_CHARACTER = {
  Utah: { slr: 17, variance: 3 },
  Colorado: { slr: 16, variance: 3 },
  Wyoming: { slr: 16, variance: 3 },
  Montana: { slr: 16, variance: 3 },
  Idaho: { slr: 15, variance: 3 },
  "New Mexico": { slr: 15, variance: 3 },
  Alberta: { slr: 16, variance: 3 },
  Washington: { slr: 9, variance: 2.5 },
  Oregon: { slr: 9, variance: 2.5 },
  California: { slr: 9, variance: 2.5 },
  Alaska: { slr: 12, variance: 3 },
  Vermont: { slr: 11, variance: 3 },
  "New Hampshire": { slr: 11, variance: 3 },
  Maine: { slr: 12, variance: 3 },
  Connecticut: { slr: 10, variance: 3 },
  Quebec: { slr: 12, variance: 3 },
  Minnesota: { slr: 13, variance: 3 },
  Michigan: { slr: 13, variance: 3 },
  Wisconsin: { slr: 13, variance: 3 },
  // BC spans both characters — the coast range is maritime, the interior
  // is famously dry. Split by resort below rather than by province.
  "British Columbia": { slr: 12, variance: 3 },
};
const DEMO_BC_INTERIOR = ["revelstoke-bc", "big-white-bc", "sun-peaks-bc", "fernie-bc", "kicking-horse-bc", "panorama-bc"];

// Forced conditions available from the dev controls. `null` means the
// resort's own generated season plays out untouched.
// `date` moves the clock along with the weather. Two of the ski model's
// branches are gated on where a day sits in the resort's own season, not on
// the weather alone — spring slush needs to be late in the season and thin
// cover needs to be early — so forcing warm temperatures in January produced
// a bump call rather than the slush the control promised. A control that
// doesn't produce the thing it names is worse than no control.
const DEMO_FORCE_MODES = [
  { id: null, label: "Off — use each resort's own invented season" },
  { id: "deep-cold", label: "Deep and cold", note: "A big, dry storm cycle" },
  { id: "heavy-wet", label: "Heavy and wet", note: "Maritime-style dense snow" },
  { id: "dry", label: "Dry spell", note: "Nothing falling, firm surface" },
  { id: "spring", label: "Spring slush", note: "Warm corn — also jumps to April", date: "2027-04-10" },
  { id: "thin", label: "Thin early season", note: "Barely open — also jumps to opening week", date: "2026-11-20" },
];

const DEMO = {
  date: DEMO_DEFAULT_DATE,
  force: null,
  _activeCache: null,

  /**
   * True only when the REAL calendar says nothing is open. Deliberately reads
   * `new Date()` and not appNow() — appNow() returns the demo date once demo
   * mode is on, so deriving activation from it would be circular and would
   * switch demo mode off the instant it switched on.
   */
  active() {
    if (!DEMO_ENABLED) return false;
    if (this._activeCache === null) {
      this._activeCache = classifySeasonState(RESORTS, new Date()).state === "off-season";
    }
    return this._activeCache;
  },

  /** The date the app should treat as today. */
  now() {
    if (!this.active()) return new Date();
    const [y, m, d] = this.date.split("-").map(Number);
    return new Date(y, m - 1, d, 10, 0, 0);
  },
};

/**
 * The clock every season-aware and forecast-aware code path reads, in place
 * of `new Date()`. Returns the real clock whenever demo mode is off, which is
 * every code path's normal behaviour and the shipped behaviour from November.
 */
function appNow() {
  return DEMO.now();
}

// --- Deterministic noise ---------------------------------------------------
// Every figure below has to be reproducible: a shared #quiver= link names a
// resort and a date, and re-derives its answer on arrival, so the same
// (resort, date) has to generate the same weather on someone else's phone
// tomorrow as it did here. That rules out Math.random() entirely — the
// randomness is hashed out of the inputs instead.
function demoHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A value in [0,1), stable for a given seed string.
function demoRand(seed) {
  const h = demoHash(seed);
  return (h % 100000) / 100000;
}

/**
 * Smooth storm-cycle noise over day-of-season. Three sine waves at
 * incommensurate periods (roughly 4, 9 and 23 days) with resort-specific
 * phases — which is what produces clustered storm cycles separated by dry
 * spells, rather than the uniform daily drizzle a flat random draw gives.
 * Real snowfall arrives in storms; a model being iterated against this data
 * needs to see that shape.
 */
function demoStormWave(resortId, dayOfSeason) {
  const p1 = demoRand(resortId + "|a") * Math.PI * 2;
  const p2 = demoRand(resortId + "|b") * Math.PI * 2;
  const p3 = demoRand(resortId + "|c") * Math.PI * 2;
  const t = dayOfSeason;
  return (
    0.55 * Math.sin((2 * Math.PI * t) / 9.3 + p1) +
    0.28 * Math.sin((2 * Math.PI * t) / 4.1 + p2) +
    0.34 * Math.sin((2 * Math.PI * t) / 23.7 + p3)
  );
}

// Storms only start once the wave clears this threshold, and intensity grows
// faster than linearly past it — so a season is mostly quiet days punctuated
// by a handful of real dumps, which is what a season actually looks like.
const DEMO_STORM_THRESHOLD = 0.18;
const DEMO_STORM_EXPONENT = 1.7;

function demoRawIntensity(resortId, dayOfSeason) {
  const wave = demoStormWave(resortId, dayOfSeason);
  if (wave <= DEMO_STORM_THRESHOLD) return 0;
  return Math.pow(wave - DEMO_STORM_THRESHOLD, DEMO_STORM_EXPONENT);
}

// --- Season geometry -------------------------------------------------------
// Resorts whose published open/close text doesn't parse fall back to a
// generic Dec-to-April window rather than being excluded — this is invented
// data, and an invented resort season is no less honest than an invented
// resort snowfall, so long as both are labelled.
const DEMO_FALLBACK_OPEN = { month: 11, day: 1 };   // 1 Dec
const DEMO_FALLBACK_CLOSE = { month: 3, day: 10 };  // 10 Apr

function demoSeasonWindow(resort) {
  const open = parseSeasonBoundary(resort.season_open) || DEMO_FALLBACK_OPEN;
  const close = parseSeasonBoundary(resort.season_close) || DEMO_FALLBACK_CLOSE;
  let openDay = shiftedSeasonDay(open.month, open.day);
  let closeDay = shiftedSeasonDay(close.month, close.day);
  if (closeDay <= openDay) {
    openDay = shiftedSeasonDay(DEMO_FALLBACK_OPEN.month, DEMO_FALLBACK_OPEN.day);
    closeDay = shiftedSeasonDay(DEMO_FALLBACK_CLOSE.month, DEMO_FALLBACK_CLOSE.day);
  }
  return { openDay, closeDay, length: closeDay - openDay };
}

// Scale factor that makes a resort's generated season sum to its own
// published annual snowfall. Computed once per resort and memoised — it's a
// ~180-iteration loop and both modes call into this for every resort on
// every render.
const _demoScaleCache = {};
function demoSeasonScale(resort) {
  if (_demoScaleCache[resort.id] != null) return _demoScaleCache[resort.id];
  const { length } = demoSeasonWindow(resort);
  let raw = 0;
  for (let d = 0; d <= length; d++) raw += demoRawIntensity(resort.id, d);
  // 5 of 71 resorts publish no annual figure; 180" is an unremarkable
  // North American season and keeps them in the demo rather than blank.
  const annual = resort.avg_annual_snowfall_in != null ? resort.avg_annual_snowfall_in : 180;
  _demoScaleCache[resort.id] = raw > 0 ? annual / raw : 0;
  return _demoScaleCache[resort.id];
}

function demoSlrFor(resort, dayOfSeason) {
  let character = DEMO_SNOW_CHARACTER[resort.state_province] || { slr: 12, variance: 3 };
  if (DEMO_BC_INTERIOR.includes(resort.id)) character = { slr: 16, variance: 3 };
  // Storms swing either side of the regional mean, and late-season storms
  // run wetter as the pack warms.
  const swing = (demoRand(resort.id + "|slr|" + dayOfSeason) - 0.5) * 2 * character.variance;
  return Math.max(4, character.slr + swing);
}

/**
 * Mid-winter daytime high for a resort, from base elevation and latitude.
 * An approximation of a lapse rate, not a climatology — but it does put a
 * 10,000-foot Colorado base well below a 900-foot Minnesota hill, which is
 * the distinction the ski-type model actually reads.
 */
function demoMidwinterHigh(resort) {
  const base = resort.base_elevation_ft != null ? resort.base_elevation_ft : 5000;
  const lat = resort.lat != null ? resort.lat : 44;
  return clamp(42 - (base / 1000) * 1.15 - (lat - 38) * 0.4, 6, 38);
}

// Temperature offset by how far through the season a day sits: mild at
// opening, coldest around the 40% mark, climbing steeply through spring.
// This is what makes the spring-slush and thin-early-season branches of the
// ski model reachable from the demo data instead of theoretical.
function demoSeasonalTempOffset(progress) {
  if (progress < 0.4) return 6 - (15 * progress) / 0.4;
  return -9 + (30 * (progress - 0.4)) / 0.6;
}

/**
 * The whole point: one resort, one calendar day, one invented forecast.
 * Deterministic in (resort.id, date). Returns the same shape noaa.js's real
 * per-day path returns, plus `isDemo: true`.
 */
function demoDayFor(resort, date) {
  const { openDay, closeDay, length } = demoSeasonWindow(resort);
  const day = shiftedSeasonDay(date.getMonth(), date.getDate());
  const inSeason = day >= openDay && day <= closeDay;
  const dayOfSeason = day - openDay;
  const progress = length > 0 ? clamp((day - openDay) / length, 0, 1) : 0.5;

  let snowIn = inSeason ? demoRawIntensity(resort.id, dayOfSeason) * demoSeasonScale(resort) : 0;
  let slr = demoSlrFor(resort, dayOfSeason);
  let highF = demoMidwinterHigh(resort) + demoSeasonalTempOffset(progress)
    + (demoRand(resort.id + "|t|" + dayOfSeason) - 0.5) * 12;

  // Overcast storm days run warmer than clear ones — a small effect, but it
  // keeps storm days from reading implausibly cold.
  if (snowIn > 1) highF += 3;

  const forced = DEMO.force;
  if (forced === "deep-cold") {
    snowIn = 6 + demoRand(resort.id + "|f1|" + dayOfSeason) * 16;
    slr = 17 + demoRand(resort.id + "|f2|" + dayOfSeason) * 4;
    highF = demoMidwinterHigh(resort) - 12;
  } else if (forced === "heavy-wet") {
    snowIn = 8 + demoRand(resort.id + "|f3|" + dayOfSeason) * 16;
    slr = 6 + demoRand(resort.id + "|f4|" + dayOfSeason) * 2.5;
    highF = 31;
  } else if (forced === "dry") {
    snowIn = 0;
    highF = demoMidwinterHigh(resort) - 6;
  } else if (forced === "spring") {
    snowIn = demoRand(resort.id + "|f5|" + dayOfSeason) < 0.8 ? 0 : 1;
    highF = 44 + demoRand(resort.id + "|f6|" + dayOfSeason) * 8;
    slr = 6;
  } else if (forced === "thin") {
    snowIn = demoRand(resort.id + "|f7|" + dayOfSeason) * 2;
    highF = demoMidwinterHigh(resort) + 2;
  }

  snowIn = Math.round(snowIn * 10) / 10;
  const precipIn = Math.round((snowIn / slr) * 100) / 100;
  highF = Math.round(highF);

  return {
    dateKey: demoDateKey(date),
    snowIn,
    precipIn,
    highF,
    lowF: highF - 11,
    isLive: false,
    isDemo: true,
    hasData: true,
  };
}

function demoDateKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Seven invented days from `now`, in noaa.js's per-day frame shape. */
function demoDailyForecast(resort, now) {
  now = now || appNow();
  const days = [];
  for (let i = 0; i < QUIVER_HORIZON_DAYS; i++) {
    days.push(demoDayFor(resort, new Date(now.getTime() + i * 86400000)));
  }
  return { days, timeZone: null, isLive: false, isDemo: true };
}

/** The 7-day aggregate shape Chase the Snow ranks on. */
function demoAggregateForecast(resort, now) {
  const { days } = demoDailyForecast(resort, now);
  const totalInches = Math.round(days.reduce((s, d) => s + d.snowIn, 0) * 10) / 10;
  const temps = days.map((d) => d.highF).filter((t) => t != null);
  return {
    totalInches,
    avgTempF: temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
    isLive: false,
    isDemo: true,
    sawSnowPeriod: days.some((d) => d.snowIn > 0),
  };
}

/**
 * Season-state classification that both modes call in place of
 * classifySeasonState(). Identical when demo mode is off. When it's on, it
 * classifies against the demo date — so setting the control to early November
 * correctly produces the shoulder-season screen rather than being papered
 * over, which is the point of being able to move the date at all.
 */
function effectiveSeasonState(pool, now) {
  return classifySeasonState(pool, now || appNow());
}

// ---------------------------------------------------------------------------
// Demo chrome — banner, per-card badge, and the dev controls.
//
// All of it lives in this file so the whole feature can be removed by
// deleting one file and one token from assemble.py. The only hooks anywhere
// else are `syncDemoChrome()` (called from render()) and `demoFreshnessHtml()`
// (called from the two modes' freshness badges), both guarded by
// DEMO.active().
// ---------------------------------------------------------------------------

/**
 * The per-card badge. Deliberately reuses `.freshness-badge--fallback`, which
 * already carries the app's "this is not live data" visual language — an
 * outlined, warm-toned pill with an icon, verified for contrast on both
 * backgrounds (M4 fix) and readable without relying on colour (R12). A demo
 * badge is a stronger claim than a fallback badge, not a different kind of
 * one, so it inherits the treatment and sharpens the words.
 */
function demoFreshnessHtml() {
  return `<div class="freshness-badge freshness-badge--fallback freshness-badge--demo">
      <span aria-hidden="true">${ICONS.warning}</span>
      <span class="freshness-badge__text body-sm">Demo data · invented, not a forecast</span>
    </div>`;
}

function demoBannerHtml() {
  const forceLabel = (DEMO_FORCE_MODES.find((m) => m.id === DEMO.force) || DEMO_FORCE_MODES[0]).label;
  return `
    <div class="demo-banner__bar">
      <span class="demo-banner__icon" aria-hidden="true">${ICONS.warning}</span>
      <p class="demo-banner__text">
        <strong>Demo snow.</strong> Snow forecasts are invented while the season is out — no number here describes real weather.
        Trip planning and Nicole's list are unaffected.
      </p>
      <button type="button" class="demo-banner__toggle" id="demo-controls-toggle"
              aria-expanded="false" aria-controls="demo-controls-panel">Controls</button>
    </div>
    <div class="demo-banner__panel" id="demo-controls-panel" hidden>
      <div class="demo-field">
        <label class="data-label" for="demo-date">Date</label>
        <input type="date" id="demo-date" class="demo-input"
               value="${DEMO.date}" min="${DEMO_DATE_MIN}" max="${DEMO_DATE_MAX}">
        <p class="body-sm demo-field__note">Bounded to the season — a date outside it would just reproduce the off-season screen this exists to get past.</p>
      </div>
      <fieldset class="demo-field">
        <legend class="data-label">Force conditions</legend>
        <p class="visually-hidden">Overrides every resort's generated weather with the same condition, so a specific screen can be reached directly.</p>
        ${DEMO_FORCE_MODES.map((m) => `
          <label class="demo-radio">
            <input type="radio" name="demo-force" value="${m.id == null ? "" : m.id}" ${DEMO.force === m.id ? "checked" : ""}>
            <span>${escapeHtml(m.label)}${m.note ? ` <span class="demo-radio__note">— ${escapeHtml(m.note)}</span>` : ""}</span>
          </label>`).join("")}
      </fieldset>
      <p class="body-sm demo-field__note">Currently: <strong>${escapeHtml(DEMO.date)}</strong>, ${escapeHtml(forceLabel.toLowerCase())}.</p>
    </div>`;
}

/**
 * Called from render() on every route change. The banner shows on every
 * screen rather than only the two that read forecasts: a visitor who lands on
 * the trip planner and then taps into Chase the Snow should already know what
 * they're looking at, and the wording names exactly which parts are affected
 * so the banner can't be read as casting doubt on the planner's real data.
 */
function syncDemoChrome() {
  const el = document.getElementById("demo-banner");
  if (!el) return;
  if (!DEMO.active()) { el.hidden = true; el.innerHTML = ""; return; }
  const wasOpen = !!(document.getElementById("demo-controls-panel") && !document.getElementById("demo-controls-panel").hidden);
  el.hidden = false;
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Demo data notice");
  el.innerHTML = demoBannerHtml();
  document.body.classList.add("has-demo-banner");
  wireDemoControls(wasOpen);
}

function wireDemoControls(reopen) {
  const toggle = document.getElementById("demo-controls-toggle");
  const panel = document.getElementById("demo-controls-panel");
  if (!toggle || !panel) return;

  if (reopen) { panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); }
  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  });

  const dateInput = document.getElementById("demo-date");
  dateInput.addEventListener("change", () => {
    const v = dateInput.value;
    if (!v || v < DEMO_DATE_MIN || v > DEMO_DATE_MAX) { dateInput.value = DEMO.date; return; }
    DEMO.date = v;
    demoInvalidate();
  });

  document.querySelectorAll('input[name="demo-force"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      DEMO.force = radio.value || null;
      const mode = DEMO_FORCE_MODES.find((m) => m.id === DEMO.force);
      if (mode && mode.date) DEMO.date = mode.date;
      demoInvalidate();
    });
  });
}

/**
 * Both modes cache their resolved forecasts, so changing the date or the
 * forced condition has to drop those caches or the screen keeps rendering the
 * previous invented week. The generator's own per-resort scale cache is NOT
 * cleared: it's a function of the resort's published annual snowfall and
 * season length only, and depends on neither control.
 */
function demoInvalidate() {
  state.chaseCache = null;
  state.chaseLoadHandle = null;
  state.quiverForecast = null;
  if (state.route === "quiver" && state.quiver.step === "result" && state.quiver.resortId) {
    prefetchQuiverForecast(state.quiver.resortId);
  }
  render();
}
