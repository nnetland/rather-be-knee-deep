# Accessibility Review — Rather Be Knee Deep

_accessibility-reviewer · 2026-08-03 · Reviewed against WCAG 2.1 AA (AAA where feasible) + COGA,
using `docs/designpowers/personas/2026-08-03-ski-reco-personas.md`, `design/visual-system.md`,
`design/copy-deck.md`, `design/motion-spec.md` (§9), and `build/build-notes.md` as the standard.
Tested live against the actual build (`build/rather-be-knee-deep.html`) via Playwright/Chromium
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — real rendered-DOM contrast math, real keyboard
traversal, a real CDP deuteranopia simulation, real `prefers-reduced-motion`/`320px`/`200%-zoom`
runs, and direct inspection of `build/rather-be-knee-deep.html`'s source where behaviour needed
explaining. design-builder's 23 structural assertions (`build/verify_a11y.js`) were treated as a
floor, not evidence of compliance, and re-run independently (still 23/23) before going further —
several of the defects below sit specifically in the gaps that test suite's own scope doesn't
reach (in-place re-render focus handling, the Range Readout's transform state under reduced
motion, zoom on any screen besides the splash).

All scratch scripts and screenshots used to produce the numbers below live in
`/home/claude/ski-reco/reviews/a11y-scratch/` for reproducibility.

## Summary

**Verdict: revise before ship — not a rethink.** The accessibility architecture is genuinely
well-designed (shape+label difficulty encoding, a real deuteranopia pass, zero sliders/drag
anywhere, an honest error-recovery pattern, a progress indicator built exactly to spec) and several
of the hardest, most novel problems — the Range Readout's colour-independent solid/dashed bridge,
the keyboard-vs-pointer auto-advance heuristic, jargon translation — are solved correctly and
non-trivially. But there is one **critical** zoom/reflow failure that blocks a low-vision user from
reading (not just seeing awkwardly — genuinely reading) the first quiz question at 200% zoom, and a
cluster of **major** issues concentrated in two places: the 5-step quiz's keyboard/focus handling
(affects every single tap across the entire primary flow) and Nicole's List (contrast, touch
targets, screen-reader tag-list parsing, and zoom overflow all land on that one surface). None of
these require architectural rework — they're scoped, mechanical fixes.

**Findings: 1 critical · 9 major · 4 minor.**

---

## Critical

### C1. 200% zoom occludes and cuts off quiz options — blocks reading the first question

**WCAG 1.4.10 (Reflow), 1.4.4 (Resize Text).** Persona: Dana (low vision, "screen contrast/text
size genuinely matters to her, not as a nice-to-have").

At 200% zoom (root font-size forced to 32px, a standard low-vision accommodation, tested at a
390px viewport per `zoom_reflow.js`), Q1 of the trip-planner quiz renders its four options in a
2-column grid that no longer fits the effective width, **and** the fixed bottom nav overlaps the
bottom two options. Screenshot (`w320-result-range.png`/`zoom200-q1-debug.png` in the scratch
folder) shows the third option, "A mix — some newer, some more experienced," with its text
literally covered by the "Plan / Chase / Nicole's List" nav bar, and the fourth option's right edge
cut off past the viewport edge — the page also has horizontal scroll (`scrollWidth=559` vs
`clientWidth=390`, confirmed via `document.documentElement.scrollWidth`). A user zoomed to 200%
cannot read that option without scrolling in two directions and still can't see all of it once they
do.

**Two independent root causes, both worth fixing:**

1. `build/rather-be-knee-deep.html`, the tap-chip/region grids use a fixed-viewport-width
   breakpoint, not the content-driven `auto-fit` sizing visual-system.md §6 mandates system-wide:
   ```css
   .chip-grid { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
   @media (min-width: 380px) { .chip-grid--2col { grid-template-columns: 1fr 1fr; } }
   @media (min-width: 380px) { .region-grid { grid-template-columns: 1fr 1fr; } }
   ```
   Media queries evaluate against actual device pixels, not the "effective" reflow width, so at
   200% zoom the browser still reports 390px and the 2-column rule stays active even though each
   column now needs roughly double the horizontal room. This is exactly the failure mode
   visual-system.md §6 already correctly solved for the stat strip (`repeat(auto-fit,
   minmax(...))`) but the same pattern was never applied to the quiz's own `chip-grid--2col` and
   `region-grid`.

2. `.app-main { padding-bottom: calc(72px + var(--space-6)); }` reserves a **hardcoded 72px** for
   bottom-nav clearance. Every other spacing value in the system is `rem`-based specifically so it
   scales with zoom (visual-system.md §6: "All type and spacing tokens are consumed in rem, never
   fixed px... a stat tile at 200% zoom gets proportionally more padding, not clipped text"), but
   `72px` breaks that rule. `.nav-item` grows somewhat at 200% zoom (rem-based padding/font-size),
   so the reserved 72px undershoots the nav's real height and it overlaps page content.

**Fix:**
- `.chip-grid--2col` / `.region-grid` → `grid-template-columns: repeat(auto-fit, minmax(140px,
  1fr))` instead of the fixed-breakpoint `1fr 1fr`.
- Change `72px` to a `rem` equivalent (e.g. `4.5rem`) so it scales in lockstep with the nav, or
  measure the nav's real height at runtime (`ResizeObserver`) and set the padding from that.

---

## Major

### M1. Keyboard/AT focus is forced back to the step heading on every single option tap, not just on step transitions

**WCAG 2.4.3 (Focus Order), COGA "avoid reliance on memory."** Affects any keyboard-only user and
every screen-reader user across the entire quiz — the app's primary flow, used by Priya/Dana/Marcus.

`renderQuizStep(direction)` is called both on real step transitions (`direction = "forward"` /
`"backward"`) and on an **in-place re-render after a same-step selection**
(`direction = null`, fired from `handleQuizSelect` → "re-render in place to reflect selection state
— no transition, same step"). The function unconditionally ends with:
```js
const heading = wrap.querySelector("h2");
if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
```
Verified directly (`keyboard2.js`/`keyboard3.js`): focus a chip, press Space → `aria-checked`
correctly flips to `true`, but `document.activeElement` becomes the `<h2>` question heading, not
the chip just selected. For the multi-select step (Q2a, two taps required for a `wide-mixed`
group), this happens **again** on the second checkbox — every tap re-announces the whole question
to a screen reader and drops the user back to the top of the option list. Recovering to reach the
second checkbox or the Continue button costs 1–5 extra Tab presses depending on step, **every single
time**, for the entire 5–7-step quiz. This is not covered by `verify_a11y.js`'s "focus moves to step
heading on step change" assertion, which only checks real transitions.

(One thing this is *not*: it does not affect touch/mouse users, since they don't navigate by
focus, and it correctly does *not* trigger the 420ms auto-advance for keyboard input — see "What
works well" below, that heuristic is solid.)

**Fix:** only call `heading.focus()` when `direction` is truthy. On the `direction === null`
in-place path, re-query and refocus the equivalent chip/checkbox by `data-value` after the
re-render (or simply don't move focus at all — `aria-checked` already changed on the live element,
which is enough).

### M2. Single-select quiz options use `role="radio"` without the radiogroup keyboard pattern

**WCAG 4.1.2 (Name, Role, Value), ARIA APG radiogroup pattern.**

Q1/Q2b/Q3/Q4a/Q5's chips each carry `role="radio"` but are wrapped in `role="group"`, not
`role="radiogroup"` (`optionListHtml()`: `<div class="chip-grid chip-grid--2col" role="group">`).
Every radio is independently in the Tab sequence (no roving `tabindex`), and Arrow keys do nothing
— confirmed directly: focusing a radio chip and pressing `ArrowDown`/`ArrowRight` leaves focus
exactly where it was (`keyboard2.js`). Real `<input type="radio">` and the ARIA APG composite
radiogroup pattern both use arrow keys to move *and set* selection within the group, with only one
radio in the Tab sequence at a time — a deeply-trained convention for screen reader/keyboard users.
As built, these controls announce as "radio" but behave like independent toggle buttons, which will
surprise anyone navigating by the platform convention.

**Fix:** change the wrapper to `role="radiogroup"` with an accessible name (the question's own
`<h2>` id via `aria-labelledby` works), and implement roving `tabindex` + Arrow-key selection per
the APG pattern. If schedule-constrained, at minimum switch `role="group"` → `role="radiogroup"`
so AT correctly announces group membership and position ("1 of 4"), even before arrow-key nav is
added.

### M3. Range Readout's bridge and pins never render under `prefers-reduced-motion: reduce`

**WCAG 2.3.3 (Animation from Interactions), and a direct regression against motion-spec.md §5.3**
("The bridge, both pins, and the sentences all appear instantly at full/final state").

Confirmed via `reduced_motion.js` + screenshot (`reduced-motion-result.png`): with reduced motion
forced, `getComputedStyle(#range-bridge).transform` reports `matrix(0, 0, 0, 1, 0, 0)` — i.e.
permanently `scaleX(0)`, invisible. The screenshot shows the difficulty track segments (static
background) but **no bridge, no floor/ceiling pins, no "Never skied"/"Expert" flags** — compare
directly against the full-motion deuteranopia screenshot from the same code path, where the bridge,
pins, and labels are all clearly visible. Root cause: `revealResultCard()`'s reduced-motion branch
returns early —
```js
if (reduce) {
  card.querySelectorAll(".reveal-hidden").forEach((n) => { n.classList.remove("reveal-hidden"); n.style.opacity = ""; });
  card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease", fill: "forwards" });
  announce("reveal-announcer", "Your pick is ready.");
  return;
}
```
— but the code that adds the `.is-revealed` class the bridge/pins actually key off (`bridge.classList.add("is-revealed")`, etc.) lives only later in the function, in the full-motion branch, and is never reached. `verify_a11y.js`'s reduced-motion assertion only checks the outer card's opacity, not this.

The two plain-language sentences below the bridge *do* still render (confirmed), so no information
is lost for anyone reading the full text — but a sighted, motion-sensitive user looking at the
graphic sees a blank gap where a component should be, which reads as broken, not as an honest
absence, directly undermining the trust the rest of the product works hard to earn.

**Fix:** in the `if (reduce)` branch, before `return`, also add `.is-revealed` to `#range-bridge`,
`#range-pin-floor`, and `#range-pin-ceiling` (or fold them into the generic `.reveal-hidden` sweep
at the top of the branch).

### M4. Systemic contrast shortfall: tokens verified against `bg.page`, actually rendered on `bg.tint`/elevated surfaces

**WCAG 1.4.3 (Contrast, Minimum).** Measured from the live rendered DOM in both themes
(`contrast_full.js`), real relative-luminance math, not eyeballed.

| Location | Theme | Text colour | Actual bg | Ratio | Needs |
|---|---|---|---|---|---|
| Bottom/top nav active-tab label | Dark | `--indigo-400` #7F68F3 | `--night-800` #1E1830 | **4.21:1** | 4.5:1 |
| "Make your own pick" secondary button | Dark | `--indigo-400` #7F68F3 | `--night-800` #1E1830 | **4.21:1** | 4.5:1 |
| "See more of Nicole's picks →" link | Dark | `--indigo-400` #7F68F3 | `--night-800` #1E1830 | **4.21:1** | 4.5:1 |
| Nicole's List "All regions" filter chip (selected) | Dark | `--indigo-400` #7F68F3 | `color-mix(...)` ≈#251C47 | **3.86:1** | 4.5:1 |
| "Not a live forecast" freshness badge | Light | `--warm-700` #AA671A | `--bg-tint` #F2EFFA | **3.97:1** | 4.5:1 |

visual-system.md §1.3 documents `indigo.400` at "4.61:1 (dark)" — that number is correct **only**
against flat `bg.page` (#14101F); every one of the five instances above sits on a lighter tinted or
elevated surface instead, where the same token drops under 4.5:1. Same pattern in light mode: the
freshness badge's "Not a live forecast" text — the one string copy-deck explicitly says "must
survive being read alone, at speed, with cold hands" — sits on `bg.tint`, not the `bg.page` white
the 4.50:1 figure in the spec was computed against, and fails at 3.97:1. This affects exactly the
two conditions the brief names as real ("phone in bright sunlight," "6am in the dark").

**Fix:** don't treat one contrast number per token as universally safe — verify each token against
every surface it's actually painted on, not just `bg.page`. Concretely: either introduce a slightly
darker (light) / lighter (dark) variant for use specifically on `bg.tint`/elevated surfaces (e.g. a
`--warm-800` for the badge, an `--indigo-350` around #8C78F5 for dark-tinted-surface text,
independently verified ≥4.5:1 against `night.800`/`night.700`), or move these specific elements
onto a flatter background where the existing token already clears AA.

### M5. "Nicole's take" chip is colour-identical to the "gets crowded" warning chip

**WCAG 1.4.1 (not a pure violation, since text differs) — but a direct regression against the
design system's own stated accessibility rationale** ("gold always means Nicole... a genuine
accessibility win, since Jordan and Dana can learn it once and rely on it everywhere," and Jordan's
own persona: deuteranopia, <10-second scan speed, "burned before by apps that only colour-code").

```css
.chase-flag--crowd { color: var(--accent-warm-text); }
.chase-flag--nicole { color: var(--accent-gold-text, var(--warm-700)); }
```
`--accent-gold-text` is referenced but **never defined anywhere in the stylesheet** — confirmed via
full-file search. It silently falls back to `--warm-700`, which is *the exact same token* used for
the crowd-warning flag. And in the actual row-rendering code (not just this unused CSS rule), the
"Nicole's take" chip is hardcoded directly: `<span class="chase-flag" style="color:var(--accent-warm-text)">● Nicole's take →</span>` — literally the same custom property as `.chase-flag--crowd`. In
both light and dark mode, "● Nicole's take →" and "⚠ Heads up — this gets crowded on a powder day"
render in the identical amber. The developer clearly knew raw `gold-500` isn't text-safe (confirmed
independently: 1.6:1 on white) and reached for the fallback correctly on that count — but the
fallback happens to collide with a semantically unrelated warning colour, which the visual system
explicitly built colour-consistency around for Jordan's benefit.

**Fix:** define `--accent-gold-text` as its own AA-safe, visually distinct hue — not raw
`gold-500` (fails as text) and not `warm-700`/`warm-600` (collides with the crowd flag). A deep
amber/ochre distinct from the warm family, or reuse `--accent-mint-text`/teal ("positive fit," a
closer semantic match to "worth a look") would both work and keep the "one colour, one meaning"
promise intact.

### M6. Nicole's List "Best for" tags concatenate into unparseable text for screen readers

**WCAG 1.3.1 (Info and Relationships).** Affects all 44 rows of a core surface.

```js
`<div class="tag-row">${row.tags.slice(0, 4).map((t) => `<span class="pill-tag">${escapeHtml(t.replace(/-/g, " "))}</span>`).join("")}</div>`
```
The tag `<span>`s have no `role`, no `aria-label`, and are joined with an empty string — zero
separator in the DOM. Confirmed directly (`badge_check.js`/table-structure dump): the accessible
text content for Alyeska Resort's "Best for" cell reads as **"deep powderbig vertbackcountry
accessuncrowded"** — one unbroken run-on string. Sighted users see four clearly separated pill
chips (CSS `gap` creates visual space that has no equivalent in the accumulated text stream); a
screen reader user gets an ambiguous, in places actually misleading, blob (e.g. "vertbackcountry"
reads as one word). This is different in kind from the button-based option lists elsewhere in the
app (each button is its own accessible stop regardless of markup whitespace) — plain inline spans
with no distinguishing role or name genuinely merge for AT.

**Fix:** either restructure as a real list (`<ul class="tag-row"><li class="pill-tag">…</li>…`,
which also gives AT a "list of 4 items" count for free), or at minimum join with `", "` /
insert a visually-hidden `<span aria-hidden="true"> · </span>` between tags.

### M7. Nicole's List touch targets and gutters fall below the app's own stated floor

**WCAG 2.5.5/2.5.8 (Target Size).** Persona: Marcus (wrist tendinitis, "every input a single
generous tap"), Nicole (cold-gloved fingers).

Measured from the rendered DOM (`touch_targets.js`): the region filter chips on Nicole's List
render at **40×40px** with **8px** gutters between adjacent chips —
```css
.filter-chip { min-height: 40px; padding: var(--space-2) var(--space-4); ... }
```
— both hardcoded values that directly contradict visual-system.md §7's own absolute floor ("44×44px
absolute floor... 12px minimum gutter between adjacent targets") and build-notes' own claim ("chips
ship at 56px min-height"). Every other tap-chip in the app (quiz options, the Chase toggle) correctly
ships at 56px; this is an isolated miss on one component, on the one surface most likely to be
tapped one-handed while cross-referencing a group chat.

**Fix:** `.filter-chip { min-height: 44px }` at minimum, `56px` for consistency with every other
chip in the system; increase the gap in `.nicoleslist-filters` from `var(--space-2)` (8px) to
`var(--space-3)` (12px).

### M8. Nicole's List causes page-wide horizontal scroll at 320px, worse at 200% zoom

**WCAG 1.4.10 (Reflow).**

Measured (`zoom_reflow.js` + `find_overflow.js`): at the 320px floor width,
`document.documentElement.scrollWidth` = 432 against a 320px `clientWidth` — genuine page-level
horizontal overflow, not contained to a scrollable sub-region. At 200% zoom it's worse: 864 vs 390.
Root cause confirmed directly: `<table>` renders at 416px real width inside a 320px viewport because
there is no `table { table-layout: ... }` constraint, no `overflow-x: auto` wrapper around
`#nicoles-table-wrap`, and the "Best for"/"Nicole's Hot Take" columns' content (pill tags,
paragraph text) forces the browser's auto table-layout algorithm to widen columns past the
available space rather than wrap. This directly contradicts visual-system.md §6's explicit
320px-floor requirement ("must render without horizontal scroll or clipped text") and wasn't caught
by design-builder's own zoom verification, which per build-notes only exercised the
splash→quiz→multi-select path, not Nicole's List.

**Fix:** wrap `#nicoles-table-wrap`'s contents in a container with `overflow-x: auto` as a
safety net so overflow is at least contained and scrollable rather than blowing out the whole page,
**and** constrain column widths (`table-layout: fixed` with defined `<col>` widths, or cap the
number/width of visible tags at narrow widths) so the scroll isn't needed at 320px in the first
place.

### M9. Result screen never moves keyboard/AT focus to new content on arrival

**WCAG 2.4.3 (Focus Order), and an internal inconsistency** — `focusHeading(main)` is called by
every other route (`renderSplash`'s sibling routes: chase, nicoles, and the no-match state all call
it) but **not** by `renderResult`, confirmed by direct source search. On landing on the result
screen — whether by finishing the quiz or via a cold-loaded share link (copy-deck's own "primary
cold-start case, more common than the bare app link") — `document.activeElement` is `document.body`
(confirmed: `keyboard4.js`). Screen reader users get the `aria-live="polite"` "Your pick is ready"
announcement (correctly implemented, see below), but keyboard-only users get no positional signal
at all, and a screen reader's reliance on a live-region update firing this close to initial page
load is itself a known race condition — many AT implementations haven't finished attaching their
live-region listener yet when an update fires synchronously during first render, so the
announcement is not guaranteed to be heard on the cold-share-link path specifically, which is the
one this component was most worried about.

**Fix:** call `focusHeading(main)` (or focus `.result-headline` directly, `tabindex="-1"`) inside
`renderResult`, in addition to the existing `aria-live` announcement — a focus move is reliably
detected by AT regardless of load timing, the live region alone is not.

---

## Minor

### N1. Range Readout `aria-label` uses a term the quiz itself doesn't use

`range.floor.replace("-", " ")` turns `never-skied` into "never skied," but the quiz option the
user actually picked is labelled "Never skied before" (`SKILL_LABEL` already defines this mapping
elsewhere in the same file — it's just not reused here). Small wording mismatch between what a
screen reader user hears summarised and what they selected. **Fix:** route the aria-label's level
words through `SKILL_LABEL` instead of a raw string replace.

### N2. Switching modes mid-quiz resets the visible step, though answers survive

Confirmed (`resume_check.js`/`resume_check2.js`): tapping "Chase" mid-quiz and back to "Plan" does
correctly retain `state.quizAnswers` (the Q1 chip re-renders pre-selected) but resets
`state.quizStepIdx` to 0, dropping the user back to Q1 instead of resuming at the step they left.
Not data loss, but it costs a Priya-in-stolen-fifteen-minutes user redundant confirmation taps
through already-answered steps to catch back up — a partial miss against her explicit "stop mid-quiz
and pick back up" stress user story. **Fix:** persist `state.quizStepIdx` across mode switches, or
recompute and jump to the furthest-answered step on re-entry.

### N3. Illustration alt text's "distinguishing detail" collapses to 13 combinations across 71 resorts

Computed directly from the resort dataset and the `illustrationAltText()` logic: only 13 distinct
descriptive-fragment combinations exist across all 71 resorts, and one combination ("big, dramatic
vertical, a base village") is shared by 16 resorts — nearly a quarter of the dataset. Alt text is
never literally duplicate (name/location always differ), so this isn't a hard WCAG failure, but it
under-delivers on copy-deck §8's stated goal that alt text "carry the same mood the illustration is
meant to carry" — the illustrations themselves vary far more richly (peak geometry, tree density,
couloir lines for steeps, terrain-park features, per build-notes) than the 13-bucket text captures.
**Fix:** fold 1–2 more per-resort data points into the phrase generator (e.g. specific
`best_for_tags` like `steeps`/`terrain-park`, or a keyword pulled from `character_note`) to widen
the combinatorial space.

### N4. Share-confirmation toast element is created lazily, not present at page load

`showToast()` creates and appends `#app-toast[role="status"]` to `document.body` on first call
rather than the shell markup including an empty live region from the start. `role="status"` is the
correct implicit live-region pattern (this is a genuine strength, see below) but some AT is more
reliable picking up updates to a region that already existed at load. Low real-world risk given
modern Chromium-based AT handles this fine, but cheap to harden. **Fix:** include
`<div id="app-toast" class="toast" role="status"></div>`, empty, in the static shell; only ever
update its `textContent` afterward.

---

## What works well

- **Colour independence is genuinely solid, verified under a real CDP deuteranopia simulation**
  (`deuteranopia.js`, screenshots in the scratch folder), not just inspected in markup: the
  circle/square/diamond/double-diamond difficulty glyphs stay legible with colour removed, and the
  Range Readout's solid-vs-dashed bridge pattern (a genuinely novel, non-colour differentiator) is
  clearly readable as a shape/pattern distinction, not a colour one, exactly as designed.
- **Zero sliders, zero drag interactions, confirmed by DOM query** across splash, quiz (both
  select modes), Chase, and Nicole's List — Marcus's and Nicole's motor requirement holds
  everywhere, not just where it was obviously going to.
- **Nicole's List table semantics pass cleanly**: a real `<caption>` ("Nicole's ski history, 44
  places"), `scope="col"` headers, and — specifically checked because content-writer flagged it —
  **100% badge `aria-label` parity across all 44 rows** for the day-trip/international badges (zero
  rows found missing the label in a full sweep). This is exactly the pattern content-writer asked
  to have eyes on, and it's correctly built.
- **Jargon translation commitments are honoured, verified by full-file search**: zero occurrences
  of "never-ever," "corduroy," "après," or "sidecountry" anywhere in user-facing copy — all
  correctly rendered as "Never skied before," "Smooth, groomed trails," "Buzzing nightlife and
  bars," etc., exactly per copy-deck.
- **The keyboard-vs-pointer auto-advance heuristic is a genuinely correct, non-trivial piece of
  work**: `evt.detail !== 0` reliably distinguishes a real pointer click from a keyboard-triggered
  synthetic click in Chromium (confirmed directly), so keyboard users never get surprise-advanced
  past a selection — they always land on the explicit, content-writer-mandated `Continue` control,
  exactly as specified for Marcus/Nicole.
- **The reduced-motion `aria-live` announcement fires on *both* code paths**, not just the
  reduced-motion one — `announce("reveal-announcer", "Your pick is ready.")` is called
  unconditionally at the end of the full-motion branch too, correctly satisfying motion-spec §9's
  "both exist regardless of motion preference" requirement. Easy to get this wrong; it isn't.
- **Error recovery is specific, not generic**: the "no confident match" state names exactly which
  answers are worth loosening ("Budget and travel are usually the easiest to loosen") and its
  "Adjust my answers" control jumps the user back near those specific questions rather than
  restarting the whole quiz — real COGA-aligned recovery, not a placeholder.
- **No text is ever painted over a generated illustration** — the top band the illustration spec
  reserves "for UI overlay" is left genuinely empty in the build, so the "contrast of text over
  SVG art" risk this review was asked to check for doesn't arise as a live surface at all. A good,
  simple structural choice that sidesteps a whole category of risk.
- **Progress indicator matches spec to the letter**: `role="progressbar"` with correct
  `aria-valuemin/max/now`, and `aria-valuetext="Step 1 of 5: Who's coming"` updating in lockstep
  with the visible "Step {{n}} of 5" text.
- **No keyboard traps found anywhere** tested (splash, full quiz, Chase filters, Nicole's List
  filters + row expand, Share action) — Tab/Shift+Tab always progresses, focus rings are visible
  at every stop tested.

---

## Compliance verdict

**Not yet WCAG 2.1 AA compliant as built** — one critical reflow failure (C1) and a cluster of
major issues (concentrated in quiz keyboard/focus handling and Nicole's List) need fixing before
this clears AA cleanly, though none require rethinking the architecture. The accessibility
*thinking* behind this build — the token system, the shape+label discipline, the honest-absence
patterns, the reduced-motion choreography's intent — is sound throughout; the gaps found here are
concentrated in exactly two places (quiz keyboard/focus wiring, Nicole's List) plus one systemic
contrast-verification gap (tokens checked against `bg.page` but used on `bg.tint`), which makes this
a scoped, fixable punch list rather than a redesign.
