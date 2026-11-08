// Buzz — a directory of subreddit links. Replaces the Rants & Raves feed
// (2026-11-07, Director's call).
//
// WHY A DIRECTORY. The feed needed a Reddit Data API pipeline that was never
// built, and Reddit now requires explicit approval for that kind of access.
// Plain links to public pages need no approval at all, so this surface reads
// nothing from Reddit, copies nothing and shows no strangers' words. Every
// claim the old feed had to defend (a third voice, takedowns, §230, deletion
// sync) goes away with the content.
//
// RULES THAT FOLLOW FROM THAT
//  · Links only. No counts, no "trending", no titles, no embeds: each of those
//    would be Reddit data and would bring the approval question back.
//  · No Reddit logo or alien. Subreddit names as text.
//  · A resort with no subreddit of its own is listed as such, by name, rather
//    than being linked to a guess. Its region's subreddit is right above it.
//
// Old #rants= links land here (see parseInitialRoute in app.js).

function renderBuzz(main) {
  const regions = BUZZ_REGIONS.filter((r) => buzzResortsIn(r).length || r.subs.length);
  const active = state.buzz.region;
  const shown = active === "all" ? regions : regions.filter((r) => r.id === active);
  const subCount = buzzAllSubs().length;

  main.innerHTML = `
    <div class="page-column buzz-view">
      <h1 class="display-h1">Buzz</h1>
      ${pageMetaHtml([`${subCount} subreddits`, "Where skiers talk on Reddit"])}
      <div class="chip-row chip-row--scroll" role="group" aria-label="Filter Buzz by region">
        ${["all", ...regions.map((r) => r.id), "general"].map((id) => {
          const label = id === "all" ? "All" : id === "general" ? "General" : regions.find((r) => r.id === id).name;
          const on = active === id;
          return `<button class="filter-chip ${on ? "filter-chip--selected" : ""}" data-buzz-region="${id}" type="button" aria-pressed="${on}">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
      ${active === "general" ? "" : shown.map(buzzRegionHtml).join("")}
      ${active === "all" || active === "general" ? buzzGeneralHtml() : ""}
      ${pageAboutHtml("About these links", `
        <p>Links only. The app doesn't read, copy or show anything from Reddit, and opening a link takes you to Reddit itself.</p>
        <p>Each subreddit is run by its own moderators. None of them are connected to this app, to the resorts, or to Nicole.</p>
        <p>A resort listed under "No subreddit of its own" gets talked about in its region's subreddit instead. Links checked ${escapeHtml(BUZZ_CHECKED)}.</p>`)}
    </div>`;

  main.querySelectorAll("[data-buzz-region]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.buzz.region = btn.dataset.buzzRegion;
      renderBuzz(main);
      const again = main.querySelector(`[data-buzz-region="${state.buzz.region}"]`);
      if (again) again.focus({ preventScroll: true });
    });
  });

  document.title = "Buzz — find your next ski trip";
  setOgMeta({ title: "Buzz", description: "Where skiers talk about each resort on Reddit, sorted by region." });
}

function renderBuzzRoute(main) {
  renderBuzz(main);
  focusHeading(main);
}

function buzzRegionHtml(region) {
  const resorts = buzzResortsIn(region);
  const withSub = resorts.filter((r) => RESORT_LINKS[r.id] && RESORT_LINKS[r.id].sub);
  const without = resorts.filter((r) => !(RESORT_LINKS[r.id] && RESORT_LINKS[r.id].sub));
  const hId = `buzz-h-${region.id}`;
  return `
    <section class="buzz-region" aria-labelledby="${hId}">
      <h2 class="display-h2" id="${hId}">${escapeHtml(region.name)}</h2>
      ${region.subs.length ? `
        <ul class="buzz-links" role="list">
          ${region.subs.map((s) => buzzLinkHtml(`r/${s.sub}`, s.blurb, s.sub)).join("")}
        </ul>` : ""}
      ${withSub.length ? `
        <h3 class="label buzz-subhead">Resorts</h3>
        <ul class="buzz-links" role="list">
          ${withSub.map((r) => buzzLinkHtml(r.name, buzzSubLabel(RESORT_LINKS[r.id]), RESORT_LINKS[r.id].sub)).join("")}
        </ul>` : ""}
      ${without.length ? `
        <p class="buzz-none body-sm"><span class="buzz-none__label">No subreddit of its own:</span> ${without.map((r) => escapeHtml(r.name)).join(", ")}.${
          region.subs.length ? "" : ` These come up in <a href="${redditUrl(BUZZ_GENERAL[0].sub)}" target="_blank" rel="noopener noreferrer">r/${escapeHtml(BUZZ_GENERAL[0].sub)}<span class="visually-hidden"> (opens Reddit in a new tab)</span></a>.`
        }</p>` : ""}
    </section>`;
}

function buzzGeneralHtml() {
  return `
    <section class="buzz-region" aria-labelledby="buzz-h-general">
      <h2 class="display-h2" id="buzz-h-general">General</h2>
      <ul class="buzz-links" role="list">
        ${BUZZ_GENERAL.map((s) => buzzLinkHtml(`r/${s.sub}`, s.blurb, s.sub)).join("")}
      </ul>
    </section>`;
}

// One full-width row per link: 48px minimum, the whole row is the target.
function buzzLinkHtml(title, support, sub) {
  return `
    <li>
      <a class="buzz-link" href="${redditUrl(sub)}" target="_blank" rel="noopener noreferrer">
        <span class="buzz-link__text">
          <span class="buzz-link__title">${escapeHtml(title)}</span>
          ${support ? `<span class="buzz-link__support body-sm">${escapeHtml(support)}</span>` : ""}
        </span>
        <span class="buzz-link__out" aria-hidden="true">${ICONS.external}</span>
        <span class="visually-hidden">(opens Reddit in a new tab)</span>
      </a>
    </li>`;
}

// --- Resort links on the result screen --------------------------------------
// The official site, then the resort's own subreddit — or, when it has none,
// its region's subreddit, labelled as the region's so it isn't mistaken for
// the resort's own, or r/skiing where the region has none.
function resortLinksHtml(resort) {
  const links = RESORT_LINKS[resort.id] || {};
  const rows = [];
  if (links.website) {
    rows.push(resortLinkRow("Official site", buzzHostOf(links.website), links.website, "opens the resort's website in a new tab"));
  }
  if (links.sub) {
    rows.push(resortLinkRow("On Reddit", buzzSubLabel(links), redditUrl(links.sub), "opens Reddit in a new tab"));
  } else {
    const region = buzzRegionOf(resort);
    const regional = region && region.subs[0];
    if (regional) {
      rows.push(resortLinkRow("On Reddit", `r/${regional.sub} · ${region.name} skiers`, redditUrl(regional.sub), "opens Reddit in a new tab"));
    } else if (BUZZ_GENERAL[0]) {
      rows.push(resortLinkRow("On Reddit", `r/${BUZZ_GENERAL[0].sub} · all skiers`, redditUrl(BUZZ_GENERAL[0].sub), "opens Reddit in a new tab"));
    }
  }
  if (!rows.length) return "";
  return `
    <h2 class="display-h3 reveal-hidden" style="margin-bottom:var(--space-3)">Links</h2>
    <ul class="buzz-links resort-links reveal-hidden" id="resort-links" role="list">${rows.join("")}</ul>`;
}

function resortLinkRow(label, text, href, srNote) {
  return `
    <li>
      <a class="buzz-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
        <span class="buzz-link__text">
          <span class="buzz-link__support body-sm">${escapeHtml(label)}</span>
          <span class="buzz-link__title">${escapeHtml(text)}</span>
        </span>
        <span class="buzz-link__out" aria-hidden="true">${ICONS.external}</span>
        <span class="visually-hidden">(${escapeHtml(srNote)})</span>
      </a>
    </li>`;
}

// "r/Stowe", or "r/Aspen · the town's" when a town subreddit stands in.
function buzzSubLabel(links) {
  return links.kind === "town" ? `r/${links.sub} · the town's` : `r/${links.sub}`;
}

function buzzHostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return url; }
}
