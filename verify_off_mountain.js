/* verify_off_mountain.js — P20, "Off the mountain" as one local pick.
 *
 * Holds the authoring rules (one sentence, 65 characters max, a source per
 * row, no pick shared between resorts) and the rendering rules (one linked
 * sentence, the external arrow never wraps alone, no sideways scroll at
 * 320px, resorts without a pick fall back to the general line).
 *
 *   NODE_PATH=$(npm root -g) node verify_off_mountain.js
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const FILE_URL = "file://" + path.join(__dirname, "public", "index.html");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "research", "off-mountain.json")));
let pass = 0, fail = 0;
function assert(label, ok, detail) {
  if (ok) { pass++; console.log("PASS", label); }
  else { fail++; console.log("FAIL", label, detail === undefined ? "" : JSON.stringify(detail)); }
}

(async () => {
  // Authoring rules, on the data file itself.
  const picks = Object.entries(DATA).filter(([, v]) => v);
  const long = picks.filter(([, v]) => v.line.length > 65).map(([k, v]) => [k, v.line.length]);
  assert("every line is 65 characters or fewer", long.length === 0, long);
  const notOneSentence = picks.filter(([, v]) => !/\.$/.test(v.line) || /\.\s+\S/.test(v.line)).map(([k]) => k);
  assert("every line is one sentence ending in a period", notOneSentence.length === 0, notOneSentence);
  const badUrl = picks.filter(([, v]) => !/^https:\/\//.test(v.url || "")).map(([k]) => k);
  assert("every pick links to an https source", badUrl.length === 0, badUrl);
  const names = {};
  picks.forEach(([k, v]) => { const n = (v.name || "").toLowerCase(); (names[n] = names[n] || []).push(k); });
  const shared = Object.entries(names).filter(([n, ks]) => n && ks.length > 1);
  assert("no two resorts share a pick", shared.length === 0, shared);
  const noDistance = picks.filter(([, v]) => /\b\d+\s*(min|minutes|mi|miles|km)\b/i.test(v.line)).map(([k]) => k);
  assert("no drive time or distance in a line", noDistance.length === 0, noDistance);

  const browser = await chromium.launch();
  const ids = await (async () => {
    const page = await browser.newPage();
    await page.goto(FILE_URL);
    const r = await page.evaluate(() => RESORTS.map((x) => x.id));
    await page.close();
    return r;
  })();
  const missing = ids.filter((id) => !(id in DATA));
  assert("every resort has an entry (a pick or an explicit null)", missing.length === 0, missing);

  const withPick = picks.map(([k]) => k).filter((k) => ids.includes(k));
  const without = ids.filter((id) => !DATA[id]);
  const sample = [...withPick.slice(0, 6), ...without.slice(0, 2)];
  for (const width of [320, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } });
    for (const id of sample) {
      const page = await ctx.newPage();
      await page.goto(FILE_URL + "#resort=" + id);
      await page.waitForSelector(".notes-list", { timeout: 15000 });
      const info = await page.evaluate(() => {
        const row = [...document.querySelectorAll(".notes-row")].find((r) => /off the mountain/i.test(r.querySelector("dt").textContent));
        const a = row && row.querySelector("a.offmtn-link");
        const arrow = a && a.querySelector(".offmtn-link__out");
        let alone = false;
        if (arrow) {
          const end = a.querySelector(".offmtn-link__end").getBoundingClientRect();
          const ar = arrow.getBoundingClientRect();
          alone = Math.abs(end.top - ar.top) > 4 && end.width < ar.width + 10;
        }
        return {
          hasRow: !!row, link: !!a, newTab: a ? a.target === "_blank" && /noopener/.test(a.rel) : null,
          arrowAlone: alone, text: row ? row.querySelector("dd").textContent.trim() : "",
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      if (DATA[id]) {
        assert(`${width}px ${id}: the pick renders as one link`, info.link && info.text.startsWith(DATA[id].line.split(" ")[0]), info);
        assert(`${width}px ${id}: link opens a new tab safely`, info.newTab === true, info);
        assert(`${width}px ${id}: arrow never wraps alone`, !info.arrowAlone, info);
      } else {
        assert(`${width}px ${id}: no pick falls back to the general line, unlinked`, info.hasRow && !info.link && info.text.length > 0, info);
      }
      assert(`${width}px ${id}: no sideways scroll`, !info.overflow, info);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
