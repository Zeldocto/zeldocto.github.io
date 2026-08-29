# Durian Clicker

An Isle Delfino incremental game. Click the durian, hire the island, drown in fruit.

A for-fun vibecoded web game.

Vanilla JavaScript, no build step, no dependencies. Every image and sound in here is a
placeholder meant to be thrown away — swapping in your own artwork never requires
touching game code.

---

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
│   ├── config.js       ← ALL game content. Workers, upgrades, achievements,
│   │                     balance numbers, asset paths. Start here.
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

Adding a new one means a `case` in `meetsRequirement()` and a matching line in
`describeRequirement()` (which writes the "🔒 Unlocks at …" text) — both in `game.js`.

---

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

**On current pacing:** a focused session unlocks all six workers in roughly fifteen
minutes and exhausts the upgrade list around the ninety-minute mark, with the
1-trillion achievement still well out of reach. That's what six buildings buys you —
Cookie Clicker has twenty. Adding three or four more workers stretches the curve
naturally without touching any other numbers.

---

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
2. Open the SQL editor, paste in `leaderboard-setup.sql`, run it.
3. In **Project Settings → API**, copy your project URL and the `anon` public key.
4. Fill them into `js/config.js`:

```js
leaderboard: {
  provider: 'supabase',
  supabase: {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'eyJhbGci...',      // the public anon key — safe to commit
    table: 'durian_scores'
  }
}
```

That's the whole change. Push, and the board is live.

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

## Debug mode

**Ctrl + `** opens the developer panel: add Durians (1K / 1M / 1Qa / ×1000), unlock
everything, grant all upgrades or achievements, set any worker count directly,
simulate an offline absence of N seconds, submit to the leaderboard, force a save or
reload, hard reset, and dump the game state to the console.

For a production build set `debugEnabled: false` in `config.js` — the panel is removed
from the DOM entirely and the shortcut does nothing.

`window.DC` is exposed in the console regardless, if you want to poke at things
directly: `DC.Game.state`, `DC.Workers.buy('noki', 10)`, `DC.N.format(DC.Game.derived.dps)`.

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
- **Tested headlessly** — three suites. Logic (number precision at 10^100+, cost
  curves, max-buy correctness, unlock gating, offline capping), jsdom against the
  real DOM (clicking, buying, tab switching, save round-trip, offline popup, reset
  confirmation, debug panel, leaderboard name flow and HTML escaping), and the
  Supabase provider against a mocked `fetch` (request shapes, upsert headers, that
  the private row key never appears in a select, and graceful failure when the
  network is down).
