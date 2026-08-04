# Ski Reco App — Motion Spec

_motion-designer · 2026-08-03 · Builds on `design/visual-system.md` (binding motion tokens and
constraints, §1.5/§7), `docs/designpowers/strategy.md`, the personas doc, and `design/copy-deck.md`.
For design-builder: implement directly from this — durations, easings, and stagger values below
are final, not illustrative._

---

## 0. Governing constraints (recap — these are not mine to override)

- **Banned system-wide:** spring/scale-overshoot easing, confetti/particle bursts, wiggle-on-tap,
  any animation whose primary purpose is celebration rather than feedback. The result reveal is
  **a settle, not a burst.**
- **Two binding easing curves from design-lead:**
  - `easing.standard` = `cubic-bezier(0.2, 0, 0, 1)` — confident decelerate, no overshoot. Used for
    state changes and anything entering that isn't the "big" settle moment.
  - `easing.entrance` = `cubic-bezier(0.16, 1, 0.3, 1)` — smooth settle, no spring. Used for the
    handful of moments that are the actual payoff of a screen (the card settling in, the headline,
    the illustration, the hot-take block).
- **One addition, flagged for design-lead sign-off:** neither binding curve is built for content
  *leaving* the screen (both decelerate; nothing accelerates). I'm adding `easing.exit =
  cubic-bezier(0.4, 0, 1, 1)` — a confident accelerate, same "no overshoot" philosophy, used only
  for outgoing quiz steps and toast dismissal. This is new — call it out at handoff review.
- **Durations (design-lead's tokens, unchanged):** `duration.instant`=100ms, `duration.fast`=160ms,
  `duration.base`=220ms, `duration.slow`=360ms. I don't introduce new duration values anywhere in
  this spec — every timing below is one of these four, or a stagger offset built from them.
- **GPU-composited only:** every animation below touches `opacity` and/or `transform`
  (`translate`/`scale`) exclusively, with two explicitly-flagged paint-only exceptions (tap-chip
  `box-shadow`/`background-color`, both called out with a performance note in §6.1).
- **`prefers-reduced-motion: reduce` is a first-class path, not a fallback.** Every section below
  ends with what the reduced version *is* — never just "disabled." A consolidated table is in §9.
- **No parallax, no large-scale zoom/spin, no continuous looping motion in the periphery.** The one
  bounded exception (loading shimmer, §4) is justified explicitly where it appears.

---

## 1. What deliberately gets no bespoke choreography

Per the brief: spend effort on the reveal, keep everything else quiet and functional. These get
**only** the universal micro-interactions in §6 (tap/focus feedback) and nothing more — no entrance
sequence, no scroll-triggered reveal, no bespoke transition:

- The mode-choice splash (two tap targets + Nicole's-list link) — a static screen, first paint.
- Nav switching between Plan / Chase / Nicole's List (top or bottom bar) — instant view swap, no
  transition; this is utility chrome, not a moment.
- Nicole's List table — rows render immediately; filter/sort chip taps get the standard tap-chip
  feedback (§6.1) and nothing else. It's a browse-and-trust surface, not a decide-fast one.
- The Range Readout's compact single-line variant in Chase-the-Snow rows — text-only, gets the same
  fade as any other list row (§6.3), no separate treatment.

---

## 2. The result reveal — "a settle, not a burst"

This is the emotional peak and the thing that gets screenshotted. It also has to resolve fast for
Jordan, mid-storm, cold hands, low patience. Total choreography stays inside 460–760ms depending on
which optional blocks the result has — never approaching the 1-second ceiling.

### 2.1 What draws the eye, in order, and why

1. **Container settle** — the whole card arrives as one object (opacity + 10px rise), establishing
   "here it is" before any content differentiates. This is the one place `duration.slow` (360ms) is
   used — it's the signature move, deserves the full token.
2. **Attribution mark** — near-instant, low-key. It's context, not payoff.
3. **Illustration** — the visual anchor. First thing that's actually *about* the resort.
4. **Headline** — the answer. Arrives right after the illustration establishes place, because "which
   resort" is the single most important fact on the card.
5. **Reason bullets** — quick 40ms micro-stagger, reveals the *why* right behind the *what*.
6. **Stat strip** — appears as one unit, no internal stagger (it's spec'd as "one continuous panel,"
   §2.5 of visual-system.md — staggering individual tiles would fight that reading).
7. **Range Readout** _(mixed/wide-mixed results only)_ — the bridge sweeps from floor to ceiling in
   one confident motion. This is the second-most information-dense moment on the card; it earns its
   own beat rather than fading in flat.
8. **Hot Take block** _(only if Nicole has one)_ — arrives distinctly after the data, reading as "a
   second voice layered on top of the facts," per Principle 2 (grounded data and her voice, never
   either alone — the sequencing itself reinforces that the data stands first, on its own).
9. **Footer CTA row** — last, lowest priority, arrives almost concurrently with the hot take since
   both are explicitly "additive, not load-bearing" per the crop-survival rule.

### 2.2 Timeline — standard result (no Range Readout, no Hot Take)

| Element | Start | Duration | Property | Easing |
|---|---|---|---|---|
| Card container | 0ms | 360ms | opacity 0→1, translateY 10px→0 | `entrance` |
| Attribution mark | 0ms | 160ms | opacity 0→1 | `standard` |
| Illustration panel | 40ms | 220ms | opacity 0→1, scale 0.97→1 | `entrance` |
| Headline | 80ms | 220ms | opacity 0→1, translateY 6px→0 | `entrance` |
| Reason bullet 1 | 120ms | 160ms | opacity 0→1, translateY 4px→0 | `standard` |
| Reason bullet 2 | 160ms | 160ms | " | `standard` |
| Reason bullet 3 | 200ms | 160ms | " | `standard` |
| Stat strip (one unit) | 240ms | 160ms | opacity 0→1 | `standard` |
| Footer CTA row | 300ms | 160ms | opacity 0→1 | `standard` |

**Ends ~460ms.**

### 2.3 Timeline — with Hot Take, no Range Readout

Same as above through the stat strip, then:

| Element | Start | Duration | Property | Easing |
|---|---|---|---|---|
| Hot Take block | 400ms | 220ms | opacity 0→1, translateY 8px→0 | `entrance` |
| Footer CTA row | 460ms | 160ms | opacity 0→1 | `standard` |

**Ends ~620ms.**

### 2.4 Timeline — mixed-ability result with Range Readout + Hot Take (richest case)

Same through stat strip (ends 400ms), then:

| Element | Start | Duration | Property | Easing |
|---|---|---|---|---|
| Range Readout bridge | 280ms | 220ms | `transform: scaleX(0→1)`, origin left | `standard` |
| Range Readout floor pin | 280ms | 120ms | opacity 0→1 | `standard` |
| Range Readout ceiling pin | 480ms | 120ms | opacity 0→1 (lands as sweep completes) | `standard` |
| Range Readout plain-language sentences | 320ms | 160ms | opacity 0→1 | `standard` |
| Hot Take block | 500ms | 220ms | opacity 0→1, translateY 8px→0 | `entrance` |
| Footer CTA row | 560ms | 160ms | opacity 0→1 | `standard` |

**Ends ~720ms** — deliberately the one place this spec brushes the top of the "complex choreography"
range, because it's the single richest content case (every optional block present at once). Still
well under the 1-second ceiling.

**Why the bridge sweeps rather than fades:** the sweep *is* the information. Before it, you don't
know the resort's floor-to-ceiling span; the growth from floor-pin to ceiling-pin shows the span
being established, once, confidently — not a bouncy fill. Full detail in §5.

### 2.5 Skip / short-circuit behaviour (non-negotiable for Jordan)

Any pointer, key, or scroll input during the reveal sequence immediately completes every in-flight
**and** not-yet-started animation to its final state. No animation ever blocks scrolling or tapping
— all card content is laid out in its final position from frame 1 (opacity/transform only, nothing
shifts layout), and `pointer-events` stay enabled throughout, so a fast tap on the CTA the instant
it exists still registers even mid-fade.

```js
function revealResultCard(card, { hasRangeReadout, hasHotTake }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anims = [];
  const el = (sel) => card.querySelector(sel);
  const push = (selector, keyframes, opts) => {
    const node = el(selector);
    if (!node) return;
    anims.push(node.animate(keyframes, opts));
  };

  if (reduceMotion) {
    card.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 160, easing: 'ease', fill: 'forwards',
    });
    announceReveal(); // aria-live "polite" — see §9
    return;
  }

  card.animate(
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
  );

  push('.attribution', [{ opacity: 0 }, { opacity: 1 }],
    { duration: 160, delay: 0, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
  push('.illustration',
    [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: 220, delay: 40, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
  push('.headline',
    [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 220, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });

  card.querySelectorAll('.reason-bullet').forEach((n, i) => {
    anims.push(n.animate(
      [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 160, delay: 120 + i * 40, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' },
    ));
  });

  push('.stat-strip', [{ opacity: 0 }, { opacity: 1 }],
    { duration: 160, delay: 240, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });

  let nextBlockStart = 300; // default: right after stat strip

  if (hasRangeReadout) {
    push('.range-bridge', [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: 220, delay: 280, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    push('.range-pin-floor', [{ opacity: 0 }, { opacity: 1 }],
      { duration: 120, delay: 280, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    push('.range-pin-ceiling', [{ opacity: 0 }, { opacity: 1 }],
      { duration: 120, delay: 480, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    push('.range-sentences', [{ opacity: 0 }, { opacity: 1 }],
      { duration: 160, delay: 320, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });
    nextBlockStart = 500;
  }

  if (hasHotTake) {
    push('.hot-take',
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, delay: nextBlockStart, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
    nextBlockStart += 60;
  }

  push('.footer-cta', [{ opacity: 0 }, { opacity: 1 }],
    { duration: 160, delay: nextBlockStart, easing: 'cubic-bezier(.2,0,0,1)', fill: 'both' });

  const skip = () => {
    anims.forEach((a) => a.finish());
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((evt) =>
      document.removeEventListener(evt, skip));
  };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((evt) =>
    document.addEventListener(evt, skip, { passive: true }));
}
```

### 2.6 Reduced motion

The whole card fades in as **one unit** — `opacity 0→1`, `duration.fast` (160ms), `ease`, no
stagger, no transform. To satisfy "must still perceive the reveal as an event" without motion, this
is paired with a non-visual cue: an `aria-live="polite"` announcer fires "Your pick is ready" the
moment the fade starts (see `announceReveal()` above, and the shared announcer element in §9). No
attempt is made to simulate "eventfulness" visually (no flash, no highlight sweep) — a second,
motion-only signal layered on top of a reduced-motion path would violate the spirit of the setting.

---

## 3. Quiz transitions

Marcus has wrist tendinitis; content-writer specified an explicit `Continue` control, not
auto-advance. The transition is **user-triggered** and must never feel like it's lagging behind the
tap — the visual transition starts synchronously inside the same tap handler, before any async state
update, so there is zero perceived latency between finger-lift and motion starting.

### 3.1 Step transition (Continue / Back)

Outgoing and incoming steps run **concurrently**, not sequentially — sequencing them would add
perceived lag on top of the network-free, purely local transition.

| Element | Direction | Duration | Property | Easing |
|---|---|---|---|---|
| Outgoing step (Continue tap) | forward | 160ms (`fast`) | opacity 1→0, translateX 0→−16px | `exit` |
| Incoming step (Continue tap) | forward | 200ms | opacity 0→1, translateX 16px→0 | `entrance` |
| Outgoing step (Back tap) | backward | 160ms | opacity 1→0, translateX 0→16px | `exit` |
| Incoming step (Back tap) | backward | 200ms | opacity 0→1, translateX −16px→0 | `entrance` |

16px is deliberately small — enough to read as "forward"/"backward" directionally, nowhere near
large-scale movement that could read as parallax or trigger vestibular discomfort.

```css
.quiz-step { will-change: transform, opacity; }

.quiz-step--out-forward  { animation: qs-out-fwd 160ms cubic-bezier(.4,0,1,1) both; }
.quiz-step--in-forward   { animation: qs-in-fwd  200ms cubic-bezier(.16,1,.3,1) both; }
.quiz-step--out-backward { animation: qs-out-bwd 160ms cubic-bezier(.4,0,1,1) both; }
.quiz-step--in-backward  { animation: qs-in-bwd  200ms cubic-bezier(.16,1,.3,1) both; }

@keyframes qs-out-fwd { to   { opacity: 0; transform: translateX(-16px); } }
@keyframes qs-in-fwd  { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
@keyframes qs-out-bwd { to   { opacity: 0; transform: translateX(16px); } }
@keyframes qs-in-bwd  { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }

@media (prefers-reduced-motion: reduce) {
  .quiz-step--out-forward, .quiz-step--out-backward { animation: qs-fade-out 160ms ease both; }
  .quiz-step--in-forward,  .quiz-step--in-backward   { animation: qs-fade-in  160ms ease both; }
  @keyframes qs-fade-out { to   { opacity: 0; } }
  @keyframes qs-fade-in  { from { opacity: 0; } to { opacity: 1; } }
}
```

**Reduced motion:** the directional slide is removed entirely — pure opacity crossfade, both
directions identical (160ms, `fast`). Direction of travel is still perceivable because the progress
indicator (below) still updates and the step number/copy still changes — motion was never the sole
carrier of "forward vs. back."

### 3.2 Progress indicator fill

Each of the five segments fills via `scaleX`, never `width` (which would trigger layout):

```css
.progress-segment__fill {
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 160ms cubic-bezier(.2,0,0,1);
}
.progress-segment--complete .progress-segment__fill,
.progress-segment--current .progress-segment__fill { transform: scaleX(1); }

.progress-segment__marker-dot { opacity: 0; transition: opacity 160ms cubic-bezier(.2,0,0,1); }
.progress-segment--current .progress-segment__marker-dot { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .progress-segment__fill,
  .progress-segment__marker-dot { transition: none; }
}
```

**Reduced motion:** the fill snaps instantly instead of sweeping — still fully legible (paired with
the "Step {{n}} of 5" text label per visual-system.md §2.2, so the fill is reinforcement, never the
sole signal).

### 3.3 Tap feedback on Continue / Back / tap-chips inside the quiz

Covered once, centrally, in §6.1 — the same tap-chip feedback recipe applies everywhere it appears,
including inside the quiz.

---

## 4. Loading states — the NOAA forecast fetch

A real network call, unknown latency, real chance of failure. Three states, with defined
escalation points, plus the fallback-disclosure transition — which has to read as an honest
disclosure, not a glitch.

### 4.1 State machine and timing

| Time since request sent | State | What's shown |
|---|---|---|
| 0–300ms | *(nothing yet)* | No loading UI at all — avoids a one-frame flash of a loader for a fast response |
| 300ms–4000ms | Loading | Skeleton rows (Chase list) or centered loading glyph + `loading.forecast` / `loading.chase` copy |
| 4000ms+ (still pending) | Loading, escalated | Same skeleton, plus a second line fades in below it (see §4.4 — new copy, flagged) |
| 10000ms (hard timeout) or explicit fetch failure | Fallback | Historical data renders, with the freshness badge visibly switched (§4.3) |
| Any point, success | Resolved | Skeleton is removed, live list renders with `chase.freshness.live` |

The 300ms pre-loader delay and the 4000ms escalation threshold are standard perceived-latency
thresholds (sub-300ms reads as instant; past ~4s a user needs reassurance the app hasn't stalled) —
neither is a design-system token, both are implementation constants design-builder can tune, not
motion values.

### 4.2 Loading skeleton (bounded loop — not decorative)

```css
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--bg-tint);
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
  animation: skeleton-sweep 1400ms linear infinite;
}
@keyframes skeleton-sweep { to { transform: translateX(100%); } }

@media (prefers-reduced-motion: reduce) {
  .skeleton::after { animation: none; display: none; }
}
```

**Why a looping animation is acceptable here** despite the "no continuous looping" rule: this loop
is functionally bounded, not decorative — it always terminates within 10 seconds (success or
fallback), it's removed from the DOM the instant either resolves, and it's the literal indicator of
an ongoing process, the one explicit exception the duration-discipline rule carves out. It never
runs indefinitely and never sits in the periphery while a user does something else on the same
screen — it's the whole screen's content at that moment.

**Reduced motion:** the shimmer sweep is removed; a flat, static muted-fill skeleton block remains,
with the loading text as the sole indicator of ongoing activity (which is not itself motion, so it's
fully compliant, and is already paired with an `aria-live` region — see §9).

### 4.3 The fallback disclosure — must read as honest, not broken

When the live fetch fails or times out, the transition has one job: make the user **notice** the
data source changed, without it looking like an error state or a glitch.

- The loading skeleton fades out (`opacity 1→0`, `duration.base`/220ms, `standard`).
- The list renders **already correctly labeled** — the `fallback.forecast.badge` ("Not a live
  forecast") is visible in the first frame the list appears in, never added as an afterthought a
  beat later. A disclosure that appears to bolt on after the fact reads as a bug notice; one that's
  simply true from the first frame reads as a fact about the data.
- To make the *change itself* perceptible (not just the end state, in case a user was already
  watching the loading screen), the freshness indicator does a one-time icon crossfade — a small
  "live" glyph fades out as a "typical season / historical" glyph fades in, 200ms, `opacity` only,
  no flash, no red, no shake:

```js
function revealFallbackBadge(badgeEl, iconLiveEl, iconHistoricalEl) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const iconDur = reduce ? 0 : 200;
  iconLiveEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: iconDur, easing: 'ease', fill: 'forwards' });
  iconHistoricalEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: iconDur, easing: 'ease', fill: 'forwards' });
  badgeEl.animate([{ opacity: 0 }, { opacity: 1 }],
    { duration: reduce ? 160 : 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });

  const live = document.getElementById('forecast-status-announcer');
  if (live) {
    live.textContent =
      'Forecast data unavailable — showing typical season snowfall instead of this week’s forecast.';
  }
}
```

**No alarm treatment anywhere in this transition** — no red flash, no shake, no pulsing. The honesty
is carried by the copy and the icon swap being visible and permanent, not by making it feel like a
failure. This matches the copy deck's own instruction: no apology, matter-of-fact tone.

**Reduced motion:** icon swap and badge both become an instant/near-instant opacity crossfade
(0–160ms), no separate treatment — the `aria-live` announcement (above) is what actually carries the
disclosure for a reduced-motion or screen-reader user, so nothing is lost by removing the visual
emphasis.

### 4.4 Escalation copy — flagged gap, not yet in the copy deck

`copy-deck.md` doesn't have a "this is taking a while" string. Proposing one for content-writer to
ratify, matching the deck's existing register (matter-of-fact, no apology):

> `loading.chase.slow` — "Still checking — the forecast service is being slow today."

It fades in below the existing loading text at the 4000ms mark: `opacity 0→1`, `duration.base`
(220ms), `standard`. It never replaces the original loading copy — it's additive, so a user who
glances back and forth isn't confused by copy changing under them.

---

## 5. Range Readout motion

Job: make the min-max "worse of floor and ceiling" logic *visible*, not just computed — and expose
honestly where a resort doesn't hold up at one end, without treating that as a defect to dramatize.

### 5.1 The bridge sweep

- `transform: scaleX(0 → 1)`, `transform-origin: left` (the floor end — floor is scored/labeled
  first in copy-deck's own order, and reading left-to-right along the difficulty spectrum, floor is
  the leftmost point).
- **220ms, `easing.standard`.** One confident, continuous sweep across the full floor-to-ceiling
  span — including whatever mix of solid and dashed/desaturated segments it contains. The solid and
  weak-dashed portions of the bridge are one shape with two paint treatments, not two separately
  animated pieces — they grow together in the same motion, so the sweep never looks like it's
  "deciding" anything as it plays.
- **Floor pin** (filled circle) fades in — `opacity 0→1`, 120ms, `standard` — at the same moment the
  sweep starts, establishing the anchor first.
- **Ceiling pin** (filled diamond) fades in — same treatment — timed to land as the sweep visually
  completes, so the pin appears to mark exactly where the bridge stops growing.
- **The two plain-language sentences below** (always present, never graphic-only) fade in
  concurrently with the sweep start (`opacity 0→1`, 160ms, `standard`) rather than waiting for the
  sweep to finish — they're the redundant, load-bearing information carrier and must never feel
  gated behind a graphic animation. A user who triggers the reveal-skip (§2.5) gets the sentences
  instantly, same as everything else.

### 5.2 No motion differentiates strong vs. weak — on purpose

Whether the bridge ends up mostly solid (both ends strong) or half-dashed-and-flagged (a genuine
bottleneck), **the animation itself is identical** — same sweep, same duration, same easing. The
"bad news" (weak end) is carried entirely by static, always-visible signals: the dashed/desaturated
render, the warning glyph, and the specific sentence text. No shake, no alarm color pulse, no
different timing for a weak result. This matters for two reasons: (1) motion is never the sole
carrier of meaning here — a reduced-motion or colorblind user gets the same facts a sighted,
full-motion user does; (2) design-lead's honesty framing (never "compromise," never "settle") would
be undermined by an animation that visually punished a weak floor with extra emphasis it doesn't get
when the floor is strong.

```css
.range-bridge {
  transform: scaleX(0);
  transform-origin: left;
}
.range-bridge.is-revealed {
  transition: transform 220ms cubic-bezier(.2,0,0,1);
  transform: scaleX(1);
}
.range-pin { opacity: 0; transition: opacity 120ms cubic-bezier(.2,0,0,1); }
.range-pin.is-revealed { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .range-bridge, .range-pin { transition: none; }
}
```

### 5.3 Reduced motion

The bridge, both pins, and the sentences all appear **instantly at full/final state**, and the whole
Range Readout component fades in as one unit — `opacity 0→1`, `duration.fast` (160ms) — inside the
result card's reduced-motion crossfade (§2.6). Nothing about the solid/dashed distinction, the
glyphs, or the sentence text depends on the sweep to be understood — the reduced path loses only the
"growing" visual metaphor, never the information.

### 5.4 Compact single-line variant (Chase-the-Snow list)

No graphic, so no bespoke motion — it's plain text and gets the same treatment as any other list row
entry (§6.3): fade + 8px rise on first load, part of the row's own stagger group, nothing separate.

---

## 6. Micro-interactions

### 6.1 Tap-chip selection (the workhorse — used everywhere: quiz options, filter chips, region grid)

Design-lead's own handoff note: the five redundant static signals already exist (border, fill,
indicator shape, icon, weight) — the job here is making the *transition between states* feel crisp,
not adding a new signal.

All properties transition **concurrently**, as one atomic 160ms state change, `easing.standard`:

```css
.tap-chip {
  transition:
    box-shadow 160ms cubic-bezier(.2,0,0,1),
    background-color 160ms cubic-bezier(.2,0,0,1);
}
.tap-chip--selected {
  /* box-shadow, not border-width, so the "border thickening" never triggers layout/reflow */
  box-shadow: inset 0 0 0 2px var(--brand-primary);
  background-color: color-mix(in srgb, var(--brand-primary) 10%, var(--bg-surface));
}
.tap-chip__indicator-icon {
  opacity: 0;
  transition: opacity 160ms cubic-bezier(.2,0,0,1);
}
.tap-chip--selected .tap-chip__indicator-icon { opacity: 1; }

/* Font-weight is a hard swap, not a transition — weight interpolation isn't reliably
   animatable cross-browser, and design-lead's spec treats it as one of five discrete
   redundant signals, not something that needs to visibly "ease in." */
.tap-chip__label { font-weight: 400; }
.tap-chip--selected .tap-chip__label { font-weight: 600; }

@media (prefers-reduced-motion: reduce) {
  /* box-shadow / background-color are paint properties, not transform/scale/parallax —
     but to stay strictly inside "only opacity cross-fades remain," they become instant
     (0ms) under reduced motion; only the icon keeps its opacity fade. */
  .tap-chip { transition: none; }
  .tap-chip__indicator-icon { transition: opacity 160ms ease; }
}
```

**Performance note for design-builder:** `box-shadow` and `background-color` are paint-only, not
compositor-only like `transform`/`opacity` — flagged deliberately here since it's the one place this
spec doesn't use pure GPU-composited properties. At 160ms on a single small element (a chip, not a
full-screen surface) this is standard, cheap, and safe on mid-range devices; it is **not** a pattern
to extend to larger surfaces (do not do this for the result card container, for instance — that one
stays `opacity`/`transform` only, per §2).

**No scale on tap or hover, anywhere.** Matches visual-system.md §2.1 exactly ("Hover... No scale
change" / "Selection feedback is a state change... not a gesture") — extended here to the Continue/
Back buttons and every other tappable surface for consistency, so nothing in the app reads as
"pressable-and-springy" versus "pressable-and-flat" inconsistently.

### 6.2 Focus movement

```css
:focus-visible {
  outline: none;
  transition: box-shadow 100ms cubic-bezier(.2,0,0,1);
  box-shadow: 0 0 0 2px var(--bg-page), 0 0 0 5px var(--brand-primary);
}
```

`duration.instant` (100ms), no movement — the ring appears/disappears in place on whatever element
currently has focus. Nothing slides or trails between elements during fast keyboard navigation;
each new focus target gets its own instant ring, independent of the previous one. This is exempt
from any further reduced-motion treatment — it's already non-directional and at the shortest token
duration.

### 6.3 List entry — Chase-the-Snow ranked rows

**Initial load:** rows stagger in reading order (rank 1 first), revealing the hierarchy the ranking
itself represents. Capped at 5 staggered items per the duration-discipline guidance — a long list
never produces an increasingly slow cascade:

```js
function revealListRows(rows) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  rows.forEach((row, i) => {
    if (reduce) {
      row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease', fill: 'both' });
      return;
    }
    const staggerIndex = Math.min(i, 5); // rows past the 5th arrive together with the 5th
    row.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 160, delay: staggerIndex * 50, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' },
    );
  });
}
```

**Re-render on filter toggle** ("Include beginner-friendly options" flips): a repeated user action,
not a first-impression moment — a full re-stagger here would feel slow and precious on repeat use.
Flat crossfade instead, no stagger, no translateY:

```js
function refreshListRows(rows) {
  rows.forEach((row) =>
    row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease', fill: 'both' }));
}
```

**Two-tier Canada divider:** gets no separate emphasis treatment — it's part of the same initial
list-load stagger as any other row, appearing in its natural document position. The banner's visual
weight (full-width, its own icon, its own heading) already makes it unmissable per visual-system.md
§2.7; adding motion emphasis on top would risk reading as an alarm, which the Canada disclosure
explicitly should not (same "absence is honest, not broken" principle as §4.3's fallback badge).

**Reduced motion:** every row (initial load and re-render alike) uses a flat opacity fade only, no
stagger delay, no translateY — `duration.fast` (160ms).

### 6.4 Share action

```css
.toast {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 220ms cubic-bezier(.16,1,.3,1),
    transform 220ms cubic-bezier(.16,1,.3,1);
}
.toast--visible { opacity: 1; transform: translateY(0); }
.toast--dismissing {
  transition: opacity 160ms cubic-bezier(.4,0,1,1);
  opacity: 0;
  transform: none; /* no reverse-slide on exit — just fades away */
}

@media (prefers-reduced-motion: reduce) {
  .toast, .toast--dismissing {
    transition: opacity 160ms ease;
    transform: none !important;
  }
}
```

Flow: tap → instant fill-state change on the button itself (`duration.instant`, 100ms, same
non-scale press treatment as §6.1) → toast enters (220ms, `entrance`) → holds ~2000ms (not a motion
value, an implementation constant) → dismisses via opacity-only fade (160ms, `exit`). One-shot,
auto-dismissing — not a loop, no user-attention cost beyond the single confirmation it exists to
give.

---

## 7. Performance annotations — summary

| Category | Properties animated | Compositor-only? |
|---|---|---|
| Result reveal (all elements) | `opacity`, `transform: translateY/scale` | Yes |
| Range Readout bridge/pins | `opacity`, `transform: scaleX` | Yes |
| Quiz step transitions | `opacity`, `transform: translateX` | Yes |
| Progress segment fill | `transform: scaleX` | Yes |
| Focus ring | `box-shadow` | Paint-only, single small element, 100ms — negligible |
| Tap-chip selection | `box-shadow`, `background-color` | Paint-only, single small element, 160ms — negligible (flagged §6.1) |
| List row entry / toast | `opacity`, `transform: translateY` | Yes |
| Loading skeleton shimmer | `transform: translateX` on a pseudo-element | Yes |

**Never animated anywhere in this spec:** `width`, `height`, `top`, `left`, `border-width` directly
(the one visual "border thickening" is done via `box-shadow` instead, see §6.1), or any property
that would trigger layout/reflow. `will-change` should be scoped to the class that's actively
animating (e.g., `.quiz-step`, `.skeleton`) and not applied as a permanent, app-wide default — mid-
range phones pay a real memory cost for standing `will-change` layers that never get released.

---

## 8. Nothing here triggers vestibular discomfort

- No parallax anywhere (illustration panel scales 3% max, never moves position; result card rises
  10px, quiz steps translate 16px — all well below any threshold that reads as spatial movement).
- No zoom beyond the illustration's 3% entrance scale (0.97→1) — nowhere close to a "zoom" effect.
- No spin, no rotation, anywhere in this spec.
- The one continuous loop (loading shimmer, §4.2) is bounded, terminates automatically, occupies the
  full attention of the screen it's on (never runs in the periphery while a user reads something
  else), and has a reduced-motion path that removes it entirely.

---

## 9. Reduced motion — consolidated reference

| Animation | Standard | Reduced-motion alternative | Info preserved via |
|---|---|---|---|
| Result reveal | Staggered 9-element sequence, 460–720ms | Single `opacity` crossfade, 160ms, whole card | `aria-live="polite"` announces "Your pick is ready" |
| Quiz step transition | Directional slide + fade, 160–200ms | Flat opacity crossfade, 160ms both directions | Step number/copy text change; progress fill still updates |
| Progress segment fill | `scaleX` sweep, 160ms | Instant snap, no transition | "Step {{n}} of 5" text label (always present) |
| Tap-chip selection | Concurrent box-shadow/bg/icon transition, 160ms | box-shadow/bg instant; icon opacity fade kept, 160ms | 5 static redundant signals unaffected either way |
| Focus ring | Instant box-shadow, 100ms | Unchanged (already non-directional, shortest token) | — |
| Loading skeleton | Shimmer sweep loop, 1400ms/cycle | Static muted-fill block, no animation | Loading text + `aria-live` region |
| Escalation message | Opacity fade-in, 220ms | Opacity fade-in, 160ms (kept — content, not decoration) | Text itself |
| Fallback disclosure (live→historical) | Icon crossfade 200ms + badge fade 220ms | Instant/near-instant opacity swap, ≤160ms | `aria-live` announces the data-source change explicitly |
| Range Readout bridge sweep | `scaleX` growth, 220ms | Appears instantly at full length | Solid/dashed render + warning glyph + sentences, all static |
| List row entry (initial) | 50ms-staggered fade+rise, capped at 5 | Flat opacity fade, no stagger, 160ms | Rank number, position in DOM order |
| List row refresh (filter toggle) | Flat crossfade, 160ms | Same (already the "calm" version) | — |
| Share toast | Fade+rise in (220ms), fade out (160ms) | Opacity-only both ways, same durations | Toast text itself |

**Shared announcer elements** (visually hidden, `aria-live="polite"`) referenced above:
- `#reveal-announcer` — "Your pick is ready."
- `#forecast-status-announcer` — carries the fallback-disclosure message (§4.3).

Both exist regardless of motion preference — they're the mechanism that keeps information parity
between the full-motion and reduced-motion paths, not a reduced-motion-only addition.

---

## 10. Open items for accessibility-reviewer

- **Escalation copy is new, not yet in `copy-deck.md`** — `loading.chase.slow`, proposed in §4.4.
  Needs content-writer's sign-off on tone/wording before design-builder ships it.
- **`easing.exit` is a new token**, not present in design-lead's original motion tokens (§0). It
  follows the same "confident, no overshoot" philosophy as the two existing curves, but design-lead
  should ratify it before it's treated as part of the permanent system.
- **The Range Readout bridge sweep** is the one genuinely novel motion in this spec (matching the
  component itself being novel, per design-lead's open question in `design-state.md`) — worth
  including in the synthetic-user-testing pass against Marcus that's already flagged for the
  component generally: does the sweep read as "here's your group's span" on first viewing, or does
  it need a caption/label to land without narration?
- **Vestibular check requested specifically on:** the fallback-disclosure icon crossfade (§4.3) —
  I'm confident it's safe (200ms opacity swap, no movement) but it's the one place motion is used to
  make a *change in trustworthiness of data* legible, which is a slightly different job than the
  rest of this spec, and deserves a second set of eyes.
