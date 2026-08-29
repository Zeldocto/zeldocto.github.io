/* =============================================================================
 * main.js — boots the game in the right order.
 * ========================================================================== */
(function (DC) {
  'use strict';

  function boot() {
    DC.Audio.init();

    // Load, or start a fresh island.
    var saved = DC.Save.load();
    if (!saved) {
      DC.Game.recalc();
      DC.Game.checkUnlocks();
    }
    DC.Audio.syncFromState();

    DC.UI.init();
    DC.Debug.init();

    // Offline earnings need the UI in place to show the popup.
    if (saved) DC.Offline.evaluate(saved.lastSaved);

    DC.Save.startAutosave();
    DC.Leaderboard.startAutoSubmit();
    DC.Audio.unlockOnFirstGesture();
    DC.Game.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.DC = window.DC || {});
