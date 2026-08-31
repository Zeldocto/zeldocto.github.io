/* =============================================================================
 * offline.js — works out what the workers collected while the game was closed.
 * ui.js listens for the 'offlineEarnings' event and shows the popup.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var pending = null;   // { seconds, cappedSeconds, amount }

  /**
   * Call once after loading a save. `savedAt` is the save's lastSaved stamp.
   * Returns the pending reward, or null when there's nothing to give.
   */
  function evaluate(savedAt) {
    if (!CONFIG.offline.enabled || !savedAt) return null;

    var seconds = (Date.now() - savedAt) / 1000;
    if (seconds < CONFIG.offline.minSeconds) return null;

    var maxSeconds = DC.Game.derived.offlineMaxSeconds || CONFIG.offline.maxSeconds;
    var efficiency = DC.Game.derived.offlineEfficiency !== undefined
      ? DC.Game.derived.offlineEfficiency : CONFIG.offline.efficiency;
    var capped = Math.min(seconds, maxSeconds);
    var amount = N.mul(DC.Game.derived.dps, capped * efficiency);
    if (amount.m <= 0) return null;

    pending = {
      seconds: seconds,
      cappedSeconds: capped,
      wasCapped: seconds > maxSeconds,
      maxSeconds: maxSeconds,
      amount: amount
    };
    DC.Events.emit('offlineEarnings', pending);
    return pending;
  }

  /** Player pressed "Collect". */
  function collect() {
    if (!pending) return null;
    var reward = pending;
    pending = null;
    DC.Game.addDurians(reward.amount, 'worker');
    DC.Game.state.offlineEarned = N.add(DC.Game.state.offlineEarned || N.ZERO, reward.amount);
    DC.Game.checkProgress();
    DC.Events.emit('offlineCollected', reward);
    return reward;
  }

  function getPending() { return pending; }

  /** Debug helper: pretend the game was closed for `seconds`. */
  function simulate(seconds) {
    return evaluate(Date.now() - seconds * 1000);
  }

  DC.Offline = {
    evaluate: evaluate,
    collect: collect,
    getPending: getPending,
    simulate: simulate
  };
})(window.DC = window.DC || {});
