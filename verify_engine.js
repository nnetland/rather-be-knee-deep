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
    const skillCombos = [
      ['never-skied'], ['beginner'], ['intermediate'], ['advanced'], ['expert'],
      ['never-skied', 'expert'], ['never-skied', 'intermediate'], ['beginner', 'advanced'],
      ['never-skied', 'beginner', 'intermediate', 'advanced', 'expert'],
    ];
    const terrains = ['groomers', 'mix', 'steep', 'noPreference'];
    const budgets = ['$', '$$', '$$$', '$$$$', undefined];
    const travelModes = ['driving', 'flying', 'unsure'];
    const regionIds = REGIONS.map((r) => r.id).concat([null]);
    const vibes = ['lively', 'chill', 'family', 'noPreference'];

    let total = 0, empty = 0, crashed = 0, noMatchCount = 0;
    const bannedForMixedFirstTimer = new Set(['jackson-hole-wy', 'alta-ut', 'kicking-horse-bc', 'revelstoke-bc']);
    let bannedViolations = [];
    const resultResortIds = new Set();
    let nullTerrainPctHits = 0;

    for (const groupType of groupTypes) {
      for (const skillLevels of skillCombos) {
        for (const terrain of terrains) {
          for (const budget of budgets.slice(0, 3)) { // keep combinatorics sane
            for (const travelMode of travelModes) {
              for (const region of travelMode === 'unsure' ? [null] : [regionIds[Math.floor(Math.random() * regionIds.length)]]) {
                for (const vibe of vibes) {
                  total++;
                  const answers = { groupType, skillLevels, terrain, budget, travelMode, region, vibe };
                  let result;
                  try {
                    result = matchTrip(answers, RESORTS);
                  } catch (e) {
                    crashed++;
                    continue;
                  }
                  if (!result) { noMatchCount++; continue; }
                  if (!result.resort) { empty++; continue; }
                  resultResortIds.add(result.resort.id);
                  if (result.resort.terrain_pct === null) nullTerrainPctHits++;

                  const isFirstTimerMixed = skillLevels.includes('never-skied') &&
                    (skillLevels.includes('expert') || skillLevels.includes('advanced')) &&
                    (groupType === 'mixed' || groupType === 'wide-mixed');
                  if (isFirstTimerMixed && bannedForMixedFirstTimer.has(result.resort.id)) {
                    bannedViolations.push({ answers, resortId: result.resort.id });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Explicit banned-resort check: run the exact wide-mixed first-timer+expert
    // combo across every travel/budget/vibe permutation.
    const strictViolations = [];
    for (const budget of ['$', '$$', '$$$', '$$$$']) {
      for (const travelMode of ['driving', 'flying', 'unsure']) {
        for (const vibe of ['lively', 'chill', 'family', 'noPreference']) {
          const answers = { groupType: 'wide-mixed', skillLevels: ['never-skied', 'expert'], terrain: 'mix', budget, travelMode, region: travelMode === 'unsure' ? null : 'denver', vibe };
          const result = matchTrip(answers, RESORTS);
          if (result && bannedForMixedFirstTimer.has(result.resort.id)) {
            strictViolations.push({ answers, resortId: result.resort.id });
          }
        }
      }
    }

    // Chase the Snow: exercise with synthetic forecasts including nulls/edge temps
    let chaseCrashed = 0;
    const syntheticForecasts = {};
    RESORTS.filter((r) => r.country === 'USA').forEach((r, i) => {
      syntheticForecasts[r.id] = { totalInches: (i * 3.7) % 40, avgTempF: i % 5 === 0 ? null : 10 + (i % 30), isLive: i % 2 === 0 };
    });
    let chaseRankedLen = -1;
    try {
      const ranked = rankChaseTheSnow(syntheticForecasts, { region: 'denver', includeBeginnerFriendly: false }, RESORTS);
      chaseRankedLen = ranked.length;
    } catch (e) { chaseCrashed++; }
    let chaseRankedLen2 = -1;
    try {
      const ranked2 = rankChaseTheSnow(syntheticForecasts, {}, RESORTS);
      chaseRankedLen2 = ranked2.length;
    } catch (e) { chaseCrashed++; }

    // Null-field robustness: run every resort through levelScore directly
    let levelScoreCrashes = 0;
    for (const r of RESORTS) {
      for (const lvl of ['never-skied', 'beginner', 'intermediate', 'advanced', 'expert']) {
        try { levelScore(r, lvl); } catch (e) { levelScoreCrashes++; }
      }
    }

    return {
      total, empty, crashed, noMatchCount,
      distinctResortsRecommended: resultResortIds.size,
      nullTerrainPctHits,
      bannedViolationsCount: bannedViolations.length,
      bannedViolationsSample: bannedViolations.slice(0, 5),
      strictViolationsCount: strictViolations.length,
      strictViolationsSample: strictViolations.slice(0, 5),
      chaseCrashed, chaseRankedLen, chaseRankedLen2,
      levelScoreCrashes,
      totalResorts: RESORTS.length,
    };
  });

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  const failed = report.crashed > 0 || report.empty > 0 || report.bannedViolationsCount > 0 || report.strictViolationsCount > 0 || report.chaseCrashed > 0 || report.levelScoreCrashes > 0;
  process.exit(failed ? 1 : 0);
}
run();
