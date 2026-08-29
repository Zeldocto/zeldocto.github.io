/* =============================================================================
 * achievements.js — read helpers for the achievement list.
 * Earning is handled in game.js checkAchievements() so it can run on the tick.
 * Each achievement also gives a small permanent production bonus
 * (CONFIG.achievementBonusPer).
 * ========================================================================== */
(function (DC) {
  'use strict';

  var CONFIG = DC.CONFIG;

  function earned(id) { return !!DC.Game.state.achievements[id]; }

  function earnedCount() { return Object.keys(DC.Game.state.achievements).length; }

  function total() { return CONFIG.achievements.length; }

  function progressText() {
    return earnedCount() + ' / ' + total();
  }

  /** Sorted so unearned achievements sit below earned ones. */
  function list() {
    return CONFIG.achievements.map(function (a) {
      return {
        def: a,
        earned: earned(a.id),
        earnedAt: DC.Game.state.achievements[a.id] || null
      };
    });
  }

  DC.Achievements = {
    earned: earned,
    earnedCount: earnedCount,
    total: total,
    progressText: progressText,
    list: list,
    all: function () { return CONFIG.achievements; }
  };
})(window.DC = window.DC || {});
