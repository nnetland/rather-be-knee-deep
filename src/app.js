// ---------------------------------------------------------------------------
// App shell: routing, quiz state machine, rendering, reveal choreography,
// sharing. No build step, no framework — plain DOM.
//
// State lives entirely in JS module-level variables (no localStorage /
// sessionStorage — unavailable in the target environment per the build
// brief). This is a deliberate, documented substitution for
// strategy.md §1.3's sessionStorage note and §3.3's localStorage
// anti-repetition note — see build-notes.md.
// ---------------------------------------------------------------------------

const RESORTS_BY_ID = Object.fromEntries(RESORTS.map((r) => [r.id, r]));

const state = {
  route: "splash",
  routeParams: {},
  quizAnswers: {},          // persists across nav within this page session
  quizStepIdx: 0,
  chaseAnswers: { region: null, includeBeginnerFriendly: false },
  chaseCache: null,         // { forecasts, anyFallback } once resolved
  chaseLoadHandle: null,    // { skip() } while a forecast fetch is in flight
  nicolesFilters: { region: "all", sort: "region" },
  // Quiver Check: a two-step picker (resort -> day) plus its own forecast
  // cache, kept separate from chaseCache because the two modes want
  // different shapes of the same data — Chase needs one 7-day total for
  // every US resort, Quiver needs seven per-day rows for exactly one.
  quiver: { step: "resort", resortId: null, dateKey: null, search: "" },
  quiverForecast: null,     // { resortId, status, days, timeZone, isLive }
};

const COST_LABEL = { "$": "budget-conscious", "$$": "mid-range", "$$$": "splurge-friendly", "$$$$": "money's no object" };
const CROWD_COPY = { low: "Rarely crowded", moderate: "Can get busy", high: "Usually crowded", brutal: "Expect crowds, especially on powder days" };
const PASS_COPY = { Epic: "Epic pass", Ikon: "Ikon pass", "Mountain Collective": "Mountain Collective", Indy: "Indy pass", Independent: "Independent (no multi-resort pass)" };
const SCHOOL_COPY = { strong: "Highly rated", decent: "Solid", weak: "Limited — check details before booking" };
const ACTIVITIES_COPY = { strong: "Plenty to do beyond skiing", decent: "A few solid options beyond skiing", thin: "Not much beyond skiing — plan for that" };

// Fix 3 (synthetic-user-testing.md Major finding): `family_ski_school_basis`,
// `beginner_note`, and `character_note` are dataset prose fields written for
// Nicole's own research pass, not for a reader — a majority of them carry
// sourcing-confidence framing ("Editorial judgment:", "Sourced:", a leading
// "Confirmed NN%…"), a direct reference to the research spreadsheet itself
// ("…in this dataset"), or a raw crowd_level enum value inserted
// parenthetically instead of translated ("crowds (brutal)", when the Crowds
// field elsewhere on the same card already carries the friendly translation
// of that exact value). None of that belongs in front of a reader — Priya
// parses every word carefully as a non-native speaker, and Marcus needs a
// card he can screenshot to defend a pick to skeptical friends without one of
// its own sentences reading like an internal note left in by mistake.
// This is a render-time substitution pass, the same pattern SCHOOL_COPY/
// CROWD_COPY already use for other enum fields, applied at every call site
// that surfaces one of these fields — not a dataset edit, so it can't be
// silently reintroduced by a future data-entry pass that isn't as careful.
function sanitizeDatasetProse(text) {
  if (!text) return text;
  let s = text;
  // A leading internal sourcing-confidence label ("Editorial judgment:",
  // "Editorial judgment, tempered:", "Sourced:") is a note about *how* the
  // fact below it was gathered, not part of the fact itself.
  s = s.replace(/^Editorial judgment(?:,\s*tempered)?:\s*/i, "");
  s = s.replace(/^Sourced:\s*/i, "");
  // A leading "Confirmed NN%…" reads as a citation flag rather than a
  // sentence — the number is still real data without the word in front of it.
  s = s.replace(/^Confirmed\s+(?=\d)/i, "");
  // A direct reference to the research spreadsheet ("…in this dataset",
  // "…in this dataset's own tags") — the reader is looking at the app, not
  // the dataset behind it.
  s = s.replace(/\s+in (?:this|the) dataset(?:'s own tags)?\b/gi, "");
  // A raw crowd_level enum value inserted parenthetically — dropped rather
  // than left as an internal tag, since CROWD_COPY above already supplies
  // the friendly translation of the same value elsewhere on the same card.
  s = s.replace(/\s*\((?:brutal|high|moderate|low)\)/gi, "");
  s = s.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function pluralize(n, unit) { return `${n} ${unit}${n === 1 ? "" : "s"}`; }
function fmtNum(n) { return n == null ? null : n.toLocaleString("en-US"); }
function reduceMotion() { return matchMedia("(prefers-reduced-motion: reduce)").matches; }

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return decodeURIComponent(escape(atob(str)));
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
function navigate(route, params) {
  const previousRoute = state.route;
  state.route = route;
  state.routeParams = params || {};
  if (route === "quiver") {
    // Same resume rule the quiz uses below: bouncing out to Chase or
    // Nicole's List and back must not silently throw away a mountain the
    // user already picked, but arriving from the splash should start clean.
    const cameFromModeSwitch = previousRoute === "chase" || previousRoute === "nicoles" || previousRoute === "plan";
    if (!cameFromModeSwitch) {
      state.quiver = { step: "resort", resortId: null, dateKey: null, search: "" };
      state.quiverForecast = null;
    } else if (state.quiver.step === "result" && !state.quiver.dateKey) {
      state.quiver.step = state.quiver.resortId ? "day" : "resort";
    }
  }
  if (route === "plan") {
    // Only reset to the first step on a genuinely fresh entry (from the
    // splash screen, a completed result, etc). Jumping Chase/Nicole's List
    // -> Plan mid-quiz must resume at the step the user left, not restart
    // at Step 1 — the underlying answers were already retained, but the
    // visible step wasn't, which reads as "start over" even though nothing
    // was actually lost (heuristic-evaluation.md, H3/H6 major finding).
    const cameFromModeSwitch = previousRoute === "chase" || previousRoute === "nicoles";
    if (!cameFromModeSwitch) {
      state.quizStepIdx = 0;
    } else {
      const screens = getQuizScreens(state.quizAnswers);
      if (state.quizStepIdx >= screens.length) state.quizStepIdx = screens.length - 1;
      if (state.quizStepIdx < 0) state.quizStepIdx = 0;
    }
  }
  window.scrollTo(0, 0);
  syncHash();
  render();
}

// ---------------------------------------------------------------------------
// Quiz-progress persistence via URL hash (critical fix — see build-notes.md).
// localStorage/sessionStorage are unavailable in this environment, and a
// plain in-memory JS variable doesn't survive even a same-tab reload, which
// silently destroys a user's in-progress quiz with zero warning — directly
// breaking Priya's "stolen fifteen-minute windows" scenario. Serialising
// quiz state into the URL hash (distinct #quiz= prefix, never colliding with
// the #result= share-link format) means a reload — or sending the URL to
// yourself, or to someone else — resumes the exact same step and answers.
// ---------------------------------------------------------------------------
function syncQuizHash() {
  const hasAnyAnswer = Object.keys(state.quizAnswers).length > 0;
  if (!hasAnyAnswer) {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    return;
  }
  const payload = { v: 1, q: state.quizAnswers, i: state.quizStepIdx };
  history.replaceState(null, "", "#quiz=" + b64urlEncode(JSON.stringify(payload)));
}

function syncHash() {
  if (state.route === "result" && state.routeParams.shareToken) {
    history.replaceState(null, "", "#result=" + state.routeParams.shareToken);
  } else if (state.route === "plan") {
    syncQuizHash();
  } else if (state.route === "quiver") {
    // renderQuiverResult() writes #quiver= itself once it knows the resort
    // and day; the two picker steps have nothing shareable yet, so the URL
    // is cleared rather than left pointing at a stale call.
    if (state.quiver.step !== "result" && location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  } else {
    // Keep the URL tidy for other routes; result links and in-progress quiz
    // state are the only shareable, resumable states.
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }
}

let resumedQuizFromLink = false;
// Set by parseInitialRoute() when the page loads on a #quiver= share link, so
// the boot sequence in shell.html can kick off the forecast fetch the shared
// call needs before anything renders.
let quiverPendingPrefetch = null;

function parseInitialRoute() {
  const hash = location.hash || "";
  if (hash.startsWith("#result=")) {
    const token = hash.slice("#result=".length);
    try {
      const payload = JSON.parse(b64urlDecode(token));
      if (payload && payload.rid && RESORTS_BY_ID[payload.rid]) {
        state.route = "result";
        state.routeParams = { shared: payload, shareToken: token };
        return;
      }
    } catch (e) { /* fall through to splash on any malformed share link */ }
  }
  if (hash.startsWith("#quiver=")) {
    const token = hash.slice("#quiver=".length);
    try {
      const payload = JSON.parse(b64urlDecode(token));
      if (payload && payload.rid && RESORTS_BY_ID[payload.rid] && typeof payload.d === "string") {
        state.route = "quiver";
        state.quiver = { step: "result", resortId: payload.rid, dateKey: payload.d, search: "" };
        // Deliberately NOT restoring a frozen recommendation from the token
        // (unlike #result=, which does exactly that). A ski call is only
        // true while the forecast behind it is, so a shared link re-reads
        // the forecast on arrival — see app-quiver.js's sharing section.
        quiverPendingPrefetch = payload.rid;
        return;
      }
    } catch (e) { /* fall through to splash on any malformed quiver link */ }
  }
  if (hash.startsWith("#quiz=")) {
    const token = hash.slice("#quiz=".length);
    try {
      const payload = JSON.parse(b64urlDecode(token));
      if (payload && payload.q && typeof payload.q === "object") {
        state.route = "plan";
        state.quizAnswers = payload.q;
        const screens = getQuizScreens(state.quizAnswers);
        let idx = Number.isInteger(payload.i) ? payload.i : 0;
        if (idx >= screens.length) idx = screens.length - 1;
        if (idx < 0) idx = 0;
        state.quizStepIdx = idx;
        resumedQuizFromLink = true;
        return;
      }
    } catch (e) { /* fall through to splash on any malformed quiz link */ }
  }
  state.route = "splash";
}

// ---------------------------------------------------------------------------
// Root render
// ---------------------------------------------------------------------------
const mainEl = () => document.getElementById("app-main");

function render() {
  const main = mainEl();
  const chromeRoutes = ["plan", "chase", "quiver", "nicoles"];
  const showNav = chromeRoutes.includes(state.route);
  document.getElementById("bottom-nav").hidden = !showNav;
  document.getElementById("top-nav").hidden = !showNav;
  main.classList.toggle("no-bottom-nav", !showNav);
  updateNavCurrent();
  // Demo-snow banner. No-op (and hidden) whenever demo mode is off, which is
  // its state from November onward and its permanent state once demo.js is
  // removed. See demo.js.
  if (typeof syncDemoChrome === "function") syncDemoChrome();

  if (state.route === "splash") return renderSplash(main);
  if (state.route === "plan") return renderPlan(main);
  if (state.route === "chase") return renderChase(main);
  if (state.route === "quiver") return renderQuiver(main);
  if (state.route === "nicoles") return renderNicolesList(main);
  if (state.route === "result") return renderResult(main);
  renderSplash(main);
}

function updateNavCurrent() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    if (btn.dataset.route === state.route) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

function focusHeading(main) {
  const h = main.querySelector("h1, h2");
  if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

// ---------------------------------------------------------------------------
// Splash
// ---------------------------------------------------------------------------
function renderSplash(main) {
  main.innerHTML = `
    <div class="page-column">
      <div class="splash">
        <p class="splash-eyebrow body-md">Real ski recommendations from Nicole — pick a way in.</p>
        <div class="splash-modes">
          <button class="mode-card" id="mode-plan" type="button">
            <span class="mode-card__icon">${ICONS.mountain}</span>
            <span class="mode-card__label">Plan a trip</span>
            <span class="mode-card__support body-md">Answer 5 quick questions. Get one solid pick.</span>
          </button>
          <button class="mode-card" id="mode-chase" type="button">
            <span class="mode-card__icon">${ICONS.snow}</span>
            <span class="mode-card__label">Chase the snow</span>
            <span class="mode-card__support body-md">See where it's dumping this week.</span>
          </button>
          <button class="mode-card" id="mode-quiver" type="button">
            <span class="mode-card__icon">${ICONS.skis}</span>
            <span class="mode-card__label">Quiver Check</span>
            <span class="mode-card__support body-md">Already know where you're going? Find out which skis to bring.</span>
          </button>
        </div>
        <p class="splash-footer">
          <button class="btn-text" id="mode-nicoles" type="button">See everywhere Nicole's actually skied</button>
        </p>
      </div>
    </div>`;
  document.getElementById("mode-plan").addEventListener("click", () => navigate("plan"));
  document.getElementById("mode-chase").addEventListener("click", () => navigate("chase"));
  document.getElementById("mode-quiver").addEventListener("click", () => navigate("quiver"));
  document.getElementById("mode-nicoles").addEventListener("click", () => navigate("nicoles"));
  document.title = "Find your next ski trip";
  setOgMeta({
    title: "Find your next ski trip",
    description: "Answer a few quick questions, or see where it's dumping this week — plus everywhere Nicole's actually skied.",
  });
}

// ---------------------------------------------------------------------------
// Plan a trip — quiz
// ---------------------------------------------------------------------------
function getQuizScreens(answers) {
  const screens = [
    { key: "q1", topic: 1, topicLabel: "Who's coming" },
    { key: "q2a", topic: 2, topicLabel: "Skill level" },
    { key: "q2b", topic: 2, topicLabel: "Terrain" },
    { key: "q3", topic: 3, topicLabel: "Budget" },
    { key: "q4a", topic: 4, topicLabel: "Travel" },
  ];
  if (answers.travelMode !== "unsure") screens.push({ key: "q4b", topic: 4, topicLabel: "Home region" });
  screens.push({ key: "q5", topic: 5, topicLabel: "Scene" });
  return screens;
}

const QUIZ_OPTIONS = {
  q1: [
    { value: "solo", label: "Just me" },
    { value: "matched", label: "We're all about the same level" },
    { value: "mixed", label: "A mix — some newer, some more experienced" },
    { value: "wide-mixed", label: "A wide mix — first-timers to experts" },
  ],
  q2a: [
    { value: "never-skied", label: "Never skied before" },
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
    { value: "expert", label: "Expert" },
  ],
  q2b: [
    { value: "groomers", label: "Smooth, groomed trails" },
    { value: "mix", label: "A mix of everything" },
    { value: "steep", label: "Steep and challenging" },
    { value: "noPreference", label: "Doesn't matter, just here to ski" },
  ],
  q3: [
    { value: "$", label: "Budget-conscious ($)" },
    { value: "$$", label: "Mid-range ($$)" },
    { value: "$$$", label: "Splurge-friendly ($$$)" },
    { value: "$$$$", label: "Money's no object ($$$$)" },
  ],
  q4a: [
    { value: "driving", label: "Driving" },
    { value: "flying", label: "Flying" },
    { value: "unsure", label: "Not sure yet — show me both" },
  ],
  q5: [
    { value: "lively", label: "Buzzing nightlife and bars" },
    { value: "chill", label: "Chill and low-key" },
    { value: "family", label: "Family-friendly, not too wild" },
    { value: "noPreference", label: "Doesn't matter, just here to ski" },
  ],
};

function renderPlan(main) {
  main.innerHTML = `<div class="page-column"><div id="quiz-step-container" class="quiz-step-container"></div></div>`;
  renderQuizStep(null);
  // Focus fix (synthetic-user-testing.md Major finding): renderQuizStep(null)
  // is called with no `direction` on this very first render, so neither of
  // its own two focus branches fires (direction is falsy, and there's no
  // tapped chip to return focus to yet) — a keyboard/screen-reader user
  // tapping "Plan a trip" from the splash landed with focus still on
  // <body>, silently. Every subsequent step-to-step transition passes a real
  // `direction` and already focuses the heading correctly (the M1 fix from
  // the previous round only touched the in-place re-render-after-a-tap case,
  // not this one) — this is the one call site that still needed it, handled
  // the same way every other route's first render already does.
  focusHeading(main);
}

function currentQuizScreen() {
  const screens = getQuizScreens(state.quizAnswers);
  if (state.quizStepIdx >= screens.length) state.quizStepIdx = screens.length - 1;
  return { screens, screen: screens[state.quizStepIdx] };
}

function quizStepHtml(screen) {
  const a = state.quizAnswers;
  const { screens } = currentQuizScreen();
  const topicIdx = screen.topic;

  let title, helper = "", body;

  if (screen.key === "q1") {
    title = "Who's coming, and is everyone about the same level?";
    body = optionListHtml("q1", QUIZ_OPTIONS.q1, a.groupType, false);
  } else if (screen.key === "q2a") {
    const multi = a.groupType === "mixed" || a.groupType === "wide-mixed";
    title = multi ? "Tap every skill level in your group" : "What's your level?";
    if (multi) helper = "Select as many as apply.";
    // Bug fix (heuristic-evaluation.md, H3/H6 major): the single-select
    // variant was always passed the raw `a.skillLevels` ARRAY as the
    // "selected value" to compare against each option's string value —
    // `selectedValue === o.value` is never true when selectedValue is an
    // array, so Back never visually restored the answer even though the
    // data was retained. Multi-select needs the array (for .has() lookups);
    // single-select needs the single stored value.
    body = optionListHtml("q2a", QUIZ_OPTIONS.q2a, multi ? (a.skillLevels || []) : (a.skillLevels && a.skillLevels[0]) || null, multi);
  } else if (screen.key === "q2b") {
    title = "What terrain are you hoping for?";
    body = optionListHtml("q2b", QUIZ_OPTIONS.q2b, a.terrain, false);
  } else if (screen.key === "q3") {
    title = "What's the budget like?";
    body = optionListHtml("q3", QUIZ_OPTIONS.q3, a.budget, false);
  } else if (screen.key === "q4a") {
    title = "Driving or flying?";
    body = optionListHtml("q4a", QUIZ_OPTIONS.q4a, a.travelMode, false);
  } else if (screen.key === "q4b") {
    title = "Which is closest to home?";
    body = radioGroupHtml("region-grid", "q4b", REGIONS.map((r) => ({ value: r.id, label: r.label })), a.region);
  } else if (screen.key === "q5") {
    title = "What's the scene you want?";
    body = optionListHtml("q5", QUIZ_OPTIONS.q5, a.vibe, false);
  }

  const canGoBack = state.quizStepIdx > 0;
  const isLast = state.quizStepIdx === screens.length - 1;
  const hasAnswer = quizScreenHasAnswer(screen.key);

  return `
    <div class="quiz-card">
      <div class="progress-wrap" role="progressbar" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${topicIdx}"
           aria-valuetext="Step ${topicIdx} of 5: ${escapeHtml(screen.topicLabel)}">
        <span class="progress-label" aria-hidden="true">Step ${topicIdx} of 5</span>
        <span class="progress-track">
          ${[1,2,3,4,5].map((n) => `
            <span class="progress-segment ${n < topicIdx ? "progress-segment--complete" : n === topicIdx ? "progress-segment--current" : ""}">
              <span class="progress-segment__fill"></span>
              <span class="progress-segment__dot"></span>
            </span>`).join("")}
        </span>
      </div>
      <h2 class="display-h2 quiz-title" id="quiz-step-heading">${title}</h2>
      ${helper ? `<p class="quiz-helper body-sm">${helper}</p>` : ""}
      ${body}
      <div class="quiz-nav">
        <button class="btn-text" id="quiz-back" type="button" ${canGoBack ? "" : "disabled"}>Back</button>
        <button class="btn btn-primary" id="quiz-continue" type="button" ${hasAnswer ? "" : "disabled"}>Continue</button>
      </div>
      ${canGoBack ? `<p style="text-align:center;margin-top:var(--space-4)"><button class="btn-text" id="quiz-start-over" type="button">Start over</button></p>` : ""}
    </div>`;
}

function tapChipHtml(group, value, label, selected, multi, sublabel, tabbable) {
  const indicatorShape = multi ? "check" : "radio";
  // Roving tabindex for the single-select (role="radio") APG pattern (M2
  // fix): only the "tabbable" chip is in the Tab sequence; the rest are
  // reachable by Arrow keys once the group has focus. Multi-select
  // checkboxes are each independently focusable, per the standard checkbox
  // group pattern, so `tabbable` is left null/ignored for those.
  const tabindexAttr = multi ? "" : ` tabindex="${tabbable ? "0" : "-1"}"`;
  return `
    <button type="button" class="tap-chip ${selected ? "tap-chip--selected" : ""}"
      data-group="${group}" data-value="${escapeHtml(value)}" role="${multi ? "checkbox" : "radio"}" aria-checked="${selected}"${tabindexAttr}>
      <span class="tap-chip__indicator tap-chip__indicator--${indicatorShape}">${ICONS.check}</span>
      <span class="tap-chip__body">
        <span class="tap-chip__label">${label}</span>
        ${sublabel ? `<span class="tap-chip__sublabel">${sublabel}</span>` : ""}
      </span>
    </button>`;
}

// Single-select radiogroup markup (M2 fix): the ARIA APG radiogroup pattern
// — role="radiogroup" (not "group"), one accessible name via
// aria-labelledby, and roving tabindex so Tab lands on exactly one radio,
// with Arrow keys moving *and* selecting within the group (wired in
// wireQuizStepEvents below).
function radioGroupHtml(gridClass, group, options, selectedValue) {
  const tabbableValue = selectedValue != null ? selectedValue : (options[0] && options[0].value);
  return `<div class="${gridClass}" role="radiogroup" aria-labelledby="quiz-step-heading">` +
    options.map((o) => tapChipHtml(group, o.value, o.label, selectedValue === o.value, false, o.sublabel, o.value === tabbableValue)).join("") +
    `</div>`;
}

function optionListHtml(group, options, selectedValue, multi) {
  if (!multi) return radioGroupHtml("chip-grid chip-grid--2col", group, options, selectedValue);
  const selectedSet = new Set(selectedValue || []);
  return `<div class="chip-grid chip-grid--2col" role="group" aria-labelledby="quiz-step-heading">` +
    options.map((o) => tapChipHtml(group, o.value, o.label, selectedSet.has(o.value), true)).join("") +
    `</div>`;
}

function quizScreenHasAnswer(key) {
  const a = state.quizAnswers;
  if (key === "q1") return !!a.groupType;
  if (key === "q2a") return a.groupType === "mixed" || a.groupType === "wide-mixed" ? !!(a.skillLevels && a.skillLevels.length) : !!(a.skillLevels && a.skillLevels.length === 1);
  if (key === "q2b") return !!a.terrain;
  if (key === "q3") return !!a.budget;
  if (key === "q4a") return !!a.travelMode;
  if (key === "q4b") return !!a.region;
  if (key === "q5") return !!a.vibe;
  return false;
}

let pendingAutoAdvance = null;

function renderQuizStep(direction, focusValue) {
  const container = document.getElementById("quiz-step-container");
  const { screen } = currentQuizScreen();
  const html = quizStepHtml(screen);

  // Correctness fix found while testing under prefers-reduced-motion (which
  // this round's review asked to verify anyway): a ghost's `animationend`
  // can fail to fire promptly in some engines/timing conditions, leaving a
  // stale ghost in the container. `.quiz-step` alone then ambiguously
  // matches the ghost (first in DOM order) instead of the live step on the
  // next render, so the REAL live element never gets removed — it's
  // orphaned in place while a second, duplicate-id copy gets appended.
  // `.quiz-step--ghost` marks ghosts unambiguously so they're never
  // mistaken for the live step, and any stale ghost is force-removed here
  // rather than left to accumulate.
  container.querySelectorAll(".quiz-step--ghost").forEach((g) => g.remove());

  const oldEl = container.querySelector(".quiz-step:not(.quiz-step--ghost)");
  if (oldEl && direction) {
    const ghost = oldEl.cloneNode(true);
    // The ghost is purely decorative output during the transition — strip all
    // ids (and disable its controls) so it can never collide with the live
    // incoming step's ids or be reachable by keyboard/AT while it fades out.
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    ghost.setAttribute("aria-hidden", "true");
    ghost.classList.add("quiz-step--ghost");
    ghost.querySelectorAll("button, input, select, textarea, a").forEach((n) => { n.setAttribute("tabindex", "-1"); n.disabled = true; });
    ghost.style.position = "absolute";
    ghost.style.inset = "0";
    ghost.classList.add(direction === "forward" ? "quiz-step--out-forward" : "quiz-step--out-backward");
    container.style.position = "relative";
    container.appendChild(ghost);
    ghost.addEventListener("animationend", () => ghost.remove());
  }
  if (oldEl) oldEl.remove();

  const wrap = document.createElement("div");
  wrap.className = "quiz-step " + (direction === "backward" ? "quiz-step--in-backward" : direction ? "quiz-step--in-forward" : "");
  wrap.innerHTML = html;
  container.appendChild(wrap);

  wireQuizStepEvents(wrap, screen);
  syncQuizHash();

  // Focus handling (M1 fix): only jump focus to the step heading on a real
  // step transition. The in-place re-render after a same-step selection
  // (direction === null, from handleQuizSelect) must instead return focus
  // to the chip/checkbox the user just interacted with — previously this
  // unconditionally re-focused the <h2>, which re-announced the whole
  // question to a screen reader and dropped keyboard users back to the top
  // of the option list on *every single tap*, including both taps of a
  // multi-select step.
  if (direction) {
    const heading = wrap.querySelector("h2");
    if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }
  } else if (focusValue != null) {
    const chip = Array.from(wrap.querySelectorAll(".tap-chip")).find((c) => c.dataset.value === String(focusValue));
    if (chip) chip.focus({ preventScroll: true });
  }
}

// Arrow-key roving-tabindex handling for role="radiogroup" chip grids (M2
// fix, ARIA APG radiogroup pattern): moves focus AND selects the target
// radio, matching real <input type="radio"> / platform convention.
function wireRadiogroupKeyboard(wrap, screen) {
  wrap.querySelectorAll('[role="radiogroup"]').forEach((group) => {
    group.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const radios = Array.from(group.querySelectorAll('[role="radio"]'));
      if (!radios.length) return;
      const current = radios.indexOf(document.activeElement);
      let nextIdx;
      if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = radios.length - 1;
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIdx = current < 0 ? 0 : (current + 1) % radios.length;
      else nextIdx = current < 0 ? radios.length - 1 : (current - 1 + radios.length) % radios.length;
      e.preventDefault();
      const nextRadio = radios[nextIdx];
      radios.forEach((r) => r.setAttribute("tabindex", "-1"));
      nextRadio.setAttribute("tabindex", "0");
      nextRadio.focus();
      // Arrow-key movement also sets the selection, per the platform radio
      // convention — but this is a keyboard action, so it must never
      // trigger the pointer-only auto-advance (evt omitted -> not pointer).
      handleQuizSelect(screen.key, nextRadio.dataset.value, null);
    });
  });
}

function wireQuizStepEvents(wrap, screen) {
  wrap.querySelectorAll(".tap-chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (pendingAutoAdvance) { clearTimeout(pendingAutoAdvance); pendingAutoAdvance = null; }
      handleQuizSelect(screen.key, chip.dataset.value, e);
    });
  });
  wireRadiogroupKeyboard(wrap, screen);
  // Correctness fix found while testing this round: none of the three nav
  // controls cancelled a pending pointer auto-advance timer, so a fast
  // explicit Continue tap right after a chip tap could leave the 420ms timer
  // alive — it would fire ~mid-transition and silently re-run quizGoNext()
  // (double-submitting on the last step, or double-advancing otherwise).
  // Same fix as chip taps already had: any explicit nav action cancels it.
  const clearPendingAutoAdvance = () => { if (pendingAutoAdvance) { clearTimeout(pendingAutoAdvance); pendingAutoAdvance = null; } };
  document.getElementById("quiz-back").addEventListener("click", () => { clearPendingAutoAdvance(); quizGoBack(); });
  document.getElementById("quiz-continue").addEventListener("click", () => { clearPendingAutoAdvance(); quizGoNext(); });
  const startOverBtn = document.getElementById("quiz-start-over");
  if (startOverBtn) startOverBtn.addEventListener("click", () => {
    clearPendingAutoAdvance();
    state.quizAnswers = {};
    state.quizStepIdx = 0;
    renderQuizStep("backward");
  });
}

function handleQuizSelect(key, value, evt) {
  const a = state.quizAnswers;
  const multi = key === "q2a" && (a.groupType === "mixed" || a.groupType === "wide-mixed");

  if (key === "q1") a.groupType = value;
  else if (key === "q2a") {
    if (multi) {
      a.skillLevels = a.skillLevels || [];
      const i = a.skillLevels.indexOf(value);
      if (i >= 0) a.skillLevels.splice(i, 1); else a.skillLevels.push(value);
    } else {
      a.skillLevels = [value];
    }
  }
  else if (key === "q2b") a.terrain = value;
  else if (key === "q3") a.budget = value;
  else if (key === "q4a") { a.travelMode = value; if (value === "unsure") a.region = null; }
  else if (key === "q4b") a.region = value;
  else if (key === "q5") a.vibe = value;

  renderQuizStep(null, value); // re-render in place to reflect selection state (no transition — same step), refocus the tapped chip

  // Sighted mouse/touch convenience: auto-advance shortly after a single-select
  // tap, cancelable by any further interaction — never the only path forward,
  // Continue stays keyboard-focusable and functional throughout (per
  // copy-deck.md's explicit-Continue-control requirement for Marcus/Nicole).
  const isPointer = evt && evt.detail !== 0 || evt && evt.pointerType;
  if (!multi && isPointer) {
    pendingAutoAdvance = setTimeout(() => { pendingAutoAdvance = null; quizGoNext(); }, 420);
  }
}

function quizGoNext() {
  const { screens } = currentQuizScreen();
  const screen = screens[state.quizStepIdx];
  if (!quizScreenHasAnswer(screen.key)) return;

  if (state.quizStepIdx === screens.length - 1) {
    submitQuiz();
    return;
  }
  state.quizStepIdx += 1;
  renderQuizStep("forward");
}

function quizGoBack() {
  if (state.quizStepIdx === 0) { navigate("splash"); return; }
  state.quizStepIdx -= 1;
  renderQuizStep("backward");
}

function submitQuiz() {
  const result = matchTrip(state.quizAnswers, RESORTS);
  if (!result) {
    renderNoMatch();
    return;
  }
  const payload = buildSharePayload(result, state.quizAnswers);
  navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true });
}

function renderNoMatch() {
  const main = mainEl();
  main.innerHTML = `
    <div class="page-column">
      <div class="center-state">
        ${ICONS.warning}
        <h2 class="display-h2">We couldn't find a confident match</h2>
        <p class="body-md">Nothing cleared the bar for every answer you gave. Budget and travel are usually the easiest to loosen.</p>
        <button class="btn btn-primary" id="adjust-answers" type="button">Adjust my answers</button>
      </div>
    </div>`;
  document.getElementById("adjust-answers").addEventListener("click", () => { state.quizStepIdx = Math.max(0, state.quizStepIdx - 2); navigate("plan"); });
  focusHeading(main);
}

// ---------------------------------------------------------------------------
// Share payload — encodes exactly what's needed to reproduce the same result
// card (same resort, same illustration, same reason) without re-running the
// matching engine's session-seeded tie-break on the receiving end.
// ---------------------------------------------------------------------------
function buildSharePayload(result, answers) {
  return {
    v: 1,
    rid: result.resort.id,
    reasonBullets: result.reasonBullets,
    showRangeReadout: result.showRangeReadout,
    range: result.showRangeReadout ? {
      floor: result.breakdown.terrain.floor,
      ceiling: result.breakdown.terrain.ceiling,
      floorScore: result.breakdown.terrain.floorScore,
      ceilingScore: result.breakdown.terrain.ceilingScore,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------
function statTile(label, value, unit, sublabel, isNull) {
  return `<div class="stat-tile">
    <span class="data-label">${label}</span>
    <span class="stat-tile__value ${isNull ? "stat-tile__value--null" : "data-stat"}">${isNull ? "—" : `${value}${unit ? `<span class="unit">${unit}</span>` : ""}`}</span>
    ${sublabel ? `<span class="stat-tile__sublabel">${sublabel}</span>` : ""}
  </div>`;
}
function textStatTile(label, value) {
  return `<div class="stat-tile"><span class="data-label">${label}</span><span class="stat-tile__value body-md">${value}</span></div>`;
}

// Ski-school evidence disclosure (heuristic-evaluation.md, H2/H6/H10 major
// finding): the rendered rating was a bare label ("Highly rated" / "Solid" /
// "Limited — check details before booking") with nothing behind it, even
// though every resort record carries a `family_ski_school_basis` field with
// real sourcing detail. Dana explicitly distrusts "a vague rating with
// nothing behind it," and the weak-tier copy invited her to "check details"
// without saying where. This surfaces that evidence in place, using the
// same expand-in-place disclosure pattern already used well elsewhere (the
// mixed-ability tier captions / Nicole's List hot-take preview) rather than
// sending her elsewhere to verify it.
let skiSchoolTileSeq = 0;

function buildStatStrip(resort) {
  let html = "";
  html += statTile("Vertical drop", fmtNum(resort.vertical_drop_ft), "ft", resort.vertical_drop_ft == null ? "Vertical drop not published by the resort" : "Top to bottom, in one run", resort.vertical_drop_ft == null);
  html += statTile("Skiable acres", fmtNum(resort.skiable_acres), "", resort.skiable_acres == null ? "Skiable acres not published by the resort" : null, resort.skiable_acres == null);
  html += statTile("Average snowfall", fmtNum(resort.avg_annual_snowfall_in), "in", resort.avg_annual_snowfall_in == null ? "Average snowfall not published by the resort" : "A typical season, not this week", resort.avg_annual_snowfall_in == null);
  html += `<div class="stat-tile"><span class="data-label">Cost</span><span class="stat-tile__value data-stat">${resort.cost_tier || "—"}</span></div>`;
  return html;
}

// Numeric terrain-mix tier — kept in the same "instrument" grid treatment as
// the headline stat strip (single-line value + caption, sized identically).
function buildTerrainMixStrip(resort) {
  let html = "";
  if (resort.terrain_pct) {
    html += statTile("Beginner terrain", resort.terrain_pct.beginner, "%", null, false);
    html += statTile("Intermediate terrain", resort.terrain_pct.intermediate, "%", null, false);
    html += statTile("Advanced &amp; expert", resort.terrain_pct.advanced_expert, "%", null, false);
  } else {
    html += statTile("Terrain mix", null, null, "Terrain breakdown not published by the resort", true);
  }
  return `<div class="stat-strip" id="terrain-strip" style="margin-top:var(--space-3)">${html}</div>`;
}

// Prose-length "notes" tier — Crowds/Pass/Ski school/Off the mountain (design
// -critic.md finding 4 fix). These used to sit in the same auto-fit grid as
// the numeric terrain tiles, which forced every cell in a row to match the
// height of whichever neighbor had the longest caption ("CROWDS — Usually
// crowded" next to "OFF THE MOUNTAIN — A few solid options beyond skiing"),
// produced a visible empty trailing cell on odd counts, and made the
// null-terrain case's long caption tower over its numeric neighbors. Prose
// doesn't need to resolve into a clean rectangle the way a grid does — a
// label/value list sizes each row from its own content only.
function notesRow(label, valueHtml) {
  return `<div class="notes-row"><dt class="data-label">${label}</dt><dd class="body-md">${valueHtml}</dd></div>`;
}
function skiSchoolNotesValue(resort) {
  const value = SCHOOL_COPY[resort.family_ski_school] || "Not published by the resort";
  const basis = sanitizeDatasetProse(resort.family_ski_school_basis);
  if (!basis) return escapeHtml(value);
  const id = `ski-school-basis-${skiSchoolTileSeq++}`;
  return `<button type="button" class="notes-row__expand-btn" aria-expanded="false" aria-controls="${id}">
      <span>${escapeHtml(value)}</span>
      <span class="stat-tile__expand-icon" aria-hidden="true">${ICONS.chevronDown}</span>
    </button>
    <div class="stat-tile__basis body-sm" id="${id}" hidden>${escapeHtml(basis)}</div>`;
}
function buildDetailNotes(resort) {
  return `<dl class="notes-list">
    ${notesRow("Crowds", escapeHtml(CROWD_COPY[resort.crowd_level] || "Not published by the resort"))}
    ${notesRow("Pass", escapeHtml(PASS_COPY[resort.pass_affiliation] || resort.pass_affiliation || "Not published by the resort"))}
    ${notesRow("Ski school", skiSchoolNotesValue(resort))}
    ${notesRow("Off the mountain", escapeHtml(ACTIVITIES_COPY[resort.non_ski_activities] || "Not published by the resort"))}
  </dl>`;
}

const LEVEL_TIER_LABEL = { strong: "A real strength", decent: "Solid — not the mountain's specialty, but you'll be fine" };
function tierForScore(score) { return score >= 7 ? "strong" : score >= 4.5 ? "decent" : "weak"; }
function shortCaveat(text, maxLen) {
  if (!text) return "limited terrain at this end";
  if (text.length <= maxLen) return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, "");
  const cut = text.slice(0, maxLen);
  return cut.slice(0, cut.lastIndexOf(" ")).charAt(0).toLowerCase() + cut.slice(1, cut.lastIndexOf(" ")) + "…";
}
// mixed.tier.weak (copy-deck §5): "The weaker end — {{specific caveat, data-bound}}"
function tierLabel(tier, dataBoundCaveat) {
  return tier === "weak" ? `The weaker end — ${shortCaveat(dataBoundCaveat, 70)}` : LEVEL_TIER_LABEL[tier];
}

// --- Expert-terrain assessment, built ONLY from terrain fields ------------
// Fix for the self-contradiction bug (Keystone showing "Experts: a real
// strength" directly above Nicole's Hot Take saying "no advanced terrain"):
// `character_note` is a general "one interesting fact" field (season length,
// night-skiing volume, trademark snow names, etc.) — it was never scoped as
// a terrain-difficulty field, so it must never be used to generate a claim
// about how well a resort serves experts. This function derives that claim
// only from terrain_pct.advanced_expert and best_for_tags — the fields that
// actually describe terrain — so it can never contradict a resort's real
// terrain data (or, by construction, Nicole's own read of that terrain).
const EXPERT_TAG_LABEL = {
  "steeps": "steep terrain",
  "tree-skiing": "tree skiing",
  "deep-powder": "deep powder",
  "big-vert": "big vertical",
  "backcountry-access": "backcountry access",
};
const EXPERT_TAGS_ORDER = ["steeps", "tree-skiing", "deep-powder", "big-vert", "backcountry-access"];
function expertTagPhrase(resort) {
  const tags = resort.best_for_tags || [];
  const hits = EXPERT_TAGS_ORDER.filter((t) => tags.includes(t)).map((t) => EXPERT_TAG_LABEL[t]);
  if (!hits.length) return "";
  if (hits.length === 1) return hits[0];
  if (hits.length === 2) return `${hits[0]} and ${hits[1]}`;
  return `${hits.slice(0, -1).join(", ")}, and ${hits[hits.length - 1]}`;
}
function expertAssessmentSentence(resort) {
  const pct = resort.terrain_pct ? resort.terrain_pct.advanced_expert : null;
  const tagPhrase = expertTagPhrase(resort);
  if (pct != null) {
    return tagPhrase
      ? `${pct}% of the terrain is rated advanced or expert, including ${tagPhrase}.`
      : `${pct}% of the terrain is rated advanced or expert.`;
  }
  if (tagPhrase) return `Terrain breakdown not published by the resort, but it's known for ${tagPhrase}.`;
  return "Terrain breakdown not published by the resort.";
}
function expertWeakCaveat(resort) {
  const pct = resort.terrain_pct ? resort.terrain_pct.advanced_expert : null;
  if (pct != null) return `only ${pct}% of the terrain is rated advanced or expert — not the strong side here`;
  return "not much terrain here is rated advanced or expert";
}

function buildRangeReadoutHtml(resort, range) {
  const floorTier = tierForScore(range.floorScore);
  const ceilingTier = tierForScore(range.ceilingScore);
  const levels = SKILL_LEVELS;
  const floorIdx = levels.indexOf(range.floor);
  const ceilingIdx = levels.indexOf(range.ceiling);
  const leftPct = (floorIdx / (levels.length - 1)) * 100;
  const rightPct = (ceilingIdx / (levels.length - 1)) * 100;
  const weakFloor = floorTier === "weak";
  const weakCeiling = ceilingTier === "weak";
  // Zoom-round fix (synthetic-user-testing.md Critical finding): adjacent
  // skill tiers (e.g. "Never skied" next to "Beginner") put the floor and
  // ceiling pin anchors as close together as they can ever be. At 200% zoom
  // the label text grows enough to overlap regardless of wrapping/max-width
  // (see styles.css's `.range-track--tight` comment) — that case gets a
  // dedicated reflow (ceiling label drops below the track) rather than
  // relying on text metrics alone to avoid a collision.
  const tightRange = (ceilingIdx - floorIdx) <= 1;
  // Zoom-round fix, second edge case found while re-verifying the first:
  // whenever floor is the very first tier ("Never skied") or ceiling is the
  // very last ("Expert") — both common, unrelated to the tight-range case —
  // that pin's anchor sits exactly at the 0%/100% edge of the track with
  // nothing beyond it. A centered label there bleeds half its own width past
  // the edge (confirmed: -31px off the left edge of the viewport at 200%
  // zoom for a floor-pin "Never skied" case). `range-pin--edge-start` /
  // `--edge-end` (styles.css) shift just the flag — not the marker, which
  // must stay precisely on the anchor — so the label grows inward from the
  // edge instead of spilling past it.
  const floorAtEdge = floorIdx === 0;
  const ceilingAtEdge = ceilingIdx === levels.length - 1;
  const beginnerNote = sanitizeDatasetProse(resort.beginner_note);

  const floorSentence = weakFloor
    ? `Beginners: ${beginnerNote || "This mountain leans toward more experienced skiers — the easy terrain is limited."}`
    : `Beginners: ${beginnerNote || "A comfortable place to start."}`;
  // Derived from terrain_pct.advanced_expert / best_for_tags only — never
  // from character_note, which isn't scoped as a terrain-difficulty field
  // and can flatly contradict Nicole's own hot take on the same card
  // (see build-notes.md, critical fix #2).
  const ceilingSentence = `Experts: ${expertAssessmentSentence(resort)}`;

  const segGlyphs = ["circleGlyph", "circleGlyph", "squareGlyph", "diamondGlyph", "doubleDiamondGlyph"];
  const segColors = ["trail-beginner", "trail-beginner", "trail-intermediate", "trail-advanced", "trail-advanced"];

  return `
    <section class="range-readout" aria-label="Group range: floor is ${SKILL_LABEL[range.floor]}, ${floorTier === "strong" ? "well served" : floorTier === "decent" ? "solidly served" : "the weaker end"}. Ceiling is ${SKILL_LABEL[range.ceiling]}, ${ceilingTier === "strong" ? "well served" : ceilingTier === "decent" ? "solidly served" : "the weaker end"}.">
      <h3 class="display-h3 range-readout__heading">How this works for your whole group</h3>
      <p class="range-readout__subline body-sm">We didn't average your group into one middle score — here's how this resort holds up at both ends.</p>
      <div class="range-track ${tightRange ? "range-track--tight" : ""}" aria-hidden="true">
        ${levels.map((l, i) => `<span class="range-seg" style="background:var(--${segColors[i]});opacity:.22"><span class="range-seg__glyph" style="color:var(--${segColors[i]})">${ICONS[segGlyphs[i]]}</span></span>`).join("")}
        <div class="range-bridge-wrap" style="left:${leftPct}%;right:${100 - rightPct}%">
          <div class="range-bridge" id="range-bridge">
            <span class="range-bridge__half range-bridge__half--floor ${weakFloor ? "range-bridge__half--weak" : ""}"></span>
            <span class="range-bridge__half range-bridge__half--ceiling ${weakCeiling ? "range-bridge__half--weak" : ""}"></span>
          </div>
          <div class="range-pin range-pin--floor ${floorAtEdge ? "range-pin--edge-start" : ""}" id="range-pin-floor" style="left:0">
            <span class="range-pin__flag">${weakFloor ? `<span class="inline-icon-sm">${ICONS.warning}</span> ` : ""}${capitalize(range.floor)}</span>
            <span class="range-pin__marker range-pin__marker--circle"></span>
          </div>
          <div class="range-pin range-pin--ceiling ${ceilingAtEdge ? "range-pin--edge-end" : ""}" id="range-pin-ceiling" style="left:100%">
            <span class="range-pin__flag">${weakCeiling ? `<span class="inline-icon-sm">${ICONS.warning}</span> ` : ""}${capitalize(range.ceiling)}</span>
            <span class="range-pin__marker range-pin__marker--diamond"></span>
          </div>
        </div>
      </div>
      <div class="range-sentences" id="range-sentences">
        <p class="body-md"><strong>For newer skiers:</strong> <span class="body-sm" style="color:var(--text-secondary)">${tierLabel(floorTier, beginnerNote)}${weakFloor ? "" : "."}</span><br>${floorSentence}</p>
        <p class="body-md"><strong>For more experienced skiers:</strong> <span class="body-sm" style="color:var(--text-secondary)">${tierLabel(ceilingTier, expertWeakCaveat(resort))}${weakCeiling ? "" : "."}</span><br>${ceilingSentence}</p>
      </div>
    </section>`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).replace("-", " "); }

// Cold-view pronoun transform (heuristic-evaluation.md, H2 major finding):
// a shared-result link is strategy.md's own named *primary* distribution
// path — more common than the bare app link — so a cold recipient who never
// answered any questions must not be told "You said…". Only the small,
// known set of second-person patterns actually produced by
// buildReasonBullets() are targeted, in a fixed, safe order.
function toColdViewBullet(bullet) {
  return bullet
    .replace(/\bYou're\b/g, "They're")
    .replace(/\byou're\b/g, "they're")
    .replace(/\bYou said\b/g, "They said")
    .replace(/\byou said\b/g, "they said")
    .replace(/\byou weren't\b/g, "they weren't")
    .replace(/\byour\b/g, "their")
    .replace(/\bYour\b/g, "Their");
}

function renderResult(main) {
  const shared = state.routeParams.shared;
  const resort = RESORTS_BY_ID[shared.rid];
  const badge = badgeSvg(resort, "hero");
  const altText = badgeAltText(resort);
  const hasHotTake = !!resort.hot_take;
  const location = resort.country === "Canada" ? `${resort.state_province}, Canada` : resort.state_province;
  // A result is "fresh" when this session generated it (quiz submit, or a
  // Chase-the-Snow row tap) vs. loaded cold from a #result= link someone
  // else sent — the signal strategy.md's own share-link-first distribution
  // model needs to speak in the right voice.
  const isFreshResult = !!state.routeParams.fresh;
  const displayBullets = isFreshResult ? shared.reasonBullets : shared.reasonBullets.map(toColdViewBullet);

  main.innerHTML = `
    <div class="result-wrap">
      <article class="result-card" id="result-card">
        <div class="attribution reveal-hidden">
          <span class="attribution__mark">${ICONS.mountain}</span>
          <span class="attribution__word label">Rather Be Knee Deep</span>
        </div>
        <p class="result-eyebrow label reveal-hidden">${isFreshResult ? "Your pick" : "Their pick"}</p>
        <div class="badge-panel reveal-hidden" role="img" aria-label="${escapeHtml(altText)}">${badge}</div>
        <h1 class="display-hero result-headline reveal-hidden" tabindex="-1">
          <span class="resort-name">${escapeHtml(resort.name)}</span>
          <span class="location body-md">${escapeHtml(location)}</span>
        </h1>
        <h2 class="display-h3 reason-heading reveal-hidden">Why this one</h2>
        <ul class="reason-list">
          ${displayBullets.map((b) => `<li class="reason-bullet reveal-hidden"><span class="reason-bullet__icon">${ICONS.checkCircle}</span><span class="reason-bullet__text body-md">${escapeHtml(b)}</span></li>`).join("")}
        </ul>
        <h2 class="display-h3 reveal-hidden" style="margin-bottom:var(--space-3)">The numbers</h2>
        <div class="stat-strip stat-strip--quad reveal-hidden" id="stat-strip">${buildStatStrip(resort)}</div>
        ${buildTerrainMixStrip(resort)}
        ${buildDetailNotes(resort)}
        ${shared.showRangeReadout ? buildRangeReadoutHtml(resort, shared.range).replace('class="range-readout"', 'class="range-readout reveal-hidden"') : ""}
        ${hasHotTake ? `
          <div class="hot-take reveal-hidden" id="hot-take">
            <span class="hot-take__quote-mark" aria-hidden="true">&ldquo;</span>
            <div class="hot-take__header">
              <span class="hot-take__avatar" aria-hidden="true">N</span>
              <span class="hot-take__label label">Nicole's Hot Take</span>
              ${resort.hot_take.rating ? `<span class="hot-take__rating data-inline">${escapeHtml(String(resort.hot_take.rating))}/10</span>` : ""}
            </div>
            <p class="hot-take__body">${escapeHtml(resort.hot_take.text)}</p>
            <span class="hot-take__attribution">— Nicole, on ${escapeHtml(resort.name)}</span>
          </div>` : ""}
        <div class="footer-cta reveal-hidden" id="footer-cta">
          <button class="btn btn-primary btn-block" id="share-btn" type="button">${ICONS.share} Share this pick</button>
          <p class="body-sm" style="text-align:center;color:var(--text-secondary);margin:0">Copies a link with the picture and the why.</p>
          <button class="btn btn-secondary btn-block" id="make-own-btn" type="button">Make your own pick</button>
          <button class="btn-text" id="see-nicoles-btn" type="button" style="text-align:center">See more of Nicole's picks →</button>
        </div>
      </article>
    </div>`;

  document.getElementById("share-btn").addEventListener("click", () => shareResult(resort, shared));
  document.getElementById("make-own-btn").addEventListener("click", () => navigate("splash"));
  document.getElementById("see-nicoles-btn").addEventListener("click", () => navigate("nicoles"));
  main.querySelectorAll(".stat-tile__expand-btn, .notes-row__expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
    });
  });

  document.title = isFreshResult ? `${resort.name} — your ski trip match` : `${resort.name} — a ski trip match`;
  // og.description.result bug fix: the raw first reason bullet already ends
  // in a period, so concatenating ". See the full pick." produced a visible
  // double period in the real link-preview text ("...ones.. See the full
  // pick."). Strip trailing punctuation before rejoining. Cold-view also
  // gets the pronoun-transformed bullet and drops "to your answers", since a
  // link-preview reader gave no answers either.
  const ogFirstBullet = (isFreshResult ? shared.reasonBullets[0] : toColdViewBullet(shared.reasonBullets[0] || ""))
    || (isFreshResult ? "a real fit for your crew" : "a real fit for their crew");
  setOgMeta({
    title: isFreshResult ? `${resort.name} — your ski trip match` : `${resort.name} — a ski trip match`,
    description: `Matched ${isFreshResult ? "to your answers" : "on"}: ${ogFirstBullet.replace(/[.!?]+$/, "")}. See the full pick.`,
    // Share-thumbnail scale (badge-system.md §8: 72px = group-chat/link-
    // preview thumbnail). This is a best-effort wire-up, not a guarantee: a
    // static single-file app with no backend can't render a per-resort
    // raster og:image, so this is the badge's own SVG as a data: URI. Some
    // crawlers (Slack, Discord, iMessage's link-preview fetcher in some
    // versions) render an SVG og:image fine; others silently ignore
    // non-raster og:image and fall back to no image at all — a known,
    // honest limitation of the architecture, not a bug in the badge itself.
    // Verified visually by screenshotting the same badge markup at 72px
    // (build/verify_badge_system.js) since that's the one thing actually
    // checkable without a real chat client.
    image: `data:image/svg+xml;base64,${btoa(badge)}`,
  });

  revealResultCard(document.getElementById("result-card"), { hasRangeReadout: shared.showRangeReadout, hasHotTake });

  // M9 fix: every other route calls focusHeading(main); renderResult never
  // did, so keyboard users landing on the result screen (finishing the quiz,
  // or — the more common case per strategy.md — a cold share-link load) got
  // no positional signal at all. The aria-live announcement inside
  // revealResultCard is a good belt, but a live-region update firing this
  // close to initial page load is a known race with some AT — a focus move
  // is reliably detected regardless of load timing.
  focusHeading(main);
}

// --- Reveal choreography — motion-spec.md §2.5, adapted to our DOM ----------
function revealResultCard(card, { hasRangeReadout, hasHotTake }) {
  const reduce = reduceMotion();
  const anims = [];
  const el = (sel) => card.querySelector(sel);
  const push = (selector, keyframes, opts) => {
    const node = el(selector);
    if (!node) return;
    node.classList.remove("reveal-hidden");
    anims.push(node.animate(keyframes, opts));
  };

  card.querySelectorAll(".reveal-hidden").forEach((n) => { n.style.opacity = 0; });

  if (reduce) {
    card.querySelectorAll(".reveal-hidden").forEach((n) => { n.classList.remove("reveal-hidden"); n.style.opacity = ""; });
    // M3 fix: the bridge and both pins key off `.is-revealed`, not
    // `.reveal-hidden` — that class is only ever added in the full-motion
    // branch below, so under reduced motion the bridge stayed permanently
    // `scaleX(0)` (invisible) and the pins stayed at opacity 0. That's
    // information loss, not motion reduction: the two plain-language
    // sentences still rendered, but the graphic a sighted user sees showed
    // a blank gap where the whole component should be.
    ["#range-bridge", "#range-pin-floor", "#range-pin-ceiling"].forEach((sel) => {
      const node = card.querySelector(sel);
      if (node) node.classList.add("is-revealed");
    });
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease", fill: "forwards" });
    announce("reveal-announcer", "Your pick is ready.");
    return;
  }

  card.animate(
    [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "translateY(0)" }],
    { duration: 360, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }
  );

  push(".attribution", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 0, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });
  push(".result-eyebrow", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 0, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });
  push(".badge-panel", [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1)" }], { duration: 220, delay: 40, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
  push(".result-headline", [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, delay: 80, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
  push(".reason-heading", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 100, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });

  card.querySelectorAll(".reason-bullet").forEach((n, i) => {
    n.classList.remove("reveal-hidden");
    anims.push(n.animate(
      [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 160, delay: 120 + i * 40, easing: "cubic-bezier(.2,0,0,1)", fill: "both" }
    ));
  });

  card.querySelectorAll("h2.reveal-hidden").forEach((n) => { n.classList.remove("reveal-hidden"); n.style.opacity = 1; n.style.transitionDelay = "0"; });
  push("#stat-strip", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 240, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });

  let nextBlockStart = 300;

  if (hasRangeReadout) {
    const bridge = el("#range-bridge");
    if (bridge) anims.push(bridge.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 220, delay: 280, easing: "cubic-bezier(.2,0,0,1)", fill: "both" }));
    ["#range-pin-floor", "#range-pin-ceiling"].forEach((sel, i) => {
      const node = el(sel);
      if (node) anims.push(node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: i === 0 ? 280 : 480, easing: "cubic-bezier(.2,0,0,1)", fill: "both" }));
    });
    if (bridge) { bridge.classList.add("is-revealed"); el("#range-pin-floor") && el("#range-pin-floor").classList.add("is-revealed"); el("#range-pin-ceiling") && el("#range-pin-ceiling").classList.add("is-revealed"); }
    push("#range-sentences", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 320, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });
    const heading = el(".range-readout__heading");
    if (heading) { heading.closest(".range-readout").classList.remove("reveal-hidden"); heading.closest(".range-readout").style.opacity = 1; }
    nextBlockStart = 500;
  }

  if (hasHotTake) {
    push("#hot-take", [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 220, delay: nextBlockStart, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    nextBlockStart += 60;
  }

  push("#footer-cta", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: nextBlockStart, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });

  announce("reveal-announcer", "Your pick is ready.");

  const skip = () => {
    anims.forEach((a) => { try { a.finish(); } catch (e) {} });
    card.querySelectorAll(".reveal-hidden").forEach((n) => { n.classList.remove("reveal-hidden"); n.style.opacity = 1; });
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((evt) => document.removeEventListener(evt, skip));
  };
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((evt) => document.addEventListener(evt, skip, { passive: true }));
}

function announce(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function setOgMeta({ title, description, image }) {
  const set = (prop, content, attr) => {
    let tag = document.querySelector(`meta[${attr}="${prop}"]`);
    if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attr, prop); document.head.appendChild(tag); }
    tag.setAttribute("content", content);
  };
  set("og:title", title, "property"); set("twitter:title", title, "name");
  set("og:description", description, "property"); set("twitter:description", description, "name");
  if (image) { set("og:image", image, "property"); set("twitter:image", image, "name"); }
}

async function shareResult(resort, shared) {
  const token = b64urlEncode(JSON.stringify(shared));
  const url = `${location.origin}${location.pathname}#result=${token}`;
  const shareData = {
    title: `${resort.name} — your ski trip match`,
    text: `${shared.reasonBullets[0] || "A real fit for your crew"} — see the full pick:`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch (e) { /* user cancelled or unsupported — fall through */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("Link copied");
  } catch (e) {
    showToast(url);
  }
}

let toastTimer = null;
function showToast(text) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove("toast--dismissing");
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  toastTimer = setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.classList.add("toast--dismissing");
  }, 2000);
}
