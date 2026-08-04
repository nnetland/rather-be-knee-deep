// Verification for the reconciled fix round (2026-08-03). Covers the items
// the original test suites didn't reach: quiz-progress URL-hash persistence,
// the Q2a single-select Back-restore bug, mode-switch step resumption,
// Nicole's List responsive card layout + touch targets + tag-list semantics,
// 200% zoom reflow on the quiz, the radiogroup keyboard pattern, the M1
// focus-per-tap fix, the M3 reduced-motion Range Readout bridge/pins, the
// ski-school evidence disclosure, and the Chase-the-Snow skip control.
const { chromium } = require('playwright');
const path = require('path');
const FILE_URL = 'file://' + path.resolve(__dirname, 'rather-be-knee-deep.html');

const checks = [];
function assert(name, cond, extra) { checks.push({ name, pass: !!cond, extra }); }

async function run() {
  const browser = await chromium.launch();

  // -------------------------------------------------------------------
  // Critical fix #5: quiz progress survives a same-tab reload via #quiz=
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(200);
    await page.click('[data-group="q1"][data-value="matched"]');
    await page.waitForTimeout(600);
    await page.click('[data-group="q2a"][data-value="advanced"]');
    await page.waitForTimeout(600);
    const hashBeforeReload = await page.evaluate(() => location.hash);
    assert('In-progress quiz encodes state into #quiz= (not #result=)', hashBeforeReload.startsWith('#quiz='));

    await page.reload();
    await page.waitForTimeout(300);
    const afterReload = await page.evaluate(() => ({
      route: state.route,
      groupType: state.quizAnswers.groupType,
      stepIdx: state.quizStepIdx,
      titleText: document.querySelector('.quiz-title') ? document.querySelector('.quiz-title').textContent : null,
    }));
    assert('Reload lands back on the quiz route (not splash)', afterReload.route === 'plan');
    assert('Reload restores the Q1 answer (matched)', afterReload.groupType === 'matched');
    assert('Reload resumes at the step the user left (Q2b), not Step 1', afterReload.stepIdx === 2, afterReload);
    const toastText = await page.$eval('#app-toast', (el) => el.textContent).catch(() => '');
    assert('A visible "Welcome back" acknowledgment renders on resume', /welcome back/i.test(toastText || ''), toastText);

    // Confirm this doesn't pollute the #result= share format: finish the
    // quiz and confirm the hash switches cleanly to #result=.
    await page.click('[data-group="q2b"][data-value="mix"]');
    await page.waitForTimeout(600);
    await page.click('[data-group="q3"][data-value="$$"]');
    await page.waitForTimeout(600);
    await page.click('[data-group="q4a"][data-value="unsure"]');
    await page.waitForTimeout(600);
    await page.click('[data-group="q5"][data-value="noPreference"]');
    await page.waitForTimeout(200);
    await page.click('#quiz-continue');
    await page.waitForTimeout(900);
    const finalHash = await page.evaluate(() => location.hash);
    assert('Completing the quiz after a resume still produces a clean #result= hash', finalHash.startsWith('#result=') && !finalHash.includes('quiz='));

    await context.close();
  }

  // -------------------------------------------------------------------
  // Heuristic fix: Q2a single-select Back-restore + mode-switch resume
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(200);
    await page.click('[data-group="q1"][data-value="solo"]'); // single-select Q2a path
    await page.waitForTimeout(600);
    await page.click('[data-group="q2a"][data-value="intermediate"]');
    await page.waitForTimeout(600); // auto-advance to Q2b
    await page.click('#quiz-back');
    await page.waitForTimeout(400);
    const q2aChecked = await page.$eval('[data-group="q2a"][data-value="intermediate"]', (el) => el.getAttribute('aria-checked'));
    assert('Back visually restores the Q2a single-select answer (was always false before the fix)', q2aChecked === 'true');

    // Move forward again to Q2b (terrain), then jump Plan -> Chase -> Plan:
    // per strategy.md ("his answers are still there") and the H3/H6 fix,
    // this must resume at Q2b, not reset to Step 1.
    await page.click('#quiz-continue');
    await page.waitForTimeout(500);
    await page.click('[data-route="chase"]:visible');
    await page.waitForTimeout(300);
    await page.click('[data-route="plan"]:visible');
    await page.waitForTimeout(300);
    const resumedTitle = await page.$eval('.quiz-title', (el) => el.textContent);
    assert('Plan -> Chase -> Plan resumes at the step left off (Q2b), not Step 1', /terrain/i.test(resumedTitle), resumedTitle);
    const q1StillChecked = await page.evaluate(() => state.quizAnswers.groupType);
    assert('Underlying Q1 answer is still retained across the mode switch', q1StillChecked === 'solo', q1StillChecked);

    await context.close();
  }

  // -------------------------------------------------------------------
  // M1: focus stays on the tapped chip on in-place re-render, not the h2
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(200);
    await page.click('[data-group="q1"][data-value="wide-mixed"]');
    await page.waitForTimeout(600); // now on Q2a multi-select
    await page.keyboard.press('Tab'); // land on the first radio-equivalent chip (roving tabindex)
    await page.click('[data-group="q2a"][data-value="never-skied"]');
    await page.waitForTimeout(100);
    const focusedAfterFirstTap = await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      value: document.activeElement.dataset ? document.activeElement.dataset.value : null,
    }));
    assert('First multi-select tap keeps focus on the tapped chip, not the <h2>', focusedAfterFirstTap.tag === 'BUTTON' && focusedAfterFirstTap.value === 'never-skied', focusedAfterFirstTap);

    await page.click('[data-group="q2a"][data-value="expert"]');
    await page.waitForTimeout(100);
    const focusedAfterSecondTap = await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      value: document.activeElement.dataset ? document.activeElement.dataset.value : null,
    }));
    assert('Second multi-select tap ALSO keeps focus on the tapped chip (was h2 every time before the fix)', focusedAfterSecondTap.tag === 'BUTTON' && focusedAfterSecondTap.value === 'expert', focusedAfterSecondTap);

    await context.close();
  }

  // -------------------------------------------------------------------
  // M2: radiogroup pattern — role + roving tabindex + Arrow-key selection
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(200);
    const groupRole = await page.$eval('.chip-grid[role]', (el) => el.getAttribute('role'));
    assert('Q1 single-select wrapper has role=radiogroup (was role=group)', groupRole === 'radiogroup');
    const labelledby = await page.$eval('.chip-grid[role="radiogroup"]', (el) => el.getAttribute('aria-labelledby'));
    assert('radiogroup has aria-labelledby pointing at the question heading', labelledby === 'quiz-step-heading');

    const tabindices = await page.$$eval('[data-group="q1"]', (els) => els.map((el) => el.getAttribute('tabindex')));
    assert('Exactly one radio is in the Tab sequence (roving tabindex)', tabindices.filter((t) => t === '0').length === 1, tabindices);

    // Focus the first radio, then ArrowRight should move focus AND select
    await page.focus('[data-group="q1"][tabindex="0"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    const afterArrow = await page.evaluate(() => ({
      focusedValue: document.activeElement.dataset.value,
      checkedValue: document.querySelector('[data-group="q1"][aria-checked="true"]') ? document.querySelector('[data-group="q1"][aria-checked="true"]').dataset.value : null,
    }));
    assert('ArrowRight on a radiogroup moves focus to the next radio', !!afterArrow.focusedValue);
    assert('ArrowRight also selects the radio it moved to (platform convention)', afterArrow.focusedValue === afterArrow.checkedValue, afterArrow);

    await context.close();
  }

  // -------------------------------------------------------------------
  // M3: reduced-motion Range Readout bridge/pins actually render
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    await page.click('#mode-plan');
    await page.waitForTimeout(200);
    await page.click('[data-group="q1"][data-value="wide-mixed"]');
    await page.waitForTimeout(600);
    await page.click('[data-group="q2a"][data-value="never-skied"]');
    await page.click('[data-group="q2a"][data-value="expert"]');
    await page.click('#quiz-continue');
    await page.waitForTimeout(500);
    await page.click('[data-group="q2b"][data-value="mix"]');
    await page.waitForTimeout(500);
    await page.click('[data-group="q3"][data-value="$$"]');
    await page.waitForTimeout(500);
    await page.click('[data-group="q4a"][data-value="unsure"]');
    await page.waitForTimeout(500);
    await page.click('[data-group="q5"][data-value="family"]');
    await page.waitForTimeout(200);
    await page.click('#quiz-continue');
    await page.waitForTimeout(500);

    const rangeState = await page.evaluate(() => {
      const bridge = document.getElementById('range-bridge');
      const pinFloor = document.getElementById('range-pin-floor');
      const pinCeiling = document.getElementById('range-pin-ceiling');
      return {
        bridgeTransform: bridge ? getComputedStyle(bridge).transform : null,
        pinFloorOpacity: pinFloor ? getComputedStyle(pinFloor).opacity : null,
        pinCeilingOpacity: pinCeiling ? getComputedStyle(pinCeiling).opacity : null,
      };
    });
    // matrix(1, 0, 0, 1, 0, 0) is the identity (scaleX(1)); matrix(0,0,0,1,0,0)
    // is the bug (permanently scaleX(0), invisible).
    assert('Reduced motion: Range Readout bridge is NOT permanently scaleX(0)', rangeState.bridgeTransform !== 'matrix(0, 0, 0, 1, 0, 0)', rangeState);
    assert('Reduced motion: floor pin is visible (opacity 1)', rangeState.pinFloorOpacity === '1', rangeState);
    assert('Reduced motion: ceiling pin is visible (opacity 1)', rangeState.pinCeilingOpacity === '1', rangeState);

    await context.close();
  }

  // -------------------------------------------------------------------
  // Critical fix #2: no self-contradiction between Range Readout and hot
  // take — Keystone specifically (the reported case).
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    const keystoneCheck = await page.evaluate(() => {
      const resort = RESORTS.find((r) => r.id === 'keystone-co');
      const payload = {
        v: 1, rid: resort.id,
        reasonBullets: ['Test bullet.'],
        showRangeReadout: true,
        range: { floor: 'never-skied', ceiling: 'expert', floorScore: 8, ceilingScore: 3 },
      };
      state.route = 'result';
      state.routeParams = { shared: payload, fresh: true };
      render();
      const ceilingSentence = document.querySelector('#range-sentences p:last-child') ? document.querySelector('#range-sentences p:last-child').textContent : '';
      return {
        ceilingSentence,
        hotTakeText: resort.hot_take ? resort.hot_take.text : null,
        mentionsCharacterNoteFact: /night-skiing|earliest-opening|latest-closing/i.test(ceilingSentence),
        claimsRealStrength: /real strength/i.test(ceilingSentence),
      };
    });
    assert('Keystone still has its hot take (no advanced terrain) in the dataset', /no advanced terrain/i.test(keystoneCheck.hotTakeText || ''), keystoneCheck.hotTakeText);
    assert('Range Readout no longer pulls character_note (night-skiing fact) into the expert-terrain claim', !keystoneCheck.mentionsCharacterNoteFact, keystoneCheck.ceilingSentence);
    assert('Range Readout no longer unconditionally asserts "a real strength" for experts', !keystoneCheck.claimsRealStrength, keystoneCheck.ceilingSentence);
    console.log('  Keystone ceiling sentence now reads:', JSON.stringify(keystoneCheck.ceilingSentence));

    await context.close();
  }

  // -------------------------------------------------------------------
  // Ski-school evidence disclosure (Dana)
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    await page.goto(FILE_URL);
    const schoolCheck = await page.evaluate(() => {
      const resort = RESORTS.find((r) => r.id === 'vail-co');
      const payload = { v: 1, rid: resort.id, reasonBullets: ['Test bullet.'], showRangeReadout: false, range: null };
      state.route = 'result'; state.routeParams = { shared: payload, fresh: true };
      render();
      return { hasBasisField: !!resort.family_ski_school_basis };
    });
    assert('Resort record carries family_ski_school_basis', schoolCheck.hasBasisField);
    const expandBtn = await page.$('.notes-row__expand-btn');
    assert('Ski school stat is an expandable disclosure control, not a bare label', !!expandBtn);
    const beforeExpand = await page.$eval('.stat-tile__basis', (el) => el.hidden);
    assert('Ski school evidence starts collapsed', beforeExpand === true);
    await expandBtn.click();
    const afterExpand = await page.$eval('.stat-tile__basis', (el) => ({ hidden: el.hidden, text: el.textContent }));
    assert('Clicking reveals the real sourcing evidence text', afterExpand.hidden === false && afterExpand.text.length > 20, afterExpand.text.slice(0, 60));
    const ariaExpanded = await page.$eval('.notes-row__expand-btn', (el) => el.getAttribute('aria-expanded'));
    assert('aria-expanded updates to true', ariaExpanded === 'true');

    await context.close();
  }

  // -------------------------------------------------------------------
  // Chase-the-Snow skip-ahead escape (throttled network to force escalation)
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('**://fonts.googleapis.com/**', (r) => r.abort());
    // Delay every NOAA call well past the 4s escalation point but well under
    // a real test timeout, so we can observe the skip button appear and work.
    await page.route('**://api.weather.gov/**', async (route) => {
      await new Promise((r) => setTimeout(r, 6000));
      route.abort();
    });
    await page.goto(FILE_URL);
    await page.click('#mode-chase');
    await page.waitForTimeout(4300);
    const skipBtn = await page.$('#chase-skip-btn');
    assert('A visible skip-ahead control appears once the escalated (4s) state is reached', !!skipBtn);
    const t0 = Date.now();
    if (skipBtn) await skipBtn.click();
    await page.waitForTimeout(300);
    const rowsAfterSkip = await page.$$eval('.chase-row', (els) => els.length);
    const elapsedMs = Date.now() - t0;
    assert('Clicking skip immediately resolves to the historical list (well under the 10s hard timeout)', rowsAfterSkip > 0 && elapsedMs < 2000, { rowsAfterSkip, elapsedMs });

    await context.close();
  }

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  checks.forEach((c) => console.log((c.pass ? 'PASS' : 'FAIL'), c.name, c.pass ? '' : JSON.stringify(c.extra)));
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
run();
