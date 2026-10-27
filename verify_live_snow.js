#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_live_snow.js — the app reads real weather and the real calendar.
//
// Replaces verify_demo.js (removed with src/demo.js on 2026-10-25). Pins:
//   1. Nothing of demo mode survives: no DEMO global, no banner, no controls.
//   2. Late October with a handful of resorts inside their own windows shows
//      the shoulder list, fed by the live NOAA path, labelled "Live forecast".
//   3. A NOAA failure still falls back to the honest typical-season badge.
//   4. Mid-August is still the off-season screen.
//   5. Rants & Raves never shows posts dated after today.
//
//     node verify_live_snow.js
// ---------------------------------------------------------------------------
const { chromium } = require("playwright");
const path = require("path");

const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");

let failures = 0, checks = 0;
function check(cond, msg, extra) {
  checks += 1;
  if (cond) console.log("  PASS", msg);
  else { failures += 1; console.error("  FAIL", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}

function grid(fromMs) {
  const snow = [], temp = [];
  const start = new Date(fromMs); start.setUTCHours(0, 0, 0, 0);
  for (let h = 0; h < 8 * 24; h += 6) {
    const at = new Date(start.getTime() + h * 3600000).toISOString().replace(".000Z", "+00:00");
    snow.push({ validTime: `${at}/PT6H`, value: 25.4 }); // 1" per block
    temp.push({ validTime: `${at}/PT6H`, value: -6 });
  }
  return { properties: { snowfallAmount: { values: snow }, quantitativePrecipitation: { values: snow.map((s) => ({ ...s, value: s.value / 12 })) }, temperature: { values: temp } } };
}

async function open(browser, isoNow, { noaa }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date(isoNow));
  await page.route("**://fonts.g**/**", (r) => r.abort());
  const hits = { n: 0 };
  if (noaa) {
    const body = JSON.stringify(grid(Date.parse(isoNow)));
    await page.route("**://api.weather.gov/points/**", (r) => { hits.n++; r.fulfill({ contentType: "application/geo+json", body: JSON.stringify({ properties: { gridId: "BOU", gridX: 1, gridY: 1, timeZone: "America/Denver" } }) }); });
    await page.route("**://api.weather.gov/gridpoints/**", (r) => r.fulfill({ contentType: "application/geo+json", body }));
  } else {
    await page.route("**://api.weather.gov/**", (r) => r.abort());
  }
  return { page, errors, hits, ctx };
}

async function run() {
  const browser = await chromium.launch();

  console.log("\n1. Demo mode is gone");
  {
    const { page, errors, ctx } = await open(browser, "2026-10-25T20:00:00", { noaa: true });
    await page.goto(FILE_URL); await page.getByText("Chase the snow", { exact: true }).first().click();
    await page.waitForSelector("#freshness-badge, .center-state", { timeout: 20000 });
    check(await page.evaluate(() => typeof DEMO === "undefined" && typeof syncDemoChrome === "undefined"), "no DEMO global or demo chrome hook");
    check(await page.locator("#demo-banner").count() === 0, "no demo banner element");
    check(!(await page.content()).includes("Demo snow"), "no 'Demo snow' copy anywhere in the page");
    check(await page.evaluate(() => Math.abs(appNow().getTime() - Date.now()) < 1000), "appNow() is the real clock");

    console.log("\n2. Late October: shoulder list on live data");
    check(await page.locator("#season-shoulder-notice").count() === 1, "shoulder notice shows");
    const badge = (await page.locator("#freshness-badge").innerText()).trim();
    check(/Live forecast/.test(badge), "freshness badge says Live forecast", badge);
    const cards = await page.locator("#chase-body [data-rid], #chase-body .resort-card, #chase-body article").count();
    check(cards >= 1, "at least one ranked resort renders", cards);
    check(errors.length === 0, "no page errors", errors);
    await ctx.close();
  }

  console.log("\n3. NOAA unreachable: honest fallback");
  {
    const { page, ctx } = await open(browser, "2026-10-25T20:00:00", { noaa: false });
    await page.goto(FILE_URL); await page.getByText("Chase the snow", { exact: true }).first().click();
    await page.waitForSelector("#freshness-badge", { timeout: 30000 });
    const badge = (await page.locator("#freshness-badge").innerText()).trim();
    check(/Not a live forecast/.test(badge), "fallback badge says Not a live forecast", badge);
    await ctx.close();
  }

  console.log("\n4. Mid-August: still off-season");
  {
    const { page, hits, ctx } = await open(browser, "2026-08-15T20:00:00", { noaa: true });
    await page.goto(FILE_URL); await page.getByText("Chase the snow", { exact: true }).first().click();
    await page.waitForSelector(".center-state", { timeout: 20000 });
    check(await page.locator("#freshness-badge").count() === 0, "no freshness badge off-season");
    await page.waitForTimeout(500);
    check(hits.n === 0, "no NOAA request off-season", hits.n);
    await ctx.close();
  }

  console.log("\n5. Rants & Raves refuses future-dated posts");
  {
    const { page, ctx } = await open(browser, "2026-10-25T20:00:00", { noaa: false });
    await page.goto(FILE_URL); await page.click("#mode-rants");
    await page.waitForTimeout(600);
    const n = await page.evaluate(() => rantsLiveTopics().length);
    check(n === 0, "no topics live on Oct 25 (sample corpus is dated Dec–Jan)", n);
    check(await page.evaluate(() => rantsWithinCeiling("2026-12-20") === false), "a post dated after today is outside the ceiling");
    check(await page.evaluate(() => rantsWithinCeiling("2026-10-20") === true), "a post 5 days old is inside it");
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${checks - failures}/${checks} passed`);
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
