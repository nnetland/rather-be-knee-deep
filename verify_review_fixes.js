/* verify_review_fixes.js — the heuristic review of 2026-11-21 (HR-1 to HR-27).
 * See the project doc "Heuristic review 2026-11-21". Each block names the item
 * it holds in place.
 *
 *   NODE_PATH=$(npm root -g) node verify_review_fixes.js
 */
const { chromium } = require("playwright");
const path = require("path");

const FILE_URL = "file://" + path.join(__dirname, "public", "index.html");
let pass = 0, fail = 0;
function assert(label, ok, detail) {
  if (ok) { pass++; console.log("PASS", label); }
  else { fail++; console.log("FAIL", label, detail === undefined ? "" : JSON.stringify(detail)); }
}
const route = (page) => page.evaluate(() => state.route);

(async () => {
  const browser = await chromium.launch();
  const phone = { viewport: { width: 390, height: 844 } };
  const desk = { viewport: { width: 1440, height: 900 } };

  // HR-1 + HR-11: browser Back from a Chase resort page returns to Chase, on the row.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    await page.click('#bottom-nav .nav-item[data-route="chase"]');
    await page.waitForSelector("#chase-body .chase-row[data-rid]", { timeout: 15000 });
    const rows = page.locator("#chase-body .chase-row[data-rid]");
    const target = rows.nth(4);
    const rid = await target.getAttribute("data-rid");
    await target.scrollIntoViewIfNeeded();
    await target.click();
    await page.waitForTimeout(300);
    assert("HR-1: a Chase row opens the resort page", (await route(page)) === "result");
    await page.goBack();
    await page.waitForTimeout(500);
    assert("HR-1: browser Back returns to Chase, not out of the app", (await route(page)) === "chase");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.rid);
    assert("HR-11: focus lands on the row that opened the resort page", focused === rid, { focused, rid });
    { const y = await page.evaluate(() => window.scrollY); const inView = await page.evaluate((id) => { const r = document.querySelector(`.chase-row[data-rid="${id}"]`).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, rid); assert("HR-11: and the row is on screen", inView, { y }); }
    await page.goForward();
    await page.waitForTimeout(400);
    assert("HR-1: Forward reopens the resort page", (await route(page)) === "result");
    // In-app Back does the same as the browser's.
    await page.click("#result-leaf-back");
    await page.waitForTimeout(500);
    assert("HR-1: in-app 'Back to Chase' returns to Chase", (await route(page)) === "chase");
    await page.close();
  }

  // HR-1 on Picks, HR-11 focus on the place button.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    await page.click('#bottom-nav .nav-item[data-route="nicoles"]');
    await page.waitForTimeout(300);
    const btn = page.locator('.nicoles-place[data-rid="vail-co"]');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await page.waitForTimeout(300);
    assert("HR-10: a resort opened from Picks has no 'Your pick' eyebrow", (await page.locator(".result-eyebrow").count()) === 0);
    assert("HR-10: its Share button reads 'Share', not 'Share this pick'", /^\s*Share\s*$/.test(await page.locator("#share-btn").innerText()));
    await page.goBack();
    await page.waitForTimeout(500);
    assert("HR-1: Back from a Picks resort returns to Picks", (await route(page)) === "nicoles");
    const f = await page.evaluate(() => document.activeElement && document.activeElement.dataset.rid);
    assert("HR-11: focus is on the Vail row's button", f === "vail-co", f);
    await page.close();
  }

  // HR-1 in Quiver: picker -> day -> call, then Back, Back.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    await page.click('#bottom-nav .nav-item[data-route="quiver"]');
    await page.waitForTimeout(300);
    const r = page.locator(".quiver-resort[data-rid]").first();
    if (await r.count()) {
      await r.click();
      await page.waitForTimeout(200);
      await page.locator(".quiver-day-list .tap-chip").first().click();
      await page.waitForTimeout(1500);
      assert("Quiver reaches the call", (await page.evaluate(() => state.quiver.step)) === "result");
      assert("HR-16: the call has no 'The call' eyebrow", !(await page.locator("#quiver-card").innerText()).includes("THE CALL"));
      const caveatHits = ((await page.locator("#quiver-card").innerText()).match(/not a live forecast/gi) || []).length;
      assert("HR-16: 'not a live forecast' appears at most once", caveatHits <= 1, caveatHits);
      assert("HR-26: Share is also at the top of the call", (await page.locator("#quiver-share-top").count()) === 1);
      await page.goBack();
      await page.waitForTimeout(300);
      assert("HR-1: Back from the call returns to the day picker", (await page.evaluate(() => state.quiver.step)) === "day");
      assert("HR-1: with the chosen day still selected", (await page.locator('.quiver-day-list .tap-chip[aria-checked="true"]').count()) === 1);
      await page.goBack();
      await page.waitForTimeout(300);
      assert("HR-1: Back again returns to the resort picker", (await page.evaluate(() => state.quiver.step)) === "resort");
    } else {
      assert("Quiver has a pickable resort today (skipped otherwise)", true);
    }
    await page.close();
  }

  // HR-3: Plan resumes on re-entry.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    await page.click('#bottom-nav .nav-item[data-route="plan"]');
    await page.click('[data-group="q1"][data-value="matched"]');
    await page.click("#quiz-continue");
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => state.quizStepIdx);
    await page.click('#bottom-nav .nav-item[data-route="chase"]');
    await page.waitForTimeout(200);
    await page.click('#bottom-nav .nav-item[data-route="plan"]');
    await page.waitForTimeout(300);
    assert("HR-3: leaving and re-entering Plan keeps your step", (await page.evaluate(() => state.quizStepIdx)) === before, before);
    await page.click('#bottom-nav .nav-item[data-route="plan"]');
    await page.waitForTimeout(300);
    assert("HR-3: re-tapping the Plan tab keeps your step", (await page.evaluate(() => state.quizStepIdx)) === before);
    assert("HR-6: Plan sets its own title", /^Plan/.test(await page.title()), await page.title());
    assert("HR-20: no visible 'Step n of 5' text", (await page.locator(".progress-label").count()) === 0);
    assert("HR-20: 'Start over' only on the last step", (await page.locator("#quiz-start-over").count()) === 0);
    const backBox = await page.locator("#quiz-back").boundingBox();
    assert("HR-7: Plan's Back is at least 44x44", backBox.width >= 44 && backBox.height >= 44, backBox);
    await page.close();
  }

  // HR-4: coral status uses the dark-safe token.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    const { c, token } = await page.evaluate(() => {
      const el = document.createElement("span");
      el.className = "chase-row__status chase-row__status--soon";
      document.body.appendChild(el);
      const probe = document.createElement("span");
      probe.style.color = "var(--accent-coral-text)";
      document.body.appendChild(probe);
      return { c: getComputedStyle(el).color, token: getComputedStyle(probe).color };
    });
    assert("HR-4: coral status text is --accent-coral-text", c === token, { c, token });
    await page.close();
  }

  // HR-5: #resort=<id> (what a share page forwards to without its fragment).
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL + "#resort=alta-ut");
    await page.waitForTimeout(400);
    assert("HR-5: #resort= opens that resort's page", (await route(page)) === "result" &&
      (await page.locator(".resort-name").innerText()) === "Alta");
    assert("HR-5: and rewrites the URL to a normal #result= link", page.url().includes("#result="));
    assert("HR-8: a cold-landed resort page shows the main nav", await page.evaluate(() => !document.getElementById("bottom-nav").hidden));
    assert("HR-9: a cold-landed page offers 'Find yours'", (await page.locator("#result-find-yours").count()) === 1);
    assert("HR-10: a cold-landed page still reads 'Their pick'", (await page.locator(".result-eyebrow").innerText()).toLowerCase() === "their pick");
    assert("HR-15: no empty Terrain mix tile for a resort without a breakdown", (await page.locator("#terrain-strip").count()) === 0);
    assert("HR-15: the gap is one 'Terrain: Not published' row instead", (await page.locator(".notes-list").innerText()).includes("Not published by the resort"));
    const order = await page.evaluate(() => {
      const t = document.getElementById("hot-take"), n = document.querySelector(".notes-list");
      return t && n ? !!(t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    });
    assert("HR-15: Nicole's take sits above the detail notes", order === true, order);
    assert("HR-15: no '— Nicole, on …' attribution line", (await page.locator(".hot-take__attribution").count()) === 0);
    const bullets = await page.locator(".reason-bullet").allInnerTexts();
    assert("HR-15: no crowd or annual-average bullet duplicating the page", !bullets.some((b) => /crowd|busy|Averages about/i.test(b)), bullets);
    await page.close();
  }

  // HR-8: no home sticker on section pages; desktop top nav carries it.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    for (const r of ["chase", "quiver", "buzz", "plan", "nicoles"]) {
      await page.click(`#bottom-nav .nav-item[data-route="${r}"]`);
      await page.waitForTimeout(200);
      assert(`HR-8: no home sticker on ${r}`, (await page.locator("#app-main .home-link").count()) === 0);
    }
    await page.close();
    const d = await (await browser.newContext(desk)).newPage();
    await d.goto(FILE_URL);
    await d.click('#top-nav .nav-item[data-route="nicoles"]');
    await d.waitForTimeout(300);
    assert("HR-8 / P14: desktop top nav carries the home button", await d.locator("#top-nav .nav-home").isVisible());
    await d.click("#top-nav .nav-home");
    await d.waitForTimeout(200);
    assert("HR-8: it goes home", (await route(d)) === "splash");
    // HR-2: Picks rows don't overlap on desktop.
    await d.click('#top-nav .nav-item[data-route="nicoles"]');
    await d.waitForTimeout(300);
    const overlap = await d.evaluate(() => Array.from(document.querySelectorAll(".nicoles-table__row")).some((row) => {
      const name = row.querySelector(".nicoles-place__name"), verdict = row.querySelector(".take-verdict");
      if (!name || !verdict) return false;
      const a = name.getBoundingClientRect(), b = verdict.getBoundingClientRect();
      return !(a.bottom <= b.top || a.right <= b.left);
    }));
    assert("HR-2: no Picks name overlaps its verdict at 1440", !overlap);
    assert("HR-14: no Region column on Picks", (await d.locator(".nicoles-table__cell--region").count()) === 0);
    // HR-21: one chip row on desktop.
    const tops = await d.$$eval("#nicoles-area-chips .filter-chip", (els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
    assert("HR-21: region chips are one row on desktop", tops === 1, tops);
    // HR-12: Plan first on home.
    await d.click("#top-nav .nav-home");
    await d.waitForTimeout(200);
    assert("HR-12: Plan is the first, primary tile on Home",
      await d.evaluate(() => document.querySelector(".splash-modes .mode-card").id === "mode-plan" && document.getElementById("mode-plan").classList.contains("mode-card--primary")));
    await d.close();
  }

  // HR-7: 200% text at 320px doesn't scroll sideways on Quiver or Plan.
  {
    const page = await (await browser.newContext({ viewport: { width: 320, height: 640 } })).newPage();
    await page.goto(FILE_URL);
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    for (const r of ["quiver", "plan"]) {
      await page.click(`#bottom-nav .nav-item[data-route="${r}"]`);
      await page.waitForTimeout(300);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(`HR-7: no sideways scroll on ${r} at 320px, 200% text`, over <= 1, over);
    }
    await page.close();
  }

  // HR-18: Buzz.
  {
    const page = await (await browser.newContext(phone)).newPage();
    await page.goto(FILE_URL);
    await page.click('#bottom-nav .nav-item[data-route="buzz"]');
    await page.waitForTimeout(200);
    assert("HR-18: no 'Resorts' subhead", (await page.locator(".buzz-subhead").count()) === 0);
    assert("HR-18: region headings are small group labels", (await page.locator(".buzz-region h2.display-h2").count()) === 0);
    await page.close();
  }

  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
