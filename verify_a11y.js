const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');

const checks = [];
function assert(name, cond) { checks.push({ name, pass: !!cond }); }

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.goto(FILE_URL);

  // Skip link present
  assert('skip link exists and points to #app-main', await page.$eval('.skip-link', (el) => el.getAttribute('href') === '#app-main'));

  // Splash: buttons are real <button> elements, live-region announcers exist
  assert('reveal-announcer exists with aria-live polite', await page.$eval('#reveal-announcer', (el) => el.getAttribute('aria-live') === 'polite'));
  assert('forecast-status-announcer exists with aria-live polite', await page.$eval('#forecast-status-announcer', (el) => el.getAttribute('aria-live') === 'polite'));
  assert('mode-plan is a real button', await page.$eval('#mode-plan', (el) => el.tagName === 'BUTTON'));

  // Enter quiz, check progressbar semantics
  await page.click('#mode-plan');
  await page.waitForTimeout(200);
  const progress = await page.$eval('[role="progressbar"]', (el) => ({
    min: el.getAttribute('aria-valuemin'), max: el.getAttribute('aria-valuemax'),
    now: el.getAttribute('aria-valuenow'), text: el.getAttribute('aria-valuetext'),
  }));
  assert('progressbar has valuemin=1', progress.min === '1');
  assert('progressbar has valuemax=5', progress.max === '5');
  assert('progressbar has valuenow=1 on first step', progress.now === '1');
  assert('progressbar valuetext mentions step', /Step 1 of 5/.test(progress.text || ''));

  // Tap-chips have radio role for single-select
  const chipRole = await page.$eval('.tap-chip[data-group="q1"]', (el) => el.getAttribute('role'));
  assert('q1 tap-chip has role=radio (single-select)', chipRole === 'radio');

  // Keyboard operability: Tab should reach a tap-chip and Enter/Space should activate it
  await page.keyboard.press('Tab'); // skip link
  await page.keyboard.press('Tab'); // first focusable in step (likely back button or first chip)
  const focusedTag = await page.evaluate(() => document.activeElement.tagName);
  assert('keyboard focus lands on a real interactive element', focusedTag === 'BUTTON' || focusedTag === 'A');

  // Explicit Continue control exists and is a real button, independent of auto-advance
  const continueBtn = await page.$('#quiz-continue');
  assert('explicit Continue control exists', !!continueBtn);
  const continueIsButton = await page.$eval('#quiz-continue', (el) => el.tagName === 'BUTTON');
  assert('Continue is a real <button>', continueIsButton);

  // Multi-select screen uses checkbox role
  await page.click('[data-group="q1"][data-value="wide-mixed"]');
  await page.waitForTimeout(500);
  const multiRole = await page.$eval('.tap-chip[data-group="q2a"]', (el) => el.getAttribute('role'));
  assert('q2a tap-chip has role=checkbox (multi-select)', multiRole === 'checkbox');

  // Focus moves to the new step heading after transition (screen-reader orientation)
  const headingFocused = await page.evaluate(() => document.activeElement.tagName === 'H2');
  assert('focus moves to step heading on step change', headingFocused);

  // Complete quiz to result and check result accessibility
  await page.click('[data-group="q2a"][data-value="never-skied"]');
  await page.click('[data-group="q2a"][data-value="expert"]');
  await page.click('#quiz-continue');
  await page.waitForTimeout(500);
  await page.click('[data-group="q2b"][data-value="mix"]');
  await page.waitForTimeout(500);
  await page.click('[data-group="q3"][data-value="$$"]');
  await page.waitForTimeout(500);
  await page.click('[data-group="q4a"][data-value="driving"]');
  await page.waitForTimeout(500);
  await page.click('[data-group="q4b"][data-value="denver"]');
  await page.waitForTimeout(500);
  await page.click('[data-group="q5"][data-value="family"]');
  await page.waitForTimeout(200);
  await page.click('#quiz-continue');
  await page.waitForTimeout(900);

  // Result: h1 present, badge panel has role=img + aria-label, no bottom nav chrome
  assert('result has an h1 headline', await page.$eval('h1', (el) => !!el).catch(() => false));
  const badgeLabel = await page.$eval('.badge-panel', (el) => ({ role: el.getAttribute('role'), label: el.getAttribute('aria-label') })).catch(() => null);
  assert('badge panel has role=img', badgeLabel && badgeLabel.role === 'img');
  assert('badge panel has a non-empty descriptive aria-label', badgeLabel && badgeLabel.label && badgeLabel.label.length > 10);
  const svgHidden = await page.$eval('.badge-panel svg', (el) => el.getAttribute('aria-hidden') === 'true');
  assert('inner badge SVG is aria-hidden (label carried by wrapper)', svgHidden);
  const navHiddenOnResult = await page.$eval('#bottom-nav', (el) => el.hidden);
  assert('bottom nav is hidden on the result screen (Principle 1)', navHiddenOnResult);
  const topNavHiddenOnResult = await page.$eval('#top-nav', (el) => el.hidden);
  assert('top nav is hidden on the result screen (Principle 1)', topNavHiddenOnResult);

  // Range Readout has a single summarizing aria-label
  const rangeLabel = await page.$eval('.range-readout', (el) => el.getAttribute('aria-label')).catch(() => null);
  assert('Range Readout has a summarizing aria-label', rangeLabel && rangeLabel.length > 20);

  // Reduced motion path: reload with reduced motion and confirm reveal still completes + announcer fires
  await page.close();
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page2 = await context2.newPage();
  await page2.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page2.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page2.goto(FILE_URL);
  await page2.click('#mode-plan');
  await page2.click('[data-group="q1"][data-value="solo"]');
  await page2.waitForTimeout(600); // single-select: relies on auto-advance
  await page2.click('[data-group="q2a"][data-value="intermediate"]');
  await page2.waitForTimeout(600);
  await page2.click('[data-group="q2b"][data-value="mix"]');
  await page2.waitForTimeout(600);
  await page2.click('[data-group="q3"][data-value="$$"]');
  await page2.waitForTimeout(600);
  await page2.click('[data-group="q4a"][data-value="unsure"]');
  await page2.waitForTimeout(600);
  await page2.click('[data-group="q5"][data-value="noPreference"]');
  await page2.waitForTimeout(200);
  await page2.click('#quiz-continue'); // final step: explicit control required
  await page2.waitForTimeout(400);
  const announced = await page2.$eval('#reveal-announcer', (el) => el.textContent);
  assert('reduced-motion path still announces "Your pick is ready"', /ready/i.test(announced || ''));
  const cardOpacity = await page2.$eval('#result-card', (el) => getComputedStyle(el).opacity);
  assert('result card is fully visible (not stuck mid-fade) under reduced motion', parseFloat(cardOpacity) === 1);

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
run();
