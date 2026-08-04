// Reproduces design-critic.md's 240-run headless simulation methodology
// (all 4 group types x all 4 budgets x 3 origins x all 4 vibes = 192 runs,
// plus a skill-level dimension to reach a comparable N) to report the new
// hot-take-resort win rate after removing the hot-take tie-break (critical
// fix #1). Also re-confirms the banned-resort guarantee for mixed-ability
// first-timer groups.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('**://fonts.gstatic.com/**', (r) => r.abort());
  await page.goto(FILE_URL);

  const report = await page.evaluate(() => {
    const groupTypes = ['solo', 'matched', 'mixed', 'wide-mixed'];
    const budgets = ['$', '$$', '$$$', '$$$$'];
    const origins = ['denver', 'seattle', 'northeast']; // 3 origins, per design-critic.md methodology
    const vibes = ['lively', 'chill', 'family', 'noPreference'];
    const skillByGroup = {
      solo: [['intermediate']],
      matched: [['advanced']],
      mixed: [['beginner', 'intermediate']],
      'wide-mixed': [['never-skied', 'expert']],
    };

    const poolSize = RESORTS.length;
    const withTakeIds = new Set(RESORTS.filter((r) => r.hot_take).map((r) => r.id));
    const poolHotTakeShare = withTakeIds.size / poolSize;

    const bannedForMixedFirstTimer = new Set(['jackson-hole-wy', 'alta-ut', 'kicking-horse-bc', 'revelstoke-bc']);
    let total = 0;
    let hotTakeWins = 0;
    const winCounts = {};
    let bannedViolations = [];

    for (const groupType of groupTypes) {
      for (const skillLevels of skillByGroup[groupType]) {
        for (const budget of budgets) {
          for (const origin of origins) {
            for (const vibe of vibes) {
              for (const terrain of ['mix']) {
                for (const travelMode of ['driving']) {
                  total++;
                  const answers = { groupType, skillLevels, terrain, budget, travelMode, region: origin, vibe };
                  const result = matchTrip(answers, RESORTS);
                  if (!result) continue;
                  const id = result.resort.id;
                  winCounts[id] = (winCounts[id] || 0) + 1;
                  if (withTakeIds.has(id)) hotTakeWins++;

                  const isFirstTimerMixed = skillLevels.includes('never-skied') &&
                    (skillLevels.includes('expert') || skillLevels.includes('advanced')) &&
                    (groupType === 'mixed' || groupType === 'wide-mixed');
                  if (isFirstTimerMixed && bannedForMixedFirstTimer.has(id)) {
                    bannedViolations.push({ answers, resortId: id });
                  }
                }
              }
            }
          }
        }
      }
    }

    const breckenridgeWins = winCounts['breckenridge-co'] || 0;
    const distinctResortsWon = Object.keys(winCounts).length;
    const topWinners = Object.entries(winCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Second pass: broad randomized sampling (varies terrain/travel-mode too,
    // which the fixed 192-combo replication above holds constant) for a more
    // statistically stable estimate at larger N.
    const allGroupTypes = ['solo', 'matched', 'mixed', 'wide-mixed'];
    const allSkillCombos = [
      ['never-skied'], ['beginner'], ['intermediate'], ['advanced'], ['expert'],
      ['never-skied', 'expert'], ['beginner', 'advanced'], ['never-skied', 'intermediate'],
    ];
    const allTerrains = ['groomers', 'mix', 'steep', 'noPreference'];
    const allBudgets = ['$', '$$', '$$$', '$$$$'];
    const allTravelModes = ['driving', 'flying', 'unsure'];
    const allRegionIds = REGIONS.map((r) => r.id);
    const allVibes = ['lively', 'chill', 'family', 'noPreference'];
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    const N = 2000;
    let randomTotal = 0, randomHotTakeWins = 0, randomBreckenridgeWins = 0;
    const randomWinCounts = {};
    for (let i = 0; i < N; i++) {
      const groupType = pick(allGroupTypes);
      const travelMode = pick(allTravelModes);
      const answers = {
        groupType,
        skillLevels: pick(allSkillCombos),
        terrain: pick(allTerrains),
        budget: pick(allBudgets),
        travelMode,
        region: travelMode === 'unsure' ? null : pick(allRegionIds),
        vibe: pick(allVibes),
      };
      const result = matchTrip(answers, RESORTS);
      if (!result) continue;
      randomTotal++;
      randomWinCounts[result.resort.id] = (randomWinCounts[result.resort.id] || 0) + 1;
      if (withTakeIds.has(result.resort.id)) randomHotTakeWins++;
      if (result.resort.id === 'breckenridge-co') randomBreckenridgeWins++;
    }
    const randomTopWinners = Object.entries(randomWinCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([id, n]) => [id, n, +((n / randomTotal) * 100).toFixed(2)]);

    return {
      total,
      poolSize,
      hotTakeResortCount: withTakeIds.size,
      poolHotTakeSharePct: +(poolHotTakeShare * 100).toFixed(1),
      hotTakeWins,
      hotTakeWinRatePct: +((hotTakeWins / total) * 100).toFixed(1),
      breckenridgeWins,
      breckenridgeWinRatePct: +((breckenridgeWins / total) * 100).toFixed(1),
      distinctResortsWon,
      topWinners,
      randomSampleN: randomTotal,
      randomSampleHotTakeWins: randomHotTakeWins,
      randomSampleHotTakeWinRatePct: +((randomHotTakeWins / randomTotal) * 100).toFixed(1),
      randomSampleBreckenridgeWins: randomBreckenridgeWins,
      randomSampleBreckenridgeWinRatePct: +((randomBreckenridgeWins / randomTotal) * 100).toFixed(2),
      randomSampleTopWinners: randomTopWinners,
      bannedViolationsCount: bannedViolations.length,
      bannedViolationsSample: bannedViolations.slice(0, 5),
    };
  });

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.bannedViolationsCount > 0 ? 1 : 0);
}
run();
