// Sticker Check — per-badge content (2026-11-23).
//
// d:   difficulty. 1 = most skiers get it, 2 = needs some resort knowledge,
//      3 = deep cut.
// alt: what a screen reader hears during a question. Describes the drawing and
//      never names the resort, so blind and sighted players get the same clues.
// why: the one-line reveal after a guess. Factual claims were checked against
//      the resort data in data.js; the review notes are in the project doc
//      "Badge game - content for all 71".
//
// Powder Ridge is left out on purpose: its skunk gag doesn't point at the
// place, so a guess would be a coin toss. Every other badge plays.
const GAME_CONTENT = {
 "vail-co": {
  "d": 1,
  "alt": "A poodle in a red puffer jacket dropping into a wide-open bowl, powder spraying off both skis.",
  "why": "A poodle for Vail's polish, a wide-open bowl for the Back Bowls. The après crowd dresses the part."
 },
 "beaver-creek-co": {
  "d": 2,
  "alt": "A large flat-tailed rodent in a ski jacket, riding an escalator up while balancing a tray of cookies.",
  "why": "A beaver for the name, and a tray of cookies for the free ones handed out at the base."
 },
 "breckenridge-co": {
  "d": 1,
  "alt": "A retriever in a backwards cap, mid-cheers, with a pint sloshing over the rim.",
  "why": "Golden retriever for the gold-rush town, a sloshing pint for Main Street. A party with skiing attached."
 },
 "keystone-co": {
  "d": 2,
  "alt": "A river otter in rainbow dungarees hauling a wagon piled with children's skis, leaning into the pull.",
  "why": "Keystone is the family pick, so the otter is on kids' gear duty, wagon and all."
 },
 "aspen-snowmass-co": {
  "d": 1,
  "alt": "A bear in a fur-collared parka, mid-turn, with a cub riding on its shoulders.",
  "why": "Fur collar for Aspen's glamour, cub for Snowmass's family terrain. Four mountains, one well-dressed bear."
 },
 "steamboat-co": {
  "d": 1,
  "alt": "A horse in a cowboy hat and bandana bursting through a spray of light powder, mid-turn.",
  "why": "Cowboy hat and light, dry powder: Steamboat trademarked Champagne Powder and calls itself Ski Town USA."
 },
 "telluride-co": {
  "d": 2,
  "alt": "A mountain goat in a fur-trimmed coat stepping off a gondola mid-stride, one hoof raised.",
  "why": "A mountain goat stepping off the free gondola that links town to mountain. Telluride is steep, remote and a little fancy."
 },
 "crested-butte-co": {
  "d": 3,
  "alt": "A spotted wildcat with a short tail, in a tie-dye shirt, mid-air off a cliff and completely relaxed.",
  "why": "Tie-dye for the town's offbeat mood, a cliff drop for its steep terrain, and no worries about either."
 },
 "winter-park-co": {
  "d": 1,
  "alt": "A moose in a conductor's cap, leaning out and waving a rail ticket.",
  "why": "A train runs from Denver right to the base, so the moose is calling all aboard."
 },
 "arapahoe-basin-co": {
  "d": 2,
  "alt": "A marmot in sunglasses sitting on a pickup tailgate, raising a beer can in a cheers.",
  "why": "Tailgate beers in the lot are an A-Basin ritual, and the sunglasses are for its long spring season."
 },
 "wolf-creek-co": {
  "d": 2,
  "alt": "A wild dog in a vintage wool sweater shoveling out a half-buried chairlift seat, snow flying.",
  "why": "A wolf for the name, a buried chair for Wolf Creek's famous snowfall."
 },
 "park-city-ut": {
  "d": 1,
  "alt": "A fox in sunglasses striding off an airplane, skis on one shoulder, a boarding pass in its teeth.",
  "why": "Fly in, ski out: Park City is a short drive from Salt Lake City's airport."
 },
 "deer-valley-ut": {
  "d": 1,
  "alt": "A swan in a white turtleneck and pearls, holding skis and a champagne glass.",
  "why": "Pearls and champagne for Deer Valley's polished, white-glove reputation. The formal one of the bunch."
 },
 "alta-ut": {
  "d": 3,
  "alt": "An owl in a neon 1980s one-piece bursting out of chest-deep powder, both skis clear of the snow.",
  "why": "Alta's snow is famously deep and its crowd loyally old-school, so the owl wears a 1980s one-piece."
 },
 "snowbird-ut": {
  "d": 1,
  "alt": "A snow leopard hanging by one arm from a thick cable, swinging.",
  "why": "The tram's cable is Snowbird's icon, and the leopard is swinging from it. Steep terrain waits below."
 },
 "solitude-ut": {
  "d": 2,
  "alt": "A porcupine in a cream cable-knit sweater, mid-turn through untouched powder.",
  "why": "The name means being alone, so the porcupine has the whole slope to itself."
 },
 "powder-mountain-ut": {
  "d": 3,
  "alt": "A small round-eared mammal in a vintage anorak, arms flung wide across an enormous empty slope.",
  "why": "Arms wide over an empty slope: Powder Mountain limits daily lift tickets, so the hill feels like yours."
 },
 "snowbasin-ut": {
  "d": 3,
  "alt": "A coyote in a downhill race suit, tucked in a racing crouch, a crystal chandelier under one arm.",
  "why": "Race suit for Snowbasin's 2002 Olympic downhill, chandelier for its grand lodges."
 },
 "jackson-hole-wy": {
  "d": 1,
  "alt": "A stag in a tan trench coat dropping into a narrow chute, antlers tipped back, a lift ticket flapping.",
  "why": "A steep, narrow chute is Jackson's signature, and Corbet's Couloir is the famous one. The trench coat is just attitude."
 },
 "grand-targhee-wy": {
  "d": 2,
  "alt": "A grouse-like bird in goggles riding an empty chairlift, both wings thrown up in a cheer.",
  "why": "An empty chair and a powder whoop: Grand Targhee is known for heavy snowfall and short lift lines."
 },
 "big-sky-mt": {
  "d": 2,
  "alt": "A bison in a canvas work jacket leaning into a gale, hat gone, scarf streaming sideways.",
  "why": "Wide-open and windy: Big Sky's exposed terrain gets gusts, and the bison is a Montana regular."
 },
 "whitefish-mt": {
  "d": 1,
  "alt": "A big-eyed freshwater fish in a knit toque, coated in frost, catching a snowflake on its tongue.",
  "why": "A fish named for the mountain, coated in rime frost like the \"snow ghost\" trees Whitefish is known for."
 },
 "bridger-bowl-mt": {
  "d": 3,
  "alt": "A lynx in a worn patrol vest climbing a bootpack, skis on shoulder, a beacon strapped to its chest.",
  "why": "A beacon and a bootpack: Bridger's Ridge terrain needs both. The patrol vest fits this community-owned hill."
 },
 "sun-valley-id": {
  "d": 1,
  "alt": "A long-haired hound in a camel coat, sliding old-Hollywood sunglasses down its snout.",
  "why": "Old Hollywood glamour: Sun Valley was built in the 1930s to attract film stars."
 },
 "schweitzer-id": {
  "d": 3,
  "alt": "A fish-hawk bird in a hand-knit sweater, lowering binoculars with a satisfied look, skis tucked under one wing.",
  "why": "Binoculars for the view. Schweitzer looks over Lake Pend Oreille, so the osprey is checking its work."
 },
 "taos-nm": {
  "d": 2,
  "alt": "A roadrunner in a bandana and hiking pack, sprinting uphill with skis on its back.",
  "why": "A desert bird hiking uphill with skis: Taos Ski Valley is steep, high and full of hike-to terrain."
 },
 "red-lodge-mt": {
  "d": 3,
  "alt": "A magpie in buffalo plaid and goggles, mid-turn on an empty run, glancing back over its shoulder.",
  "why": "Nothing behind it: Red Lodge is a quiet Montana hill, so the magpie checks for company."
 },
 "loveland-co": {
  "d": 2,
  "alt": "A husky in a frayed scarf, shoving a trail marker into the snow, mid-push.",
  "why": "The marker is the Continental Divide, which runs right over Loveland Pass above the ski area."
 },
 "copper-mountain-co": {
  "d": 3,
  "alt": "A slim antelope-like animal in a race suit, tucked low, a stopwatch swinging from its neck.",
  "why": "A racer's tuck and a stopwatch: Copper trains speed skiers, and the pronghorn is North America's fastest land animal."
 },
 "palisades-tahoe-ca": {
  "d": 1,
  "alt": "An eagle in a striped beanie climbing a rocky ridge, skis on back, an old medal around its neck.",
  "why": "The medal is from the 1960 Winter Olympics, held here when it was Squaw Valley. The ridge is the steep terrain."
 },
 "heavenly-ca": {
  "d": 1,
  "alt": "A bright blue crested bird in a sequined vest stepping off a gondola, fanning a hand of poker chips.",
  "why": "A gondola rises from the Lake Tahoe town, with Nevada's casinos next door. The jay is a Sierra local."
 },
 "mammoth-mountain-ca": {
  "d": 1,
  "alt": "A shaggy tusked animal in a retro shell, skiing through slush in sunglasses, holding a drink in its trunk.",
  "why": "A mammoth for the name, slush and a cold drink for its long season that stretches into summer."
 },
 "kirkwood-ca": {
  "d": 3,
  "alt": "A small forest weasel in goggles and a snorkel, diving headfirst into deep snow.",
  "why": "The snorkel is for Kirkwood's snow, the deepest in the Tahoe area."
 },
 "mt-bachelor-or": {
  "d": 3,
  "alt": "A chipmunk in a windbreaker blown almost sideways, clinging to a rope with both paws, grinning.",
  "why": "A lone volcano has little to block the wind, so the chipmunk hangs on. Bachelor is famously gusty."
 },
 "timberline-or": {
  "d": 2,
  "alt": "A large rodent with a flat tail, in swim shorts and sunglasses, carving a summer turn with slush spraying.",
  "why": "Swim shorts and slush: Timberline, on Mount Hood, offers summer skiing. The beaver is Oregon's state animal."
 },
 "crystal-mountain-wa": {
  "d": 2,
  "alt": "A shaggy ape-like creature in an orange parka carving a turn, spray flying, a hot drink in one hand.",
  "why": "Sasquatch is Pacific Northwest legend, and the hot drink is for Crystal's cold, deep Cascades snow."
 },
 "stevens-pass-wa": {
  "d": 2,
  "alt": "A raccoon in a hi-vis vest and headlamp, mid-turn under bright night lights, eyes shining.",
  "why": "A raccoon is a night creature, and Stevens Pass is known for night skiing under lights."
 },
 "mt-baker-wa": {
  "d": 2,
  "alt": "A crow in a knit hat riding a snowboard through a deep banked turn, knee-deep, spray overhead.",
  "why": "Baker hosts the Legendary Banked Slalom and set a world record for snowfall in a season."
 },
 "stowe-vt": {
  "d": 1,
  "alt": "A mink in a tweed blazer and silk scarf, dropping into a steep narrow chute, entirely unbothered.",
  "why": "Tweed and silk for Vermont's classic ski town, a steep chute for the Front Four trails."
 },
 "killington-vt": {
  "d": 1,
  "alt": "A tusked wild pig in a hockey jersey, launching off a mogul.",
  "why": "Bumps and a loud crowd: Killington's nickname is the Beast of the East, and the boar fits."
 },
 "sugarbush-vt": {
  "d": 2,
  "alt": "A groundhog in worn plaid flannel, ducking into a tight line of trees, a bucket swinging from one paw.",
  "why": "The sap bucket is the sugar, the tight trees are the bush. Known for woods skiing and maple country."
 },
 "jay-peak-vt": {
  "d": 2,
  "alt": "A snowshoe hare buried to its ears in powder, goggles fogged, grinning.",
  "why": "Jay Peak is a Vermont snow magnet, and the hare is the one who looks happiest about it."
 },
 "stratton-vt": {
  "d": 1,
  "alt": "A big fluffy mountain dog in a vintage 1980s one-piece, riding an old-school snowboard, one mitten thrown up.",
  "why": "Stratton is called the birthplace of competitive snowboarding, so the dog rides old-school."
 },
 "okemo-vt": {
  "d": 3,
  "alt": "A mother duck in a ski-school vest leading a line of ducklings on tiny skis.",
  "why": "A duck leading ducklings: Okemo is a family mountain, known for lessons and friendly slopes."
 },
 "sunday-river-me": {
  "d": 3,
  "alt": "A puffin braced to fire a snow gun, a blast of snow shooting out.",
  "why": "Snow guns are Sunday River's trademark and puffins are Maine seabirds. Big blasts keep the trails open."
 },
 "sugarloaf-me": {
  "d": 2,
  "alt": "A lobster in a striped scarf picking across bare, wind-scoured snow above the trees, claws out for balance.",
  "why": "Lobster for Maine, bare snow above the trees for Sugarloaf, a rare lift-served spot in the East."
 },
 "loon-mountain-nh": {
  "d": 1,
  "alt": "A diving bird in a commuter's scarf, clutching a takeaway coffee, skis over one shoulder, hurrying as if late.",
  "why": "A loon for the name, and a commuter's rush for first chair. An easy weekend drive from Boston."
 },
 "whistler-blackcomb-bc": {
  "d": 1,
  "alt": "A bear in a bright shell wrestling with an enormous trail map spilling open in the wind.",
  "why": "So much terrain the map is a fight, and the bear nods to the Blackcomb half of the name."
 },
 "revelstoke-bc": {
  "d": 1,
  "alt": "A caribou in a puffy jacket, unrolling a very long tape measure down a slope.",
  "why": "The tape measure is the vertical drop: Revelstoke claims the most vertical in North America."
 },
 "big-white-bc": {
  "d": 3,
  "alt": "A rescue dog in a bathrobe and slippers, skis already on, stepping straight out of a front door.",
  "why": "Ski-in, ski-out: Big White's village lets you step from your door to the snow, bathrobe optional."
 },
 "sun-peaks-bc": {
  "d": 3,
  "alt": "A tiny chickadee in a pom-pom toque, carving one big unhurried turn with both wings out.",
  "why": "One long, easy turn on a wide-open slope. Sun Peaks is sunny and spacious, and the chickadee has room to spare."
 },
 "fernie-bc": {
  "d": 2,
  "alt": "A bighorn sheep in a worn canvas jacket, surfacing out of chest-deep powder, horns dusted with snow.",
  "why": "Fernie is known for heavy snowfall, so the sheep wades out of chest-deep powder."
 },
 "lake-louise-ab": {
  "d": 2,
  "alt": "An elk in a park ranger hat, snapping a photo with a vintage camera.",
  "why": "A ranger with a camera: Lake Louise sits inside Banff National Park, where the view is the point."
 },
 "banff-sunshine-ab": {
  "d": 2,
  "alt": "A wolverine in a parka standing astride a line drawn in the snow, one boot on each side, grinning.",
  "why": "The Continental Divide and the Alberta-British Columbia border both run through Sunshine, so the wolverine is in two places."
 },
 "kicking-horse-bc": {
  "d": 1,
  "alt": "A hoofed animal in goggles bucking mid-air off a steep drop, both back legs thrown out.",
  "why": "A horse kicking its heels off a steep drop is the name, and steep, rugged terrain is the resort's reputation."
 },
 "panorama-bc": {
  "d": 3,
  "alt": "A mountain lion in goggles lounging in a steaming hot tub, one paw waving.",
  "why": "The hot tub is the hint: Panorama's village has a big slopeside hot-pool complex."
 },
 "mont-tremblant-qc": {
  "d": 1,
  "alt": "A goose in a beret and striped scarf, raising a café au lait, skis tucked under one wing.",
  "why": "Beret and café au lait: Tremblant's village has a French Quebec feel, and the goose is the Canadian touch."
 },
 "alyeska-ak": {
  "d": 1,
  "alt": "A moose in a climbing harness, swinging an avalanche beacon out ahead of it, mid-stride up a ridge.",
  "why": "Moose and a beacon say Alaska: Alyeska has steep terrain with real avalanche country beside it."
 },
 "lutsen-mn": {
  "d": 2,
  "alt": "A glassy-eyed freshwater fish in a plaid toque, riding a gondola cabin with its fins pressed to the window.",
  "why": "Walleye is Minnesota's state fish, and Lutsen's gondola climbs above Lake Superior. The fish is there for the view."
 },
 "giants-ridge-mn": {
  "d": 3,
  "alt": "An ox in buffalo plaid, mid-stride, skis over one shoulder and a pickaxe in the other hand.",
  "why": "Paul Bunyan's ox and a pickaxe: Giants Ridge sits in Minnesota's mining-country Iron Range."
 },
 "afton-alps-mn": {
  "d": 3,
  "alt": "A badger in a red plaid shirt and a headlamp, mid-turn in the dark, breath steaming.",
  "why": "A headlamp and a night run: Afton is the Twin Cities' after-work hill, and the badger tags along."
 },
 "buck-hill-mn": {
  "d": 2,
  "alt": "An antlered animal in a racing bib numbered eight, slamming through a slalom gate, the flag snapping back.",
  "why": "A buck in a racing bib: a tiny Twin Cities hill with an outsized name for training ski racers."
 },
 "welch-village-mn": {
  "d": 3,
  "alt": "A gopher in a varsity jacket, mid-air off a very small jump, looking far too triumphant.",
  "why": "The gopher is Minnesota's mascot and Welch is a small, friendly hill. Big triumph, small jump."
 },
 "wild-mountain-mn": {
  "d": 3,
  "alt": "A painted turtle in a life jacket over a ski jacket, riding a magic-carpet lift with both arms up.",
  "why": "A turtle on a magic carpet: Wild Mountain is a family hill beside the St. Croix River."
 },
 "andes-tower-hills-mn": {
  "d": 2,
  "alt": "A llama in an oversized helmet, braced at the top of a tiny but very steep pitch.",
  "why": "A llama for the Andes in the name, a tiny steep pitch for a hill that is short but sharp."
 },
 "mount-bohemia-mi": {
  "d": 2,
  "alt": "A bearded lumberjack in a Viking helmet, dropping off a cliff with skis crossed.",
  "why": "Bohemia is the Midwest's wild side: steep terrain in the Keweenaw and huge lake-effect snow."
 },
 "big-powderhorn-mi": {
  "d": 3,
  "alt": "A squirrel in a flannel shirt, biting into a hot pasty.",
  "why": "Pasties are an Upper Peninsula staple, and Big Powderhorn is a Michigan UP hill."
 },
 "whitecap-mountains-wi": {
  "d": 2,
  "alt": "A long, toothy freshwater fish in a cheese-wedge hat, riding a snowboard.",
  "why": "A cheese hat for Wisconsin and a muskie for its northern lakes. Whitecap is the state's snowy northern hill."
 },
 "indianhead-mi": {
  "d": 3,
  "alt": "A fisher, a dark weasel-like animal, in a flannel shirt and toque, weaving through tight birch trees, tail streaming.",
  "why": "Tight trees and a northwoods animal: Indianhead is an Upper Peninsula hill with tree-lined runs."
 },
 "blackjack-mi": {
  "d": 2,
  "alt": "A long-eared hare in a card dealer's visor, dealing a card off a deep powder stash, snow flying.",
  "why": "A card dealer is the name, Blackjack, and the deep stash is the table. The jackrabbit completes the pun."
 }
};
