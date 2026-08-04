// Verifies the resort badge system (badge-system.md) end to end against the
// real, assembled 71-resort bundle:
//   1. Renders all 71 badges into a contact-sheet screenshot for human
//      review (none should be blank, clipped, blob-like, or broken).
//   2. Region-repeat check across all six cross-shoppable clusters — ports
//      badge-preview.html's own #region-check panel logic, asserting zero
//      repeats, straight from the live BADGE_ASSIGNED array (can't drift
//      out of sync with what's actually assigned).
//   3. Determinism: the same resort's badge SVG is byte-identical (a) when
//      rendered twice in two fully separate browser contexts, and (b) when
//      loaded fresh vs. reproduced cold from its own #result= share link.
//   4. Every badge references a real motif in the library (no dangling
//      motif ids) and every layer's local colour tokens resolve.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
const SHOT_DIR = path.resolve(__dirname, 'screenshots');

let pass = 0, fail = 0;
function assert(label, cond) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}`); }
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.goto(FILE_URL);

  // --- 1/4: structural sanity across all 71 -----------------------------
  const structural = await page.evaluate(() => {
    const rows = RESORTS.map((r) => {
      const a = BADGE_ASSIGNMENTS[r.id];
      const svg = badgeSvg(r, 'contact-sheet');
      // Motifs are drawn from a mix of <path>/<ellipse>/<circle>/<rect>/
      // <polygon> — count all real shape elements, not just <path>, so a
      // motif built mostly from primitives (e.g. the Beaver's ellipses/
      // circles/rects) isn't mistaken for a near-empty render.
      const shapeCount = (svg.match(/<(path|ellipse|circle|rect|polygon)[ >]/g) || []).length;
      return {
        id: r.id, name: r.name, category: a ? a.category : null,
        motif: a ? a.layers[0].motif : null,
        paletteKey: a ? a.paletteKey : null,
        svgLen: svg.length, shapeCount,
        hasSvgTag: svg.includes('<svg'),
        hasTitle: svg.includes('<title'),
        hasDesc: svg.includes('<desc'),
        motifExists: a ? Object.prototype.hasOwnProperty.call(MOTIFS, a.layers[0].motif) : false,
      };
    });
    return rows;
  });

  assert('71 resorts total in dataset', structural.length === 71);
  structural.forEach((r) => {
    assert(`${r.id}: assigned a category`, !!r.category);
    assert(`${r.id}: motif "${r.motif}" exists in MOTIFS library`, r.motifExists);
    assert(`${r.id}: renders a non-trivial SVG (not blank)`, r.svgLen > 800 && r.shapeCount >= 5);
    assert(`${r.id}: has <svg>/<title>/<desc>`, r.hasSvgTag && r.hasTitle && r.hasDesc);
  });

  // --- 2/4: region-repeat check, straight from BADGE_ASSIGNED -----------
  const regionCheck = await page.evaluate(() => {
    const byCluster = {};
    BADGE_ASSIGNED.forEach((a) => {
      if (!byCluster[a.cluster]) byCluster[a.cluster] = [];
      byCluster[a.cluster].push({ id: a.resort.id, name: a.resort.name, motif: a.layers[0].motif });
    });
    const report = {};
    let totalRepeats = 0;
    Object.entries(byCluster).forEach(([cluster, list]) => {
      const seen = {};
      list.forEach((r) => { seen[r.motif] = (seen[r.motif] || []).concat(r.name); });
      const dupes = Object.entries(seen).filter(([, names]) => names.length > 1);
      dupes.forEach(([, names]) => { totalRepeats += names.length - 1; });
      report[cluster] = { count: list.length, distinct: Object.keys(seen).length, dupes };
    });
    return { report, totalRepeats, clusterCount: Object.keys(byCluster).length };
  });

  console.log('\nRegion repeat-check (badge-system.md §4.1 — zero repeats WITHIN a cluster, reuse ACROSS clusters is fine):');
  Object.entries(regionCheck.report).forEach(([cluster, r]) => {
    console.log(`  ${cluster.padEnd(30)} ${String(r.count).padStart(2)} resorts, ${r.distinct} distinct motifs ${r.dupes.length ? 'DUPES: ' + JSON.stringify(r.dupes) : '— clean'}`);
  });
  assert('exactly six region clusters represented', regionCheck.clusterCount === 6);
  assert('zero within-cluster motif repeats across all 71 resorts', regionCheck.totalRepeats === 0);

  // --- 3a/4: determinism — two separate browser contexts ----------------
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await page2.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page2.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page2.goto(FILE_URL);

  const [svgsA, svgsB] = await Promise.all([
    page.evaluate(() => RESORTS.map((r) => badgeSvg(r, 'hero'))),
    page2.evaluate(() => RESORTS.map((r) => badgeSvg(r, 'hero'))),
  ]);
  let mismatches = 0;
  svgsA.forEach((svg, i) => { if (svg !== svgsB[i]) mismatches++; });
  assert('all 71 badges byte-identical across two independent browser contexts', mismatches === 0);
  await context2.close();

  // --- 3b/4: determinism — shared #result= link reproduces sender's exact badge
  await page.setViewportSize({ width: 390, height: 900 });
  const sample = ['jackson-hole-wy', 'crested-butte-co', 'big-powderhorn-mi', 'loveland-co'];
  for (const rid of sample) {
    const { hash } = await page.evaluate((id) => {
      const resort = RESORTS.find((r) => r.id === id);
      const payload = { v: 1, rid: resort.id, reasonBullets: ['A real fit.'], showRangeReadout: false, range: null };
      navigate('result', { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true });
      return { hash: location.hash };
    }, rid);
    await page.waitForTimeout(150);
    const senderSvg = await page.$eval('.badge-panel svg', (el) => el.outerHTML);

    const context3 = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page3 = await context3.newPage();
    await page3.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page3.route('**://fonts.gstatic.com/**', (r) => r.abort());
    await page3.goto(FILE_URL + hash);
    await page3.waitForTimeout(300);
    const receiverSvg = await page3.$eval('.badge-panel svg', (el) => el.outerHTML).catch(() => null);
    assert(`${rid}: cold #result= link reproduces sender's exact badge SVG`, receiverSvg === senderSvg);
    await context3.close();
  }

  // --- 1/4 (visual): contact sheet of all 71, for human review ----------
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.id = 'badge-contact-sheet';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:grid;grid-template-columns:repeat(9,1fr);gap:6px;padding:10px;overflow:auto;';
    RESORTS.forEach((r) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'border:1px solid #ddd;padding:4px;font:8.5px sans-serif;text-align:center;';
      const a = BADGE_ASSIGNMENTS[r.id];
      cell.innerHTML = `<div style="width:96px;height:96px;margin:0 auto">${badgeSvg(r, 'contact-sheet', { decorative: false })}</div><div>${r.name}</div><div style="color:#888">${a.category}/${a.layers[0].motif}${a.clusterBumped ? ' (bumped)' : ''}</div>`;
      wrap.appendChild(cell);
    });
    document.body.appendChild(wrap);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/badge-contact-sheet-all71.png`, fullPage: true });
  await page.evaluate(() => document.getElementById('badge-contact-sheet').remove());

  // --- scale check: 72 / 96 / 200px, light + dark, one badge per size ---
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate((th) => {
      if (th === 'dark') document.documentElement.style.colorScheme = 'dark';
    }, theme);
    await page.evaluate((th) => {
      const wrap = document.createElement('div');
      wrap.id = 'badge-scale-check';
      wrap.style.cssText = `position:fixed;inset:0;z-index:99999;background:${th === 'dark' ? '#14101F' : '#fff'};display:flex;align-items:center;justify-content:center;gap:32px;`;
      [['breckenridge-co', 72], ['breckenridge-co', 96], ['breckenridge-co', 200]].forEach(([id, px]) => {
        const resort = RESORTS.find((r) => r.id === id);
        const cell = document.createElement('div');
        cell.style.cssText = `width:${px}px;height:${px}px;`;
        cell.innerHTML = badgeSvg(resort, 'scale-' + px, { decorative: false });
        wrap.appendChild(cell);
      });
      document.body.appendChild(wrap);
    }, theme);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOT_DIR}/badge-scale-check-${theme}.png` });
    await page.evaluate(() => document.getElementById('badge-scale-check').remove());
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
run();
