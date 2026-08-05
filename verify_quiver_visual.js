#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_quiver_visual.js — walks Quiver Check end to end in a real browser
// against a synthetic mid-January storm, and screenshots every screen.
//
// Why this exists: Quiver Check matches Chase the Snow's season behaviour by
// Director's decision, which means that from roughly May to November the mode
// correctly refuses to render anything but the off-season screen. That's the
// right product call and the wrong review conditions — so this harness freezes
// the clock to a January date and serves a synthetic NOAA gridpoint response,
// letting the real screens be looked at (and asserted against) out of season.
//
// It is a review and regression tool, not a data source: nothing it stubs ever
// reaches the shipped app.
//
//     node verify_quiver_visual.js
// ---------------------------------------------------------------------------
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");
const SHOT_DIR = path.resolve(__dirname, "screenshots-quiver");
const FROZEN = Date.parse("2027-01-20T15:00:00Z"); // mid-season, mid-morning in the Rockies

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  PASS", msg);
  else { failures += 1; console.error("  FAIL", msg); }
}

// --- A synthetic storm ------------------------------------------------------
// Six-hour blocks, seven days out from the frozen clock. Shaped so the week
// contains every state worth looking at: a quiet start, a genuine dump on the
// Thursday, and a dry stretch behind it long enough for the mogul inference
// to fire.
//                    d0    d1    d2    d3     d4   d5   d6
const SNOW_BY_DAY = [0.4, 1.2, 6.0, 15.0, 0.1, 0.0, 0.0]; // inches
const TEMP_BY_DAY = [18, 15, 10, 8, 14, 20, 24];          // °F highs
const SLR = 17;                                            // cold, dry, interior snow

function gridValues() {
  const snow = [], qpf = [], temp = [];
  const start = new Date(FROZEN);
  start.setUTCHours(0, 0, 0, 0);
  for (let d = 0; d < 7; d++) {
    for (let b = 0; b < 4; b++) {
      const at = new Date(start.getTime() + (d * 24 + b * 6) * 3600000).toISOString().replace(".000Z", "+00:00");
      const inchesThisBlock = SNOW_BY_DAY[d] / 4;
      snow.push({ validTime: `${at}/PT6H`, value: inchesThisBlock * 25.4 });
      qpf.push({ validTime: `${at}/PT6H`, value: (inchesThisBlock / SLR) * 25.4 });
      temp.push({ validTime: `${at}/PT6H`, value: ((TEMP_BY_DAY[d] - 32) * 5) / 9 });
    }
  }
  return { snow, qpf, temp };
}

async function run() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const { snow, qpf, temp } = gridValues();

  const shots = [];
  for (const scheme of ["light", "dark"]) {
    for (const vp of [{ w: 390, h: 900, label: "390" }, { w: 1280, h: 1000, label: "1280" }]) {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, colorScheme: scheme });
      const page = await context.newPage();

      const consoleErrors = [];
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (t.includes("ERR_FAILED") || t.includes("Failed to load resource")) return; // our own route aborts
        consoleErrors.push(t);
      });
      page.on("pageerror", (e) => consoleErrors.push(String(e)));

      await page.route("**://fonts.googleapis.com/**", (r) => r.abort());
      await page.route("**://fonts.gstatic.com/**", (r) => r.abort());
      await page.route("**://api.weather.gov/points/**", (r) => r.fulfill({
        contentType: "application/geo+json",
        body: JSON.stringify({ properties: { gridId: "SLC", gridX: 100, gridY: 170, timeZone: "America/Denver" } }),
      }));
      await page.route("**://api.weather.gov/gridpoints/**", (r) => r.fulfill({
        contentType: "application/geo+json",
        body: JSON.stringify({
          properties: {
            snowfallAmount: { uom: "wmoUnit:mm", values: snow },
            quantitativePrecipitation: { uom: "wmoUnit:mm", values: qpf },
            temperature: { uom: "wmoUnit:degC", values: temp },
          },
        }),
      }));

      await page.addInitScript((frozen) => {
        const RealDate = Date;
        class MockDate extends RealDate {
          constructor(...a) { super(...(a.length ? a : [frozen])); }
          static now() { return frozen; }
        }
        MockDate.parse = RealDate.parse;
        MockDate.UTC = RealDate.UTC;
        window.Date = MockDate;
      }, FROZEN);

      const shot = async (name) => {
        const file = path.join(SHOT_DIR, `${name}-${scheme}-${vp.label}.png`);
        await page.screenshot({ path: file, fullPage: true });
        shots.push(file);
      };
      const first = scheme === "light" && vp.label === "390";

      await page.goto(FILE_URL);
      await page.waitForTimeout(250);
      if (first) {
        check(await page.locator("#mode-quiver").isVisible(), "Quiver Check appears as a mode on the splash screen");
        await shot("01-splash");
      }

      await page.click("#mode-quiver");
      await page.waitForTimeout(200);
      if (first) {
        check((await page.locator(".quiver-resort").count()) > 30, "the resort picker lists the resort pool");
        check(await page.locator("#quiver-search-input").isVisible(), "the resort picker has a search field");
        await shot("02-pick-resort");
      }

      await page.fill("#quiver-search-input", "alta");
      await page.waitForTimeout(150);
      if (first) {
        const n = await page.locator(".quiver-resort").count();
        check(n >= 1 && n <= 3, `search narrows the list (${n} results for "alta")`);
        await shot("03-search");
      }

      await page.click('.quiver-resort[data-rid="alta-ut"]');
      await page.waitForTimeout(200);
      if (first) {
        check((await page.locator(".quiver-day-list .tap-chip").count()) === 7, "the day picker offers seven days");
        check((await page.locator(".quiver-day-list .tap-chip").first().innerText()).includes("Today"), "the first day reads Today");
        await shot("04-pick-day");
      }

      // Day index 3 — the 15-inch day.
      await page.locator(".quiver-day-list .tap-chip").nth(3).click();
      await page.waitForTimeout(900); // let the stubbed forecast resolve
      const call = (await page.locator(".quiver-call").innerText()).trim();
      if (first) {
        check(["Pow Boats", "The Fatties"].includes(call), `a 21-inch cold storm calls for a powder ski (got "${call}")`);
        const bodyText = await page.locator("#quiver-card").innerText();
        check(bodyText.includes(":1"), "the card shows the measured snow-to-water ratio");
        check(bodyText.includes("Live forecast"), "the card is labelled as a live forecast");
        check(/If you don't own a pair/i.test(bodyText), "the card answers the don't-own-them case");
        check(/snow report/i.test(bodyText), "the card states what the forecast cannot see");
      }
      await shot("05-the-call-powder");

      // Day index 6 — three dry days after the storm.
      await page.click("#quiver-another-day");
      await page.waitForTimeout(200);
      await page.locator(".quiver-day-list .tap-chip").nth(6).click();
      await page.waitForTimeout(700);
      const dryCall = (await page.locator(".quiver-call").innerText()).trim();
      if (first) {
        check(["Bump Sticks", "Skinny Skis"].includes(dryCall), `a dry day after a storm calls for a narrow ski (got "${dryCall}")`);
      }
      await shot("06-the-call-firm");

      // The share link round-trip: re-open the URL cold and confirm it
      // re-reads the forecast rather than restoring a frozen answer.
      if (first) {
        const url = await page.evaluate(() => location.href);
        check(url.includes("#quiver="), "the call writes a shareable URL");
        const cold = await context.newPage();
        await cold.route("**://fonts.g**/**", (r) => r.abort());
        await cold.route("**://api.weather.gov/points/**", (r) => r.fulfill({
          contentType: "application/geo+json",
          body: JSON.stringify({ properties: { gridId: "SLC", gridX: 100, gridY: 170, timeZone: "America/Denver" } }),
        }));
        await cold.route("**://api.weather.gov/gridpoints/**", (r) => r.fulfill({
          contentType: "application/geo+json",
          body: JSON.stringify({ properties: {
            snowfallAmount: { values: snow }, quantitativePrecipitation: { values: qpf }, temperature: { values: temp } } }),
        }));
        await cold.addInitScript((frozen) => {
          const RealDate = Date;
          class MockDate extends RealDate {
            constructor(...a) { super(...(a.length ? a : [frozen])); }
            static now() { return frozen; }
          }
          MockDate.parse = RealDate.parse; MockDate.UTC = RealDate.UTC;
          window.Date = MockDate;
        }, FROZEN);
        await cold.goto(url);
        await cold.waitForTimeout(900);
        const coldCall = (await cold.locator(".quiver-call").innerText()).trim();
        check(coldCall === dryCall, `a shared link reproduces the same call (${coldCall})`);
        await cold.close();
      }

      // Fallback path — the network is gone, so the card must say so.
      if (first) {
        const off = await context.newPage();
        await off.route("**://fonts.g**/**", (r) => r.abort());
        await off.route("**://api.weather.gov/**", (r) => r.abort());
        await off.addInitScript((frozen) => {
          const RealDate = Date;
          class MockDate extends RealDate {
            constructor(...a) { super(...(a.length ? a : [frozen])); }
            static now() { return frozen; }
          }
          MockDate.parse = RealDate.parse; MockDate.UTC = RealDate.UTC;
          window.Date = MockDate;
        }, FROZEN);
        await off.goto(FILE_URL);
        await off.waitForTimeout(200);
        await off.click("#mode-quiver");
        await off.waitForTimeout(200);
        await off.click('.quiver-resort[data-rid="alta-ut"]');
        await off.waitForTimeout(200);
        await off.locator(".quiver-day-list .tap-chip").nth(3).click();
        await off.waitForTimeout(1200);
        const offText = await off.locator("#quiver-card").innerText();
        check(offText.includes("Not a live forecast"), "with no network, the card is labelled not-live");
        check(/typical snowfall for this time of year/i.test(offText), "the fallback states it is typical-season data");
        check(!/[0-9]+:1/.test(offText), "the fallback never claims a measured snow-to-water ratio anywhere on the card");
        await off.screenshot({ path: path.join(SHOT_DIR, "07-fallback-light-390.png"), fullPage: true });
        shots.push(path.join(SHOT_DIR, "07-fallback-light-390.png"));
        await off.close();
      }

      // --- Accessibility of the new screens --------------------------------
      if (first) {
        const a11y = await page.evaluate(() => {
          const out = {};
          const main = document.getElementById("app-main");
          out.h1Count = main.querySelectorAll("h1").length;
          out.headingOrder = Array.from(main.querySelectorAll("h1,h2,h3")).map((h) => h.tagName);
          out.focusedTag = document.activeElement ? document.activeElement.className : null;
          return out;
        });
        check(a11y.h1Count === 1, `the call screen has exactly one h1 (${a11y.h1Count})`);
        check(!a11y.headingOrder.includes("H3") || a11y.headingOrder.indexOf("H2") < a11y.headingOrder.indexOf("H3"),
          "heading levels do not skip");
        check(/quiver-call/.test(a11y.focusedTag || ""), "focus lands on the call heading");

        // Back to the day picker: the previously chosen day must still read
        // as chosen, to AT as well as visually.
        await page.click("#quiver-another-day");
        await page.waitForTimeout(200);
        const checkedCount = await page.locator('.quiver-day-list [aria-checked="true"]').count();
        check(checkedCount === 1, `returning to the day picker restores the chosen day (${checkedCount} checked)`);
        const roving = await page.locator('.quiver-day-list [tabindex="0"]').count();
        check(roving === 1, `exactly one day chip is in the tab order (${roving})`);

        // Touch targets on the new controls.
        const small = await page.evaluate(() => {
          const sel = ".quiver-day-list .tap-chip, .quiver-resort, .quiver-search__input, #quiver-back";
          return Array.from(document.querySelectorAll(sel))
            .map((el) => ({ c: el.className, h: Math.round(el.getBoundingClientRect().height) }))
            .filter((x) => x.h > 0 && x.h < 44);
        });
        check(small.length === 0, `every new control clears the 44px target floor${small.length ? " — " + JSON.stringify(small.slice(0, 3)) : ""}`);

        // Accessible names on the resort buttons.
        await page.click("#quiver-back");
        await page.waitForTimeout(200);
        const unnamed = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".quiver-resort")).filter((b) => !b.innerText.trim()).length);
        check(unnamed === 0, `every resort button has a visible accessible name (${unnamed} without)`);

        // Restore the card for the screenshot flow below.
        await page.click('.quiver-resort[data-rid="alta-ut"]');
        await page.waitForTimeout(200);
        await page.locator(".quiver-day-list .tap-chip").nth(6).click();
        await page.waitForTimeout(700);
      }

      // 200% zoom, the app's stated accessibility floor.
      if (scheme === "light" && vp.label === "390") {
        const zoom = await context.newPage();
        await zoom.route("**://fonts.g**/**", (r) => r.abort());
        await zoom.route("**://api.weather.gov/**", (r) => r.abort());
        await zoom.addInitScript(() => { document.documentElement.style.fontSize = "32px"; });
        await zoom.goto(FILE_URL);
        await zoom.waitForTimeout(200);
        await zoom.click("#mode-quiver");
        await zoom.waitForTimeout(300);
        const overflow = await zoom.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        check(overflow <= 1, `no horizontal overflow at 200% zoom (${overflow}px)`);
        await zoom.screenshot({ path: path.join(SHOT_DIR, "08-zoom200-light-390.png"), fullPage: true });
        shots.push(path.join(SHOT_DIR, "08-zoom200-light-390.png"));
        await zoom.close();
      }

      if (consoleErrors.length) {
        failures += 1;
        console.error(`  FAIL console errors (${scheme}/${vp.label}):`, consoleErrors.slice(0, 3));
      }
      await context.close();
    }
  }

  // The off-season screen, on the real calendar rather than the frozen one.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    await page.route("**://fonts.g**/**", (r) => r.abort());
    await page.route("**://api.weather.gov/**", (r) => r.abort());
    await page.goto(FILE_URL);
    await page.waitForTimeout(200);
    await page.click("#mode-quiver");
    await page.waitForTimeout(250);
    const text = await page.locator("#quiver-body").innerText();
    const isOffSeason = text.includes("Nothing's open right now");
    console.log(`\n  (today's real date renders the ${isOffSeason ? "off-season" : "in-season"} screen)`);
    if (isOffSeason) {
      check(!(await page.locator("#quiver-search-input").isVisible().catch(() => false)), "off-season shows no picker at all");
    }
    await page.screenshot({ path: path.join(SHOT_DIR, "09-offseason-today-390.png"), fullPage: true });
    shots.push(path.join(SHOT_DIR, "09-offseason-today-390.png"));
    await context.close();
  }

  await browser.close();
  console.log(`\n${shots.length} screenshots in ${SHOT_DIR}`);
  console.log(failures ? `FAILED — ${failures} check(s)` : "PASSED");
  process.exit(failures ? 1 : 0);
}

run();
