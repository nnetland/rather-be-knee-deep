// Rope Drop — a daily ski trivia round (2026-11-26, Director).
//
// The concept and the decisions behind it are in the project doc
// "Daily depth game - concept". In short:
//  · Seven questions a day, the same for everyone: two green circles, two blue
//    squares, two black diamonds and one double black. Multiple choice only,
//    one tap, no timer.
//  · Points by rating (10 / 20 / 30 / 50, 170 a day). Every 10 points is an
//    inch of snow on your snowpack, which only ever grows. It never resets.
//  · A rating from your last 7 rounds played: "You're skiing blues." It moves
//    up and down, so the snowpack rewards coming back and the rating rewards
//    knowing your stuff.
//  · One play a day. Answers are saved as you go, so leaving mid-round and
//    coming back picks up where you were rather than offering a do-over.
//  · No streaks, timers, leaderboards or accounts. Kept in localStorage on this
//    device only; if storage is blocked the round still plays.
//
// The daily set: each rating has its own pool (hand-written questions from
// rope-drop-questions.js, plus questions generated here from data.js). Each
// pool is shuffled with a fixed seed and walked one day at a time, so nothing
// repeats until a whole pool has been used, then it reshuffles. Everyone on
// the same local date gets the same seven, offline.

const RD_KEY = "rbkd.ropedrop.v1";
const RD_ORDER = ["g", "g", "b", "b", "k", "k", "d"];
const RD_POINTS = { g: 10, b: 20, k: 30, d: 50 };
const RD_MAX = RD_ORDER.reduce((n, r) => n + RD_POINTS[r], 0); // 170
const RD_RATING = {
  g: { name: "Green circle", plural: "greens" },
  b: { name: "Blue square", plural: "blues" },
  k: { name: "Black diamond", plural: "blacks" },
  d: { name: "Double black", plural: "double blacks" },
};
// Day 1 is the launch day. The number shown is "Rope Drop #N".
const RD_EPOCH = [2026, 11, 27];

// The snowpack only grows, so the milestones run from snow into ice.
const RD_MILESTONES = [
  { at: 1, name: "First Flakes", note: "Your snowpack has started." },
  { at: 25, name: "Dusting", note: "Enough to see your tracks." },
  { at: 75, name: "Base Building", note: "The early-season base is coming in." },
  { at: 150, name: "Opening Day", note: "Enough base to open the mountain." },
  { at: 300, name: "Midwinter", note: "Deep in the season now." },
  { at: 500, name: "Deep Winter", note: "Knee deep and then some." },
  { at: 800, name: "Powder Hound", note: "You chase it, and it shows." },
  { at: 1200, name: "Record Season", note: "Mt. Baker territory." },
  { at: 2000, name: "Firn", note: "Old snow that has survived a full year." },
  { at: 3500, name: "Névé", note: "Firn packing down on its way to ice." },
  { at: 5000, name: "Glacier", note: "Your snowpack has turned to ice." },
  { at: 8000, name: "Icefield", note: "A glacier that spills over the peaks." },
  { at: 12000, name: "Ice Age", note: "The whole map is under your snow." },
];

const RD_SCORE_LINES = [
  [0, "Fresh tracks tomorrow."],
  [40, "Warming up on the greens."],
  [80, "Solid laps."],
  [120, "Charging the blacks."],
  [160, "Nearly perfect. One edge caught."],
  [170, "Top to bottom, no falls."],
];

// --- storage ---------------------------------------------------------------
function rdEmpty() { return { points: 0, rounds: 0, best: null, recent: [], today: null }; }
function rdLoad() {
  try {
    const raw = window.localStorage.getItem(RD_KEY);
    return raw ? Object.assign(rdEmpty(), JSON.parse(raw)) : rdEmpty();
  } catch (e) { return rdEmpty(); }
}
let rdMemory = rdLoad();
function rdSave() {
  try { window.localStorage.setItem(RD_KEY, JSON.stringify(rdMemory)); } catch (e) { /* plays on without it */ }
}

function rdToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function rdDayIndex(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(RD_EPOCH[0], RD_EPOCH[1] - 1, RD_EPOCH[2])) / 86400000);
  return Math.max(0, days);
}
function rdDateLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rdInches(points) { return Math.floor(points / 10); }
function rdMilestone(inches) {
  let cur = null, next = RD_MILESTONES[0];
  for (const m of RD_MILESTONES) {
    if (inches >= m.at) { cur = m; next = null; } else { next = m; break; }
  }
  return { cur, next };
}
// The rating: the average of the last seven rounds played, once there are three.
function rdRating() {
  const r = rdMemory.recent;
  if (r.length < 3) return null;
  const pct = r.reduce((a, b) => a + b, 0) / r.length / RD_MAX;
  return pct >= 0.85 ? "d" : pct >= 0.65 ? "k" : pct >= 0.4 ? "b" : "g";
}
function rdScoreLine(score) {
  let line = RD_SCORE_LINES[0][1];
  RD_SCORE_LINES.forEach(([at, text]) => { if (score >= at) line = text; });
  return line;
}

// --- the question pools ----------------------------------------------------
// Resort location questions, generated from data.js. Destination resorts are
// green; regional and day-trip hills are blacks, since few people outside
// their region know them.
const RD_STATE_EXCLUDE = {
  // These resorts sit on, or are reached across, a border. The neighbor is
  // never offered as a wrong answer, because it would read as half right.
  "banff-sunshine-ab": ["British Columbia"],
  "grand-targhee-wy": ["Idaho"],
  "heavenly-ca": ["Nevada"],
};
const RD_CMP = {
  vert: { field: "vertical_drop_ft", flag: "vertical", q: "Which of these resorts has the biggest vertical drop?", unit: "ft", r: "k", slots: 5 },
  snow: { field: "avg_annual_snowfall_in", flag: "snowfall", q: "Which of these resorts gets the most snow in an average year?", unit: "in", r: "k", slots: 5 },
  acres: { field: "skiable_acres", flag: "acre", q: "Which of these resorts has the most skiable acres?", unit: "acres", r: "d", slots: 6 },
};
// Left out of the comparisons whatever their confidence: their headline
// numbers bundle several mountains or include cat and hike-to terrain.
const RD_CMP_SKIP = ["powder-mountain-ut", "aspen-snowmass-co", "timberline-or", "indianhead-mi", "blackjack-mi"];

let rdPoolsCache = null;
function rdPools() {
  if (rdPoolsCache) return rdPoolsCache;
  const pools = { g: [], b: [], k: [], d: [] };
  ROPE_DROP_QUESTIONS.forEach((q) => pools[q.r].push({ id: q.id, kind: "q", r: q.r, rid: q.rid || null, cat: q.cat }));
  RESORTS.forEach((r) => {
    const tier = r.scale === "destination" ? "g" : "k";
    pools[tier].push({ id: "st-" + r.id, kind: "state", r: tier, rid: r.id, cat: "resorts" });
  });
  Object.keys(RD_CMP).forEach((key) => {
    const c = RD_CMP[key];
    for (let i = 1; i <= c.slots; i++) pools[c.r].push({ id: `cmp-${key}-${i}`, kind: "cmp", r: c.r, rid: null, cat: "resorts", cmp: key });
  });
  Object.keys(pools).forEach((t) => pools[t].sort((a, b) => (a.id < b.id ? -1 : 1)));
  rdPoolsCache = pools;
  return pools;
}

function rdShuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const rdPermCache = {};
function rdPerm(tier, cycle) {
  const key = tier + ":" + cycle;
  if (!rdPermCache[key]) rdPermCache[key] = rdShuffle(rdPools()[tier], mulberry32(hashStr(`rope-drop-${tier}-cycle-${cycle}`)));
  return rdPermCache[key];
}
function rdEntryAt(tier, pos) {
  const pool = rdPools()[tier];
  return rdPerm(tier, Math.floor(pos / pool.length))[pos % pool.length];
}

function rdFirstSentence(text) {
  if (!text) return "";
  const clean = sanitizeDatasetProse(text);
  const m = clean.match(/^.*?[.!?](\s|$)/);
  const s = (m ? m[0] : clean).trim();
  return s.length <= 170 ? s : "";
}

function rdMakeState(entry, rand) {
  const r = RESORTS_BY_ID[entry.rid];
  const canada = r.country === "Canada";
  const answer = r.state_province;
  const exclude = RD_STATE_EXCLUDE[r.id] || [];
  const places = [...new Set(RESORTS.filter((x) => (x.country === "Canada") === canada).map((x) => x.state_province))];
  if (canada) ["Ontario", "Quebec", "Alberta", "British Columbia", "Manitoba", "Saskatchewan"].forEach((p) => { if (!places.includes(p)) places.push(p); });
  const wrong = rdShuffle(places.filter((p) => p !== answer && !exclude.includes(p)), rand).slice(0, 3);
  return {
    id: entry.id, r: entry.r, cat: "resorts", rid: r.id,
    q: `Which ${canada ? "province" : "state"} is ${r.name} in?`,
    a: answer, options: rdShuffle([answer].concat(wrong), rand),
    fact: rdFirstSentence(r.character_note), src: "app",
  };
}

function rdCmpEligible(c) {
  return RESORTS.filter((r) => typeof r[c.field] === "number" && r.confidence === "high"
    && !RD_CMP_SKIP.includes(r.id)
    && !(r.unverified_fields || []).join(" ").toLowerCase().includes(c.flag));
}
// Four resorts where the winner beats every other option by at least 15%, so
// the answer stays right even if a figure is a little off.
function rdMakeCmp(entry, rand) {
  const c = RD_CMP[entry.cmp];
  const pool = rdShuffle(rdCmpEligible(c), rand);
  for (const winner of pool) {
    const others = pool.filter((r) => r !== winner && r[c.field] * 1.15 <= winner[c.field]);
    if (others.length < 3) continue;
    const picks = [winner].concat(others.slice(0, 3));
    const fmt = (r) => `${r.name} ${r[c.field].toLocaleString("en-US")} ${c.unit}`;
    return {
      id: entry.id, r: entry.r, cat: "resorts", rid: winner.id,
      q: c.q, a: winner.name, options: rdShuffle(picks.map((r) => r.name), rand),
      fact: picks.slice().sort((a, b) => b[c.field] - a[c.field]).map(fmt).join(" · "),
      src: "app",
    };
  }
  return null;
}

function rdMakeQ(entry, rand) {
  if (entry.kind === "state") return rdMakeState(entry, rand);
  if (entry.kind === "cmp") return rdMakeCmp(entry, rand);
  const q = ROPE_DROP_QUESTIONS.find((x) => x.id === entry.id);
  return { id: q.id, r: q.r, cat: q.cat, rid: q.rid || null, q: q.q, a: q.a, options: rdShuffle([q.a].concat(q.w), rand), fact: q.fact, src: q.src };
}

// The seven for a date. Each rating's pool is walked in order, one day after
// another from launch day. A question that would put the same resort in twice,
// or go over a category's daily cap, waits for the next day instead of
// being skipped, so nothing repeats until a whole pool has been used. The plan
// is built forward from day 1 and cached; every device builds the same one.
// Resort questions are the heart of the app, so they get up to five a day.
// Every other category gets three, which keeps the mix varied.
const RD_CAT_CAP = { resorts: 5 };
const rdPlan = { day: -1, cursor: { g: 0, b: 0, k: 0, d: 0 }, waiting: { g: [], b: [], k: [], d: [] }, days: [] };
function rdDayKey(day) {
  const d = new Date(RD_EPOCH[0], RD_EPOCH[1] - 1, RD_EPOCH[2] + day);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function rdPlanDay(day) {
  const rand = mulberry32(hashStr("rope-drop-day-" + rdDayKey(day)));
  const out = [], rids = new Set(), cats = {};
  const fits = (entry) => {
    if (entry.rid && rids.has(entry.rid)) return null;
    if ((cats[entry.cat] || 0) >= (RD_CAT_CAP[entry.cat] || 3)) return null;
    if (out.some((x) => x.id === entry.id)) return null;
    const made = rdMakeQ(entry, rand);
    return made && !(made.rid && rids.has(made.rid)) ? made : null;
  };
  RD_ORDER.forEach((tier) => {
    const waiting = rdPlan.waiting[tier];
    let q = null;
    for (let k = 0; k < waiting.length && !q; k++) {
      q = fits(waiting[k]);
      if (q) waiting.splice(k, 1);
    }
    for (let guard = 0; !q && guard < 60; guard++) {
      const entry = rdEntryAt(tier, rdPlan.cursor[tier]++);
      q = fits(entry);
      if (!q && !waiting.includes(entry)) waiting.push(entry);
    }
    if (!q) q = rdMakeQ(rdEntryAt(tier, rdPlan.cursor[tier]++), rand);
    if (q.rid) rids.add(q.rid);
    cats[q.cat] = (cats[q.cat] || 0) + 1;
    out.push(q);
  });
  return out;
}
function rdRound(dateKey) {
  const day = rdDayIndex(dateKey);
  while (rdPlan.day < day) { rdPlan.day += 1; rdPlan.days[rdPlan.day] = rdPlanDay(rdPlan.day); }
  return rdPlan.days[day];
}

// --- playing ---------------------------------------------------------------
function rdTodayRecord(dateKey) {
  if (!rdMemory.today || rdMemory.today.date !== dateKey) {
    rdMemory.today = { date: dateKey, picks: RD_ORDER.map(() => null), done: false };
  }
  return rdMemory.today;
}
function rdScore(dateKey, picks) {
  const round = rdRound(dateKey);
  return round.reduce((n, q, i) => n + (picks[i] === q.a ? RD_POINTS[q.r] : 0), 0);
}
// Adds a round to the snowpack. Returns the milestone it crossed, if any.
function rdFinalize(rec) {
  if (rec.done) return null;
  const before = rdMilestone(rdInches(rdMemory.points)).cur;
  rec.score = rdScore(rec.date, rec.picks);
  rec.done = true;
  rdMemory.points += rec.score;
  rdMemory.rounds += 1;
  if (rdMemory.best === null || rec.score > rdMemory.best) rdMemory.best = rec.score;
  rdMemory.recent = rdMemory.recent.concat(rec.score).slice(-7);
  const after = rdMilestone(rdInches(rdMemory.points)).cur;
  rec.milestone = after && after !== before ? after.name : null;
  rdSave();
  return rec.milestone;
}
// A round started on an earlier day and left unfinished still counts, with
// what was answered.
function rdSettleOld() {
  const rec = rdMemory.today;
  if (rec && !rec.done && rec.date !== rdToday() && rec.picks.some((p) => p !== null)) rdFinalize(rec);
}

// --- rendering helpers -----------------------------------------------------
function rdShapeHtml(r, extra) {
  const inner = r === "d" ? '<span class="rd-shape__d"></span><span class="rd-shape__d"></span>' : "";
  return `<span class="rd-shape rd-shape--${r}${extra ? " " + extra : ""}" aria-hidden="true">${inner}</span>`;
}
function rdInchHtml(n) {
  return `<span aria-hidden="true">${n.toLocaleString("en-US")}″</span><span class="visually-hidden">${n.toLocaleString("en-US")} inches</span>`;
}
function rdPackHtml(opts) {
  const inches = rdInches(rdMemory.points);
  const { cur, next } = rdMilestone(inches);
  const from = cur ? cur.at : 0;
  const pct = next ? Math.max(2, Math.round(((inches - from) / (next.at - from)) * 100)) : 100;
  const rating = rdRating();
  const added = opts && opts.added;
  return `
    <section class="rd-pack" aria-labelledby="rd-pack-label">
      <p class="data-label" id="rd-pack-label">Your snowpack</p>
      <p class="rd-pack__depth"><span class="data-stat">${rdInchHtml(inches)}</span>${added ? `<span class="rd-pack__added body-sm">+${added}″ today<span class="visually-hidden"> (${added} inches)</span></span>` : ""}</p>
      <p class="rd-pack__milestone body-md">${cur ? escapeHtml(cur.name) : "No snow yet"}</p>
      ${next ? `
        <div class="rd-pack__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <p class="rd-pack__next body-sm">${(next.at - inches).toLocaleString("en-US")}″ to ${escapeHtml(next.name)}<span class="visually-hidden"> (${next.at - inches} inches to go)</span></p>`
        : `<p class="rd-pack__next body-sm">You've reached the last milestone. It keeps building.</p>`}
      <p class="rd-pack__rating body-sm">${rating
        ? `${rdShapeHtml(rating)} You're skiing ${RD_RATING[rating].plural}.`
        : `Play ${3 - rdMemory.recent.length} more round${3 - rdMemory.recent.length === 1 ? "" : "s"} to get your rating.`}</p>
    </section>`;
}

// --- screens ---------------------------------------------------------------
function renderRopeDropRoute(main) {
  rdSettleOld();
  if (!state.ropeDrop) state.ropeDrop = { phase: "home" };
  renderRopeDrop(main);
  focusHeading(main);
}

function renderRopeDrop(main) {
  const g = state.ropeDrop;
  if (g.phase === "question" || g.phase === "reveal") rdRenderQuestion(main);
  else if (g.phase === "done") rdRenderDone(main);
  else rdRenderHome(main);
  document.title = "Rope Drop — Rather Be Knee Deep";
  setOgMeta({ title: "Rope Drop", description: "Seven ski trivia questions a day, green to double black." });
}

function rdGo(main, patch) {
  Object.assign(state.ropeDrop, patch);
  window.scrollTo(0, 0);
  renderRopeDrop(main);
  focusHeading(main);
}

function rdRenderHome(main) {
  const today = rdToday();
  const rec = rdMemory.today && rdMemory.today.date === today ? rdMemory.today : null;
  const started = rec && !rec.done && rec.picks.some((p) => p !== null);
  const label = rec && rec.done
    ? `See today's run: <span class="data-inline">${rec.score}/${RD_MAX}</span>`
    : started ? "Finish today's run" : "Drop in";
  main.innerHTML = `
    <div class="page-column game rd">
      ${pageHeaderHtml("Rope Drop", "Seven questions a day, green to double black. Every right answer adds snow to your snowpack.")}
      <p class="rd-ladder body-sm" aria-label="Two green circles, two blue squares, two black diamonds, one double black">
        ${RD_ORDER.map((r) => rdShapeHtml(r)).join("")}
      </p>
      ${rdPackHtml()}
      <div class="game-actions">
        <button class="btn btn-primary btn-block" id="rd-play" type="button">${label}</button>
        <p class="body-sm game-note">${rec && rec.done ? "New questions tomorrow." : `Rope Drop #${rdDayIndex(today) + 1} · Same seven for everyone today.`}</p>
      </div>
      ${pageAboutHtml("How Rope Drop works", `
        <p>One round a day: two green circles (10 points each), two blue squares (20), two black diamonds (30) and a double black (50).</p>
        <p>Every 10 points is an inch of snow. Your snowpack never melts and never resets, so a bad day costs you nothing.</p>
        <p>Your rating comes from your last seven rounds, and it moves up and down with how you do.</p>
        <p>Resort questions come from this app's own research. Ski and snowboard history comes from sources like the Smithsonian, Olympics.com and the avalanche centers.</p>
        <p>Kept on this device only. Clearing your browser data clears your snowpack too.</p>`)}
    </div>`;
  document.getElementById("rd-play").addEventListener("click", () => {
    const r = rdTodayRecord(today);
    rdSave();
    if (r.done) { rdGo(main, { phase: "done", date: today }); return; }
    const idx = Math.max(0, r.picks.findIndex((p) => p === null));
    rdGo(main, { phase: "question", date: today, idx });
  });
}

function rdRenderQuestion(main) {
  const g = state.ropeDrop;
  const rec = rdTodayRecord(g.date);
  const round = rdRound(g.date);
  const q = round[g.idx];
  const pick = rec.picks[g.idx];
  const revealed = g.phase === "reveal" && pick !== null;
  const right = revealed && pick === q.a;
  const last = g.idx === RD_ORDER.length - 1;
  const resort = q.rid ? RESORTS_BY_ID[q.rid] : null;
  const optionHtml = (opt) => {
    const isAnswer = opt === q.a, isPick = opt === pick;
    const cls = !revealed ? "" : isAnswer ? " game-option--right" : isPick ? " game-option--wrong" : " game-option--other";
    const mark = !revealed ? "" : isAnswer ? `<span class="game-option__mark">${ICONS.check}<span class="visually-hidden"> (the answer)</span></span>`
      : isPick ? `<span class="game-option__mark game-option__mark--x" aria-hidden="true">&times;</span><span class="visually-hidden"> (your pick)</span>` : "";
    return `<li><button class="game-option${cls}" type="button" data-opt="${escapeHtml(opt)}"${revealed ? ' aria-disabled="true"' : ""}>
      <span class="game-option__label">${escapeHtml(opt)}</span>${mark}</button></li>`;
  };
  main.innerHTML = `
    <div class="page-column game rd">
      <div class="game-topbar">
        <button class="leaf-back" id="rd-quit" type="button"><span class="leaf-back__arrow" aria-hidden="true">&larr;</span><span>Rope Drop</span></button>
        <span class="data-inline game-progress">#${rdDayIndex(g.date) + 1} · ${g.idx + 1}/${RD_ORDER.length}</span>
      </div>
      <ol class="rd-steps" role="list" aria-label="Question ${g.idx + 1} of ${RD_ORDER.length}">
        ${round.map((x, i) => `<li class="rd-step${i === g.idx ? " rd-step--now" : ""}${rec.picks[i] !== null ? (rec.picks[i] === x.a ? " rd-step--right" : " rd-step--missed") : ""}">${rdShapeHtml(x.r)}</li>`).join("")}
      </ol>
      <p class="rd-chip body-sm">${rdShapeHtml(q.r)}<span>${RD_RATING[q.r].name} · ${RD_POINTS[q.r]} points</span></p>
      <h1 class="rd-question" id="rd-q">${escapeHtml(q.q)}</h1>
      <ul class="game-options" role="list" aria-labelledby="rd-q">${q.options.map(optionHtml).join("")}</ul>
      ${revealed ? `
        <div class="game-reveal">
          <p class="game-verdict body-md"><strong>${right ? `Correct. +${RD_POINTS[q.r]}` : "Not this time."}</strong> ${right ? "" : `It's ${escapeHtml(q.a)}. `}${escapeHtml(q.fact || "")}</p>
          <button class="btn btn-primary btn-block" id="rd-next" type="button">${last ? "See your run" : "Next question"}</button>
          ${resort ? `<button class="btn-text game-see" id="rd-see" type="button">See ${escapeHtml(resort.name)} →</button>` : ""}
        </div>` : ""}
    </div>`;

  document.getElementById("rd-quit").addEventListener("click", () => rdGo(main, { phase: "home" }));
  if (!revealed) {
    main.querySelectorAll(".game-option").forEach((btn) => btn.addEventListener("click", () => {
      rec.picks[g.idx] = btn.dataset.opt;
      rdSave();
      const ok = rec.picks[g.idx] === q.a;
      Object.assign(g, { phase: "reveal" });
      renderRopeDrop(main);
      const announcer = document.getElementById("reveal-announcer");
      if (announcer) announcer.textContent = ok ? `Correct. Plus ${RD_POINTS[q.r]}.` : `Not this time. It's ${q.a}.`;
      const next = document.getElementById("rd-next");
      if (next) next.focus({ preventScroll: true });
    }));
  } else {
    document.getElementById("rd-next").addEventListener("click", () => {
      if (!last) { rdGo(main, { idx: g.idx + 1, phase: rec.picks[g.idx + 1] !== null ? "reveal" : "question" }); return; }
      rdFinalize(rec);
      rdGo(main, { phase: "done" });
    });
    const see = document.getElementById("rd-see");
    if (see) see.addEventListener("click", () => {
      const payload = { v: 1, rid: resort.id, reasonBullets: resort.character_note ? [sanitizeDatasetProse(resort.character_note)] : [], showRangeReadout: false, range: null };
      navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true, origin: "rope" });
    });
  }
}

// The shareable line: rating shapes, filled for right and hollow for missed.
// No questions or answers, so it spoils nothing.
const RD_SHARE_MARK = { g: ["🟢", "⚪"], b: ["🟦", "⬜"], k: ["◆", "◇"], d: ["◆◆", "◇◇"] };
function rdShareText(rec) {
  const round = rdRound(rec.date);
  const marks = round.map((q, i) => RD_SHARE_MARK[q.r][rec.picks[i] === q.a ? 0 : 1]);
  const grouped = [marks.slice(0, 2).join(""), marks.slice(2, 4).join(""), marks.slice(4, 6).join(""), marks[6]].join(" ");
  return `Rope Drop #${rdDayIndex(rec.date) + 1} · +${rdInches(rec.score)}″\n${grouped}\nSnowpack ${rdInches(rdMemory.points).toLocaleString("en-US")}″\n${location.origin}`;
}

function rdRenderDone(main) {
  const g = state.ropeDrop;
  const rec = rdMemory.today && rdMemory.today.date === g.date ? rdMemory.today : null;
  if (!rec || !rec.done) { rdGo(main, { phase: "home" }); return; }
  const round = rdRound(rec.date);
  const right = round.filter((q, i) => rec.picks[i] === q.a).length;
  const milestone = rec.milestone ? RD_MILESTONES.find((m) => m.name === rec.milestone) : null;
  main.innerHTML = `
    <div class="page-column game rd">
      <div class="game-topbar">
        <button class="leaf-back" id="rd-quit" type="button"><span class="leaf-back__arrow" aria-hidden="true">&larr;</span><span>Rope Drop</span></button>
      </div>
      <div class="game-card">
        <p class="data-label">Rope Drop #${rdDayIndex(rec.date) + 1} · ${escapeHtml(rdDateLabel(rec.date))}</p>
        <h1 class="game-score"><span class="data-stat game-score__n">${rec.score}<span class="rd-score__max">/${RD_MAX}</span></span>
          <span class="game-score__line body-md">${escapeHtml(rdScoreLine(rec.score))}</span></h1>
        <ol class="rd-marks" role="list" aria-label="${right} of ${RD_ORDER.length} right">
          ${round.map((q, i) => { const ok = rec.picks[i] === q.a; return `<li class="rd-mark${ok ? " rd-mark--right" : ""}">${rdShapeHtml(q.r)}<span class="visually-hidden">${RD_RATING[q.r].name}: ${ok ? "right" : "missed"}</span></li>`; }).join("")}
        </ol>
        ${milestone ? `<p class="rd-milestone body-md"><strong>New milestone: ${escapeHtml(milestone.name)}.</strong> ${escapeHtml(milestone.note)}</p>` : ""}
      </div>
      ${rdPackHtml({ added: rdInches(rec.score) })}
      <div class="game-actions">
        <button class="btn btn-secondary btn-block" id="rd-copy" type="button">${ICONS.share} Copy result</button>
        <p class="body-sm game-note">New questions tomorrow.</p>
      </div>
      <h2 class="rd-recap__title data-label">Today's answers</h2>
      <ol class="rd-recap" role="list">
        ${round.map((q, i) => { const ok = rec.picks[i] === q.a; return `
          <li class="rd-recap__item${ok ? "" : " rd-recap__item--missed"}">
            ${rdShapeHtml(q.r)}
            <div><p class="body-sm rd-recap__q">${escapeHtml(q.q)}</p>
            <p class="body-sm"><strong>${escapeHtml(q.a)}</strong>${ok ? '<span class="visually-hidden"> (you got it)</span>' : (rec.picks[i] !== null ? ` <span class="rd-recap__yours">You said ${escapeHtml(rec.picks[i])}</span>` : ` <span class="rd-recap__yours">Not answered</span>`)}</p></div>
          </li>`; }).join("")}
      </ol>
    </div>`;
  document.getElementById("rd-quit").addEventListener("click", () => rdGo(main, { phase: "home" }));
  document.getElementById("rd-copy").addEventListener("click", async () => {
    const text = rdShareText(rec);
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { /* cancelled — fall through */ }
    }
    try { await navigator.clipboard.writeText(text); showToast("Result copied"); }
    catch (e) { showToast(text.replace(/\n/g, " · ")); }
  });
}
