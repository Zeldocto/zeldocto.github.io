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
 * `title` is optional and shows above the bullets.
 * ========================================================================== */
(function (DC) {
  'use strict';

  DC.CONFIG.changelog = [
    {
      version: '2.7.1  2026-09-04',
      title: 'Golden Shines',
      notes: [
        'New at the bottom of Upgrades: trade your run for a permanent Golden Shine!!!',
        'Six to collect, each worth +10% Durians per click and +5% to all production, forever \u2014 up to +60% and +30%.',
        'This is known as a prestige. Prestiging resets your Durians, crew, upgrades and achievements (except the ones that keep track of playtime & prestige). It keeps your skins, backgrounds, Blue Coins, time played and your place on the leaderboard.',
        'Four new achievements for collecting them.',
        'Every leaderboard row now shows six dots beside the name \u2014 one lit for each Golden Shine that player has earned',
        'Hover the dots to see their prestige level'
      ]
    },
    {
      version: '2.6.2',
      title: 'Exponent display fix',
      notes: [
        'Large numbers now show their exponent consistently \u2014 some digits were rendering in a different font to the rest'
      ]
    },
    {
      version: '2.6',
      title: 'Leaderboard is open again',
      notes: [
        'Saves are no longer blocked from the leaderboard — the check was catching honest players, which is not a trade worth making',
        'If you were affected, your next submission goes through normally with no action needed'
      ]
    },
    {
      version: '2.5.4',
      title: 'Bug fixes',
      notes: [
        'Very large totals are handled correctly everywhere',
        'Bug fixes'
      ]
    },
    {
      version: '2.5.3',
      title: 'Bug fixes',
      notes: [
        'Autoclickers are unaffected, as always',
        'Bug fixes'
      ]
    },
    {
      version: '2.5.2',
      title: 'Bug fixes',
      notes: [
        'Autoclickers are still welcome and still work exactly as before',
        'Bug fixes'
      ]
    },
    {
      version: '2.5.1',
      title: 'Store layout fix',
      notes: [
        'Background previews no longer overlap the names and descriptions in the store'
      ]
    },
    {
      version: '2.5',
      title: 'Backgrounds',
      notes: [
        'The Tanooki Store now sells backgrounds as well as skins',
        'Five to buy, plus Endgame — which is earned by playing for a week rather than bought',
        'Buy once, switch between them whenever you like'
      ]
    },
    {
      version: '2.4',
      title: 'Offline production',
      notes: [
        'Your crew now works at 10% of normal while you are away, instead of full rate',
        'The nine offline upgrades raise that to a maximum of 90%, so being online is always worth more',
        'Stats shows your current offline rate and how long being away counts for'
      ]
    },
    {
      version: '2.3',
      title: 'Leaderboard integrity',
      notes: [
        'Saves are now signed, and edited saves are refused by the leaderboard',
        'A modified save still plays normally — it is just not eligible for ranking',
        'Autoclickers are unaffected and stay eligible, as before',
        'Bug fixes'
      ]
    },
    {
      version: '2.2',
      title: 'Achievement scaling and the changelog',
      notes: [
        'Production per achievement halved — with hundreds of Shines it was overwhelming everything else and flattening the nonillion stretch',
        'The Grasping Hand now costs 10 billion',
        'The version number sits beside the logo',
        'Settings has a "View changelog" button showing every release; the "What\u2019s new" prompt shows only the newest'
      ]
    },
    {
      version: '2026-09-01',
      title: 'The Far Shore',
      notes: [
        '100 new upgrades for the extreme endgame, from octodecillion upward',
        'Densely packed rather than steeply priced, so the last stretch has something to buy every session instead of long empty gaps',
        'Every step is modest — no single purchase transforms your income',
        'Two new upgrade milestones, and "Bought The Shop" now counts the full catalogue'
      ]
    },
    {
      version: '2026-09-01',
      title: 'Two fixes',
      notes: [
        'Island events now always pay out or take what they say — at very large banks the amount was being announced but never applied',
        'Click upgrades that add a flat amount now really add it. "+50 Durians per click" was doing nothing once your production was large',
        'Click multipliers reworded to say what they multiply'
      ]
    },
    {
      version: 'v19',
      title: 'Airplane fix',
      notes: [
        'Airplanes now appear for everyone. If you had reduced motion turned on in your system settings, they were spawning off the edge of the screen and you never saw one',
        'With reduced motion on, the plane now waits in place instead of flying past.'
      ]
    },
    {
      version: 'v18',
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
      version: 'v17',
      title: 'Content audit',
      notes: [
        'Audited every upgrade and achievement: fixed four achievements whose text did not match their requirement, and three duplicate upgrade names.',
        'Dark mode: crew counts and several other numbers were showing as near-blac.k',
        'Blue Coins and airplanes no longer drag when you try to collect them.'
      ]
    },
    {
      version: 'v16',
      title: 'Corona Mountain and the Pianta Judge',
      notes: [
        'Two new endgame crew: Corona Mountain, then the Pianta Judge',
        '150 new upgrades between them, plus achievements for both',
        'Crew balance pass — every worker now pulls its weight',
        'Synergy upgrades topped up across the roster so no crew is left behind'
      ]
    },
    {
      version: 'v15',
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
