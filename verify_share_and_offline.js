const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
const checks = [];
function assert(name, cond) { checks.push({ name, pass: !!cond }); }

async function run() {
  const browser = await chromium.launch();

  // --- Fully offline: block ALL network requests outright ---
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => {
    if (route.request().url().startsWith('file://')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE_URL);
  await page.click('#mode-chase');
  await page.waitForTimeout(1500);
  const chaseHasRows = await page.$$eval('.chase-row', (els) => els.length > 0);
  assert('Chase-the-Snow renders a ranked list with network fully blocked', chaseHasRows);
  const fallbackBadgeVisible = await page.$eval('.freshness-badge--fallback', (el) => !!el).catch(() => false);
  assert('Fallback badge (not-live) renders when network is blocked', fallbackBadgeVisible);

  await page.click('[data-route="nicoles"]:visible');
  await page.waitForTimeout(300);
  const tableRows = await page.$$eval('#nicoles-table-wrap tbody tr', (els) => els.length);
  assert('Nicole\'s list renders fully offline', tableRows > 30);

  await page.click('[data-route="plan"]:visible');
  await page.waitForTimeout(300);
  assert('Plan-a-trip quiz renders fully offline', await page.$eval('#quiz-continue', (el) => !!el));
  assert('No JS errors while fully offline', errors.length === 0);

  // --- Share round-trip: build a result, grab its share link, open it cold ---
  await page.click('[data-group="q1"][data-value="matched"]');
  await page.waitForTimeout(600);
  await page.click('[data-group="q2a"][data-value="advanced"]');
  await page.waitForTimeout(600);
  await page.click('[data-group="q2b"][data-value="steep"]');
  await page.waitForTimeout(600);
  await page.click('[data-group="q3"][data-value="$$$"]');
  await page.waitForTimeout(600);
  await page.click('[data-group="q4a"][data-value="unsure"]');
  await page.waitForTimeout(600);
  await page.click('[data-group="q5"][data-value="noPreference"]');
  await page.waitForTimeout(200);
  await page.click('#quiz-continue');
  await page.waitForTimeout(900);

  const originalState = await page.evaluate(() => ({
    resortName: document.querySelector('.resort-name').textContent,
    badgeSvg: document.querySelector('.badge-panel svg').outerHTML,
    bullets: Array.from(document.querySelectorAll('.reason-bullet__text')).map((n) => n.textContent),
    eyebrow: document.querySelector('.result-eyebrow').textContent,
    hash: location.hash,
  }));
  assert('Result produced a share hash (#result=...)', originalState.hash.startsWith('#result='));
  assert('Freshly-generated result keeps "Your pick" / "You said" framing', originalState.eyebrow === 'Your pick' && originalState.bullets.some((b) => /\byou\b/i.test(b)));

  // Open that exact link cold, in a brand-new context (simulating the receiver)
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context2.route('**/*', (route) => {
    if (route.request().url().startsWith('file://')) return route.continue();
    return route.abort();
  });
  const page2 = await context2.newPage();
  await page2.goto(FILE_URL + originalState.hash);
  await page2.waitForTimeout(600);
  const receivedState = await page2.evaluate(() => ({
    resortName: document.querySelector('.resort-name') ? document.querySelector('.resort-name').textContent : null,
    badgeSvg: document.querySelector('.badge-panel svg') ? document.querySelector('.badge-panel svg').outerHTML : null,
    bullets: Array.from(document.querySelectorAll('.reason-bullet__text')).map((n) => n.textContent),
    eyebrow: document.querySelector('.result-eyebrow') ? document.querySelector('.result-eyebrow').textContent : null,
    navVisible: !document.getElementById('bottom-nav').hidden || !document.getElementById('top-nav').hidden,
    focusedIsHeadline: document.activeElement && document.activeElement.classList.contains('result-headline'),
  }));
  assert('Shared link reproduces the same resort name cold', receivedState.resortName === originalState.resortName);
  assert('Shared link reproduces the identical badge SVG', receivedState.badgeSvg === originalState.badgeSvg);
  // Cold-view fix (heuristic-evaluation.md H2): a cold recipient never
  // answered any questions, so the reason bullets and eyebrow must switch to
  // third person ("They said…" / "Their pick") rather than reproducing the
  // sender's literal "You said…" text verbatim — the underlying resort/data
  // is identical, but the pronoun framing must NOT be.
  assert('Cold-loaded share link uses "They said…" framing, not "You said…"', receivedState.bullets.every((b) => !/\byou\b|\byour\b/i.test(b)));
  assert('Cold-loaded share link eyebrow reads "Their pick", not "Your pick"', receivedState.eyebrow === 'Their pick');
  assert('Shared/cold-start result screen has zero nav chrome', !receivedState.navVisible);
  // M9 fix: keyboard/AT focus must land on the new content on arrival —
  // this is the cold-share-link path specifically named as most at risk,
  // since it's the one case where an aria-live announcement could race a
  // screen reader that hasn't finished attaching its listener yet.
  assert('Cold-loaded result screen moves focus to the headline on arrival (M9)', receivedState.focusedIsHeadline);

  // --- Absent hot-take renders nothing (no block, no placeholder) ---
  const noTakeCheck = await page2.evaluate(() => {
    const noTakeResort = RESORTS.find((r) => !r.hot_take);
    const payload = { v: 1, rid: noTakeResort.id, reasonBullets: ['Test bullet for a resort with no hot take.'], showRangeReadout: false, range: null };
    state.route = 'result';
    state.routeParams = { shared: payload };
    render();
    return { hasHotTakeBlock: !!document.getElementById('hot-take'), resortId: noTakeResort.id };
  });
  assert('Result card renders NO hot-take block when resort has none', !noTakeCheck.hasHotTakeBlock);

  await browser.close();
  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (errors.length) console.log('Page errors:', errors);
  process.exit(failed.length ? 1 : 0);
}
run();
