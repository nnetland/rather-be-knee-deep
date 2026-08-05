// Evidence for criticals #3 (Nicole's List overflow) and #4 (200% zoom quiz
// occlusion), plus the M8 overflow measurement methodology from
// accessibility-review.md. Screenshots land in build/screenshots/.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
const SHOT_DIR = path.resolve(__dirname, 'screenshots');

const checks = [];
function assert(name, cond, extra) { checks.push({ name, pass: !!cond, extra }); }

async function run() {
  const browser = await chromium.launch();

  // -------------------------------------------------------------------
  // Critical fix #3: Nicole's List at 320px and 390px — no page-level
  // horizontal overflow, hot-take column never disappears off-screen.
  // -------------------------------------------------------------------
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-nicoles');
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert(`Nicole's List at ${width}px: no page-level horizontal overflow`, overflow.scrollWidth <= overflow.clientWidth, overflow);

    // Confirm the hot-take column content is actually visible on screen
    // (not just "not overflowing the page" — the original bug pushed the
    // take column off past the viewport edge specifically).
    const takeVisible = await page.evaluate(() => {
      const take = document.querySelector('.nicoles-table__row .take-verdict, .nicoles-table__row .take-body, .nicoles-table__row .take-empty');
      if (!take) return null;
      const r = take.getBoundingClientRect();
      return { left: r.left, right: r.right, withinViewport: r.left >= 0 && r.right <= window.innerWidth };
    });
    assert(`Nicole's List at ${width}px: "Nicole's take" column content is on-screen`, takeVisible && takeVisible.withinViewport, takeVisible);

    // Real <table> semantics preserved even in the card layout (role attrs).
    const semantics = await page.evaluate(() => {
      const table = document.querySelector('.nicoles-table');
      const firstRow = document.querySelector('.nicoles-table__row');
      return {
        tableRole: table ? table.getAttribute('role') : null,
        rowRole: firstRow ? firstRow.getAttribute('role') : null,
        headerRole: document.querySelector('.nicoles-table__head th') ? document.querySelector('.nicoles-table__head th').getAttribute('role') : null,
        cellRole: firstRow ? firstRow.querySelector('td').getAttribute('role') : null,
      };
    });
    assert(`Nicole's List at ${width}px: real table role preserved`, semantics.tableRole === 'table', semantics);
    assert(`Nicole's List at ${width}px: real row role preserved`, semantics.rowRole === 'row', semantics);
    assert(`Nicole's List at ${width}px: real columnheader role preserved`, semantics.headerRole === 'columnheader', semantics);
    assert(`Nicole's List at ${width}px: real cell role preserved`, semantics.cellRole === 'cell', semantics);

    // v2 replaces finding 6's single-line-preview contract with the
    // opposite one. There is no preview and no expand control: every take
    // renders in full at every width. This asserts nothing clips it — the
    // old truncation was biased, because six of the nine takes are
    // praise-then-caveat and a left-edge clip deleted the caveat every
    // time. Length is enforced when the take is written, never here.
    const takeIntegrity = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.take-verdict, .take-body'));
      if (!nodes.length) return null;
      const clipped = nodes.filter((el) => {
        const c = getComputedStyle(el);
        return c.webkitLineClamp !== 'none' || c.textOverflow === 'ellipsis' ||
               c.maxHeight !== 'none' || c.whiteSpace === 'nowrap' ||
               el.scrollHeight > el.clientHeight + 1;
      });
      return {
        count: nodes.length,
        clipped: clipped.length,
        ellipsis: nodes.filter((el) => el.textContent.includes('\u2026')).length,
        expandControls: document.querySelectorAll('.take-preview, .take-full, [data-expand]').length,
      };
    });
    assert(`Nicole's List at ${width}px: takes render in full — nothing clamped, clipped or ellipsised`,
      takeIntegrity && takeIntegrity.clipped === 0 && takeIntegrity.ellipsis === 0, takeIntegrity);
    assert(`Nicole's List at ${width}px: no expand control — the take is never behind a click`,
      takeIntegrity && takeIntegrity.expandControls === 0, takeIntegrity);

    // R5 after the visible per-row label was removed: the attribution must
    // still reach a screen reader on every row that carries a take.
    const attribution = await page.evaluate(() => {
      const takes = Array.from(document.querySelectorAll('.nicoles-table__cell--take')).filter((c) => c.querySelector('.take-body'));
      return {
        takes: takes.length,
        attributed: takes.filter((c) => /nicole/i.test((c.querySelector('.visually-hidden') || {}).textContent || '')).length,
        pageVoice: !!document.querySelector('.nicoleslist-voice'),
        coverage: !!document.querySelector('.nicoleslist-status'),
      };
    });
    assert(`Nicole's List at ${width}px: every take carries screen-reader attribution (R5)`,
      attribution && attribution.takes > 0 && attribution.attributed === attribution.takes, attribution);
    assert(`Nicole's List at ${width}px: page-level attribution and coverage count present (R5)`,
      attribution && attribution.pageVoice && attribution.coverage, attribution);

    // Touch targets (M7): filter chips >= 44px with >= 12px gutter.
    const targets = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.filter-chip'));
      if (chips.length < 2) return null;
      const heights = chips.map((c) => c.getBoundingClientRect().height);
      const r0 = chips[0].getBoundingClientRect();
      const r1 = chips[1].getBoundingClientRect();
      const gutter = r1.left - r0.right; // adjacent chips wrap to a new row sometimes; only meaningful same-row
      return { minHeight: Math.min(...heights), sameRow: Math.abs(r0.top - r1.top) < 1, gutter };
    });
    assert(`Nicole's List at ${width}px: filter chips are >= 44px tall`, targets && targets.minHeight >= 44, targets);

    await page.screenshot({ path: `${SHOT_DIR}/nicoles-list-${width}.png`, fullPage: true });
    await context.close();
  }

  // -------------------------------------------------------------------
  // Critical fix #4: 200% zoom on the quiz. Simulated per
  // accessibility-review.md's own methodology — root font-size forced to
  // 32px (2x the 16px default) at a 390px viewport, which is exactly how
  // the C1 finding was originally measured.
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(300);
    await page.addStyleTag({ content: 'html { font-size: 32px !important; }' });
    await page.waitForTimeout(200);

    const zoomState = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert('200% zoom, Q1: no page-level horizontal overflow', zoomState.scrollWidth <= zoomState.clientWidth + 1, zoomState);

    // Every option's text must be fully within the viewport width (no
    // horizontal scroll, ever). Single-column stacking at this effective
    // width means the page is naturally taller than the viewport — vertical
    // scrolling is expected and fine (only horizontal scroll is banned) —
    // so the nav-occlusion check scrolls to the bottom first: the real bug
    // was that even after scrolling as far as possible, the fixed nav's
    // hardcoded 72px clearance didn't scale with zoom, so the last option
    // stayed permanently covered no matter how far the user scrolled.
    const optionCheck = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('[data-group="q1"]'));
      return chips.map((chip) => {
        const label = chip.querySelector('.tap-chip__label');
        const r = label.getBoundingClientRect();
        const withinViewportWidth = r.left >= 0 && r.right <= window.innerWidth;
        return { text: label.textContent.trim(), withinViewportWidth };
      });
    });
    optionCheck.forEach((o) => {
      assert(`200% zoom: Q1 option "${o.text}" text fully within viewport width`, o.withinViewportWidth, o);
    });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    const lastOptionAfterScroll = await page.evaluate(() => {
      const nav = document.getElementById('bottom-nav');
      const navRect = nav.getBoundingClientRect();
      const chips = Array.from(document.querySelectorAll('[data-group="q1"]'));
      const last = chips[chips.length - 1];
      const label = last.querySelector('.tap-chip__label');
      const r = label.getBoundingClientRect();
      return { text: label.textContent.trim(), overlapsNav: r.bottom > navRect.top, rectBottom: Math.round(r.bottom), navTop: Math.round(navRect.top) };
    });
    assert(`200% zoom: after scrolling to the bottom, the last Q1 option clears the fixed nav (was permanently covered before the rem fix)`, !lastOptionAfterScroll.overlapsNav, lastOptionAfterScroll);

    await page.screenshot({ path: `${SHOT_DIR}/quiz-zoom200-q1.png`, fullPage: true });

    // Also check the region grid (Q4b), a second reported instance of the
    // same fixed-breakpoint bug.
    await page.click('[data-group="q1"][data-value="solo"]');
    await page.waitForTimeout(700);
    await page.click('[data-group="q2a"][data-value="intermediate"]');
    await page.waitForTimeout(700);
    await page.click('[data-group="q2b"][data-value="mix"]');
    await page.waitForTimeout(700);
    await page.click('[data-group="q3"][data-value="$$"]');
    await page.waitForTimeout(700);
    await page.click('[data-group="q4a"][data-value="driving"]');
    await page.waitForTimeout(700);
    const regionZoomState = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert('200% zoom, Q4b (region grid): no page-level horizontal overflow', regionZoomState.scrollWidth <= regionZoomState.clientWidth + 1, regionZoomState);
    await page.screenshot({ path: `${SHOT_DIR}/quiz-zoom200-q4b-regions.png`, fullPage: true });

    await context.close();
  }

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name, c.pass ? '' : JSON.stringify(c.extra)));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
run();
