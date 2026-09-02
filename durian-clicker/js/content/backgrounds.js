/* =============================================================================
 * content/backgrounds.js — the views you can put behind the island.
 * -----------------------------------------------------------------------------
 * EDIT THIS to add your own. Each entry needs:
 *
 *   id           unique key, also the save key — never rename after release
 *   name         shown in the store
 *   description  one line of flavour
 *   cost         Durians; use null for one that is earned rather than bought
 *   image        path to the art, relative to index.html
 *   tier         grouping label in the store
 *
 * For an EARNED background, set `cost: null` and add:
 *
 *   reward           true
 *   requires         a condition, same shape as an achievement's
 *   requirementText  the short "how to get it" line shown in the store
 *
 * Those cannot be bought at any price; Store.checkBackgroundRewards grants
 * them the moment the condition is met.
 *
 * The default view is always owned, always free, and must stay first.
 *
 * Art: anything wide works. The placeholders are 960x540 and the scene is
 * drawn with `background-size: cover`, so the middle is what people see —
 * keep anything important away from the edges.
 * ========================================================================== */
(function (DC) {
  'use strict';

  DC.CONFIG.backgrounds = [

    { id: 'default', name: 'Isle Delfino', tier: 'Standard', cost: 0,
      description: 'The view from the grove. Where it all started.',
      image: 'assets/placeholder-background.png' },

    { id: 'toybox', name: 'Toybox Dreams', tier: 'Views', cost: 250000,
      description: 'Everything is a slightly wrong size and nobody minds.',
      image: 'assets/bg-toybox.png' },

    { id: 'mariovr', name: 'Mario VR', tier: 'Views', cost: 40000000,
      description: 'The grid goes on forever. The durians render in last.',
      image: 'assets/bg-mariovr.png' },

    { id: 'yoshi', name: "Yoshi's Isle", tier: 'Views', cost: 9000000000,
      description: 'Soft hills, warm light, and something enormous asleep nearby.',
      image: 'assets/bg-yoshi.png' },

    { id: 'pinna', name: 'Pinna Dream', tier: 'Views', cost: 2000000000000,
      description: 'The rides never stop and the queue is never long.',
      image: 'assets/bg-pinna.png' },

    { id: 'sirena', name: 'Sirena Sunset', tier: 'Views', cost: 800000000000000,
      description: 'The last of the light on the water, and the hotel filling up.',
      image: 'assets/bg-sirena-sunset.png' },

    /* Earned, not sold. A week of play, counted across every session. */
    { id: 'endgame', name: 'Endgame', tier: 'Earned', cost: null,
      description: 'You have been here a while. It looks different now.',
      image: 'assets/bg-endgame.png',
      reward: true,
      requires: { type: 'playTime', seconds: 604800 },
      requirementText: 'Play for 7 days' }

  ];
})(window.DC = window.DC || {});
