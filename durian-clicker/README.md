# Durian Clicker

An Isle Delfino incremental game. Click the durian, hire the island, drown in fruit.

Vibecoded brainrot slop.

Vanilla JavaScript, no build step, no dependencies. Every image and sound in here is a
placeholder meant to be thrown away — swapping in your own artwork never requires
touching game code.

---

## Deploying an update

Run the helper, then push everything:

```
python3 bump_build.py                     # or: bump_build.py 2026-09-01-hotfix "notes"
```

It sets one build id in the three places that must agree:

1. `CONFIG.buildId` in `js/config.js` — what the running page thinks it is
2. `version.json` — what the server advertises
3. `?v=<build>` on every local `<script>` and `<link>` in `index.html`

**Point 3 is what actually beats the cache.** GitHub Pages serves JS and CSS
with a long cache lifetime, so a plain refresh could keep running yesterday's
code — which is why players used to need Ctrl+Shift+R. Changing the query
string changes the URL, so the browser must fetch the new file. `index.html`
itself is served with a short lifetime and comes through on its own.

Players already in a session poll `version.json` every 5 minutes and whenever
they refocus the tab. What happens next is decided **per deploy**:

- **Routine deploy** (the default): a banner appears with an **Update now**
  button. Nobody is interrupted; they refresh when they feel like it.
- **Forced deploy** (`--force`): the game saves, counts down from 10 and
  reloads itself. Use this when everyone genuinely has to be on the new code —
  a save-format change, or a broken build. They can still dismiss it.

The switch is `"force": true` in `version.json`, so you decide at deploy time
without touching any JavaScript. `CONFIG.updateCheck.allowAutoReload = false`
is a master override that blocks forcing entirely.

A session-storage guard stops reload loops: if a reload does not produce the
new build (a stale CDN edge, say), the game stops trying and shows the manual
Ctrl+Shift+R instructions instead.

`CONFIG.updateCheck.countdownSeconds` sets how long the countdown runs.

**Upload every file, not a subset.** The JS modules reference each other. A
missing optional module now hides its own feature and the game plays on, and a
missing required module shows a panel naming the file — but a full upload is
still the only supported deploy.

## Running it

**Locally:** double-click `index.html`. That's it. The scripts are plain
`<script>` tags rather than ES modules specifically so `file://` works — no local
server needed to test.

**On GitHub Pages:** drop the `durian-clicker/` folder into the root of your
`zeldocto.github.io` repo and push. It'll be live at:

```
https://zeldocto.github.io/durian-clicker/
```

To host it at the root of the site instead, move the *contents* of this folder
(not the folder itself) into the repo root. No Jekyll config needed — no filenames
start with an underscore.

---

## Where everything lives

```
durian-clicker/
├── index.html          markup only — no game logic
├── css/style.css       all styling and animation
├── js/
│   ├── config.js       balance numbers, asset paths, workers, settings
│   ├── content/        ← game content, split out in Update 2
│   │   ├── upgrades.js     217 upgrades
│   │   ├── achievements.js 72 achievements
│   │   └── events.js       random island events
│   ├── events.js       the random-event engine, buffs and timers
│   ├── updates.js      polls version.json and prompts a refresh on deploy
│   ├── numbers.js      big-number type + display formatting
│   ├── game.js         state, production maths, tick loop, event bus
│   ├── workers.js      cost scaling and purchasing
│   ├── upgrades.js     upgrade purchasing
│   ├── achievements.js achievement read helpers
│   ├── save.js         localStorage, autosave, export/import
│   ├── offline.js      "while you were away" earnings
│   ├── audio.js        sound manager, volume, mute
│   ├── leaderboard.js  online scores — pluggable backend providers
│   ├── ui.js           every DOM read/write in the game
│   ├── debug.js        developer panel (Ctrl + `)
│   └── main.js         boot sequence
├── assets/             placeholder art and audio
└── leaderboard-setup.sql   run this once in Supabase to create the board
```

Nothing outside `ui.js` touches the DOM. Nothing outside `config.js` defines content.

---

## Backgrounds

Purchasable views for the island, in the Backgrounds half of the Tanooki Store.
Six ship as placeholders; edit **`js/content/backgrounds.js`** to change them.

Each entry needs `id`, `name`, `description`, `cost`, `image` and `tier`. The
`id` is the save key — **never rename one after release**, or everyone who
bought it loses it. `default` must stay first and free.

To use your own art, drop the file in `assets/` and point `image` at it. Any
wide image works; the placeholders are 960x540 and the scene is drawn with
`background-size: cover`, so keep anything important away from the edges.

Adding another is just an entry in the array — no code changes.

A background can be **earned** instead of bought: set `cost: null` and add
`reward: true`, a `requires` condition and a `requirementText`. Endgame works
this way, unlocking after seven days of play. Earned backgrounds cannot be
bought at any price; `Store.checkBackgroundRewards()` grants them from
`Game.checkProgress`, and the store shows the requirement where the price
would be.

Backgrounds and skins are stored separately and equip independently.
Backgrounds removed from the catalogue are dropped from saves on load, falling
back to `default`, so retiring one is safe.

## Replacing the placeholder art

Two options, both one-step:

**Keep the filenames.** Drop your `placeholder-pianta.png` over the existing one.
Done — no code changes at all.

**Use your own filenames.** Change the one string in `js/config.js`:

```js
{ id: 'pianta', name: 'Pianta', image: 'assets/pianta.png', ... }
```

Shared images (the durian, background, shine, default upgrade icon) live together at
the top of the config:

```js
assets: {
  durian:         'assets/placeholder-durian.png',
  background:     'assets/placeholder-background.png',
  shine:          'assets/placeholder-shine.png',
  upgradeDefault: 'assets/placeholder-upgrade.png'
}
```

The durian renders at up to 360px wide, so give it around 512px square with
transparency. Character icons render at 54px — 192px square is plenty.

Sounds work the same way via `CONFIG.sounds`. Any format the browser plays is fine
(`.wav`, `.mp3`, `.ogg`). If a sound file is missing or fails to decode, the game
synthesises a short blip instead rather than going silent.

---

## Adding content

### A new worker

One entry in `CONFIG.workers`. Nothing else:

```js
{
  id: 'petey',                          // never rename after release — it's the save key
  name: 'Petey Piranha',
  plural: 'Peteys',
  description: 'Eats the durians. Produces more durians. Net positive, somehow.',
  flavor: 'Shown in the unlock toast.',
  baseCost: 20000000,
  baseProduction: 44000,
  costMultiplier: 1.15,
  image: 'assets/placeholder-shadowmario.png',
  unlock: { type: 'totalEarned', amount: 40000000 }
}
```

The shop row, cost curve, stats line, unlock teaser and save handling all appear
automatically.

### A new upgrade

Upgrades live in `js/content/upgrades.js` now — there are 166 of them, and
`config.js` was getting unreadable.

```js
{
  id: 'rocket_nozzle',
  name: 'Rocket Nozzle',
  description: 'Launches you into the canopy. Triples Durians per click.',
  cost: 50000000,
  icon: 'assets/placeholder-upgrade.png',
  effects: [{ type: 'clickMult', value: 3 }],
  unlock: { type: 'upgrade', id: 'fludd_turbo' }
}
```

Upgrades are one-time purchases unless you add `repeatable: true` (and optionally
`costMultiplier`, default 1.5).

**Effect types:**

| type | fields | does |
|---|---|---|
| `clickAdd` | `value` | flat Durians per click |
| `clickMult` | `value` | multiplies click power |
| `clickFromDps` | `value` | adds `value × DPS` to each click |
| `workerMult` | `target`, `value` | multiplies one worker's output |
| `globalMult` | `value` | multiplies all worker output |
| `clickFromWorkers` | `value` | adds `value` per click for each worker owned |
| `workerScaling` | `target`, `per`, `value` | target gains `value` per `per` of itself owned |
| `workerSynergy` | `target`, `source`, `value` | target gains `value` per `source` owned; either side may be `'all'` |
| `achievementBonus` | `value` | raises the per-achievement production bonus |
| `eventChance` | `value` | island events fire more often |
| `eventGain` | `value` | good events pay more |
| `eventLoss` | `value` | bad events cost less (use a value below 1) |
| `buffDuration` | `value` | event buffs last longer |
| `offlineEfficiency` | `value` | added to the offline production rate |
| `offlineHours` | `value` | extends the offline cap, in hours |

`workerScaling` and `workerSynergy` are what keep Piantas and Nokis relevant in
the late game — they scale off worker counts rather than being flat doublers,
so a starting crew of 300 Piantas is still worth something at 10^18 Durians.

An upgrade can list several effects. To invent a new one, add a `case` to the switch
in `recalc()` in `game.js`.

### A new achievement

```js
{ id: 'stinky', name: 'Notably Stinky', description: 'Collect 1 quadrillion Durians.',
  condition: { type: 'totalEarned', amount: 1e15 } }
```

Each achievement earned also grants a small permanent production bonus
(`CONFIG.achievementBonusPer`, currently +1% each).

### Requirement types

Unlocks and achievements share one vocabulary, so anything you can gate one with,
you can gate the other with:

`always` · `totalEarned` · `durians` · `clickEarned` · `clicks` · `workerCount`
· `totalWorkers` · `dps` · `upgrade` · `upgradesBought` · `achievement` · `playTime`
· `achievementCount` · `eventsSeen` · `eventTypeSeen` · `offlineEarned`

Adding a new one means a `case` in `meetsRequirement()` and a matching line in
`describeRequirement()` (which writes the "🔒 Unlocks at …" text) — both in `game.js`.

---

## Timing and speed

Production is paced against the wall clock, not the frame rate. Each frame
advances by the **smaller of two independent clocks** (`performance.now` and
`Date.now`), so overriding either one on its own gains nothing — both have to
be faked in step. Pumping the frame driver gains nothing either: at 1200fps the
loop credits exactly what it credits at 60fps, and a 240Hz display earns what a
60Hz one does.

A single frame can credit at most `CONFIG.balance.maxFrameSeconds` (1 second).
Longer gaps are the offline-earnings system's job, not the frame loop's.

`CONFIG.balance.timeScale` is the testing knob — set it to 10 to run the
economy ten times faster locally. **Ship it at 1.** `test-timing.js` asserts
all of the above, including that timeScale is 1.

This is a client-side game, so someone determined with the console can still
edit their own numbers. What this stops is the accidental and the casual: fast
hardware, high refresh rates, and one-line speed hacks.

## Leaderboard integrity

Three layers, and it is worth being clear about what each one is worth.

1. **State reconciliation** (`js/game.js`). A fingerprint covering the Durian
   total, every crew count and the owned-upgrade tally is recorded after each
   sanctioned change — `addDurians`, `spendDurians`, `Workers.buy`,
   `Upgrades.buy` and the two event setbacks — and the tick loop checks once a
   second that it still matches. So `state.durians = 1e60`,
   `state.workers.piantajudge = 500000` and granting yourself a stack of
   upgrades are all caught within a second. Crew counts are position-weighted,
   so moving counts from a cheap worker to an expensive one is caught too.
2. **Save signing and affordability** (`js/save.js`). The payload carries a
   signature, and the crew is checked against what the save could have paid
   for: costs rise 10% a head, so owning n of a worker means having spent at
   least `baseCost x (mult^n - 1) / (mult - 1)`. A save claiming 500,000 Pianta
   Judges is rejected **even if it has been correctly re-signed**, which is what
   makes this worth more than the signature alone.
3. **Server-side limits** (`leaderboard-guard.sql`, optional). Rejects scores
   that are impossible for the play time claimed. This is the only layer a
   player cannot reach.

A save that fails 1 or 2 **still loads and still plays** — losing someone's
real progress to a false positive would be far worse than the cheating. It is
marked, and marked saves are refused by the leaderboard.

**What this does not do:** stop someone who calls the game's own functions.
`DC.Game.addDurians(...)` goes through the sanctioned path and looks exactly
like earning, because on the player's own machine it is indistinguishable from
it. No client-side scheme changes that. Layer 3 is the answer if you want the
board to be trustworthy rather than merely tidy.

**Autoclickers stay eligible, at any rate.** There is deliberately no
click-rate rule: the limiter in `js/game.js` already removes the advantage
(clicks past `maxClickRate` earn a fraction), so a plausibility check on clicks
per second would catch nothing the limiter has not already neutralised, while
banning people for playing the way we told them they could.

The false-positive cases matter more than the detection, so `test-integrity.js`
pins them down: a brand-new player clicking before the first tick, autoclicking
from 10 to 20,000 per second, and a large offline windfall all pass clean.

## Offline production

`CONFIG.offline.efficiency` is the fraction of normal production earned while
away, **before** upgrades. It ships at `0.1` — a tenth of normal.

The nine `offlineEfficiency` upgrades are **additive** on top of that and sum
to +80%, so a full build tops out at **90%** — being online is always worth
more than being away, at every stage. `test-update13.js` asserts both the sum
and the 90% ceiling, so a future retune cannot quietly push offline past
parity. The values live in the `OFFLINE_UP`, `OFFLINE2` and `DEEP_MISC` lists
in `gen_upgrades.py`.

Duration is separate: `CONFIG.offline.maxSeconds` (24h) with the
`offlineHours` upgrades extending it to 49 days.

## Balance knobs

All in `js/config.js`:

```js
balance: {
  startingDurians: 0,
  baseClickPower: 1,      // Durians per click before upgrades
  tickRate: 20,           // production ticks per second
  uiRefreshRate: 20       // UI redraws per second
},
formatting: {
  suffixThreshold: 1000   // raise to 1e6 for "12,345" instead of "12.3K"
},
autosave:  { enabled: true, intervalSeconds: 10 },
offline:   { enabled: true, maxSeconds: 86400, minSeconds: 60, efficiency: 1.0 },
achievementBonusPer: 0.01
```

`offline.efficiency: 0.5` would make workers idle at half rate while you're away.

Click power is **normalised automatically** by `gen_upgrades.py`: the ratio is
exactly (clickMult product) x (clickFromDps sum), so the generator scales the
DPS shares to hit the target and rewrites their descriptions to match. Add click
upgrades freely; the balance holds.

**Clicking is tuned so a full click build is worth ~1/3 of a second of passive
production per click** — about 2.7x your passive rate at 8 clicks/sec. The two
levers are the `clickMult` product and the `clickFromDps` sum in
`js/content/upgrades.js`; their product IS the ratio. A test fails if it drifts
outside 0.25–0.45.

**On current pacing (Update 2):** simulating a veteran save — the state a player
reaches at the end of Update 1 — through sixty days of continuous optimal play
buys about 118 of the 166 upgrades, with the last one landing around day 31 and
roughly 48 upgrades plus 23 achievements still ahead. Casual play stretches that
considerably.

Worker tier upgrades are gated on counts up to 275 rather than 500, because
worker cost scales at 1.15^n while upgrades only double — counts past ~300 are
unreachable in practice, and gating content there would have made it dead.
Late-game pacing is carried by cost instead.

End-game output share across the crew lands near: Nokis 69%, Piantas 19%,
Shadow Marios 8%, and the middle three a few percent between them. The starting
crew staying dominant is deliberate — that was the balance ask — but if you want
a flatter spread, raise the `value` on the `workerScaling` entries for Yoshi,
Toad and Il Piantissimo in `js/content/upgrades.js`. Nothing else needs to change.

---

## Random island events

Every few minutes an event fires: King Boo hands over a pile of fruit or helps
himself to some, the Sirena Beach Hotel presents a bill nobody remembers
incurring, a Shine Sprite drifts past and multiplies production sevenfold for a
minute. Content lives in `js/content/events.js`, the engine in `js/events.js`.

Each event is one entry. Effect types:

| type | fields | does |
|---|---|---|
| `gainSeconds` | `min`, `max` | pays out N seconds of your current DPS |
| `gainFlat` | `min`, `max` | pays out a flat amount |
| `losePercent` | `min`, `max` | takes a share of your banked Durians |
| `loseSeconds` | `min`, `max` | takes N seconds of production |
| `buff` | `prod`, `click`, `seconds`, `label` | a temporary multiplier |

`weight` sets relative frequency, `good: false` marks a setback, and `require`
gates an event behind any requirement type. Timing and safety rails are in
`CONFIG.events_settings` — the gap between events, and `minBankForSetbacks`,
which stops the game taking Durians from someone who has barely any.

Buffs live in `state.buffs` and fold into production through `recalc()`. They
survive a save and reload, and expired ones are dropped on load.

Debug the whole system with Ctrl + ` — there's a dropdown to fire any specific
event and a button for a random one.

## Number display

Players choose between three styles in Settings, saved with their progress:

| Mode | 1,250,000 renders as |
|---|---|
| Abbreviated (default) | `1.25M` |
| Shortened | `1.25 million` |
| Full number | `1,250,000` |

Set the default for new players with `CONFIG.formatting.defaultMode`. Full mode
falls back to abbreviated past 10^60, where writing every digit stops being
readable.

## Casino

Every spin costs **one Blue Coin plus a Durian stake**. The coin is the limiter,
and that is the whole design: Durians are effectively unlimited late game, so
free spins would let players farm Blue Coins out of the jackpot and make them
worthless. Coins are scarce, so spins are scarce.

The numbers, verified by test:

- Durian stake returns ~88% long run — a sink, not a faucet
- Blue Coins returned per coin spent: **0.000024**, i.e. about 41,700 spins to
  win one back. It can never be farmed.

Tune odds in `CONFIG.casino.symbols` (weights and `triple` multipliers).
`DC.Casino.expectedReturn()` and `DC.Casino.coinReturn()` compute the theory
directly, and the test suite fails if either drifts out of a safe band.

## Dark mode

Toggle in the top bar next to the volume, or in Settings. It dims the island
backdrop behind the durian so the fruit is the brightest thing on screen, and
saves with the player's progress.

It works as a single token swap: `body.dark` redeclares the palette variables
(`--surface`, `--surface-2`, `--card`, `--ink`, and so on) and every component
already reads from those. If you add UI, use the tokens rather than literal hex
values and dark mode will pick it up for free.

## Tooltips

Hovering an achievement or a purchased upgrade shows a styled panel that appears
instantly and tracks the cursor — native `title=` tooltips wait about a second,
ignore the game's styling, and never appear on touch at all. Tapping pins the
panel open so mobile players can read it; tapping elsewhere, pressing Escape or
scrolling dismisses it.

To add one to something new, call `bindTip(node, getContentFn)` in `ui.js`. The
getter runs at display time, so the text can reflect current state.

## Numbers

Currency is never a plain JS number. `numbers.js` stores every value as a normalised
mantissa/exponent pair (`value = m × 10^e`), giving ~15 significant digits at any
magnitude — well past the point where floats would start dropping your income.

Display goes `999` → `1.25K` → `2.40M` → `15.7B` → `3.20T` → `1.00Qa` → … → `1.00Dc`
and beyond, falling back to scientific notation past roughly 10^96. Add more entries
to the `SUFFIXES` array to push that further out.

If you're writing new game code: use `DC.N.add/sub/mul/div/cmp/gte` rather than `+`
and `>`. `DC.N.toNumber()` exists for UI maths and progress bars — never for the
balance itself.

---

## Saving

Autosaves to `localStorage` every 10 seconds, plus on tab close, backgrounding, and
mobile app switch. The settings menu (⚙) has Save, Export, Download, Import and
Reset. Reset asks for confirmation first.

Export produces a base64 string; Import accepts either that or raw JSON. Save data is
keyed by `CONFIG.saveKey`.

**When you change content:** removing a worker or upgrade from the config can't
corrupt existing saves — the loader only reads ids that still exist. If you ever need
a genuine format change, bump `CONFIG.saveVersion` and add a step to `migrate()` in
`save.js`.

---

## Leaderboard

The **Ranks** tab has two boards — total Durians earned and Durians per second —
with your own row highlighted and your rank shown even when you're outside the top 50.

### It ships in local mode

A static site can't host a database, so out of the box the board runs in `local`
mode: the whole UI works, but scores are stored in your own browser and only you
appear. The tab says so plainly. Nothing is broken on a fresh clone, and nothing
phones home.

### Going online with Supabase

Free tier, no server to run, about ten minutes of setup:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor, paste in `leaderboard-setup.sql`, run it. Watch for a red
   error box — the editor runs the script as one transaction, so a single failing
   statement rolls back everything including the table.
3. In **Project Settings → API Keys**, copy your project URL and your **publishable**
   key (`sb_publishable_...`). The older `anon` JWT key from the Legacy tab also works.
   Never use a `sb_secret_...` or `service_role` key here — those bypass RLS, and the
   game refuses to run with one.
4. Fill them into `js/config.js`:

```js
leaderboard: {
  provider: 'supabase',
  supabase: {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'sb_publishable_...',   // publishable or legacy anon — safe to commit
    table: 'durian_scores'
  }
}
```

That's the whole change. Push, and the board is live.

A note on key formats, because it bites: the newer `sb_publishable_` keys are not
JWTs. They go in the `apikey` header only — putting one in `Authorization: Bearer`
makes Supabase's gateway try to parse it as a JWT and return 401 on every request.
Legacy `eyJ...` keys are JWTs and are sent in both headers. `leaderboard.js` detects
which kind you pasted and sets the headers accordingly, so either works.

### Using something else

Set `provider: 'custom'` and give it two endpoints — `POST submitUrl` receives the
score as JSON, `GET fetchUrl` returns `{ entries: [...] }`. Cloudflare Workers,
a Netlify function, a Google Apps Script, whatever you like.

To add a provider properly, drop an object with `submit()` and `fetch()` methods
into `PROVIDERS` in `js/leaderboard.js`. Nothing else in the game changes.

### How scores travel

Big numbers don't survive a float column, so each score is sent as a pair: `log10`
of the value for sorting (a double ranks accurately well past 10^300) and a
preformatted string for display. Submissions upsert on a private key, so each
player keeps one row rather than filling the table.

Each player has **two** ids. `player_id` is the row key, lives in the save file, and
is never granted for select — so nobody can discover it and overwrite your score.
`public_id` comes back with the results and only tells your client which row is
yours. The SQL enforces this with column-level grants, so even a hand-written
`?select=player_id` request is refused.

Writes go through a `security definer` function (`submit_durian_score`) rather than
straight at the table, so the `anon` role holds no insert, update or delete
privilege at all. It can read the public columns and call that one function.
Nothing else.

Auto-submits every five minutes while playing and once when the tab closes, with a
30-second floor on manual submits.

### Scores are not verified — and can't be

You run a real leaderboard, so you already know the shape of this problem. The anon
key ships inside the JavaScript, which is normal for Supabase but means anyone can
read it and POST whatever they want. The database policies protect the integrity of
*other people's* rows — nobody can edit or delete your score — but they cannot
establish that a score was actually earned. The game literally ships a debug menu
that grants a quadrillion Durians.

So: this is a vanity board, not a record sheet. Ship it as one.

If you want something you'd stand behind, the working shape is the one you already
use for run verification — submissions become claims and a human approves them. Add
an `approved boolean default false` column, filter the public read policy to
`using (approved)`, and review new rows yourself. Every submission carries play
time, total clicks, worker count and achievement count precisely so that review
takes seconds: a 10-second play time next to a 10^40 score is not subtle. The
commented-out plausibility trigger at the bottom of `leaderboard-setup.sql` is a
cruder automatic version of the same idea.

### Turning it off

`leaderboard: { enabled: false }` in `config.js`. Hide the tab by deleting its
`<button class="tab" data-tab="leaderboard">` line from `index.html`.

---

## Notes on the build

- **Classic scripts, not ES modules.** Deliberate: modules break on `file://`, and
  being able to double-click `index.html` to test is worth more than the import
  syntax. Load order is set in `index.html` — data, then maths, then state, then
  systems, then interface.
- **Rendering.** Lists rebuild only when their structure changes (an unlock, a
  purchase, a reset). Every frame, only numbers and affordability styling refresh —
  so frame cost stays flat no matter how much is on screen.
- **Responsive** at 1920×1080, 1366×768, and mobile portrait and landscape. Keyboard
  focus is visible, the durian is reachable with Enter/Space, and
  `prefers-reduced-motion` is respected.
- **Save compatibility.** Update 2 adds no required save fields. A save from
  Update 1 loads with `buffs`, `events`, `lost` and `offlineEarned` defaulted,
  every worker count, upgrade and achievement intact, and the new content simply
  unlocked and waiting. There is a dedicated migration suite that asserts this
  against a realistic veteran save.
- **Tested headlessly** — six suites, including one that buys every upgrade in
  isolation and asserts it changes the number it claims to by the exact factor
  claimed, and one that checks every asset path in config and content resolves
  to a file that actually exists. Logic (number precision at 10^100+, cost
  curves, max-buy correctness, unlock gating, offline capping), jsdom against the
  real DOM (clicking, buying, tab switching, save round-trip, offline popup, reset
  confirmation, debug panel, leaderboard name flow and HTML escaping), and the
  Supabase provider against a mocked `fetch` (request shapes, upsert headers, that
  the private row key never appears in a select, and graceful failure when the
  network is down).
