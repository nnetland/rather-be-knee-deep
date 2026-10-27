// ---------------------------------------------------------------------------
// Nicole's List — a browsable, filterable reference. Not a peer recommender:
// "not a ranked list, just her record" (copy-deck §7). Real <table> markup
// per the copy deck's own screen-reader dry-run (caption + scope="col"
// headers), styled to the calmer "browse and trust" register.
//
// v2 (design review 2026-08-05) — Verdict + Take:
//   * The click is gone. Takes render in full at every row; nothing is
//     truncated at runtime. The old 58-char preview was systematically
//     biased — six of the nine takes are structured praise-then-caveat, so
//     clipping deleted the caveat every time, and Breckenridge's pan read
//     as a compliment.
//   * Two tiers. A short verdict line (the decision) is the scan stripe;
//     the take (the texture) sits under it. Authoring limits: verdict
//     18-40, take 45-95, combined <= 130. Enforced when writing, never by
//     the renderer.
//   * The per-row "Nicole's take" label is gone at the Director's call —
//     it was repetitive and ate the space the verdict needs. R5 is now
//     carried at page level instead: a first-person standing line, an
//     honest coverage count, and a visually-hidden per-row attribution so
//     a screen-reader user landing mid-list still knows whose voice this
//     is. THIS PAGE ONLY — the recommendation and quiver screens keep the
//     labelled, quarantined hot-take block.
//   * Column order is Place / Nicole's take / Best for / Region so DOM
//     order matches visual order at both breakpoints (1.3.2), rather than
//     reordering cards with flex `order`.
// ---------------------------------------------------------------------------

function buildNicolesRows() {
  return NICOLES_LIST.map((row) => {
    const resort = row.resort_id ? RESORTS_BY_ID[row.resort_id] : null;
    return {
      place: resort ? resort.name : row.resort_place,
      region: row.region_state,
      rating: row.overall_rating,
      verdict: row.nicoles_verdict,
      take: row.nicoles_take,
      tags: resort ? (resort.best_for_tags || []) : [],
      scale: resort ? resort.scale : null,
      country: resort ? resort.country : null,
      resortId: row.resort_id,
    };
  });
}

function renderNicolesList(main) {
  const rows = buildNicolesRows();
  const regions = ["all", ...Array.from(new Set(rows.map((r) => r.region))).sort()];

  main.innerHTML = `
    <div class="page-column">
      <h1 class="display-h1">Nicole's picks</h1>
      <p class="nicoleslist-voice body-md">Everywhere I've skied, and what I <strong>actually</strong> think. Not a ranked list, just my record — and some of these aren't flattering.</p>
      <p class="nicoleslist-status data-label">${rows.filter((r) => r.take).length} of ${rows.length} written so far</p>
      <div class="nicoleslist-filters" role="group" aria-label="Filter Nicole's list">
        ${regions.map((r) => `<button class="filter-chip ${state.nicolesFilters.region === r ? "filter-chip--selected" : ""}" data-region="${escapeHtml(r)}" type="button" aria-pressed="${state.nicolesFilters.region === r}">${r === "all" ? "All regions" : escapeHtml(r)}</button>`).join("")}
      </div>
      ${rows.some((r) => r.scale === "day-trip" || (r.country && r.country !== "USA" && r.country !== "Canada")) ? `<p class="body-sm" style="color:var(--text-secondary);margin-bottom:var(--space-4)"><span class="info-badge">Day-trip hill</span> / <span class="info-badge">International</span> — not part of the trip-planner or snow-chase matches — just her record.</p>` : ""}
      <div id="nicoles-table-wrap"></div>
    </div>`;

  document.querySelectorAll(".filter-chip[data-region]").forEach((btn) => {
    btn.addEventListener("click", () => { state.nicolesFilters.region = btn.dataset.region; renderNicolesTable(rows); syncFilterChips(); });
  });

  renderNicolesTable(rows);

  // Arrived from the one permitted link out of Rants & Raves ("Read Nicole's
  // take on Alta"). That link only renders when a take actually exists, so the
  // row is always there — but this page is 44 rows long, and dropping the user
  // at the top of it would make the link's promise technically true and
  // practically false. Scroll only: the row is not an interactive target, and
  // focus stays on the h1 where focusHeading() puts it below.
  if (state.routeParams && state.routeParams.focusResort) {
    const row = document.getElementById(`nicoles-row-${state.routeParams.focusResort}`);
    if (row) row.scrollIntoView({ block: "center", behavior: "auto" });
  }

  document.title = "Nicole's picks — find your next ski trip";
  setOgMeta({ title: "Find your next ski trip", description: "Everywhere Nicole's actually skied, with her real takes where she has one." });
  focusHeading(main);
}

function syncFilterChips() {
  document.querySelectorAll(".filter-chip[data-region]").forEach((btn) => {
    const selected = btn.dataset.region === state.nicolesFilters.region;
    btn.classList.toggle("filter-chip--selected", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
}

// Responsive treatment (design-critic.md finding 5/6, accessibility-review.md
// M6/M8 fixes): this is a real <table> at every width — <caption>,
// scope="col" headers, and explicit `role`s on every table element — so a
// screen reader always gets genuine table semantics (column context per
// cell, row/column counts) regardless of how the CSS displays it. Below the
// card breakpoint (styles.css), the same markup is restyled into one card
// per row via CSS alone; the explicit roles keep that restyling from
// silently stripping table semantics for AT the way plain `display: block`
// on table elements can. `data-label` attributes drive the visible
// per-field label in the card layout (CSS `content: attr(data-label)`) —
// redundant with, not a replacement for, the real column headers.
function renderNicolesTable(rows) {
  const wrap = document.getElementById("nicoles-table-wrap");
  const filtered = state.nicolesFilters.region === "all" ? rows : rows.filter((r) => r.region === state.nicolesFilters.region);

  wrap.innerHTML = `
    <div class="nicoles-table-scroll">
      <table class="nicoles-table" role="table">
        <caption class="visually-hidden">Nicole's ski history, ${filtered.length} places</caption>
        <thead class="nicoles-table__head">
          <tr role="row">
            <th scope="col" role="columnheader" class="data-label">Place</th>
            <th scope="col" role="columnheader" class="data-label">Nicole's take</th>
            <th scope="col" role="columnheader" class="data-label">Best for</th>
            <th scope="col" role="columnheader" class="data-label">Region</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          ${filtered.map(nicolesRowHtml).join("")}
        </tbody>
      </table>
    </div>`;
}

function nicolesRowHtml(row) {
  const badges = [];
  if (row.scale === "day-trip") badges.push(`<span class="info-badge" aria-label="Day-trip hill. Not part of the trip-planner or snow-chase matches — just her record">Day-trip hill</span>`);
  if (row.country && row.country !== "USA" && row.country !== "Canada") badges.push(`<span class="info-badge" aria-label="International. Not part of the trip-planner or snow-chase matches — just her record">International</span>`);

  // M6 fix: tags used to be plain <span>s joined with an empty string, which
  // concatenated into unparseable run-on text for a screen reader (e.g.
  // "deep powderbig vertbackcountry access"). A real <ul>/<li> list gives AT
  // a genuine "list of N items" with real boundaries between items, not just
  // a CSS gap that only sighted users can see. `role="list"`/"listitem" are
  // explicit because `list-style: none` silently drops the implicit list
  // role in some browser/AT combinations (a known Safari/VoiceOver gotcha).
  const tagsHtml = row.tags.length
    ? `<ul class="tag-row" role="list">${row.tags.slice(0, 4).map((t) => `<li class="pill-tag" role="listitem">${escapeHtml(t.replace(/-/g, " "))}</li>`).join("")}</ul>`
    : `<span class="body-sm data-gap">—</span>`;

  // No truncation and no disclosure control. The visually-hidden prefix is
  // what keeps R5 intact now that the visible per-row label is gone: a
  // screen-reader user who jumps straight to a resort by heading, or who
  // never heard the page intro, still gets "Nicole's take:" before the
  // opinion — otherwise a pan like "My least favorite in CO" is announced
  // in the app's own neutral voice.
  //
  // A negative take renders identically to a positive one. No sentiment
  // colour, no icon, no rating glyph: takes carry zero ranking weight
  // (engine.js), sentiment styling would fail 1.4.1, and it would make an
  // honest pan look like a validation error.
  const takeHtml = row.take
    ? `<span class="visually-hidden">Nicole's take on ${escapeHtml(row.place)}: </span>
       ${row.verdict ? `<p class="take-verdict">${escapeHtml(row.verdict)}</p>` : ""}
       <p class="take-body body-sm">${escapeHtml(row.take)}</p>
       ${row.rating ? `<p class="data-inline take-rating">${escapeHtml(String(row.rating))}/10</p>` : ""}`
    : `<span class="take-empty body-sm">No take yet</span>`;

  return `
    <tr role="row" class="nicoles-table__row"${row.resortId ? ` id="nicoles-row-${escapeHtml(row.resortId)}"` : ""}>
      <td role="cell" class="nicoles-table__cell nicoles-table__cell--place">
        <span class="display-h3" style="display:block">${escapeHtml(row.place)}</span>
        ${badges.length ? `<div class="nicoles-badges" style="margin-top:var(--space-1)">${badges.join("")}</div>` : ""}
      </td>
      <td role="cell" class="nicoles-table__cell nicoles-table__cell--take" data-label="Nicole's take">${takeHtml}</td>
      <td role="cell" class="nicoles-table__cell" data-label="Best for">${tagsHtml}</td>
      <td role="cell" class="nicoles-table__cell nicoles-table__cell--region" data-label="Region"><span class="body-sm" style="color:var(--text-secondary)">${escapeHtml(row.region)}</span></td>
    </tr>`;
}
