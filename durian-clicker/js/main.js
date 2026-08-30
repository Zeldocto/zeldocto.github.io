/* =============================================================================
 * main.js — boots the game in the right order.
 * -----------------------------------------------------------------------------
 * Boot is defensive on purpose. A partial deploy (some new JS files uploaded,
 * others not) used to throw during init and leave the whole page blank — no
 * crew list, no shop, no counters, with the cause buried in the console. Now a
 * missing module is detected up front and reported on screen, and any
 * unexpected error still leaves a playable game behind.
 * ========================================================================== */
(function (DC) {
  'use strict';

  // Modules the game cannot run without.
  var REQUIRED = ['CONFIG', 'N', 'Game', 'Workers', 'Upgrades', 'Achievements',
                  'Save', 'Offline', 'Audio', 'UI'];
  // Modules that add features. If one is absent the game still plays.
  var OPTIONAL = ['IslandEvents', 'Coins', 'Casino', 'Store', 'Leaderboard',
                  'Updates', 'Changelog', 'Debug'];

  var FILE_FOR = {
    CONFIG: 'js/config.js', N: 'js/numbers.js', Game: 'js/game.js',
    Workers: 'js/workers.js', Upgrades: 'js/upgrades.js',
    Achievements: 'js/achievements.js', Save: 'js/save.js',
    Offline: 'js/offline.js', Audio: 'js/audio.js', UI: 'js/ui.js',
    IslandEvents: 'js/events.js', Coins: 'js/coins.js', Casino: 'js/casino.js',
    Store: 'js/store.js', Leaderboard: 'js/leaderboard.js',
    Updates: 'js/updates.js', Changelog: 'js/changelog.js', Debug: 'js/debug.js'
  };

  function missing(list) {
    return list.filter(function (name) { return !DC[name]; });
  }

  /** Last resort: tell the player which file did not load, on the page. */
  function showBootError(files, detail) {
    try {
      var box = document.createElement('div');
      box.className = 'boot-error';
      box.innerHTML =
        '<h2>The game could not start</h2>' +
        (files.length
          ? '<p>These files did not load:</p><ul>' +
            files.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' +
            '<p>They are probably missing from the server, or the upload was ' +
            'incomplete. Re-upload them and refresh.</p>'
          : '<p>An unexpected error occurred during start-up.</p>') +
        (detail ? '<pre>' + String(detail).slice(0, 400) + '</pre>' : '') +
        '<p class="boot-error-note">Your saved progress has not been touched.</p>';
      document.body.appendChild(box);
    } catch (err) {
      /* nothing left to do */
    }
    console.error('[Durian Clicker] boot failed.', files, detail);
  }

  function boot() {
    var absent = missing(REQUIRED);
    if (absent.length) {
      showBootError(absent.map(function (n) { return FILE_FOR[n] || n; }));
      return;
    }

    var absentOptional = missing(OPTIONAL);
    if (absentOptional.length) {
      console.warn('[Durian Clicker] optional modules not loaded: ' +
        absentOptional.map(function (n) { return FILE_FOR[n] || n; }).join(', ') +
        ' — those features are disabled for this session.');
    }

    DC.Audio.init();

    var saved = DC.Save.load();
    if (!saved) {
      DC.Game.recalc();
      DC.Game.checkUnlocks();
    }
    DC.Audio.syncFromState();

    DC.UI.init();
    if (DC.Debug) DC.Debug.init();

    // A save from before a content update can qualify for new achievements the
    // moment it loads. Check now that the UI is listening, so the player
    // actually sees what they just earned.
    DC.Game.checkProgress();

    if (saved) DC.Offline.evaluate(saved.lastSaved);

    // Events resume from the save; a fresh or expired timer gets a new roll.
    if (DC.IslandEvents &&
        (!DC.Game.state.events.nextAt || DC.Game.state.events.nextAt < Date.now())) {
      DC.IslandEvents.schedule();
    }

    DC.Save.startAutosave();
    if (DC.Updates) DC.Updates.start();
    // A brand-new save has read nothing, but should not be greeted with a
    // changelog for a version it never played.
    if (DC.Changelog) {
      if (!saved) DC.Changelog.markRead();
      else DC.Changelog.check();
    }
    if (DC.Coins &&
        (!DC.Game.state.coins.nextAt || DC.Game.state.coins.nextAt < Date.now())) {
      DC.Coins.schedule();
    }
    if (DC.Leaderboard) DC.Leaderboard.startAutoSubmit();

    DC.Audio.unlockOnFirstGesture();
    DC.Game.start();
  }

  function safeBoot() {
    try {
      boot();
    } catch (err) {
      // Something threw despite every module being present. Report it rather
      // than leaving a blank screen, and try to keep the game running.
      showBootError(missing(REQUIRED).map(function (n) { return FILE_FOR[n] || n; }), err && err.message);
      try { DC.Game.start(); } catch (e2) { /* nothing more to salvage */ }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeBoot);
  } else {
    safeBoot();
  }
})(window.DC = window.DC || {});
