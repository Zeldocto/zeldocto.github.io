/* =============================================================================
 * content/changelog.js — what players see when they tap "What's new".
 * -----------------------------------------------------------------------------
 * EDIT THIS BEFORE YOU PUSH. `version` is the heading shown beside each entry
 * — the house style is the release number then the date, e.g. "2.2  2026-09-08".
 * Keep CONFIG.version in js/config.js matching the newest release number, since
 * that is what appears beside the logo.
 *
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
      version: 'v2.2  2026-09-08',
      title: 'Achievement scaling and the changelog',
      notes: [
        'Production per achievement halved — with hundreds of Shines it was overwhelming everything else and flattening the nonillion stretch',
        'The Grasping Hand now costs 10 billion',
        'The version number sits beside the logo',
        'Settings has a "View changelog" button showing every release; the "What\u2019s new" prompt shows only the newest'
      ]
    },
    {
      version: 'v2.1 2026-09-07',
      title: 'The Far Shore',
      notes: [
        '100 new upgrades for the extreme endgame, from octodecillion upward',
        'Densely packed rather than steeply priced, so the last stretch has something to buy every session instead of long empty gaps',
        'Every step is modest — no single purchase transforms your income',
        'Two new upgrade milestones, and "Bought The Shop" now counts the full catalogue'
      ]
    },
    {
      version: 'v2.0 2026-09-06',
      title: 'Two fixes',
      notes: [
        'Island events now always pay out or take what they say — at very large banks the amount was being announced but never applied',
        'Click upgrades that add a flat amount now really add it. "+50 Durians per click" was doing nothing once your production was large',
        'Click multipliers reworded to say what they multiply'
      ]
    },
    {
      version: 'v1.9 2026-09-05',
      title: 'Airplane fix',
      notes: [
        'Airplanes now appear for everyone. If you had reduced motion turned on in your system settings, they were spawning off the edge of the screen and you never saw one',
        'With reduced motion on, the plane now waits in place instead of flying past.'
      ]
    },
    {
      version: 'v1.8 2026-09-04',
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
      version: 'v1.7 2026-08-30',
      title: 'Content audit',
      notes: [
        'Audited every upgrade and achievement: fixed four achievements whose text did not match their requirement, and three duplicate upgrade names.',
        'Dark mode: crew counts and several other numbers were showing as near-blac.k',
        'Blue Coins and airplanes no longer drag when you try to collect them.'
      ]
    },
    {
      version: 'v1.6 2026-08-30',
      title: 'Corona Mountain and the Pianta Judge',
      notes: [
        'Two new endgame crew: Corona Mountain, then the Pianta Judge',
        '150 new upgrades between them, plus achievements for both',
        'Crew balance pass — every worker now pulls its weight',
        'Synergy upgrades topped up across the roster so no crew is left behind'
      ]
    },
    {
      version: 'v1.5 2026-08-30',
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
