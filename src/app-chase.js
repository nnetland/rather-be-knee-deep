// ---------------------------------------------------------------------------
// Chase the Snow — near-zero-input ranked forecast list.
// Fallback-first: renders fully and honestly from historical data the moment
// the network is unavailable; live NOAA data (when reachable) simply swaps
// in with a visible, honest badge change, never silently.
// ---------------------------------------------------------------------------

function renderChase(main) {
  // Season classification runs before anything else is decided (build-notes.md
  // "off-season" fix, 2026-08-04) — it's a calendar judgment, not a network
  // one, so it doesn't wait on (or depend on) the NOAA fetch. When nothing in
  // the pool is plausibly open, the region/beginner controls have nothing to
  // act on — showing them anyway would invite tweaking filters on a ranking
  // that isn't going to appear, so they're omitted rather than disabled.
  const now = appNow();
  const seasonInfo = effectiveSeasonState(RESORTS, now);
  state.chaseSeasonInfo = seasonInfo;
  const showControls = seasonInfo.state !== "off-season";

  main.innerHTML = `
    <div class="page-column">
      <h1 class="display-h1">Where's it dumping?</h1>
      ${showControls ? `
        <div class="chase-controls" style="margin-top:var(--space-4)">
          <div id="chase-origin-control"></div>
          <label class="tap-chip" style="width:auto;min-width:220px" id="chase-beginner-toggle-wrap">
            <span class="tap-chip__indicator tap-chip__indicator--check" id="chase-beginner-indicator">${ICONS.check}</span>
            <span class="tap-chip__body">
              <span class="tap-chip__label">Include beginner-friendly options</span>
              <span class="tap-chip__sublabel">Off by default — this list leans toward serious terrain.</span>
            </span>
          </label>
        </div>` : ""}
      <div id="chase-freshness"></div>
      <div id="chase-body"></div>
    </div>`;

  if (showControls) {
    renderChaseOriginControl();
    wireBeginnerToggle();
  }
  document.title = "Where it's dumping this week";
  setOgMeta({
    title: "Where it's dumping this week",
    description: "Ranked by real snow quality, not just inches — updated from live forecasts.",
  });

  loadAndRenderChase();
  focusHeading(main);
}

function renderChaseOriginControl() {
  const wrap = document.getElementById("chase-origin-control");
  const selected = state.chaseAnswers.region;
  const selectedLabel = selected ? (regionById(selected) || {}).label : null;
  wrap.innerHTML = `
    <div>
      <span class="body-sm" style="display:block;margin-bottom:var(--space-2)">Closest to home? (optional)</span>
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center">
        <select id="chase-region-select" class="filter-chip" style="min-height:44px">
          <option value="">Skip</option>
          ${REGIONS.filter((r) => r.id !== "elsewhere").map((r) => `<option value="${r.id}" ${selected === r.id ? "selected" : ""}>${r.label}</option>`).join("")}
        </select>
      </div>
    </div>`;
  document.getElementById("chase-region-select").addEventListener("change", (e) => {
    state.chaseAnswers.region = e.target.value || null;
    renderChaseList(); // re-rank with new feasibility discount, no reload of forecasts needed
  });
}

function wireBeginnerToggle() {
  const wrapEl = document.getElementById("chase-beginner-toggle-wrap");
  const indicator = document.getElementById("chase-beginner-indicator");
  const sync = () => {
    wrapEl.classList.toggle("tap-chip--selected", state.chaseAnswers.includeBeginnerFriendly);
    wrapEl.setAttribute("aria-checked", String(state.chaseAnswers.includeBeginnerFriendly));
  };
  wrapEl.setAttribute("role", "checkbox"); wrapEl.tabIndex = 0;
  sync();
  const toggle = () => { state.chaseAnswers.includeBeginnerFriendly = !state.chaseAnswers.includeBeginnerFriendly; sync(); renderChaseList(true); };
  wrapEl.addEventListener("click", toggle);
  wrapEl.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
}

function loadAndRenderChase() {
  const body = document.getElementById("chase-body");
  const now = appNow();
  const seasonInfo = effectiveSeasonState(RESORTS, now);
  state.chaseSeasonInfo = seasonInfo;

  if (seasonInfo.state === "off-season") {
    // Nothing in the pool is realistically open — don't fetch, don't rank,
    // don't render a solemn list of near-zero forecasts. Say so plainly.
    renderChaseOffSeason(body);
    return;
  }

  if (state.chaseCache) {
    renderChaseList();
    return;
  }

  // Shoulder season (October, May): only fetch/rank resorts that are
  // themselves plausibly open by SEASON_OPEN_FRACTION's definition — a
  // resort that's still weeks from its published open date isn't made
  // "open" by a live forecast existing for its coordinates.
  const inDemo = DEMO.active();
  const usResorts = RESORTS.filter((r) => (inDemo || r.country === "USA") && r.lat != null &&
    (seasonInfo.state !== "shoulder" || seasonFraction(r, now) >= SEASON_OPEN_FRACTION));

  if (!usResorts.length) {
    // Safety net for the very start of the shoulder ramp, where the
    // aggregate classification says "shoulder" but no single resort
    // individually clears the per-resort bar yet — fall back to the same
    // honest off-season screen rather than an empty ranked list.
    renderChaseOffSeason(body);
    return;
  }

  state.chaseLoadHandle = loadChaseForecasts(usResorts, (phase, payload) => {
    if (phase === "loading") {
      body.innerHTML = `<div class="loading-state"><div class="loading-spinner" aria-hidden="true"></div><p class="body-md">Checking today's snow…</p></div>`;
    } else if (phase === "escalated") {
      const loadingState = body.querySelector(".loading-state");
      if (!loadingState) return;
      if (!loadingState.querySelector(".escalation-note")) {
        const note = document.createElement("p");
        note.className = "escalation-note body-sm";
        note.textContent = "Still checking — the forecast service is being slow today.";
        loadingState.appendChild(note);
      }
      // Manual skip-ahead escape: the historical data is already sitting
      // there, so an impatient or poorly-connected user doesn't have to
      // ride out the full 10s hard timeout to see it.
      if (!loadingState.querySelector("#chase-skip-btn")) {
        const skipBtn = document.createElement("button");
        skipBtn.className = "btn btn-secondary";
        skipBtn.id = "chase-skip-btn";
        skipBtn.type = "button";
        skipBtn.textContent = "Show typical-season data now";
        skipBtn.addEventListener("click", () => { if (state.chaseLoadHandle) state.chaseLoadHandle.skip(); });
        loadingState.appendChild(skipBtn);
      }
    } else if (phase === "done") {
      state.chaseCache = payload;
      state.chaseLoadHandle = null;
      renderChaseList();
      if (payload.anyFallback) {
        announce("forecast-status-announcer", "Forecast data unavailable — showing typical season snowfall instead of this week's forecast.");
      }
    }
  });
}

function renderChaseList(isRefresh) {
  const body = document.getElementById("chase-body");
  const freshnessWrap = document.getElementById("chase-freshness");
  if (!state.chaseCache) return;

  const { forecasts, anyFallback } = state.chaseCache;
  // In demo mode this slot stays empty. The demo banner at the top of the
  // screen already says these numbers are invented, and a second badge saying
  // it again — directly under the beginner toggle, on the same scroll —
  // crowded out the list it was labelling (Director, 2026-08-07). Falling
  // through to one of the real-data badges is not an option: "Live forecast"
  // would be false, and the fallback badge blames a network outage for data
  // that was never fetched. `#chase-freshness` is an unstyled block, so an
  // empty one contributes no height and no margin — the list closes up
  // against the controls rather than leaving a hole where the badge was.
  freshnessWrap.innerHTML = DEMO.active()
    ? ""
    : anyFallback
    ? `<div class="freshness-badge freshness-badge--fallback" id="freshness-badge">
        <span id="freshness-icon-historical">${ICONS.signalSlash}</span>
        <span class="freshness-badge__text body-sm">Not a live forecast</span>
      </div>
      <p class="body-sm" style="color:var(--text-secondary);margin:0 0 var(--space-4)">We couldn't reach the live forecast right now. This is the typical snowfall for this time of year, not what's coming this week. <button class="btn-text" id="retry-forecast" type="button" style="padding:0">Try again</button></p>`
    : `<div class="freshness-badge" id="freshness-badge"><span id="freshness-icon-live">${ICONS.live}</span><span class="freshness-badge__text body-sm">Live forecast · updated moments ago</span></div>`;

  const retryBtn = document.getElementById("retry-forecast");
  if (retryBtn) retryBtn.addEventListener("click", () => { state.chaseCache = null; loadAndRenderChase(); });

  const ranked = rankChaseTheSnow(forecasts, state.chaseAnswers, RESORTS);
  const canada = DEMO.active() ? [] : rankCanadaTypicalSeason(RESORTS);

  // Shoulder-season notice (October, May): the list below only includes
  // resorts that are individually plausibly open (see loadAndRenderChase's
  // season-window filter) — this says so plainly rather than letting a
  // shorter-than-usual list read as a data problem.
  const seasonNoticeHtml = (state.chaseSeasonInfo && state.chaseSeasonInfo.state === "shoulder")
    ? `<div class="canada-divider" id="season-shoulder-notice">
        <span class="canada-divider__icon" aria-hidden="true">${ICONS.snow}</span>
        <div class="canada-divider__body">
          <p class="body-sm">Not every resort is open yet this time of year. This list only includes places that are typically running by now.</p>
        </div>
      </div>`
    : "";

  if (!ranked.length) {
    body.innerHTML = seasonNoticeHtml + `<div class="center-state">${ICONS.warning}<p class="body-md">No resorts matched right now — try including beginner-friendly options.</p></div>` + canadaSectionHtml(canada);
    wireCanadaHandled();
    return;
  }

  body.innerHTML = seasonNoticeHtml + `<ol class="chase-list" id="chase-us-list">` +
    ranked.map((row, i) => chaseRowHtml(row, i + 1)).join("") +
    `</ol>` + canadaSectionHtml(canada);

  document.querySelectorAll(".chase-row[data-rid]").forEach((rowEl) => {
    rowEl.addEventListener("click", () => showChaseRowDetail(rowEl.dataset.rid));
    rowEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showChaseRowDetail(rowEl.dataset.rid); } });
  });

  if (!isRefresh) {
    revealListRows(document.querySelectorAll("#chase-us-list .chase-row"));
  } else {
    refreshListRows(document.querySelectorAll("#chase-us-list .chase-row"));
  }
}

function chaseRowHtml(row, rank) {
  const { resort, totalInches, snowQuality, feasibility } = row;
  const cold = snowQuality >= 0.5;
  const qualityWord = cold ? "Cold, light snow" : "Heavier, wetter snow";
  const tags = resort.best_for_tags || [];
  const terrainWord = tags.includes("steeps") ? "steep terrain to use it" : tags.includes("tree-skiing") ? "trees to use it" : "terrain to match";
  const reason = `${qualityWord} + ${terrainWord}`;
  const region = resort.state_province + (resort.country === "Canada" ? ", Canada" : "");

  let feasibilityChip = "";
  if (state.chaseAnswers.region && feasibility && feasibility.distanceMiles != null) {
    const hrs = Math.max(1, Math.round(feasibility.distanceMiles / 55));
    feasibilityChip = `<span class="chase-flag body-sm">${pluralize(hrs, "hour")} drive from ${(regionById(state.chaseAnswers.region) || {}).label || "your area"}</span>`;
  }
  const crowdFlag = (resort.crowd_level === "brutal" || resort.crowd_level === "high")
    ? `<span class="chase-flag chase-flag--crowd">${ICONS.crowd} Heads up — this gets crowded on a powder day</span>` : "";
  const nicoleFlag = resort.hot_take ? `<span class="chase-flag chase-flag--nicole">● Nicole's take →</span>` : "";

  return `
    <li>
      <div class="chase-row" data-rid="${resort.id}" role="link" tabindex="0" aria-label="${escapeHtml(resort.name)}, ${escapeHtml(region)}. ${totalInches} inches forecast next 7 days. ${escapeHtml(reason)}.">
        <span class="chase-row__avatar" aria-hidden="true">${badgeSvg(resort, "chase-row")}<span class="chase-row__rank">${rank}</span></span>
        <span class="chase-row__main">
          <span class="chase-row__name display-h3">${escapeHtml(resort.name)}</span>
          <span class="chase-row__region body-sm">${escapeHtml(region)}</span>
          <span class="chase-row__reason body-sm">${escapeHtml(reason)}</span>
          <span class="chase-row__flags">${feasibilityChip}${crowdFlag}${nicoleFlag}</span>
        </span>
        <span class="chase-row__badge">
          <span class="forecast-badge">
            <span class="forecast-badge__top">
              <span class="forecast-badge__icon">${cold ? ICONS.crystal : ICONS.droplet}</span>
              <span class="forecast-badge__inches data-inline">${totalInches}"</span>
            </span>
            <span class="forecast-badge__desc">next 7 days</span>
          </span>
        </span>
      </div>
    </li>`;
}

function canadaSectionHtml(canada) {
  if (!canada.length) return "";
  return `
    <div class="canada-divider">
      <span class="canada-divider__icon">${ICONS.signalSlash}</span>
      <div class="canada-divider__body">
        <h2 class="display-h3">Canada — no live forecast</h2>
        <p class="body-sm">The live forecast service only covers the US. These are ranked by typical season snowfall, not this week's — check the resort's own snow report for real-time numbers.</p>
      </div>
    </div>
    <ol class="chase-list" id="chase-canada-list">
      ${canada.map((resort, i) => typicalSeasonRowHtml(resort, i + 1)).join("")}
    </ol>`;
}

// Shared by the Canada section (always "typical season, not live" — NOAA
// has no non-US coverage) and the off-season preview below (deliberately
// the same visual/semantic treatment: both are honestly-labeled annual
// averages, never presented as this week's conditions).
function typicalSeasonRowHtml(resort, rank) {
  const region = resort.state_province + (resort.country === "Canada" ? ", Canada" : "");
  const nicoleFlag = resort.hot_take ? `<span class="chase-flag chase-flag--nicole">● Nicole's take →</span>` : "";
  return `
    <li>
      <div class="chase-row" data-rid="${resort.id}" role="link" tabindex="0" aria-label="${escapeHtml(resort.name)}, ${escapeHtml(region)}. Typical season average ${resort.avg_annual_snowfall_in ?? "unpublished"} inches. Not a live forecast.">
        <span class="chase-row__avatar" aria-hidden="true">${badgeSvg(resort, "chase-row")}<span class="chase-row__rank">${rank}</span></span>
        <span class="chase-row__main">
          <span class="chase-row__name display-h3">${escapeHtml(resort.name)}</span>
          <span class="chase-row__region body-sm">${escapeHtml(region)}</span>
          <span class="chase-row__flags">${nicoleFlag}</span>
        </span>
        <span class="chase-row__badge">
          <span class="forecast-badge">
            <span class="typical-season-tag">Typical season</span>
            <span class="forecast-badge__top">
              <span class="forecast-badge__icon">${ICONS.snow}</span>
              <span class="forecast-badge__inches data-inline">${resort.avg_annual_snowfall_in != null ? resort.avg_annual_snowfall_in + '"/yr' : "—"}</span>
            </span>
          </span>
        </span>
      </div>
    </li>`;
}

function wireCanadaHandled() {
  document.querySelectorAll("#chase-canada-list .chase-row, .chase-row[data-rid]").forEach((rowEl) => {
    if (rowEl.dataset.wired) return;
    rowEl.dataset.wired = "1";
    rowEl.addEventListener("click", () => showChaseRowDetail(rowEl.dataset.rid));
    rowEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showChaseRowDetail(rowEl.dataset.rid); } });
  });
}

// ---------------------------------------------------------------------------
// Off-season state (fix round, 2026-08-04). Design intent: this is not a
// banner bolted onto the normal ranked list — it fully replaces it. The
// screen states its situation plainly (nothing's realistically open), gives
// the one genuinely useful next action for August (plan ahead), and — since
// hiding all snow data outright would leave a visitor with nothing —
// optionally surfaces a clearly-labeled, collapsed-by-default preview of
// where it typically dumps in a normal mid-winter, built from the same
// honestly-labeled "typical season, not a forecast" pattern already used for
// Canada. It never claims that preview is current.
// ---------------------------------------------------------------------------

function topTypicalSeasonPreview(pool, n) {
  return pool
    .filter((r) => r.avg_annual_snowfall_in != null)
    .slice()
    .sort((a, b) => b.avg_annual_snowfall_in - a.avg_annual_snowfall_in)
    .slice(0, n);
}

function offSeasonPreviewHtml(preview) {
  const panelId = "offseason-preview-panel";
  return `
    <div class="offseason-preview">
      <button type="button" class="notes-row__expand-btn" aria-expanded="false" aria-controls="${panelId}" id="offseason-preview-toggle">
        <span>See where it typically dumps in mid-winter</span>
        <span class="stat-tile__expand-icon" aria-hidden="true">${ICONS.chevronDown}</span>
      </button>
      <div id="${panelId}" hidden>
        <div class="canada-divider" style="margin-top:var(--space-3)">
          <span class="canada-divider__icon" aria-hidden="true">${ICONS.signalSlash}</span>
          <div class="canada-divider__body">
            <span class="typical-season-tag">Typical season, not a forecast</span>
            <p class="body-sm">Based on typical snowfall for this time of year in a normal season, not what's happening right now.</p>
          </div>
        </div>
        <ol class="chase-list">
          ${preview.map((resort, i) => typicalSeasonRowHtml(resort, i + 1)).join("")}
        </ol>
      </div>
    </div>`;
}

function renderChaseOffSeason(body) {
  const preview = topTypicalSeasonPreview(RESORTS, 5);
  body.innerHTML = `
    <div class="center-state">
      ${ICONS.snow}
      <h2 class="display-h3">Nothing's open right now</h2>
      <p class="body-md" style="max-width:32rem">Most resorts open in November. Plan a trip now, then come back to chase the snow once the season starts.</p>
      <button class="btn btn-primary" id="offseason-plan-cta" type="button">Plan a trip</button>
    </div>
    ${preview.length ? offSeasonPreviewHtml(preview) : ""}`;

  document.getElementById("offseason-plan-cta").addEventListener("click", () => navigate("plan"));

  const toggleBtn = document.getElementById("offseason-preview-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const panel = document.getElementById(toggleBtn.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      toggleBtn.setAttribute("aria-expanded", String(!panel.hidden));
    });
  }

  body.querySelectorAll(".chase-row[data-rid]").forEach((rowEl) => {
    rowEl.addEventListener("click", () => showChaseRowDetail(rowEl.dataset.rid));
    rowEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showChaseRowDetail(rowEl.dataset.rid); } });
  });
}

function showChaseRowDetail(rid) {
  const resort = RESORTS_BY_ID[rid];
  if (!resort) return;
  // Reuses the trip-planner result-card component with a minimal, honest
  // reason set built purely from Chase-the-Snow context (no quiz answers to
  // draw from in this mode).
  const bullets = [];
  const fc = state.chaseCache && state.chaseCache.forecasts[rid];
  if (fc) {
    bullets.push(fc.isLive ? `${fc.totalInches}" forecast over the next 7 days.` : `Typical for this time of year: about ${fc.totalInches}" a week during the core season.`);
  } else if (resort.avg_annual_snowfall_in != null) {
    // Off-season preview row — there's no forecast fetch in this state at
    // all (see renderChaseOffSeason), so the only honest snow fact
    // available is the published annual average, clearly framed as such.
    bullets.push(`Averages about ${resort.avg_annual_snowfall_in}" a year in a typical season.`);
  }
  // sanitizeDatasetProse strips research-register framing before this raw
  // dataset field reaches a reader (Fix 3, synthetic-user-testing.md) — same
  // helper as the result card's ski-school disclosure and Range Readout.
  if (resort.character_note) bullets.push(sanitizeDatasetProse(resort.character_note));
  if (resort.crowd_level) bullets.push(CROWD_COPY[resort.crowd_level]);
  const payload = { v: 1, rid: resort.id, reasonBullets: bullets.slice(0, 3), showRangeReadout: false, range: null };
  // fresh: true — this is a same-session, self-generated view (the user just
  // tapped their own Chase-the-Snow row), not a cold shared link, so it must
  // render in the "Your pick" / "You said" voice, not the cold-view one.
  // origin: "chase" — this detail view is the trip-planner result card reused,
  // so it shares that route's dead-end problem and its fix. Back returns to the
  // ranked list, which is still in state.chaseCache and re-renders without a
  // refetch.
  navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true, origin: "chase" });
}

function revealListRows(rows) {
  const reduce = reduceMotion();
  rows.forEach((row, i) => {
    if (reduce) { row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease", fill: "both" }); return; }
    const staggerIndex = Math.min(i, 5);
    row.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 160, delay: staggerIndex * 50, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
  });
}
function refreshListRows(rows) {
  rows.forEach((row) => row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease", fill: "both" }));
}
