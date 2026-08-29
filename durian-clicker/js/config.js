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
    saveKey: 'durianClicker.save.v1',
    saveVersion: 1,
    debugEnabled: true,        // set false for a production build (hides Ctrl+`)

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
      suffixThreshold: 1000
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
      provider: 'supabase',              // 'local' | 'supabase' | 'custom'
      maxEntries: 100,
      submitIntervalSeconds: 300,     // auto-submit while playing
      minSubmitIntervalSeconds: 30,   // floor on manual submits
      minScoreToSubmit: 1000,         // don't clutter the board with brand-new saves
      nameMaxLength: 20,

      supabase: {
        url: 'https://fiedmihcarlernixzlps.supabase.co',                      // https://YOUR-PROJECT.supabase.co
        anonKey: 'sb_publishable_NAkqrWI96qG43ALKHhQDxg_p7q395cA',                  // the public anon key — safe to ship
        table: 'durian_scores'
      },

      custom: {
        submitUrl: '',                // POST, JSON body
        fetchUrl: ''                  // GET, returns { entries: [...] }
      },

      // Each board is one sort order over the same submitted row.
      boards: [
        { id: 'total', label: 'Durians earned', sortKey: 'total_log', displayKey: 'total_display' },
        { id: 'dps', label: 'Per second', sortKey: 'dps_log', displayKey: 'dps_display' }
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
        baseCost: 15,
        baseProduction: 1,
        costMultiplier: 1.15,
        image: 'assets/placeholder-pianta.png',
        unlock: { type: 'always' }
      },
      {
        id: 'noki',
        name: 'Noki',
        plural: 'Nokis',
        description: 'A Noki who specializes in efficiently gathering and transporting Durians.',
        flavor: 'Carries three at a time. Complains about none of them.',
        baseCost: 100,
        baseProduction: 8,
        costMultiplier: 1.15,
        image: 'assets/placeholder-noki.png',
        unlock: { type: 'totalEarned', amount: 200 }
      },
      {
        id: 'yoshi',
        name: 'Yoshi',
        plural: 'Yoshis',
        description: 'Eats fruit, produces fruit. Nobody on Isle Delfino asks how.',
        flavor: 'Do not let him touch the water.',
        baseCost: 1100,
        baseProduction: 47,
        costMultiplier: 1.15,
        image: 'assets/placeholder-yoshi.png',
        unlock: { type: 'totalEarned', amount: 2500 }
      },
      {
        id: 'toad',
        name: 'Toad',
        plural: 'Toads',
        description: 'Vacation staff, reassigned to durian logistics indefinitely.',
        flavor: 'Still wearing the hotel uniform.',
        baseCost: 12000,
        baseProduction: 260,
        costMultiplier: 1.15,
        image: 'assets/placeholder-toad.png',
        unlock: { type: 'totalEarned', amount: 30000 }
      },
      {
        id: 'piantissimo',
        name: 'Il Piantissimo',
        plural: 'Piantissimos',
        description: 'Races you to every durian on the island and insists he was first.',
        flavor: 'Definitely a Pianta. Definitely.',
        baseCost: 130000,
        baseProduction: 1400,
        costMultiplier: 1.15,
        image: 'assets/placeholder-piantissimo.png',
        unlock: { type: 'totalEarned', amount: 300000 }
      },
      {
        id: 'shadowmario',
        name: 'Shadow Mario',
        plural: 'Shadow Marios',
        description: 'Paints durians into existence and takes zero responsibility for it.',
        flavor: 'The cleanup bill arrives later.',
        baseCost: 1400000,
        baseProduction: 7800,
        costMultiplier: 1.15,
        image: 'assets/placeholder-shadowmario.png',
        unlock: { type: 'totalEarned', amount: 3000000 }
      }
    ],

    /* ------------------------------------------------------------ upgrades */
    /* effect types:
     *   clickAdd      { value }            flat durians per click
     *   clickMult     { value }            multiplies click power
     *   clickFromDps  { value }            adds value * DPS to each click
     *   workerMult    { target, value }    multiplies one worker's output
     *   globalMult    { value }            multiplies all worker output
     * An upgrade may list several effects. `repeatable: true` allows re-buying.
     */
    upgrades: [
      {
        id: 'gloves',
        name: 'Better Durian Gloves',
        description: '+1 Durian per click.',
        cost: 100,
        icon: 'assets/placeholder-upgrade.png',
        effects: [{ type: 'clickAdd', value: 1 }],
        unlock: { type: 'clicks', count: 15 }
      },
      {
        id: 'gloves2',
        name: 'Reinforced Gloves',
        description: '+5 Durians per click. The spikes stop being a problem.',
        cost: 1500,
        icon: 'assets/placeholder-upgrade.png',
        effects: [{ type: 'clickAdd', value: 5 }],
        unlock: { type: 'upgrade', id: 'gloves' }
      },
      {
        id: 'fludd_squirt',
        name: 'FLUDD Squirt Nozzle',
        description: 'Blast durians off the branch. Doubles Durians per click.',
        cost: 6000,
        icon: 'assets/placeholder-upgrade.png',
        effects: [{ type: 'clickMult', value: 2 }],
        unlock: { type: 'clicks', count: 150 }
      },
      {
        id: 'fludd_hover',
        name: 'Hover Nozzle',
        description: 'Each click also earns 1% of your Durians per second.',
        cost: 60000,
        icon: 'assets/placeholder-upgrade.png',
        effects: [{ type: 'clickFromDps', value: 0.01 }],
        unlock: { type: 'upgrade', id: 'fludd_squirt' }
      },
      {
        id: 'fludd_turbo',
        name: 'Turbo Nozzle',
        description: 'Each click earns a further 4% of your Durians per second.',
        cost: 2000000,
        icon: 'assets/placeholder-upgrade.png',
        effects: [{ type: 'clickFromDps', value: 0.04 }],
        unlock: { type: 'upgrade', id: 'fludd_hover' }
      },

      { id: 'pianta_training', name: 'Pianta Training', description: 'Piantas produce 2x as many Durians.',
        cost: 500, icon: 'assets/placeholder-pianta.png',
        effects: [{ type: 'workerMult', target: 'pianta', value: 2 }],
        unlock: { type: 'workerCount', id: 'pianta', count: 5 } },

      { id: 'pianta_festival', name: 'Festival Overtime', description: 'Piantas produce 2x as many Durians.',
        cost: 9000, icon: 'assets/placeholder-pianta.png',
        effects: [{ type: 'workerMult', target: 'pianta', value: 2 }],
        unlock: { type: 'workerCount', id: 'pianta', count: 25 } },

      { id: 'noki_logistics', name: 'Noki Logistics', description: 'Nokis produce 2x as many Durians.',
        cost: 2500, icon: 'assets/placeholder-noki.png',
        effects: [{ type: 'workerMult', target: 'noki', value: 2 }],
        unlock: { type: 'workerCount', id: 'noki', count: 5 } },

      { id: 'noki_shells', name: 'Bigger Shells', description: 'Nokis produce 2x as many Durians.',
        cost: 40000, icon: 'assets/placeholder-noki.png',
        effects: [{ type: 'workerMult', target: 'noki', value: 2 }],
        unlock: { type: 'workerCount', id: 'noki', count: 25 } },

      { id: 'yoshi_juice', name: 'Endless Juice', description: 'Yoshis produce 2x as many Durians.',
        cost: 25000, icon: 'assets/placeholder-yoshi.png',
        effects: [{ type: 'workerMult', target: 'yoshi', value: 2 }],
        unlock: { type: 'workerCount', id: 'yoshi', count: 5 } },

      { id: 'toad_brigade', name: 'Toad Brigade', description: 'Toads produce 2x as many Durians.',
        cost: 300000, icon: 'assets/placeholder-toad.png',
        effects: [{ type: 'workerMult', target: 'toad', value: 2 }],
        unlock: { type: 'workerCount', id: 'toad', count: 5 } },

      { id: 'piantissimo_shoes', name: 'Suspicious Running Shoes', description: 'Il Piantissimo produces 2x as many Durians.',
        cost: 3000000, icon: 'assets/placeholder-piantissimo.png',
        effects: [{ type: 'workerMult', target: 'piantissimo', value: 2 }],
        unlock: { type: 'workerCount', id: 'piantissimo', count: 5 } },

      { id: 'shadow_brush', name: 'Magic Paintbrush', description: 'Shadow Marios produce 2x as many Durians.',
        cost: 30000000, icon: 'assets/placeholder-shadowmario.png',
        effects: [{ type: 'workerMult', target: 'shadowmario', value: 2 }],
        unlock: { type: 'workerCount', id: 'shadowmario', count: 5 } },

      { id: 'farming', name: 'Durian Farming Techniques', description: 'All workers produce +10% Durians.',
        cost: 10000, icon: 'assets/placeholder-shine.png',
        effects: [{ type: 'globalMult', value: 1.10 }],
        unlock: { type: 'totalWorkers', count: 20 } },

      { id: 'irrigation', name: 'Delfino Irrigation', description: 'All workers produce +15% Durians.',
        cost: 400000, icon: 'assets/placeholder-shine.png',
        effects: [{ type: 'globalMult', value: 1.15 }],
        unlock: { type: 'totalWorkers', count: 75 } },

      { id: 'shine_blessing', name: 'Blessing of the Shine Sprites', description: 'All workers produce +25% Durians.',
        cost: 12000000, icon: 'assets/placeholder-shine.png',
        effects: [{ type: 'globalMult', value: 1.25 }],
        unlock: { type: 'totalWorkers', count: 150 } }
    ],

    /* -------------------------------------------------------- achievements */
    achievements: [
      { id: 'first_durian', name: 'First Durian', description: 'Click the Durian for the first time.',
        condition: { type: 'clicks', count: 1 } },
      { id: 'blistered', name: 'Blistered', description: 'Click the Durian 100 times.',
        condition: { type: 'clicks', count: 100 } },
      { id: 'enthusiast', name: 'Durian Enthusiast', description: 'Collect 1,000 Durians.',
        condition: { type: 'totalEarned', amount: 1000 } },
      { id: 'hoarder', name: 'Durian Hoarder', description: 'Collect 1,000,000 Durians.',
        condition: { type: 'totalEarned', amount: 1e6 } },
      { id: 'a_lot_of_fruit', name: "That's a Lot of Fruit", description: 'Collect 1 billion Durians.',
        condition: { type: 'totalEarned', amount: 1e9 } },
      { id: 'smells_like_home', name: 'Smells Like Home', description: 'Collect 1 trillion Durians.',
        condition: { type: 'totalEarned', amount: 1e12 } },
      { id: 'pianta_workforce', name: 'Pianta Workforce', description: 'Hire 10 Piantas.',
        condition: { type: 'workerCount', id: 'pianta', count: 10 } },
      { id: 'pianta_union', name: 'Pianta Union', description: 'Hire 50 Piantas.',
        condition: { type: 'workerCount', id: 'pianta', count: 50 } },
      { id: 'noki_workforce', name: 'Noki Workforce', description: 'Hire 10 Nokis.',
        condition: { type: 'workerCount', id: 'noki', count: 10 } },
      { id: 'yoshi_workforce', name: 'Yoshi Ranch', description: 'Hire 10 Yoshis.',
        condition: { type: 'workerCount', id: 'yoshi', count: 10 } },
      { id: 'staffed_up', name: 'Fully Staffed', description: 'Hire 100 workers in total.',
        condition: { type: 'totalWorkers', count: 100 } },
      { id: 'plaza_economy', name: 'Plaza Economy', description: 'Reach 1,000 Durians per second.',
        condition: { type: 'dps', amount: 1000 } },
      { id: 'shine_get', name: 'Shine Get!', description: 'Buy 10 upgrades.',
        condition: { type: 'upgradesBought', count: 10 } },
      { id: 'manual_labor', name: 'Manual Labor', description: 'Earn 100,000 Durians by clicking alone.',
        condition: { type: 'clickEarned', amount: 1e5 } }
    ]
  };

  DC.CONFIG = CONFIG;
})(window.DC = window.DC || {});
