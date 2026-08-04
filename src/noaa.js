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
// ⚠️ Unverified from this build environment — sandbox egress to
// api.weather.gov is blocked, so the live response shape and CORS headers
// could not be empirically confirmed here. That is exactly why the fallback
// is the thing this module is built and tested against first.
// ---------------------------------------------------------------------------

const NOAA_USER_AGENT = "RatherBeKneeDeep/1.0 (ski recommendation app; contact: nicolenetland@gmail.com)";
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

/**
 * Historical / typical-season estimate for a resort — always available,
 * works fully offline, and is what the UI falls back to whenever the live
 * path fails for any reason. Never claims to be a forecast: callers must
 * label it via the `isLive: false` flag, per the brief's integrity rule.
 *
 * Distributes the resort's published average annual snowfall across a
 * "typical" 7-day window during the core season, and estimates a plausible
 * average temperature from elevation/region — clearly an estimate, never
 * presented to the user as more precise than "typical for this time of year."
 */
function historicalEstimate(resort) {
  const annual = resort.avg_annual_snowfall_in;
  // A typical season runs ~18-20 storm-active weeks; distribute unevenly so
  // it isn't a flat, suspiciously round weekly figure.
  const weeklyShare = annual != null ? annual / 18 : 8;
  const baseElev = resort.base_elevation_ft || 6000;
  // Rough elevation-based temperature estimate (higher = colder), clamped to
  // a plausible mid-winter range — an estimate, not a measurement.
  const avgTempF = clamp(32 - (baseElev / 1000) * 1.1, 5, 30);
  return {
    totalInches: Math.round(weeklyShare * 10) / 10,
    avgTempF: Math.round(avgTempF),
    isLive: false,
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Attempts the live NOAA chain for one resort. Throws on any failure —
 * callers must catch and fall back. Never silently returns partial/guessed
 * data dressed up as live.
 */
async function fetchLiveForecast(resort) {
  if (resort.lat == null || resort.lon == null) {
    throw new Error("no coordinates — forecast unavailable for this resort");
  }
  const headers = { "User-Agent": NOAA_USER_AGENT, "Accept": "application/geo+json" };

  const pointsRes = await fetchWithTimeout(
    `${NOAA_BASE}/points/${resort.lat.toFixed(4)},${resort.lon.toFixed(4)}`,
    { headers }, NOAA_TIMEOUT_MS
  );
  if (!pointsRes.ok) throw new Error(`NOAA /points failed: ${pointsRes.status}`);
  const points = await pointsRes.json();
  const { gridId, gridX, gridY } = points.properties || {};
  if (!gridId || gridX == null || gridY == null) throw new Error("NOAA /points missing grid info");

  const gridRes = await fetchWithTimeout(
    `${NOAA_BASE}/gridpoints/${gridId}/${gridX},${gridY}/forecastGridData`,
    { headers }, NOAA_TIMEOUT_MS
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
 * Resolves a forecast for one resort: tries the live path, falls back to the
 * historical estimate on any failure. Always resolves (never rejects) so
 * callers can build a full ranked list even when every live call fails.
 */
async function resolveForecast(resort) {
  try {
    const live = await fetchLiveForecast(resort);
    return live;
  } catch (err) {
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
