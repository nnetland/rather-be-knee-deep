// Fix 2 verification (synthetic-user-testing.md Major finding, this round):
// Q1's heading must receive focus on first entry into the quiz from the
// splash screen, while the earlier M1 fix (no focus-stealing on option taps)
// must remain intact, INCLUDING the pointer auto-advance path.
//
// Keyboard-only entry check: Tab to the Plan entry point, activate with
// Enter, confirm focus lands on #quiz-step-heading.
//
// Pointer-tap checks: a real mouse click on a chip must (a) NOT move focus
// to the heading immediately (M1 baseline — focus stays on the tapped chip),
// and (b) after the 420ms auto-advance fires and the next step renders,
// focus DOES land on that next step's heading (matches every other route's
// focusHeading(main) call).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const url = "file://" + process.cwd() + "/build/rather-be-knee-deep.html";

  // 1. Keyboard-only entry into the quiz from splash
  {
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForSelector("#mode-plan");
    let found = false;
    for (let i = 0; i < 20; i++) {
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      if (activeId === "mode-plan") { found = true; break; }
      await page.keyboard.press("Tab");
    }
    if (found) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(150);
    }
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el.tagName, id: el.id, text: (el.textContent || "").trim().slice(0, 60) };
    });
    results.push({
      test: "keyboard-only: focus on Q1 heading on first quiz entry",
      pass: found && focused.tag === "H2" && focused.id === "quiz-step-heading",
      detail: focused,
    });
    await page.close();
  }

  // 2. Real pointer tap on an option must NOT steal focus to the heading (M1 baseline)
  {
    const page = await browser.newPage();
    await page.goto(url);
    await page.click("#mode-plan");
    await page.waitForSelector(".tap-chip");
    await page.click(".tap-chip");
    await page.waitForTimeout(50); // well before the 420ms auto-advance timer
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el.tagName, cls: el.className };
    });
    results.push({
      test: "pointer tap: focus stays on the tapped chip, not stolen to heading",
      pass: focused.tag === "BUTTON" && focused.cls.includes("tap-chip"),
      detail: focused,
    });
    await page.close();
  }

  // 3. After the auto-advance transition, focus DOES land on the new step's heading
  {
    const page = await browser.newPage();
    await page.goto(url);
    await page.click("#mode-plan");
    await page.waitForSelector(".tap-chip");
    await page.click(".tap-chip");
    await page.waitForTimeout(700); // past the 420ms auto-advance + render
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el.tagName, id: el.id, text: (el.textContent || "").trim().slice(0, 60) };
    });
    results.push({
      test: "step transition (pointer auto-advance): focus lands on next step's heading",
      pass: focused.tag === "H2" && focused.id === "quiz-step-heading",
      detail: focused,
    });
    await page.close();
  }

  // 4. Explicit Continue click (keyboard-operable control) also lands focus correctly
  {
    const page = await browser.newPage();
    await page.goto(url);
    await page.click("#mode-plan");
    await page.waitForSelector(".tap-chip");
    await page.click(".tap-chip");
    await page.waitForTimeout(50);
    await page.click("#quiz-continue");
    await page.waitForTimeout(150);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el.tagName, id: el.id };
    });
    results.push({
      test: "explicit Continue click: focus lands on next step's heading",
      pass: focused.tag === "H2" && focused.id === "quiz-step-heading",
      detail: focused,
    });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  const allPass = results.every((r) => r.pass);
  console.log(allPass ? `\n${results.length}/${results.length} PASS` : "\nSOME FAILED");
  process.exit(allPass ? 0 : 1);
})();
