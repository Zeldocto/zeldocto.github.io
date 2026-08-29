/* =============================================================================
 * updates.js — tells an actively-playing player that a new build has shipped.
 * -----------------------------------------------------------------------------
 * The browser keeps serving the cached JS for as long as a tab stays open, so
 * someone playing during a deploy carries on running the old code and never
 * finds out. This polls a tiny version.json (cache-busted) and, when the build
 * id changes, saves their progress and shows a refresh prompt.
 *
 * On deploy: bump CONFIG.buildId and the "build" field in version.json to the
 * same value. They are compared against each other.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var CONFIG = DC.CONFIG;
  var timer = null;
  var notified = false;

  function cfg() { return CONFIG.updateCheck || {}; }

  function check() {
    if (notified || !cfg().enabled) return;
    // Cache-bust, or we'd just get the same stale file the tab already has.
    var url = cfg().url + (cfg().url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();

    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.build) return;
        if (data.build !== CONFIG.buildId) {
          notified = true;
          // Save first: they may refresh the instant they read the prompt.
          DC.Save.save(true);
          DC.Events.emit('updateAvailable', data);
          stop();
        }
      })
      .catch(function () {
        /* Offline or the file is missing — not worth bothering the player. */
      });
  }

  function start() {
    if (!cfg().enabled) return;
    stop();
    timer = setInterval(check, (cfg().intervalSeconds || 300) * 1000);
    // Also check when they come back to the tab, which is when a deploy is
    // most likely to have happened while they were away.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') check();
    });
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  DC.Updates = { start: start, stop: stop, check: check };
})(window.DC = window.DC || {});
