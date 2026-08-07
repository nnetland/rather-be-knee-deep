// M4/M5 contrast fixes — measured against the ACTUAL rendered background
// each element sits on (not assumed from the token table), real relative
// luminance math, matching accessibility-review.md's own methodology.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');

function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function relLum([r, g, b]) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
function parseRgb(str) {
  // Plain rgb()/rgba() — the common case.
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  // Computed-style serialization of color-mix() results comes back as the
  // CSS Color 4 relative-color-syntax form "color(srgb r g b)" with
  // component values in the 0-1 range rather than 0-255 — the design system
  // uses color-mix() deliberately (styles.css), so the TEST needs to handle
  // this serialization, not the app.
  const c = str.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (c) return [+c[1] * 255, +c[2] * 255, +c[3] * 255];
  return null;
}
function contrast(rgb1, rgb2) {
  const l1 = relLum(rgb1), l2 = relLum(rgb2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
// Walk up the DOM to find the actual painted (non-transparent) background.
async function effectiveBg(page, selector) {
  return page.evaluate((sel) => {
    let el = document.querySelector(sel);
    while (el) {
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      el = el.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }, selector);
}

const checks = [];
function assert(name, cond, extra) { checks.push({ name, pass: !!cond, extra }); }

async function run() {
  const browser = await chromium.launch();

  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);

    if (scheme === 'dark') {
      // Nav active-tab label, on bg.tint/bg.surface (nav background)
      await page.click('#mode-plan');
      await page.waitForTimeout(200);
      const navFg = parseRgb(await page.$eval('.nav-item[aria-current="page"]', (el) => getComputedStyle(el).color)).length ? parseRgb(await page.$eval('.nav-item[aria-current="page"]', (el) => getComputedStyle(el).color)) : null;
      const navBg = parseRgb(await effectiveBg(page, '.nav-item[aria-current="page"]'));
      const navRatio = contrast(navFg, navBg);
      assert('Dark mode: nav active-tab label clears 4.5:1 on its real background', navRatio >= 4.5, { navRatio, navFg, navBg });

      // "Make your own pick" secondary button + "See more of Nicole's picks" link, on the result card
      await page.click('[data-group="q1"][data-value="solo"]');
      await page.waitForTimeout(700);
      await page.click('[data-group="q2a"][data-value="intermediate"]');
      await page.waitForTimeout(700);
      await page.click('[data-group="q2b"][data-value="mix"]');
      await page.waitForTimeout(700);
      await page.click('[data-group="q3"][data-value="$$"]');
      await page.waitForTimeout(700);
      await page.click('[data-group="q4a"][data-value="unsure"]');
      await page.waitForTimeout(700);
      await page.click('[data-group="q5"][data-value="family"]');
      await page.waitForTimeout(200);
      await page.click('#quiz-continue');
      await page.waitForTimeout(900);

      const btnFg = parseRgb(await page.$eval('#make-own-btn', (el) => getComputedStyle(el).color));
      const btnBg = parseRgb(await effectiveBg(page, '#make-own-btn'));
      const btnRatio = contrast(btnFg, btnBg);
      assert('Dark mode: "Make your own pick" button text clears 4.5:1 on its real background', btnRatio >= 4.5, { btnRatio, btnFg, btnBg });

      const linkFg = parseRgb(await page.$eval('#see-nicoles-btn', (el) => getComputedStyle(el).color));
      const linkBg = parseRgb(await effectiveBg(page, '#see-nicoles-btn'));
      const linkRatio = contrast(linkFg, linkBg);
      assert('Dark mode: "See more of Nicole\'s picks" link clears 4.5:1 on its real background', linkRatio >= 4.5, { linkRatio, linkFg, linkBg });
    }

    // Nicole's List "All regions" selected filter chip. Result screens (the
    // step just above, in the dark-mode branch) intentionally show zero nav
    // chrome, so getting to Nicole's List from there requires a fresh load
    // rather than a nav click — there is no nav to click.
    await page.goto(FILE_URL);
    await page.click('#mode-nicoles');
    await page.waitForTimeout(300);
    const chipFg = parseRgb(await page.$eval('.filter-chip--selected', (el) => getComputedStyle(el).color));
    const chipBg = parseRgb(await effectiveBg(page, '.filter-chip--selected'));
    const chipRatio = contrast(chipFg, chipBg);
    assert(`${scheme} mode: Nicole's List "All regions" selected chip clears 4.5:1`, chipRatio >= 4.5, { chipRatio, chipFg, chipBg });

    if (scheme === 'light') {
      // Forecast fallback badge text, on bg.tint.
      //
      // Demo mode has to be switched off to reach this badge at all, and that
      // is a correction rather than a workaround. While the invented season is
      // running, Chase the Snow takes the demo branch of the freshness slot
      // instead of the fallback branch — so from the day demo mode landed
      // until 2026-08-07 this assertion was silently measuring the demo pill
      // and reporting it as the "Not a live forecast" badge. Removing that
      // pill (Director's call, see verify_demo.js) emptied the slot and turned
      // a wrong-element pass into a hard selector failure, which is how the
      // substitution came to light.
      //
      // The cache is real: every resort resolved through the aborted-network
      // path above, so anyFallback is genuinely true and re-rendering with the
      // demo flag off produces the actual fallback badge in the actual page
      // cascade — not an injected probe.
      await page.goto(FILE_URL);
      await page.route('**://api.weather.gov/**', (r) => r.abort());
      await page.click('#mode-chase');
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        if (typeof DEMO !== 'undefined' && DEMO.active()) { DEMO._activeCache = false; renderChaseList(); }
      });
      await page.waitForSelector('.freshness-badge--fallback .freshness-badge__text');
      const badgeFg = parseRgb(await page.$eval('.freshness-badge__text', (el) => getComputedStyle(el).color));
      const badgeBg = parseRgb(await effectiveBg(page, '.freshness-badge__text'));
      const badgeRatio = contrast(badgeFg, badgeBg);
      assert('Light mode: "Not a live forecast" badge text clears 4.5:1 on bg.tint', badgeRatio >= 4.5, { badgeRatio, badgeFg, badgeBg });
    }

    // M5: "Nicole's take" chip vs. crowd-warning chip must be visually
    // distinct colours (not the same token/hex). Whether any resort with a
    // hot_take happens to land in today's top forecast rows is random (only
    // 9/71 resorts have one), so rather than depend on that, inject both
    // chip markups directly into the live Chase screen (inheriting real
    // page theme/cascade) and read their computed colours.
    await page.goto(FILE_URL);
    if (scheme !== 'light') await page.route('**://api.weather.gov/**', (r) => r.abort());
    await page.click('#mode-chase');
    await page.waitForTimeout(1500);
    const flagColors = await page.evaluate(() => {
      const host = document.querySelector('.chase-row__flags') || document.querySelector('main') || document.body;
      const probe = document.createElement('span');
      probe.innerHTML = '<span class="chase-flag chase-flag--nicole">● Nicole\'s take →</span><span class="chase-flag chase-flag--crowd">Heads up</span>';
      host.appendChild(probe);
      const nicole = probe.querySelector('.chase-flag--nicole');
      const crowd = probe.querySelector('.chase-flag--crowd');
      const result = {
        nicole: nicole ? getComputedStyle(nicole).color : null,
        crowd: crowd ? getComputedStyle(crowd).color : null,
      };
      probe.remove();
      return result;
    });
    assert(`${scheme} mode: "Nicole's take" chip colour is defined (--accent-gold-text no longer undefined)`, !!flagColors.nicole, flagColors);
    if (flagColors.nicole && flagColors.crowd) {
      assert(`${scheme} mode: "Nicole's take" chip colour is DISTINCT from the crowd-warning chip`, flagColors.nicole !== flagColors.crowd, flagColors);
    }

    await context.close();
  }

  await browser.close();
  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name, c.pass ? '' : JSON.stringify(c.extra)));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
run();
