// Renders public/og/<resort-id>.jpg: each resort's badge, centred on the app's
// dark ground at 1200x630, for link previews of shared picks (see build.py).
// Re-run after badges change (e.g. after tools/ingest_badges.py):
//   python3 build.py && node tools/render_og.js
// Needs Node with Playwright; writes PNGs, then converts to JPEG with Python/PIL.
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'og');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + path.join(ROOT, 'rather-be-knee-deep.html'));
  await page.waitForTimeout(800);
  const ids = await page.evaluate(() => RESORTS.map((r) => r.id));
  for (const id of ids) {
    await page.evaluate((id) => {
      const r = RESORTS_BY_ID[id];
      document.body.innerHTML = '<div id="og" style="position:fixed;inset:0;width:1200px;height:630px;background:#14101F;display:flex;align-items:center;justify-content:center;z-index:99999"><div style="width:540px;height:540px">' + badgeSvg(r, 'og') + '</div></div>';
      const s = document.querySelector('#og svg');
      s.setAttribute('width', '540'); s.setAttribute('height', '540');
    }, id);
    await page.waitForTimeout(60);
    await page.screenshot({ path: path.join(OUT, id + '.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  }
  await browser.close();
  execFileSync('python3', ['-c', `
import os
from PIL import Image
d = ${JSON.stringify(OUT)}
for f in os.listdir(d):
    if f.endswith('.png'):
        Image.open(os.path.join(d, f)).convert('RGB').save(os.path.join(d, f[:-4] + '.jpg'), quality=86, optimize=True)
        os.remove(os.path.join(d, f))
`]);
  console.log('Rendered', ids.length, 'share images');
})();
