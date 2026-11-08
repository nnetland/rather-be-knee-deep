// Areas — the one "where the resort is" vocabulary, used by every surface
// (Chase, Quiver, Buzz, Picks). Director's call 2026-11-07: one region picker
// across the app, modelled on Nicole's picks.
//
// AREA vs ORIGIN. An area is where a resort IS, and filtering by it hides
// everything else. The home metros in REGIONS (data.js) are where the skier is
// COMING FROM; Plan a trip asks for one and Chase uses it to rank, labelled
// "Traveling from". The two never share a control or a word.
//
// Ten areas rather than every state: eleven-plus chips is already a scrolling
// row, and several states hold one or two resorts. Labels name states where a
// group word would make people guess ("Montana, Wyoming & Idaho", not
// "Northern Rockies").
const AREAS = [
  { id: "colorado", name: "Colorado", states: ["Colorado"] },
  { id: "utah", name: "Utah", states: ["Utah"] },
  { id: "california", name: "California", states: ["California"] },
  { id: "pnw", name: "Pacific Northwest", states: ["Oregon", "Washington", "Pacific Northwest"] },
  { id: "rockies", name: "Montana, Wyoming & Idaho", states: ["Montana", "Wyoming", "Idaho"] },
  { id: "southwest", name: "New Mexico", states: ["New Mexico"] },
  { id: "alaska", name: "Alaska", states: ["Alaska"] },
  { id: "west-canada", name: "Western Canada", states: ["British Columbia", "Alberta"] },
  { id: "northeast", name: "Northeast & Quebec", states: ["Vermont", "Maine", "New Hampshire", "Connecticut", "Quebec"] },
  { id: "midwest", name: "Midwest", states: ["Minnesota", "Michigan", "Wisconsin"] },
];
const AREAS_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

// Takes a state/province name, or one of Nicole's sheet values ("Pacific
// Northwest"). Anything unknown (Europe) has no area and is shown only under
// "All regions".
function areaOfState(name) {
  return AREAS.find((a) => a.states.includes(name)) || null;
}
function areaOfResort(resort) { return areaOfState(resort.state_province); }

// The shared control: a chip row that scrolls sideways when it doesn't fit,
// "All regions" first, then only the areas that have something to show on
// this surface, in the fixed geographic order above. `extra` adds a
// surface-specific chip at the end (Buzz's "General").
function areaChipsHtml(surface, activeId, availableIds, extra) {
  const ids = AREAS.map((a) => a.id).filter((id) => availableIds.has(id));
  const chip = (id, label) => {
    const on = activeId === id;
    return `<button class="filter-chip ${on ? "filter-chip--selected" : ""}" data-area="${id}" type="button" aria-pressed="${on}">${escapeHtml(label)}</button>`;
  };
  return `
    <div class="area-chips chip-row chip-row--scroll" id="${surface}-area-chips" role="group" aria-label="Filter by region">
      ${chip("all", "All regions")}
      ${ids.map((id) => chip(id, AREAS_BY_ID[id].name)).join("")}
      ${extra ? chip(extra.id, extra.label) : ""}
    </div>`;
}

// Wires a chip row rendered by areaChipsHtml. Keeps the selected chip in view,
// since a scrolling row can otherwise hide which filter is on.
function wireAreaChips(surface, onChange) {
  const row = document.getElementById(`${surface}-area-chips`);
  if (!row) return;
  const sync = (id) => {
    row.querySelectorAll("[data-area]").forEach((b) => {
      const on = b.dataset.area === id;
      b.classList.toggle("filter-chip--selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
  };
  row.querySelectorAll("[data-area]").forEach((b) => {
    b.addEventListener("click", () => {
      sync(b.dataset.area);
      onChange(b.dataset.area);
    });
  });
  const on = row.querySelector('[aria-pressed="true"]');
  if (on && on.dataset.area !== "all" && row.scrollWidth > row.clientWidth) {
    row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - 16);
  }
}

function inArea(resort, areaId) {
  if (!areaId || areaId === "all") return true;
  const a = areaOfResort(resort);
  return !!a && a.id === areaId;
}
