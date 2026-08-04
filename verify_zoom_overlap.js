// Evidence for the synthetic-user-testing.md Critical finding fix: the
// result screen's stat-tile grid and the Range Readout's pin labels both
// produced genuinely illegible, overlapping text at 200% zoom, on the exact
// screen Dana's task depends on. The previous round's verify_responsive.js
// only checked page-level `scrollWidth <= clientWidth` on the splash/quiz —
// which is exactly the check that missed this bug, since two elements can
// overlap each other while the *page* never grows wider than the viewport.
// This script is deliberately stricter in two ways the SUT report asked for:
//   1. It walks EVERY surface (splash, every quiz step incl. multi-select,
//      Chase's list + row detail, Nicole's List, and the result screen for
//      both a "tight" mixed-ability range and a wide one), not just the
//      screens the previous round happened to test.
//   2. It doesn't stop at page-level overflow — it does a pairwise bounding-
//      box overlap check across every visible text-bearing leaf element, the
//      actual "is any text rendering on top of any other text" question,
//      plus Dana's own per-element viewport-containment walk on the result
//      screen specifically.
// Both light and dark mode, since the fix is CSS-only and should be
// theme-independent.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
const SHOT_DIR = path.resolve(__dirname, 'screenshots');

const checks = [];
function assert(name, cond, extra) { checks.push({ name, pass: !!cond, extra }); }

const ZOOM_CSS = 'html { font-size: 32px !important; }'; // 200% of the 16px default root

// Pairwise text-overlap detector. Two revisions past a naive
// getBoundingClientRect() comparison, both earning their keep against real
// false positives found while building this check:
//   1. Uses getClientRects() (one DOMRect per rendered *line fragment*), not
//      getBoundingClientRect() (one rect covering the full union of all
//      fragments). An inline element that wraps across multiple lines
//      otherwise produces a bounding box that "overlaps" a sibling simply
//      because both have a fragment on the same line — even though the
//      actual glyphs never touch. This is exactly what happened testing
//      "For newer skiers:" (a wrapped <strong>) against its own sibling
//      "A real strength." (a wrapped <span>) on the same paragraph.
//   2. Excludes anything inside the standard visually-hidden pattern this
//      codebase already uses (position:absolute + ~1px box + overflow:
//      hidden, e.g. Nicole's List's <thead> below 600px) — legitimately
//      off-screen-for-sighted-users content, not a rendering bug, even
//      though some browsers don't shrink a table-internal layout box's
//      *reported* geometry to match its 1px clipped container.
const OVERLAP_PROBE = () => {
  const isVisuallyHidden = (el) => {
    let node = el;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') && node.clientWidth <= 1 && node.clientHeight <= 1) return true;
      if (cs.clip && /rect\(0px,?\s*0px,?\s*0px,?\s*0px\)/.test(cs.clip)) return true;
      node = node.parentElement;
    }
    return false;
  };
  const all = Array.from(document.querySelectorAll('#app-main *'));
  const leaves = all.filter((el) => {
    if (el.children.length > 0) return false;
    const text = (el.textContent || '').trim();
    if (!text) return false;
    if (el.closest('[aria-hidden="true"]')) return false; // decorative (icons, ghost quote-mark, etc.)
    if (el.closest('[hidden]')) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (style.position === 'fixed') return false; // toast/nav checked separately, not part of in-flow content collisions
    if (isVisuallyHidden(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    return true;
  });
  // Flatten to one entry per rendered line fragment, tagged with which
  // source element it came from (so same-element fragments never "overlap"
  // each other — they're sequential lines of the same text, not siblings).
  const fragments = [];
  leaves.forEach((el, idx) => {
    const text = el.textContent.trim().slice(0, 60);
    Array.from(el.getClientRects()).forEach((rect) => {
      if (rect.width > 0 && rect.height > 0) fragments.push({ idx, text, rect });
    });
  });
  const overlaps = [];
  const THRESHOLD = 16; // px^2 — filters out sub-pixel/anti-aliasing rounding, not a real bug
  for (let i = 0; i < fragments.length; i++) {
    for (let j = i + 1; j < fragments.length; j++) {
      if (fragments[i].idx === fragments[j].idx) continue; // same source element, different line
      const a = fragments[i].rect, b = fragments[j].rect;
      const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      const area = ix * iy;
      if (area > THRESHOLD) {
        overlaps.push({ a: fragments[i].text, b: fragments[j].text, area: Math.round(area) });
      }
    }
  }
  return overlaps;
};

async function checkSurface(page, label) {
  const overlaps = await page.evaluate(OVERLAP_PROBE);
  assert(`${label}: zero overlapping text elements`, overlaps.length === 0, overlaps);
  const pageOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(`${label}: no page-level horizontal overflow`, pageOverflow.scrollWidth <= pageOverflow.clientWidth + 1, pageOverflow);
}

async function run() {
  const browser = await chromium.launch();

  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.route('**api.weather.gov**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.addStyleTag({ content: ZOOM_CSS });
    await page.waitForTimeout(150);

    // --- Splash ---
    await checkSurface(page, `[${scheme}] Splash`);

    // --- Quiz: full walk, single-select AND multi-select (wide-mixed) ---
    await page.click('#mode-plan');
    await page.waitForTimeout(150);
    await checkSurface(page, `[${scheme}] Quiz Q1`);
    await page.click('[data-group="q1"][data-value="wide-mixed"]');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q2a (multi-select, before any tap)`);
    await page.click('[data-group="q2a"][data-value="never-skied"]');
    await page.waitForTimeout(150);
    await checkSurface(page, `[${scheme}] Quiz Q2a (multi-select, one chip selected)`);
    await page.click('[data-group="q2a"][data-value="expert"]');
    await page.waitForTimeout(150);
    await checkSurface(page, `[${scheme}] Quiz Q2a (multi-select, two chips selected)`);
    await page.click('#quiz-continue');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q2b`);
    await page.click('[data-group="q2b"][data-value="mix"]');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q3`);
    await page.click('[data-group="q3"][data-value="$$"]');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q4a`);
    await page.click('[data-group="q4a"][data-value="driving"]');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q4b (region grid)`);
    await page.click('[data-group="q4b"][data-value="denver-rockies"], [data-group="q4b"]');
    await page.waitForTimeout(700);
    await checkSurface(page, `[${scheme}] Quiz Q5`);

    await context.close();
  }

  // -------------------------------------------------------------------
  // Result screen: the actual screen under test in the Critical finding.
  // Two mixed-ability cases — "tight" (never-skied + beginner, the
  // narrowest possible floor/ceiling gap, the exact case diagnosed in
  // reviews/sut-screens/diag-range-pin-overlap.js) and "wide" (never-skied +
  // expert) — plus the ski-school disclosure expanded, in both themes.
  // -------------------------------------------------------------------
  for (const scheme of ['light', 'dark']) {
    for (const rangeCase of ['tight', 'wide']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
      const page = await context.newPage();
      await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
      await page.route('**api.weather.gov**', (r) => r.abort());
      await page.goto(FILE_URL);
      await page.click('#mode-plan');
      await page.waitForTimeout(200);
      await page.click('[data-group="q1"][data-value="mixed"]');
      await page.waitForTimeout(500);
      await page.click('[data-group="q2a"][data-value="never-skied"]');
      await page.waitForTimeout(120);
      await page.click(`[data-group="q2a"][data-value="${rangeCase === 'tight' ? 'beginner' : 'expert'}"]`);
      await page.waitForTimeout(120);
      await page.click('#quiz-continue');
      await page.waitForTimeout(500);
      await page.click('[data-group="q2b"][data-value="mix"]');
      await page.waitForTimeout(500);
      await page.click('[data-group="q3"][data-value="$$"]');
      await page.waitForTimeout(500);
      await page.click('[data-group="q4a"][data-value="unsure"]');
      await page.waitForTimeout(500);
      await page.click('[data-group="q5"][data-value="noPreference"]');
      await page.waitForTimeout(150);
      await page.click('#quiz-continue');
      await page.waitForTimeout(1200); // let the reveal choreography finish

      await page.addStyleTag({ content: ZOOM_CSS });
      await page.waitForTimeout(200);

      await checkSurface(page, `[${scheme}/${rangeCase}] Result screen, collapsed`);

      // Dana's own methodology: walk every element's getBoundingClientRect()
      // and confirm nothing extends past the viewport horizontally.
      const overflowing = await page.evaluate(() => {
        const vw = window.innerWidth;
        return Array.from(document.querySelectorAll('#app-main *'))
          .filter((el) => el.children.length === 0 && (el.textContent || '').trim())
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && (r.left < -1 || r.right > vw + 1))
          .map((r) => ({ left: Math.round(r.left), right: Math.round(r.right) }));
      });
      assert(`[${scheme}/${rangeCase}] Result screen: no element extends past the viewport horizontally (Dana's methodology)`, overflowing.length === 0, overflowing);

      // Specific pin-overlap check (mirrors diag-range-pin-overlap.js) —
      // confirms the floor/ceiling flags' actual rendered GLYPHS never
      // intersect, the literal bug. Deliberately uses a Range over each
      // flag's text node, not the flag element's own bounding/client rects:
      // `.range-pin__flag` is a flex item (blockified per the flex spec even
      // though it's a bare <span>) with a fixed `width` sized for the
      // longest possible label ("Intermediate") and text-align left/right at
      // the two track edges — a short label like "Expert" only fills part of
      // that box, so the box itself can span past a neighboring pin's box
      // while the actual characters never come near each other. Measuring
      // the element's own rect would flag that empty padding as a
      // collision; measuring the text run measures what a reader actually
      // sees.
      const pinOverlap = await page.evaluate(() => {
        const flags = Array.from(document.querySelectorAll('.range-pin__flag'));
        if (flags.length !== 2) return { pins: flags.length, overlap: null };
        const textRect = (flag) => {
          const textNode = Array.from(flag.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
          if (!textNode) return null;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rects = Array.from(range.getClientRects());
          return rects[0] || null; // single-line label; one fragment expected
        };
        const a = textRect(flags[0]), b = textRect(flags[1]);
        if (!a || !b) return { pins: 2, overlap: null, note: 'no direct text node found' };
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return { pins: 2, overlap: ix * iy, a: { left: a.left, right: a.right, top: a.top, bottom: a.bottom }, b: { left: b.left, right: b.right, top: b.top, bottom: b.bottom } };
      });
      assert(`[${scheme}/${rangeCase}] Range Readout floor/ceiling pin flags do not overlap`, pinOverlap.pins === 2 && pinOverlap.overlap === 0, pinOverlap);

      // Expand the ski-school disclosure — new content enters the DOM here.
      const expandBtn = await page.$('.notes-row__expand-btn');
      if (expandBtn) {
        await expandBtn.click();
        await page.waitForTimeout(150);
        await checkSurface(page, `[${scheme}/${rangeCase}] Result screen, ski-school disclosure expanded`);
      }

      if (rangeCase === 'tight') await page.screenshot({ path: `${SHOT_DIR}/zoom200-result-tight-range-${scheme}.png`, fullPage: true });

      await context.close();
    }
  }

  // -------------------------------------------------------------------
  // Chase the Snow (historical fallback, since network is blocked here
  // anyway) + a row-detail result screen, and Nicole's List.
  // -------------------------------------------------------------------
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.route('**api.weather.gov**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-chase');
    await page.waitForTimeout(1500); // let the historical fallback resolve
    await page.addStyleTag({ content: ZOOM_CSS });
    await page.waitForTimeout(150);
    await checkSurface(page, `[${scheme}] Chase the Snow list`);

    const firstRow = await page.$('.chase-row[data-rid]');
    if (firstRow) {
      await firstRow.click();
      await page.waitForTimeout(900);
      await checkSurface(page, `[${scheme}] Chase row detail (result screen)`);
    }
    await context.close();

    const context2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    const page2 = await context2.newPage();
    await page2.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page2.goto(FILE_URL);
    await page2.click('#mode-nicoles');
    await page2.waitForTimeout(300);
    await page2.addStyleTag({ content: ZOOM_CSS });
    await page2.waitForTimeout(150);
    await checkSurface(page2, `[${scheme}] Nicole's List`);
    await context2.close();
  }

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name, c.pass ? '' : JSON.stringify(c.extra)));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
run();
