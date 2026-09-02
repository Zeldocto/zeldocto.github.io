/* =============================================================================
 * config.js — ALL game content lives here.
 * -----------------------------------------------------------------------------
 * Adding a worker, an upgrade or an achievement means adding one object to one
 * of the arrays below. No other file needs to change. Same for artwork and
 * audio: every asset path is a value in CONFIG.assets / CONFIG.sounds.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var CONFIG = {

    /* --------------------------------------------------------------- meta */
    // Bump this AND version.json on every deploy. Anyone mid-session gets a
    // "refresh for the update" prompt instead of silently running old code.
    buildId: '2026-09-15-2',
    updateCheck: {
      enabled: true,
      url: 'version.json',
      intervalSeconds: 300,
      // Whether a forced reload is PERMITTED at all. Whether one actually
      // happens is decided per deploy by "force": true in version.json, so a
      // routine content push just shows the banner and only the updates that
      // need everyone on the new code pull people across.
      allowAutoReload: true,
      countdownSeconds: 10
    },

    // Shown beside the logo and used as the changelog heading. Bump this when
    // you cut a release; buildId is the deploy stamp and changes far more often.
    version: '2.5.2',

    saveKey: 'durianClicker.save.v1',
    saveVersion: 1,
    debugEnabled: false,       // set true to re-enable the Ctrl+` developer panel

    /* ------------------------------------------------------------ balance */
    balance: {
      startingDurians: 0,
      baseClickPower: 1,       // durians per click before upgrades
      // Production is paced against the WALL CLOCK, not the frame rate. Each
      // frame advances by the smaller of two independent clocks
      // (performance.now and Date.now), so speeding up either one on its own
      // buys nothing, and a 240Hz display earns exactly what a 60Hz one does.
      //
      // timeScale is the testing knob: set it to 10 to run the economy ten
      // times faster locally. Ship it at 1.
      timeScale: 1,
      maxFrameSeconds: 1,      // longest jump a single frame may credit

      tickRate: 20,            // production ticks per second
      uiRefreshRate: 20,       // UI redraws per second

      // Clicks above this rate still register for animation and achievements
      // but earn a fraction. A console one-liner could otherwise fire 50,000
      // clicks in a single frame. Autoclickers at human-ish speeds are fine.
      maxClickRate: 30,        // clicks per second earning full value
      overflowClickValue: 0.02 // what the rest are worth, as a fraction
    },

    formatting: {
      // Values below this print as "12,345"; at or above it they print as
      // "1.25K", "2.40M", ... Raise to 1e6 if you prefer commas for longer.
      suffixThreshold: 1000,
      defaultMode: 'abbreviated'    // players can change this in Settings
    },

    autosave: {
      enabled: true,
      intervalSeconds: 10
    },

    offline: {
      enabled: true,
      maxSeconds: 24 * 60 * 60,  // cap on how much time away counts
      minSeconds: 60,            // don't nag for short absences
      // Fraction of normal production earned while away, BEFORE the offline
      // upgrades add to it. Those are additive, so a full build reaches
      // efficiency + the sum of their values.
      efficiency: 0.1
    },

    /* ------------------------------------------------------------- assets */
    // Replace these files (or point these strings elsewhere) to reskin the game.
    assets: {
      durian: 'assets/placeholder-durian.png',
      background: 'assets/placeholder-background.png',
      shine: 'assets/placeholder-shine.png',
      upgradeDefault: 'assets/placeholder-upgrade.png',
      blueCoin: 'assets/placeholder-bluecoin.png',
      airplane: 'assets/placeholder-airplane.png',
      slots: 'assets/placeholder-slots.png',
      store: 'assets/placeholder-store.png',
      marioFace: 'assets/placeholder-marioface.png'
    },

    sounds: {
      click: 'assets/sounds/click.wav',
      buyWorker: 'assets/sounds/buy-worker.wav',
      buyUpgrade: 'assets/sounds/buy-upgrade.wav',
      unlock: 'assets/sounds/unlock.wav',
      achievement: 'assets/sounds/achievement.wav',
      offline: 'assets/sounds/offline.wav',
      coin: 'assets/sounds/achievement.wav',
      spin: 'assets/sounds/buy-worker.wav',
      jackpot: 'assets/sounds/achievement.wav'
    },

    audio: {
      defaultVolume: 0.6,
      defaultMuted: false,
      clickThrottleMs: 40      // stops the click sound machine-gunning
    },

    /* -------------------------------------------------------------- extras */
    // Every achievement earned gives this much bonus to ALL production.
    achievementBonusPer: 0.01,

    /* --------------------------------------------------------- leaderboard */
    /* GitHub Pages serves static files only, so the board needs a hosted
     * database. Out of the box this runs in 'local' mode — the UI works and
     * scores are stored on this device only. Switch provider to 'supabase'
     * (or 'custom') and fill in the details to go genuinely online.
     * See README.md and leaderboard-setup.sql.
     */
    leaderboard: {
      enabled: true,
      provider: 'supabase',           // 'local' | 'supabase' | 'custom'
      maxEntries: 100,
      submitIntervalSeconds: 300,     // auto-submit while playing
      minSubmitIntervalSeconds: 30,   // floor on manual submits
      minScoreToSubmit: 1000,         // don't clutter the board with brand-new saves
      nameMaxLength: 20,

      supabase: {
        url: 'https://fiedmihcarlernixzlps.supabase.co',
        anonKey: 'sb_publishable_NAkqrWI96qG43ALKHhQDxg_p7q395cA',   // publishable key — safe to ship
        table: 'durian_scores'
      },

      custom: {
        submitUrl: '',                // POST, JSON body
        fetchUrl: ''                  // GET, returns { entries: [...] }
      },

      // Each board is one sort order over the same submitted row.
      boards: [
        { id: 'total', label: 'Durians earned', sortKey: 'total_log', displayKey: 'total_display' },
        { id: 'dps', label: 'Per second', sortKey: 'dps_log', displayKey: 'dps_display',
          note: 'Base production, before temporary Shine effects.' }
      ]
    },

    /* ------------------------------------------------------------- workers */
    /* id             unique key, also the save key — never rename after release
     * baseCost       price of the first one
     * baseProduction durians per second, each
     * costMultiplier price growth per purchase (1.15 = +15% each)
     * unlock         see requirement types in game.js meetsRequirement()
     */
    workers: [
      {
        id: 'pianta',
        name: 'Pianta',
        plural: 'Piantas',
        description: 'A hardworking Pianta who has been tasked with collecting Durians.',
        flavor: 'Shakes the tree. Waits. Shakes it again.',
        baseCost: 20,
        baseProduction: 1,
        costMultiplier: 1.10,
        image: 'assets/placeholder-pianta.png',
        unlock: { type: 'always' }
      },
      {
        id: 'fruitlady',
        name: 'Fruit Lady',
        plural: 'Fruit Ladies',
        description: 'Runs a fruit stall in the Plaza and knows exactly which durians are ready.',
        flavor: 'She has been doing this longer than anyone. She will tell you so.',
        baseCost: 60,
        baseProduction: 3,
        costMultiplier: 1.10,
        image: 'assets/placeholder-fruitlady.png',
        unlock: { type: 'totalEarned', amount: 90 }
      },
      {
        id: 'noki',
        name: 'Noki',
        plural: 'Nokis',
        description: 'A Noki who specializes in efficiently gathering and transporting Durians.',
        flavor: 'Carries three at a time. Complains about none of them.',
        baseCost: 150,
        baseProduction: 8,
        costMultiplier: 1.10,
        image: 'assets/placeholder-noki.png',
        unlock: { type: 'totalEarned', amount: 200 }
      },
      {
        id: 'yoshi',
        name: 'Yoshi',
        plural: 'Yoshis',
        description: 'Eats fruit, produces fruit. Nobody on Isle Delfino asks how.',
        flavor: 'Do not let him touch the water.',
        baseCost: 1650,
        baseProduction: 47,
        costMultiplier: 1.10,
        image: 'assets/placeholder-yoshi.png',
        unlock: { type: 'totalEarned', amount: 2500 }
      },
      {
        id: 'toad',
        name: 'Toad',
        plural: 'Toads',
        description: 'Vacation staff, reassigned to durian logistics indefinitely.',
        flavor: 'Still wearing the hotel uniform.',
        baseCost: 18000,
        baseProduction: 260,
        costMultiplier: 1.10,
        image: 'assets/placeholder-toad.png',
        unlock: { type: 'totalEarned', amount: 30000 }
      },
      {
        id: 'mushroompianta',
        name: 'Mushroom Dealer Pianta',
        plural: 'Mushroom Dealers',
        description: 'Sells mushrooms. Accepts durians. The exchange rate is his own invention.',
        flavor: 'Everything about the stall is slightly too casual.',
        baseCost: 68000,
        baseProduction: 650,
        costMultiplier: 1.10,
        image: 'assets/placeholder-mushroompianta.png',
        unlock: { type: 'totalEarned', amount: 120000 }
      },
      {
        id: 'piantissimo',
        name: 'Il Piantissimo',
        plural: 'Piantissimos',
        description: 'Races you to every durian on the island and insists he was first.',
        flavor: 'Definitely a Pianta. Definitely.',
        baseCost: 195000,
        baseProduction: 1400,
        costMultiplier: 1.10,
        image: 'assets/placeholder-piantissimo.png',
        unlock: { type: 'totalEarned', amount: 300000 }
      },
      {
        id: 'tanooki',
        name: 'Tanooki',
        plural: 'Tanookis',
        description: 'Turns into a durian tree, waits to be harvested, then does it again.',
        flavor: 'Nobody has explained why this works. It works.',
        baseCost: 720000,
        baseProduction: 3400,
        costMultiplier: 1.10,
        image: 'assets/placeholder-tanooki.png',
        unlock: { type: 'totalEarned', amount: 1200000 }
      },
      {
        id: 'shadowmario',
        name: 'Shadow Mario',
        plural: 'Shadow Marios',
        description: 'Paints durians into existence and takes zero responsibility for it.',
        flavor: 'The cleanup bill arrives later.',
        baseCost: 2100000,
        baseProduction: 7800,
        costMultiplier: 1.10,
        image: 'assets/placeholder-shadowmario.png',
        unlock: { type: 'totalEarned', amount: 3000000 }
      },
      {
        id: 'riccoconverter',
        name: 'Ricco Fruit Converter',
        plural: 'Ricco Converters',
        description: 'Used to convert other fruits on the island into more durians.',
        flavor: 'Perfect RNG, everytime.',
        baseCost: 7000000,
        baseProduction: 34000,
        costMultiplier: 1.10,
        image: 'assets/placeholder-riccoconverter.png',
        unlock: { type: 'totalEarned', amount: 14000000 }
      },
      {
        id: 'chuckster',
        name: 'Chuckster',
        plural: 'Chucksters',
        description: 'Throws durians an unreasonable distance. Also throws you, if you stand too close.',
        flavor: 'CHUCKSTER.',
        baseCost: 24000000,
        baseProduction: 44000,
        costMultiplier: 1.10,
        image: 'assets/placeholder-chuckster.png',
        unlock: { type: 'totalEarned', amount: 32000000 }
      },
      {
        id: 'giantpiantatree',
        name: 'Giant Pianta Tree',
        plural: 'Giant Pianta Trees',
        description: 'The vast tree at the centre of Pianta Village, bursting with Durians all through Spring.',
        flavor: 'The whole village is built around it. So is the whole economy.',
        baseCost: 320000000,
        baseProduction: 400000,
        costMultiplier: 1.10,
        image: 'assets/placeholder-giantpiantatree.png',
        unlock: { type: 'totalEarned', amount: 640000000 }
      },
      {
        id: 'coronamountain',
        name: 'Corona Mountain',
        plural: 'Corona Mountains',
        description: 'Erupts Durians constantly now, as well as randomly.',
        flavor: 'The geologists left. The harvest crews moved in.',
        baseCost: 4500000000,
        baseProduction: 4000000,
        costMultiplier: 1.10,
        image: 'assets/placeholder-coronamountain.png',
        unlock: { type: 'totalEarned', amount: 9000000000 }
      },
      {
        id: 'piantajudge',
        name: 'Pianta Judge',
        plural: 'Pianta Judges',
        description: 'He has the power to grant you nearly unlimited Durians, taxed from the locals.',
        flavor: 'The ruling was unanimous. He was the only one voting.',
        baseCost: 65000000000,
        baseProduction: 40000000,
        costMultiplier: 1.10,
        image: 'assets/placeholder-piantajudge.png',
        unlock: { type: 'totalEarned', amount: 130000000000 }
      }
    ],

    /* --------------------------------------------------------- blue coins */
    /* Cookie Clicker's golden cookie, as a Blue Coin. Spawns somewhere on
     * screen, sits for a few seconds, pays out if clicked. Airplanes fly past
     * and drop one too. */
    blueCoins: {
      enabled: true,
      minIntervalSeconds: 240,
      maxIntervalSeconds: 720,
      lifetimeSeconds: 13,
      planeChance: 0.35,          // share of spawns that arrive as an airplane
      planeFlightSeconds: 9,
      rewardMin: 1,
      rewardMax: 1,
      luckyChance: 0.08,          // small chance of a bigger drop
      luckyReward: 3
    },

    /* ------------------------------------------------------------- casino */
    casino: {
      enabled: true,
      minBet: 1000,
      // Bet is chosen as a share of your bank so it stays meaningful all game.
      betFractions: [0.01, 0.05, 0.25],
      reels: 3,
      spinSeconds: 1.6,
      coinSpinCost: 1,            // Blue Coins per spin — this is the real limiter
      symbols: [
        { id: 'durian', name: 'Durian', icon: 'assets/placeholder-durian.png', weight: 28, triple: 9 },
        { id: 'pianta', name: 'Pianta', icon: 'assets/placeholder-pianta.png', weight: 24, triple: 10 },
        { id: 'noki',   name: 'Noki',   icon: 'assets/placeholder-noki.png',   weight: 20, triple: 14 },
        { id: 'yoshi',  name: 'Yoshi',  icon: 'assets/placeholder-yoshi.png',  weight: 15, triple: 20 },
        { id: 'shine',  name: 'Shine',  icon: 'assets/placeholder-shine.png',  weight: 8,  triple: 60 },
        // weight raised from 2: at 2 the jackpot was one spin in 125,000, which
        // nobody was ever going to see when a spin costs a Blue Coin
        { id: 'coin',   name: 'Blue Coin', icon: 'assets/placeholder-bluecoin.png', weight: 5,
          triple: 200, tripleCoins: 3 }
      ],
      // A pair used to return exactly the stake, so half the "wins" felt like
      // nothing happened. It now pays out properly, and because a spin already
      // costs a scarce Blue Coin the Durian side runs at a player advantage.
      pairPayout: 1.6
    },

    /* --------------------------------------------------------------- store */
    store: {
      enabled: true,
      title: 'Tanooki Store'
    },

    /* --------------------------------------------- content (see js/content/) */
    // Filled by js/content/upgrades.js, achievements.js and events.js so this
    // file stays readable. Order of <script> tags in index.html matters.
    upgrades: [],
    achievements: [],
    events: [],
    skins: [],

    /* ------------------------------------------------------ island events */
    events_settings: {
      enabled: true,
      minIntervalSeconds: 240,      // random gap between events...
      maxIntervalSeconds: 900,      // ...scaled by any eventChance upgrades
      minBankForSetbacks: 10000,    // never take Durians below this

      // Event upgrades used to MULTIPLY together: x67.5 on payouts, x0.013 on
      // losses, x10 on buff length. Corona Belch handed over 135 hours of
      // production and a Goop outbreak lasted under a second. They stack
      // additively now, and these are the ceilings.
      maxEventGain: 3.0,            // good events pay at most 3x base
      minEventLoss: 0.4,            // bad events always cost at least 40%
      maxBuffDuration: 2.5,         // good buffs last at most 2.5x base
      maxEventChance: 3.0,          // events at most 3x as frequent

      // Payouts are worked out from production, but a Big number carries only
      // about 17 significant digits. If the bank has run far ahead of
      // production, adding the payout changes nothing at all and the banner
      // announces Durians that never arrived. Floor every event at this share
      // of the bank so it always registers. In ordinary play the production
      // figure is far larger and this never binds.
      minShareOfBank: 0.0002,
      showBanner: true,
      bannerSeconds: 10
    }
  };

  DC.CONFIG = CONFIG;
})(window.DC = window.DC || {});
