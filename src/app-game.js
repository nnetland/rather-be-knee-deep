// Sticker Check — name the resort behind five badges (2026-11-23, Director).
//
// The concept and the reasoning behind it are in the project doc
// "Badge game - concept". In short:
//  · Four options and one tap per badge. Swipe yes/no was cut because half the
//    answers would be right by chance, which makes a score mean little.
//  · Five badges a round, at least four regions, never more than two from one.
//    The draw leans towards badges you haven't named yet.
//  · A daily round, the same five for everyone that day, seeded from the local
//    date so it works offline. Its shared result carries no names or art.
//  · A Badge book of everything you've named. It's a collection, not a streak:
//    there is no streak counter and no loss language.
//  · The only way in is the tile on the home page.
//
// What is remembered: badges named, best score, rounds played, today's daily.
// It's kept in localStorage on this device only. If storage is blocked, the
// game still plays, and just forgets when the page closes.

const GAME_KEY = "rbkd.stickercheck.v1";
const GAME_ROUND = 5;
const GAME_IDS = RESORTS.map((r) => r.id).filter((id) => GAME_CONTENT[id] && BADGE_ASSIGNMENTS[id]);
// Two pairs that the drawings can't separate fairly. Indianhead and Blackjack
// are the two halves of Snowriver, so neither is offered as a wrong answer for
// the other. Sunday River and Sugarloaf both read as "a Maine animal", so they
// never come up as answers in the same round.
const GAME_NOT_AS_OPTIONS = { "indianhead-mi": "blackjack-mi", "blackjack-mi": "indianhead-mi" };
const GAME_NOT_SAME_ROUND = { "sunday-river-me": "sugarloaf-me", "sugarloaf-me": "sunday-river-me" };
// Alaska has one badge, so its wrong answers come from Canada.
const GAME_OPTION_REGION = { "Alaska": "Canada" };

// Colour words: the screen-reader sentence says the colour, and the reveal
// says what it means.
const GAME_COLOUR = {
  coral: { word: "coral", meaning: "après" },
  mint: { word: "mint", meaning: "trees and family" },
  amber: { word: "amber", meaning: "Western and budget" },
  indigo: { word: "indigo", meaning: "big vertical" },
  cold: { word: "blue", meaning: "backcountry" },
  teal: { word: "teal", meaning: "deep powder" },
};

const GAME_SCORE_LINES = [
  "Fresh snow, fresh start.",
  "Still on the bunny hill.",
  "You know the lodges, not the lifts.",
  "Solid. You've done your homework.",
  "One more trip and you'd have it.",
  "First chair, every time.",
];

// --- storage ---------------------------------------------------------------
function gameLoad() {
  const empty = { found: [], best: null, rounds: 0, daily: null };
  try {
    const raw = window.localStorage.getItem(GAME_KEY);
    if (!raw) return empty;
    return Object.assign(empty, JSON.parse(raw));
  } catch (e) { return empty; }
}
let gameMemory = gameLoad();
function gameSave() {
  try { window.localStorage.setItem(GAME_KEY, JSON.stringify(gameMemory)); } catch (e) { /* plays on without it */ }
}

function gameToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function gameDateLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// --- drawing a round -------------------------------------------------------
function gameRegion(id) { return badgeRegionCluster(RESORTS_BY_ID[id]); }
function gamePalette(id) { return BADGE_ASSIGNMENTS[id].paletteKey; }

function gamePickWeighted(items, weights, rand) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}
function gameShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Five answers: two easy, two medium, one deep cut, in a shuffled order, from
// at least four regions with no more than two from any one. The daily round
// passes `seeded` and weighs every badge the same, so everyone gets the same
// five. An endless round weighs badges you haven't named three to one.
function gameDrawAnswers(rand, seeded) {
  const found = new Set(seeded ? [] : gameMemory.found);
  const slots = gameShuffle([1, 1, 2, 2, 3], rand);
  const picked = [];
  const regionCount = {};
  slots.forEach((difficulty, k) => {
    const distinct = Object.keys(regionCount).length;
    const fits = (id) => {
      if (picked.includes(id)) return false;
      if (picked.some((p) => GAME_NOT_SAME_ROUND[p] === id)) return false;
      const reg = gameRegion(id);
      const n = regionCount[reg] || 0;
      if (n >= 2) return false;
      const distinctAfter = distinct + (n ? 0 : 1);
      return distinctAfter + (GAME_ROUND - k - 1) >= 4;
    };
    let pool = GAME_IDS.filter((id) => GAME_CONTENT[id].d === difficulty && fits(id));
    if (!pool.length) pool = GAME_IDS.filter(fits);
    const id = gamePickWeighted(pool, pool.map((i) => (found.has(i) ? 1 : 3)), rand);
    picked.push(id);
    regionCount[gameRegion(id)] = (regionCount[gameRegion(id)] || 0) + 1;
  });
  return picked;
}

// Three wrong answers: two from the answer's region and one that shares its
// colour, so the drawing has to do the work. Falls back to the region alone
// where the colour has no one left.
function gameOptions(answer, rand) {
  const reg = GAME_OPTION_REGION[gameRegion(answer)] || gameRegion(answer);
  const ok = (id) => id !== answer && GAME_NOT_AS_OPTIONS[answer] !== id;
  const sameRegion = gameShuffle(GAME_IDS.filter((id) => ok(id) && gameRegion(id) === reg), rand);
  const wrong = sameRegion.slice(0, 2);
  const sameColour = gameShuffle(GAME_IDS.filter((id) => ok(id) && !wrong.includes(id)
    && gamePalette(id) === gamePalette(answer) && gameRegion(id) !== gameRegion(answer)), rand);
  wrong.push(sameColour[0] || sameRegion[2]);
  return gameShuffle([answer].concat(wrong.filter(Boolean)), rand);
}

function gameNewRound(mode) {
  const today = gameToday();
  const rand = mode === "daily" ? mulberry32(hashStr("sticker-check-" + today)) : Math.random;
  const answers = gameDrawAnswers(rand, mode === "daily");
  state.game = {
    mode, date: today, idx: 0, phase: "question",
    round: answers.map((id) => ({ id, options: gameOptions(id, rand), pick: null })),
  };
}

// --- rendering -------------------------------------------------------------
function renderGameRoute(main) {
  if (!state.game) state.game = { phase: "home" };
  renderGame(main);
  focusHeading(main);
}

function renderGame(main) {
  const g = state.game;
  if (g.phase === "question" || g.phase === "reveal") renderGameQuestion(main);
  else if (g.phase === "done") renderGameDone(main);
  else if (g.phase === "book") renderGameBook(main);
  else renderGameHome(main);
  document.title = "Sticker Check — Rather Be Knee Deep";
  setOgMeta({ title: "Sticker Check", description: "Five resort badges. Name the resort behind each one." });
}

function gameGo(main, patch) {
  Object.assign(state.game, patch);
  window.scrollTo(0, 0);
  renderGame(main);
  focusHeading(main);
}

function gameBookCountHtml() {
  return `<span class="data-inline">${gameMemory.found.length} of ${GAME_IDS.length}</span>`;
}

function renderGameHome(main) {
  const today = gameToday();
  const daily = gameMemory.daily && gameMemory.daily.date === today ? gameMemory.daily : null;
  main.innerHTML = `
    <div class="page-column game">
      ${pageHeaderHtml("Sticker Check", "Five stickers. Name the resort behind each one.")}
      <div class="game-actions">
        <button class="btn btn-primary btn-block" id="game-play" type="button">Play a round</button>
        <button class="btn btn-secondary btn-block" id="game-daily" type="button">${daily
          ? `Today's round: <span class="data-inline">${daily.score}/${GAME_ROUND}</span>`
          : "Daily round"}</button>
        <p class="body-sm game-note">${daily ? "Same five for everyone today. Back tomorrow." : "Same five for everyone today."}</p>
      </div>
      <button class="game-book-link" id="game-book" type="button">
        <span>Badge book</span>${gameBookCountHtml()}
      </button>
      ${gameMemory.best !== null ? `<p class="body-sm game-note">Best round: <span class="data-inline">${gameMemory.best}/${GAME_ROUND}</span> · Rounds played: <span class="data-inline">${gameMemory.rounds}</span></p>` : ""}
    </div>`;
  document.getElementById("game-play").addEventListener("click", () => { gameNewRound("endless"); gameGo(main, {}); });
  document.getElementById("game-daily").addEventListener("click", () => {
    if (daily) {
      state.game = { mode: "daily", date: today, phase: "done", round: daily.round || [], idx: GAME_ROUND - 1, replay: true, score: daily.score, marks: daily.marks };
      gameGo(main, {});
    } else { gameNewRound("daily"); gameGo(main, {}); }
  });
  document.getElementById("game-book").addEventListener("click", () => gameGo(main, { phase: "book", from: "home" }));
}

function gameBadgeHtml(id, context) {
  return badgeSvg(RESORTS_BY_ID[id], context);
}

function renderGameQuestion(main) {
  const g = state.game;
  const q = g.round[g.idx];
  const c = GAME_CONTENT[q.id];
  const col = GAME_COLOUR[gamePalette(q.id)];
  const revealed = g.phase === "reveal";
  const right = revealed && q.pick === q.id;
  const resort = RESORTS_BY_ID[q.id];
  const label = revealed
    ? `${resort.name} badge. ${c.alt} Background: ${col.word}.`
    : `Sticker ${g.idx + 1} of ${GAME_ROUND}. ${c.alt} Background: ${col.word}.`;
  const last = g.idx === GAME_ROUND - 1;
  const optionHtml = (id) => {
    const isAnswer = id === q.id, isPick = id === q.pick;
    const cls = !revealed ? "" : isAnswer ? " game-option--right" : isPick ? " game-option--wrong" : " game-option--other";
    const mark = !revealed ? "" : isAnswer ? `<span class="game-option__mark">${ICONS.check}<span class="visually-hidden"> (the answer)</span></span>`
      : isPick ? `<span class="game-option__mark game-option__mark--x" aria-hidden="true">&times;</span><span class="visually-hidden"> (your pick)</span>` : "";
    return `<li><button class="game-option${cls}" type="button" data-id="${id}"${revealed ? ' aria-disabled="true"' : ""}>
      <span class="game-option__label">${escapeHtml(RESORTS_BY_ID[id].name)}</span>${mark}</button></li>`;
  };
  main.innerHTML = `
    <div class="page-column game">
      <div class="game-topbar">
        <button class="leaf-back" id="game-quit" type="button"><span class="leaf-back__arrow" aria-hidden="true">&larr;</span><span>Sticker Check</span></button>
        <span class="data-inline game-progress">${g.mode === "daily" ? `Daily · ${escapeHtml(gameDateLabel(g.date))} · ` : ""}${g.idx + 1}/${GAME_ROUND}</span>
      </div>
      <h1 class="visually-hidden">${revealed ? escapeHtml(resort.name) : `Sticker ${g.idx + 1} of ${GAME_ROUND}`}</h1>
      <div class="game-badge${revealed ? " game-badge--revealed" : ""}" role="img" aria-label="${escapeHtml(label)}">${gameBadgeHtml(q.id, "game")}</div>
      <p class="game-question body-md" id="game-q">Which resort is this?</p>
      <ul class="game-options" role="list" aria-labelledby="game-q">${q.options.map(optionHtml).join("")}</ul>
      ${revealed ? `
        <div class="game-reveal">
          <p class="game-verdict body-md"><strong>${right ? "Correct." : "Not this time."}</strong> ${right ? "" : `It's ${escapeHtml(resort.name)}. `}${escapeHtml(c.why)}</p>
          <p class="game-colour body-sm"><span class="game-colour__dot game-colour__dot--${gamePalette(q.id)}" aria-hidden="true"></span>${escapeHtml(col.word[0].toUpperCase() + col.word.slice(1))}: ${escapeHtml(col.meaning)}</p>
          <button class="btn btn-primary btn-block" id="game-next" type="button">${last ? "See your score" : "Next sticker"}</button>
          <button class="btn-text game-see" id="game-see" type="button">See ${escapeHtml(resort.name)} →</button>
        </div>` : ""}
    </div>`;

  document.getElementById("game-quit").addEventListener("click", () => gameGo(main, { phase: "home" }));
  if (!revealed) {
    main.querySelectorAll(".game-option").forEach((btn) => btn.addEventListener("click", () => {
      q.pick = btn.dataset.id;
      const ok = q.pick === q.id;
      if (ok && !gameMemory.found.includes(q.id)) { gameMemory.found.push(q.id); gameSave(); }
      Object.assign(g, { phase: "reveal" });
      renderGame(main);
      const announcer = document.getElementById("reveal-announcer");
      if (announcer) announcer.textContent = ok ? `Correct. ${resort.name}.` : `Not this time. It's ${resort.name}.`;
      const next = document.getElementById("game-next");
      if (next) next.focus({ preventScroll: true });
    }));
  } else {
    document.getElementById("game-next").addEventListener("click", () => {
      if (!last) { gameGo(main, { idx: g.idx + 1, phase: "question" }); return; }
      gameFinish();
      gameGo(main, { phase: "done" });
    });
    document.getElementById("game-see").addEventListener("click", () => {
      const payload = { v: 1, rid: q.id, reasonBullets: resort.character_note ? [sanitizeDatasetProse(resort.character_note)] : [], showRangeReadout: false, range: null };
      navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true, origin: "game" });
    });
  }
}

function gameFinish() {
  const g = state.game;
  g.marks = g.round.map((q) => (q.pick === q.id ? 1 : 0));
  g.score = g.marks.reduce((a, b) => a + b, 0);
  gameMemory.rounds += 1;
  if (gameMemory.best === null || g.score > gameMemory.best) gameMemory.best = g.score;
  if (g.mode === "daily") {
    gameMemory.daily = { date: g.date, score: g.score, marks: g.marks, round: g.round.map((q) => ({ id: q.id, pick: q.pick, options: q.options })) };
  }
  gameSave();
}

// The shareable line. Squares only, no names, so a daily result spoils nothing.
function gameShareText(g) {
  const squares = g.marks.map((m) => (m ? "■" : "□")).join("");
  const head = g.mode === "daily" ? `Sticker Check · ${gameDateLabel(g.date)}` : "Sticker Check";
  return `${head}\n${g.score}/${GAME_ROUND} ${squares}\n${location.origin}`;
}

function renderGameDone(main) {
  const g = state.game;
  const daily = g.mode === "daily";
  main.innerHTML = `
    <div class="page-column game">
      <div class="game-topbar">
        <button class="leaf-back" id="game-quit" type="button"><span class="leaf-back__arrow" aria-hidden="true">&larr;</span><span>Sticker Check</span></button>
      </div>
      <div class="game-card" id="game-card">
        <p class="data-label">${daily ? `Sticker Check · Daily · ${escapeHtml(gameDateLabel(g.date))}` : "Sticker Check"}</p>
        <h1 class="game-score"><span class="data-stat game-score__n">${g.score}/${GAME_ROUND}</span>
          <span class="game-score__line body-md">${escapeHtml(GAME_SCORE_LINES[g.score])}</span></h1>
        <ol class="game-marks" role="list" aria-label="${g.score} of ${GAME_ROUND} right">
          ${g.marks.map((m, i) => `<li class="game-mark${m ? " game-mark--right" : ""}"><span class="visually-hidden">Sticker ${i + 1}: ${m ? "right" : "missed"}</span></li>`).join("")}
        </ol>
        ${!daily ? `<ul class="game-recap" role="list">${g.round.map((q) => `
          <li class="game-recap__item${q.pick === q.id ? "" : " game-recap__item--missed"}">
            <span class="game-recap__badge" aria-hidden="true">${gameBadgeHtml(q.id, "recap")}</span>
            <span class="body-sm">${escapeHtml(RESORTS_BY_ID[q.id].name)}</span>
          </li>`).join("")}</ul>` : ""}
      </div>
      <div class="game-actions">
        <button class="btn btn-secondary btn-block" id="game-copy" type="button">${ICONS.share} Copy result</button>
        <button class="btn btn-primary btn-block" id="game-again" type="button">Play ${daily ? "a" : "another"} round</button>
      </div>
      <button class="game-book-link" id="game-book" type="button"><span>Badge book</span>${gameBookCountHtml()}</button>
      ${daily ? `<p class="body-sm game-note">Same five for everyone on ${escapeHtml(gameDateLabel(g.date))}, by your device's date. A new set tomorrow.</p>` : ""}
    </div>`;
  document.getElementById("game-quit").addEventListener("click", () => gameGo(main, { phase: "home" }));
  document.getElementById("game-again").addEventListener("click", () => { gameNewRound("endless"); gameGo(main, {}); });
  document.getElementById("game-book").addEventListener("click", () => gameGo(main, { phase: "book", from: "done" }));
  document.getElementById("game-copy").addEventListener("click", async () => {
    const text = gameShareText(g);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { /* cancelled — fall through */ }
    }
    try { await navigator.clipboard.writeText(text); showToast("Result copied"); }
    catch (e) { showToast(text.replace(/\n/g, " · ")); }
  });
}

function renderGameBook(main) {
  const g = state.game;
  const found = new Set(gameMemory.found);
  const ids = GAME_IDS.slice().sort((a, b) => RESORTS_BY_ID[a].name.localeCompare(RESORTS_BY_ID[b].name));
  const slot = (id) => {
    const col = GAME_COLOUR[gamePalette(id)];
    if (found.has(id)) {
      return `<li class="book-slot"><span class="book-slot__badge" aria-hidden="true">${gameBadgeHtml(id, "book")}</span>
        <span class="book-slot__name body-sm">${escapeHtml(RESORTS_BY_ID[id].name)}</span></li>`;
    }
    return `<li class="book-slot book-slot--empty"><span class="book-slot__ghost book-slot__ghost--${gamePalette(id)}" aria-hidden="true">?</span>
      <span class="visually-hidden">Not named yet, ${escapeHtml(col.word)} badge</span></li>`;
  };
  const named = ids.filter((id) => found.has(id));
  const unnamed = ids.filter((id) => !found.has(id));
  main.innerHTML = `
    <div class="page-column game">
      <div class="game-topbar">
        <button class="leaf-back" id="game-back" type="button"><span class="leaf-back__arrow" aria-hidden="true">&larr;</span><span>${g.from === "done" ? "Back to your score" : "Sticker Check"}</span></button>
      </div>
      ${pageHeaderHtml("Badge book", `You've named ${gameMemory.found.length} of ${GAME_IDS.length}. Name a badge in a round and it lands here.`)}
      <ul class="book-grid" role="list">${named.concat(unnamed).map(slot).join("")}</ul>
      ${pageAboutHtml("About the Badge book", "<p>Kept on this device only. Clearing your browser data clears it too.</p>")}
    </div>`;
  document.getElementById("game-back").addEventListener("click", () => gameGo(main, { phase: g.from === "done" ? "done" : "home" }));
}
