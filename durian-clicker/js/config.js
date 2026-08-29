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
    buildId: '2026-08-29-update3c',
    updateCheck: {
      enabled: true,
      url: 'version.json',
      intervalSeconds: 300
    },

    saveKey: 'durianClicker.save.v1',
    saveVersion: 1,
    debugEnabled: false,       // set true to re-enable the Ctrl+` developer panel

    /* ------------------------------------------------------------ balance */
    balance: {
      startingDurians: 0,
      baseClickPower: 1,       // durians per click before upgrades
      tickRate: 20,            // production ticks per second
      uiRefreshRate: 20        // UI redraws per second
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
      efficiency: 1.0            // 0.5 would mean workers idle at half rate
    },

    /* ------------------------------------------------------------- assets */
    // Replace these files (or point these strings elsewhere) to reskin the game.
    assets: {
      durian: 'assets/placeholder-durian.png',
      background: 'assets/placeholder-background.png',
      shine: 'assets/placeholder-shine.png',
      upgradeDefault: 'assets/placeholder-upgrade.png'
    },

    sounds: {
      click: 'assets/sounds/click.wav',
      buyWorker: 'assets/sounds/buy-worker.wav',
      buyUpgrade: 'assets/sounds/buy-upgrade.wav',
      unlock: 'assets/sounds/unlock.wav',
      achievement: 'assets/sounds/achievement.wav',
      offline: 'assets/sounds/offline.wav'
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
      }
    ],

    /* --------------------------------------------- content (see js/content/) */
    // Filled by js/content/upgrades.js, achievements.js and events.js so this
    // file stays readable. Order of <script> tags in index.html matters.
    upgrades: [],
    achievements: [],
    events: [],

    /* ------------------------------------------------------ island events */
    events_settings: {
      enabled: true,
      minIntervalSeconds: 240,      // random gap between events...
      maxIntervalSeconds: 900,      // ...scaled by any eventChance upgrades
      minBankForSetbacks: 10000,    // never take Durians below this
      showBanner: true,
      bannerSeconds: 10
    }
  };

  DC.CONFIG = CONFIG;
})(window.DC = window.DC || {});
