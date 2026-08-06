# Rather Be Knee Deep

A ski trip recommender. Answer five questions and get one resort, with the numbers behind the pick and Nicole's take on it if she's been there. Also chases live snow forecasts, tells you which skis to bring on a given day, and lists everywhere she's actually skied.

No accounts, no paywall, no tracking. The whole app is one self-contained HTML file that works offline.

---

# Setting this up — start here

You need two free accounts. Neither requires a credit card. Budget about 25 minutes for the whole thing, most of it waiting for pages to load.

## Step 1 — GitHub account (5 min)

GitHub stores the code and runs the automatic deploys.

1. Go to **https://github.com/signup**
2. Enter your email, pick a password, pick a username (this becomes part of your URL, so something like `nicolenetland` is good)
3. Verify the email they send you
4. Choose the **Free** plan when offered

Turn on two-factor authentication when it prompts you. GitHub requires it for all accounts now, and it's worth doing properly rather than putting off.

## Step 2 — Google / Firebase account (5 min)

Firebase Hosting is Google Cloud's static site product. A Firebase project *is* a Google Cloud project — same console, same billing, same permissions — it's just a friendlier front door for this kind of site.

1. Go to **https://console.firebase.google.com**
2. Sign in with your existing Google account (`nicolenetland@gmail.com` is fine)
3. Click **Create a project**
4. Name it `rather-be-knee-deep`. Firebase will generate a project ID like `rather-be-knee-deep-a1b2c` — **write that ID down**, you need it twice later
5. Turn **off** Google Analytics unless you want it. It's not needed and it adds a consent step
6. Once the project exists, go to **Build → Hosting** in the left sidebar and click **Get started**

Stay on the **Spark** plan. It's free, requires no payment method, and gives you 10 GB of storage and 360 MB of transfer per day. This app is about 440 KB, so that's roughly 800 visits a day before you'd hit the ceiling — far more than a link you text to friends will ever use. Firebase will *not* silently start charging you; exceeding Spark limits pauses the site until the next day rather than billing you.

## Step 3 — Put the code on GitHub (5 min)

**If you have Git installed** (open Terminal and type `git --version` to check):

```bash
cd path/to/this/folder
git init
git add .
git commit -m "Rather Be Knee Deep"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rather-be-knee-deep.git
git push -u origin main
```

Create the empty repository at **https://github.com/new** first — name it `rather-be-knee-deep`, leave everything else at defaults, and do *not* add a README (this folder already has one).

**If you don't have Git**, use the web uploader instead:

1. Go to **https://github.com/new**, name it `rather-be-knee-deep`, click **Create repository**
2. On the next page click **uploading an existing file**
3. Drag everything in this folder into the browser
4. Click **Commit changes**

## Step 4 — Connect the two (10 min)

This is the only fiddly part. You're giving GitHub permission to deploy to your Firebase project.

**Install the Firebase CLI** (needs Node.js from https://nodejs.org first):

```bash
npm install -g firebase-tools
firebase login
```

**Then, from inside this folder:**

```bash
firebase init hosting:github
```

It will ask a few questions. Answer them like this:

- *Which Firebase project?* → the one you made in Step 2
- *What's your public directory?* → `public`
- *For which GitHub repository?* → `YOUR-USERNAME/rather-be-knee-deep`
- *Set up a workflow to deploy on merge?* → **Yes**
- *What script should be run before deploy?* → `python build.py`
- *Which branch?* → `main`
- *Overwrite the existing workflow file?* → **No** (this folder already has a good one)

That command creates the `FIREBASE_SERVICE_ACCOUNT` secret in your GitHub repo automatically, which is the tricky bit done for you.

**One manual step it doesn't do.** In your GitHub repo go to **Settings → Secrets and variables → Actions → Variables tab → New repository variable**:

- Name: `FIREBASE_PROJECT_ID`
- Value: your project ID from Step 2

**Also update `.firebaserc`** in this folder — replace `REPLACE-WITH-YOUR-FIREBASE-PROJECT-ID` with the same ID, then commit and push.

## Step 5 — Deploy

Push anything to `main` and it deploys automatically. Or deploy by hand right now:

```bash
python build.py
firebase deploy --only hosting
```

Your site will be at `https://YOUR-PROJECT-ID.web.app`.

## Step 6 — Put it on your phone

Open the URL in Safari, tap the Share button, choose **Add to Home Screen**. You'll get the mountain icon and it opens full-screen without browser chrome.

---

## Once it's live, check one thing

Open **Chase the snow**.

- If you see real forecast inches → the live NOAA weather connection works and everything is finished.
- If every US resort says *"typical season, not this week"* → the browser is blocking the weather API and it needs a small proxy. Tell Claude which one you see.

This is the one thing that couldn't be tested before hosting.

---

## A custom domain, if you want one

Buy a domain anywhere (Namecheap, Cloudflare, Google Domains successor Squarespace Domains). Then in Firebase: **Hosting → Add custom domain**, follow the DNS instructions. Firebase provisions and renews the SSL certificate free, automatically. Takes a few hours to go live.

---

# How the project works

## Layout

```
src/                    the actual source — edit here
  shell.html            page skeleton with placeholder tokens
  styles.css            design tokens and all styling
  data.js               71 resorts + Nicole's list, inlined
  engine.js             matching logic for both modes
  badges.js             52-motif SVG badge system
  quiver.js             Quiver Check's recommendation model (pure, no DOM)
  demo.js               TEMPORARY — invented off-season snow (see below)
  app.js                trip planner
  app-chase.js          snow chaser
  app-quiver.js         Quiver Check
  app-nicoles.js        Nicole's list
  icons.js              interface icons
  noaa.js               weather API client with historical fallback

public/                 what actually gets deployed — generated, don't edit index.html
research/               the source datasets and provenance
verify_*.js             the test suite
assemble.py             stitches src/ into one HTML file
build.py                runs assemble, adds hosting tags, writes public/index.html
```

**Edit `src/`, never `public/index.html`** — it gets overwritten on every build.

## Building

```bash
python build.py
```

## Testing

```bash
npm install -g playwright   # once
node test.js                    # console errors
node verify_engine.js           # 5,184 matching combinations
node verify_a11y.js             # accessibility assertions
node verify_zoom_overlap.js     # 200% zoom text overlap
node verify_badge_system.js     # badge determinism and region dedupe
node verify_reason_anchor_sweep.js
node verify_quiver.js           # 64k assertions over the ski-type model
node verify_quiver_visual.js    # walks Quiver Check against a synthetic January storm
node verify_demo.js             # the invented-season dataset and its guarantees
```

`verify_quiver_visual.js` freezes the clock to mid-January and serves a fake
NOAA response, because Quiver Check correctly refuses to render anything but
its off-season screen from May to November — which is the right product
behaviour and impossible review conditions. Its screenshots land in
`screenshots-quiver/`.

All of them should pass before you deploy anything.

## Adding your hot takes

They live in `research/nicoles-list.json`, keyed to resorts by `resort_id`. Add a `nicoles_take` string to any entry and rebuild. Resorts without one render no take block at all — that's deliberate, since a fabricated take would undermine the whole point.

Nine of 47 are written so far.

## Demo snow — temporary, and self-removing

From roughly May to November nothing is open, NOAA has nothing to forecast, and
Chase the Snow and Quiver Check both correctly render an off-season screen —
which makes them impossible to work on for half the year. `src/demo.js`
generates an invented season to fill that window.

It activates **only** when the real calendar says the season is over, and turns
itself off around mid-November with no action from anyone. It never displaces a
live forecast or the honest typical-season fallback. Everything it produces is
labelled: a banner on every screen, a badge on every card, and an explicit
caveat on every ski recommendation.

The data is invented but not arbitrary — each resort's season is scaled to its
own published annual snowfall, bounded by its own open/close dates, and given
its region's real snow character, so a Baker week still behaves like Baker.

To remove it: delete `src/demo.js` and its two tokens from `assemble.py`, or set
`DEMO_ENABLED = false` at the top of that file. Every call site is guarded.

## Data honesty rules

These are load-bearing, not stylistic:

- Historical snowfall averages are **never** presented as live forecasts
- Canada has no NOAA coverage, so those 11 resorts sit in a separate labelled tier
- Missing data says "not published" rather than being estimated
- Editorial judgments (cost tier, crowd level, vibe) are marked as judgment, not fact
- Nicole's takes carry no ranking weight — commentary only
