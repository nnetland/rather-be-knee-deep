// ---------------------------------------------------------------------------
// Chase the Snow — near-zero-input ranked forecast list.
// Fallback-first: renders fully and honestly from historical data the moment
// the network is unavailable; live NOAA data (when reachable) simply swaps
// in with a visible, honest badge change, never silently.
// ---------------------------------------------------------------------------

function renderChase(main) {
  main.innerHTML = `
    <div class="page-column">
      <h1 class="display-h1">Where's it dumping?</h1>
      <div class="chase-controls" style="margin-top:var(--space-4)">
        <div id="chase-origin-control"></div>
        <label class="tap-chip" style="width:auto;min-width:220px" id="chase-beginner-toggle-wrap">
          <span class="tap-chip__indicator tap-chip__indicator--check" id="chase-beginner-indicator">${ICONS.check}</span>
          <span class="tap-chip__body">
            <span class="tap-chip__label">Include beginner-friendly options</span>
            <span class="tap-chip__sublabel">Off by default — this list leans toward serious terrain.</span>
          </span>
        </label>
      </div>
      <div id="chase-freshness"></div>
      <div id="chase-body"></div>
    </div>`;

  renderChaseOriginControl();
  wireBeginnerToggle();
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
  const usResorts = RESORTS.filter((r) => r.country === "USA" && r.lat != null);

  if (state.chaseCache) {
    renderChaseList();
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
  freshnessWrap.innerHTML = anyFallback
    ? `<div class="freshness-badge freshness-badge--fallback" id="freshness-badge">
        <span id="freshness-icon-historical">${ICONS.signalSlash}</span>
        <span class="freshness-badge__text body-sm">Not a live forecast</span>
      </div>
      <p class="body-sm" style="color:var(--text-secondary);margin:0 0 var(--space-4)">We couldn't reach the live forecast right now. This is the typical snowfall for this time of year, not what's coming this week. <button class="btn-text" id="retry-forecast" type="button" style="padding:0">Try again</button></p>`
    : `<div class="freshness-badge" id="freshness-badge"><span id="freshness-icon-live">${ICONS.live}</span><span class="freshness-badge__text body-sm">Live forecast · updated moments ago</span></div>`;

  const retryBtn = document.getElementById("retry-forecast");
  if (retryBtn) retryBtn.addEventListener("click", () => { state.chaseCache = null; loadAndRenderChase(); });

  const ranked = rankChaseTheSnow(forecasts, state.chaseAnswers, RESORTS);
  const canada = rankCanadaTypicalSeason(RESORTS);

  if (!ranked.length) {
    body.innerHTML = `<div class="center-state">${ICONS.warning}<p class="body-md">No resorts matched right now — try including beginner-friendly options.</p></div>` + canadaSectionHtml(canada);
    wireCanadaHandled();
    return;
  }

  body.innerHTML = `<ol class="chase-list" id="chase-us-list">` +
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
      ${canada.map((resort, i) => canadaRowHtml(resort, i + 1)).join("")}
    </ol>`;
}

function canadaRowHtml(resort, rank) {
  const region = `${resort.state_province}, Canada`;
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

function showChaseRowDetail(rid) {
  const resort = RESORTS_BY_ID[rid];
  if (!resort) return;
  // Reuses the trip-planner result-card component with a minimal, honest
  // reason set built purely from Chase-the-Snow context (no quiz answers to
  // draw from in this mode).
  const bullets = [];
  const fc = state.chaseCache && state.chaseCache.forecasts[rid];
  if (fc) bullets.push(fc.isLive ? `${fc.totalInches}" forecast over the next 7 days.` : `Typical for this time of year: about ${fc.totalInches}" a week during the core season.`);
  // sanitizeDatasetProse strips research-register framing before this raw
  // dataset field reaches a reader (Fix 3, synthetic-user-testing.md) — same
  // helper as the result card's ski-school disclosure and Range Readout.
  if (resort.character_note) bullets.push(sanitizeDatasetProse(resort.character_note));
  if (resort.crowd_level) bullets.push(CROWD_COPY[resort.crowd_level]);
  const payload = { v: 1, rid: resort.id, reasonBullets: bullets.slice(0, 3), showRangeReadout: false, range: null };
  // fresh: true — this is a same-session, self-generated view (the user just
  // tapped their own Chase-the-Snow row), not a cold shared link, so it must
  // render in the "Your pick" / "You said" voice, not the cold-view one.
  navigate("result", { shared: payload, shareToken: b64urlEncode(JSON.stringify(payload)), fresh: true });
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
