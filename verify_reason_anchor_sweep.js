// Permanent regression guard (design review, 2026-08-03): a stale reference
// screenshot (`screenshots/final-result-light-390.png`) showed "Why this
// one" bullets reading as unanchored adjective fragments ("Glamorous
// apres-scene energy.", "Four-mountain grandeur.") instead of the
// user-answer-anchored pattern strategy.md §3.5 and copy-deck.md §4 both
// require ("You said X — {{resort fact}}"). Investigation (documented in
// the handoff) traced that screenshot to a hand-built share payload used to
// showcase the new badge system, not to a live bug in `buildReasonBullets()`
// (engine.js) — a 13,248-combination direct sweep of the matching engine and
// a live-browser sweep across representative personas both showed 0
// violations in the shipped code. But the *principle* this app is built on
// — "because you said X beats 87% match" (strategy.md Principle 3) — is
// exactly the kind of thing a future edit could break silently (a fallback
// path, a tag-derived phrase reintroduced under refactor, a share-payload
// shortcut in a debug script leaking into a real screenshot again). This
// script makes that failure loud instead of silent: it walks a spread of
// real quiz answers through the actual rendered DOM (not a unit test against
// engine.js in isolation) and asserts every "Why this one" bullet contains a
// recognizable trace back to a real answer the user gave.
//
// Chase-the-Snow's row-detail reason bullets are deliberately NOT covered by
// the anchor check below — that mode is near-zero-input by design
// (strategy.md §4.1: no quiz, optional origin/toggle only), so its bullets
// are resort facts, not answer-echoes, and requiring a "you said" anchor
// there would be requiring the app to invent an answer that was never asked.
const { chromium } = require("playwright");
const path = require("path");

const FILE_URL = "file://" + path.resolve(__dirname, "rather-be-knee-deep.html");

// Any bullet must trace to one of: skill level / group range, terrain
// preference, travel mode (or the explicit "didn't factor" honesty line),
// or budget — the four axes buildReasonBullets() actually draws from. The
// cold-view ("Their pick") variants swap pronouns via toColdViewBullet(), so
// "they"/"their" forms count too.
const ANCHOR_RE = /\b(you said|you're driving|you're flying|we didn't factor|they said|they're driving|they're flying|they weren't sure)\b/i;

// A spread of input combinations named explicitly in the regression report:
// mixed-ability group, solo expert, family with kids, budget-constrained,
// drive vs fly, plus a "not sure" travel case.
const CASES = [
  {
    label: "wide-mixed, driving, mid-budget (mixed-ability group)",
    steps: [
      ["q1", "wide-mixed"],
      ["q2a", "never-skied"], ["q2a", "expert"],
      ["q2b", "mix"],
      ["q3", "$$"],
      ["q4a", "driving"], ["q4b", "denver"],
      ["q5", "noPreference"],
    ],
  },
  {
    label: "solo expert, flying, no budget limit (solo expert)",
    steps: [
      ["q1", "solo"],
      ["q2a", "expert"],
      ["q2b", "steep"],
      ["q3", "$$$$"],
      ["q4a", "flying"], ["q4b", "bayarea"],
      ["q5", "chill"],
    ],
  },
  {
    label: "mixed beginner+intermediate, family vibe (family with kids)",
    steps: [
      ["q1", "mixed"],
      ["q2a", "beginner"], ["q2a", "intermediate"],
      ["q2b", "groomers"],
      ["q3", "$"],
      ["q4a", "driving"], ["q4b", "chicago"],
      ["q5", "family"],
    ],
  },
  {
    label: "matched intermediate, budget-conscious, driving (budget-constrained)",
    steps: [
      ["q1", "matched"],
      ["q2a", "intermediate"],
      ["q2b", "mix"],
      ["q3", "$"],
      ["q4a", "driving"], ["q4b", "northeast"],
      ["q5", "lively"],
    ],
  },
  {
    label: "matched advanced, travel unsure (no origin factored in)",
    steps: [
      ["q1", "matched"],
      ["q2a", "advanced"],
      ["q2b", "steep"],
      ["q3", "$$$"],
      ["q4a", "unsure"],
      ["q5", "noPreference"],
    ],
  },
  {
    label: "wide-mixed, splurge, flying (drive vs fly — flying leg)",
    steps: [
      ["q1", "wide-mixed"],
      ["q2a", "beginner"], ["q2a", "advanced"],
      ["q2b", "mix"],
      ["q3", "$$$"],
      ["q4a", "flying"], ["q4b", "socal"],
      ["q5", "lively"],
    ],
  },
];

async function runCase(page, kase) {
  await page.goto(FILE_URL);
  await page.waitForTimeout(250);
  await page.click("#mode-plan");
  await page.waitForTimeout(200);

  // Group consecutive taps on the same q-group (multi-select) before Continue.
  let i = 0;
  while (i < kase.steps.length) {
    const [group, value] = kase.steps[i];
    await page.click(`[data-group="${group}"][data-value="${value}"]`);
    await page.waitForTimeout(140);
    const next = kase.steps[i + 1];
    if (next && next[0] === group) { i += 1; continue; }
    await page.click("#quiz-continue").catch(() => {});
    await page.waitForTimeout(450);
    i += 1;
  }
  await page.waitForTimeout(600);

  const bullets = await page.$$eval(".reason-bullet__text", (els) => els.map((e) => e.textContent.trim()));
  const resort = await page.$eval(".resort-name", (e) => e.textContent).catch(() => null);
  return { resort, bullets };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**://fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**://fonts.gstatic.com/**", (r) => r.abort());
  await page.route("**://api.weather.gov/**", (r) => r.abort());

  const results = [];
  for (const kase of CASES) {
    const { resort, bullets } = await runCase(page, kase);
    if (!resort || bullets.length === 0) {
      results.push({ case: kase.label, resort, pass: false, reason: "no result / no bullets rendered", bullets });
      continue;
    }
    const violations = bullets.filter((b) => !ANCHOR_RE.test(b));
    results.push({ case: kase.label, resort, pass: violations.length === 0, bullets, violations });
  }

  // Cold-shared-link case: build a payload the way submitQuiz() does, load
  // it fresh (fresh:false, simulating a stranger opening a shared link), and
  // confirm the pronoun-transformed bullets still carry a recognizable
  // anchor (the "they said" / "they're driving" forms).
  await page.goto(FILE_URL);
  await page.waitForTimeout(200);
  const coldCheck = await page.evaluate(() => {
    const answers = { groupType: "mixed", skillLevels: ["beginner", "advanced"], terrain: "mix", budget: "$$", travelMode: "driving", region: "denver", vibe: "family" };
    const result = matchTrip(answers, RESORTS);
    const payload = buildSharePayload(result, answers);
    return payload;
  });
  await page.evaluate((payload) => {
    navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: false });
  }, coldCheck);
  await page.waitForTimeout(400);
  const coldBullets = await page.$$eval(".reason-bullet__text", (els) => els.map((e) => e.textContent.trim()));
  const coldViolations = coldBullets.filter((b) => !ANCHOR_RE.test(b));
  results.push({ case: "cold-shared-link (pronoun-transformed)", pass: coldViolations.length === 0, bullets: coldBullets, violations: coldViolations });

  await browser.close();

  console.log(JSON.stringify(results, null, 2));
  const allPass = results.every((r) => r.pass);
  console.log(allPass
    ? `\n${results.length}/${results.length} PASS — every reason bullet across the sweep carries a user-answer anchor`
    : "\nSOME FAILED — a reason bullet was generated with no traceable user-answer anchor (the exact regression class this script guards against)");
  process.exit(allPass ? 0 : 1);
})();
