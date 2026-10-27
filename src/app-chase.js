// ---------------------------------------------------------------------------
// Chase the Snow — near-zero-input ranked forecast list.
// Fallback-first: renders fully and honestly from historical data the moment
// the network is unavailable; live NOAA data (when reachable) simply swaps
// in with a visible, honest badge change, never silently.
// ---------------------------------------------------------------------------

function renderChase(main) {
  // Content first (Director, 2026-10-26): title, one line of facts, the
  // filters as a single chip row, then the list. Opening dates and the
  // forecast's own update time replace the explainer paragraphs; anything
  // longer lives in "About this data" at the bottom.
  const now = appNow();
  const seasonInfo = effectiveSeasonState(RESORTS, now);
  state.chaseSeasonInfo = seasonInfo;
  const showControls = seasonInfo.state !== "off-season";

  main.innerHTML = `
    <div class="page-column">
      <h1 class="display-h1">Where's it dumping?</h1>
      <div id="chase-freshness"></div>
      ${showControls ? `
        <div class="chip-row chase-controls" role="group" aria-label="Filter the list">
          <label class="select-chip">
            <span class="select-chip__label">Near</span>
            <select id="chase-region-select" aria-label="Closest to home">
              <option value="">Anywhere</option>
              ${REGIONS.filter((r) => r.id !== "elsewhere").map((r) => `<option value="${r.id}" ${state.chaseAnswers.region === r.id ? "selected" : ""}>${r.label}</option>`).join("")}
            </select>
            <span class="select-chip__chev" aria-hidden="true">${ICONS.chevronDown}</span>
          </label>
          <button class="filter-chip" type="button" id="chase-beginner-toggle-wrap" aria-pressed="false">
            <span class="filter-chip__check" aria-hidden="true">${ICONS.check}</span>Beginner-friendly
          </button>
        </div>` : ""}
      <div id="chase-body"></div>
      <div id="chase-about"></div>
    </div>`;

  if (showControls) {
    document.getElementById("chase-region-select").addEventListener("change", (e) => {
      state.chaseAnswers.region = e.target.value || null;
      renderChaseList(); // re-rank with new feasibility discount, no reload of forecasts needed
    });
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

function wireBeginnerToggle() {
  const btn = document.getElementById("chase-beginner-toggle-wrap");
  const sync = () => {
    btn.classList.toggle("filter-chip--selected", !!state.chaseAnswers.includeBeginnerFriendly);
    btn.setAttribute("aria-pressed", String(!!state.chaseAnswers.includeBeginnerFriendly));
  };
  sync();
  btn.addEventListener("click", () => {
    state.chaseAnswers.includeBeginnerFriendly = !state.chaseAnswers.includeBeginnerFriendly;
    sync();
    renderChaseList(true);
  });
}

// Which US resorts get a forecast fetched. In season: all of them. In the
// shoulder (October, May): the ones that are open, plus — on the way INTO a
// season only — the ones opening in the next 60 days, so their snow can show
// beside their opening date the way OpenSnow does. Spring closures don't
// appear as "opening soon".
const CHASE_UPCOMING_WINDOW_DAYS = 60;
function chasePool(now, seasonInfo) {
  const us = RESORTS.filter((r) => r.country === "USA" && r.lat != null);
  if (seasonInfo.state !== "shoulder") return us;
  const horizon = now.getTime() + CHASE_UPCOMING_WINDOW_DAYS * 864e5;
  return us.filter((r) => {
    const o = resortOpening(r, now);
    if (o.open) return true;
    const key = openingSortKey(r, now);
    return key > now.getTime() && key <= horizon;
  });
}

function loadAndRenderChase() {
  const body = document.getElementById("chase-body");
  const now = appNow();
  const seasonInfo = effectiveSeasonState(RESORTS, now);
  state.chaseSeasonInfo = seasonInfo;

  if (seasonInfo.state === "off-season") {
    // Nothing in the pool is realistically open — don't fetch, don't rank,
    // don't render a solemn list of near-zero forecasts.
    renderChaseOffSeason(body);
    return;
  }

  if (state.chaseCache) {
    renderChaseList();
    return;
  }

  const usResorts = chasePool(now, seasonInfo);
  if (!usResorts.length) {
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
      // Manual skip-ahead escape: the typical-season figures are already
      // sitting there, so nobody has to ride out the 10s hard timeout.
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
      if (payload.anyFallback && !chaseAnyLive(payload.forecasts)) {
        announce("forecast-status-announcer", "Live forecast unavailable — showing typical snowfall instead of this week's forecast.");
      }
    }
  });
}

function chaseAnyLive(forecasts) {
  return Object.values(forecasts || {}).some((f) => f && f.isLive);
}

// The fact line. Live: the source and when NWS last regenerated the grid.
// Not live: one line that says so, in the warm warning colour, with a retry.
// Partial (some resorts fell back): the live stamp, and the fallen-back rows
// carry their own "Typical" tag — the page doesn't claim more than it has.
function chaseFreshnessHtml(forecasts, now) {
  const live = Object.values(forecasts || {}).filter((f) => f && f.isLive);
  if (!live.length) {
    return `<div class="page-meta-wrap" id="freshness-badge">
      <ul class="page-meta body-sm">
        <li class="freshness-badge--fallback"><span><span class="freshness-badge__text">Not a live forecast</span> — typical snowfall for this time of year. <button class="btn-text" id="retry-forecast" type="button">Try again</button></span></li>
      </ul>
    </div>`;
  }
  const latest = Math.max.apply(null, live.map((f) => f.updatedAt || 0));
  const stamp = updatedStamp(latest, now);
  return `<div class="page-meta-wrap" id="freshness-badge">${pageMetaHtml([
    "NWS 7-day forecast",
    stamp ? `Updated ${escapeHtml(stamp)}` : "Updated today",
  ])}</div>`;
}

function chaseAboutHtml(anyCanada) {
  return pageAboutHtml("About this data", `
    <p>Snow totals are the National Weather Service's 7-day forecast for each mountain, refreshed every time you open this page. Ranked by snow quality and terrain, not just inches — cold, light snow on steep terrain beats a wet foot on groomers.</p>
    <p>Opening days are each resort's published ${OPENINGS_SEASON} date. Resorts sometimes slip a few days; "Usually" means the resort hasn't announced one yet.</p>
    ${anyCanada ? "<p>The forecast service only covers the US, so Canadian resorts show typical season snowfall instead. Check the resort's own snow report for real-time numbers.</p>" : ""}
    <p>A weather forecast, not a snow report: it can't see base depth, grooming, or what's already tracked out.</p>`, "chase-about-details");
}

function renderChaseList(isRefresh) {
  const body = document.getElementById("chase-body");
  const freshnessWrap = document.getElementById("chase-freshness");
  if (!state.chaseCache) return;
  const now = appNow();

  const { forecasts } = state.chaseCache;
  freshnessWrap.innerHTML = chaseFreshnessHtml(forecasts, now);
  const retryBtn = document.getElementById("retry-forecast");
  if (retryBtn) retryBtn.addEventListener("click", () => { state.chaseCache = null; loadAndRenderChase(); });

  // Split open from not-yet-open. Only open resorts are ranked; the rest list
  // by opening day, each carrying its date — that IS the explanation.
  const openFc = {}, upcoming = [];
  for (const id of Object.keys(forecasts)) {
    const r = RESORTS_BY_ID[id];
    if (!r) continue;
    if (resortOpening(r, now).open) openFc[id] = forecasts[id];
    else upcoming.push(r);
  }
  upcoming.sort((a, b) => openingSortKey(a, now) - openingSortKey(b, now));

  const ranked = rankChaseTheSnow(openFc, state.chaseAnswers, RESORTS);
  const canada = rankCanadaTypicalSeason(RESORTS);
  const about = document.getElementById("chase-about");
  if (about) about.innerHTML = chaseAboutHtml(canada.length > 0);

  const upcomingRows = upcoming
    .filter((r) => state.chaseAnswers.includeBeginnerFriendly || r.scale !== "day-trip")
    .map((r) => ({ resort: r, totalInches: forecasts[r.id].totalInches,
      snowQuality: forecasts[r.id].avgTempF != null ? Math.max(0, Math.min(1, 1 - (forecasts[r.id].avgTempF - 10) / 45)) : 0.6,
      feasibility: null }));

  // Nothing open at all (late October): skip the empty "open" block and lead
  // with what's coming. Something open but filtered out: say so in one line.
  const nothingOpen = Object.keys(openFc).length === 0;
  const openHeading = upcomingRows.length && !nothingOpen
    ? `<h2 class="chase-group-h data-label" id="chase-open-h">Open now · ${ranked.length}</h2>` : "";
  const upcomingHtml = upcomingRows.length ? `
    <h2 class="chase-group-h data-label" id="chase-upcoming-h">${nothingOpen ? "Nothing's open yet · Opening soon" : "Opening soon"}</h2>
    <ul class="chase-list chase-list--upcoming" id="chase-upcoming-list" aria-labelledby="chase-upcoming-h">
      ${upcomingRows.map((row) => chaseRowHtml(row, null)).join("")}
    </ul>` : "";

  let openHtml = "";
  if (ranked.length) {
    openHtml = `<ol class="chase-list" id="chase-us-list"${openHeading ? ' aria-labelledby="chase-open-h"' : ""}>` + ranked.map((row, i) => chaseRowHtml(row, i + 1)).join("") + `</ol>`;
  } else if (!nothingOpen || !upcomingRows.length) {
    openHtml = `<div class="center-state">${ICONS.warning}<p class="body-md">Nothing open matches right now — try Beginner-friendly.</p></div>`;
  }

  body.innerHTML = openHeading + openHtml + upcomingHtml + canadaSectionHtml(canada);

  document.querySelectorAll("#chase-body .chase-row[data-rid]").forEach((rowEl) => {
    rowEl.addEventListener("click", () => showChaseRowDetail(rowEl.dataset.rid));
    rowEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showChaseRowDetail(rowEl.dataset.rid); } });
    rowEl.dataset.wired = "1";
  });

  const rows = document.querySelectorAll("#chase-body .chase-row");
  if (!isRefresh) revealListRows(rows); else refreshListRows(rows);
}

function chaseRowHtml(row, rank) {
  const { resort, totalInches, snowQuality, feasibility } = row;
  const fc = state.chaseCache && state.chaseCache.forecasts[resort.id];
  const isLive = !fc || fc.isLive;
  const cold = snowQuality >= 0.5;
  const qualityWord = cold ? "Cold, light snow" : "Heavier, wetter snow";
  const tags = resort.best_for_tags || [];
  const terrainWord = tags.includes("steeps") ? "steep terrain to use it" : tags.includes("tree-skiing") ? "trees to use it" : "terrain to match";
  const reason = `${qualityWord} + ${terrainWord}`;
  const region = resort.state_province + (resort.country === "Canada" ? ", Canada" : "");
  const opening = resortOpening(resort);
  const statusHtml = opening.open ? "" : `<span class="chase-row__status">${escapeHtml(opening.label)}</span>`;

  let feasibilityChip = "";
  if (state.chaseAnswers.region && feasibility && feasibility.distanceMiles != null) {
    const hrs = Math.max(1, Math.round(feasibility.distanceMiles / 55));
    feasibilityChip = `<span class="chase-flag body-sm">${pluralize(hrs, "hour")} drive from ${(regionById(state.chaseAnswers.region) || {}).label || "your area"}</span>`;
  }
  const crowdFlag = (resort.crowd_level === "brutal" || resort.crowd_level === "high")
    ? `<span class="chase-flag chase-flag--crowd">${ICONS.crowd} Crowded on powder days</span>` : "";
  const nicoleFlag = resort.hot_take ? `<span class="chase-flag chase-flag--nicole">● Nicole's take →</span>` : "";
  const rankHtml = rank != null ? `<span class="chase-row__rank">${rank}</span>` : "";
  const spoken = `${escapeHtml(resort.name)}, ${escapeHtml(region)}.${opening.open ? "" : " " + escapeHtml(opening.label) + "."} ${totalInches} inches ${isLive ? "forecast next 7 days" : "in a typical week, not a live forecast"}. ${opening.open ? escapeHtml(reason) + "." : ""}`;

  return `
    <li>
      <div class="chase-row${rank == null ? " chase-row--upcoming" : ""}" data-rid="${resort.id}" role="link" tabindex="0" aria-label="${spoken}">
        <span class="chase-row__avatar" aria-hidden="true">${badgeSvg(resort, "chase-row")}${rankHtml}</span>
        <span class="chase-row__main">
          <span class="chase-row__name display-h3">${escapeHtml(resort.name)}</span>
          <span class="chase-row__region body-sm">${escapeHtml(region)}${statusHtml ? " · " : ""}${statusHtml}</span>
          ${opening.open ? `<span class="chase-row__reason body-sm">${escapeHtml(reason)}</span>` : ""}
          <span class="chase-row__flags">${feasibilityChip}${crowdFlag}${nicoleFlag}</span>
        </span>
        <span class="chase-row__badge">
          <span class="forecast-badge">
            ${isLive ? "" : '<span class="typical-season-tag">Typical</span>'}
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
    <h2 class="chase-group-h data-label" id="chase-canada-h">Canada · typical season</h2>
    <ol class="chase-list" id="chase-canada-list" aria-labelledby="chase-canada-h">
      ${canada.map((resort, i) => typicalSeasonRowHtml(resort, i + 1)).join("")}
    </ol>`;
}

// Shared by the Canada section (always typical season — NOAA has no non-US
// coverage) and the off-season preview. Both are honestly-labelled annual
// averages, never presented as this week's conditions.
function typicalSeasonRowHtml(resort, rank) {
  const region = resort.state_province + (resort.country === "Canada" ? ", Canada" : "");
  const nicoleFlag = resort.hot_take ? `<span class="chase-flag chase-flag--nicole">● Nicole's take →</span>` : "";
  const opening = state.chaseSeasonInfo && state.chaseSeasonInfo.state !== "off-season" ? resortOpening(resort) : { open: true };
  const statusHtml = opening.open ? "" : ` · <span class="chase-row__status">${escapeHtml(opening.label)}</span>`;
  return `
    <li>
      <div class="chase-row" data-rid="${resort.id}" role="link" tabindex="0" aria-label="${escapeHtml(resort.name)}, ${escapeHtml(region)}.${opening.open ? "" : " " + escapeHtml(opening.label) + "."} Typical season average ${resort.avg_annual_snowfall_in ?? "unpublished"} inches a year. Not a live forecast.">
        <span class="chase-row__avatar" aria-hidden="true">${badgeSvg(resort, "chase-row")}<span class="chase-row__rank">${rank}</span></span>
        <span class="chase-row__main">
          <span class="chase-row__name display-h3">${escapeHtml(resort.name)}</span>
          <span class="chase-row__region body-sm">${escapeHtml(region)}${statusHtml}</span>
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
