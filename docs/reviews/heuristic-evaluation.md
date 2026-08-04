# Heuristic Evaluation: Rather Be Knee Deep

**Date:** 2026-08-03
**Evaluated against:** Nielsen's 10 Usability Heuristics + Cognitive Walkthrough
**Build reviewed:** `/home/claude/ski-reco/build/rather-be-knee-deep.html`, exercised live with
Playwright/Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) at 390×844 (mobile) — the full
Plan-a-Trip quiz (multiple paths), Chase the Snow, Nicole's List, the shared-result cold-load path,
back/mode-switch navigation, and the "Start over" control. Reference screenshots in
`build/screenshots/` plus new ones captured for this review in `reviews/screens/`.

## Summary

The build is honest, well-structured, and gets several hard things right: the reason bullets
genuinely echo the user's own answers, the live/historical forecast distinction is visually
explicit and matter-of-fact, the mixed-ability min/max logic reads as a real bottleneck rather than
a blended score, and the result card is verifiably chrome-free for screenshotting. But three things
undercut it in ways that matter for this app's actual distribution model: quiz progress does not
survive an interruption (a plain page reload wipes it silently, with zero warning — directly
breaking the "stolen fifteen-minute windows" promise made to Priya), the shared-result screen still
speaks in first/second-person "you said…" language to a cold stranger who never answered anything
(the app's own strategy names this as the *primary* real-world path, not an edge case), and
Chase-the-Snow's flagship "answer in three seconds" mode has a documented 10-second hard wait built
into it with no way to skip ahead to the guaranteed-available historical data. None of these are
unfixable — they're localized, specific bugs and gaps, not a broken architecture — but they land on
exactly the personas the app was built to prove itself against.

## Heuristic Findings

| # | Heuristic | Verdict | Key Finding |
|---|-----------|---------|-------------|
| H1 | Visibility of System Status | ⚠ | Live/historical forecast distinction is excellent; but quiz-progress loss is silent (no "we lost your place" message), and Chase's loading state can legitimately run 10s with no indication of *when* it'll resolve |
| H2 | Match Between System and Real World | ⚠ | Reason bullets and quiz copy are well-controlled plain language; but the result screen's "you said…" framing breaks down for the cold-share case, and data-bound editorial text (`beginner_note`) reintroduces jargon ("Corbet's Couloir," "mogul terrain") the quiz copy deliberately avoided |
| H3 | User Control and Freedom | ✗ | No progress-preservation across a reload/interruption (Priya's explicit stress case); Back navigation doesn't visually restore the Q2a single-select answer; "Start over" destroys all 5 answers with one unconfirmed tap |
| H4 | Consistency and Standards | ✓ | Component reuse (result-card, stat tiles, difficulty encoding) is consistent across Plan/Chase/Nicole's List; copy-deck vocabulary ("your crew," "your pick," "resort") is applied consistently in the rendered build |
| H5 | Error Prevention | ⚠ | Continue is correctly disabled until a valid selection exists; but "Start over" has no confirmation step despite being fully destructive |
| H6 | Recognition Rather Than Recall | ⚠ | Reason bullets and the "not sure yet" honesty line work exactly as designed; but Back-navigation hides the user's own prior answer, and ski-school claims give Dana a label with nothing behind it to recognize as evidence |
| H7 | Flexibility and Efficiency of Use | ⚠ | Auto-advance-with-cancel-window is a genuinely good compromise for precision-impaired users; but Chase mode has no way to skip the live-fetch wait for a user who wants historical data immediately |
| H8 | Aesthetic and Minimalist Design | ✓ | Result card is disciplined — nothing decorative competing with the reason/stats/hot-take hierarchy; reveal choreography is well-built (with a smart any-interaction "skip" escape hatch), though the full card isn't done animating in until ~700–750ms |
| H9 | Help Users Recognize/Diagnose/Recover from Errors | ✓/⚠ | Forecast-fallback and Canada-coverage copy is a genuine model of honest, non-apologetic error messaging; but silent state loss (reload) has no error message at all — it just looks like nothing happened |
| H10 | Help and Documentation | ⚠ | Mostly N/A by design (self-explanatory, no docs needed) — but Dana's "check details before booking" ski-school caveat points nowhere; there is no in-app way to see the sourcing evidence that exists in the data but never reached the UI |

## Cognitive Walkthrough Results

### Task 1 — Priya plans a first trip (solo/matched, non-native English, distracted, phone, stolen 15-min windows)

Walked as: Splash → Plan a trip → Q1 "Just me" → Q2a "Intermediate" → interrupted (reload,
simulating switching apps / losing the tab / connection blip).

```
Step 1: Land on splash, tap "Plan a trip"
  ✓ Will try the right effect? Yes — "Answer 5 quick questions. Get one solid pick." is concrete and low-commitment.
  ✓ Correct action visible? Yes — equal-weight card, clear label.
  ✓ Action matches expectation? Yes.
  ✓ Feedback on progress? Yes — "Step 1 of 5" + segmented progress bar appears immediately.

Step 2: Answer Q1/Q2a, then get pulled away (real scenario for this persona) and return
  ✗ Will try the right effect? She expects to resume where she left off — this is her explicit stated need.
  ✗ Correct action visible? N/A — there's no recovery UI at all.
  ✗ Action matches expectation? No — the app silently returns to the splash screen with zero trace of her answers and zero explanation.
  ✗ Feedback on progress? No — nothing tells her progress was lost; she has to notice on her own that she's back at "Step 1 of 5" with no memory of clicking anything.
  → Finding: CRITICAL. See Findings by Severity.

Step 3 (if she doesn't notice and redoes the quiz): completes it fine, reads the result
  ✓ Will try the right effect? Yes.
  ✓ Correct action visible? Yes.
  ✓ Action matches expectation? Mostly — reason bullets are in plain, grade-6-8 language and echo her own answers well.
  ⚠ Feedback on progress? The "For newer skiers"/"For more experienced skiers" mixed-ability text (when it applies) can surface data-bound jargon ("Corbet's Couloir," "mogul terrain") that wasn't put through the same plain-language pass as the fixed quiz copy — exactly the vocabulary her persona is defined as not having.
  → Finding: Major. See Findings by Severity.
```

### Task 2 — Marcus finds somewhere for a group spanning first-timer to expert (wide-mixed, wrist tendinitis, relaying to a group chat in real time)

Walked as: Splash → Plan a trip → wide-mixed → multi-select (never skied + expert) → mix of
everything → mid-range → driving → Denver → family-friendly → result; then Back-navigation and
mode-switch tests to check "correct one answer without restarting."

```
Step 1: Q1 "wide mix" tap
  ✓✓✓✓ All pass — single generous tap, no slider, auto-advances with a visible cancel window.

Step 2: Q2a multi-select (never skied + expert)
  ✓✓✓✓ All pass — checkboxes are large, explicit Continue required (no accidental auto-advance
  on multi-select, correctly matching the copy-deck's accessibility requirement), and — confirmed
  by direct testing — a Back-then-forward round trip on the MULTI-select variant correctly shows
  both prior selections still checked.

Step 3: Full quiz to result
  ✓✓✓✓ Reaches a result with 0 console errors. Reason bullets cite his actual answers
  ("You said your crew ranges from never skied before to expert…", "You're driving from Denver &
  the Rockies — this is around 1 hour, no flight needed."). The Range Readout ("How this works for
  your whole group") explicitly states it did NOT average — a direct, well-targeted answer to his
  stated distrust of black-box compromise scores.

Step 4: He wants to correct ONE answer (his explicitly stated need) via Back
  ✗ Will try the right effect? Yes — tapping Back is the obvious way to fix one answer.
  ✗ Correct action visible? The Back control is visible, but on the single-select variant of Q2a
  ("What's your level?" — the solo/matched path) returning via Back shows NO answer as
  checked, even though he definitely selected one. (Confirmed: the underlying value is retained —
  clicking Continue with nothing visibly selected silently advances using the old answer — but he
  has no way to see this. The bug is isolated to Q2a's single-select rendering; Q1, Q3 (budget),
  and the Q2a MULTI-select variant all correctly restore checked state on Back.)
  ✗ Action matches expectation? No — he can't tell whether his correction landed, whether his old
  answer is still active, or whether he needs to re-tap.
  → Finding: Major. See Findings by Severity.

Step 5: He jumps to Chase mode to check something, then taps back to Plan (a scenario strategy.md
names explicitly: "his answers are still there")
  ⚠ The underlying answers ARE retained (Q1 shows correctly re-checked), but the visible flow
  resets to Step 1 of 5 rather than resuming at the step he left — so in practice he re-taps
  through screens he already answered. Given the Q2a single-select restoration bug above, this
  compounds: if his group composition puts him on the single-select path, re-walking through Q2a
  after a mode-switch will show no answer checked either.
  → Finding: folded into the Back-navigation finding above (same root cause).

Step 6: He wants to show the group why the pick works, before defending it in the group chat
  ⚠ On one generated result (Keystone), the algorithmic reason text and mixed-ability copy
  described the resort as "a real strength" for experienced skiers, while Nicole's own quoted Hot
  Take on the same card read "no advanced terrain." A card built to help Marcus defend a pick to a
  skeptical group instead hands him a self-contradicting one.
  → Finding: Major. See Findings by Severity.
```

### Task 3 — Jordan checks where to fly this weekend (powder hound, deuteranopia, cold hands, one bar of signal, wants an answer in ~3 seconds)

Walked as: Splash → Chase the snow, with network unavailable (the actual condition in this
environment, and a realistic stand-in for "cold hands, one bar of signal on a chairlift").

```
Step 1: Tap "Chase the snow"
  ✓ Will try the right effect? Yes — no vibe quiz, no preamble, matches his stated need exactly.
  ✓ Correct action visible? Yes.
  ✓ Action matches expectation? Yes.
  ⚠ Feedback on progress? A spinner + "Checking today's snow…" appears (correctly, not before
  300ms per spec) — but the app's own documented state machine holds this loading state for up to
  10 seconds (with a "Still checking — the forecast service is being slow today" reassurance line
  appearing only at 4s) before hard-falling-back to the historical data that was available the
  whole time. There is no way to manually skip ahead to that historical view.
  → Finding: Major. See Findings by Severity. This is architecturally the worst case for exactly
  the network conditions Jordan (and Nicole) are defined by.

Step 2: List renders (historical fallback, since no live network here)
  ✓ Will try the right effect? Yes — ranked list, scannable.
  ✓ Correct action visible? Yes — rank numbers (not just position/color), resort name, region,
  a text quality descriptor ("Cold, light snow"), inches, and a text "Heads up — this gets crowded"
  flag where relevant. Nothing here relies on color alone — satisfies his deuteranopia requirement
  at the list level.
  ✓ Action matches expectation? Yes — "Not a live forecast" renders as its own visible badge
  (shape + icon + text), not buried in prose, exactly as copy-deck specifies for skim-speed reading.
  ✓ Feedback on progress? Yes — freshness state is unambiguous.

Step 3: Canada resorts (his and Nicole's home turf)
  ✓ All four questions pass — Canada renders in its own clearly labeled, separately-sorted section
  ("Canada — no live forecast," ranked by typical season snowfall), never blended into the
  live-ranked US list, with honest, non-apologetic copy exactly matching the copy-deck's framing.
  This directly answers Nicole's named fear ("no forecast for Canada with no explanation reads as
  broken, not honest").
```

### Task 4 — Dana evaluates whether a resort's ski school is good enough for her kid (low vision, evidence-seeking, distrusts marketing copy)

Walked as: a result card's stat strip, and the underlying dataset's `family_ski_school_basis`
field.

```
Step 1: Scans the stat strip for ski-school info
  ✓ Will try the right effect? Yes — "Ski school" is its own labeled stat tile, not buried under
  acreage/vertical-drop numbers she doesn't care about (a direct answer to her named frustration).
  ✓ Correct action visible? Yes — the label is findable at a glance.
  ✗ Action matches expectation? Partially. The value is one of three bare strings ("Highly rated"
  / "Solid" / "Limited — check details before booking") with zero supporting evidence, tooltip, or
  link — exactly the "vague 'strong' rating with nothing behind it" her persona explicitly says she
  distrusts. The dataset actually contains a `family_ski_school_basis` field with real sourcing
  detail per resort (e.g., "Vail Resorts' EpicKids programming and Golden Peak/Bachelor Gulch
  dedicated beginner terrain are heavily marketed and consistently reviewed well…") — this exists
  in the data but was never wired into the UI anywhere.
  ✗ Feedback on progress? No — "check details before booking" (the weak-rating copy) doesn't say
  where to check. It points nowhere, inside an app whose whole value proposition is not making her
  leave to go verify elsewhere.
  → Finding: Major. See Findings by Severity.
```

### Task 5 — A cold stranger receives a shared result link in a group chat, has never heard of this app

Walked as: generated a real result in one browser context, extracted its `#result=` share hash,
and cold-loaded that exact URL in a brand-new, isolated browser context with no prior navigation —
simulating tapping a link a friend forwarded, with zero session history. Also inspected the OG/
Twitter meta tags that render as the link preview *before* the tap.

```
Step 0: Sees the link preview in the group chat, before tapping
  ✗ Will try the right effect? Preview reads "Steamboat — your ski trip match" / "Matched to your
  answers: You said your crew ranges from never skied before to expert — Steamboat has real
  beginner terrain…" — this is confusing at the very first touchpoint: they never gave any answers.
  (Minor, separate bug spotted here too: the OG description ends "...bored on the harder ones.. See
  the full pick." — a double period from concatenating a reason bullet that already ends in one.)

Step 1: Taps the link, lands cold on the result screen
  ✓ Correct action visible? Yes, once loaded: brand wordmark, "YOUR PICK" eyebrow, resort name and
  location, "Why this one," stats, mixed-ability breakdown, Nicole's Hot Take with attribution,
  Share / Make your own pick / See more of Nicole's picks — a genuinely complete, well-organized
  card. Zero app-chrome nav bleeds onto it (verified) — Principle 1 holds.
  ✗ Will try the right effect? The reason bullets read "You said your crew ranges from never skied
  before to expert…" — but this cold viewer never said anything. The eyebrow reads "Your pick" —
  it isn't theirs, it's whoever sent them the link's pick. This is the app's own strategy doc's
  named primary cold-start case (more common than the bare app-link splash), and the content
  architecture doesn't have a second-person-neutral variant for it.
  ⚠ Action matches expectation? They can still read and use the card (stats, hot take, and the
  low-friction "Make your own pick" CTA are all genuinely present and functional) — so this isn't a
  dead end, but the "why" section, which is supposed to build their confidence in the pick, will
  read as slightly broken or at best confusing on a first read, at exactly the moment first
  impressions matter most for the app's actual most common entry point.
  → Finding: Major. See Findings by Severity.

Step 2: Wants to make their own pick
  ✓✓✓✓ "Make your own pick" is present, visible, low-visual-weight but not buried, and routes
  correctly to the mode-choice splash — this part of the re-entry design works exactly as
  strategy.md specifies.
```

## Findings by Severity

### Critical

- **[H3 / H1] Quiz progress is silently and completely lost on any page reload, with zero warning
  and zero acknowledgment.** Verified: answer Q1+Q2a, reload the page, land back on the splash
  screen with no trace of the prior answers and no message explaining what happened. Per
  `build-notes.md`, this environment substitutes in-memory JS variables for the
  `sessionStorage`/`localStorage` the design spec calls for — the build-notes flag this as a known
  gap, but frame the risk as "does not survive a tab close/reopen." The actual behavior tested here
  is worse than that framing: it doesn't even survive a same-tab **reload** (a `sessionStorage`
  implementation would have). This directly and specifically breaks Priya's explicitly named stress
  scenario ("I need to be able to stop mid-quiz and pick back up without losing my answers") — the
  exact persona and exact user story this feature exists to serve. → **Fix:** at minimum, implement
  real `sessionStorage` persistence before shipping to any environment that supports it (flagged by
  build-notes as the intended upgrade path — treat this as a blocking pre-launch item, not a
  someday item); as defense-in-depth even with `sessionStorage`, add a visible "Welcome back — pick
  up where you left off?" moment on return, and/or a warning before an in-progress quiz is
  abandoned, rather than a silent, unacknowledged reset.

### Major

- **[H3 / H6] Back navigation doesn't visually restore the answer on Q2a's single-select variant
  ("What's your level?"), even though the underlying value is retained.** Verified: select
  "Intermediate," advance, tap Back — no option shows as selected. Confirmed the data isn't
  actually lost (tapping Continue again with nothing visibly checked silently advances using the
  old value), which makes this worse, not better: the user can't tell what their current answer
  is, can't confirm a correction took effect, and might reasonably re-select a different answer
  thinking the first didn't register. Isolated specifically to this step — Q1, Q3 (budget), and
  the Q2a *multi*-select variant (mixed/wide-mixed groups) all correctly restore checked state on
  Back. This is the mechanism Marcus's persona explicitly names as his key need ("correct one
  answer without restarting") and it's broken on the one path (solo/matched skill-level) most
  first-timers and solo planners like Priya will hit. Compounds with mode-switching: jumping
  Plan→Chase→Plan resets the visible quiz to Step 1 rather than resuming the step left off at
  (data is retained, as shown by Q1 correctly re-checking, but the user experience is "start
  over from the top of the screen sequence," not "pick up where you left off" as strategy.md
  promises). → **Fix:** apply the same state-hydration-on-render logic already working for Q1,
  Q3, and Q2a's multi-select to Q2a's single-select variant; consider deep-linking mode-switch
  returns to the exact step rather than Step 1.

- **[H2] The shared-result screen speaks in first/second person ("You said…", "Your pick") to a
  cold recipient who never answered any questions — and this is the app's own named primary
  distribution path, not an edge case.** Verified via a genuinely cold, isolated browser context
  loading a real share link with no prior session: the reason bullets, the "Your pick" eyebrow, and
  even the pre-tap OG/Twitter link-preview text ("Matched to your answers: You said your crew
  ranges from…") all assume the viewer is the person who took the quiz. strategy.md §1.1
  explicitly states the shared-result link is "the far more common real path" for a cold visitor,
  more common than the bare app-link splash — so this isn't a rare fallback, it's most users' first
  impression. It doesn't create a dead end (the card is otherwise complete and the "Make your own
  pick" re-entry works well), but it undermines exactly the section meant to build the recipient's
  confidence in the pick. → **Fix:** a lightweight cold-view variant of the reason-bullet framing
  (e.g., "They said their crew ranges from…" or a neutral "Matched on:") triggered when the result
  is being viewed via a share link rather than freshly generated in this session; same treatment
  for the OG/Twitter description copy.

- **[H1 / H2] Nicole's own quoted Hot Take can directly contradict the algorithmic reason text on
  the same card.** Verified on a generated Keystone result: the mixed-ability copy states "For
  more experienced skiers: A real strength," while Nicole's Hot Take on the same card reads "no
  advanced terrain." The card's entire credibility model (per strategy.md) is "grounded data, plus
  her voice where it exists" — when the two visibly disagree on the same screen, it reads as the
  app not knowing what it's talking about, which is the worst possible failure mode for Marcus
  specifically (he needs to defend this pick to four skeptical friends). → **Fix:** either
  cross-check hot-take sentiment against the terrain-fit scoring at build/data time and suppress or
  soften ceiling-tier claims that a real hot take contradicts, or reframe the mixed-ability copy to
  acknowledge the tension rather than assert "a real strength" unconditionally.

- **[H1 / H3 / H7] Chase-the-Snow's live-forecast fetch has a documented hard 10-second timeout
  before falling back to the always-available historical data, with no manual skip.** Confirmed in
  source (`noaa.js` / assembled build): `loadingTimer` at 300ms, `escalateTimer` (reassurance copy)
  at 4000ms, `hardTimer` (forced fallback) at 10000ms — and no button or gesture to jump straight to
  historical data during the wait. This is the worst-case wait precisely under the network
  conditions Jordan and Nicole are explicitly defined by (cold hands, one bar of signal, on a
  chairlift, deciding fast) — the mode built specifically for "an answer in three seconds" can make
  its most relevant users wait up to ten. The 4-second reassurance copy ("Still checking — the
  forecast service is being slow today") is a good instinct but doesn't resolve the underlying
  wait. → **Fix:** add a visible "Just show typical snowfall" / skip-ahead control once the
  escalated (4s) state is reached, so an impatient or poorly-connected user isn't forced to ride
  out the full timeout for data that's already sitting there.

- **[H2 / H6 / H10] Ski-school ratings are shown as bare labels with no supporting evidence, even
  though the dataset contains real sourcing detail that was never wired into the UI.** Verified:
  the rendered "Ski school" stat tile is a flat string lookup (`strong`→"Highly rated,"
  `decent`→"Solid," `weak`→"Limited — check details before booking") with no tooltip, expand, or
  link. The underlying resort records carry a `family_ski_school_basis` field with genuine citation
  detail (e.g., specific programs, review sources, reasoning) for exactly this claim — it exists in
  the data and is simply never surfaced. Dana's persona explicitly names this as her core evaluation
  criterion ("Confidence that the ski school is genuinely good, not just marketed as good") and
  explicitly distrusts "a vague 'strong' rating with nothing behind it" — which is precisely what
  she gets. The weak-tier copy compounds this by inviting her to "check details before booking"
  without saying where. → **Fix:** surface `family_ski_school_basis` as an expandable
  detail/tooltip on the Ski School stat tile (the same disclosure pattern already used well
  elsewhere on this card, e.g., the mixed-ability tier captions).

- **[H2] Data-bound editorial copy reintroduces unexplained ski jargon that the fixed quiz copy
  deliberately removed.** Verified: `beginner_note`/`character_note` strings surfaced verbatim in
  the mixed-ability "For newer/experienced skiers" section include terms like "Corbet's Couloir"
  and "mogul/tree terrain" with no gloss. copy-deck.md put real, careful work into stripping jargon
  ("never-ever" → "never skied before," "groomers" → "smooth, groomed trails," "après" → "buzzing
  nightlife") from the fixed question copy, explicitly for Priya's benefit — but the dynamically
  inserted resort-fact half of the reason/range text wasn't put through the same pass, and it's
  exactly the section meant to be the reassurance payoff for a first-timer reading carefully.
  → **Fix:** either lightly gloss high-jargon terms inline in the data fields themselves, or add a
  thin plain-language substitution/parenthetical layer at render time for the small, known list of
  offending terms (couloir, mogul, etc.), consistent with how the fixed copy already handles them.

### Minor

- **[H5 / H3] "Start over" is a single, unconfirmed tap that destroys all 5 answers, with no undo.**
  Verified in source: the click handler wipes `state.quizAnswers` and jumps to step 0 with no
  confirmation dialog. Visual separation (smaller text link, spaced below Back/Continue) meaningfully
  reduces accidental-tap risk, which is why this isn't rated Critical — but it's still a fully
  destructive control with zero confirmation, sitting on the same screen as Continue, for personas
  (Marcus's tendinitis, Nicole's cold-numbed fingers) explicitly defined by elevated mis-tap risk.
  → **Fix:** a lightweight confirm ("Start over? This clears all your answers." / Cancel / Start
  over) or an undo toast after the reset, matching the level of protection already given to other
  state changes in this build.

- **[H1 / H8] The result card's Hot Take and primary CTAs (Share, Make your own pick, See Nicole's
  list) don't finish revealing until ~700–750ms after the result appears, with no loading
  indicator signaling more content is coming.** Verified via source (staggered `Animation` delays)
  and screenshots at fixed delays: at 700ms, the card visibly ends after the mixed-ability section,
  with blank reserved space below and no hot take, no CTAs. This is well short of catastrophic —
  total reveal time is under a second, and the build includes a smart escape hatch (any
  pointerdown/keydown/scroll instantly finishes all animations) — but an OS-level screenshot
  gesture (the exact action this card is built around) doesn't fire that listener, so a user who
  screenshots within that first ~700ms to paste into a group chat can genuinely catch the card
  missing its own trust signal and share button. → **Fix:** either compress the hot-take/footer-cta
  delay further, or reserve full-opacity rendering for a screenshot-safe state slightly sooner.

- **[H1] The disabled "Back" button on Q1 is shown, not hidden, with no visible explanation for why
  it's disabled.** Minor clarity nit — a first-time user tapping a visibly-present-but-inert control
  gets no feedback at all (not even a tooltip or aria-disabled reason). Low real-world cost since
  it's step 1 of 1 possible back-targets, but worth a look.

- **[H8] Double-period punctuation bug in the shared-result OG/Twitter description**
  (`"...bored on the harder ones.. See the full pick."`) — a reason bullet that already ends in a
  period gets a second sentence concatenated directly onto it. Cosmetic, but visible in the actual
  link preview a cold recipient sees first.

### Note (false alarm, corrected during testing)

- An initial, heavily downscaled screenshot of Nicole's List appeared to show "No hot take yet" for
  Breckenridge, which would have contradicted the real hot take rendered correctly elsewhere on the
  same build. Direct DOM inspection confirmed this was a misread of a compressed image — Nicole's
  List correctly renders all 9 written hot takes (including Breckenridge's) against the correct
  resort rows, and correctly falls back to "No hot take yet" for the remaining ~35 rows. Recorded
  here only so this doesn't get re-flagged from a similar screenshot later.

## What Works Well

- **The reason-not-score philosophy is real, not just a slogan.** Tested a "not sure yet" travel
  answer and a "doesn't matter" terrain answer — the app correctly produced "We didn't factor in
  how far this is, since you weren't sure yet" rather than silently guessing, and every reason
  bullet observed across multiple runs traced to an actual answered question, in the user's own
  words ("You said advanced…", "You said splurge-friendly…").
- **The live/historical forecast distinction (H1) is a genuine model of honest system status.** The
  "Not a live forecast" badge is its own visible, shape-plus-text element (not buried in prose), and
  the Canada section is clearly separated, honestly worded, and non-apologetic exactly as
  copy-deck.md specifies — directly answering Nicole's named fear about looking "broken, not
  honest."
- **Precision-input accommodation is thoughtful, not just claimed.** Auto-advance-with-a-cancel-
  window on single-select, and a mandatory explicit Continue on multi-select, is a genuinely good
  compromise between one-tap speed and Marcus/Nicole's need to correct a mis-tap before it locks in.
- **The result card is disciplined (H8).** Nothing on it is fighting for attention that doesn't earn
  its place — reason bullets, stats, mixed-ability breakdown, hot take, then CTAs, in that order,
  and it's verifiably free of app-chrome nav bleeding onto it even on a cold share-link load.
- **The mixed-ability bottleneck logic reads as intended, not just computes as intended.** The
  Range Readout explicitly tells the user it didn't average, and gives two separate, specific
  statements per end of the group — this directly targets Marcus's stated distrust of black-box
  compromise scores.
- **Difficulty/status indicators never rely on color alone anywhere tested** — rank numbers, text
  quality descriptors, and text status flags ("Heads up — this gets crowded") all pair with real
  text, satisfying Jordan's deuteranopia requirement at the list level.

## Task-Completion Matrix

| Task | Persona | Outcome | Blocking issue(s) |
|---|---|---|---|
| Plan a first trip, solo/matched | Priya | Completes if uninterrupted; **fails silently if interrupted** | Critical: progress loss on reload |
| Find a resort for a mixed-ability group | Marcus | Completes; result is usable and defensible in most cases | Major: Back doesn't show his answer; occasional hot-take/reason contradiction |
| Check where to fly this weekend | Jordan | Completes; list is genuinely fast to scan once loaded | Major: up to 10s wait before loaded, no skip |
| Evaluate a resort's ski school for a kid | Dana | Completes, but without confidence | Major: no evidence behind the rating, "check details" points nowhere |
| Open a shared result link cold | Cold stranger | Completes; card is usable and has a clear re-entry path | Major: "you said…" framing is confusing on first read (not a dead end) |

## Structural Flags (per Designpowers auto-mode safeguards)

- **Critical H3 finding, flagged explicitly:** quiz progress is destroyed by a page reload with no
  warning and no recovery path — this is the closest thing in this build to "no undo on a
  destructive action" (the destructive event here being an interruption the target persona
  explicitly anticipates, not a user-initiated delete). Recommend blocking on this before any
  environment upgrade that would otherwise mask it (i.e., don't let a future `sessionStorage`
  implementation quietly paper over the missing "we lost your place" acknowledgment — build that
  acknowledgment regardless of storage mechanism).
- No critical H1 "user completely lost" finding was found — in every walkthrough, including the
  cold-stranger case, the user always had a legible next action available (Make your own pick,
  Try again, a visible Back/Continue), even where the copy or timing around that action was
  confusing or slow.

## Handoff

**heuristic-evaluator → design-builder:** Three things worth fixing before anything else. First,
critical: reload silently wipes quiz progress with zero warning — this breaks Priya's explicit
"stolen fifteen-minute windows" scenario outright, and it's worse than build-notes' own framing
suggests (it doesn't survive a same-tab reload, not just a tab close). Second: the Q2a single-select
step doesn't visually restore the answer on Back even though the data is retained — same root
cause as the mode-switch "resets to Step 1" behavior, one fix should cover both. Third: the
shared-result screen's "you said…" framing doesn't work for the cold-stranger case, which
strategy.md itself names as the primary real-world entry point, not an edge case — needs a
neutral-voice variant triggered on cold share-link loads. Everything else (Chase's 10s timeout, the
ski-school evidence gap, the Nicole-quote/reason-text contradiction, the unconfirmed Start-over)
is real but more contained. What's working well and shouldn't be touched: the reason-bullet honesty
pattern, the live/historical forecast distinction, and the mixed-ability bottleneck logic all read
exactly as designed.
