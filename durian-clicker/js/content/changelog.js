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
      version: '2026-09-02',
      title: 'Corona Mountain and the Pianta Judge',
      notes: [
        'Two new endgame crew: Corona Mountain, then the Pianta Judge',
        '150 new upgrades between them, plus achievements for both',
        'Crew balance pass — every worker now pulls its weight',
        'Synergy upgrades topped up across the roster so no crew is left behind'
      ]
    },
    {
      version: '2026-09-01',
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
