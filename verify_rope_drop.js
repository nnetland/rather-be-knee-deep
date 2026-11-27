// Rope Drop (app-rope-drop.js): the daily-set rules over two years of days,
// the question bank's own rules, and a full play-through in a browser.
//   node verify_rope_drop.js
const { chromium } = require('playwright');
const path = require('path');

const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');
let failures = 0;
const check = (ok, msg, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${!ok && detail !== undefined ? '  ' + JSON.stringify(detail).slice(0, 400) : ''}`); if (!ok) failures++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('**://api.weather.gov/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FILE_URL);
  await page.waitForTimeout(300);

  // --- the bank ---------------------------------------------------------------
  const bank = await page.evaluate(() => {
    const out = { n: ROPE_DROP_QUESTIONS.length, bad: [], dupes: [], noSrc: [], badRid: [], skierOnly: [], snowriver: [] };
    const ids = new Set();
    ROPE_DROP_QUESTIONS.forEach((q) => {
      if (ids.has(q.id)) out.dupes.push(q.id); ids.add(q.id);
      if (!['g', 'b', 'k', 'd'].includes(q.r) || !q.q || !q.a || !Array.isArray(q.w) || q.w.length !== 3
        || new Set([q.a].concat(q.w)).size !== 4) out.bad.push(q.id);
      if (!q.src) out.noSrc.push(q.id);
      if (q.rid && !RESORTS_BY_ID[q.rid]) out.badRid.push(q.id);
      if (/snowboard/i.test(q.q) && /n't allow|not allow|doesn't allow/i.test(q.q)
        && q.w.some((w) => /Alta|Deer Valley|Mad River/.test(w))) out.skierOnly.push(q.id);
      const all = [q.a].concat(q.w).join('|');
      if (/Indianhead/.test(all) && /Blackjack/.test(all) && !/and/.test(q.a)) out.snowriver.push(q.id);
    });
    return out;
  });
  check(bank.n >= 150, `bank has ${bank.n} written questions`);
  check(!bank.bad.length, 'every question has a rating, one answer and three distinct wrong answers', bank.bad);
  check(!bank.dupes.length, 'question ids are unique', bank.dupes);
  check(!bank.noSrc.length, 'every question records a source', bank.noSrc);
  check(!bank.badRid.length, 'every resort link points at a real resort', bank.badRid);
  check(!bank.skierOnly.length, 'no skier-only resort is offered as a wrong answer to a "no snowboarding" question', bank.skierOnly);
  check(!bank.snowriver.length, 'Indianhead and Blackjack are never offered against each other', bank.snowriver);

  // --- the daily set, over two years ------------------------------------------
  const rules = await page.evaluate(() => {
    const out = { days: 0, badShape: 0, badOrder: 0, badOptions: [], dupResort: [], catCap: [], badCmp: [], badState: [], seen: {}, firstRepeat: { g: null, b: null, k: null, d: null }, dupInDay: 0 };
    const seenAt = {};
    const start = new Date(2026, 10, 27);
    for (let i = 0; i < 730; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const round = rdRound(key);
      out.days++;
      if (round.length !== 7) out.badShape++;
      if (round.map((q) => q.r).join('') !== 'ggbbkkd') out.badOrder++;
      if (new Set(round.map((q) => q.id)).size !== 7) out.dupInDay++;
      const rids = round.map((q) => q.rid).filter(Boolean);
      if (new Set(rids).size !== rids.length) out.dupResort.push(key);
      const cats = {}; round.forEach((q) => { cats[q.cat] = (cats[q.cat] || 0) + 1; });
      if (Object.entries(cats).some(([c, n]) => n > (c === 'resorts' ? 5 : 3))) out.catCap.push(key);
      round.forEach((q) => {
        if (q.options.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.a)) out.badOptions.push(key + ' ' + q.id);
        if (q.id.startsWith('cmp-')) {
          const c = RD_CMP[q.id.split('-')[1]];
          const vals = q.options.map((n) => RESORTS.find((r) => r.name === n)[c.field]);
          const win = RESORTS.find((r) => r.name === q.a)[c.field];
          if (vals.some((v) => v !== win && v * 1.15 > win)) out.badCmp.push(key + ' ' + q.id);
        }
        if (q.id.startsWith('st-')) {
          const r = RESORTS_BY_ID[q.rid];
          if (q.a !== r.state_province || (RD_STATE_EXCLUDE[r.id] || []).some((x) => q.options.includes(x))) out.badState.push(q.id);
        }
        const tier = q.r;
        if (!q.id.startsWith('cmp-') && seenAt[q.id] !== undefined && out.firstRepeat[tier] === null) out.firstRepeat[tier] = i;
        if (seenAt[q.id] === undefined) seenAt[q.id] = i;
      });
    }
    out.distinct = Object.keys(seenAt).length;
    out.poolSizes = Object.fromEntries(Object.entries(rdPools()).map(([k, v]) => [k, v.length]));
    out.writtenUsed = ROPE_DROP_QUESTIONS.filter((q) => seenAt[q.id] !== undefined).length;
    // Same day, same seven, every time (the cache is cleared to prove it).
    // Same day, same seven: a fresh plan built from scratch matches.
    const a = JSON.stringify(rdRound('2027-01-15'));
    Object.assign(rdPlan, { day: -1, cursor: { g: 0, b: 0, k: 0, d: 0 }, waiting: { g: [], b: [], k: [], d: [] }, days: [] });
    out.stable = a === JSON.stringify(rdRound('2027-01-15'));
    out.max = RD_MAX;
    return out;
  });
  check(rules.max === 170, 'a perfect day is 170 points');
  check(rules.badShape === 0 && rules.badOrder === 0, `every day is 2 green, 2 blue, 2 black, 1 double black (${rules.days} days)`);
  check(rules.dupInDay === 0, 'no question twice in one day');
  check(!rules.badOptions.length, 'every question has four distinct options including the answer', rules.badOptions);
  check(!rules.dupResort.length, 'no resort is the subject of two questions on one day', rules.dupResort.slice(0, 5));
  check(!rules.catCap.length, 'at most five resort questions a day, and three from any other category', rules.catCap.slice(0, 5));
  check(!rules.badCmp.length, 'every comparison winner beats the other options by at least 15%', rules.badCmp.slice(0, 5));
  check(!rules.badState.length, 'location questions are right and never offer a bordering neighbor', rules.badState);
  check(rules.stable, 'the daily set is the same every time for a date');
  check(rules.writtenUsed === bank.n, `every written question comes up within two years (${rules.writtenUsed}/${bank.n})`);
  const minRepeat = Math.min(...Object.values(rules.firstRepeat).filter((x) => x !== null));
  check(minRepeat >= 21, `no question repeats for at least three weeks (first repeat on day ${minRepeat + 1}; pools ${JSON.stringify(rules.poolSizes)})`);

  // --- snowpack, milestones, rating -------------------------------------------
  const maths = await page.evaluate(() => {
    rdMemory = rdEmpty();
    const out = {};
    out.noRating = rdRating() === null;
    rdMemory.recent = [170, 160, 150]; out.dbl = rdRating();
    rdMemory.recent = [115, 120, 125]; out.blk = rdRating();
    rdMemory.recent = [60, 80, 90, 70]; out.blu = rdRating();
    rdMemory.recent = [10, 20, 30]; out.grn = rdRating();
    out.m0 = rdMilestone(0).cur === null && rdMilestone(0).next.name === 'First Flakes';
    out.m150 = rdMilestone(150).cur.name;
    out.m12k = rdMilestone(20000).cur.name === 'Ice Age' && rdMilestone(20000).next === null;
    // Finalizing a round: crosses Opening Day from 140 inches.
    rdMemory = rdEmpty(); rdMemory.points = 1400;
    const key = '2027-02-01'; const round = rdRound(key);
    const rec = { date: key, picks: round.map((q) => q.a), done: false };
    rdFinalize(rec);
    out.after = { points: rdMemory.points, rounds: rdMemory.rounds, score: rec.score, milestone: rec.milestone, recent: rdMemory.recent.length };
    out.twice = (rdFinalize(rec), rdMemory.points);
    // An unfinished round from an earlier day is settled with what was answered.
    rdMemory = rdEmpty();
    const old = rdRound('2027-01-01');
    rdMemory.today = { date: '2027-01-01', picks: [old[0].a, 'nope', null, null, null, null, null], done: false };
    rdSettleOld();
    out.settled = { points: rdMemory.points, rounds: rdMemory.rounds, done: rdMemory.today.done };
    rdMemory = rdEmpty(); rdSave();
    return out;
  });
  check(maths.noRating, 'no rating before three rounds');
  check(maths.dbl === 'd' && maths.blk === 'k' && maths.blu === 'b' && maths.grn === 'g', 'rating bands: 85%+ double black, 65% black, 40% blue, below that green', maths);
  check(maths.m0 && maths.m150 === 'Opening Day' && maths.m12k, 'milestones from First Flakes to Ice Age');
  check(maths.after.points === 1570 && maths.after.score === 170 && maths.after.rounds === 1 && maths.after.milestone === 'Opening Day', 'a perfect round adds 17 inches and announces a milestone it crosses', maths.after);
  check(maths.twice === 1570, 'a round is never counted twice');
  check(maths.settled.points === 10 && maths.settled.rounds === 1 && maths.settled.done, 'a half-played round from an earlier day still counts what was answered', maths.settled);

  // --- play-through -----------------------------------------------------------
  await page.evaluate(() => localStorage.removeItem('rbkd.ropedrop.v1'));
  await page.reload(); await page.waitForTimeout(300);
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.splash-modes .mode-card')].map((c) => c.id));
  check(tiles.slice(-2).join(',') === 'mode-game,mode-rope', 'Home: Rope Drop sits beside Sticker Check, under the four sections', tiles);
  await page.click('#mode-rope');
  await page.waitForTimeout(150);
  check(await page.locator('h1', { hasText: 'Rope Drop' }).count() === 1, 'the tile opens Rope Drop');
  check((await page.textContent('.rd-pack')).includes('0″'), 'a new player starts at 0 inches');
  await page.click('#rd-play');
  for (let i = 0; i < 7; i++) {
    const h = await page.textContent('#rd-q');
    check(h && h.length > 10, `question ${i + 1} shows: ${h.slice(0, 70)}`);
    if (i === 3) {
      // Leave mid-round and come back: it resumes, it doesn't start over.
      await page.reload(); await page.waitForTimeout(300);
      await page.click('#mode-rope'); await page.waitForTimeout(100);
      check((await page.textContent('#rd-play')).includes('Finish'), 'leaving mid-round offers to finish, not restart');
      await page.click('#rd-play'); await page.waitForTimeout(100);
      check((await page.textContent('.game-progress')).includes('4/7'), 'and it resumes on the same question');
    }
    // Answer: right on even questions, wrong on odd ones.
    const answer = await page.evaluate((n) => rdRound(state.ropeDrop.date)[n].a, i);
    const opts = await page.$$eval('.game-option', (els) => els.map((e) => e.dataset.opt));
    const pick = i % 2 === 0 ? answer : opts.find((o) => o !== answer);
    await page.click(`.game-option[data-opt="${pick.replace(/"/g, '\\"')}"]`);
    await page.waitForTimeout(80);
    const verdict = await page.textContent('.game-verdict');
    check(i % 2 === 0 ? verdict.startsWith('Correct.') : verdict.startsWith('Not this time.'), `question ${i + 1}: verdict "${verdict.slice(0, 40)}"`);
    if (i === 0) {
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
      check(focused === 'rd-next', 'focus moves to Next after answering');
      const see = await page.$('#rd-see');
      if (see) {
        await see.click(); await page.waitForTimeout(200);
        check(await page.locator('#result-leaf-back', { hasText: 'Back to Rope Drop' }).count() === 1, 'a resort link opens the resort page with a way back');
        await page.click('#result-leaf-back'); await page.waitForTimeout(200);
        check((await page.textContent('.game-progress')).includes('1/7') && !!(await page.$('.game-verdict')), 'and Back lands on the same revealed question');
      }
    }
    await page.click('#rd-next');
    await page.waitForTimeout(80);
  }
  const done = await page.evaluate(() => ({
    score: document.querySelector('.game-score__n').textContent,
    marks: document.querySelectorAll('.rd-mark').length,
    right: document.querySelectorAll('.rd-mark--right').length,
    recap: document.querySelectorAll('.rd-recap__item').length,
    pack: document.querySelector('.rd-pack').textContent,
    mem: JSON.parse(localStorage.getItem('rbkd.ropedrop.v1')),
  }));
  const expected = await page.evaluate(() => rdRound(state.ropeDrop.date).reduce((n, q, i) => n + (i % 2 === 0 ? RD_POINTS[q.r] : 0), 0));
  check(done.score.startsWith(String(expected)), `the score card shows ${expected}/170`, done.score);
  check(done.marks === 7 && done.right === 4, 'seven trail-shape marks, four filled');
  check(done.recap === 7, 'the recap lists all seven answers');
  check(done.mem.points === expected && done.mem.rounds === 1, 'the snowpack is saved on the device', done.mem);
  check(done.pack.includes(`${Math.floor(expected / 10)}″`), 'the gauge shows the new depth');
  const share = await page.evaluate(() => rdShareText(rdMemory.today));
  const answers = await page.evaluate(() => rdRound(state.ropeDrop.date).map((q) => q.a));
  check(share.startsWith('Rope Drop #') && !answers.some((a) => share.includes(a)), 'the shared result names no questions or answers', share);
  // Coming back the same day shows the result, with no second go.
  await page.click('#rd-quit'); await page.waitForTimeout(100);
  check((await page.textContent('#rd-play')).includes("today's run"), 'the same day, the button shows today\'s run instead of a new round');
  await page.click('#rd-play'); await page.waitForTimeout(100);
  check(!!(await page.$('.game-score')), 'and opens the score, not the questions');

  // 200% text at 320px: nothing scrolls sideways.
  const small = await (await browser.newContext({ viewport: { width: 320, height: 640 } })).newPage();
  await small.goto(FILE_URL); await small.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await small.click('#mode-rope'); await small.waitForTimeout(100);
  let over = await small.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, 'no sideways scroll on Rope Drop home at 320px, 200% text', over);
  await small.click('#rd-play'); await small.waitForTimeout(100);
  over = await small.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(over <= 1, 'no sideways scroll on a question at 320px, 200% text', over);

  check(!errors.length, 'no page errors', errors);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
})();
