// ---------------------------------------------------------------------------
// Quiver Check — the UI layer. All the reasoning lives in quiver.js; this
// file picks a resort, picks a day, and renders the call.
//
// Three steps, one question each, matching the trip planner's established
// idiom rather than inventing a fourth interaction pattern for a fourth mode:
//   resort  ->  day  ->  the call
//
// Season handling is deliberately identical to Chase the Snow's, at the
// Director's explicit direction: when nothing in the pool is realistically
// open, this mode does not render a picker, does not fetch, and does not
// produce a ski recommendation for a mountain that isn't spinning lifts. The
// same shoulder-season filter applies in October and May.
// ---------------------------------------------------------------------------

function renderQuiver(main) {
  const now = appNow();
  const seasonInfo = effectiveSeasonState(RESORTS, now);
  state.chaseSeasonInfo = seasonInfo;

  main.innerHTML = `<div class="page-column"><div id="quiver-body"></div></div>`;
  document.title = "Quiver Check — which skis to bring";
  setOgMeta({
    title: "Quiver Check — which skis to bring",
    description: "Tell it where you're going and when. It reads the forecast and tells you what to put on your feet.",
  });

  const body = document.getElementById("quiver-body");
  if (seasonInfo.state === "off-season") {
    renderQuiverOffSeason(body);
    focusHeading(main);
    return;
  }
  renderQuiverStep();
  focusHeading(main);
}

// Mirrors renderChaseOffSeason's stance exactly — this is not a banner on top
// of a working picker, it replaces the mode. The one difference is the copy,
// because the useful next action from here is different: Chase's off-season
// screen sends you to plan a trip, and so does this one, but the sentence
// explaining why has to be about skis rather than about rankings.
function renderQuiverOffSeason(body) {
  body.innerHTML = `
    <h1 class="display-h1">Quiver Check</h1>
    <div class="center-state">
      ${ICONS.snow}
      <h2 class="display-h3">Nothing's open right now</h2>
      <p class="body-md" style="max-width:32rem">This reads the 7-day forecast to work out what you should be riding — which only means anything once the lifts are turning. Most resorts open in November.</p>
      <p class="body-sm" style="max-width:32rem;color:var(--text-secondary)">Come back once the season starts and it'll tell you whether Thursday is a rock-ski day or a fat-ski day.</p>
      <button class="btn btn-primary" id="quiver-offseason-plan" type="button">Plan a trip instead</button>
    </div>`;
  document.getElementById("quiver-offseason-plan").addEventListener("click", () => navigate("plan"));
}

// ---------------------------------------------------------------------------
// Step router
// ---------------------------------------------------------------------------
function renderQuiverStep() {
  const body = document.getElementById("quiver-body");
  if (!body) return;
  const step = state.quiver.step;
  if (step === "day") return renderQuiverDayStep(body);
  if (step === "result") return renderQuiverResult(body);
  return renderQuiverResortStep(body);
}

// Which mountains can be picked. Open now, or opening inside the 7-day
// forecast window (the day step then starts on opening day). A mountain
// further out than that can't get a ski call — the forecast doesn't reach
// its first day — so it lists under "Opening soon" with its date instead of
// a paragraph explaining why it's missing. Q4 stands: no call for a
// mountain that isn't spinning lifts on the day you pick.
function quiverPickable(r, now) {
  const o = resortOpening(r, now);
  if (o.open) return true;
  return !!(o.date && o.date.getTime() - now.getTime() < QUIVER_HORIZON_DAYS * 864e5);
}

function quiverPool() {
  const now = appNow();
  return RESORTS.filter((r) => r.lat != null && quiverPickable(r, now));
}

function quiverUpcoming() {
  const now = appNow();
  const horizon = now.getTime() + CHASE_UPCOMING_WINDOW_DAYS * 864e5;
  return RESORTS
    .filter((r) => r.lat != null && !quiverPickable(r, now))
    .filter((r) => { const k = openingSortKey(r, now); return k > now.getTime() && k <= horizon; })
    .sort((a, b) => openingSortKey(a, now) - openingSortKey(b, now));
}

// ---------------------------------------------------------------------------
// Step 1 — which mountain
// ---------------------------------------------------------------------------
function renderQuiverResortStep(body) {
  body.innerHTML = `
    <h1 class="display-h1 quiz-title">Where are you skiing?</h1>
    ${pageMetaHtml(["Step 1 of 2", "Pick a mountain, then a day"])}
    <div class="quiver-search">
      <label class="visually-hidden" for="quiver-search-input">Search by name or state</label>
      <div class="quiver-search__field">
        <span class="quiver-search__icon" aria-hidden="true">${ICONS.search}</span>
        <input type="search" id="quiver-search-input" class="quiver-search__input" autocomplete="off"
               placeholder="Search: Alta, Vermont, Jackson…" value="${escapeHtml(state.quiver.search || "")}">
      </div>
    </div>
    <p class="visually-hidden" aria-live="polite" id="quiver-search-count"></p>
    <div id="quiver-resort-list"></div>
    ${pageAboutHtml("About this data", `
      <p>Reads the National Weather Service's 7-day forecast for the mountain you pick, then works out which skis suit that day. Canadian resorts aren't covered by that forecast, so they use typical snowfall for the time of year.</p>
      <p>Only mountains open on or before the day you pick can get a call. Opening days are each resort's published ${OPENINGS_SEASON} date.</p>`)}`;

  renderQuiverResortList();
  const input = document.getElementById("quiver-search-input");
  input.addEventListener("input", () => {
    state.quiver.search = input.value;
    renderQuiverResortList();
  });
}

function renderQuiverResortList() {
  const wrap = document.getElementById("quiver-resort-list");
  const now = appNow();
  const q = (state.quiver.search || "").trim().toLowerCase();
  const match = (r) => !q || `${r.name} ${r.state_province} ${r.country}`.toLowerCase().includes(q);
  const pool = quiverPool().filter(match);
  const upcoming = quiverUpcoming().filter(match);

  const countEl = document.getElementById("quiver-search-count");
  if (countEl) countEl.textContent = `${pluralize(pool.length, "resort")} listed.`;

  if (!pool.length && !upcoming.length) {
    wrap.innerHTML = `<div class="center-state">${ICONS.warning}<p class="body-md">Nothing matches “${escapeHtml(state.quiver.search)}”. Try a state, or part of the mountain's name.</p></div>`;
    return;
  }

  // Grouped by state/province, which is how people actually narrow a ski
  // list — "somewhere in Utah" is a far more common starting point than a
  // specific mountain.
  const groups = {};
  for (const r of pool) {
    const key = r.country === "Canada" ? `${r.state_province}, Canada` : r.state_province;
    (groups[key] = groups[key] || []).push(r);
  }
  const orderedKeys = Object.keys(groups).sort();

  const metaFor = (r) => {
    const o = resortOpening(r, now);
    const bits = [];
    if (!o.open) bits.push(`<span class="chase-row__status">${escapeHtml(o.label)}</span>`);
    if (r.country !== "USA") bits.push("Typical season");
    if (r.scale === "day-trip") bits.push("Day-trip hill");
    return bits.join(" · ");
  };

  const pickHtml = orderedKeys.map((key) => `
    <section class="quiver-group">
      <h2 class="data-label quiver-group__heading">${escapeHtml(key)}</h2>
      <div class="quiver-group__items">
        ${groups[key].map((r) => {
          const meta = metaFor(r);
          return `
          <button class="quiver-resort" type="button" data-rid="${r.id}">
            <span class="quiver-resort__name">${escapeHtml(r.name)}</span>
            ${meta ? `<span class="quiver-resort__meta body-sm">${meta}</span>` : ""}
            <span class="quiver-resort__chev" aria-hidden="true">${ICONS.arrowRight}</span>
          </button>`;
        }).join("")}
      </div>
    </section>`).join("");

  const upcomingHtml = upcoming.length ? `
    <section class="quiver-group" aria-labelledby="quiver-upcoming-h">
      <h2 class="data-label quiver-group__heading" id="quiver-upcoming-h">${pool.length ? "Opening soon" : "Nothing's open yet · Opening soon"}</h2>
      <ul class="quiver-upcoming">
        ${upcoming.map((r) => `<li><span class="quiver-upcoming__name">${escapeHtml(r.name)}</span><span class="chase-row__status body-sm">${escapeHtml(resortOpening(r, now).label)}</span></li>`).join("")}
      </ul>
    </section>` : "";

  wrap.innerHTML = pickHtml + upcomingHtml;

  wrap.querySelectorAll(".quiver-resort").forEach((btn) => {
    btn.addEventListener("click", () => selectQuiverResort(btn.dataset.rid));
  });
}

function selectQuiverResort(rid) {
  state.quiver.resortId = rid;
  state.quiver.dateKey = null;
  state.quiverForecast = null;
  state.quiver.step = "day";
  // Warm the forecast now rather than at the moment it's needed. The user
  // spends a few seconds on the day picker either way, and spending them
  // fetching means the answer is usually already sitting there when they
  // tap — which is the difference between this mode feeling instant and
  // feeling like Chase the Snow's cold start.
  prefetchQuiverForecast(rid);
  renderQuiverStep();
  focusHeading(mainEl());
}

let quiverFetchSeq = 0;
function prefetchQuiverForecast(rid) {
  const resort = RESORTS_BY_ID[rid];
  if (!resort) return;
  const seq = ++quiverFetchSeq;
  state.quiverForecast = { resortId: rid, status: "loading", days: null };
  resolveDailyForecast(resort, appNow()).then((res) => {
    // A stale response for a resort the user has since navigated away from
    // must not overwrite the current one.
    if (seq !== quiverFetchSeq) return;
    state.quiverForecast = { resortId: rid, status: "ready", ...res };
    if (state.route === "quiver" && state.quiver.step === "result") renderQuiverStep();
  });
}

// ---------------------------------------------------------------------------
// Step 2 — which day
//
// Deliberately shows dates only, no snow totals. Surfacing "14 inches on
// Thursday" here would turn the picker into the week-at-a-glance strip the
// Director explicitly scoped out — and it would answer the question before
// it's been asked.
// ---------------------------------------------------------------------------
function renderQuiverDayStep(body) {
  const resort = RESORTS_BY_ID[state.quiver.resortId];
  if (!resort) { state.quiver.step = "resort"; return renderQuiverStep(); }

  const now = appNow();
  const tz = (state.quiverForecast && state.quiverForecast.timeZone) || null;
  const opening = resortOpening(resort, now);
  const fullFrame = buildDayFrame(now, tz, true);
  // A mountain opening inside the window: the picker starts on opening day.
  const frame = (!opening.open && opening.date)
    ? fullFrame.filter((d) => parseDayKey(d.dateKey) >= opening.date)
    : fullFrame;
  const firstIndex = fullFrame.length - frame.length;

  body.innerHTML = `
    <h1 class="display-h1 quiz-title">Which day?</h1>
    ${pageMetaHtml(["Step 2 of 2", escapeHtml(resort.name), opening.open ? null : `<span class="chase-row__status">${escapeHtml(opening.label)}</span>`])}
    <div class="quiver-day-list" role="radiogroup" aria-label="Which day are you skiing?">
      ${frame.map((d, i) => {
        const label = quiverDayLabel(d.dateKey, i + firstIndex);
        // "Try a different day" returns here with a day already chosen, so
        // the previous answer has to render as chosen — both visually and to
        // AT — rather than resetting to a blank group. Same defect class as
        // the quiz's Back-doesn't-restore-the-answer bug
        // (heuristic-evaluation.md H3/H6), avoided here by construction.
        const selected = state.quiver.dateKey === d.dateKey;
        const tabbable = state.quiver.dateKey ? selected : i === 0;
        return `<button class="tap-chip ${selected ? "tap-chip--selected" : ""}" type="button" role="radio" aria-checked="${selected}" data-daykey="${d.dateKey}" tabindex="${tabbable ? "0" : "-1"}">
          <span class="tap-chip__indicator tap-chip__indicator--radio">${ICONS.check}</span>
          <span class="tap-chip__body">
            <span class="tap-chip__label">${escapeHtml(label.primary)}</span>
            <span class="tap-chip__sublabel">${escapeHtml(label.secondary)}</span>
          </span>
        </button>`;
      }).join("")}
    </div>
    <div class="quiz-nav">
      <button class="btn btn-secondary" id="quiver-back" type="button">Back</button>
    </div>`;

  const chips = Array.from(body.querySelectorAll(".tap-chip[data-daykey]"));
  chips.forEach((chip, i) => {
    chip.addEventListener("click", () => {
      state.quiver.dateKey = chip.dataset.daykey;
      state.quiver.step = "result";
      // Leaving the picker for the call: remember there is a picker to go back
      // to, which is what separates this from a cold-landed shared link.
      state.quiver.hadPrev = true;
      renderQuiverStep();
    });
    // Roving tabindex, matching the quiz's radiogroup keyboard model.
    chip.addEventListener("keydown", (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const next = chips[(i + keys[e.key] + chips.length) % chips.length];
      chips.forEach((c) => { c.tabIndex = -1; });
      next.tabIndex = 0;
      next.focus();
    });
  });

  document.getElementById("quiver-back").addEventListener("click", () => {
    state.quiver.step = "resort";
    renderQuiverStep();
    focusHeading(mainEl());
  });
}

// `dateKey` is YYYY-MM-DD in the resort's own timezone. Parsed at noon local
// so that constructing a Date from it can't slip a day across the viewer's
// own UTC offset — the label has to say the same day the forecast bucketed.
function parseDayKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function quiverDayLabel(dateKey, index) {
  const date = parseDayKey(dateKey);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const dayMonth = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  if (index === 0) return { primary: "Today", secondary: `${weekday}, ${dayMonth}` };
  if (index === 1) return { primary: "Tomorrow", secondary: `${weekday}, ${dayMonth}` };
  return { primary: weekday, secondary: dayMonth };
}

// ---------------------------------------------------------------------------
// Step 3 — the call
// ---------------------------------------------------------------------------
function renderQuiverResult(body) {
  const resort = RESORTS_BY_ID[state.quiver.resortId];
  if (!resort) { state.quiver.step = "resort"; return renderQuiverStep(); }

  const fc = state.quiverForecast;
  if (!fc || fc.resortId !== state.quiver.resortId || fc.status === "loading") {
    body.innerHTML = `<div class="loading-state"><div class="loading-spinner" aria-hidden="true"></div><p class="body-md">Reading the forecast for ${escapeHtml(resort.name)}…</p></div>`;
    return;
  }

  const idx = fc.days.findIndex((d) => d.dateKey === state.quiver.dateKey);
  if (idx === -1) {
    // Reached by a shared link whose day has since passed or fallen off the
    // horizon. Saying so plainly beats silently answering a different
    // question than the one the link promised.
    renderQuiverExpired(body, resort);
    return;
  }

  const day = fc.days[idx];
  const priorDays = fc.days.slice(0, idx);
  const result = quiverCheck(resort, day, priorDays, appNow());
  const c = result.conditions;
  const label = quiverDayLabel(day.dateKey, idx);
  const dayPhrase = idx === 0 ? "today" : idx === 1 ? "tomorrow" : `on ${label.primary}`;
  const location = resort.country === "Canada" ? `${resort.state_province}, Canada` : resort.state_province;

  // Back, at the top, above the heading — the Rants detail view's pattern.
  //
  // NO history.back(). This page is shareable (Share this call writes a
  // #quiver= link, and parseInitialRoute reads it), so a reader arriving from
  // a group chat has no in-app entry behind them; back would be a no-op or
  // would throw them out of the app entirely, from the one screen whose whole
  // job is to receive a pasted link. `hadPrev` answers the question directly
  // instead of guessing at the history stack, and the label changes with the
  // answer rather than lying about where it goes.
  //
  // This overlaps "Try a different day" in the footer, and that is the point
  // being additive: the footer exits are lateral moves sitting below a long
  // card, and a reader looking for the way out looks up, not down.
  const cameFromPicker = !!state.quiver.hadPrev;
  const backHtml = cameFromPicker
    ? leafBackHtml("quiver-leaf-back", "Back to Quiver Check", true)
    : leafBackHtml("quiver-leaf-back", "Start a Quiver Check", false);

  body.innerHTML = backHtml + `
    <article class="quiver-card" id="quiver-card">
      <p class="result-eyebrow label">The call</p>
      <h1 class="display-hero quiver-call" tabindex="-1">${escapeHtml(result.call.label)}</h1>
      <p class="quiver-call__tagline body-md">${escapeHtml(result.call.tagline)} <span class="data-inline quiver-call__waist">${escapeHtml(result.call.waistLabel)}</span></p>
      <p class="quiver-context body-md">${escapeHtml(resort.name)}, ${escapeHtml(location)} — ${escapeHtml(dayPhrase)}, ${escapeHtml(label.secondary)}.</p>

      ${quiverFreshnessHtml(fc)}

      <h2 class="display-h3 reason-heading">Why</h2>
      <ul class="reason-list">
        ${result.reasons.map((r) => `<li class="reason-bullet"><span class="reason-bullet__icon">${ICONS.checkCircle}</span><span class="reason-bullet__text body-md">${escapeHtml(r)}</span></li>`).join("")}
      </ul>

      <div class="quiver-whatis">
        <h2 class="data-label">What that ski is</h2>
        <p class="body-md">${escapeHtml(result.call.plain)}</p>
      </div>

      <div class="quiver-fallback">
        <h2 class="data-label">If you don't own a pair</h2>
        <p class="body-md">${escapeHtml(result.call.ifYouDont)}</p>
      </div>

      ${result.aside ? `
        <div class="quiver-aside">
          <h2 class="data-label">${escapeHtml(result.aside.label)}</h2>
          <p class="body-md">${escapeHtml(result.aside.text)}</p>
        </div>` : ""}

      <h2 class="display-h3" style="margin-bottom:var(--space-3)">The numbers</h2>
      <div class="stat-strip stat-strip--quad">${quiverStatsHtml(c)}</div>

      ${result.caveats.length ? `
        <div class="quiver-caveats">
          <h2 class="data-label">Worth knowing</h2>
          <ul class="quiver-caveat-list">
            ${result.caveats.map((t) => `<li class="body-md"><span class="quiver-caveat__icon" aria-hidden="true">${ICONS.warning}</span><span>${escapeHtml(t)}</span></li>`).join("")}
          </ul>
        </div>` : ""}

      <p class="quiver-limits body-sm">This reads the weather forecast, not the mountain's snow report. It doesn't know the settled base depth, what got groomed last night, or what's already been tracked out. Check the resort's own report before you pack.</p>

      ${resort.hot_take ? `
        <div class="hot-take" id="quiver-hot-take">
          <span class="hot-take__quote-mark" aria-hidden="true">&ldquo;</span>
          <div class="hot-take__header">
            <span class="hot-take__avatar" aria-hidden="true">N</span>
            <span class="hot-take__label label">Nicole's Hot Take</span>
          </div>
          <p class="hot-take__body">${escapeHtml(resort.hot_take.text)}</p>
          <span class="hot-take__attribution">— Nicole, on ${escapeHtml(resort.name)}</span>
        </div>` : ""}

      <div class="footer-cta">
        <button class="btn btn-primary btn-block" id="quiver-share" type="button">${ICONS.share} Share this call</button>
        <button class="btn btn-secondary btn-block" id="quiver-another-day" type="button">Try a different day</button>
        <button class="btn-text" id="quiver-another-resort" type="button" style="text-align:center">Check a different mountain →</button>
      </div>
    </article>`;

  document.getElementById("quiver-leaf-back").addEventListener("click", () => {
    if (cameFromPicker) {
      // The day step re-renders with the chosen day still selected, so this is
      // a genuine step back rather than a reset.
      state.quiver.step = "day";
    } else {
      // Cold landing: there is no picker behind this reader, so the control
      // takes them to the surface's own entry point and its label said so.
      state.quiver = { step: "resort", resortId: null, dateKey: null, search: "", hadPrev: false };
      state.quiverForecast = null;
    }
    renderQuiverStep();
    focusHeading(mainEl());
  });

  document.getElementById("quiver-share").addEventListener("click", () => shareQuiverCall(resort, result, day, idx));
  document.getElementById("quiver-another-day").addEventListener("click", () => {
    state.quiver.step = "day";
    renderQuiverStep();
    focusHeading(mainEl());
  });
  document.getElementById("quiver-another-resort").addEventListener("click", () => {
    state.quiver.step = "resort";
    state.quiver.resortId = null;
    renderQuiverStep();
    focusHeading(mainEl());
  });

  const retry = document.getElementById("quiver-retry-forecast");
  if (retry) retry.addEventListener("click", () => {
    prefetchQuiverForecast(state.quiver.resortId);
    renderQuiverStep();
  });

  document.title = `${result.call.label} — ${resort.name}`;
  setOgMeta({
    title: `${result.call.label} at ${resort.name}`,
    description: `${result.reasons[0] || ""} ${result.call.waistLabel}.`.trim(),
  });

  syncQuiverHash(resort, day);
  announce("reveal-announcer", `The call for ${resort.name} ${dayPhrase}: ${result.call.label}. ${result.call.waistLabel}.`);
  revealQuiverCard(document.getElementById("quiver-card"));
  const heading = body.querySelector(".quiver-call");
  if (heading) heading.focus({ preventScroll: true });
}

function quiverFreshnessHtml(fc) {
  if (fc.isLive) {
    const stamp = updatedStamp(fc.updatedAt);
    return pageMetaHtml(["NWS forecast", stamp ? `Updated ${escapeHtml(stamp)}` : "Updated today"]);
  }
  const canada = fc.fallbackReason === "outside NOAA coverage";
  return pageMetaHtml([
    `<span class="freshness-badge--fallback"><span class="freshness-badge__text">Not a live forecast</span></span>`,
    canada ? "typical snowfall, no US forecast for Canada" : "typical snowfall for the time of year",
    canada ? null : `<button class="btn-text" id="quiver-retry-forecast" type="button">Try again</button>`,
  ]);
}

// Snow depths render through the same rounding rule the reason sentences use
// (whole inches above one, a single decimal below), so a figure quoted in the
// prose and the same figure in the tile beside it never disagree — "22\" of
// new snow in total" above a tile reading 21.9 reads as a defect, not as
// precision.
function quiverDepth(n) {
  if (n == null) return "—";
  return n < 1 ? String(Math.round(n * 10) / 10) : String(Math.round(n));
}

function quiverStatsHtml(c) {
  let html = "";
  html += statTile("New snow, your day", quiverDepth(c.newSnow), '"', c.newSnow < 0.5 ? "Nothing forecast" : null, false);
  html += statTile("Storm total", quiverDepth(c.stormTotal), '"', c.leadDaysObserved > 0 ? `Including the ${pluralize(c.leadDaysObserved, "day")} before` : "Your day only — no lead-in visible", false);
  html += statTile("High", c.highF, "°F", c.lowF != null ? `Low ${c.lowF}°F` : null, c.highF == null);
  html += c.slr != null
    ? statTile("Snow to water", `${c.slr}:1`, "", capitalize(c.density.word), false)
    : textStatTile("Snow type", capitalize(c.density.word));
  return html;
}

function renderQuiverExpired(body, resort) {
  body.innerHTML = `
    <div class="center-state">
      ${ICONS.warning}
      <h1 class="display-h3">That day's out of range</h1>
      <p class="body-md" style="max-width:32rem">This link was for a specific day at ${escapeHtml(resort.name)}, and the forecast only runs seven days ahead — so that day has either passed or hasn't come into range yet.</p>
      <button class="btn btn-primary" id="quiver-expired-again" type="button">Check ${escapeHtml(resort.name)} for this week</button>
    </div>`;
  document.getElementById("quiver-expired-again").addEventListener("click", () => {
    state.quiver.step = "day";
    state.quiver.dateKey = null;
    renderQuiverStep();
    focusHeading(mainEl());
  });
}

// ---------------------------------------------------------------------------
// Sharing
//
// The share token carries the resort and the date — never the conditions or
// the call itself. A ski recommendation is only true for as long as the
// forecast behind it is, so a recipient opening this tomorrow re-reads the
// forecast and may correctly see a different answer. Freezing the call into
// the URL the way the trip planner freezes its result would produce a link
// that confidently states yesterday's weather, which R8 forbids.
// ---------------------------------------------------------------------------
function buildQuiverToken(resort, day) {
  return b64urlEncode(JSON.stringify({ v: 1, rid: resort.id, d: day.dateKey }));
}

function syncQuiverHash(resort, day) {
  history.replaceState(null, "", "#quiver=" + buildQuiverToken(resort, day));
}

async function shareQuiverCall(resort, result, day, idx) {
  const url = `${location.origin}${location.pathname}#quiver=${buildQuiverToken(resort, day)}`;
  const dayPhrase = idx === 0 ? "today" : idx === 1 ? "tomorrow" : quiverDayLabel(day.dateKey, idx).primary;
  const text = `${resort.name}, ${dayPhrase}: ${result.call.label}. ${result.call.waistLabel}.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `${result.call.label} at ${resort.name}`, text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showToast("Link copied — it'll re-read the forecast when they open it.");
  } catch (e) {
    if (e && e.name === "AbortError") return; // user dismissed the share sheet
    showToast("Couldn't copy the link. You can copy it from the address bar.");
  }
}

function revealQuiverCard(card) {
  if (!card) return;
  const reduce = reduceMotion();
  const targets = card.querySelectorAll(".result-eyebrow, .quiver-call, .quiver-call__tagline, .quiver-context, .reason-bullet");
  targets.forEach((el, i) => {
    if (reduce) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease", fill: "both" }); return; }
    el.animate(
      [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 200, delay: Math.min(i, 6) * 45, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }
    );
  });
}
