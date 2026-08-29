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

    // A save from before a content update can qualify for new achievements the
    // moment it loads. Check now that the UI is listening, so the player
    // actually sees what they just earned.
    DC.Game.checkProgress();

    // Offline earnings need the UI in place to show the popup.
    if (saved) DC.Offline.evaluate(saved.lastSaved);

    // Events resume from the save; a fresh or expired timer gets a new roll.
    if (!DC.Game.state.events.nextAt || DC.Game.state.events.nextAt < Date.now()) {
      DC.IslandEvents.schedule();
    }

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
