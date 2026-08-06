/* verify_rants.js — Rants & Raves invariants.
 *
 * Repo convention: Playwright against the ASSEMBLED build, the same way
 * verify_a11y / verify_contrast / verify_quiver work. Ported from
 * verify_rants_raves.js, which ran against a standalone reference file with
 * invented token names (--ink, --paper, --accent, --rule, --rr-*) and an
 * invented nav. Those tokens do not exist in this app; every contrast
 * assertion below is now MEASURED from the real computed styles in BOTH colour
 * schemes rather than asserted against a hardcoded hex, which is stronger than
 * what it replaces.
 *
 *   node verify_rants.js
 *
 * These are not style checks. Every assertion corresponds to a design decision
 * that is expensive to lose silently — the four-sided-border rule, the gold
 * ban, the 14-day ceiling, the empty-state branch order, the polarity at the
 * point of reading. If one fails, a principle broke.
 *
 * -----------------------------------------------------------------------
 * SUITE INTEGRITY. An assertion without a name throws, because an unnamed
 * assertion cannot report. An assertion is deleted, or the thing it found is
 * fixed. It is NEVER neutered: no `|| true`, no empty names, no skips. A green
 * suite that cannot fail is worse than no suite — the predecessor of this file
 * reported 59/59 while every critical in a fix round was live, because one
 * assertion had been disarmed with `|| true` and given an empty name.
 *
 * ASSERTIONS DELETED IN THIS PORT, and why — recorded rather than dropped
 * quietly, so nobody has to diff two files to find out what stopped being
 * checked:
 *   · share-image composition (9 assertions). The reference drew its own SVG
 *     card. This app has no share-image pipeline to hand a composition to —
 *     og-image.png is static — so the surface shares URL + text, and the
 *     provenance footer that was the image's load-bearing element now travels
 *     in the share text. Asserted below as "share text carries provenance".
 *   · "the dark block is gone" (4). That ruling was made on the belief the app
 *     might not implement prefers-color-scheme. It does, at styles.css:100.
 *     REVERSED: every contrast assertion below now runs in dark as well.
 *   · quiet-week section deleted (7). There was never a quiet-week section
 *     here to delete.
 *   · card focus-ring z-index vs quote block (4). This build does not use a
 *     stretched card link, so the occlusion it guarded against cannot occur.
 *   · popstate/hashchange de-duplication and bfcache (5). The reference ran
 *     its own router; this surface uses the app's.
 *   · --rr-* token literal declarations (12). Those tokens do not exist.
 * -----------------------------------------------------------------------
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, 'rather-be-knee-deep.html');
const FILE_URL = 'file://' + FILE;

const checks = [];
function assert(name, cond, extra) {
  if (!name) throw new Error('every assertion needs a name — an unnamed one cannot report');
  checks.push({ name, pass: !!cond, extra });
}

function srgbToLin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function relLum([r, g, b]) { return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b); }
function parseRgb(str) {
  const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const c = String(str).match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (c) return [+c[1] * 255, +c[2] * 255, +c[3] * 255];
  return null;
}
function contrast(a, b) {
  const l1 = relLum(a), l2 = relLum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
// Walk up for the actual painted background, same methodology as
// verify_contrast.js — measured where the element really sits, never assumed
// from the token table.
const EFF_BG = (sel) => {
  let el = document.querySelector(sel);
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    el = el.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor;
};

const R = (h) => FILE_URL + h;

async function newPage(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 } }, opts || {}));
  const page = await ctx.newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('**api.weather.gov**', (r) => r.abort());
  return page;
}
async function go(page, hash) { await page.goto(R(hash)); await page.waitForTimeout(350); }

async function run() {
  const html = fs.readFileSync(FILE, 'utf8');
  const browser = await chromium.launch();
  const page = await newPage(browser);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });

  // =====================================================================
  // 1 · THE FOUNDING VISUAL RULE — one four-sided border
  // On this surface an outline means "not our words". Held as a property of
  // the elements, not as a spacing judgment a careless build could erode.
  // =====================================================================
  await go(page, '#rants=rants');

  const borders = await page.evaluate(() => {
    const four = [];
    document.querySelectorAll('.rants-view *').forEach((el) => {
      const s = getComputedStyle(el);
      const sides = ['Top', 'Right', 'Bottom', 'Left'].map((d) =>
        parseFloat(s['border' + d + 'Width']) > 0 && s['border' + d + 'Style'] !== 'none');
      if (sides.every(Boolean)) four.push(el.className.toString().split(' ')[0] || el.tagName);
    });
    return four;
  });
  assert('the quote block is the ONLY four-sided border on the feed',
    borders.length > 0 && borders.every((c) => c === 'rants-quote'), borders);
  assert('cards are not boxed',
    await page.$eval('.rants-card', (el) => {
      const s = getComputedStyle(el);
      return ['Top', 'Right', 'Bottom', 'Left'].filter((d) => parseFloat(s['border' + d + 'Width']) > 0).length <= 1;
    }));
  assert('the standing frame is rules, not a box',
    await page.$eval('.rants-frame', (el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderBottomWidth) > 0 &&
             parseFloat(s.borderLeftWidth) === 0 && parseFloat(s.borderRightWidth) === 0 &&
             (s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent');
    }));
  assert('corroboration is not boxed',
    await page.$eval('.rants-corrob', (el) => {
      const s = getComputedStyle(el);
      return ['Top', 'Right', 'Bottom', 'Left'].every((d) => parseFloat(s['border' + d + 'Width']) === 0);
    }));
  assert('controls are filled, not outlined',
    await page.$eval('#rants-filter-btn', (el) => {
      const s = getComputedStyle(el);
      const bg = s.backgroundColor;
      return parseFloat(s.borderTopWidth) === 0 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    }));
  assert('the 2px bracket closes the feed top and bottom',
    await page.$eval('.rants-bracket', (el) => {
      const s = getComputedStyle(el);
      return parseFloat(s.borderTopWidth) >= 2 && parseFloat(s.borderBottomWidth) >= 2;
    }));

  // =====================================================================
  // 2 · THE GOLD BAN
  // Gold means Nicole across this app — the rule is recorded in the shipped
  // comment on --accent-gold-text, and a deuteranopic reader relies on it.
  // Nicole does not speak on this surface, so gold appears nowhere here: not
  // in a link, a rule, a focus state or a border.
  // =====================================================================
  const rantsCssRaw = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1]
    .split(/\/\* =+\s*\n\s*Rants & Raves/)[1] || '';
  // The split lands INSIDE the section's opening comment, so that block has no
  // opening delimiter left and would survive a plain comment strip — taking the
  // sentence that NAMES the gold ban with it, and turning the assertion below
  // into a permanent false failure. Drop to the first close delimiter first.
  const rantsCss = rantsCssRaw.slice(rantsCssRaw.indexOf('*/') + 2);
  assert('the Rants & Raves stylesheet section was found (guards the two assertions below)', rantsCss.length > 500,
    { len: rantsCss.length });
  assert('no gold token is referenced anywhere in the Rants & Raves styles',
    !/--accent-gold|--gold-\d/.test(rantsCss.replace(/\/\*[\s\S]*?\*\//g, '')));
  const rantsJs = html.slice(html.indexOf('Rants & Raves — what skiers on Reddit'));
  assert('no gold token is referenced anywhere in the Rants & Raves JS',
    !/--accent-gold|--gold-\d/.test(rantsJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
  const goldOnPage = await page.evaluate(() => {
    const gold = [];
    document.querySelectorAll('.rants-view *').forEach((el) => {
      const s = getComputedStyle(el);
      [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor]
        .forEach((v) => {
          const m = String(v).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return;
          const [r, g, b] = [+m[1], +m[2], +m[3]];
          // The gold ramp: gold-500 #FFC22B, gold-700 #75600A, gold-300 #DCC050.
          if ((r === 255 && g === 194 && b === 43) || (r === 117 && g === 96 && b === 10) || (r === 220 && g === 192 && b === 80)) {
            gold.push(el.className.toString() + ':' + v);
          }
        });
    });
    return gold;
  });
  assert('no gold value is COMPUTED on any rendered element of the surface', goldOnPage.length === 0, goldOnPage);

  // =====================================================================
  // 3 · THE 14-DAY CEILING — absolute, and it runs on quotes too
  // window_end is a topic's NEWEST item, so a topic can sit comfortably
  // inside 14 days while individual quotes inside it have aged past. A quote
  // dated outside the window rendering under a frame that promises the
  // ceiling is a visible self-contradiction of the page's own provenance
  // statement, and the date is printed right there for anyone to check.
  // =====================================================================
  const ages = await page.evaluate(() => {
    const now = rantsToday();
    const bad = [];
    RANTS_TOPICS.forEach((t) => {
      if (!rantsIsLive(t)) return;
      rantsLiveQuotes(t).forEach((q) => {
        const age = Math.floor((now - new Date(q.posted_at + 'T12:00:00Z')) / 86400000);
        if (age > 14) bad.push(t.id + '/' + q.posted_at + ' age ' + age);
      });
    });
    return { bad, max: RANTS_MAX_AGE_DAYS, live: rantsLiveTopics().length, total: RANTS_TOPICS.length };
  });
  assert('the ceiling is 14 days', ages.max === 14);
  assert('no live quote anywhere is older than 14 days', ages.bad.length === 0, ages.bad);
  assert('the expired fixture does NOT publish', ages.live < ages.total, ages);
  const gate = await page.evaluate(() => {
    // A topic that drops below two live quotes stops publishing — the gate is
    // "shows 2 now", not "had 2 at bake time", for the same reason the clock
    // runs client-side: a build is a snapshot and the rule is not.
    const one = { quotes: [{ posted_at: '2000-01-01' }, { posted_at: '2000-01-01' }], window_end: rantsToday().toISOString().slice(0, 10) };
    return { oneLive: rantsIsLive(one), minLive: Math.min.apply(null, rantsLiveTopics().map((t) => rantsLiveQuotes(t).length)) };
  });
  assert('a topic with fewer than 2 live quotes does not publish', gate.oneLive === false);
  assert('every published topic shows at least 2 live quotes', gate.minLive >= 2, gate);
  const staleBuild = await page.evaluate(() => {
    // A build that fails on day 15 must produce an EMPTY page, not a stale
    // one. Simulated by aging the clock past every window_end.
    const real = window.appNow;
    window.appNow = () => new Date('2099-01-01T12:00:00Z');
    const n = rantsLiveTopics().length;
    window.appNow = real;
    return n;
  });
  assert('a stale build yields ZERO topics, never stale ones', staleBuild === 0, { staleBuild });

  // =====================================================================
  // 4 · TOPICS ASSERT NOTHING — a closed vocabulary, never a predicate
  // =====================================================================
  const taxonomy = await page.evaluate(() => ({
    labels: Object.values(RANTS_TAXONOMY_V1),
    keys: Object.keys(RANTS_TAXONOMY_V1),
    allInVocab: RANTS_TOPICS.every((t) => !!RANTS_TAXONOMY_V1[t.category]),
    unknownPublishes: (() => {
      const fake = Object.assign({}, RANTS_TOPICS[0], { category: 'not-in-the-table' });
      return rantsLabelOf(fake) !== null;
    })(),
    version: RANTS_TOPICS.every((t) => t.taxonomy_version === 'taxonomy_v1'),
  }));
  assert('every topic label comes from the closed vocabulary', taxonomy.allInVocab, taxonomy.keys);
  assert('a category outside the vocabulary can never render a label', taxonomy.unknownPublishes === false);
  assert('every topic declares taxonomy_v1', taxonomy.version);
  // A predicate asserts; a noun phrase does not. The mechanical test is a
  // copula or a modal — "Lifts are slow", "Parking can be bad".
  const predicates = taxonomy.labels.filter((l) => /\b(is|are|was|were|can|will|should|gets?|goes?|has|have)\b/i.test(l));
  assert('no topic label is a predicate — every one is a noun phrase', predicates.length === 0, predicates);
  assert('no topic label ends in a full stop', taxonomy.labels.every((l) => !/\.$/.test(l)));

  // =====================================================================
  // 5 · COUNTS ARE FACTS ABOUT ITEMS, NEVER ABOUT THE RESORT
  // =====================================================================
  const counts = await page.$$eval('.rants-count', (els) => els.map((e) => e.textContent.trim()));
  assert('every count names its unit — no bare numeral anywhere in the feed',
    counts.length > 0 && counts.every((c) => /^\d+ (posts?|comments?|posts and comments)$/.test(c)), counts);
  const weight = await page.$eval('.rants-count', (el) => {
    const outer = getComputedStyle(el), b = getComputedStyle(el.querySelector('b'));
    return { numWeight: +b.fontWeight, wordWeight: +outer.fontWeight, numSize: b.fontSize, wordSize: outer.fontSize, tabular: outer.fontVariantNumeric };
  });
  assert('volume is weight contrast: the numeral is heavier than its unit', weight.numWeight > weight.wordWeight, weight);
  assert('and it is NOT size scaling — numeral and unit are the same size', weight.numSize === weight.wordSize, weight);
  assert('the count uses tabular figures, so the column aligns down the feed', /tabular-nums/.test(weight.tabular), weight);
  const noDot = await page.$eval('.rants-meta', (el) => el.textContent);
  assert('no middle dot is emitted between count and window — the column-gap is the separator', !noDot.includes('·'));
  assert('the count and window share a wrapping flex row rather than a fixed layout',
    await page.$eval('.rants-meta', (el) => getComputedStyle(el).flexWrap === 'wrap'));
  const sheetCounts = await page.evaluate(() => {
    // A count printed next to a resort name is a promise about the thing one
    // tap away. If it does not survive the tap it is not a count, it is a
    // number — so the sheet's counts are tab-scoped, like the feed's.
    const t = rantsTopicCountFor('alta-ut', 'rants');
    const feed = rantsSortedTopics('rants', 'alta-ut', 'unusual').length;
    const both = rantsTopicCountFor('alta-ut', null);
    return { t, feed, both };
  });
  assert('the sheet count for a resort equals the feed one tap away', sheetCounts.t === sheetCounts.feed, sheetCounts);
  assert('and it is tab-scoped, not a both-polarities total', sheetCounts.both > sheetCounts.t, sheetCounts);

  // =====================================================================
  // 6 · RANKING — unusual beats loud, and the score is inside its ceiling
  // The client cannot recompute S (the per-mention timestamps are not in the
  // payload), but it CAN check the ceiling, and that is the check that
  // caught a corpus where 14 of 15 scores were mathematically impossible.
  // =====================================================================
  const rank = await page.evaluate(() => {
    const over = RANTS_TOPICS.filter((t) => t.rank_score > rantsRankCeiling(t))
      .map((t) => t.id + ' ' + t.rank_score + ' > ' + rantsRankCeiling(t).toFixed(2));
    const order = rantsSortedTopics('rants', null, 'unusual');
    const newest = rantsSortedTopics('rants', null, 'newest');
    const top = order[0];
    const biggest = RANTS_TOPICS.filter((t) => rantsIsLive(t) && t.polarity === 'rant')
      .sort((a, b) => b.mention_count - a.mention_count)[0];
    return {
      over,
      allPositive: RANTS_TOPICS.every((t) => t.rank_score > 0),
      baked: RANTS_TOPICS.every((t) => typeof t.expected_mentions === 'number'),
      topId: top.id, topCount: top.mention_count,
      biggestId: biggest.id, biggestCount: biggest.mention_count,
      unusualDesc: order.every((t, i) => i === 0 || order[i - 1].rank_score >= t.rank_score),
      newestDesc: newest.every((t, i) => i === 0 || newest[i - 1].window_end >= t.window_end),
    };
  });
  assert('no rank_score exceeds the formula ceiling ln(1+n) x 1 x 3.0 x 1.25', rank.over.length === 0, rank.over);
  assert('every rank_score is positive', rank.allPositive);
  assert('expected_mentions is baked, so the baseline denominator is auditable', rank.baked);
  assert('"Unusual first" sorts by rank_score, descending', rank.unusualDesc);
  assert('"Newest first" sorts by window_end, descending', rank.newestDesc);
  assert('the top of the feed is NOT the biggest number — a small-count spike takes the top slot',
    rank.topId !== rank.biggestId && rank.topCount < rank.biggestCount, rank);
  assert('and the mega-count cluster still publishes, further down',
    rank.biggestCount >= 20, rank);

  // =====================================================================
  // 7 · POLARITY AT THE POINT OF READING
  // Sorting a topic into Rants or Raves is the only valence claim the feature
  // makes, and the feed carries it in the tab, the list bar and the
  // end-of-list line — all three ABOVE the cards. The sarcastic fixture sits
  // well below the fold, so without this the reader learns the opposite of
  // the truth with nothing to signal it happened.
  // =====================================================================
  const polarity = await page.$$eval('.rants-card h3 a', (els) => els.map((e) => ({
    visible: e.firstChild.textContent,
    hidden: (e.querySelector('.visually-hidden') || {}).textContent || '',
  })));
  assert('every card heading names its polarity in a hidden suffix',
    polarity.length > 0 && polarity.every((p) => / — (rant|rave) /.test(p.hidden)), polarity.slice(0, 2));
  assert('and the polarity is INVISIBLE on screen — the tab carries it for a sighted user',
    polarity.every((p) => !/rant|rave/i.test(p.visible)), polarity.map((p) => p.visible));
  assert('the hidden suffix interleaves rather than duplicating the title',
    polarity.every((p) => !p.hidden.includes(p.visible)));
  const sarcastic = await page.evaluate(() => {
    const list = rantsSortedTopics('rants', null, 'unusual');
    return list.findIndex((t) => t.id.indexOf('mammoth') === 0);
  });
  assert('the sarcastic fixture really does sit below the fold, where the failure lives', sarcastic >= 3, { sarcastic });

  await go(page, '#rants=rants/mammoth-mountain-ca/ticket-prices-2027-01-13');
  assert('the detail view opens with a visible polarity kicker',
    (await page.$eval('.rants-kicker', (e) => e.textContent.trim())) === 'Rant');
  assert('the kicker is aria-hidden, so the word is announced once and not twice',
    await page.$eval('.rants-kicker', (e) => e.getAttribute('aria-hidden') === 'true'));
  assert('the kicker reuses the existing label type token rather than inventing one',
    await page.$eval('.rants-kicker', (e) => e.classList.contains('data-label')));
  assert('the kicker carries no badge, hue or colour-coding — it is the secondary text colour',
    await page.evaluate(() => {
      const k = getComputedStyle(document.querySelector('.rants-kicker'));
      const s = getComputedStyle(document.querySelector('.rants-card__scope, .rants-threads') || document.body);
      return k.color === s.color && (k.backgroundColor === 'rgba(0, 0, 0, 0)' || k.backgroundColor === 'transparent');
    }));
  assert('<title> carries the polarity on a detail route', /^Rants — /.test(await page.title()), await page.title());
  await go(page, '#rants=raves/taos-nm/terrain-2027-01-16');
  assert('and the Raves side says Rave', (await page.$eval('.rants-kicker', (e) => e.textContent.trim())) === 'Rave');
  assert('<title> on a rave detail route says Raves', /^Raves — /.test(await page.title()), await page.title());
  assert('the cold-landing exit is polarity-bearing, not "See all topics"',
    /See all (rants|raves)/.test(await page.$eval('.rants-back', (e) => e.textContent)));

  // =====================================================================
  // 8 · THE STANDING FRAME — declared on every view
  // =====================================================================
  const frameRoutes = [
    ['#rants=rants', 'the feed'],
    ['#rants=rants/alta-ut/lift-wait-2027-01-18', 'the detail view'],
    ['#rants=rants/alta-ut/lift-wait-2026-12-20', 'the expired-link state'],
    ['#rants=rants/wolf-creek-co', 'the per-resort empty state'],
    ['#rants=raves/vail-co', 'the one-tab-empty state'],
    ['#rants=rants/not-a-real-resort', 'the unknown-scope state'],
  ];
  for (const [hash, label] of frameRoutes) {
    await go(page, hash);
    const f = await page.evaluate(() => {
      const el = document.querySelector('.rants-frame');
      if (!el) return null;
      const short = el.querySelector('.rants-frame__short');
      const det = el.querySelector('details');
      const sum = el.querySelector('summary');
      const h1 = document.querySelector('h1');
      return {
        shortText: short ? short.textContent.trim() : '',
        shortVisible: short ? getComputedStyle(short).position !== 'absolute' && short.getBoundingClientRect().height > 1 : false,
        open: det ? det.hasAttribute('open') : null,
        rows: el.querySelectorAll('.rants-frame__row').length,
        summaryLabel: sum ? sum.getAttribute('aria-label') : 'no-summary',
        summaryH: sum ? sum.getBoundingClientRect().height : 0,
        afterH1: h1 ? (h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : false,
        beforeTabs: (() => {
          const tabs = document.querySelector('.rants-tabs');
          return tabs ? (el.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : null;
        })(),
      };
    });
    assert(`the frame is declared on ${label}`, !!f, { hash });
    if (!f) continue;
    assert(`${label}: the short form is visible, not hidden behind a tap`, f.shortVisible, f);
    assert(`${label}: the short form names writer, picker, fact-checker, "not a rating" and the 14-day ceiling`,
      /Written by skiers on Reddit/.test(f.shortText) && /Picked by Nicole/.test(f.shortText) &&
      /Fact-checked by no one/.test(f.shortText) && /Not a rating/.test(f.shortText) &&
      /14 days/.test(f.shortText), f.shortText);
    assert(`${label}: the disclosure is closed by default`, f.open === false, f);
    assert(`${label}: all five rows are present, none dropped`, f.rows === 5, f);
    assert(`${label}: the summary text is its own accessible name — no aria-label replacement`, f.summaryLabel === null, f);
    assert(`${label}: the summary is a 44px target`, f.summaryH >= 44, f);
    assert(`${label}: the frame sits directly under the h1`, f.afterH1, f);
    if (f.beforeTabs !== null) assert(`${label}: the frame is above the tabs, not inside one`, f.beforeTabs, f);
  }
  await go(page, '#rants=rants');
  assert('"Not a rating" is a frame ROW, and the row explains why in terms of what is counted',
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rants-frame__row')].map((r) => r.textContent);
      return rows.some((r) => /Not a rating/.test(r) && /Counts are about posts and comments, not about the resort/.test(r));
    }));

  // =====================================================================
  // 9 · THE FLOOR SHIPS AS A RULE, NOT A NUMBER
  // The previous numeric form was calibrated inference rather than evidence,
  // and it was flatly contradicted by this feature's own sample data.
  // =====================================================================
  await go(page, '#rants=rants/wolf-creek-co');
  const floorText = await page.evaluate(() => [...document.querySelectorAll('.rants-empty p')].map((p) => p.textContent).join(' '));
  assert('the floor is stated as a rule', /needs several different people, posting in separate conversations/.test(floorText), floorText);
  assert('the floor sentence carries NO figure', !/\b(?:at least )?(\d+) different people|\b\d+ separate conversations/.test(floorText), floorText);
  assert('the only numeral in the empty state is the 14-day ceiling, which is a published rule',
    (floorText.match(/\d+/g) || []).every((n) => n === '14'), floorText.match(/\d+/g));
  assert('and the load-bearing sentence is present and untouched',
    /This is not a rating\./.test(floorText), floorText);

  // =====================================================================
  // 10 · EMPTY-STATE BRANCH ORDER
  // Scope-specific emptiness is evaluated BEFORE global emptiness. Written
  // the obvious way round, a user filtered to a quiet resort is told the whole
  // continent is quiet — and loses "This is not a rating." with it.
  // =====================================================================
  const emptyH = await page.$eval('#rants-empty-h', (e) => e.textContent);
  assert('a filtered quiet resort gets the scope-specific state, not the continent-scale one',
    /Nothing about Wolf Creek in the last 14 days/.test(emptyH), emptyH);
  assert('and never the global sentence', !/Nothing in the last 14 days$/.test(emptyH), emptyH);
  const exits = await page.$$eval('.rants-exits a', (els) => els.map((e) => e.textContent.trim()));
  assert('the per-resort empty state offers a way out', exits.length >= 2, exits);
  assert('Wolf Creek has no written take, so the exit falls back to "See Nicole\'s list"',
    exits.includes("See Nicole's list"), exits);
  assert('and it does not promise a take that does not exist',
    !exits.some((e) => /Read Nicole's take/.test(e)), exits);
  const hasTake = await page.evaluate(() => ({
    wolf: rantsHasTake('wolf-creek-co'),
    bigSky: rantsHasTake('big-sky-mt'),
    total: NICOLES_LIST.filter((r) => r.nicoles_take).length,
  }));
  assert('has_take is derived from the real takes table and is not uniformly true',
    hasTake.wolf === false && hasTake.bigSky === true && hasTake.total > 0 && hasTake.total < 44, hasTake);

  await go(page, '#rants=raves/vail-co');
  assert('one tab empty: the sibling count is filter-scoped and pluralises',
    /Rants has 1 topic right now/.test(await page.$eval('.rants-empty p', (e) => e.textContent)));

  // Both empty is reached by aging the clock past every window_end — the
  // off-season state, which runs for months at a time.
  await go(page, '#rants=rants');
  const bothEmpty = await page.evaluate(() => {
    const real = window.appNow;
    window.appNow = () => new Date('2099-01-01T12:00:00Z');
    render();
    const h = document.getElementById('rants-empty-h');
    const out = {
      heading: h ? h.textContent : null,
      exits: [...document.querySelectorAll('.rants-exits a')].map((a) => a.textContent.trim()),
      cards: document.querySelectorAll('.rants-card').length,
      frame: !!document.querySelector('.rants-frame'),
    };
    window.appNow = real;
    render();
    return out;
  });
  assert('both-empty is reachable and says nothing is held over',
    bothEmpty.heading === 'Nothing in the last 14 days', bothEmpty);
  assert('both-empty renders zero cards', bothEmpty.cards === 0, bothEmpty);
  assert('both-empty is not a dead end — it names all three exits',
    bothEmpty.exits.length === 3, bothEmpty.exits);
  assert('both-empty still declares the frame', bothEmpty.frame);

  // =====================================================================
  // 11 · UNKNOWN ROUTES NEVER WHITE-SCREEN
  // A mangled shared URL is this feature's likeliest failure, because links
  // pasted into group chats are its entire distribution model.
  // =====================================================================
  // A degraded payload DEGRADES rather than erroring. The two malformed-route
  // cases resolve to the default feed and the two not-found cases resolve to a
  // diagnosis with exits; a populated feed is itself the way out, so "offers a
  // way out" is asserted as cards-or-exits rather than exits alone.
  for (const [hash, label, expectFeed] of [
    ['#rants=rants/not-a-real-resort', 'an unknown scope', false],
    ['#rants=rants/alta-ut/no-such-topic-2027-01-01', 'an unknown topic', false],
    ['#rants=', 'an empty payload', true],
    ['#rants=wobble', 'an unknown tab', true],
  ]) {
    await go(page, hash);
    const body = await page.evaluate(() => ({
      text: document.querySelector('.rants-view') ? document.querySelector('.rants-view').textContent : '',
      h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
      exits: document.querySelectorAll('.rants-exits a, .rants-back').length,
      cards: document.querySelectorAll('.rants-card').length,
      listbar: document.getElementById('rants-listbar') ? document.getElementById('rants-listbar').textContent.trim() : null,
    }));
    assert(`${label} renders a real page, not a white screen`, body.text.length > 200, { hash, len: body.text.length });
    assert(`${label} never prints "undefined" or "NaN"`, !/undefined|NaN/.test(body.text), { hash });
    assert(`${label} offers a way out`, body.exits > 0 || body.cards > 0, { hash, exits: body.exits, cards: body.cards });
    if (expectFeed) {
      assert(`${label} degrades to the DEFAULT Rants feed rather than a foreign surface`,
        body.cards > 0 && body.listbar === 'Rants', { hash, listbar: body.listbar });
    }
  }
  await go(page, '#rants=rants/not-a-real-resort');
  assert('an unknown scope is diagnosed as a stale link, not as an empty resort',
    /older version of the page/.test(await page.$eval('#rants-empty-h', (e) => e.textContent)));
  await go(page, '#rants=rants/alta-ut/no-such-topic-2027-01-01');
  const unknownTopic = await page.$eval('.rants-view', (e) => e.textContent);
  assert('a topic that never existed is not told a confident false story about expiring',
    /older version of the page/.test(unknownTopic) && !/It held Reddit posts and comments from/.test(unknownTopic));
  assert('the filter button never renders "undefined"',
    !/undefined/.test(await page.evaluate(() => {
      state.rants.scope = 'not-a-real-resort'; state.rants.topic = null; render();
      return document.getElementById('rants-filter-btn').textContent;
    })));
  const scopeLookup = await page.evaluate(() => ({
    pass: rantsScopeName('ikon-pass'),
    none: rantsScopeName('none'),
    nullish: rantsScopeName(null),
    unknown: rantsScopeName('zzz'),
    resort: rantsScopeName('alta-ut'),
    canada: rantsScopeName('revelstoke-bc'),
  }));
  assert('a pass slug resolves to a display name — it is real data and was absent from the table before',
    scopeLookup.pass && scopeLookup.pass !== 'ikon-pass', scopeLookup);
  assert('the pass name comes from the app\'s own PASS_COPY, not a second table',
    scopeLookup.pass === 'Ikon pass', scopeLookup);
  assert('"none" resolves rather than falling through', scopeLookup.none === 'Not resort-specific', scopeLookup);
  assert('an unknown slug returns null, never undefined', scopeLookup.unknown === null, scopeLookup);
  assert('a resort resolves in the app\'s own house form', scopeLookup.resort === 'Alta, Utah', scopeLookup);
  assert('and a Canadian resort keeps its country, as everywhere else in the app',
    /, Canada$/.test(scopeLookup.canada), scopeLookup);

  // =====================================================================
  // 12 · THE EXPIRED SHARED LINK — the most important state in the feature
  // =====================================================================
  await go(page, '#rants=rants/alta-ut/lift-wait-2026-12-20');
  const expired = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent,
    text: document.querySelector('.rants-view').textContent,
    rows: [...document.querySelectorAll('.rants-wasfor div')].map((d) => d.querySelector('dt').textContent),
    quotes: document.querySelectorAll('.rants-quote').length,
    exits: [...document.querySelectorAll('.rants-exits a')].map((a) => a.textContent.trim()),
  }));
  assert('the expired state says the topic dropped off', /dropped off/.test(expired.h1), expired.h1);
  assert('it says what the link WAS for', expired.rows.join(',') === 'Resort,Topic,Dates', expired.rows);
  assert('without re-displaying anything that has expired', expired.quotes === 0, expired);
  assert('it restates the 14-day rule that caused it', /Nothing on this page is ever older than 14 days/.test(expired.text));
  assert('and it offers the live topics for the same resort', expired.exits.length >= 2, expired.exits);
  await go(page, '#rants=rants/ikon-pass/pass-rules-2027-01-18');
  const passExpired = await page.evaluate(() => {
    // Force the pass topic through the expired branch to prove the scope term
    // branches: hardcoding "Resort" labelled a pass scope "Resort — Ikon pass".
    const t = rantsTopicById('ikon-pass', 'pass-rules-2027-01-18');
    return rantsExpiredHtml(t);
  });
  assert('an expired PASS share labels the scope "Pass", not "Resort"',
    /<dt class="data-label">Pass<\/dt>/.test(passExpired) && !/>Resort</.test(passExpired));

  // =====================================================================
  // 13 · QUOTES — verbatim, attributed, never truncated
  // =====================================================================
  await go(page, '#rants=rants/alta-ut/lift-wait-2027-01-18');
  const quotes = await page.evaluate(() => {
    const t = rantsTopicById('alta-ut', 'lift-wait-2027-01-18');
    const rendered = [...document.querySelectorAll('.rants-quote__text')].map((e) => e.textContent.trim());
    const source = rantsLiveQuotes(t).map((q) => q.text);
    const first = document.querySelector('.rants-quote');
    return {
      rendered, source,
      attribFirst: first.firstElementChild.tagName === 'FIGCAPTION',
      linkLast: first.lastElementChild.classList.contains('rants-quote__out'),
      cite: first.querySelector('blockquote').getAttribute('cite'),
      permalink: rantsLiveQuotes(t)[0].permalink,
      ellipsis: rendered.some((r) => /…|\.\.\.$/.test(r)),
      figure: first.tagName === 'FIGURE',
      target: first.querySelector('.rants-quote__out').getAttribute('target'),
      rel: first.querySelector('.rants-quote__out').getAttribute('rel'),
      urlIsText: !!document.querySelector('.rants-quote__text a') === false,
    };
  });
  assert('every rendered quote is byte-identical to its source — nothing is rewritten',
    quotes.source.every((s) => quotes.rendered.includes(s)), { rendered: quotes.rendered.length, source: quotes.source.length });
  assert('nothing truncates at runtime', !quotes.ellipsis, quotes.rendered);
  assert('the block is a <figure>, so the quote and its attribution are one unit', quotes.figure);
  assert('attribution is at the TOP of the block, before the words', quotes.attribFirst);
  assert('the Reddit link is at the bottom, so the block is topped and tailed by Reddit signifiers', quotes.linkLast);
  assert('the blockquote carries cite= pointing at the source permalink', quotes.cite === quotes.permalink, quotes);
  assert('outbound links carry rel=noopener noreferrer', /noopener/.test(quotes.rel || ''), quotes.rel);
  assert('outbound links open in the SAME tab, matching what their accessible name says', quotes.target === null, quotes);
  const hiddenPrefix = await page.$$eval('.rants-quote__attrib .visually-hidden', (els) => els.map((e) => e.textContent));
  assert('a hidden prefix names the quote before the words are read, and branches post vs comment',
    hiddenPrefix.some((t) => /Quote from a Reddit post:/.test(t)) && hiddenPrefix.some((t) => /Quote from a Reddit comment:/.test(t)),
    hiddenPrefix);
  assert('the hidden prefix lives INSIDE the figcaption — a figcaption must be the first or last child of a figure',
    await page.$eval('.rants-quote figcaption .visually-hidden', (e) => !!e));

  await go(page, '#rants=rants');
  const perCard = await page.$$eval('.rants-card', (els) => els.map((e) => e.querySelectorAll('.rants-quote').length));
  assert('Rants carry 1 quote on the feed', perCard.every((n) => n === 1), perCard);
  await go(page, '#rants=raves');
  const perRave = await page.$$eval('.rants-card', (els) => els.map((e) => e.querySelectorAll('.rants-quote').length));
  assert('Raves carry 2 quotes on the feed — parity of evidence, not decoration', perRave.every((n) => n === 2), perRave);

  // The corpus is adversarial on purpose. A tidy corpus makes the structural
  // comprehension test pass trivially, which is exactly what happened before.
  const adversarial = await page.evaluate(() => {
    const all = RANTS_TOPICS.reduce((a, t) => a.concat(t.quotes.map((q) => q.text)), []);
    const lens = all.map((t) => t.length);
    return {
      profanity: all.some((t) => /\bfuck/i.test(t)),
      caps: all.some((t) => /\b[A-Z]{4,}\b/.test(t)),
      emoji: all.some((t) => /[\u{1F300}-\u{1FAFF}]/u.test(t)),
      url: all.some((t) => /https?:\/\//.test(t)),
      slang: all.some((t) => /death cookies|bulletproof|sendy/i.test(t)),
      typos: all.some((t) => /\badn\b|\bful\b|\bprolly\b/.test(t)),
      apostrophe: all.some((t) => /\bits brutal|\bits a joke/.test(t)),
      min: Math.min.apply(null, lens), max: Math.max.apply(null, lens),
      allInBand: lens.every((l) => l >= 40 && l <= 200),
      noPronounOpen: all.every((t) => !/^(It|They|He|She|This|That|These|Those|And|But|So|Also|Then)\b/.test(t)),
    };
  });
  assert('at least one quote carries profanity', adversarial.profanity);
  assert('at least one quote carries an ALL-CAPS run', adversarial.caps);
  assert('at least one quote carries emoji', adversarial.emoji);
  assert('at least one quote carries a raw URL', adversarial.url);
  assert('at least one quote carries heavy slang', adversarial.slang);
  assert('at least one quote carries typos', adversarial.typos);
  assert('at least one quote carries a missing apostrophe', adversarial.apostrophe);
  assert('every quote sits inside the 40-200 character band', adversarial.allInBand, adversarial);
  assert('one quote sits at the floor of the band', adversarial.min <= 46, adversarial);
  assert('one quote sits within 6 characters of the ceiling', adversarial.max >= 194, adversarial);
  assert('the length band spans >=120 characters, not a 30-character huddle',
    adversarial.max - adversarial.min >= 120, adversarial);
  assert('no quote opens on a pronoun or a connective', adversarial.noPronounOpen);
  assert('a raw URL inside a quote renders as TEXT, never as an anchor wearing our chrome', quotes.urlIsText);

  // =====================================================================
  // 14 · CORROBORATION — hueless, glyph AND text, in both schemes
  // =====================================================================
  await go(page, '#rants=rants');
  const corrob = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.rants-corrob').forEach((c) => {
      const glyph = c.querySelector('.rants-corrob__glyph');
      const label = c.querySelector('b');
      out.push({
        hasGlyph: !!glyph,
        glyphHidden: glyph ? glyph.getAttribute('aria-hidden') === 'true' : false,
        label: label ? label.textContent : null,
        glyphColor: glyph ? getComputedStyle(glyph).color : null,
        textColor: getComputedStyle(c.querySelector('.rants-corrob__line')).color,
        note: c.querySelector('.rants-corrob__note') ? c.querySelector('.rants-corrob__note').textContent : '',
      });
    });
    return out;
  });
  assert('every corroboration row carries a glyph', corrob.length > 0 && corrob.every((c) => c.hasGlyph), corrob.length);
  assert('and a discrete TEXT label, derived from the state enum rather than sniffed out of prose',
    corrob.every((c) => ['Matches', 'Does not match', 'Not published'].includes(c.label)), corrob.map((c) => c.label));
  assert('the glyph is aria-hidden, since the text label carries it', corrob.every((c) => c.glyphHidden));
  assert('the glyph is HUELESS — it takes the same colour as the text beside it, never green or red',
    corrob.every((c) => c.glyphColor === c.textColor), corrob.map((c) => [c.glyphColor, c.textColor]));
  assert('the disclaimer\'s second sentence is always present — without it corroboration reads as fact-checking',
    corrob.every((c) => /We did not check the posts and comments themselves/.test(c.note)));
  const allThree = await page.evaluate(() =>
    [...new Set(RANTS_TOPICS.filter((t) => t.corroboration).map((t) => t.corroboration.state))].sort());
  assert('all three corroboration states are present in the corpus',
    allThree.join(',') === 'does_not_match,matches,not_published', allThree);
  const corrobLink = await page.$eval('.rants-corrob a', (e) => ({
    visible: e.textContent, target: e.getAttribute('target'),
    decoration: getComputedStyle(e).textDecorationLine,
    h: e.getBoundingClientRect().height,
  }));
  assert('the corroboration source link keeps its visible run inside its accessible name (SC 2.5.3)',
    /Lift report/.test(corrobLink.visible));
  assert('and declares that it leaves the page', /leaves this page/.test(corrobLink.visible));
  assert('the arrow is decoration and is hidden from the accessible name',
    await page.$eval('.rants-corrob a span[aria-hidden="true"]', (e) => e.textContent.includes('→')));
  assert('the corroboration link is underlined, not distinguished by colour alone (G183)',
    /underline/.test(corrobLink.decoration), corrobLink);
  assert('and it is a 44px target', corrobLink.h >= 44, corrobLink);

  // =====================================================================
  // 15 · ACCESSIBILITY STRUCTURE
  // =====================================================================
  const struct = await page.evaluate(() => {
    const tabs = document.querySelector('.rants-tabs');
    return {
      tabTag: [...tabs.children].map((c) => c.tagName),
      tabRoles: [...tabs.children].map((c) => c.getAttribute('role')),
      navRole: tabs.getAttribute('role'),
      navLabel: tabs.getAttribute('aria-label'),
      current: tabs.querySelectorAll('[aria-current]').length,
      hrefs: [...tabs.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      headings: [...document.querySelectorAll('.rants-view h1, .rants-view h2, .rants-view h3')].map((h) => +h.tagName[1]),
      listRole: document.querySelector('.rants-bracket ul').getAttribute('role'),
      listbarTag: document.getElementById('rants-listbar').tagName,
      listbarFocusable: document.getElementById('rants-listbar').getAttribute('tabindex'),
      hrTag: document.querySelector('.rants-card__rule').getAttribute('aria-hidden'),
    };
  });
  assert('the tabs are LINKS, not buttons and not an ARIA tablist',
    struct.tabTag.every((t) => t === 'A') && struct.tabRoles.every((r) => r === null) && struct.navRole === null, struct);
  assert('the tab nav is labelled', struct.navLabel === 'Show rants or raves', struct);
  assert('exactly one tab is current', struct.current === 1, struct);
  assert('both tabs have real hrefs, so they are shareable and middle-clickable',
    struct.hrefs.every((h) => /^#rants=/.test(h)), struct.hrefs);
  assert('the heading outline runs h1 -> h2 -> h3 with nothing skipped',
    struct.headings.every((lvl, i) => i === 0 ? lvl === 1 : lvl - struct.headings[i - 1] <= 1), struct.headings);
  assert('the list carries an explicit role=list, which list-style:none otherwise strips in Safari',
    struct.listRole === 'list', struct);
  assert('the list bar is the panel h2 AND a focus target', struct.listbarTag === 'H2' && struct.listbarFocusable === '-1', struct);
  assert('the drawn rule inside a card is aria-hidden, so it is not announced once per card',
    struct.hrTag === 'true', struct);
  const threads = await page.$$eval('.rants-threads', (els) => els.map((e) => e.textContent));
  assert('every card carries the threads line — the card\'s only crop defence',
    threads.length >= (await page.$$eval('.rants-card', (e) => e.length)), threads.length);
  assert('and every one of them contains the word "Reddit"', threads.every((t) => /Reddit/.test(t)));
  const scopes = await page.$$eval('.rants-card__scope', (els) => els.map((e) => e.textContent.trim()));
  assert('every card names its scope, so no card is the app asserting something unattributed',
    scopes.every((s) => s.length > 0), scopes);

  // Focus management. Every empty state's heading is a focus target, because
  // the heading IS the explanation.
  for (const [hash, label] of [
    ['#rants=rants', 'the populated feed'],
    ['#rants=raves/vail-co', 'a one-tab-empty feed'],
    ['#rants=rants/wolf-creek-co', 'a per-resort empty feed'],
  ]) {
    await go(page, hash);
    assert(`${label} exposes a focusable panel heading`,
      await page.evaluate(() => {
        const h = document.getElementById('rants-listbar') || document.getElementById('rants-empty-h');
        return !!h && h.getAttribute('tabindex') === '-1';
      }), { hash });
  }
  await go(page, '#rants=rants/alta-ut/lift-wait-2026-12-20');
  assert('the expired-link state exposes a focus target too',
    await page.$eval('#rants-empty-h', (e) => e.getAttribute('tabindex') === '-1'));

  // Switching tabs moves focus to the panel heading. Without it, switching
  // INTO an empty tab drops focus to <body> silently, at the exact moment the
  // user most needs to be told what happened.
  await go(page, '#rants=rants');
  await page.click('.rants-tabs a[href="#rants=raves"]');
  await page.waitForTimeout(500);
  assert('a tab switch moves focus to the panel heading',
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'rants-listbar'),
    await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
  assert('and the tab switch is a real route change', /#rants=raves/.test(page.url()));
  await go(page, '#rants=raves');
  await page.click('.rants-tabs a[href="#rants=rants"]');
  await page.waitForTimeout(500);
  assert('switching back also lands on the panel heading',
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'rants-listbar'));

  // =====================================================================
  // 16 · THE FILTER SHEET
  // =====================================================================
  await go(page, '#rants=rants');
  assert('the filter button declares aria-expanded alongside aria-haspopup',
    await page.$eval('#rants-filter-btn', (e) => e.getAttribute('aria-haspopup') === 'dialog' && e.getAttribute('aria-expanded') === 'false'));
  await page.click('#rants-filter-btn');
  await page.waitForTimeout(350);
  const sheetOpen = await page.evaluate(() => ({
    hidden: document.getElementById('rants-sheet').hidden,
    expanded: document.getElementById('rants-filter-btn').getAttribute('aria-expanded'),
    focused: document.activeElement && document.activeElement.id,
    inert: document.querySelector('.app-shell').hasAttribute('inert'),
    modal: document.getElementById('rants-sheet').getAttribute('aria-modal'),
    labelled: document.getElementById('rants-sheet').getAttribute('aria-labelledby'),
    scrim: !document.getElementById('rants-sheet-scrim').hidden,
    rows: document.querySelectorAll('#rants-sheet-body li button').length,
    rowH: document.querySelector('#rants-sheet-body li button').getBoundingClientRect().height,
    allRow: document.querySelector('#rants-sheet-body li button').textContent.trim(),
    listRole: document.querySelector('#rants-sheet-body ul').getAttribute('role'),
  }));
  assert('the sheet opens', sheetOpen.hidden === false, sheetOpen);
  assert('and updates aria-expanded on its opener', sheetOpen.expanded === 'true', sheetOpen);
  assert('focus lands on the dialog heading, not on the search field',
    sheetOpen.focused === 'rants-sheet-title', sheetOpen);
  assert('the page behind the modal is made inert', sheetOpen.inert, sheetOpen);
  assert('the sheet is a labelled modal dialog',
    sheetOpen.modal === 'true' && sheetOpen.labelled === 'rants-sheet-title', sheetOpen);
  assert('a scrim absorbs clicks behind the panel', sheetOpen.scrim, sheetOpen);
  assert('every resort in the app is offered', sheetOpen.rows >= 71, sheetOpen);
  assert('rows are 48px', sheetOpen.rowH >= 48, sheetOpen);
  assert('the default value is a row that carries aria-current, not a second reset control',
    sheetOpen.allRow === 'All resorts', sheetOpen);
  assert('the sheet list carries an explicit role=list too', sheetOpen.listRole === 'list', sheetOpen);
  const sheetCountText = await page.$$eval('#rants-sheet-body .rants-sheet__count', (els) => els.map((e) => e.textContent));
  assert('sheet counts read "N topics", never a bare number beside a resort name',
    sheetCountText.length > 0 && sheetCountText.every((t) => /^\d+ topics?$/.test(t)), sheetCountText);
  assert('and the accessible name says which tab the count is for',
    await page.$eval('#rants-sheet-body li button .visually-hidden', (e) => / in Rants$/.test(e.textContent)));
  // Escape closes and returns focus.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert('Escape closes the sheet',
    await page.evaluate(() => document.getElementById('rants-sheet').hidden));
  assert('and focus returns to the control that opened it, re-queried by id after the render',
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'rants-filter-btn'));
  assert('the background is no longer inert',
    await page.evaluate(() => !document.querySelector('.app-shell').hasAttribute('inert')));
  assert('the closed sheet stops hit-testing immediately — no invisible full-screen dialog eating taps',
    await page.evaluate(() => {
      const s = document.getElementById('rants-sheet');
      s.hidden = false; s.dataset.open = 'false';
      const pe = getComputedStyle(s).pointerEvents;
      s.hidden = true;
      return pe === 'none';
    }));
  // Search behaviour.
  await page.click('#rants-filter-btn');
  await page.waitForTimeout(300);
  await page.fill('#rants-sheet-q', 'beaver');
  await page.waitForTimeout(600);
  const beaver = await page.evaluate(() => document.getElementById('rants-sheet-body').textContent);
  assert('a search matching only resorts with nothing pluralises correctly — "1 resorts have nothing" is gone',
    !/\b1 resorts have\b/.test(beaver) && (/1 match has nothing/.test(beaver) || /matches have nothing/.test(beaver)), beaver.slice(0, 200));
  assert('and the disclosure body carries the "not a rating" line',
    /That is not a rating\./.test(beaver));
  await page.fill('#rants-sheet-q', 'zzzz');
  await page.waitForTimeout(600);
  assert('a search matching nothing explains itself rather than rendering an empty list',
    /No resort matches/.test(await page.$eval('.rants-sheet__nomatch', (e) => e.textContent)));
  // Picking a resort navigates and announces the outcome.
  await page.fill('#rants-sheet-q', 'Alta');
  await page.waitForTimeout(500);
  await page.click('#rants-sheet-body li button[data-pick="alta-ut"]');
  await page.waitForTimeout(700);
  const picked = await page.evaluate(() => ({
    hash: location.hash,
    hidden: document.getElementById('rants-sheet').hidden,
    btn: document.getElementById('rants-filter-btn').textContent.trim(),
    listbar: document.getElementById('rants-listbar').textContent,
    announced: document.getElementById('rants-status-announcer').textContent,
    focus: document.activeElement && document.activeElement.id,
  }));
  assert('picking a resort produces a real, shareable URL', /#rants=rants\/alta-ut/.test(picked.hash), picked);
  assert('the sheet closes on pick', picked.hidden, picked);
  assert('the filter button shows the active value', /Alta, Utah/.test(picked.btn), picked);
  assert('a filtered feed SAYS it is filtered, in the list bar', /Alta, Utah/.test(picked.listbar), picked);
  assert('and says it in words for a screen reader rather than relying on a middle dot',
    /filtered to Alta, Utah/.test(picked.listbar), picked);
  assert('the outcome is announced, not the action', /topics?$/.test(picked.announced), picked);
  assert('and focus returns to the filter button', picked.focus === 'rants-filter-btn', picked);
  const endOfList = await page.$$eval('.rants-endoflist p', (els) => els.map((e) => e.textContent));
  assert('the end-of-list marker is scoped to the filter, not a continent-scale sentence',
    /for Alta/.test(endOfList[0]), endOfList);
  assert('the end-of-list block is three lines, all unconditional', endOfList.length === 3, endOfList);
  assert('and the third acknowledges that the feed shrinks, with no threshold behind it',
    /shrinks when Reddit is quiet/.test(endOfList[2]), endOfList);
  // A route change closes the sheet rather than orphaning its focus trap.
  await page.click('#rants-filter-btn');
  await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = '#rants=raves'; });
  await page.waitForTimeout(600);
  assert('a route change closes the sheet rather than orphaning its focus trap',
    await page.evaluate(() => document.getElementById('rants-sheet').hidden &&
      !document.querySelector('.app-shell').hasAttribute('inert')));

  // =====================================================================
  // 17 · STATUS MESSAGES AND THE SORT
  // =====================================================================
  await go(page, '#rants=rants');
  const regions = await page.evaluate(() => ({
    own: !!document.getElementById('rants-status-announcer'),
    live: (document.getElementById('rants-status-announcer') || {}).getAttribute
      ? document.getElementById('rants-status-announcer').getAttribute('aria-live') : null,
    separate: document.getElementById('rants-status-announcer') !== document.getElementById('app-toast'),
    help: document.getElementById('rants-sort').getAttribute('aria-describedby'),
    helpExists: !!document.getElementById('rants-sort-help'),
    helpText: document.getElementById('rants-sort-help').textContent,
  }));
  assert('a dedicated status region exists', regions.own && regions.live === 'polite', regions);
  assert('and is separate from the toast, so one cannot clobber the other', regions.separate);
  assert('the sort help is wired as aria-describedby with no dangling reference',
    regions.help === 'rants-sort-help' && regions.helpExists, regions);
  assert('the sort help describes the SELECTED option', /Unusual first/.test(regions.helpText), regions.helpText);
  const helpPos = await page.evaluate(() => {
    const help = document.getElementById('rants-sort-help');
    const bracket = document.querySelector('.rants-bracket');
    return (bracket.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING) > 0;
  });
  assert('the sort help sits BELOW the bracket, not between the controls and the first card', helpPos);
  await page.selectOption('#rants-sort', 'newest');
  await page.waitForTimeout(600);
  const sorted = await page.evaluate(() => ({
    help: document.getElementById('rants-sort-help').textContent,
    announced: document.getElementById('rants-status-announcer').textContent,
    focus: document.activeElement && document.activeElement.id,
    value: document.getElementById('rants-sort').value,
  }));
  assert('the sort help switches with the value, rather than always describing the other option',
    /Newest first/.test(sorted.help), sorted);
  assert('the sort outcome is announced with a count', /topics?$/.test(sorted.announced), sorted);
  assert('and focus stays on the control, re-queried by id after the render',
    sorted.focus === 'rants-sort' && sorted.value === 'newest', sorted);

  // =====================================================================
  // 18 · MOTION — opacity only, and nothing on the four protected elements
  // =====================================================================
  const motion = await page.evaluate(() => {
    const props = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const s = getComputedStyle(el);
      return { prop: s.transitionProperty, dur: s.transitionDuration, anim: s.animationName, transform: s.transform };
    };
    return {
      view: props('.rants-view'),
      count: props('.rants-count'),
      glyph: props('.rants-corrob__glyph'),
      quote: props('.rants-quote'),
      frame: props('.rants-frame'),
      bracket: props('.rants-bracket'),
      tabRule: (() => { const a = document.querySelector('.rants-tabs a[aria-current]'); return a ? getComputedStyle(a, '::after').transitionProperty : null; })(),
    };
  });
  assert('the view transitions opacity only — zero transforms anywhere',
    motion.view.prop === 'opacity', motion.view);
  // "Never animates" is duration 0s and no keyframe animation. transition-property
  // computes to its INITIAL value `all` on any element that declares no
  // transition, so reading the property alone reports motion that cannot occur;
  // the duration is what decides it.
  const still = (m) => !!m && m.dur === '0s' && m.anim === 'none';
  assert('the COUNT never animates — an animating number is a number performing as a score', still(motion.count), motion.count);
  assert('the corroboration GLYPH never animates — a self-drawing checkmark is a "verified" gesture', still(motion.glyph), motion.glyph);
  assert('the QUOTE BLOCK never animates — motion on it is the app performing with someone else\'s speech', still(motion.quote), motion.quote);
  assert('the standing FRAME never animates', still(motion.frame), motion.frame);
  assert('the bracket never animates', still(motion.bracket), motion.bracket);
  assert('none of the protected elements carries a transform',
    [motion.count, motion.glyph, motion.quote, motion.frame, motion.bracket]
      .every((m) => m.transform === 'none'), motion);
  const reduced = await newPage(browser, { reducedMotion: 'reduce' });
  await go(reduced, '#rants=rants');
  const rm = await reduced.evaluate(() => ({
    view: getComputedStyle(document.querySelector('.rants-view')).transitionDuration,
    sheet: getComputedStyle(document.getElementById('rants-sheet')).transitionDuration,
    faded: (() => { const v = document.querySelector('.rants-view'); v.dataset.fading = 'true'; const o = getComputedStyle(v).opacity; v.dataset.fading = 'false'; return o; })(),
  }));
  assert('under prefers-reduced-motion the fade is REMOVED, not shortened',
    rm.view === '0s' && rm.sheet === '0s', rm);
  assert('and a view that is marked fading is still fully opaque, so nothing can be left invisible',
    rm.faded === '1', rm);
  await reduced.click('.rants-tabs a[href="#rants=raves"]');
  await reduced.waitForTimeout(400);
  assert('a tab switch under reduced motion still renders, with no deferred paint to strand it',
    (await reduced.$$eval('.rants-card', (e) => e.length)) > 0);
  await reduced.close();

  // =====================================================================
  // 19 · CONTRAST — measured from the real computed styles, in BOTH schemes.
  // Dark mode exists in this app (styles.css, prefers-color-scheme block), so
  // it is verified rather than deleted.
  // =====================================================================
  for (const scheme of ['light', 'dark']) {
    const p = await newPage(browser, { colorScheme: scheme });
    await go(p, '#rants=rants');
    const pairs = [
      ['.rants-quote__attrib', 'quote attribution on the quote field', 4.5],
      ['.rants-quote__text', 'quote text on the quote field', 4.5],
      ['.rants-card__scope', 'card scope line', 4.5],
      ['.rants-threads', 'the threads line', 4.5],
      ['.rants-count', 'the count', 4.5],
      ['.rants-window', 'the date window', 4.5],
      ['.rants-corrob__note', 'the corroboration disclaimer', 4.5],
      ['.rants-corrob__line', 'the corroboration indicator', 4.5],
      ['.rants-endoflist p', 'the end-of-list line', 4.5],
      ['.rants-frame__short', 'the standing frame short form', 4.5],
      ['.rants-listbar', 'the list bar', 4.5],
      ['#rants-sort-help', 'the sort help text', 4.5],
      ['.rants-corrob a', 'the corroboration source link', 4.5],
      ['.rants-quote__out', 'the outbound quote link', 4.5],
      ['#rants-filter-btn', 'the filter button label on its fill', 4.5],
      ['#rants-sort', 'the sort control label on its fill', 4.5],
      ['.rants-tabs a[aria-current]', 'the current tab', 4.5],
      ['.rants-tabs a:not([aria-current])', 'the inactive tab', 4.5],
    ];
    for (const [sel, label, floor] of pairs) {
      const got = await p.evaluate(([s, effBg]) => {
        const el = document.querySelector(s);
        if (!el) return null;
        // eslint-disable-next-line no-new-func
        const bgFn = new Function('return ' + effBg)();
        return { fg: getComputedStyle(el).color, bg: bgFn(s) };
      }, [sel, EFF_BG.toString()]);
      if (!got) { assert(`[${scheme}] ${label}: element exists to measure`, false, sel); continue; }
      const ratio = contrast(parseRgb(got.fg), parseRgb(got.bg));
      assert(`[${scheme}] ${label} clears ${floor}:1 (AA text)`, ratio >= floor,
        { ratio: +ratio.toFixed(2), fg: got.fg, bg: got.bg });
    }
    // Non-text contrast, SC 1.4.11.
    const nonText = await p.evaluate(([effBg]) => {
      // eslint-disable-next-line no-new-func
      const bgFn = new Function('return ' + effBg)();
      const quote = document.querySelector('.rants-quote');
      const frame = document.querySelector('.rants-frame');
      const btn = document.querySelector('#rants-filter-btn');
      const bracket = document.querySelector('.rants-bracket');
      return {
        quoteBorder: getComputedStyle(quote).borderTopColor,
        quoteField: getComputedStyle(quote).backgroundColor,
        page: getComputedStyle(document.body).backgroundColor,
        frameRule: getComputedStyle(frame).borderTopColor,
        controlFill: getComputedStyle(btn).backgroundColor,
        controlText: getComputedStyle(btn).color,
        bracketRule: getComputedStyle(bracket).borderTopColor,
        cardHover: (() => {
          // The tint only exists under :hover, so it has to be forced before it
          // can be measured — reading a resting card just reports the page.
          const card = document.querySelector('.rants-card');
          const prev = card.style.background;
          card.style.background = getComputedStyle(document.documentElement).getPropertyValue('--bg-tint').trim();
          const v = getComputedStyle(card).backgroundColor;
          card.style.background = prev;
          return v;
        })(),
        quoteOverHover: (() => {
          const card = document.querySelector('.rants-card');
          const prev = card.style.background;
          card.style.background = getComputedStyle(document.documentElement).getPropertyValue('--bg-tint').trim();
          const v = getComputedStyle(card.querySelector('.rants-quote')).backgroundColor;
          card.style.background = prev;
          return v;
        })(),
      };
    }, [EFF_BG.toString()]);
    const cr = (a, b) => contrast(parseRgb(a), parseRgb(b));
    assert(`[${scheme}] the quote border clears 3:1 against the page (SC 1.4.11) — it is the surface's one signal`,
      cr(nonText.quoteBorder, nonText.page) >= 3, { ratio: +cr(nonText.quoteBorder, nonText.page).toFixed(2) });
    assert(`[${scheme}] the frame rule clears 3:1 — its whole identity is "rules, not a box"`,
      cr(nonText.frameRule, nonText.page) >= 3, { ratio: +cr(nonText.frameRule, nonText.page).toFixed(2) });
    assert(`[${scheme}] the control fill clears 3:1 against the page — a fill you cannot see is an outline you refused to draw`,
      cr(nonText.controlFill, nonText.page) >= 3, { ratio: +cr(nonText.controlFill, nonText.page).toFixed(2), fill: nonText.controlFill });
    assert(`[${scheme}] the control label clears 4.5:1 on that fill`,
      cr(nonText.controlText, nonText.controlFill) >= 4.5, { ratio: +cr(nonText.controlText, nonText.controlFill).toFixed(2) });
    assert(`[${scheme}] the bracket rule clears 3:1`,
      cr(nonText.bracketRule, nonText.page) >= 3, { ratio: +cr(nonText.bracketRule, nonText.page).toFixed(2) });
    assert(`[${scheme}] the quote block keeps its OWN field, so it never inherits the card hover tint`,
      nonText.quoteOverHover !== nonText.cardHover && nonText.quoteOverHover === nonText.quoteField,
      { field: nonText.quoteField, hover: nonText.cardHover, overHover: nonText.quoteOverHover });

    // The focus ring is the app's own, drawn outside the control on the page —
    // which is why a filled control needs no special ring here.
    const ring = await p.evaluate(() => {
      const b = document.getElementById('rants-filter-btn');
      b.focus();
      const s = getComputedStyle(b);
      return { shadow: s.boxShadow, outline: s.outlineStyle };
    });
    assert(`[${scheme}] the filter button takes the app's standard focus indicator`,
      /rgb/.test(ring.shadow) && ring.shadow !== 'none', ring);
    await p.close();
  }

  // =====================================================================
  // 20 · TARGETS AND RESPONSIVE BEHAVIOUR — measured, not assumed
  // =====================================================================
  for (const [w, fs, label] of [[320, 16, '320px'], [320, 32, '320px at 200% zoom'], [390, 32, '390px at 200% zoom']]) {
    for (const hash of ['#rants=rants', '#rants=raves', '#rants=rants/alta-ut/lift-wait-2027-01-18', '#rants=rants/wolf-creek-co']) {
      const p = await newPage(browser, { viewport: { width: w, height: 844 } });
      await go(p, hash);
      if (fs !== 16) { await p.addStyleTag({ content: `html{font-size:${fs}px}` }); await p.waitForTimeout(250); }
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert(`[${label}] ${hash}: no page-level horizontal overflow`, overflow <= 0, { overflow });
      await p.close();
    }
  }
  // The nav gained a fifth item. Measured rather than assumed.
  const navP = await newPage(browser, { viewport: { width: 320, height: 844 } });
  await go(navP, '#rants=rants');
  const nav = await navP.evaluate(() => {
    const items = [...document.querySelectorAll('#bottom-nav .nav-item')];
    return {
      count: items.length,
      cells: items.map((i) => +i.getBoundingClientRect().width.toFixed(1)),
      labels: items.map((i) => {
        const l = i.querySelector('span:last-child');
        return { text: l.textContent, w: +l.getBoundingClientRect().width.toFixed(1), cell: +i.getBoundingClientRect().width.toFixed(1) };
      }),
      navOverflow: document.getElementById('bottom-nav').scrollWidth - document.getElementById('bottom-nav').clientWidth,
      current: document.querySelector('#bottom-nav .nav-item[aria-current="page"]').dataset.route,
      minH: Math.min.apply(null, items.map((i) => i.getBoundingClientRect().height)),
    };
  });
  assert('the nav carries five items', nav.count === 5, nav.count);
  assert('five nav items fit at 320px with no overflow', nav.navOverflow <= 0, nav);
  assert('and no nav label is wider than its cell at 320px',
    nav.labels.every((l) => l.w <= l.cell), nav.labels);
  assert('every nav cell is still a 44px-plus target', nav.minH >= 44, nav);
  assert('the Rants tab marks itself current on this route', nav.current === 'rants', nav);
  const navSemantics = await navP.evaluate(() => {
    const b = document.querySelector('#bottom-nav .nav-item[data-route="rants"]');
    const t = document.querySelector('#top-nav .nav-item[data-route="rants"]');
    return {
      inBoth: !!b && !!t,
      tag: b.tagName, type: b.getAttribute('type'),
      label: b.getAttribute('aria-label'),
      visible: b.querySelector('span:last-child').textContent,
      svg: b.querySelector('svg') ? b.querySelector('svg').getAttribute('stroke-width') : null,
      iconHidden: b.querySelector('span').getAttribute('aria-hidden'),
    };
  });
  assert('the Rants item is in BOTH navs', navSemantics.inBoth, navSemantics);
  assert('it follows the house nav pattern: a real <button type="button">',
    navSemantics.tag === 'BUTTON' && navSemantics.type === 'button', navSemantics);
  assert('its visible label is one word and its full name rides on aria-label, per the Nicole\'s precedent',
    navSemantics.visible === 'Rants' && navSemantics.label === 'Rants & Raves', navSemantics);
  assert('its icon matches the house stroke style and is aria-hidden',
    navSemantics.svg === '2' && navSemantics.iconHidden === 'true', navSemantics);
  await navP.close();

  // Every min-height in the surface is a touch target, not layout.
  await go(page, '#rants=rants');
  const targets = await page.evaluate(() => {
    const sels = ['.rants-tabs a', '#rants-filter-btn', '#rants-sort', '.rants-quote__out', '.rants-corrob a',
      '.rants-frame__more > summary', '.rants-card h3 a'];
    const out = {};
    sels.forEach((s) => {
      const el = document.querySelector(s);
      if (el) out[s] = { h: +el.getBoundingClientRect().height.toFixed(1), w: +el.getBoundingClientRect().width.toFixed(1) };
    });
    return out;
  });
  Object.entries(targets).forEach(([sel, box]) => {
    assert(`${sel} is at least a 44px target on both axes`, box.h >= 44 && box.w >= 44, box);
  });
  assert('the tabs are a real 48px tall, with padding rather than margin carrying the target width',
    targets['.rants-tabs a'].h >= 48, targets['.rants-tabs a']);

  // =====================================================================
  // 21 · SHARE — provenance travels, and a failed copy never claims success
  // =====================================================================
  const share = await page.evaluate(() => {
    const t = rantsTopicById('alta-ut', 'lift-wait-2027-01-18');
    return { text: rantsShareText(t), hash: rantsShareHash(t), footer: RANTS_SHARE_FOOTER };
  });
  assert('the share text carries the provenance footer — the only answer to "who is saying this?" outside the frame',
    share.text.includes(share.footer), share);
  assert('and it names the polarity, which the surface\'s own tab cannot travel with',
    /^Rants — /.test(share.text), share);
  assert('the share text contains NO quote — a verbatim quote outside the surface has no attribution container',
    !/"|“/.test(share.text), share);
  assert('the share link points back at the topic', /^#rants=rants\/alta-ut\//.test(share.hash), share);
  await go(page, '#rants=rants/alta-ut/lift-wait-2027-01-18');
  assert('the expiry caveat is PERSISTENT beside the share control, not a toast the sender may miss',
    await page.$eval('#rants-share-note', (e) => /stops working when this topic drops off/.test(e.textContent) &&
      e.getBoundingClientRect().height > 1));
  const shareSrc = html.slice(html.indexOf('async function rantsShare'), html.indexOf('async function rantsShare') + 1400);
  assert('a failed clipboard write does not report success — the handlers are different paths',
    /showToast\("Link copied"\)/.test(shareSrc) && /Couldn't copy the link/.test(shareSrc), null);
  assert('and an absent clipboard API takes the failure path rather than the success one',
    /throw new Error\("no clipboard"\)/.test(shareSrc));

  // =====================================================================
  // 22 · NICOLE DOES NOT APPEAR INSIDE THIS SURFACE
  // One exception: the chrome link in a per-resort empty state, which crosses
  // a navigation event into a re-declared frame.
  // =====================================================================
  for (const [hash, label] of [
    ['#rants=rants', 'the feed'],
    ['#rants=raves', 'the raves feed'],
    ['#rants=rants/alta-ut/lift-wait-2027-01-18', 'the detail view'],
  ]) {
    await go(page, hash);
    const mentions = await page.evaluate(() => {
      const v = document.querySelector('.rants-view');
      const frame = v.querySelector('.rants-frame');
      const clone = v.cloneNode(true);
      // The frame names her as the picker on purpose — that is the attribution
      // doing its job, not Nicole speaking.
      const fc = clone.querySelector('.rants-frame');
      if (fc) fc.remove();
      return { outsideFrame: (clone.textContent.match(/Nicole/g) || []).length, inFrame: !!frame };
    });
    assert(`${label}: Nicole appears nowhere outside the provenance frame`, mentions.outsideFrame === 0, mentions);
  }
  await go(page, '#rants=rants/big-sky-mt');
  const bigSkyExits = await page.$$eval('.rants-exits a', (els) => els.map((e) => e.textContent.trim()));
  assert('the one permitted crossing exists, and names the take because Big Sky actually has one',
    bigSkyExits.some((e) => /Read Nicole's take on Big Sky/.test(e)), bigSkyExits);

  // =====================================================================
  // 23 · THE FRONT DOOR
  // The nav is hidden on the splash route, so without a mode card a first-time
  // visitor has no path to this surface at all — they would have to enter
  // another surface first, or hand-type the hash. That is exactly what shipped
  // in the first pass of this branch, and nothing caught it, so it is asserted
  // here now.
  // =====================================================================
  const splash = await newPage(browser, { viewport: { width: 320, height: 568 } });
  await splash.goto(FILE_URL);
  await splash.waitForTimeout(400);
  const front = await splash.evaluate(() => {
    const card = document.getElementById('mode-rants');
    const cards = [...document.querySelectorAll('.mode-card')];
    if (!card) return { present: false, count: cards.length };
    const label = card.querySelector('.mode-card__label');
    const support = card.querySelector('.mode-card__support');
    const box = card.getBoundingClientRect();
    return {
      present: true,
      count: cards.length,
      tag: card.tagName, type: card.getAttribute('type'),
      label: label.textContent.trim(),
      support: support.textContent.trim(),
      labelFits: label.getBoundingClientRect().right <= box.right + 0.5,
      h: +box.height.toFixed(0), w: +box.width.toFixed(0),
      navHidden: document.getElementById('bottom-nav').hidden && document.getElementById('top-nav').hidden,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // The splash card and the nav item are two doors to one room. If the
      // marks drift they stop reading as the same destination, so the paths are
      // compared rather than eyeballed.
      splashPath: card.querySelector('svg path').getAttribute('d'),
    };
  });
  assert('the splash offers a Rants & Raves entry point', front.present, front);
  assert('the nav really is hidden on the splash, which is why the card has to exist', front.navHidden, front);
  assert('it is a real <button type="button">, like the other three modes',
    front.tag === 'BUTTON' && front.type === 'button', front);
  assert('it carries equal billing as a fourth mode card, not a footer link', front.count === 4, front);
  assert('its label is the surface name in full', front.label === 'Rants & Raves', front);
  assert('the label does not overflow its card at 320px', front.labelFits, front);
  assert('the support copy names Reddit and points outward',
    /skiers are saying on Reddit/.test(front.support), front.support);
  assert('the support copy asserts nothing about what the content says',
    !/\b(buzz|chatter|reviews?|ratings?|best|worst|top|hot|trending|popular)\b/i.test(front.support), front.support);
  assert('the splash grid does not overflow at 320px with four cards', front.overflowX <= 0, front);
  const navPath = await splash.evaluate(() =>
    document.querySelector('#bottom-nav .nav-item[data-route="rants"] svg path').getAttribute('d'));
  assert('the splash card and the nav item use the SAME glyph, so the two doors read as one room',
    front.splashPath === navPath, { splash: front.splashPath, nav: navPath });
  await splash.click('#mode-rants');
  await splash.waitForTimeout(500);
  const landed = await splash.evaluate(() => ({
    route: state.route, hash: location.hash,
    h1: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
    navShown: !document.getElementById('bottom-nav').hidden,
    current: (document.querySelector('#bottom-nav .nav-item[aria-current="page"]') || {}).dataset,
  }));
  assert('the card actually navigates to the surface', landed.route === 'rants' && /Rants/.test(landed.h1 || ''), landed);
  assert('and it lands on the default Rants tab with a real URL', landed.hash === '#rants=rants', landed);
  assert('arriving from the splash reveals the nav with Rants current',
    landed.navShown && landed.current && landed.current.route === 'rants', landed);
  await splash.close();

  // =====================================================================
  // 24 · NO ERRORS, ON ANY ROUTE
  // =====================================================================
  for (const hash of ['#rants=rants', '#rants=raves', '#rants=rants/alta-ut/lift-wait-2027-01-18',
    '#rants=rants/alta-ut/lift-wait-2026-12-20', '#rants=rants/wolf-creek-co', '#rants=rants/not-a-real-resort',
    '#rants=rants/ikon-pass/pass-rules-2027-01-18', '#rants=raves/vail-co', '#rants=']) {
    await go(page, hash);
  }
  assert('no page or console errors on any Rants & Raves route', pageErrors.length === 0, pageErrors.slice(0, 5));

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name, c.pass ? '' : JSON.stringify(c.extra)));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
