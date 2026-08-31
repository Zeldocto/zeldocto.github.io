/* =============================================================================
 * content/events.js — random island events.
 * -----------------------------------------------------------------------------
 * One entry per event. The engine in js/events.js picks one by weight whenever
 * the timer fires, checks its `require`, and applies its `effect`.
 *
 * effect types:
 *   gainSeconds  { min, max }        pays out N seconds of your current DPS
 *   gainFlat     { min, max }        pays out a flat amount
 *   losePercent  { min, max }        takes a % of your banked Durians
 *   loseSeconds  { min, max }        takes N seconds of production
 *   buff         { prod, click, seconds, secondsMax }  temporary multiplier.
 *                Both bounds gives a random duration in that range; `seconds`
 *                alone is jittered by about a third either way. Buffs never
 *                multiply each other — the strongest bonus of each kind
 *                applies, and any penalty applies alongside it.
 *
 * `good: false` marks an event as a setback — those are scaled down by
 * eventLoss upgrades, while good ones are scaled up by eventGain.
 * `weight` is relative; higher shows up more often.
 * ========================================================================== */
(function (DC) {
  'use strict';
  var CONFIG = DC.CONFIG;

  CONFIG.events = CONFIG.events.concat([

    /* ------------------------------------------------------- King Boo -- */
    {
      id: 'king_boo',
      name: 'King Boo',
      good: true,
      weight: 18,
      icon: 'assets/placeholder-shine.png',
      title: 'King Boo is feeling generous',
      text: 'He materialises over the orchard, laughs at something you cannot hear, and leaves a pile of fruit behind.',
      effect: { type: 'gainSeconds', min: 60, max: 260 }
    },
    {
      id: 'king_boo_greedy',
      name: 'King Boo',
      good: false,
      weight: 9,
      icon: 'assets/placeholder-shine.png',
      title: 'King Boo is feeling greedy',
      text: 'He materialises over the storehouse, laughs at something you definitely can hear, and takes a cut.',
      effect: { type: 'losePercent', min: 0.05, max: 0.14 }
    },

    /* -------------------------------------------------- Sirena Beach -- */
    {
      id: 'sirena_bill',
      name: 'Sirena Beach Hotel',
      good: false,
      weight: 12,
      icon: 'assets/placeholder-noki.png',
      title: 'The hotel presents your bill',
      text: 'Nobody remembers checking in. The itemisation is immaculate. The manager is not available for questions.',
      effect: { type: 'losePercent', min: 0.06, max: 0.16 },
      require: { type: 'totalEarned', amount: 100000 }
    },
    {
      id: 'sirena_refund',
      name: 'Sirena Beach Hotel',
      good: true,
      weight: 5,
      icon: 'assets/placeholder-noki.png',
      title: 'The hotel issues a refund',
      text: 'An audit found irregularities. Several of the staff were, on inspection, sheets.',
      effect: { type: 'gainSeconds', min: 240, max: 800 },
      require: { type: 'eventTypeSeen', id: 'sirena_bill', count: 1 }
    },

    /* --------------------------------------------------- Shine Sprite -- */
    {
      id: 'shine_sprite',
      name: 'Shine Sprite',
      good: true,
      weight: 14,
      icon: 'assets/placeholder-shine.png',
      title: 'A Shine Sprite drifts overhead',
      text: 'Everything is warmer, brighter, and inexplicably more productive.',
      effect: { type: 'buff', prod: 7, click: 1, seconds: 35, secondsMax: 95, label: 'Shine Blessing ×7' }
    },
    {
      id: 'shine_swarm',
      name: 'Shine Swarm',
      good: true,
      weight: 3,
      icon: 'assets/placeholder-shine.png',
      title: 'A whole swarm of Shine Sprites',
      text: 'The sky fills with them. The orchard has never been this loud.',
      effect: { type: 'buff', prod: 25, click: 5, seconds: 20, secondsMax: 70, label: 'Shine Swarm ×25' },
      require: { type: 'totalEarned', amount: 1e9 }
    },

    /* ---------------------------------------------------------- goop -- */
    {
      id: 'gooey_goop',
      name: 'Goop Outbreak',
      good: false,
      weight: 10,
      icon: 'assets/placeholder-shadowmario.png',
      title: 'Goop everywhere',
      text: 'Somebody has been painting again. Half the crew are cleaning instead of picking.',
      effect: { type: 'buff', prod: 0.5, click: 1, seconds: 25, secondsMax: 70, label: 'Goop ×0.5' },
      require: { type: 'totalEarned', amount: 50000 }
    },

    /* --------------------------------------------------------- Yoshi -- */
    {
      id: 'yoshi_spill',
      name: 'Juice Spill',
      good: true,
      weight: 10,
      icon: 'assets/placeholder-yoshi.png',
      title: 'A Yoshi knocks over the juice',
      text: 'It soaks into everything. Your hands will not stop working.',
      effect: { type: 'buff', prod: 1, click: 15, seconds: 20, secondsMax: 65, label: 'Sticky Hands ×15 clicks' }
    },

    /* --------------------------------------------------- Piantissimo -- */
    {
      id: 'piantissimo_race',
      name: 'Il Piantissimo',
      good: true,
      weight: 11,
      icon: 'assets/placeholder-piantissimo.png',
      title: 'Il Piantissimo challenges you',
      text: 'He wins, obviously. He is so pleased about it that he hands over his entire haul.',
      effect: { type: 'gainSeconds', min: 100, max: 380 }
    },

    /* -------------------------------------------------------- Blooper -- */
    {
      id: 'blooper',
      name: 'Blooper Surfing',
      good: true,
      weight: 8,
      icon: 'assets/placeholder-noki.png',
      title: 'A good run on the bloopers',
      text: 'Nobody fell off. A crate of fruit made it back intact, which is the surprising part.',
      effect: { type: 'gainSeconds', min: 120, max: 600 }
    },

    /* ------------------------------------------------------- Pachinko -- */
    {
      id: 'pachinko',
      name: 'Pinna Park Pachinko',
      good: true,
      weight: 6,
      icon: 'assets/placeholder-toad.png',
      title: 'Somebody hit the jackpot',
      text: 'Nine hours in the machine. One extremely good bounce. The payout is obscene.',
      effect: { type: 'gainSeconds', min: 400, max: 1400 },
      require: { type: 'totalEarned', amount: 1e7 }
    },

    /* --------------------------------------------------- Corona Mountain */
    {
      id: 'corona_belch',
      name: 'Corona Mountain',
      good: true,
      weight: 4,
      icon: 'assets/placeholder-shine.png',
      title: 'The mountain belches',
      text: 'A column of durians, straight up, and then straight down again. Structural damage: acceptable.',
      effect: { type: 'gainSeconds', min: 600, max: 2000 },
      require: { type: 'totalEarned', amount: 1e11 }
    },

    /* ------------------------------------------------------ Toadsworth -- */
    {
      id: 'toadsworth_audit',
      name: 'Toadsworth',
      good: false,
      weight: 7,
      icon: 'assets/placeholder-toad.png',
      title: 'An unscheduled audit',
      text: 'The paperwork was not in order. The paperwork is never in order.',
      effect: { type: 'loseSeconds', min: 400, max: 1400 },
      require: { type: 'totalEarned', amount: 1e6 }
    }
  ]);
})(window.DC = window.DC || {});
