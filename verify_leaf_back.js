#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_leaf_back.js — the leaf pages, and the way back off them.
//
// A "leaf" here is a view the app can leave you standing on with nothing above
// it. Nicole found this on her phone: the Quiver call ends in Share / Try a
// different day / Check a different mountain and the bottom nav, and none of
// those is a way back — the nav is a jump to a different surface, which is a
// different thing from returning to where you came from.
//
// Two routes needed one (Director, 2026-08-07):
//   * the Quiver call            — renderQuiverResult
//   * the trip-planner result    — renderResult, which is ALSO the Chase the
//                                  Snow resort detail, reached by tapping a row
//
// The hard part is not the control, it is that both are shareable. "Share this
// call" writes a #quiver= link and parseInitialRoute reads it, so a reader can
// arrive with no in-app history at all. history.back() on that reader is a
// no-op or throws them out of the app — the bug the Rants work fixed twice.
// Everything below exists to prove the cold path was handled by knowing, not
// by guessing at the history stack.
// ---------------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "src");
const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");

let failures = 0, checks = 0;
function assert(cond, msg, extra) {
  checks += 1;
  if (cond) console.log("  PASS", msg);
  else { failures += 1; console.error("  FAIL", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}

async function newPage(ctx, width) {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  await p.route("**://fonts.g**/**", (r) => r.abort());
  await p.route("**://api.weather.gov/**", (r) => r.abort());
  return p;
}
const pageErrors = [];

// The control's own contract, applied wherever one renders.
async function checkControl(page, id, expectLabel, expectArrow, where) {
  const el = page.locator("#" + id);
  assert(await el.count() === 1, `${where}: a back control renders`);
  if (!(await el.count())) return;

  // It names its destination. A bare chevron gives a screen-reader user
  // nothing and gives a cold-landed reader nothing.
  const accName = await page.getByRole("button", { name: expectLabel, exact: true }).count();
  assert(accName === 1, `${where}: its accessible name is exactly "${expectLabel}"`,
    { actual: await el.evaluate((e) => e.textContent.replace(/\s+/g, " ").trim()) });

  // The arrow is decoration on top of the name, never a substitute for it —
  // and it only renders when the move is genuinely backward.
  const arrows = await page.locator(`#${id} .leaf-back__arrow`).count();
  assert(arrows === (expectArrow ? 1 : 0),
    `${where}: the arrow ${expectArrow ? "renders (this is a real return)" : "does NOT render (this is not a return)"}`);
  if (arrows) {
    assert(await page.locator(`#${id} .leaf-back__arrow`).getAttribute("aria-hidden") === "true",
      `${where}: the arrow is aria-hidden, so it never reaches the accessible name`);
  }

  const geo = await el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  assert(geo.h >= 44, `${where}: clears the 44px target floor (${geo.h}px)`);
  assert(!geo.overflow, `${where}: adding it causes no page-level horizontal overflow`);
}

// It has to sit ABOVE the heading. In the footer it is just another exit in a
// stack of exits, at the bottom of a card you have to read past first.
async function checkAboveHeading(page, id, headingSel, where) {
  const above = await page.evaluate(([i, h]) => {
    const b = document.getElementById(i), head = document.querySelector(h);
    if (!b || !head) return null;
    return !!(b.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, [id, headingSel]);
  assert(above === true, `${where}: sits above the view's heading in DOM order`);
}

(async () => {
  // -------------------------------------------------------------------------
  console.log("\n1. No control anywhere calls history.back()");
  // -------------------------------------------------------------------------
  // The cold-landing bug, asserted at the source rather than only in the
  // browser: on a shared link there is nothing behind the reader, so a blind
  // history.back() either does nothing or leaves the app. Both leaf controls
  // branch on recorded in-app provenance instead (state.quiver.hadPrev, and
  // routeParams.origin), which is knowable rather than guessable.
  // Comments are stripped first, and conservatively: whole-line `//` comments
  // and /* */ blocks only, never a trailing comment after code on the same
  // line. That can hide nothing — a line with a real call followed by a
  // comment still keeps the call — while letting both this file and
  // app-rants.js go on explaining IN PROSE why history.back() is wrong here,
  // which is the most useful thing either of them says about it.
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const offenders = fs.readdirSync(SRC).filter((f) => f.endsWith(".js"))
    .filter((f) => /history\s*\.\s*back\s*\(/.test(stripComments(fs.readFileSync(path.join(SRC, f), "utf8"))));
  assert(offenders.length === 0,
    `no source file calls history.back()${offenders.length ? " — " + offenders.join(", ") : ""}`);

  // This commit adds no global history handling: replaceState only, and no
  // popstate/hashchange outside the Rants surface, which owns its own routes.
  const strayHistory = fs.readdirSync(SRC).filter((f) => f.endsWith(".js") && f !== "app-rants.js")
    .filter((f) => /addEventListener\(\s*["'](?:popstate|hashchange)["']/.test(fs.readFileSync(path.join(SRC, f), "utf8")));
  assert(strayHistory.length === 0,
    `no popstate/hashchange handling added outside the Rants surface${strayHistory.length ? " — " + strayHistory.join(", ") : ""}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  // -------------------------------------------------------------------------
  console.log("\n2. Quiver call, reached in-app — back returns to the picker");
  // -------------------------------------------------------------------------
  {
    const page = await newPage(ctx);
    await page.goto(FILE_URL);
    await page.click("#mode-quiver");
    await page.waitForTimeout(400);
    await page.click('.quiver-resort[data-rid="alta-ut"]');
    await page.waitForTimeout(300);
    await page.locator(".quiver-day-list .tap-chip").nth(2).click();
    await page.waitForTimeout(800);

    assert(await page.locator(".quiver-call").count() === 1, "the call renders");
    await checkControl(page, "quiver-leaf-back", "Back to Quiver Check", true, "Quiver call (in-app)");
    await checkAboveHeading(page, "quiver-leaf-back", ".quiver-call", "Quiver call (in-app)");

    // The lateral exits are additive, not replaced — they were explicitly kept.
    assert(await page.locator("#quiver-another-day").count() === 1, "Try a different day is still there");
    assert(await page.locator("#quiver-another-resort").count() === 1, "Check a different mountain is still there");

    await page.click("#quiver-leaf-back");
    await page.waitForTimeout(400);
    const landed = await page.evaluate(() => ({
      step: state.quiver.step,
      h1: document.querySelector("#app-main h1").textContent.trim(),
      focused: document.activeElement.textContent.trim(),
      selectedDays: document.querySelectorAll(".tap-chip--selected").length,
    }));
    assert(landed.step === "day", `back lands on the day picker, the step it came from (${landed.step})`);
    assert(landed.h1 === "Which day?", `the destination is the day picker (${landed.h1})`);
    assert(landed.focused === landed.h1, "focus moves to the destination's heading, matching house behaviour");
    assert(landed.selectedDays === 1,
      `the chosen day is still selected — a step back, not a reset (${landed.selectedDays})`);
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n3. Quiver call, cold-landed on a shared link — no history to use");
  // -------------------------------------------------------------------------
  {
    // A token for a day inside the forecast window, built from the app's own
    // clock so this works both in demo mode and in a live season.
    const seed = await newPage(ctx);
    await seed.goto(FILE_URL);
    const token = await seed.evaluate(() => {
      const d = new Date(appNow().getTime() + 2 * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return b64urlEncode(JSON.stringify({ v: 1, rid: "alta-ut", d: key }));
    });
    await seed.close();

    // A genuinely fresh page: a new tab from a group chat, not a hash change.
    const page = await newPage(ctx);
    await page.goto(FILE_URL + "#quiver=" + token);
    await page.waitForTimeout(2000);

    assert(await page.locator(".quiver-call").count() === 1, "the shared call renders on a cold landing");
    assert(await page.evaluate(() => state.quiver.hadPrev) === false,
      "the app knows this was a cold landing (hadPrev is false)");

    // The label must not say "back" to someone who has not been anywhere, and
    // must still say where it goes.
    await checkControl(page, "quiver-leaf-back", "Start a Quiver Check", false, "Quiver call (cold)");
    await checkAboveHeading(page, "quiver-leaf-back", ".quiver-call", "Quiver call (cold)");

    const before = await page.evaluate(() => ({ href: location.href, len: history.length }));
    await page.click("#quiver-leaf-back");
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({
      route: state.route,
      step: state.quiver.step,
      h1: document.querySelector("#app-main h1").textContent.trim(),
      focused: document.activeElement.textContent.trim(),
    }));
    assert(after.route === "quiver" && after.step === "resort",
      `it navigates into the surface's own entry point rather than backwards out of the app (${after.route}/${after.step})`);
    assert(after.h1 === "Where are you skiing?", `the destination is the mountain picker (${after.h1})`);
    assert(after.focused === after.h1, "focus moves to the destination's heading");
    assert(before.len >= 1, "and it did so without depending on a history entry that isn't there");
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n4. Chase the Snow resort detail — back returns to the ranked list");
  // -------------------------------------------------------------------------
  {
    const page = await newPage(ctx);
    await page.goto(FILE_URL);
    await page.click("#mode-chase");
    await page.waitForTimeout(1800);
    const rowsBefore = await page.locator(".chase-row").count();
    await page.locator(".chase-row").first().click();
    await page.waitForTimeout(900);

    assert(await page.evaluate(() => state.route) === "result",
      "a Chase row opens the shared result-card route");
    await checkControl(page, "result-leaf-back", "Back to Chase the snow", true, "Chase detail");
    await checkAboveHeading(page, "result-leaf-back", ".result-headline", "Chase detail");

    await page.click("#result-leaf-back");
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => ({
      route: state.route,
      h1: document.querySelector("#app-main h1").textContent.trim(),
      focused: document.activeElement.textContent.trim(),
      rows: document.querySelectorAll(".chase-row").length,
    }));
    assert(back.route === "chase", "back returns to Chase the Snow");
    assert(back.focused === back.h1, "focus moves to Chase's heading");
    assert(back.rows === rowsBefore && back.rows > 0,
      `the ranked list is restored from cache, not refetched (${back.rows} rows, was ${rowsBefore})`);
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n5. Trip-planner result — back returns to the last question");
  // -------------------------------------------------------------------------
  {
    const page = await newPage(ctx);
    await page.goto(FILE_URL);
    await page.click("#mode-plan");
    await page.waitForTimeout(400);
    for (let i = 0; i < 15; i++) {
      if (await page.locator("#result-card").count()) break;
      const chips = page.locator("#quiz-step-container .tap-chip");
      if (await chips.count()) await chips.first().click();
      await page.waitForTimeout(220);
      const cont = page.locator("#quiz-continue");
      if (await cont.count() && await cont.isEnabled()) { await cont.click(); await page.waitForTimeout(380); }
    }
    await page.waitForTimeout(700);
    assert(await page.locator("#result-card").count() === 1, "the quiz reaches a result");

    const lastStep = await page.evaluate(() => state.quizStepIdx);
    await checkControl(page, "result-leaf-back", "Back to your answers", true, "Trip result");
    await checkAboveHeading(page, "result-leaf-back", ".result-headline", "Trip result");

    await page.click("#result-leaf-back");
    await page.waitForTimeout(700);
    const back = await page.evaluate(() => ({
      route: state.route,
      idx: state.quizStepIdx,
      heading: (document.getElementById("quiz-step-heading") || {}).textContent,
      focused: document.activeElement.textContent.trim(),
      selected: document.querySelectorAll("#quiz-step-container .tap-chip--selected").length,
    }));
    assert(back.route === "plan", "back returns to the quiz");
    // The whole reason to press it is to change an answer. Dropping the user at
    // step 1 with their answers still filled in reads as "start over" for a
    // control labelled "Back to your answers".
    assert(back.idx === lastStep,
      `it lands on the question they last answered, not step 1 (idx ${back.idx}, was ${lastStep})`);
    assert(back.selected >= 1, `that answer is still selected (${back.selected})`);
    assert(back.focused === (back.heading || "").trim(), "focus moves to the question's heading");
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n6. Cold-landed share result — deliberately NO back control");
  // -------------------------------------------------------------------------
  {
    // Not an omission. A cold #result= link is not a leaf of anything: nobody
    // navigated into it, there is no list it belongs to, and the screen is
    // already required to carry zero nav chrome (verify_share_and_offline) —
    // it is a share artifact and the app's front door for whoever opened it.
    // Both honest destinations are already named in its footer. A control at
    // the top saying "back" to someone who has never been anywhere is exactly
    // the dishonest affordance this change exists to remove.
    const seed = await newPage(ctx);
    await seed.goto(FILE_URL);
    const token = await seed.evaluate(() => b64urlEncode(JSON.stringify({
      v: 1, rid: "alta-ut", reasonBullets: ["You said you want deep snow."],
      showRangeReadout: false, range: null,
    })));
    await seed.close();

    const page = await newPage(ctx);
    await page.goto(FILE_URL + "#result=" + token);
    await page.waitForTimeout(900);
    assert(await page.locator("#result-card").count() === 1, "the shared pick renders on a cold landing");
    assert(await page.evaluate(() => state.routeParams.origin) === undefined,
      "no in-app origin is recorded for a cold share link");
    assert(await page.locator("#result-leaf-back").count() === 0,
      "no back control is rendered — there is nothing behind this reader to return to");
    assert(await page.evaluate(() => document.getElementById("bottom-nav").hidden) === true,
      "and the screen's zero-nav-chrome rule is intact");
    assert(await page.locator("#make-own-btn").count() === 1 && await page.locator("#see-nicoles-btn").count() === 1,
      "its two honest destinations are still named in the footer");
    await page.close();
  }

  // -------------------------------------------------------------------------
  console.log("\n7. The control holds up across widths and at 200% zoom");
  // -------------------------------------------------------------------------
  for (const width of [320, 390, 1280]) {
    const c = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await newPage(c);
    await page.goto(FILE_URL);
    await page.click("#mode-chase");
    await page.waitForTimeout(1800);
    await page.locator(".chase-row").first().click();
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const e = document.getElementById("result-leaf-back");
      return { h: Math.round(e.getBoundingClientRect().height),
               overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    assert(m.h >= 44 && !m.overflow, `${width}px: 44px target, no horizontal overflow`, m);
    await c.close();
  }
  {
    // 200% text zoom. The label is a phrase rather than a word, so it has to be
    // allowed to wrap rather than push the page sideways.
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await newPage(c);
    await page.goto(FILE_URL);
    await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
    await page.click("#mode-chase");
    await page.waitForTimeout(1800);
    await page.locator(".chase-row").first().click();
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const e = document.getElementById("result-leaf-back");
      return { h: Math.round(e.getBoundingClientRect().height),
               overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    assert(m.h >= 44 && !m.overflow, "200% zoom: the label wraps instead of overflowing", m);
    await c.close();
  }

  assert(pageErrors.length === 0,
    `no page errors on any leaf route${pageErrors.length ? ": " + pageErrors.slice(0, 2) : ""}`);

  await browser.close();
  console.log(`\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})();
