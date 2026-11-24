// Sticker Check (app-game.js) — the round rules, the no-spoiler rules, and a
// full play-through in a browser.
//   node verify_game.js
const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('**://api.weather.gov/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE_URL);
  await page.waitForTimeout(300);

  // --- rules, checked over many rounds ---------------------------------------
  const rules = await page.evaluate(() => {
    const out = { rounds: 0, badSize: 0, fewRegions: 0, overCap: 0, dupes: 0, badDiff: 0,
      badOptions: 0, answerMissing: 0, snowriverPair: 0, maineTogether: 0, alaskaOpts: 0, seen: new Set() };
    for (let i = 0; i < 3000; i++) {
      gameNewRound('endless');
      const r = state.game.round;
      out.rounds++;
      if (r.length !== 5) out.badSize++;
      const ids = r.map((q) => q.id);
      if (new Set(ids).size !== 5) out.dupes++;
      const regs = {}; ids.forEach((id) => { const g = gameRegion(id); regs[g] = (regs[g] || 0) + 1; });
      if (Object.keys(regs).length < 4) out.fewRegions++;
      if (Object.values(regs).some((n) => n > 2)) out.overCap++;
      const ds = ids.map((id) => GAME_CONTENT[id].d).sort().join('');
      if (ds !== '11223') out.badDiff++;
      if (ids.includes('sunday-river-me') && ids.includes('sugarloaf-me')) out.maineTogether++;
      r.forEach((q) => {
        out.seen.add(q.id);
        if (q.options.length !== 4 || new Set(q.options).size !== 4) out.badOptions++;
        if (!q.options.includes(q.id)) out.answerMissing++;
        if ((q.id === 'indianhead-mi' && q.options.includes('blackjack-mi')) || (q.id === 'blackjack-mi' && q.options.includes('indianhead-mi'))) out.snowriverPair++;
      });
    }
    out.seen = out.seen.size;
    out.total = GAME_IDS.length;
    out.powderRidge = GAME_IDS.includes('powder-ridge-ct');
    // Daily: same five for the same date, every time.
    const a = (gameNewRound('daily'), JSON.stringify(state.game.round));
    const b = (gameNewRound('daily'), JSON.stringify(state.game.round));
    out.dailyStable = a === b;
    // No spoilers: no screen-reader description names its own resort.
    out.leaks = GAME_IDS.filter((id) => {
      const name = RESORTS_BY_ID[id].name.toLowerCase().replace(/ mountain| resort| mountains/g, '');
      return GAME_CONTENT[id].alt.toLowerCase().includes(name);
    });
    state.game = null;
    return out;
  });
  check(rules.total === 70 && !rules.powderRidge, `70 badges play, Powder Ridge left out (${rules.total})`);
  check(rules.badSize === 0 && rules.dupes === 0, 'every round is five different badges');
  check(rules.fewRegions === 0, 'every round spans at least four regions');
  check(rules.overCap === 0, 'no round has more than two badges from one region');
  check(rules.badDiff === 0, `every round is 2 easy, 2 medium, 1 deep cut (${rules.badDiff} misses)`);
  check(rules.badOptions === 0 && rules.answerMissing === 0, 'four distinct options, answer always among them');
  check(rules.snowriverPair === 0, 'Indianhead and Blackjack never offered against each other');
  check(rules.maineTogether === 0, 'Sunday River and Sugarloaf never in the same round');
  check(rules.seen === 70, `every badge turns up across rounds (${rules.seen} of 70)`);
  check(rules.dailyStable, 'daily round is the same five every time on one date');
  check(rules.leaks.length === 0, `no question description names its resort ${rules.leaks.join(', ')}`);

  // --- play a round in the browser -----------------------------------------
  await page.click('#mode-game');
  await page.waitForTimeout(150);
  check(await page.isVisible('#game-play'), 'home tile opens Sticker Check');
  await page.click('#game-play');
  for (let i = 0; i < 5; i++) {
    const label = await page.getAttribute('.game-badge', 'aria-label');
    const answer = await page.evaluate(() => state.game.round[state.game.idx].id);
    const name = await page.evaluate((id) => RESORTS_BY_ID[id].name, answer);
    check(label.startsWith(`Sticker ${i + 1} of 5.`) && !label.includes(name), `sticker ${i + 1}: description gives nothing away`);
    // Right on even stickers, wrong on odd ones.
    const pick = i % 2 === 0 ? answer : await page.evaluate(() => state.game.round[state.game.idx].options.find((o) => o !== state.game.round[state.game.idx].id));
    await page.click(`.game-option[data-id="${pick}"]`);
    await page.waitForTimeout(80);
    const verdict = await page.textContent('.game-verdict');
    check(i % 2 === 0 ? verdict.startsWith('Correct.') : verdict.startsWith('Not this time.') && verdict.includes(name), `sticker ${i + 1}: reveal says ${i % 2 === 0 ? 'right' : 'wrong'} and names it`);
    if (i === 0) await page.screenshot({ path: 'screenshots/game-reveal-390.png', fullPage: true });
    if (i === 1) {
      // Out to the resort page and back keeps the round.
      await page.click('#game-see');
      await page.waitForTimeout(250);
      check(await page.isVisible('#result-leaf-back'), 'resort page offers a way back to the game');
      await page.click('#result-leaf-back');
      await page.waitForTimeout(250);
      check(await page.evaluate(() => state.route === 'game' && state.game.idx === 1 && state.game.phase === 'reveal'), 'back from the resort page lands on the same sticker');
    }
    await page.click('#game-next');
    await page.waitForTimeout(80);
  }
  check((await page.textContent('.game-score__n')).trim() === '3/5', 'score reads 3/5');
  await page.screenshot({ path: 'screenshots/game-score-390.png', fullPage: true });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rbkd.stickercheck.v1')));
  check(stored.found.length === 3 && stored.rounds === 1 && stored.best === 3, 'badges named, best and rounds are remembered');
  await page.click('#game-book');
  await page.waitForTimeout(100);
  check(await page.locator('.book-slot:not(.book-slot--empty)').count() === 3 && await page.locator('.book-slot--empty').count() === 67, 'Badge book shows 3 named, 67 to go');
  await page.screenshot({ path: 'screenshots/game-book-390.png', fullPage: true });

  // Daily: played once, then it shows the result.
  await page.click('#game-back'); await page.click('#game-quit');
  await page.click('#game-daily');
  for (let i = 0; i < 5; i++) {
    await page.click('.game-option >> nth=0'); await page.click('#game-next');
  }
  check(await page.isVisible('.game-score'), 'daily round reaches a score');
  check(await page.locator('.game-recap').count() === 0, 'daily result shows no badges or names');
  await page.click('#game-quit');
  check((await page.textContent('#game-daily')).includes("Today's round"), 'daily button shows today\'s score once played');

  await page.goto(FILE_URL); await page.waitForTimeout(200);
  await page.screenshot({ path: 'screenshots/game-home-tile-390.png', fullPage: true });
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nAll Sticker Check checks passed.');
  process.exit(failures ? 1 : 0);
})();
