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
  // area = where the resort is (regions.js). region (a home metro) stays null:
  // Chase's "Traveling from" control was removed 2026-11-07, so nothing re-ranks
  // by distance. includeBeginnerFriendly stays false: that toggle went too, so
  // Chase never lists day-trip hills.
  chaseAnswers: { region: null, area: "all", includeBeginnerFriendly: false },
  chaseCache: null,         // { forecasts, anyFallback } once resolved
  chaseLoadHandle: null,    // { skip() } while a forecast fetch is in flight
  nicolesFilters: { region: "all", sort: "region" },
  // Quiver Check: a two-step picker (resort -> day) plus its own forecast
  // cache, kept separate from chaseCache because the two modes want
  // different shapes of the same data — Chase needs one 7-day total for
  // every US resort, Quiver needs seven per-day rows for exactly one.
  // `hadPrev` records
  // that the call was reached by picking a day, rather than by landing cold on
  // a shared #quiver= link. The result page's back control branches its
  // wording AND its destination on it, because on a cold landing there is no
  // picker behind you to go back to.
  quiver: { step: "resort", resortId: null, dateKey: null, search: "", area: "all", hadPrev: false },
  quiverForecast: null,     // { resortId, status, days, timeZone, isLive }
  // Buzz: the region filter only. Not in the URL; entering from the nav resets it.
  buzz: { region: "all" },
  // Sticker Check (app-game.js): the round in progress, kept in memory so a
  // trip out to a resort page and Back lands on the same sticker.
  game: null,
  // Rope Drop (app-rope-drop.js): which screen and question you're on. The
  // answers themselves live in localStorage, so a reload resumes the round.
  ropeDrop: null,
};

const COST_LABEL = { "$": "budget-conscious", "$$": "mid-range", "$$$": "splurge-friendly", "$$$$": "money's no object" };
const CROWD_COPY = { low: "Rarely crowded", moderate: "Can get busy", high: "Usually crowded", brutal: "Expect crowds, especially on powder days" };
const PASS_COPY = { Epic: "Epic pass", Ikon: "Ikon pass", "Mountain Collective": "Mountain Collective", Indy: "Indy pass", Independent: "Independent (no multi-resort pass)" };
const SCHOOL_COPY = { strong: "Highly rated", decent: "Solid", weak: "Limited — check details before booking" };
const ACTIVITIES_COPY = { strong: "Plenty to do beyond skiing", decent: "A few solid options beyond skiing", thin: "Not much beyond skiing" };

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

/**
 * The back control for a leaf page — a view the app can leave you standing on
 * with nothing above it. Two use it: the Quiver call and the trip-planner
 * result card. Modelled on the old Rants & Raves back link, the first place this
 * problem was solved here.
 *
 * `label` always names the destination. A bare chevron gives a screen-reader
 * user nothing to act on and gives a cold-landed reader — who never saw the
 * screen it points back to — nothing at all. The arrow is decoration on top of
 * that name, never a substitute for it, so it is aria-hidden.
 *
 * `isBack` is not styling. It records whether this is genuinely a return to a
 * screen the user came from, or a first trip to the surface's entry point.
 * Both are honest destinations; only one of them is "back", and the caller has
 * to have decided which before it gets here (see the cold-landing notes at
 * each call site). The arrow renders only for the real thing.
 */
function leafBackHtml(id, label, isBack) {
  return `<button class="leaf-back" id="${id}" type="button">` +
    (isBack ? `<span class="leaf-back__arrow" aria-hidden="true">&larr;</span>` : "") +
    `<span>${escapeHtml(label)}</span></button>`;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// History (heuristic review 2026-11-21, HR-1). The app used to call only
// replaceState, so the browser's Back button, and the phone's back swipe,
// always left the site. Every route change, and each forward step in Quiver,
// now pushes an entry; popstate restores it. Hash writes (#result=, #quiz=,
// #quiver=) still use replaceState, and keep the entry's state object.
//
// `depth` counts entries pushed in this visit. A leaf page's own Back control
// uses history.back() only when depth > 0, i.e. when there is an in-app page
// behind it; a cold-landed shared link keeps its existing fallback.
// ---------------------------------------------------------------------------
function historySnapshot(depth) {
  return {
    rbkd: 1,
    depth,
    route: state.route,
    params: state.routeParams || {},
    quiver: state.route === "quiver" && state.quiver ? Object.assign({}, state.quiver) : null,
  };
}
function saveScrollToHistory() {
  try {
    const cur = history.state;
    if (cur && cur.rbkd) history.replaceState(Object.assign({}, cur, { scrollY: window.scrollY }), "", location.href);
  } catch (e) { /* history unavailable (sandboxed iframe): ignore */ }
}
function pushHistoryEntry() {
  try {
    const depth = (history.state && history.state.rbkd ? history.state.depth : 0) + 1;
    history.pushState(historySnapshot(depth), "", location.pathname + location.search);
  } catch (e) { /* ignore */ }
}
function initHistory() {
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    history.replaceState(historySnapshot(0), "", location.href);
  } catch (e) { /* ignore */ }
  window.addEventListener("popstate", onHistoryPop);
}
function canGoBackInApp() {
  return !!(history.state && history.state.rbkd && history.state.depth > 0);
}
function onHistoryPop(e) {
  const s = e.state;
  const fromRoute = state.route;
  const fromParams = state.routeParams || {};
  if (!s || !s.rbkd) { state.route = "splash"; state.routeParams = {}; syncHash(); render(); window.scrollTo(0, 0); return; }
  state.route = s.route;
  state.routeParams = Object.assign({}, s.params || {});
  // Leaving a resort page: land on the row that opened it (HR-11).
  if (fromRoute === "result" && fromParams.shared) state.routeParams.focusResort = fromParams.shared.rid;
  if (s.route === "quiver" && s.quiver) {
    const keepDay = state.quiver && state.quiver.resortId === s.quiver.resortId ? state.quiver.dateKey : null;
    state.quiver = Object.assign({}, s.quiver);
    // Back from a call to the day picker keeps the day you'd chosen selected.
    if (state.quiver.step === "day" && !state.quiver.dateKey && keepDay) state.quiver.dateKey = keepDay;
    if (state.quiver.resortId && (!state.quiverForecast || state.quiverForecast.resortId !== state.quiver.resortId)) prefetchQuiverForecast(state.quiver.resortId);
  }
  if (s.route === "plan") clampQuizStep();
  syncHash();
  if (s.route === "quiver" && fromRoute === "quiver" && document.getElementById("quiver-body")) {
    renderQuiverStep();
    focusHeading(mainEl());
  } else {
    render();
  }
  if (!state.routeParams.focusResort) window.scrollTo(0, s.scrollY || 0);
}
function clampQuizStep() {
  const screens = getQuizScreens(state.quizAnswers);
  if (state.quizStepIdx >= screens.length) state.quizStepIdx = screens.length - 1;
  if (state.quizStepIdx < 0) state.quizStepIdx = 0;
}

function navigate(route, params) {
  const previousRoute = state.route;
  saveScrollToHistory();
  state.route = route;
  state.routeParams = params || {};
  if (route === "quiver") {
    // Same resume rule the quiz uses below: bouncing out to Chase or
    // Nicole's List and back must not silently throw away a mountain the
    // user already picked, but arriving from the splash should start clean.
    const cameFromModeSwitch = previousRoute === "chase" || previousRoute === "nicoles" || previousRoute === "plan";
    if (!cameFromModeSwitch) {
      state.quiver = { step: "resort", resortId: null, dateKey: null, search: "", hadPrev: false };
      state.quiverForecast = null;
    } else if (state.quiver.step === "result" && !state.quiver.dateKey) {
      state.quiver.step = state.quiver.resortId ? "day" : "resort";
    }
  }
  if (route === "buzz") state.buzz.region = "all";
  // The home tile always opens the game's front page. Coming back from a
  // resort page goes through history instead, which keeps the round.
  if (route === "game") state.game = { phase: "home" };
  if (route === "rope") state.ropeDrop = { phase: "home" };

  if (route === "plan") {
    // HR-3 (heuristic review 2026-11-21): re-tapping the Plan tab, or going
    // home and back, mid-quiz used to drop you to Step 1 with your answers
    // still selected. Now any entry resumes while answers exist; "Start over"
    // is the one way to clear them.
    const hasAnswers = Object.keys(state.quizAnswers || {}).length > 0;
    if (!hasAnswers) state.quizStepIdx = 0;
    else clampQuizStep();
  }
  // A tap on the tab you're already on re-renders in place; it isn't a new page.
  if (!(route === previousRoute && route !== "result")) pushHistoryEntry();
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
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
    return;
  }
  const payload = { v: 1, q: state.quizAnswers, i: state.quizStepIdx };
  history.replaceState(history.state, "", "#quiz=" + b64urlEncode(JSON.stringify(payload)));
}

function syncHash() {
  if (state.route === "result" && state.routeParams.shareToken) {
    history.replaceState(history.state, "", "#result=" + state.routeParams.shareToken);
  } else if (state.route === "plan") {
    syncQuizHash();
  } else if (state.route === "buzz") {
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
  } else if (state.route === "quiver") {
    // renderQuiverResult() writes #quiver= itself once it knows the resort
    // and day; the two picker steps have nothing shareable yet, so the URL
    // is cleared rather than left pointing at a stale call.
    if (state.quiver.step !== "result" && location.hash) {
      history.replaceState(history.state, "", location.pathname + location.search);
    }
  } else {
    // Keep the URL tidy for other routes; result links and in-progress quiz
    // state are the only shareable, resumable states.
    if (location.hash) history.replaceState(history.state, "", location.pathname + location.search);
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
  // HR-5 (heuristic review 2026-11-21): a /r/<id> share page reached without
  // its #result= fragment (a messenger stripped it, or someone copied the
  // preview page's own URL) forwards here, so the reader still lands on the
  // resort the preview promised. Published facts only, as from Picks.
  if (hash.startsWith("#resort=")) {
    const rid = decodeURIComponent(hash.slice("#resort=".length));
    const resort = RESORTS_BY_ID[rid];
    if (resort) {
      const bullets = resort.character_note ? [sanitizeDatasetProse(resort.character_note)] : [];
      const payload = { v: 1, rid, reasonBullets: bullets, showRangeReadout: false, range: null };
      const token = b64urlEncode(JSON.stringify(payload));
      state.route = "result";
      state.routeParams = { shared: payload, shareToken: token };
      history.replaceState(history.state, "", "#result=" + token);
      return;
    }
  }
  if (hash.startsWith("#quiver=")) {
    const token = hash.slice("#quiver=".length);
    try {
      const payload = JSON.parse(b64urlDecode(token));
      if (payload && payload.rid && RESORTS_BY_ID[payload.rid] && typeof payload.d === "string") {
        state.route = "quiver";
        // hadPrev: false — a cold landing, by definition. Nobody picked a day
        // to get here, so the call's back control must offer the picker as a
        // destination rather than claim to return them to one.
        state.quiver = { step: "result", resortId: payload.rid, dateKey: payload.d, search: "", hadPrev: false };
        // Deliberately NOT restoring a frozen recommendation from the token
        // (unlike #result=, which does exactly that). A ski call is only
        // true while the forecast behind it is, so a shared link re-reads
        // the forecast on arrival — see app-quiver.js's sharing section.
        quiverPendingPrefetch = payload.rid;
        return;
      }
    } catch (e) { /* fall through to splash on any malformed quiver link */ }
  }
  if (hash.startsWith("#rants=")) {
    // Rants & Raves became Buzz on 2026-11-07. An old shared link lands on the
    // directory rather than on the splash screen, and the stale hash is dropped.
    state.route = "buzz";
    history.replaceState(history.state, "", location.pathname + location.search);
    return;
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
  // HR-8 (heuristic review 2026-11-21): the resort page carries the nav too.
  // It was a nav-less island, and a friend who opened a shared pick had an
  // unlabelled sticker as the only way into the rest of the app.
  const chromeRoutes = ["splash", "plan", "chase", "quiver", "nicoles", "buzz", "result", "game", "rope"];
  const showNav = chromeRoutes.includes(state.route);
  document.getElementById("bottom-nav").hidden = !showNav;
  document.getElementById("top-nav").hidden = !showNav;
  main.classList.toggle("no-bottom-nav", !showNav);
  updateNavCurrent();

  if (state.route === "splash") return renderSplash(main);
  if (state.route === "plan") return renderPlan(main);
  if (state.route === "chase") return renderChase(main);
  if (state.route === "quiver") return renderQuiver(main);
  if (state.route === "nicoles") return renderNicolesList(main);
  if (state.route === "buzz") return renderBuzzRoute(main);
  if (state.route === "result") return renderResult(main);
  if (state.route === "game") return renderGameRoute(main);
  if (state.route === "rope") return renderRopeDropRoute(main);
  renderSplash(main);
}

function updateNavCurrent() {
  // A resort page counts as the section that opened it; a cold-landed one as none.
  const ORIGIN_ROUTE = { chase: "chase", picks: "nicoles", plan: "plan" };
  const current = state.route === "result" ? ORIGIN_ROUTE[(state.routeParams || {}).origin] : state.route;
  document.querySelectorAll(".nav-item").forEach((btn) => {
    if (btn.dataset.route === current) btn.setAttribute("aria-current", "page");
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
  // Home (Director, 2026-11-07, option A from the home-page exploration): the
  // app's sticker, the question people text Nicole, then one tile per section.
  // HR-12 (heuristic review 2026-11-21): Plan is now the one primary tile,
  // first and full width, because it is the answer to the headline's question
  // for a newcomer or a friend who was just sent a pick. The bottom nav shows
  // here too, with nothing marked current.
  const tile = (id, icon, label, support, wide) => `
    <button class="mode-card${wide ? " mode-card--wide mode-card--primary" : ""}" id="${id}" type="button">
      <span class="mode-card__icon">${icon}</span>
      <span class="mode-card__label">${label}</span>
      <span class="mode-card__support body-sm">${support}</span>
    </button>`;
  main.innerHTML = `
    <div class="page-column">
      <div class="splash">
        <div class="splash-sticker" aria-hidden="true"><img src="${BRAND_STICKER_ART}" alt="" width="208" height="208" decoding="async"></div>
        <h1 class="display-h1 splash-title">Where should we ski?</h1>
        <div class="splash-modes">
          ${tile("mode-chase", ICONS.snow, "Chase", "Where it's dumping")}
          ${tile("mode-quiver", ICONS.skis, "Quiver", "Which skis to bring")}
          ${tile("mode-nicoles", ICONS.list, "Picks", "Resort hot takes")}
          ${tile("mode-plan", ICONS.mountain, "Plan", "A resort in 5 questions")}
          ${tile("mode-game", ICONS.sticker, "Sticker Check", "Name 5 resort badges")}
          ${tile("mode-rope", ICONS.rope, "Rope Drop", "7 trivia questions a day")}
        </div>
      </div>
    </div>`;
  document.getElementById("mode-plan").addEventListener("click", () => navigate("plan"));
  document.getElementById("mode-chase").addEventListener("click", () => navigate("chase"));
  document.getElementById("mode-quiver").addEventListener("click", () => navigate("quiver"));
  document.getElementById("mode-nicoles").addEventListener("click", () => navigate("nicoles"));
  // Sticker Check: the home tile is its only way in (Director, 2026-11-23).
  document.getElementById("mode-game").addEventListener("click", () => navigate("game"));
  // Rope Drop: a tile beside Sticker Check, under the four sections (Director, 2026-11-26).
  document.getElementById("mode-rope").addEventListener("click", () => navigate("rope"));
  document.title = "Rather Be Knee Deep — where should we ski?";
  setOgMeta({
    title: "Where should we ski?",
    description: "Nicole's ski picks, where it's dumping, which skis to bring, and a 5-question resort finder.",
  });
}

// ---------------------------------------------------------------------------
// Plan a trip — quiz
// ---------------------------------------------------------------------------
function getQuizScreens(answers) {
  const screens = [
    { key: "q1", topic: 1, topicLabel: "Group mix" },
    { key: "q2a", topic: 2, topicLabel: "Skill level" },
    { key: "q2b", topic: 2, topicLabel: "Terrain" },
    { key: "q3", topic: 3, topicLabel: "Budget" },
    // The pass sits under topic 3, not a sixth topic of its own. A pass IS a
    // budget fact -- the single biggest lever on what a trip costs -- and the
    // quiz already runs more screens than topics (skill and terrain are both
    // topic 2, travel and home region are both topic 4). So Home's "A resort
    // in 5 questions" stays true: five topics, more screens.
    { key: "q3b", topic: 3, topicLabel: "Pass" },
  ];
  if (answers.pass && answers.pass !== "none") screens.push({ key: "q3c", topic: 3, topicLabel: "Pass" });
  screens.push({ key: "q4a", topic: 4, topicLabel: "Travel" });
  if (answers.travelMode !== "unsure") screens.push({ key: "q4b", topic: 4, topicLabel: "Home region" });
  screens.push({ key: "q5", topic: 5, topicLabel: "Scene" });
  return screens;
}

const QUIZ_OPTIONS = {
  // Shortened 2026-11-23 (Director). The heading changed with them, and had
  // to: "Who's coming, and is everyone about the same level?" asked two
  // things and these four answer one of them. The app only ever wanted the
  // one -- groupType decides whether the next step is multi-select and
  // whether the engine reasons about a range; group size, kids and who they
  // are were never stored or used anywhere. So the question now asks what it
  // actually uses, and every option answers it.
  q1: [
    { value: "solo", label: "Solo trip" },
    { value: "matched", label: "Same levels" },
    { value: "mixed", label: "Somewhat mix" },
    { value: "wide-mixed", label: "Broad mix" },
  ],
  q2a: [
    { value: "never-skied", label: "First time" },
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
    { value: "expert", label: "Expert" },
  ],
  // Multi-select, 2026-11-23 (Director). Two consequences worth naming.
  //
  // "A mix of everything" is gone, and had to be: when you can tap Groomers
  // and Steeps, tapping both IS the mix. A separate Mix option would be a
  // second way to say the same thing.
  //
  // The options are the ones the data can actually back. Across the 71
  // resorts: long-groomers 12, steeps 19, tree-skiing 21, deep-powder 18,
  // terrain-park 15 -- every one a real tag, and powder additionally has
  // avg_annual_snowfall_in behind it. Chutes and bowls were asked for and
  // left out: there is no field, no tag and (chutes) not one mention in 71
  // character notes, so they would have been labels over nothing.
  q2b: [
    { value: "groomers", label: "Groomers" },
    { value: "steeps", label: "Steeps" },
    { value: "trees", label: "Trees" },
    { value: "powder", label: "Powder" },
    { value: "park", label: "Park" },
    { value: "anything", label: "Anything" },
  ],
  q3: [
    { value: "$", label: "Budget-conscious ($)" },
    { value: "$$", label: "Mid-range ($$)" },
    // "Splurge-friendly" was the odd one out: the other three name a budget
    // and it named a mood (Director, 2026-11-23).
    { value: "$$$", label: "Room to spend ($$$)" },
    { value: "$$$$", label: "Money's no object ($$$$)" },
  ],
  // Added 2026-11-23 (Director). Every resort already carries its
  // affiliation and the engine ignored it completely -- it was printed on the
  // resort page and nowhere else. Across the 71: Ikon 39, Epic 15, Indy 7,
  // independent 9, Mountain Collective 1.
  q3b: [
    { value: "ikon", label: "Ikon" },
    { value: "epic", label: "Epic" },
    { value: "indy", label: "Indy" },
    { value: "none", label: "No pass" },
  ],
  // Required is a hard gate and that spread is why it needs its own question.
  // An Epic filter leaves 15 resorts nationwide, and ten states and provinces
  // in the set have none at all, so "required" can realistically empty the
  // list -- which the engine handles by falling back and saying so, rather
  // than by showing nothing.
  q3c: [
    { value: "required", label: "Has to be covered" },
    { value: "preferred", label: "Nice to have" },
  ],
  q4a: [
    { value: "driving", label: "Driving" },
    { value: "flying", label: "Flying" },
    // "Unsure", not "Not sure yet -- show me both" (Director, 2026-11-23):
    // it now matches Driving and Flying in length, and the half of the old
    // label that carried information is said properly on the result -- "We
    // didn't factor in how far this is, since you weren't sure yet."
    { value: "unsure", label: "Unsure" },
  ],
  // Shortened 2026-11-23 (Director): four answers you can read at a glance
  // rather than four small sentences. The trailing clauses ("and bars", "and
  // low-key", "not too wild") only restated the first words. Capitalisation
  // follows the rest of the quiz -- sentence case, hyphenated -- so this reads
  // as "Family-friendly" rather than title case.
  q5: [
    { value: "lively", label: "Buzzing nightlife" },
    { value: "chill", label: "Chill" },
    { value: "family", label: "Family-friendly" },
    { value: "noPreference", label: "Don't care, just here to ski" },
  ],
};

function renderPlan(main) {
  main.innerHTML = `<div class="page-column">${pageHeaderHtml("Plan")}<div id="quiz-step-container" class="quiz-step-container"></div></div>`;
  renderQuizStep(null);
  document.title = "Plan — find a ski resort that fits";
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
  //
  // The page h1 ("Plan") sits above the card since 2026-11-07, so focus goes
  // to the question itself, the thing there is to act on, rather than to
  // whichever heading comes first. The h1 is still first in reading order.
  const q = document.getElementById("quiz-step-heading");
  if (q) { q.setAttribute("tabindex", "-1"); q.focus({ preventScroll: true }); } else focusHeading(main);
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
    title = "How mixed is your group?";
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
    title = "What do you want to ski?";
    helper = "Select as many as apply.";
    body = optionListHtml("q2b", QUIZ_OPTIONS.q2b, a.terrain || [], true);
  } else if (screen.key === "q3") {
    title = "What's the budget like?";
    body = optionListHtml("q3", QUIZ_OPTIONS.q3, a.budget, false);
  } else if (screen.key === "q3b") {
    title = "Skiing on a pass?";
    body = optionListHtml("q3b", QUIZ_OPTIONS.q3b, a.pass, false);
  } else if (screen.key === "q3c") {
    title = `Does it have to be on ${a.pass === "ikon" ? "Ikon" : a.pass === "epic" ? "Epic" : "Indy"}?`;
    helper = "If it has to be, I'll only offer resorts it covers.";
    body = optionListHtml("q3c", QUIZ_OPTIONS.q3c, a.passRequired, false);
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
      ${canGoBack && isLast ? `<p style="text-align:center;margin-top:var(--space-4)"><button class="btn-text" id="quiz-start-over" type="button">Start over</button></p>` : ""}
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
  if (key === "q2b") return !!(a.terrain && a.terrain.length);
  if (key === "q3") return !!a.budget;
  if (key === "q3b") return !!a.pass;
  if (key === "q3c") return !!a.passRequired;
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
  const multi = key === "q2b" || (key === "q2a" && (a.groupType === "mixed" || a.groupType === "wide-mixed"));

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
  else if (key === "q2b") {
    // "Anything" is the escape hatch, so it clears the rest and the rest
    // clear it -- "Anything, but specifically trees" is not a thing.
    a.terrain = a.terrain || [];
    if (value === "anything") {
      a.terrain = a.terrain.includes("anything") ? [] : ["anything"];
    } else {
      a.terrain = a.terrain.filter((t) => t !== "anything");
      const i = a.terrain.indexOf(value);
      if (i >= 0) a.terrain.splice(i, 1); else a.terrain.push(value);
    }
  }
  else if (key === "q3") a.budget = value;
  // Changing the pass drops any stored requirement: "has to be covered" is
  // meaningless once the pass it referred to is gone.
  else if (key === "q3b") { a.pass = value; if (value === "none") a.passRequired = null; }
  else if (key === "q3c") a.passRequired = value;
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
  // origin: the surface this result was generated from, and the only thing the
  // result page's back control trusts. A cold #result= link carries no origin,
  // which is exactly how a share-link reader is told apart from someone who
  // just finished the quiz.
  navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true, origin: "plan" });
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
  html += statTile("Vertical drop", fmtNum(resort.vertical_drop_ft), "ft", resort.vertical_drop_ft == null ? "Vertical drop not published by the resort" : null, resort.vertical_drop_ft == null);
  html += statTile("Skiable acres", fmtNum(resort.skiable_acres), "", resort.skiable_acres == null ? "Skiable acres not published by the resort" : null, resort.skiable_acres == null);
  html += statTile("Average snowfall", fmtNum(resort.avg_annual_snowfall_in), "in", resort.avg_annual_snowfall_in == null ? "Average snowfall not published by the resort" : null, resort.avg_annual_snowfall_in == null);
  // P8: a published 2026–27 day-pass range when there is one; otherwise the
  // editorial cost tier, labelled as such, rather than a guessed price.
  const pass = dayPassLabel(resort.id);
  html += pass
    ? `<div class="stat-tile"><span class="data-label">Day pass</span><span class="stat-tile__value data-stat">${escapeHtml(pass)}</span></div>`
    : `<div class="stat-tile"><span class="data-label">Cost</span><span class="stat-tile__value data-stat">${resort.cost_tier || "—"}</span></div>`;
  return html;
}

// Numeric terrain-mix tier — kept in the same "instrument" grid treatment as
// the headline stat strip (single-line value + caption, sized identically).
function buildTerrainMixStrip(resort) {
  let html = "";
  if (resort.terrain_pct) {
    html += statTile("Beginner", resort.terrain_pct.beginner, "%", null, false);
    html += statTile("Intermediate", resort.terrain_pct.intermediate, "%", null, false);
    html += statTile("Advanced &amp; expert", resort.terrain_pct.advanced_expert, "%", null, false);
  } else {
    // HR-15: no empty ~100px tile for the 17 resorts without a published
    // breakdown. R8 still holds: buildDetailNotes says "Not published" in one row.
    return "";
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
// P20: one local pick, a single sentence linked to its source with the same
// external-link arrow Buzz uses. The arrow rides on the last word so it never
// wraps onto a line of its own. No pick -> the general activities line.
function offMountainValue(resort) {
  const pick = OFF_MOUNTAIN[resort.id];
  if (!pick) return escapeHtml(ACTIVITIES_COPY[resort.non_ski_activities] || "Not published by the resort");
  const i = pick.line.lastIndexOf(" ");
  return `<a class="offmtn-link" href="${escapeHtml(pick.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pick.line.slice(0, i + 1))}<span class="offmtn-link__end">${escapeHtml(pick.line.slice(i + 1))}<span class="offmtn-link__out" aria-hidden="true">${ICONS.external}</span></span><span class="visually-hidden">(opens in a new tab)</span></a>`;
}
function buildDetailNotes(resort) {
  return `<dl class="notes-list">
    ${resort.terrain_pct ? "" : notesRow("Terrain", "Not published by the resort")}
    ${notesRow("Crowds", escapeHtml(CROWD_COPY[resort.crowd_level] || "Not published by the resort"))}
    ${notesRow("Pass", escapeHtml(PASS_COPY[resort.pass_affiliation] || resort.pass_affiliation || "Not published by the resort"))}
    ${notesRow("Ski school", skiSchoolNotesValue(resort))}
    ${APRES[resort.id] ? notesRow("Après", escapeHtml(APRES[resort.id])) : ""}
    ${notesRow("Off the mountain", offMountainValue(resort))}
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
            <span class="range-pin__flag">${weakFloor ? `<span class="inline-icon-sm">${ICONS.warning}</span> ` : ""}${capitalize(SKILL_LABEL[range.floor])}</span>
            <span class="range-pin__marker range-pin__marker--circle"></span>
          </div>
          <div class="range-pin range-pin--ceiling ${ceilingAtEdge ? "range-pin--edge-end" : ""}" id="range-pin-ceiling" style="left:100%">
            <span class="range-pin__flag">${weakCeiling ? `<span class="inline-icon-sm">${ICONS.warning}</span> ` : ""}${capitalize(SKILL_LABEL[range.ceiling])}</span>
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

  // Back, at the top, above the card — and ONLY when this session generated
  // the result. `origin` is set by the quiz and by a Chase row tap; a cold
  // #result= link has none.
  //
  // A cold-landed result deliberately gets no back control at all, and that is
  // a decision rather than an omission. It is not a leaf of anything: nobody
  // navigated into it, there is no list it belongs to, and the screen is
  // already asserted to carry zero nav chrome (verify_share_and_offline) —
  // it is a share artifact, and the app's front door for whoever opened it.
  // Its honest destination is already in the footer, named plainly: "See all"
  // (P6, 2026-11-21, which also removed "Make your own pick"). A control at the
  // top saying "back" to someone who has never been anywhere would be the
  // dishonest kind of affordance this whole change exists to remove.
  const origin = state.routeParams.origin;
  const backHtml =
    origin === "chase" ? leafBackHtml("result-leaf-back", "Back to Chase", true) :
    origin === "plan" ? leafBackHtml("result-leaf-back", "Back to your answers", true) :
    origin === "picks" ? leafBackHtml("result-leaf-back", "Back to Picks", true) :
    origin === "game" ? leafBackHtml("result-leaf-back", "Back to Sticker Check", true) :
    origin === "rope" ? leafBackHtml("result-leaf-back", "Back to Rope Drop", true) :
    // A cold-landed visitor has no history to go back to, and the circular
    // sticker that used to sit top-right read as an avatar, so it looked like
    // a profile link (Director, 2026-11-23). The site name says what this is,
    // which an icon cannot, and it is the one control these visitors need.
    leafBackHtml("result-leaf-home", "Rather Be Knee Deep", false);
  // HR-10: "Your pick" only where the user actually made one, in Plan. A Chase
  // or Picks row is a resort you tapped, not your pick. A cold-landed link
  // keeps "Their pick": someone chose to send it.
  const eyebrow = origin === "plan" ? "Your pick" : !origin ? "Their pick" : "";
  const shareLabel = origin === "plan" || !origin ? "Share this pick" : "Share";
  // HR-9: the one link under Share depends on how you got here. A cold-landed
  // reader gets a way to find their own; a Plan result gets a way to change an
  // answer; from Chase or Picks the nav and Back already cover it.
  const footerLink =
    !origin ? `<button class="btn-text" id="result-find-yours" type="button" style="text-align:center">Find yours →</button>` :
    origin === "plan" ? `<button class="btn-text" id="result-change-answer" type="button" style="text-align:center">Change an answer</button>` :
    "";
  const hasReasons = displayBullets.length > 0;
  const pagerHtml = resultPagerHtml(state.routeParams, resort);

  main.innerHTML = `
    <div class="result-wrap">
      <div class="result-topbar">${backHtml || "<span></span>"}<span class="result-topbar__end">
        <button class="icon-btn" id="share-btn-top" type="button" aria-label="${escapeHtml(shareLabel)}">${ICONS.share}</button>
      </span></div>
      ${pagerHtml}
      <article class="result-card" id="result-card">
        ${eyebrow ? `<p class="result-eyebrow label reveal-hidden">${eyebrow}</p>` : ""}
        <div class="result-layout">
        <div class="result-layout__lead">
        <div class="badge-panel reveal-hidden" role="img" aria-label="${escapeHtml(altText)}">${badge}</div>
        <h1 class="display-hero result-headline reveal-hidden" tabindex="-1">
          <span class="resort-name">${escapeHtml(resort.name)}</span>
          <span class="location body-md">${escapeHtml(location)}</span>
        </h1>
        ${hasReasons ? `<h2 class="visually-hidden">Why</h2>
        <ul class="reason-list">
          ${displayBullets.map((b) => `<li class="reason-bullet reveal-hidden"><span class="reason-bullet__icon">${ICONS.checkCircle}</span><span class="reason-bullet__text body-md">${escapeHtml(b)}</span></li>`).join("")}
        </ul>` : ""}
        </div>
        <div class="result-layout__detail">
        <div class="stat-strip stat-strip--quad reveal-hidden" id="stat-strip">${buildStatStrip(resort)}</div>
        ${buildTerrainMixStrip(resort)}
        ${hasHotTake ? `
          <div class="hot-take reveal-hidden" id="hot-take">
            <div class="hot-take__header">
              <span class="hot-take__avatar" aria-hidden="true">N</span>
              <span class="hot-take__label label">Nicole's Hot Take</span>
              ${resort.hot_take.rating ? `<span class="hot-take__rating data-inline">${escapeHtml(String(resort.hot_take.rating))}/10</span>` : ""}
            </div>
            <p class="hot-take__body">${escapeHtml(resort.hot_take.text)}</p>
          </div>` : ""}
        ${buildDetailNotes(resort)}
        ${shared.showRangeReadout ? buildRangeReadoutHtml(resort, shared.range).replace('class="range-readout"', 'class="range-readout reveal-hidden"') : ""}
        ${resortLinksHtml(resort)}
        <div class="footer-cta reveal-hidden" id="footer-cta">
          <button class="btn btn-primary btn-block" id="share-btn" type="button">${ICONS.share} ${shareLabel}</button>
          ${footerLink}
        </div>
        </div>
        </div>
      </article>
    </div>`;

  // Back: history.back() when there's an in-app page behind (HR-1), so the
  // browser's own Back and this control land in the same place, scrolled to
  // the row you opened (HR-11). Otherwise the explicit route, as before.
  const goBackToOrigin = () => {
    if (canGoBackInApp()) { history.back(); return; }
    origin === "picks" ? navigate("nicoles", { focusResort: resort.id })
      : origin === "chase" ? navigate("chase", { focusResort: resort.id })
      : origin === "game" ? navigate("game")
      : origin === "rope" ? navigate("rope")
      : navigate("plan");
  };
  const leafBack = document.getElementById("result-leaf-back");
  if (leafBack) leafBack.addEventListener("click", goBackToOrigin);
  const leafHome = document.getElementById("result-leaf-home");
  if (leafHome) leafHome.addEventListener("click", () => navigate("splash"));

  document.getElementById("share-btn").addEventListener("click", () => shareResult(resort, shared));
  document.getElementById("share-btn-top").addEventListener("click", () => shareResult(resort, shared));
  const findYours = document.getElementById("result-find-yours");
  if (findYours) findYours.addEventListener("click", () => { state.quizAnswers = {}; state.quizStepIdx = 0; navigate("plan"); });
  const changeAnswer = document.getElementById("result-change-answer");
  if (changeAnswer) changeAnswer.addEventListener("click", goBackToOrigin);
  main.querySelectorAll(".stat-tile__expand-btn, .notes-row__expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
    });
  });

  // HR-6: only a Plan result is "your match".
  document.title = origin === "plan" ? `${resort.name} — your ski trip match`
    : !origin ? `${resort.name} — a ski trip match`
    : `${resort.name} — Rather Be Knee Deep`;
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

  const browseDir = state.routeParams.browseDir;
  if (browseDir) {
    delete state.routeParams.browseDir;
    slideInResultCard(document.getElementById("result-card"), browseDir);
  } else {
    revealResultCard(document.getElementById("result-card"), { hasRangeReadout: shared.showRangeReadout, hasHotTake });
  }
  wireResultBrowse(main);

  // M9 fix: every other route calls focusHeading(main); renderResult never
  // did, so keyboard users landing on the result screen (finishing the quiz,
  // or — the more common case per strategy.md — a cold share-link load) got
  // no positional signal at all. The aria-live announcement inside
  // revealResultCard is a good belt, but a live-region update firing this
  // close to initial page load is a known race with some AT — a focus move
  // is reliably detected regardless of load timing.
  const keepFocus = state.routeParams.browseFocus;
  delete state.routeParams.browseFocus;
  const pagerBtn = keepFocus && document.getElementById(keepFocus);
  if (pagerBtn && !pagerBtn.disabled) pagerBtn.focus({ preventScroll: true });
  else focusHeading(main);
}

// ---------------------------------------------------------------------------
// Browse through resort pages (2026-11-23, Director's call). A resort page
// opened from Chase or Picks carries that list's order in `seq`, so you can
// swipe (or tap the arrows, or press ←/→) to the next resort on the list
// without going back to it each time. A swipe swaps the page in place and
// replaces the history entry rather than pushing one: Back still goes
// straight to the list, landing on the resort you were last looking at
// (HR-11), not back through every page you swiped past.
// ---------------------------------------------------------------------------
const BROWSE_LIST_NAME = { chase: "Chase", picks: "Picks" };

function resultBrowsePosition(params) {
  const seq = params && params.seq;
  if (!seq || seq.length < 2 || !BROWSE_LIST_NAME[params.origin] || !params.shared) return null;
  const idx = seq.indexOf(params.shared.rid);
  if (idx < 0) return null;
  return { seq, idx, prev: idx > 0 ? seq[idx - 1] : null, next: idx < seq.length - 1 ? seq[idx + 1] : null };
}

function resultPagerHtml(params, resort) {
  const pos = resultBrowsePosition(params);
  if (!pos) return "";
  const listName = BROWSE_LIST_NAME[params.origin];
  const btn = (id, rid, dir) => {
    const r = rid && RESORTS_BY_ID[rid];
    const label = r ? `${dir === "prev" ? "Previous" : "Next"} on ${listName}: ${r.name}` : "";
    const icon = dir === "prev" ? ICONS.chevronLeft : ICONS.chevronRight;
    const name = r ? `<span class="result-pager__name">${escapeHtml(r.name)}</span>` : "";
    return r
      ? `<button type="button" class="result-pager__btn result-pager__btn--${dir}" id="${id}" data-rid="${escapeHtml(rid)}" aria-label="${escapeHtml(label)}">${dir === "prev" ? icon + name : name + icon}</button>`
      : `<span class="result-pager__btn result-pager__btn--${dir} result-pager__btn--end" aria-hidden="true"></span>`;
  };
  return `<nav class="result-pager" aria-label="Browse ${listName}">
      ${btn("result-pager-prev", pos.prev, "prev")}
      <span class="result-pager__count data-inline" aria-hidden="true">${pos.idx + 1} / ${pos.seq.length}</span>
      ${btn("result-pager-next", pos.next, "next")}
    </nav>`;
}

function resultParamsForBrowse(origin, rid) {
  if (origin === "chase" && typeof chaseResultParams === "function") return chaseResultParams(rid);
  if (origin === "picks" && typeof picksResultParams === "function") return picksResultParams(rid);
  return null;
}

// dir: 1 = next, -1 = previous. focusId: the pager button to keep focus on
// when the arrows were used, so a keyboard user can keep pressing.
function browseResult(dir, focusId) {
  if (state.route !== "result") return false;
  const cur = state.routeParams || {};
  const pos = resultBrowsePosition(cur);
  if (!pos) return false;
  const rid = dir > 0 ? pos.next : pos.prev;
  if (!rid) {
    // End of the list: a small nudge says so, rather than nothing happening.
    const card = document.getElementById("result-card");
    if (card && !reduceMotion()) {
      const x = dir > 0 ? -10 : 10;
      card.animate([{ transform: "translateX(0)" }, { transform: `translateX(${x}px)` }, { transform: "translateX(0)" }], { duration: 220, easing: "cubic-bezier(.2,0,0,1)" });
    }
    announce("reveal-announcer", dir > 0 ? `That's the last one on ${BROWSE_LIST_NAME[cur.origin]}.` : `That's the first one on ${BROWSE_LIST_NAME[cur.origin]}.`);
    return true;
  }
  const params = resultParamsForBrowse(cur.origin, rid);
  if (!params) return false;
  params.seq = pos.seq;
  params.browseDir = dir;
  if (focusId) params.browseFocus = focusId;
  state.routeParams = params;
  try {
    const depth = history.state && history.state.rbkd ? history.state.depth : 0;
    const snap = historySnapshot(depth);
    snap.params = Object.assign({}, snap.params);
    delete snap.params.browseDir;
    delete snap.params.browseFocus;
    history.replaceState(snap, "", location.href);
  } catch (e) { /* ignore */ }
  syncHash();
  window.scrollTo(0, 0);
  render();
  const r = RESORTS_BY_ID[rid];
  announce("reveal-announcer", `${r.name}, ${pos.seq.indexOf(rid) + 1} of ${pos.seq.length} on ${BROWSE_LIST_NAME[cur.origin]}.`);
  return true;
}

function slideInResultCard(card, dir) {
  if (!card) return;
  card.querySelectorAll(".reveal-hidden").forEach((n) => { n.classList.remove("reveal-hidden"); n.style.opacity = ""; });
  ["#range-bridge", "#range-pin-floor", "#range-pin-ceiling"].forEach((sel) => {
    const node = card.querySelector(sel);
    if (node) node.classList.add("is-revealed");
  });
  if (reduceMotion()) {
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease", fill: "both" });
    return;
  }
  const from = dir > 0 ? 32 : -32;
  card.animate(
    [{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: "translateX(0)" }],
    { duration: 240, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }
  );
}

function wireResultBrowse(main) {
  if (!resultBrowsePosition(state.routeParams)) return;
  const prev = document.getElementById("result-pager-prev");
  const next = document.getElementById("result-pager-next");
  if (prev) prev.addEventListener("click", () => browseResult(-1, "result-pager-prev"));
  if (next) next.addEventListener("click", () => browseResult(1, "result-pager-next"));

  // Swipe: a deliberate, mostly-horizontal flick. Touches that start at the
  // very edge of the screen are left alone, since that's the phone's own
  // back/forward gesture, and so are touches inside anything that scrolls
  // sideways on its own.
  const wrap = main.querySelector(".result-wrap");
  if (!wrap) return;
  let start = null;
  wrap.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { start = null; return; }
    const t = e.touches[0];
    const edge = 24;
    if (t.clientX < edge || t.clientX > window.innerWidth - edge || inSideScroller(e.target, wrap)) { start = null; return; }
    start = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });
  wrap.addEventListener("touchend", (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y, dt = Date.now() - start.t;
    start = null;
    if (dt > 800 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    browseResult(dx < 0 ? 1 : -1);
  }, { passive: true });
  wrap.addEventListener("touchcancel", () => { start = null; }, { passive: true });
}

function inSideScroller(node, stop) {
  for (let el = node; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
  }
  return false;
}

// ←/→ on a resort page opened from Chase or Picks. Not while typing, and not
// with a modifier held (Alt+← is the browser's own Back).
document.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
  if (state.route !== "result" || !resultBrowsePosition(state.routeParams)) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault();
  const fromPager = t && t.id && t.id.startsWith("result-pager-") ? (e.key === "ArrowRight" ? "result-pager-next" : "result-pager-prev") : null;
  browseResult(e.key === "ArrowRight" ? 1 : -1, fromPager);
});

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

  push("#resort-links", [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: nextBlockStart, easing: "cubic-bezier(.2,0,0,1)", fill: "both" });
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
  // /r/<id> is a static page whose link preview shows this resort's badge;
  // it hands the hash straight on to the app (see build.py).
  const url = `${location.origin}/r/${resort.id}#result=${token}`;
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

// Home button: one delegated listener for every .home-link (section headers
// and the resort page). Modified clicks fall through to the real href="/".
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest(".home-link");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate("splash");
});
