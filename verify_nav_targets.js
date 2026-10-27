/* verify_nav_targets.js — bottom nav tap targets (Director, 2026-10-27:
 * "the tap targets on the bottom main nav are tight from a vertical height
 * POV"). Measured on touch-emulated phones, light and dark, 100% and 200%.
 *
 *   NODE_PATH=$(npm root -g) node verify_nav_targets.js
 */
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.join(__dirname, 'public', 'index.html');
let pass = 0, fail = 0;
const assert = (l, ok, d) => { if (ok) { pass++; console.log('PASS', l); } else { fail++; console.log('FAIL', l, d === undefined ? '' : JSON.stringify(d)); } };

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[320, 568], [390, 844], [430, 932]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, colorScheme: scheme });
      await p.route('**://api.weather.gov/**', (r) => r.abort());
      await p.goto(FILE_URL); await p.waitForTimeout(300);
      await p.evaluate(() => navigate('nicoles')); await p.waitForTimeout(300);
      const m = await p.evaluate(() => {
        const items = [...document.querySelectorAll('#bottom-nav .nav-item')];
        const cur = document.querySelector('#bottom-nav .nav-item[aria-current="page"] > span:first-child');
        const other = document.querySelector('#bottom-nav .nav-item:not([aria-current]) > span:first-child');
        return {
          heights: items.map((i) => Math.round(i.getBoundingClientRect().height)),
          widths: items.map((i) => Math.round(i.getBoundingClientRect().width)),
          gaps: items.slice(1).map((i, k) => Math.round(i.getBoundingClientRect().left - items[k].getBoundingClientRect().right)),
          pillCur: getComputedStyle(cur).backgroundColor,
          pillOther: getComputedStyle(other).backgroundColor,
          labelPx: parseFloat(getComputedStyle(items[0]).fontSize),
        };
      });
      const tag = `${w}px ${scheme}`;
      assert(`${tag}: every nav item is at least 64px tall`, m.heights.every((x) => x >= 64), m.heights);
      assert(`${tag}: every nav item is at least 60px wide`, m.widths.every((x) => x >= 60), m.widths);
      assert(`${tag}: items tile edge to edge — no dead gaps between targets`, m.gaps.every((g) => g <= 0), m.gaps);
      assert(`${tag}: the current page has a visible pill, not colour alone (1.4.1)`,
        m.pillCur !== m.pillOther && !/rgba\(0, 0, 0, 0\)/.test(m.pillCur), m);
      assert(`${tag}: nav labels are at least 12px`, m.labelPx >= 12, m.labelPx);
      // The last piece of page content must clear the nav.
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(150);
      const clear = await p.evaluate(() => {
        const nav = document.getElementById('bottom-nav').getBoundingClientRect();
        const kids = [...document.querySelectorAll('#app-main *')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0 && !(e.closest('details:not([open])') && !e.closest('summary')) && !e.closest('.visually-hidden'));
        const last = Math.max(...kids.map((e) => e.getBoundingClientRect().bottom));
        return { lastBottom: Math.round(last), navTop: Math.round(nav.top) };
      });
      assert(`${tag}: scrolled to the end, content clears the nav`, clear.lastBottom <= clear.navTop, clear);
      await p.close();
    }
  }
  // 200% text zoom: the bar grows with the label only, and content still clears it.
  {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await p.route('**://api.weather.gov/**', (r) => r.abort());
    await p.goto(FILE_URL); await p.waitForTimeout(300);
    await p.addStyleTag({ content: 'html{font-size:32px}' });
    await p.evaluate(() => navigate('nicoles')); await p.waitForTimeout(300);
    const z = await p.evaluate(() => ({
      navH: Math.round(document.getElementById('bottom-nav').getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert('200% zoom: nav stays under 15% of the screen height', z.navH < 844 * 0.15, z);
    assert('200% zoom: no horizontal overflow', z.overflow <= 0, z);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(150);
    const c = await p.evaluate(() => {
      const nav = document.getElementById('bottom-nav').getBoundingClientRect();
      const kids = [...document.querySelectorAll('#app-main *')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0 && !(e.closest('details:not([open])') && !e.closest('summary')) && !e.closest('.visually-hidden'));
      return { last: Math.round(Math.max(...kids.map((e) => e.getBoundingClientRect().bottom))), navTop: Math.round(nav.top) };
    });
    assert('200% zoom: scrolled to the end, content clears the nav', c.last <= c.navTop, c);
    await p.close();
  }
  // iOS Safari in the browser lifts icon + label 12px off Safari's toolbar
  // (--nav-pad-b 22px via an iOS-only @supports). Chromium can't match that
  // query, so apply the same value and check the geometry holds.
  {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await p.route('**://api.weather.gov/**', (r) => r.abort());
    await p.goto(FILE_URL); await p.waitForTimeout(300);
    await p.addStyleTag({ content: ':root{--nav-pad-b:22px}' });
    await p.evaluate(() => navigate('nicoles')); await p.waitForTimeout(300);
    const g = await p.evaluate(() => {
      const it = document.querySelector('#bottom-nav .nav-item');
      const r = it.getBoundingClientRect(); const lb = it.querySelector('span:last-child').getBoundingClientRect();
      return { h: Math.round(r.height), labelGap: Math.round(r.bottom - lb.bottom) };
    });
    assert('iOS browser mode: label sits at least 20px above the bottom edge', g.labelGap >= 20, g);
    assert('iOS browser mode: the button still fills the bar (no dead strip)', g.h >= 76, g);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(150);
    const c = await p.evaluate(() => {
      const nav = document.getElementById('bottom-nav').getBoundingClientRect();
      const kids = [...document.querySelectorAll('#app-main *')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 0 && !(e.closest('details:not([open])') && !e.closest('summary')) && !e.closest('.visually-hidden'));
      return { last: Math.round(Math.max(...kids.map((e) => e.getBoundingClientRect().bottom))), navTop: Math.round(nav.top) };
    });
    assert('iOS browser mode: content still clears the taller nav', c.last <= c.navTop, c);
    const css = await p.evaluate(() => [...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.cssText.includes('-webkit-touch-callout: none') && r.cssText.includes('--nav-pad-b: 22px')); } catch (e) { return false; } }));
    assert('the iOS-only rule is in the stylesheet', css);
    await p.close();
  }
  // Safe area: the viewport opts in, so env(safe-area-inset-bottom) is live in home-screen mode.
  {
    const p = await browser.newPage();
    await p.goto(FILE_URL);
    const vp = await p.$eval('meta[name="viewport"]', (m) => m.content);
    assert('viewport opts into safe-area insets (viewport-fit=cover)', /viewport-fit=cover/.test(vp), vp);
    await p.close();
  }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
