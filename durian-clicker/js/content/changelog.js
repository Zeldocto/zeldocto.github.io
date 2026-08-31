/* =============================================================================
 * content/changelog.js — what players see when they tap "What's new".
 * -----------------------------------------------------------------------------
 * EDIT THIS BEFORE YOU PUSH. Newest release at the top; the topmost `version`
 * is what the game compares against to decide whether to show the prompt, so
 * anyone who has already read this entry will not be shown it again.
 *
 * Keep the bullets short. If a change closes an exploit, just write "Bug fix"
 * or something equally bland — a changelog that names the exploit is a how-to
 * guide for anyone who missed it.
 *
 * `title` is optional and shows above the bullets.
 * ========================================================================== */
(function (DC) {
  'use strict';

  DC.CONFIG.changelog = [
    {
      version: 'v19 2026-09-05',
      title: 'Airplane fix',
      notes: [
        'Airplanes now appear for everyone. If you had reduced motion turned on in your system settings, they were spawning off the edge of the screen and you never saw one',
        'With reduced motion on, the plane now waits in place instead of flying past.'
      ]
    },
    {
      version: 'v18 2026-09-04',
      title: 'Pacing, stats and a lot of new flavour',
      notes: [
        'The biggest all-worker multipliers are split into sequences — no more quadrupling your income in one purchase',
        '44 new upgrades from those splits, easing the climb through nonillion',
        'New achievements: octodecillion and friends, crew sizes to 100,000, and upgrade milestones to 850',
        'Stats now show your current, average and peak clicks per second',
        'Upgrade flavour text rewritten with far more variety, and more Isle Delfino',
        'Dark mode: the header bar is no longer cream'
      ]
    },
    {
      version: 'v17 2026-08-30',
      title: 'Content audit',
      notes: [
        'Audited every upgrade and achievement: fixed four achievements whose text did not match their requirement, and three duplicate upgrade names.',
        'Dark mode: crew counts and several other numbers were showing as near-blac.k',
        'Blue Coins and airplanes no longer drag when you try to collect them.'
      ]
    },
    {
      version: 'v16 2026-08-30',
      title: 'Corona Mountain and the Pianta Judge',
      notes: [
        'Two new endgame crew: Corona Mountain, then the Pianta Judge',
        '150 new upgrades between them, plus achievements for both',
        'Crew balance pass — every worker now pulls its weight',
        'Synergy upgrades topped up across the roster so no crew is left behind'
      ]
    },
    {
      version: 'v15 2026-08-30',
      title: 'Clicking, events and a pile of fixes',
      notes: [
        'Island events rebalanced.',
        'Event upgrades no longer stack out of control.',
        'Reset save and Import save now work',
        'The slots no longer show your winnings before the reels stop',
        'Numbers drop the pointless decimals — 18M instead of 18.00M',
        'Menus never use full-length numbers, so names stay readable',
        'Buttons no longer flicker when you hover their bottom edge',
        'Other bug fixes'
      ]
    }
  ];
})(window.DC = window.DC || {});
