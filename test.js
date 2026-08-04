const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
const SHOT_DIR = path.resolve(__dirname, 'screenshots');

async function run() {
  const browser = await chromium.launch();
  let anyConsoleError = false;
  const allErrors = [];

  for (const scheme of ['light', 'dark']) {
    for (const viewport of [{ w: 390, h: 844, label: '390' }, { w: 1280, h: 900, label: '1280' }]) {
      const context = await browser.newContext({
        viewport: { width: viewport.w, height: viewport.h },
        colorScheme: scheme,
      });
      const page = await context.newPage();
      // Simulate a fully blocked network (fonts + NOAA) to prove the app is
      // usable offline, and to keep the test run fast/deterministic instead
      // of waiting out real proxy retry/backoff on every font request.
      await page.route('**://fonts.googleapis.com/**', (route) => route.abort());
      await page.route('**://fonts.gstatic.com/**', (route) => route.abort());
      await page.route('**://api.weather.gov/**', (route) => route.abort());
      page.on('console', (msg) => {
        // "Failed to load resource" is the browser's own network-layer log
        // for the font/NOAA requests this test deliberately aborts (to prove
        // offline resilience) — not an application error. Anything else
        // logged at error level is a real signal.
        if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) {
          anyConsoleError = true;
          allErrors.push(`[${scheme}/${viewport.label}] ${msg.text()}`);
        }
      });
      page.on('pageerror', (err) => {
        anyConsoleError = true;
        allErrors.push(`[${scheme}/${viewport.label}] pageerror: ${err.message}`);
      });

      await page.goto(FILE_URL);
      await page.waitForTimeout(300);

      // Splash screenshot
      await page.screenshot({ path: `${SHOT_DIR}/splash-${scheme}-${viewport.label}.png` });

      // Walk the full quiz -> result
      await page.click('#mode-plan');
      await page.waitForTimeout(200);

      // Q1: wide-mixed (exercises Range Readout later)
      await page.click('[data-group="q1"][data-value="wide-mixed"]');
      await page.waitForTimeout(600);
      // Q2a multi-select: never-skied + expert
      await page.click('[data-group="q2a"][data-value="never-skied"]');
      await page.waitForTimeout(150);
      await page.click('[data-group="q2a"][data-value="expert"]');
      await page.waitForTimeout(150);
      await page.click('#quiz-continue');
      await page.waitForTimeout(600);
      // Q2b: mix
      await page.click('[data-group="q2b"][data-value="mix"]');
      await page.waitForTimeout(600);
      // Q3: budget mid
      await page.click('[data-group="q3"][data-value="$$"]');
      await page.waitForTimeout(600);
      // Q4a: driving
      await page.click('[data-group="q4a"][data-value="driving"]');
      await page.waitForTimeout(600);
      // Q4b: denver
      await page.click('[data-group="q4b"][data-value="denver"]');
      await page.waitForTimeout(600);
      // Q5: family
      await page.click('[data-group="q5"][data-value="family"]');
      await page.waitForTimeout(200);
      await page.click('#quiz-continue');
      await page.waitForTimeout(900);

      await page.screenshot({ path: `${SHOT_DIR}/result-${scheme}-${viewport.label}.png`, fullPage: true });

      // Chase the Snow
      await page.goto(FILE_URL);
      await page.waitForTimeout(200);
      await page.click('#mode-chase');
      await page.waitForTimeout(2500); // network blocked -> fast historical fallback, no need to wait out the 10s hard timer
      await page.screenshot({ path: `${SHOT_DIR}/chase-${scheme}-${viewport.label}.png`, fullPage: true });

      // Nicole's list
      await page.click('[data-route="nicoles"]:visible');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${SHOT_DIR}/nicoles-${scheme}-${viewport.label}.png`, fullPage: true });

      await context.close();
    }
  }

  await browser.close();

  console.log('Console/page errors found:', anyConsoleError);
  allErrors.forEach((e) => console.log(e));
  process.exit(anyConsoleError ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
