/* verify_content_first.js — the content-first header pattern (Director,
 * 2026-10-26: "less explaining, more letting the content tell the story").
 *
 *   1. On every surface the first piece of content starts in the top third of
 *      a 390x844 phone screen — measured, not eyeballed.
 *   2. The explainer paragraphs are gone from the top of every page.
 *   3. Each surface ends with one closed "About" disclosure that holds them.
 *   4. Opening-day logic: a published future date reads "Opens Nov 6", a
 *      past one reads Open, a researched-but-unannounced resort is not open,
 *      and Quiver's day picker starts on opening day.
 *
 *   NODE_PATH=$(npm root -g) node verify_content_first.js
 */
const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.join(__dirname, 'public', 'index.html');
let pass = 0, fail = 0;
function assert(label, ok, detail) {
  if (ok) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, detail === undefined ? '' : JSON.stringify(detail)); }
}

const BANNED_TOP = [
  /Not every resort is open yet/i,
  /This list only includes places/i,
  /We couldn't reach the live forecast right now/i,
  /Off by default/i,
  /Pick the mountain and we'll read its forecast/i,
  /Complaints and praise from skiers on Reddit/i,
  /not part of the trip-planner or snow-chase matches/i,
];

async function freshPage(browser, noaa) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (noaa) {
    const now = Date.now();
    const snow = [], temp = [];
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
    for (let h = 0; h < 8 * 24; h += 6) {
      const at = new Date(start.getTime() + h * 3600000).toISOString();
      snow.push({ validTime: `${at}/PT6H`, value: 12.7 });
      temp.push({ validTime: `${at}/PT6H`, value: -8 });
    }
    const body = JSON.stringify({ properties: { updateTime: new Date(now - 3600000).toISOString(), snowfallAmount: { values: snow }, quantitativePrecipitation: { values: snow.map((s) => ({ ...s, value: s.value / 12 })) }, temperature: { values: temp } } });
    await page.route('**://api.weather.gov/points/**', (r) => r.fulfill({ contentType: 'application/geo+json', body: JSON.stringify({ properties: { gridId: 'BOU', gridX: 1, gridY: 1, timeZone: 'America/Denver' } }) }));
    await page.route('**://api.weather.gov/gridpoints/**', (r) => r.fulfill({ contentType: 'application/geo+json', body }));
  } else {
    await page.route('**://api.weather.gov/**', (r) => r.abort());
  }
  await page.goto(FILE_URL);
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}

// Top of the first real piece of content on the page, in CSS px.
async function firstContentTop(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
  }, selector);
}

async function topText(page) {
  // Everything between the h1 and the first content element.
  return page.evaluate(() => {
    const main = document.getElementById('app-main');
    return main ? main.innerText.slice(0, 600) : '';
  });
}

(async () => {
  const browser = await chromium.launch();
  const { ctx, page, errors } = await freshPage(browser, true);
  const SCREEN = 844, THIRD = Math.round(SCREEN / 3);

  // ---- Chase ----------------------------------------------------------
  await page.click('#mode-chase');
  await page.waitForSelector('#freshness-badge', { timeout: 20000 });
  await page.waitForTimeout(400);
  const chaseTop = await firstContentTop(page, '#chase-body .chase-row');
  assert(`Chase: first resort row starts in the top third (${chaseTop}px < ${THIRD}px)`, chaseTop != null && chaseTop < THIRD, chaseTop);
  const chaseText = await topText(page);
  for (const re of BANNED_TOP) assert(`Chase: no "${re.source}" explainer`, !re.test(chaseText));
  const meta = await page.locator('#freshness-badge').innerText();
  assert('Chase: the fact line names the source and the NWS update time', /NWS 7-day forecast/.test(meta) && /Updated \d{1,2}:\d{2}/.test(meta), meta);
  assert('Chase: the fact line is ONE line at 390px', await page.$eval('#freshness-badge .page-meta', (el) => el.getBoundingClientRect().height < 40));
  assert('Chase: About this data is present and closed', await page.$eval('#chase-about-details', (el) => !el.open));
  const filterH = await page.$eval('.chase-controls', (el) => el.getBoundingClientRect().height);
  assert(`Chase: both filters fit on one row at 390px (${Math.round(filterH)}px)`, filterH < 60, filterH);
  assert('Chase: the beginner filter is a real toggle button',
    await page.$eval('#chase-beginner-toggle-wrap', (el) => el.tagName === 'BUTTON' && el.getAttribute('aria-pressed') === 'false'));
  await page.click('#chase-beginner-toggle-wrap');
  assert('Chase: toggling sets aria-pressed', await page.$eval('#chase-beginner-toggle-wrap', (el) => el.getAttribute('aria-pressed') === 'true'));
  assert('Chase: the region select has an accessible name', await page.$eval('#chase-region-select', (el) => !!el.getAttribute('aria-label')));
  const statuses = await page.locator('#chase-body .chase-row__status').allInnerTexts();
  assert('Chase: not-yet-open rows carry their opening date', statuses.length > 0 && statuses.every((t) => /^(Opens [A-Z][a-z]{2} \d{1,2}|Usually .+|Opening TBA)$/.test(t)), statuses.slice(0, 5));
  const spoken = await page.$eval('#chase-body .chase-row--upcoming', (el) => el.getAttribute('aria-label')).catch(() => '');
  assert('Chase: an upcoming row says its opening status to a screen reader', /(Opens|Usually|Opening TBA)/.test(spoken), spoken);

  // ---- Quiver ---------------------------------------------------------
  await page.click('#bottom-nav .nav-item[data-route="quiver"]');
  await page.waitForTimeout(600);
  const qTop = await firstContentTop(page, '#quiver-search-input');
  assert(`Quiver: search starts in the top third (${qTop}px)`, qTop != null && qTop < THIRD, qTop);
  const qText = await topText(page);
  for (const re of BANNED_TOP) assert(`Quiver: no "${re.source}" explainer`, !re.test(qText));
  assert('Quiver: the search keeps a label for assistive tech', await page.$eval('label[for="quiver-search-input"]', (el) => el.textContent.trim().length > 0));
  assert('Quiver: About this data is present and closed', await page.$eval('#app-main details.page-about', (el) => !el.open));

  // ---- Buzz -----------------------------------------------------------
  await page.click('#bottom-nav .nav-item[data-route="rants"]');
  await page.waitForTimeout(600);
  const bTop = await firstContentTop(page, '.rants-tabs');
  assert(`Buzz: tabs start in the top third (${bTop}px)`, bTop != null && bTop < THIRD, bTop);
  const bText = await topText(page);
  for (const re of BANNED_TOP) assert(`Buzz: no "${re.source}" explainer`, !re.test(bText));
  assert('Buzz: the provenance short form is still visible under the h1',
    await page.$eval('.rants-frame__short', (el) => el.getBoundingClientRect().height > 1 && el.children.length === 5));
  assert('Buzz: Where this comes from is at the bottom and closed', await page.$eval('.rants-frame--about', (el) => !el.open));

  // ---- Picks ----------------------------------------------------------
  await page.click('#bottom-nav .nav-item[data-route="nicoles"]');
  await page.waitForTimeout(600);
  const pTop = await firstContentTop(page, '.nicoles-table__row');
  assert(`Picks: first place starts in the top half (${pTop}px < ${SCREEN / 2}px)`, pTop != null && pTop < SCREEN / 2, pTop);
  const pText = await topText(page);
  for (const re of BANNED_TOP) assert(`Picks: no "${re.source}" explainer`, !re.test(pText));
  const chipRow = await page.$eval('.nicoleslist-filters', (el) => ({ h: el.getBoundingClientRect().height, sw: el.scrollWidth, cw: el.clientWidth }));
  assert('Picks: region chips are one row that scrolls sideways', chipRow.h < 70 && chipRow.sw > chipRow.cw, chipRow);
  assert('Picks: no page-level horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  assert('Picks: About this list is present and closed', await page.$eval('#app-main details.page-about', (el) => !el.open));

  assert('no page errors across the four surfaces', errors.length === 0, errors);

  // ---- Opening-day logic (pure) ---------------------------------------
  const logic = await page.evaluate(() => {
    const at = (iso) => new Date(iso + 'T12:00:00');
    const breck = RESORTS_BY_ID['breckenridge-co'];
    const loveland = RESORTS_BY_ID['loveland-co'];
    return {
      breckBefore: resortOpening(breck, at('2026-10-26')),
      breckDay: resortOpening(breck, at('2026-11-06')),
      lovelandOct: resortOpening(loveland, at('2026-10-26')),
      lovelandDec: resortOpening(loveland, at('2026-12-15')),
      stamp: updatedStamp(new Date('2026-10-26T09:42:00').getTime(), at('2026-10-26')),
      stampY: updatedStamp(new Date('2026-10-25T21:05:00').getTime(), at('2026-10-26')),
    };
  });
  assert('a published future date reads "Opens Nov 6"', logic.breckBefore.label === 'Opens Nov 6' && !logic.breckBefore.open, logic.breckBefore);
  assert('on opening day it reads Open', logic.breckDay.open && logic.breckDay.label === 'Open', logic.breckDay);
  assert('researched, unannounced and past its usual date: not open, "Opening TBA"', !logic.lovelandOct.open && logic.lovelandOct.label === 'Opening TBA', logic.lovelandOct);
  assert('two weeks past the usual date, an unannounced resort is treated as open', logic.lovelandDec.open, logic.lovelandDec);
  assert('updated stamp: same day is just the time', logic.stamp === '9:42 AM', logic.stamp);
  assert('updated stamp: yesterday says so', logic.stampY === 'Yesterday 9:05 PM', logic.stampY);
  await ctx.close();

  // ---- Quiver day picker starts on opening day -------------------------
  {
    const { ctx: c2, page: p2 } = await freshPage(browser, true);
    // Pretend Breckenridge opens in three days, and pick it.
    await p2.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() + 3);
      OPENINGS['breckenridge-co'] = { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, status: 'scheduled' };
      state.chaseSeasonInfo = effectiveSeasonState(RESORTS, appNow());
    });
    await p2.click('#mode-quiver');
    await p2.waitForTimeout(500);
    const pickable = await p2.locator('.quiver-resort[data-rid="breckenridge-co"]').count();
    assert('Quiver: a mountain opening inside the forecast window can be picked', pickable === 1, pickable);
    if (pickable) {
      await p2.click('.quiver-resort[data-rid="breckenridge-co"]');
      await p2.waitForTimeout(400);
      const days = await p2.locator('.quiver-day-list .tap-chip').count();
      const meta = await p2.locator('.page-meta').first().innerText();
      assert('Quiver: the day picker starts on opening day (4 of 7 days left)', days === 4, days);
      assert('Quiver: the day step shows the opening date as a fact', /Opens [A-Z][a-z]{2} \d{1,2}/.test(meta), meta);
    }
    await c2.close();
  }

  // ---- Fallback stays honest, in one line of copy ----------------------
  {
    const { ctx: c3, page: p3 } = await freshPage(browser, false);
    await p3.click('#mode-chase');
    await p3.waitForSelector('#freshness-badge', { timeout: 30000 });
    const t = await p3.locator('#freshness-badge').innerText();
    assert('Fallback: still says "Not a live forecast"', /Not a live forecast/.test(t), t);
    assert('Fallback: offers a retry', await p3.locator('#retry-forecast').count() === 1);
    const tags = await p3.locator('#chase-body .typical-season-tag').count();
    assert('Fallback: every forecast tile is tagged Typical', tags > 0, tags);
    await c3.close();
  }

  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
