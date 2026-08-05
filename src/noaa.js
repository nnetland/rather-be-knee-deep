// ---------------------------------------------------------------------------
// NOAA / National Weather Service integration — api.weather.gov.
// Built fallback-first per the build brief: the historical-average path is
// complete and correct on its own, and the app is fully usable with the
// network unavailable. The live path is layered on top and can fail at any
// point without ever presenting historical data as if it were live.
//
// Flow (per scope-revision-1 / strategy.md §4): /points/{lat},{lon} resolves
// a coordinate to a forecast office + grid cell, then
// /gridpoints/{office}/{x},{y}/forecastGridData returns time-stamped periods
// including snowfallAmount (millimetres) and temperature. 7-day horizon.
//
// Fix round, 2026-08-04 — root-caused why the live path never worked in
// production (Director-reported, confirmed by NWS maintainers:
// https://github.com/weather-gov/api/discussions/312): setting a custom
// `User-Agent` in a browser `fetch()` triggers a CORS preflight, and
// api.weather.gov's preflight response doesn't allow-list `User-Agent`, so
// every request failed before it ever reached the API. NWS's own guidance is
// that the descriptive-User-Agent recommendation is for server-side callers
// only — browser code should omit it and let the browser set its own
// default, which is exactly what this module now does. `Accept:
// application/geo+json` is dropped too: it's CORS-safelisted so it wasn't
// the cause, but the API returns GeoJSON by default and a bare, header-free
// fetch removes all preflight risk rather than just the confirmed one. This
// is now believed-correct against NWS's documented behavior, not just
// theoretically fixed — see build-notes.md for what this environment could
// and couldn't verify directly (sandbox egress to api.weather.gov is still
// blocked here, so the live response shape itself remains unconfirmed).
// ---------------------------------------------------------------------------

const NOAA_BASE = "https://api.weather.gov";
const NOAA_TIMEOUT_MS = 9000; // leaves headroom under the 10s hard fallback in the UI layer

function mmToInches(mm) { return mm / 25.4; }

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Season-window awareness (fix round, 2026-08-04). historicalEstimate() used
// to compute `annual / 18` regardless of the calendar, which meant an August
// lookup reported a mid-winter weekly average (e.g. "35.6 inches" for Mt.
// Baker) as if it were typical for right now — actively wrong, and exactly
// the kind of thing Principle 3 (never misrepresent data) exists to catch.
// This section makes the estimate season-aware using each resort's own
// `season_open`/`season_close` fields (see research/resorts-schema.md), so
// the weekly figure ramps toward zero outside the resort's own published
// season instead of reporting a flat annual/18 all year round.
// ---------------------------------------------------------------------------

const SEASON_MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const SEASON_PART_DAY = { early: 5, mid: 15, late: 25 };
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function dayOfYear(month, day) {
  let d = day - 1;
  for (let m = 0; m < month; m++) d += MONTH_LENGTHS[m];
  return d;
}
// Ski seasons run roughly Oct/Nov -> Apr/Jun, which straddles the Jan 1 year
// boundary. Anchoring "day zero" at July 1 (deep off-season for every
// Northern-hemisphere resort in this dataset) keeps every real resort's
// open->close window as one ordinary, non-wrapping range of numbers, which
// is what keeps the comparisons below plain arithmetic instead of modular
// edge-case handling.
const SEASON_ANCHOR_DOY = dayOfYear(6, 1); // July 1
function shiftedSeasonDay(month, day) {
  return (dayOfYear(month, day) - SEASON_ANCHOR_DOY + 365) % 365;
}

/**
 * Parses a resort's `season_open`/`season_close` free-text field (e.g.
 * "Mid-Nov", "Late Apr/early May", "Early Dec (snow-dependent; no
 * snowmaking)", "Year-round on the Palmer snowfield (seasonal closures
 * vary)") by matching the first "{Early|Mid|Late} {Month}" it contains.
 * Returns null when the text doesn't contain one — deliberately: rather than
 * guess at a date from prose the schema doesn't structure that way, callers
 * fall back to *not* applying the seasonal discount for that one resort
 * instead of inventing a boundary. (Only 6 of 71 resorts have this kind of
 * free-text suffix/prefix; all 6 still parse cleanly because the
 * "{part} {month}" pattern is always the leading, well-formed part of the
 * string — see build-notes.md for the audited list.)
 */
function parseSeasonBoundary(text) {
  if (!text) return null;
  const m = /(early|mid|late)[\s-]+([a-z]{3,})/i.exec(text);
  if (!m) return null;
  const monthKey = m[2].slice(0, 3).toLowerCase();
  if (!(monthKey in SEASON_MONTH_INDEX)) return null;
  return { month: SEASON_MONTH_INDEX[monthKey], day: SEASON_PART_DAY[m[1].toLowerCase()] };
}

// ~3 weeks either side of the published open/close date — keeps the
// shoulder months (October, May) a gradient between "typical mid-winter
// figure" and "zero" rather than a hard flip on a single calendar day, per
// the fix brief's explicit boundary requirement.
const SEASON_RAMP_DAYS = 21;

/**
 * Returns 0..1: how "in typical season" `now` is for this resort. 1 = inside
 * the resort's own published open/close window. 0 = well outside it (the
 * case this fix exists for — e.g. August, months after the prior season
 * closed and months before the next one opens). Ramps linearly through
 * SEASON_RAMP_DAYS on either side of open/close. Falls back to 1 (no
 * discount, i.e. the old always-on behavior) when either boundary can't be
 * confidently parsed, or when the parsed window is nonsensical (close <=
 * open) — never guesses at a date it doesn't have.
 */
function seasonFraction(resort, now) {
  now = now || new Date();
  const open = parseSeasonBoundary(resort.season_open);
  const close = parseSeasonBoundary(resort.season_close);
  if (!open || !close) return 1;
  const openDay = shiftedSeasonDay(open.month, open.day);
  const closeDay = shiftedSeasonDay(close.month, close.day);
  if (closeDay <= openDay) return 1;
  const nowDay = shiftedSeasonDay(now.getMonth(), now.getDate());
  if (nowDay >= openDay && nowDay <= closeDay) return 1;
  if (nowDay < openDay) {
    const distance = openDay - nowDay;
    return distance <= SEASON_RAMP_DAYS ? 1 - distance / SEASON_RAMP_DAYS : 0;
  }
  const distance = nowDay - closeDay;
  return distance <= SEASON_RAMP_DAYS ? 1 - distance / SEASON_RAMP_DAYS : 0;
}

/**
 * Historical / typical-season estimate for a resort — always available,
 * works fully offline, and is what the UI falls back to whenever the live
 * path fails for any reason. Never claims to be a forecast: callers must
 * label it via the `isLive: false` flag, per the brief's integrity rule.
 *
 * Distributes the resort's published average annual snowfall across a
 * "typical" 7-day window during the core season, scaled by `seasonFraction`
 * so the figure is honest about *when* "typical" is — outside the resort's
 * own season this returns at or near zero instead of a mid-winter average,
 * and estimates a plausible average temperature from elevation/region —
 * clearly an estimate, never presented to the user as more precise than
 * "typical for this time of year."
 */
function historicalEstimate(resort, now) {
  const annual = resort.avg_annual_snowfall_in;
  const factor = seasonFraction(resort, now);
  // A typical in-season week runs ~18-20 storm-active weeks; distribute
  // unevenly so it isn't a flat, suspiciously round weekly figure. `factor`
  // is what keeps this honest outside the season window (see above).
  const weeklyShare = (annual != null ? annual / 18 : 8) * factor;
  const baseElev = resort.base_elevation_ft || 6000;
  // Rough elevation-based temperature estimate (higher = colder), clamped to
  // a plausible mid-winter range — an estimate, not a measurement. Not
  // season-scaled: nothing in the UI displays this raw value to a reader
  // (see build-notes.md), it only feeds the internal cold/wet snow-quality
  // descriptor for resorts that already cleared the season-window check.
  const avgTempF = clamp(32 - (baseElev / 1000) * 1.1, 5, 30);
  return {
    totalInches: Math.round(weeklyShare * 10) / 10,
    avgTempF: Math.round(avgTempF),
    isLive: false,
    seasonFraction: factor,
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Per-resort fraction at/above which a resort counts as "meaningfully open"
// for season-state purposes — either fully in-season (1) or more than
// halfway through its pre-season ramp (i.e. within ~10 days of its
// published open date, likely already open in practice).
const SEASON_OPEN_FRACTION = 0.5;
// Aggregate thresholds (share of the US pool that's "meaningfully open")
// used to classify the whole Chase-the-Snow screen's state. Tuned against
// the real 71-resort dataset's actual open/close spread — see
// build-notes.md for the day-by-day sweep that produced these numbers.
const SEASON_STATE_OFF_MAX = 0.10;
const SEASON_STATE_IN_MIN = 0.70;

/**
 * Classifies "right now" against the full US resort pool's typical season
 * windows, independent of whether the live NOAA fetch is reachable — this is
 * a calendar judgment, not a network one, so it runs before any forecast
 * fetch is attempted:
 *   - "off-season": ~everything is closed for the calendar year (e.g.
 *     August) — Chase-the-Snow shouldn't render a ranked list at all.
 *   - "shoulder": some resorts are open, most aren't (October, May) —
 *     render a filtered, honestly-labeled list of just the plausibly-open
 *     resorts.
 *   - "in-season": the normal case — render the full ranked list as before.
 */
function classifySeasonState(pool, now) {
  now = now || new Date();
  const resorts = (pool || []).filter((r) => r.country === "USA" && r.lat != null);
  if (!resorts.length) return { state: "in-season", openShare: 1, avgFraction: 1 };
  let sum = 0, openCount = 0;
  for (const r of resorts) {
    const f = seasonFraction(r, now);
    sum += f;
    if (f >= SEASON_OPEN_FRACTION) openCount += 1;
  }
  const avgFraction = sum / resorts.length;
  const openShare = openCount / resorts.length;
  let state = "shoulder";
  if (openShare <= SEASON_STATE_OFF_MAX) state = "off-season";
  else if (openShare >= SEASON_STATE_IN_MIN) state = "in-season";
  return { state, openShare, avgFraction };
}

/**
 * Attempts the live NOAA chain for one resort. Throws on any failure —
 * callers must catch and fall back. Never silently returns partial/guessed
 * data dressed up as live.
 */
async function fetchLiveForecast(resort) {
  if (resort.lat == null || resort.lon == null) {
    throw new Error("no coordinates — forecast unavailable for this resort");
  }
  // No custom headers on the browser fetch path, deliberately — see the
  // module header comment. A bare fetch (browser sets its own User-Agent,
  // no Accept override) avoids the CORS preflight that was silently failing
  // every live request in production.

  const pointsRes = await fetchWithTimeout(
    `${NOAA_BASE}/points/${resort.lat.toFixed(4)},${resort.lon.toFixed(4)}`,
    {}, NOAA_TIMEOUT_MS
  );
  if (!pointsRes.ok) throw new Error(`NOAA /points failed: ${pointsRes.status}`);
  const points = await pointsRes.json();
  const { gridId, gridX, gridY } = points.properties || {};
  if (!gridId || gridX == null || gridY == null) throw new Error("NOAA /points missing grid info");

  const gridRes = await fetchWithTimeout(
    `${NOAA_BASE}/gridpoints/${gridId}/${gridX},${gridY}/forecastGridData`,
    {}, NOAA_TIMEOUT_MS
  );
  if (!gridRes.ok) throw new Error(`NOAA /gridpoints failed: ${gridRes.status}`);
  const grid = await gridRes.json();

  const props = grid.properties || {};
  const snowfallValues = (props.snowfallAmount && props.snowfallAmount.values) || [];
  const tempValues = (props.temperature && props.temperature.values) || [];

  const now = Date.now();
  const horizon = now + 7 * 24 * 60 * 60 * 1000;

  let totalMm = 0;
  let sawSnowPeriod = false;
  for (const period of snowfallValues) {
    const start = Date.parse((period.validTime || "").split("/")[0]);
    if (Number.isNaN(start) || start < now || start > horizon) continue;
    totalMm += period.value || 0;
    if ((period.value || 0) > 0) sawSnowPeriod = true;
  }

  let tempSum = 0, tempCount = 0;
  for (const period of tempValues) {
    const start = Date.parse((period.validTime || "").split("/")[0]);
    if (Number.isNaN(start) || start < now || start > horizon) continue;
    if (period.value == null) continue;
    tempSum += celsiusToF(period.value);
    tempCount += 1;
  }

  return {
    totalInches: Math.round(mmToInches(totalMm) * 10) / 10,
    avgTempF: tempCount ? Math.round(tempSum / tempCount) : null,
    isLive: true,
    sawSnowPeriod,
  };
}

function celsiusToF(c) { return (c * 9) / 5 + 32; }

/**
 * Best-effort classification of a fetch failure into something a human can
 * act on, since the browser deliberately hides the real reason a cross-
 * origin request failed (a CORS rejection and a plain network outage both
 * surface to JS as the same opaque `TypeError: Failed to fetch` — that
 * ambiguity is exactly what left the Director unable to tell "CORS is
 * blocking us" from "no snow" in production). This can't recover the
 * specific reason the browser withheld, but it does distinguish the cases
 * we *can* tell apart (timeout vs. an HTTP error status vs. everything
 * else) and names the CORS possibility explicitly so it's the first thing
 * a developer checks, not a guess they have to arrive at independently.
 */
function classifyFetchError(err) {
  if (err && err.name === "AbortError") return "timeout";
  if (err && /^NOAA \/(points|gridpoints) failed: \d+/.test(err.message || "")) return "http-error";
  if (err instanceof TypeError) return "network-or-cors";
  return "unknown";
}

/**
 * Resolves a forecast for one resort: tries the live path, falls back to the
 * historical estimate on any failure. Always resolves (never rejects) so
 * callers can build a full ranked list even when every live call fails.
 *
 * Every failure is logged via console.warn with the resort id, the best
 * guess at *why* (timeout / HTTP error / likely network-or-CORS), and the
 * raw error message — retrievable from devtools even though the UI itself
 * only ever shows the honest, generic "couldn't reach the live forecast"
 * copy (per fallback.forecast.body, which deliberately doesn't name a
 * specific technical cause to the end user).
 */
async function resolveForecast(resort) {
  try {
    const live = await fetchLiveForecast(resort);
    return live;
  } catch (err) {
    const reason = classifyFetchError(err);
    console.warn(`[NOAA live forecast failed] resort=${resort.id} reason=${reason} message=${(err && err.message) || err}`);
    return { ...historicalEstimate(resort), fallbackReason: err.message };
  }
}

/**
 * Resolves forecasts for a set of US resorts with the UI-facing timing model
 * from motion-spec.md §4.1: no loader before 300ms, "still checking" copy at
 * 4s, hard fallback (historical data for anything still pending) at 10s.
 *
 * onState receives 'loading' | 'escalated' | 'fallback' | 'done' and, on
 * done, the resolved { [resortId]: forecast } map plus whether *any* resort
 * fell back (used to decide whether the fallback badge renders at all).
 */
/**
 * Returns a handle `{ skip() }` in addition to driving `onState`. `skip()`
 * lets the UI layer offer a manual "show typical-season data now" escape
 * once the escalated (4s) state is reached, rather than forcing every user
 * to ride out the full 10s hard timeout — the worst-case wait lands
 * precisely on the poor-connectivity conditions Jordan and Nicole are
 * defined by, for the one mode built around "an answer in three seconds"
 * (heuristic-evaluation.md, H1/H3/H7 major finding). The historical data
 * `skip()` falls back to is always already sitting there — it's the same
 * data the 10s hard timeout would have produced anyway, just returned on
 * request instead of on a clock.
 */
function loadChaseForecasts(resorts, onState) {
  const results = {};
  let settled = 0;
  let anyFallback = false;
  const total = resorts.length;
  let done = false;

  const loadingTimer = setTimeout(() => { if (!done) onState("loading"); }, 300);
  const escalateTimer = setTimeout(() => { if (!done) onState("escalated"); }, 4000);

  function fallBackNow() {
    if (done) return;
    // Anything still unresolved gets the historical estimate immediately
    // rather than waiting further — used by both the 10s hard timeout and
    // the user-triggered skip() escape.
    for (const r of resorts) {
      if (!(r.id in results)) {
        results[r.id] = historicalEstimate(r);
        results[r.id].fallbackReason = "timed out";
        anyFallback = true;
      }
    }
    finish();
  }

  const hardTimer = setTimeout(fallBackNow, 10000);

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(loadingTimer);
    clearTimeout(escalateTimer);
    clearTimeout(hardTimer);
    onState("done", { forecasts: results, anyFallback });
  }

  if (!total) { finish(); return { skip: () => {} }; }

  for (const resort of resorts) {
    resolveForecast(resort).then((forecast) => {
      results[resort.id] = forecast;
      if (!forecast.isLive) anyFallback = true;
      settled += 1;
      if (settled === total) finish();
    });
  }

  return { skip: fallBackNow };
}

// ---------------------------------------------------------------------------
// Per-day forecast — added for Quiver Check.
//
// Everything above this line answers "how much snow over the next 7 days, in
// total" — which is the right shape for ranking a list of resorts, and the
// wrong shape for "what should I ride at Alta on Thursday." That question
// needs the week broken into days, and it needs two fields the ranking path
// never asked for: liquid-equivalent precipitation (so quiver.js can compute
// a real snow-to-liquid ratio rather than inferring density from temperature
// alone) and a per-day high/low.
//
// This is additive on purpose. The Chase-the-Snow path above is verified and
// shipped; nothing here changes it, and the two share the same fetch chain,
// the same timeout discipline and the same never-present-history-as-forecast
// rule.
// ---------------------------------------------------------------------------

const QUIVER_HORIZON_DAYS = 7;

// NWS gridpoint values are UTC-stamped, but "Thursday" means Thursday at the
// mountain. `/points` hands back the grid's IANA timezone in the same
// response we already read gridId/gridX/gridY from, so bucketing by local
// calendar day costs one extra field and no extra request. 'en-CA' is used
// purely because it formats as YYYY-MM-DD.
function localDayKey(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  } catch (e) {
    // An unrecognised timezone must not take the whole forecast down with
    // it — fall back to the viewer's own local day.
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }
}

// ISO-8601 durations, as they actually appear in gridpoint validTime strings
// ("PT1H", "PT6H", "P1D", "P1DT6H"). Returns hours.
function parseIsoDurationHours(dur) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(dur || "");
  if (!m) return 1;
  const days = Number(m[1] || 0), hours = Number(m[2] || 0), mins = Number(m[3] || 0);
  const total = days * 24 + hours + mins / 60;
  return total > 0 ? total : 1;
}

/**
 * Walks a gridpoint value series and hands each hour of every interval to
 * `visit(date, value, hours)`.
 *
 * Intervals in a gridpoint response are commonly 1h or 6h but run longer at
 * the far end of the horizon, and they do not align to local midnight — a
 * 6-hour block straddling midnight belongs partly to each day. Stepping
 * hour-by-hour and letting the caller apportion is what keeps a storm from
 * being credited entirely to whichever day its interval happened to start
 * in, which for a chosen-day feature is the difference between "18 inches on
 * your day" and "18 inches the day before you arrive."
 */
function eachForecastHour(values, visit) {
  for (const period of values || []) {
    const [startStr, durStr] = String(period.validTime || "").split("/");
    const start = Date.parse(startStr);
    if (Number.isNaN(start) || period.value == null) continue;
    const hours = parseIsoDurationHours(durStr);
    const steps = Math.max(1, Math.round(hours));
    for (let h = 0; h < steps; h++) {
      visit(new Date(start + h * 3600000), period.value, steps);
    }
  }
}

function emptyDay(dateKey, isLive) {
  return { dateKey, snowIn: 0, precipIn: 0, highF: null, lowF: null, isLive, hasData: false };
}

/**
 * Live per-day forecast for one resort. Same two-request chain as
 * fetchLiveForecast() above, same bare header-free fetch (see this module's
 * header for why any custom header breaks the browser path), and it throws
 * on any failure so callers must fall back rather than receive a guess.
 */
async function fetchLiveDailyForecast(resort) {
  if (resort.lat == null || resort.lon == null) {
    throw new Error("no coordinates — forecast unavailable for this resort");
  }
  const pointsRes = await fetchWithTimeout(
    `${NOAA_BASE}/points/${resort.lat.toFixed(4)},${resort.lon.toFixed(4)}`,
    {}, NOAA_TIMEOUT_MS
  );
  if (!pointsRes.ok) throw new Error(`NOAA /points failed: ${pointsRes.status}`);
  const points = await pointsRes.json();
  const { gridId, gridX, gridY, timeZone } = points.properties || {};
  if (!gridId || gridX == null || gridY == null) throw new Error("NOAA /points missing grid info");

  const gridRes = await fetchWithTimeout(
    `${NOAA_BASE}/gridpoints/${gridId}/${gridX},${gridY}/forecastGridData`,
    {}, NOAA_TIMEOUT_MS
  );
  if (!gridRes.ok) throw new Error(`NOAA /gridpoints failed: ${gridRes.status}`);
  const grid = await gridRes.json();
  const props = grid.properties || {};

  const days = buildDayFrame(new Date(), timeZone, true);
  const byKey = Object.fromEntries(days.map((d) => [d.dateKey, d]));

  eachForecastHour((props.snowfallAmount || {}).values, (at, value, steps) => {
    const d = byKey[localDayKey(at, timeZone)];
    if (d) { d.snowIn += mmToInches(value) / steps; d.hasData = true; }
  });
  eachForecastHour((props.quantitativePrecipitation || {}).values, (at, value, steps) => {
    const d = byKey[localDayKey(at, timeZone)];
    if (d) { d.precipIn += mmToInches(value) / steps; }
  });
  eachForecastHour((props.temperature || {}).values, (at, value) => {
    const d = byKey[localDayKey(at, timeZone)];
    if (!d) return;
    const f = celsiusToF(value);
    d.highF = d.highF == null ? f : Math.max(d.highF, f);
    d.lowF = d.lowF == null ? f : Math.min(d.lowF, f);
    d.hasData = true;
  });

  for (const d of days) {
    d.snowIn = Math.round(d.snowIn * 10) / 10;
    d.precipIn = Math.round(d.precipIn * 100) / 100;
    if (d.highF != null) d.highF = Math.round(d.highF);
    if (d.lowF != null) d.lowF = Math.round(d.lowF);
  }

  // A response that resolved but carried no usable values for any day is a
  // failure, not an empty forecast — throwing sends it down the honest
  // fallback path instead of rendering a week of confident zeroes.
  if (!days.some((d) => d.hasData)) throw new Error("NOAA gridpoints returned no usable values");

  return { days, timeZone: timeZone || null, isLive: true };
}

// The frame of days the UI offers, independent of whether any data lands in
// them — so the day picker is the same shape on the live and fallback paths.
function buildDayFrame(now, timeZone, isLive) {
  const out = [];
  for (let i = 0; i < QUIVER_HORIZON_DAYS; i++) {
    const at = new Date(now.getTime() + i * 86400000);
    out.push(emptyDay(localDayKey(at, timeZone), isLive));
  }
  return out;
}

/**
 * Typical-season per-day fallback. Deliberately FLAT: every day in the frame
 * gets the same figure.
 *
 * The aggregate path above can honestly say "a typical week here is about 20
 * inches" because a week is the unit the annual average divides into. Split
 * that across named days and any variation would be invented — there is no
 * basis whatsoever for claiming Thursday is the snowy one in a normal
 * February. A flat distribution is the only shape that doesn't fabricate a
 * storm, and `isLive: false` carries the label the UI is required to render.
 */
function historicalDailyForecast(resort, now) {
  now = now || new Date();
  const est = historicalEstimate(resort, now);
  const perDay = Math.round((est.totalInches / 7) * 10) / 10;
  const days = buildDayFrame(now, null, false);
  for (const d of days) {
    d.snowIn = perDay;
    // 10:1 is the textbook average and the only defensible ratio to assume
    // when there's no measurement to divide — quiver.js's density read will
    // land on "average-density" and its copy never claims a measured ratio
    // on this path.
    d.precipIn = Math.round((perDay / 10) * 100) / 100;
    d.highF = est.avgTempF;
    d.lowF = est.avgTempF != null ? est.avgTempF - 12 : null;
    d.hasData = true;
  }
  return { days, timeZone: null, isLive: false, seasonFraction: est.seasonFraction };
}

/**
 * Always resolves. Tries live, falls back to typical-season on any failure,
 * and — as with resolveForecast() above — logs the classified reason so a
 * developer can tell a CORS rejection from a genuine outage, while the UI
 * shows only the honest generic copy.
 *
 * Canada resolves straight to the fallback without a request: NOAA has no
 * non-US coverage, so attempting one would spend a 9-second timeout to learn
 * something already known.
 */
async function resolveDailyForecast(resort, now) {
  if (resort.country !== "USA" || resort.lat == null) {
    return { ...historicalDailyForecast(resort, now), fallbackReason: "outside NOAA coverage" };
  }
  try {
    return await fetchLiveDailyForecast(resort);
  } catch (err) {
    const reason = classifyFetchError(err);
    console.warn(`[NOAA daily forecast failed] resort=${resort.id} reason=${reason} message=${(err && err.message) || err}`);
    return { ...historicalDailyForecast(resort, now), fallbackReason: (err && err.message) || String(err) };
  }
}
