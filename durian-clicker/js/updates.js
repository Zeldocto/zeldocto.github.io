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
  var RELOAD_KEY = 'durianClicker.reloadedFor';

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
          // Save first: the page is about to go away.
          DC.Save.save(true);

          // Loop guard. If we already reloaded for this build and the browser
          // is STILL serving the old files (a stale CDN edge, say), reloading
          // again would trap the player in a refresh loop. Fall back to the
          // manual banner instead.
          var alreadyTried = false;
          try {
            alreadyTried = sessionStorage.getItem(RELOAD_KEY) === data.build;
            sessionStorage.setItem(RELOAD_KEY, data.build);
          } catch (err) { alreadyTried = true; }

          // Forced reloads are opt-in PER DEPLOY: version.json has to ask for
          // it. Ordinary updates just show the banner and let the player
          // refresh when they are ready.
          var auto = data.force === true && cfg().allowAutoReload !== false && !alreadyTried;
          DC.Events.emit('updateAvailable', {
            build: data.build,
            notes: data.notes,
            forced: data.force === true,
            autoReload: auto,
            seconds: cfg().countdownSeconds || 10,
            loopGuarded: alreadyTried
          });
          stop();
        }
      })
      .catch(function () {
        /* Offline or the file is missing — not worth bothering the player. */
      });
  }

  function start() {
    confirmUpdated();
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

  /**
   * Saves and reloads. Called by the countdown, or straight away when the
   * player presses the button.
   */
  function reloadNow() {
    try { DC.Save.save(true); } catch (err) { /* save already attempted */ }
    // A cache-busting query on the page itself, so the HTML (and therefore the
    // versioned script URLs inside it) is refetched rather than served stale.
    try {
      var url = location.pathname + '?u=' + Date.now() + location.hash;
      location.replace(url);
    } catch (err) {
      location.reload();
    }
  }

  /** Clears the loop guard — used after a successful load of the new build. */
  function confirmUpdated() {
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === CONFIG.buildId) {
        sessionStorage.removeItem(RELOAD_KEY);
      }
    } catch (err) { /* not important */ }
  }

  DC.Updates = {
    start: start, stop: stop, check: check,
    reloadNow: reloadNow, confirmUpdated: confirmUpdated
  };
})(window.DC = window.DC || {});
