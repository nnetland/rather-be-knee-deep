#!/usr/bin/env node
// ---------------------------------------------------------------------------
// verify_browse_swipe.js — swiping through resort pages (2026-11-23).
//
// A resort page opened from Chase or Picks lets you move to the next/previous
// resort on that list, in the list's on-screen order, by swipe, by the pager
// arrows, or by ←/→. Back goes straight to the list (not back through every
// page swiped past) and lands on the resort you were last looking at.
// Plan results and cold-landed share links get no pager.
// ---------------------------------------------------------------------------
const path = require("path");
const { chromium } = require("playwright");

const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");
let failures = 0, checks = 0;
const pageErrors = [];
function assert(cond, msg, extra) {
  checks += 1;
  if (cond) console.log("  PASS", msg);
  else { failures += 1; console.error("  FAIL", msg, extra === undefined ? "" : JSON.stringify(extra)); }
}

async function newPage(browser, mobile) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 375, height: 800 }, hasTouch: true, isMobile: true }
    : { viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date("2027-01-20T10:00:00"));
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  await p.route("**://fonts.g**/**", (r) => r.abort());
  await p.route("**://api.weather.gov/**", (r) => r.abort());
  return p;
}

async function swipe(page, dx) {
  await page.evaluate((dx) => {
    const wrap = document.querySelector(".result-wrap");
    const y = 400, x0 = 190;
    const mk = (x) => new Touch({ identifier: 1, target: wrap, clientX: x, clientY: y });
    wrap.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(x0)], changedTouches: [mk(x0)], bubbles: true }));
    wrap.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [mk(x0 + dx)], bubbles: true }));
  }, dx);
  await page.waitForTimeout(80);
}

const rid = (page) => page.evaluate(() => state.routeParams.shared && state.routeParams.shared.rid);

(async () => {
  const browser = await chromium.launch();

  for (const [label, mode, rowSel] of [["Chase", "#mode-chase", "#chase-body .chase-row[data-rid]"], ["Picks", "#mode-nicoles", "#nicoles-table-wrap .nicoles-place[data-rid]"]]) {
    console.log(`\n${label}`);
    const page = await newPage(browser, true);
    await page.goto(FILE_URL);
    await page.click(mode);
    await page.waitForSelector(rowSel);
    const listOrder = await page.$$eval(rowSel, (els) => [...new Set(els.map((e) => e.dataset.rid))]);
    assert(listOrder.length > 3, `${label}: list has resorts to browse`, listOrder.length);

    await page.locator(rowSel).nth(1).click();
    await page.waitForSelector("#result-card");
    assert(await rid(page) === listOrder[1], `${label}: tapping row 2 opens row 2`);
    assert(await page.locator(".result-pager").count() === 1, `${label}: pager renders`);
    const count = await page.locator(".result-pager__count").textContent();
    assert(count.trim() === `2 / ${listOrder.length}`, `${label}: position reads 2 / N`, count);
    const nextName = await page.locator("#result-pager-next").getAttribute("aria-label");
    assert(/^Next on (Chase|Picks): /.test(nextName), `${label}: next button names where it goes`, nextName);
    const depth0 = await page.evaluate(() => history.state.depth);

    await swipe(page, -120);
    assert(await rid(page) === listOrder[2], `${label}: swipe left goes to the next resort in list order`);
    await swipe(page, -120);
    assert(await rid(page) === listOrder[3], `${label}: and again`);
    await swipe(page, 120);
    assert(await rid(page) === listOrder[2], `${label}: swipe right goes back one`);
    await swipe(page, -30);
    assert(await rid(page) === listOrder[2], `${label}: a short drag does nothing`);
    assert(await page.evaluate(() => history.state.depth) === depth0, `${label}: swiping adds no history entries`);
    assert((await page.evaluate(() => location.hash)).startsWith("#result="), `${label}: URL is the current resort's share link`);
    const hashRid = await page.evaluate(() => JSON.parse(atob(location.hash.slice(8).replace(/-/g, "+").replace(/_/g, "/"))).rid);
    assert(hashRid === listOrder[2], `${label}: share link points at the resort on screen`);

    await page.click("#result-pager-prev");
    assert(await rid(page) === listOrder[1], `${label}: prev button works`);
    assert(await page.evaluate(() => document.activeElement.id) === "result-pager-prev", `${label}: focus stays on the prev button`);
    await page.keyboard.press("ArrowLeft");
    assert(await rid(page) === listOrder[0], `${label}: ← goes back one`);
    assert(await page.locator("#result-pager-prev").count() === 0, `${label}: no prev button on the first resort`);
    await swipe(page, 120);
    assert(await rid(page) === listOrder[0], `${label}: swiping past the start stays put`);
    await page.keyboard.press("ArrowRight");
    assert(await rid(page) === listOrder[1], `${label}: → goes forward`);

    await page.click("#result-leaf-back");
    await page.waitForTimeout(150);
    const back = await page.evaluate(() => ({ route: state.route, rid: document.activeElement.dataset.rid || (document.activeElement.closest("[data-rid]") || {}).dataset?.rid }));
    assert(back.route === (label === "Chase" ? "chase" : "nicoles"), `${label}: one Back returns to the list`, back);
    assert(back.rid === listOrder[1], `${label}: focus lands on the resort last viewed`, back);
    await page.context().close();
  }

  console.log("\nNo pager where there's no list");
  const page = await newPage(browser, false);
  await page.goto(FILE_URL);
  await page.click("#mode-chase");
  await page.waitForSelector("#chase-body .chase-row[data-rid]");
  await page.locator("#chase-body .chase-row[data-rid]").first().click();
  const token = await page.evaluate(() => location.hash);
  const cold = await newPage(browser, false);
  await cold.goto(FILE_URL + token);
  await cold.waitForSelector("#result-card");
  assert(await cold.locator(".result-pager").count() === 0, "cold share link: no pager");
  await cold.keyboard.press("ArrowRight");
  assert(await cold.evaluate(() => state.route) === "result", "cold share link: arrows do nothing");

  await browser.close();
  assert(pageErrors.length === 0, "no page errors", pageErrors);
  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(failures ? 1 : 0);
})();
