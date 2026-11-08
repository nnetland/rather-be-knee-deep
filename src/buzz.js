// Buzz data — subreddit and official-site links. Plain data, no fetching.
//
// Source of truth with evidence for every row: research/resort-links.json.
// Rule for a resort subreddit: it exists, is public and has had posts this
// past year. If that couldn't be confirmed the value is null, and the resort
// is listed under "No subreddit of its own" rather than linked to a guess.
// A town subreddit stands in only where the town IS the ski destination and
// the mountain gets discussed there (kind: "town"); it is labelled as the town's.

const BUZZ_CHECKED = "November 2026";

function redditUrl(sub) { return `https://www.reddit.com/r/${encodeURIComponent(sub)}/`; }

// Regional subreddits, keyed by area (regions.js). An area with none listed
// has no regional ski subreddit that could be verified.
const BUZZ_REGION_SUBS = {
 "colorado": [
  {
   "sub": "COsnow",
   "blurb": "Colorado skiing and riding: conditions, traffic, trips"
  }
 ],
 "utah": [
  {
   "sub": "UTsnow",
   "blurb": "Utah skiing and riding, sorted by resort"
  }
 ],
 "california": [
  {
   "sub": "tahoe",
   "blurb": "Lake Tahoe: local news, visits and ski days"
  }
 ],
 "northeast": [
  {
   "sub": "icecoast",
   "blurb": "Skiing and riding in the East, Ohio to the Atlantic"
  }
 ]
};
const BUZZ_REGIONS = AREAS.map((a) => ({ ...a, subs: BUZZ_REGION_SUBS[a.id] || [] }));

const BUZZ_GENERAL = [
 {
  "sub": "skiing",
  "blurb": "The main ski community: resorts, trips, gear"
 },
 {
  "sub": "snowboarding",
  "blurb": "The main snowboard community"
 },
 {
  "sub": "Backcountry",
  "blurb": "Touring, avalanche safety and backcountry gear"
 },
 {
  "sub": "Skigear",
  "blurb": "Advice on skis, boots and bindings"
 },
 {
  "sub": "Ikonpass",
  "blurb": "Ikon Pass holders and resorts (unofficial)"
 },
 {
  "sub": "SkiBums",
  "blurb": "Ski-town seasons, jobs and housing"
 }
];

// kind: "resort" = the resort's own subreddit; "town" = the town's, used only
// where the town is the ski destination and the mountain is discussed there.
const RESORT_LINKS = {
 "vail-co": {
  "website": "https://www.vail.com/",
  "sub": "vail",
  "kind": "resort"
 },
 "beaver-creek-co": {
  "website": "https://www.beavercreek.com/",
  "sub": null,
  "kind": null
 },
 "breckenridge-co": {
  "website": "https://www.breckenridge.com/",
  "sub": "Breckenridge",
  "kind": "resort"
 },
 "keystone-co": {
  "website": "https://www.keystoneresort.com/",
  "sub": null,
  "kind": null
 },
 "aspen-snowmass-co": {
  "website": "https://www.aspensnowmass.com/",
  "sub": "Aspen",
  "kind": "town"
 },
 "steamboat-co": {
  "website": "https://www.steamboat.com/",
  "sub": "steamboat",
  "kind": "resort"
 },
 "telluride-co": {
  "website": "https://tellurideskiresort.com/",
  "sub": "TellurideColorado",
  "kind": "town"
 },
 "crested-butte-co": {
  "website": "https://www.skicb.com/",
  "sub": null,
  "kind": null
 },
 "winter-park-co": {
  "website": "https://www.winterparkresort.com/",
  "sub": null,
  "kind": null
 },
 "arapahoe-basin-co": {
  "website": "https://www.arapahoebasin.com/",
  "sub": null,
  "kind": null
 },
 "wolf-creek-co": {
  "website": "https://wolfcreekski.com/",
  "sub": null,
  "kind": null
 },
 "park-city-ut": {
  "website": "https://www.parkcitymountain.com/",
  "sub": "ParkCity",
  "kind": "town"
 },
 "deer-valley-ut": {
  "website": "https://www.deervalley.com/",
  "sub": "ParkCity",
  "kind": "town"
 },
 "alta-ut": {
  "website": "https://www.alta.com/",
  "sub": null,
  "kind": null
 },
 "snowbird-ut": {
  "website": "https://www.snowbird.com/",
  "sub": null,
  "kind": null
 },
 "solitude-ut": {
  "website": "https://www.solitudemountain.com/",
  "sub": null,
  "kind": null
 },
 "powder-mountain-ut": {
  "website": "https://powdermountain.com/",
  "sub": null,
  "kind": null
 },
 "snowbasin-ut": {
  "website": "https://www.snowbasin.com/",
  "sub": null,
  "kind": null
 },
 "jackson-hole-wy": {
  "website": "https://www.jacksonhole.com",
  "sub": "JacksonHole",
  "kind": "resort"
 },
 "grand-targhee-wy": {
  "website": "https://www.grandtarghee.com",
  "sub": null,
  "kind": null
 },
 "big-sky-mt": {
  "website": "https://www.bigskyresort.com",
  "sub": "bigsky",
  "kind": "resort"
 },
 "whitefish-mt": {
  "website": "https://skiwhitefish.com",
  "sub": null,
  "kind": null
 },
 "bridger-bowl-mt": {
  "website": "https://bridgerbowl.com",
  "sub": "bridgerbowl",
  "kind": "resort"
 },
 "sun-valley-id": {
  "website": "https://www.sunvalley.com",
  "sub": null,
  "kind": null
 },
 "schweitzer-id": {
  "website": "https://www.schweitzer.com",
  "sub": null,
  "kind": null
 },
 "taos-nm": {
  "website": "https://www.skitaos.com/",
  "sub": null,
  "kind": null
 },
 "palisades-tahoe-ca": {
  "website": "https://www.palisadestahoe.com",
  "sub": "palisadestahoe",
  "kind": "resort"
 },
 "heavenly-ca": {
  "website": "https://www.skiheavenly.com",
  "sub": null,
  "kind": null
 },
 "mammoth-mountain-ca": {
  "website": "https://www.mammothmountain.com",
  "sub": "Mammoth",
  "kind": "resort"
 },
 "kirkwood-ca": {
  "website": "https://www.kirkwood.com",
  "sub": null,
  "kind": null
 },
 "mt-bachelor-or": {
  "website": "https://www.mtbachelor.com",
  "sub": null,
  "kind": null
 },
 "timberline-or": {
  "website": "https://www.timberlinelodge.com",
  "sub": null,
  "kind": null
 },
 "crystal-mountain-wa": {
  "website": "https://www.crystalmountainresort.com",
  "sub": "CrystalMountain",
  "kind": "resort"
 },
 "stevens-pass-wa": {
  "website": "https://www.stevenspass.com",
  "sub": "stevenspass",
  "kind": "resort"
 },
 "mt-baker-wa": {
  "website": "https://www.mtbaker.us",
  "sub": null,
  "kind": null
 },
 "stowe-vt": {
  "website": "https://www.stowe.com/",
  "sub": "Stowe",
  "kind": "resort"
 },
 "killington-vt": {
  "website": "https://www.killington.com/",
  "sub": "Killington",
  "kind": "resort"
 },
 "sugarbush-vt": {
  "website": "https://www.sugarbush.com/",
  "sub": null,
  "kind": null
 },
 "jay-peak-vt": {
  "website": "https://jaypeakresort.com/",
  "sub": null,
  "kind": null
 },
 "stratton-vt": {
  "website": "https://www.stratton.com/",
  "sub": null,
  "kind": null
 },
 "okemo-vt": {
  "website": "https://www.okemo.com/",
  "sub": null,
  "kind": null
 },
 "sunday-river-me": {
  "website": "https://www.sundayriver.com/",
  "sub": null,
  "kind": null
 },
 "sugarloaf-me": {
  "website": "https://www.sugarloaf.com/",
  "sub": null,
  "kind": null
 },
 "loon-mountain-nh": {
  "website": "https://www.loonmtn.com/",
  "sub": null,
  "kind": null
 },
 "whistler-blackcomb-bc": {
  "website": "https://www.whistlerblackcomb.com/",
  "sub": "Whistler",
  "kind": "town"
 },
 "revelstoke-bc": {
  "website": "https://www.revelstokemountainresort.com/",
  "sub": "Revelstoke",
  "kind": "town"
 },
 "big-white-bc": {
  "website": "https://www.bigwhite.com/",
  "sub": null,
  "kind": null
 },
 "sun-peaks-bc": {
  "website": "https://www.sunpeaksresort.com/",
  "sub": null,
  "kind": null
 },
 "fernie-bc": {
  "website": "https://www.skifernie.com/",
  "sub": null,
  "kind": null
 },
 "lake-louise-ab": {
  "website": "https://www.skilouise.com/",
  "sub": "Banff",
  "kind": "town"
 },
 "banff-sunshine-ab": {
  "website": "https://www.skibanff.com/",
  "sub": "Banff",
  "kind": "town"
 },
 "kicking-horse-bc": {
  "website": "https://kickinghorseresort.com/",
  "sub": null,
  "kind": null
 },
 "panorama-bc": {
  "website": "https://www.panoramaresort.com/",
  "sub": null,
  "kind": null
 },
 "mont-tremblant-qc": {
  "website": "https://www.tremblant.ca/",
  "sub": "MontTremblant",
  "kind": "resort"
 },
 "alyeska-ak": {
  "website": "https://www.alyeskaresort.com",
  "sub": null,
  "kind": null
 },
 "lutsen-mn": {
  "website": "https://www.lutsen.com/",
  "sub": null,
  "kind": null
 },
 "giants-ridge-mn": {
  "website": "https://www.giantsridge.com/",
  "sub": null,
  "kind": null
 },
 "afton-alps-mn": {
  "website": "https://www.aftonalps.com/",
  "sub": null,
  "kind": null
 },
 "buck-hill-mn": {
  "website": "https://www.buckhill.com/",
  "sub": null,
  "kind": null
 },
 "welch-village-mn": {
  "website": "https://www.welchvillage.com/",
  "sub": null,
  "kind": null
 },
 "wild-mountain-mn": {
  "website": "https://www.wildmountain.com/",
  "sub": null,
  "kind": null
 },
 "andes-tower-hills-mn": {
  "website": "https://www.andestowerhills.com/",
  "sub": null,
  "kind": null
 },
 "mount-bohemia-mi": {
  "website": "https://www.mtbohemia.com/",
  "sub": null,
  "kind": null
 },
 "big-powderhorn-mi": {
  "website": "https://bigpowderhorn.net/",
  "sub": null,
  "kind": null
 },
 "whitecap-mountains-wi": {
  "website": "https://whitecapresort.com/",
  "sub": null,
  "kind": null
 },
 "powder-ridge-ct": {
  "website": "https://powderridgepark.com/",
  "sub": null,
  "kind": null
 },
 "red-lodge-mt": {
  "website": "https://www.redlodgemountain.com",
  "sub": null,
  "kind": null
 },
 "loveland-co": {
  "website": "https://skiloveland.com/",
  "sub": null,
  "kind": null
 },
 "indianhead-mi": {
  "website": "https://www.snowriver.com/",
  "sub": null,
  "kind": null
 },
 "blackjack-mi": {
  "website": "https://www.snowriver.com/",
  "sub": null,
  "kind": null
 },
 "copper-mountain-co": {
  "website": "https://www.coppercolorado.com/",
  "sub": null,
  "kind": null
 }
};


function buzzResortsIn(region) {
  return RESORTS.filter((r) => region.states.includes(r.state_province))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function buzzRegionOf(resort) {
  return BUZZ_REGIONS.find((r) => r.states.includes(resort.state_province)) || null;
}
function buzzAllSubs() {
  const set = new Set();
  BUZZ_REGIONS.forEach((r) => r.subs.forEach((s) => set.add(s.sub.toLowerCase())));
  BUZZ_GENERAL.forEach((s) => set.add(s.sub.toLowerCase()));
  Object.values(RESORT_LINKS).forEach((l) => { if (l.sub) set.add(l.sub.toLowerCase()); });
  return Array.from(set);
}
