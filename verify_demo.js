#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_demo.js — the invented-season dataset, and the guarantees around it.
//
// Demo snow deliberately suspends R8, the app's hardest constraint, so the
// three properties that bound that suspension are the ones worth testing:
//   1. it only fills a genuinely empty window, and never displaces real data
//   2. it switches itself off without anyone remembering to
//   3. nothing it generates can reach a screen unlabelled
//
// Plus the one property the feature is useless without: determinism. A shared
// #quiver= link re-derives its answer on arrival, so the same resort and date
// must generate the same weather on someone else's phone tomorrow.
// ---------------------------------------------------------------------------
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "src");
const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");

let failures = 0, checks = 0;
function assert(cond, msg) {
  checks += 1;
  if (cond) console.log("  PASS", msg);
  else { failures += 1; console.error("  FAIL", msg); }
}
function quiet(cond, msg) { // for sweeps — only reports on failure
  checks += 1;
  if (!cond) { failures += 1; console.error("  FAIL", msg); }
}

function load(fakeNow) {
  const ctx = vm.createContext({ console, Intl, Math, JSON, setTimeout, clearTimeout, AbortController });
  if (fakeNow) {
    const RealDate = Date;
    class D extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fakeNow])); }
      static now() { return fakeNow; }
    }
    D.parse = RealDate.parse; D.UTC = RealDate.UTC;
    ctx.Date = D;
  } else {
    ctx.Date = Date;
  }
  for (const f of ["data.js", "icons.js", "engine.js", "noaa.js", "demo.js", "quiver.js"]) {
    vm.runInContext(fs.readFileSync(path.join(SRC, f), "utf8"), ctx, { filename: f });
  }
  return ctx;
}

const AUGUST = Date.parse("2026-08-05T12:00:00Z");
const JANUARY = Date.parse("2027-01-20T12:00:00Z");
const NOVEMBER = Date.parse("2026-11-25T12:00:00Z");

// ---------------------------------------------------------------------------
console.log("\n1. The switch is bounded and self-disabling");
// ---------------------------------------------------------------------------
{
  const aug = load(AUGUST);
  assert(vm.runInContext("DEMO.active()", aug) === true, "August (nothing open) — demo is on");

  const jan = load(JANUARY);
  assert(vm.runInContext("DEMO.active()", jan) === false, "January (full season) — demo is off, with no flag changed");

  const nov = load(NOVEMBER);
  assert(vm.runInContext("DEMO.active()", nov) === false, "Late November (season under way) — demo is already off");

  // The real forecast path must be completely untouched when demo is off.
  assert(vm.runInContext("appNow().getMonth()", jan) === 0, "with demo off, appNow() is the real clock");
  assert(vm.runInContext("appNow().getMonth()", aug) === 0, "with demo on, appNow() is the demo date (January)");

  // Off-season is the ONLY state that turns it on. Sweep the calendar.
  const onMonths = [];
  for (let m = 0; m < 12; m++) {
    const t = Date.parse(`${m >= 7 ? 2026 : 2027}-${String(m + 1).padStart(2, "0")}-15T12:00:00Z`);
    if (vm.runInContext("DEMO.active()", load(t))) onMonths.push(m + 1);
  }
  console.log(`     demo is on in months: ${onMonths.join(", ")}`);
  assert(!onMonths.includes(1) && !onMonths.includes(2) && !onMonths.includes(12),
    "demo is never on in December, January or February");
}

// ---------------------------------------------------------------------------
console.log("\n2. Determinism — a shared link must reproduce its answer");
// ---------------------------------------------------------------------------
{
  const a = load(AUGUST), b = load(AUGUST);
  const sample = vm.runInContext(`
    RESORTS.slice(0, 40).map(r => demoDailyForecast(r, appNow()).days.map(d => [d.snowIn, d.precipIn, d.highF]))`, a);
  const sample2 = vm.runInContext(`
    RESORTS.slice(0, 40).map(r => demoDailyForecast(r, appNow()).days.map(d => [d.snowIn, d.precipIn, d.highF]))`, b);
  assert(JSON.stringify(sample) === JSON.stringify(sample2),
    "two independent loads generate byte-identical weather for 40 resorts × 7 days");

  // And a different date genuinely differs, so it isn't accidentally constant.
  const shifted = vm.runInContext(`
    DEMO.date = "2027-02-14";
    RESORTS.slice(0, 40).map(r => demoDailyForecast(r, appNow()).days.map(d => d.snowIn))`, a);
  const orig = sample.map((r) => r.map((d) => d[0]));
  assert(JSON.stringify(shifted) !== JSON.stringify(orig), "moving the date changes the weather");
}

// ---------------------------------------------------------------------------
console.log("\n3. Everything it generates is flagged");
// ---------------------------------------------------------------------------
{
  const ctx = load(AUGUST);
  const flags = vm.runInContext(`
    RESORTS.map(r => {
      const daily = demoDailyForecast(r, appNow());
      const agg = demoAggregateForecast(r, appNow());
      return {
        id: r.id,
        dailyDemo: daily.isDemo === true && daily.isLive === false,
        dayDemo: daily.days.every(d => d.isDemo === true && d.isLive === false),
        aggDemo: agg.isDemo === true && agg.isLive === false,
      };
    })`, ctx);
  for (const f of flags) {
    quiet(f.dailyDemo && f.dayDemo && f.aggDemo, `${f.id}: demo output not fully flagged`);
  }
  assert(flags.every((f) => f.dailyDemo && f.dayDemo && f.aggDemo),
    `all ${flags.length} resorts emit isDemo:true / isLive:false on every path`);

  // The ski model must attach NO data-provenance caveat to a demo-backed call.
  //
  // This assertion is the inverse of the one it replaces, and the inversion is
  // the Director's decision of 2026-08-07, not a weakened test. The invented-
  // data line was the third statement of the same fact on one screen (banner,
  // per-card badge, "Worth knowing"), and it was the one buried deepest. The
  // banner in §5 below is what now carries the claim, and it is asserted there
  // verbatim so this removal cannot quietly become a removal of all of them.
  const stillCaveated = vm.runInContext(`
    RESORTS.map(r => {
      const fc = demoDailyForecast(r, appNow());
      const res = quiverCheck(r, fc.days[3], fc.days.slice(0,3), appNow());
      return res.caveats.some(t => /invented|typical snowfall for this time of year/i.test(t)) ? r.id : null;
    }).filter(Boolean)`, ctx);
  assert(stillCaveated.length === 0,
    `no demo-backed ski call carries a data-provenance caveat${stillCaveated.length ? " — still on: " + stillCaveated.slice(0,3) : ""}`);

  // The specific trap in removing it: demo days carry isLive:false like any
  // non-live day, so dropping the demo branch without guarding the one below
  // would swap one false claim ("invented") for another ("typical snowfall for
  // this time of year"). The sweep above covers that, and this proves the
  // real, non-demo path that caveat exists for is still intact — the typical-
  // season fallback in a live month must still say so.
  const jan = load(JANUARY);
  const typicalSeasonCaveat = vm.runInContext(`
    (function () {
      const r = RESORTS.find(x => x.id === 'alta-ut');
      const mk = k => ({ dateKey: k, snowIn: 0.2, precipIn: 0.02, highF: 24, lowF: 13, isLive: false, hasData: true });
      const res = quiverCheck(r, mk("2027-01-24"), ["2027-01-21","2027-01-22","2027-01-23"].map(mk), appNow());
      return res.caveats.some(t => /typical snowfall for this time of year/i.test(t));
    })()`, jan);
  assert(typicalSeasonCaveat,
    "with demo off, a non-live day still carries the typical-season caveat (the real path is untouched)");
}

// ---------------------------------------------------------------------------
console.log("\n3b. The per-card demo badge is gone at the source");
// ---------------------------------------------------------------------------
{
  // Structural removal, not display:none and not a dead helper left behind:
  // demo.js gets deleted wholesale once the season starts, so a call site that
  // outlived it would be a hard ReferenceError on a live screen.
  const srcFiles = fs.readdirSync(SRC).filter((f) => f.endsWith(".js"));
  const referencing = srcFiles.filter((f) =>
    fs.readFileSync(path.join(SRC, f), "utf8").includes("demoFreshnessHtml("));
  assert(referencing.length === 0,
    `demoFreshnessHtml() is defined and called nowhere${referencing.length ? " — still in: " + referencing.join(", ") : ""}`);

  const pillText = srcFiles.filter((f) =>
    fs.readFileSync(path.join(SRC, f), "utf8").includes("Demo data · invented, not a forecast"));
  assert(pillText.length === 0,
    `the "Demo data · invented, not a forecast" pill string is gone from src${pillText.length ? " — still in: " + pillText.join(", ") : ""}`);

  // Demo CHROME (as distinct from the demo clock, which the whole app reads
  // through appNow()/effectiveSeasonState()) is now sealed inside demo.js,
  // with syncDemoChrome() as its single entry point. A chrome helper called
  // from an app file is the coupling that just got removed; it should not
  // come back by a different name.
  const chromeHelpers = ["demoFreshnessHtml", "demoBannerHtml", "wireDemoControls", "demoInvalidate"];
  const leaked = [];
  for (const f of srcFiles.filter((x) => x !== "demo.js")) {
    const body = fs.readFileSync(path.join(SRC, f), "utf8");
    for (const h of chromeHelpers) if (body.includes(h + "(")) leaked.push(`${f}: ${h}`);
  }
  assert(leaked.length === 0,
    `demo chrome is reachable only via syncDemoChrome()${leaked.length ? " — leaked: " + leaked.join(", ") : ""}`);

  // The CSS rule that styled the pill goes with it — a selector matching
  // nothing is the stylesheet's version of a dead node.
  const css = fs.readFileSync(path.join(SRC, "styles.css"), "utf8");
  assert(!css.includes("freshness-badge--demo"),
    "the .freshness-badge--demo rule is gone from styles.css");
}

// ---------------------------------------------------------------------------
console.log("\n4. The invented season is calibrated to each resort's real data");
// ---------------------------------------------------------------------------
{
  const ctx = load(AUGUST);
  const rows = vm.runInContext(`
    RESORTS.filter(r => r.avg_annual_snowfall_in > 0).map(r => {
      const w = demoSeasonWindow(r);
      let total = 0;
      for (let d = 0; d <= w.length; d++) total += demoRawIntensity(r.id, d) * demoSeasonScale(r);
      return { id: r.id, published: r.avg_annual_snowfall_in, generated: Math.round(total) };
    })`, ctx);
  const bad = rows.filter((r) => Math.abs(r.generated - r.published) > Math.max(3, r.published * 0.02));
  assert(bad.length === 0,
    `all ${rows.length} generated seasons sum to the resort's own published annual snowfall${bad.length ? " — off: " + JSON.stringify(bad.slice(0,3)) : ""}`);

  // Regional character has to actually come through, or the dataset is
  // uniform noise wearing resort names.
  const character = vm.runInContext(`
    (function () {
      const pick = id => RESORTS.find(r => r.id === id);
      const seasonMean = r => {
        const w = demoSeasonWindow(r);
        let n = 0, sum = 0;
        for (let d = 0; d <= w.length; d += 3) { sum += demoSlrFor(r, d); n++; }
        return sum / n;
      };
      return {
        alta: seasonMean(pick('alta-ut')),
        baker: seasonMean(pick('mt-baker-wa')),
        stowe: seasonMean(pick('stowe-vt')),
        revelstoke: seasonMean(pick('revelstoke-bc')),
        whistler: seasonMean(pick('whistler-blackcomb-bc')),
      };
    })()`, ctx);
  console.log("     mean snow-to-liquid ratio:", Object.entries(character).map(([k, v]) => `${k} ${v.toFixed(1)}:1`).join("  "));
  assert(character.alta > character.baker + 4, "Utah generates markedly drier snow than the Cascades");
  assert(character.stowe > character.baker, "the Northeast generates drier snow than the Cascades");
  assert(character.revelstoke > character.whistler + 2, "interior BC generates drier snow than the coast range");

  // Storms should cluster, not drizzle — a season of uniform daily snowfall
  // would make the whole ski model untestable.
  const shape = vm.runInContext(`
    (function () {
      const r = RESORTS.find(x => x.id === 'alta-ut');
      const w = demoSeasonWindow(r), s = demoSeasonScale(r);
      const days = [];
      for (let d = 0; d <= w.length; d++) days.push(demoRawIntensity(r.id, d) * s);
      return {
        dry: days.filter(x => x < 1).length,
        big: days.filter(x => x >= 8).length,
        max: Math.round(Math.max.apply(null, days)),
        len: days.length,
      };
    })()`, ctx);
  console.log(`     Alta's invented season: ${shape.len} days, ${shape.dry} under 1", ${shape.big} over 8", biggest ${shape.max}"`);
  assert(shape.dry > shape.len * 0.35, "most days in a generated season are quiet");
  assert(shape.big >= 5, "a generated season contains real storm days");
}

// ---------------------------------------------------------------------------
console.log("\n5. In the browser, today");
// ---------------------------------------------------------------------------
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**://fonts.g**/**", (r) => r.abort());
  await page.route("**://api.weather.gov/**", (r) => r.abort()); // no network, as in production off-season

  await page.goto(FILE_URL);
  await page.waitForTimeout(300);
  assert(await page.locator("#demo-banner").isVisible(), "the demo banner is visible on arrival");
  const bannerText = await page.locator("#demo-banner").innerText();
  assert(/invented/i.test(bannerText), "the banner says the numbers are invented");
  assert(/unaffected/i.test(bannerText), "the banner names what is NOT affected");

  // THE BANNER IS THE SURVIVING DECLARATION. The badge and the caveat were
  // removed on 2026-08-07 precisely so this one could stay unqualified, which
  // makes its exact wording load-bearing rather than incidental: weakening it
  // would leave the app with three softened statements where it used to have
  // one hard one. Asserted verbatim, deliberately.
  assert(
    bannerText.includes("Demo snow.") &&
    bannerText.includes("Snow forecasts are invented while the season is out — no number here describes real weather.") &&
    bannerText.includes("Trip planning and Nicole's list are unaffected."),
    "the banner's wording is intact, word for word");
  assert(await page.locator("#demo-controls-toggle").isVisible(), "the banner still carries its Controls button");

  // Chase the Snow ranks instead of showing the off-season screen.
  await page.click("#mode-chase");
  await page.waitForTimeout(1200);
  const chaseText = await page.locator("#app-main").innerText();
  assert(!/Nothing's open right now/.test(chaseText), "Chase the Snow no longer shows the off-season screen");
  const rows = await page.locator(".chase-row").count();
  // rankChaseTheSnow() returns a top-8 by design (engine.js) — this asserts a
  // full ranked list, not an arbitrary count.
  assert(rows === 8, `Chase the Snow ranks a full top-8 list (${rows} rows)`);

  // 1a — the pill is gone from the Chase list. #app-main excludes the banner
  // (which lives outside .app-shell), so this is specifically "the second
  // statement is not in the page body", not "no statement anywhere".
  assert(!/Demo data · invented, not a forecast/.test(chaseText),
    "the Chase list no longer restates the demo warning under the beginner toggle");
  assert(await page.locator(".freshness-badge--demo").count() === 0,
    "no demo freshness pill is rendered on the Chase list");

  // Structural removal: no empty node holding open the space the pill used to
  // occupy. #chase-freshness is a real container in the Chase markup and stays
  // there for the live/fallback badges — in demo mode it must simply collapse.
  const freshnessBox = await page.evaluate(() => {
    const el = document.getElementById("chase-freshness");
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { children: el.childElementCount, h: el.getBoundingClientRect().height,
             mt: parseFloat(cs.marginTop), mb: parseFloat(cs.marginBottom) };
  });
  assert(freshnessBox && freshnessBox.children === 0 && freshnessBox.h === 0 &&
         freshnessBox.mt === 0 && freshnessBox.mb === 0,
    `the freshness slot collapses to nothing in demo mode — no dead node, no gap (${JSON.stringify(freshnessBox)})`);
  await page.screenshot({ path: "screenshots-quiver/20-demo-chase.png", fullPage: true });

  // Quiver Check reaches a call.
  await page.click('#bottom-nav .nav-item[data-route="quiver"]');
  await page.waitForTimeout(400);
  const quiverText = await page.locator("#app-main").innerText();
  assert(!/Nothing's open right now/.test(quiverText), "Quiver Check no longer shows the off-season screen");
  await page.click('.quiver-resort[data-rid="alta-ut"]');
  await page.waitForTimeout(300);
  await page.locator(".quiver-day-list .tap-chip").nth(3).click();
  await page.waitForTimeout(700);
  const call = (await page.locator(".quiver-call").innerText()).trim();
  const cardText = await page.locator("#quiver-card").innerText();
  assert(call.length > 0, `Quiver Check produces a call (${call})`);

  // 1a/1b — neither restatement survives on the Quiver result. The pill
  // rendered here too (same helper as the Chase list), so removing only the
  // screenshotted one would have left the page still saying it twice.
  assert(!/Demo data · invented, not a forecast/.test(cardText),
    "the call card no longer carries the demo pill");
  assert(await page.locator("#quiver-card .freshness-badge").count() === 0,
    "no freshness badge of any kind is rendered on a demo-backed call card");
  assert(!/invented/i.test(cardText),
    "the call card no longer carries the invented-data caveat in Worth knowing");

  // AND THE PERMANENT CAVEAT DIRECTLY BELOW IT STAYS. This one is not a demo
  // artifact — it is true in a live February with a real NOAA forecast behind
  // it, and it sat close enough to the removed paragraph to be deleted by
  // accident. It is asserted here so that can't happen silently.
  assert(/This reads the weather forecast, not the mountain's snow report/.test(cardText),
    "the standing forecast-vs-snow-report caveat is still on the call card");

  // "Worth knowing" is a shared list, not a demo container: it also holds the
  // mogul inference, the forward-only-forecast note and the powder-crowd
  // warning. The heading is already conditional on the list being non-empty,
  // so it survives on its own merits and disappears structurally when the
  // list is empty — it must never render as an empty heading.
  const caveatSection = await page.evaluate(() => {
    const box = document.querySelector(".quiver-caveats");
    if (!box) return { present: false };
    return { present: true, heading: !!box.querySelector(".data-label"),
             items: box.querySelectorAll(".quiver-caveat-list li").length };
  });
  assert(!caveatSection.present || caveatSection.items > 0,
    `"Worth knowing" never renders as a bare heading with nothing under it (${JSON.stringify(caveatSection)})`);
  await page.screenshot({ path: "screenshots-quiver/21-demo-quiver.png", fullPage: true });

  // The controls actually drive the data.
  await page.click("#demo-controls-toggle");
  await page.waitForTimeout(200);
  await page.screenshot({ path: "screenshots-quiver/22-demo-controls.png", fullPage: true });
  await page.check('input[name="demo-force"][value="spring"]');
  await page.waitForTimeout(900);
  await page.click('#bottom-nav .nav-item[data-route="quiver"]');
  await page.waitForTimeout(300);
  await page.click('.quiver-resort[data-rid="alta-ut"]');
  await page.waitForTimeout(300);
  await page.locator(".quiver-day-list .tap-chip").nth(3).click();
  await page.waitForTimeout(700);
  const springCall = (await page.locator(".quiver-call").innerText()).trim();
  assert(springCall !== call, `forcing a condition changes the call (${call} -> ${springCall})`);
  // The control has to produce the condition it names, which for the two
  // season-gated branches means moving the date too.
  assert(springCall === "Slush Puppies", `forcing spring slush produces the spring call (got "${springCall}")`);
  assert(await page.locator("#demo-date").inputValue() === "2027-04-10", "forcing spring moved the date into April");

  await page.check('input[name="demo-force"][value="thin"]');
  await page.waitForTimeout(900);
  await page.click('#bottom-nav .nav-item[data-route="quiver"]');
  await page.waitForTimeout(300);
  await page.click('.quiver-resort[data-rid="alta-ut"]');
  await page.waitForTimeout(300);
  await page.locator(".quiver-day-list .tap-chip").nth(3).click();
  await page.waitForTimeout(700);
  const thinCall = (await page.locator(".quiver-call").innerText()).trim();
  assert(thinCall === "Rock Skis", `forcing thin early season produces the rock-ski call (got "${thinCall}")`);

  await page.check('input[name="demo-force"][value="deep-cold"]');
  await page.waitForTimeout(900);
  await page.click('#bottom-nav .nav-item[data-route="quiver"]');
  await page.waitForTimeout(300);
  await page.click('.quiver-resort[data-rid="alta-ut"]');
  await page.waitForTimeout(300);
  await page.locator(".quiver-day-list .tap-chip").nth(3).click();
  await page.waitForTimeout(700);
  const deepCall = (await page.locator(".quiver-call").innerText()).trim();
  assert(["Pow Boats", "The Fatties", "Mid-Fats"].includes(deepCall),
    `forcing deep and cold produces a powder ski (${deepCall})`);

  // The banner must not swallow taps on anything beneath it — the failure
  // that the toast had, and that a sticky version of this banner also had.
  await page.click('#bottom-nav .nav-item[data-route="chase"]');
  await page.waitForTimeout(900);
  const occluded = await page.evaluate(() => {
    const banner = document.getElementById("demo-banner");
    if (!banner || banner.hidden) return [];
    const targets = document.querySelectorAll(
      ".chase-row, .nav-item, .quiver-resort, button:not(#demo-controls-toggle), a, input, select");
    const bad = [];
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.top < 0 || r.bottom > innerHeight) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && banner.contains(hit) && !banner.contains(el)) {
        bad.push((el.className || el.tagName) + "");
      }
    }
    return bad;
  });
  assert(occluded.length === 0,
    `the banner occludes nothing beneath it${occluded.length ? " — " + occluded.slice(0, 3).join(", ") : ""}`);

  // -------------------------------------------------------------------------
  // The OFF state — what every screen looks like from November, and what it
  // looks like permanently once demo.js is deleted. The removals above must
  // not have taken any real-data labelling with them.
  // -------------------------------------------------------------------------
  const offBranches = await page.evaluate(() => ({
    demo: quiverFreshnessHtml({ isDemo: true }),
    live: quiverFreshnessHtml({ isLive: true }),
    fallback: quiverFreshnessHtml({ isLive: false, fallbackReason: "outside NOAA coverage" }),
  }));
  assert(offBranches.demo === "",
    "demo mode contributes an empty string, not a hidden node, to the freshness slot");
  assert(/freshness-badge/.test(offBranches.live) && /Live forecast/.test(offBranches.live),
    "with demo off, a live forecast still renders the live badge");
  assert(/freshness-badge--fallback/.test(offBranches.fallback) && /Not a live forecast/.test(offBranches.fallback),
    "with demo off, a non-live forecast still renders the fallback badge and its explanation");

  // Flip the switch the calendar will flip in November and re-render the same
  // list from the same cache: the slot the pill vacated has to fill back in
  // with a real badge, not stay empty.
  const offChase = await page.evaluate(() => {
    DEMO._activeCache = false;
    renderChaseList();
    const slot = document.getElementById("chase-freshness");
    const banner = document.getElementById("demo-banner");
    syncDemoChrome();
    return {
      badges: slot.querySelectorAll(".freshness-badge").length,
      demoPills: slot.querySelectorAll(".freshness-badge--demo").length,
      bannerHidden: banner.hidden,
      bannerEmpty: banner.innerHTML === "",
    };
  });
  assert(offChase.badges === 1 && offChase.demoPills === 0,
    `with demo off, the Chase freshness slot renders exactly one real badge (${JSON.stringify(offChase)})`);
  assert(offChase.bannerHidden && offChase.bannerEmpty,
    "with demo off, the banner is hidden AND emptied — no dead node left in the DOM");
  await page.evaluate(() => { DEMO._activeCache = true; });

  // Nothing else regressed.
  assert(errors.length === 0, `no page errors${errors.length ? ": " + errors.slice(0, 2) : ""}`);
  await browser.close();

  console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})();
