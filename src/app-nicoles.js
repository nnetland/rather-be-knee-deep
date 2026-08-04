// ---------------------------------------------------------------------------
// Nicole's List — a browsable, filterable reference. Not a peer recommender:
// "not a ranked list, just her record" (copy-deck §7). Real <table> markup
// per the copy deck's own screen-reader dry-run (caption + scope="col"
// headers), styled to the calmer "browse and trust" register.
// ---------------------------------------------------------------------------

function buildNicolesRows() {
  return NICOLES_LIST.map((row) => {
    const resort = row.resort_id ? RESORTS_BY_ID[row.resort_id] : null;
    return {
      place: resort ? resort.name : row.resort_place,
      region: row.region_state,
      rating: row.overall_rating,
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
      <h1 class="display-h1">Nicole's list</h1>
      <p class="nicoleslist-intro body-md">Everywhere Nicole has actually skied — not a ranked list, just her record.</p>
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
  document.title = "Nicole's list — find your next ski trip";
  setOgMeta({ title: "Find your next ski trip", description: "Everywhere Nicole's actually skied, with her real hot takes where she has one." });
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
            <th scope="col" role="columnheader" class="data-label">Region</th>
            <th scope="col" role="columnheader" class="data-label">Best for</th>
            <th scope="col" role="columnheader" class="data-label">Nicole's Hot Take</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          ${filtered.map(nicolesRowHtml).join("")}
        </tbody>
      </table>
    </div>`;

  wrap.querySelectorAll(".take-preview[data-expand]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const full = btn.parentElement.querySelector(".take-full");
      if (full) full.hidden = !full.hidden;
      btn.setAttribute("aria-expanded", String(full && !full.hidden));
    });
  });
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

  // Finding 6 fix: JS-level truncation was already correct, but the
  // containing cell had no `white-space: nowrap`/`text-overflow` handling,
  // so the already-truncated string wrapped into a tall, jagged, roughly
  // one-word-per-line column instead of the spec'd single-line preview. The
  // truncation itself is unchanged here — styles.css now enforces the
  // single line.
  const takeHtml = row.take
    ? (() => {
        const preview = row.take.length > 60 ? row.take.slice(0, 58).trimEnd() + "…" : row.take;
        return `<button class="take-preview" data-expand aria-expanded="false" type="button" aria-label="Nicole's hot take on ${escapeHtml(row.place)} — expand to read.">
          <span class="take-preview__mark" aria-hidden="true">&ldquo;</span>
          <span class="take-preview__text body-sm">${escapeHtml(preview)}</span>
        </button>
        <div class="take-full" hidden>${escapeHtml(row.take)}${row.rating ? `<div class="data-inline" style="margin-top:var(--space-2)">${escapeHtml(String(row.rating))}/10</div>` : ""}</div>`;
      })()
    : `<span class="take-empty body-sm">No hot take yet</span>`;

  return `
    <tr role="row" class="nicoles-table__row">
      <td role="cell" class="nicoles-table__cell nicoles-table__cell--place">
        <span class="display-h3" style="display:block">${escapeHtml(row.place)}</span>
        ${badges.length ? `<div class="nicoles-badges" style="margin-top:var(--space-1)">${badges.join("")}</div>` : ""}
      </td>
      <td role="cell" class="nicoles-table__cell" data-label="Region"><span class="body-sm" style="color:var(--text-secondary)">${escapeHtml(row.region)}</span></td>
      <td role="cell" class="nicoles-table__cell" data-label="Best for">${tagsHtml}</td>
      <td role="cell" class="nicoles-table__cell nicoles-table__cell--take" data-label="Nicole's Hot Take">${takeHtml}</td>
    </tr>`;
}
