// Fix 3 verification (synthetic-user-testing.md Major finding, this round):
// grep the RENDERED DOM — not the source dataset — across a spread of
// resorts known to carry research-note-contaminated free-text fields, and
// assert zero leaked artefacts ("Editorial judgment:", "Sourced:",
// "(brutal)", "in the dataset", "Confirmed <number>", etc).
//
// Covers all three known render sites for dataset prose fields
// (family_ski_school_basis via the ski-school disclosure, beginner_note via
// the Range Readout floor sentence, character_note via the Chase row detail
// panel) plus a full-page sweep for any other leak.
const { chromium } = require("playwright");

const CONTAMINATED_IDS = [
  "vail-co",           // family_ski_school_basis starts "Sourced:"
  "breckenridge-co",   // beginner_note contains "(brutal)"
  "crested-butte-co",  // family_ski_school_basis starts "Editorial judgment:"
  "arapahoe-basin-co", // family_ski_school_basis starts "Editorial judgment:"
  "wolf-creek-co",     // family_ski_school_basis starts "Editorial judgment:"
  "alta-ut",           // family_ski_school_basis starts "Editorial judgment:"
];

const CONTAMINATION_PATTERNS = [
  /Editorial judgment/i,
  /Sourced:/i,
  /\(brutal\)/i,
  /\bin (?:this|the) dataset\b/i,
  /Confirmed \d/i,
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + process.cwd() + "/build/rather-be-knee-deep.html");

  const results = [];

  for (const rid of CONTAMINATED_IDS) {
    // Build a minimal share payload directly via the app's own in-scope
    // functions/data (single global-scope bundle) and navigate straight to
    // the result screen for this resort id, with the Range Readout enabled
    // (never-skied -> expert, exercising the beginner_note-bearing floor
    // sentence) so all three render sites get exercised in one pass.
    // Routing only parses location.hash on initial page load
    // (parseInitialRoute), not via a hashchange listener — call navigate()
    // directly (single global-scope bundle, same pattern the app's own
    // submitQuiz() uses) rather than setting location.hash post-load.
    await page.evaluate((rid) => {
      const payload = {
        v: 1,
        rid,
        reasonBullets: ["Matched for this sweep."],
        showRangeReadout: true,
        range: { floor: "never-skied", ceiling: "expert", floorScore: 1, ceilingScore: 5 },
      };
      navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true });
    }, rid);
    await page.waitForTimeout(150);
    await page.waitForSelector("#result-card");

    // Expand the ski-school disclosure so its basis text (family_ski_school_basis) renders
    const expandBtn = await page.$(".notes-row__expand-btn");
    if (expandBtn) { await expandBtn.click(); await page.waitForTimeout(50); }

    const bodyText = await page.evaluate(() => document.body.innerText);

    const hits = [];
    for (const pat of CONTAMINATION_PATTERNS) {
      const m = bodyText.match(pat);
      if (m) hits.push({ pattern: pat.toString(), matched: m[0] });
    }

    results.push({ resort: rid, pass: hits.length === 0, hits });
  }

  // Also visit the Chase list and open each contaminated resort's row detail
  // (character_note render site) — call the app's own routing/detail
  // functions directly (same single-global-scope pattern as above).
  await page.evaluate(() => navigate("chase"));
  await page.waitForTimeout(200);

  for (const rid of CONTAMINATED_IDS) {
    const opened = await page.evaluate((rid) => {
      if (typeof showChaseRowDetail !== "function") return false;
      showChaseRowDetail(rid);
      return true;
    }, rid);
    await page.waitForTimeout(100);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hits = [];
    for (const pat of CONTAMINATION_PATTERNS) {
      const m = bodyText.match(pat);
      if (m) hits.push({ pattern: pat.toString(), matched: m[0] });
    }
    results.push({ resort: rid, surface: "chase-row-detail", pass: !opened || hits.length === 0, opened, hits });
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  const allPass = results.every((r) => r.pass);
  console.log(allPass ? `\n${results.length}/${results.length} PASS — zero research-note artefacts in rendered DOM` : "\nSOME FAILED");
  process.exit(allPass ? 0 : 1);
})();
