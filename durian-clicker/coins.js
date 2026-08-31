/* =============================================================================
 * coins.js — Blue Coins: the rare collectable, and the airplane that drops one.
 * -----------------------------------------------------------------------------
 * Cookie Clicker's golden cookie, reworked. On a random timer a Blue Coin
 * appears somewhere on screen (or an airplane flies past carrying one). Click
 * it before it leaves and it goes into your Blue Coin count, which is spent in
 * the Casino.
 *
 * Spawn positions and timers live here; the DOM element is built by ui.js via
 * the 'coinSpawn' event, so this file stays free of layout concerns.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var CONFIG = DC.CONFIG;
  var active = null;        // { kind, reward, expiresAt }

  function cfg() { return CONFIG.blueCoins; }

  function rollInterval() {
    var c = cfg();
    return c.minIntervalSeconds + Math.random() * (c.maxIntervalSeconds - c.minIntervalSeconds);
  }

  function schedule(seconds) {
    DC.Game.state.coins.nextAt = Date.now() +
      (seconds !== undefined ? seconds : rollInterval()) * 1000;
  }

  function spawn(forceKind) {
    if (active) return null;
    var c = cfg();
    var kind = forceKind || (Math.random() < c.planeChance ? 'plane' : 'coin');
    var lucky = Math.random() < c.luckyChance;
    var reward = lucky ? c.luckyReward
      : Math.round(c.rewardMin + Math.random() * (c.rewardMax - c.rewardMin));

    active = {
      kind: kind,
      reward: reward,
      lucky: lucky,
      // Keep it away from the very edges so it never lands under a panel.
      x: 10 + Math.random() * 60,        // percent of viewport width
      y: 18 + Math.random() * 55,
      fromTop: 12 + Math.random() * 45,  // planes fly at this height
      expiresAt: Date.now() + (kind === 'plane' ? c.planeFlightSeconds : c.lifetimeSeconds) * 1000
    };

    DC.Game.state.coins.spawned = (DC.Game.state.coins.spawned || 0) + 1;
    DC.Events.emit('coinSpawn', active);
    return active;
  }

  /** Player caught it. Returns the reward, or 0 if there was nothing there. */
  function collect() {
    if (!active) return 0;
    var reward = active.reward;
    var wasLucky = active.lucky;
    active = null;

    var s = DC.Game.state;
    s.blueCoins = (s.blueCoins || 0) + reward;
    s.coins.collected = (s.coins.collected || 0) + reward;

    schedule();
    DC.Game.checkProgress();
    DC.Events.emit('coinCollected', { reward: reward, lucky: wasLucky, total: s.blueCoins });
    return reward;
  }

  function expire() {
    if (!active) return;
    active = null;
    schedule();
    DC.Events.emit('coinExpired');
  }

  function update() {
    if (!cfg().enabled) return;
    var s = DC.Game.state;

    if (active) {
      if (Date.now() >= active.expiresAt) expire();
      return;
    }
    if (!s.coins.nextAt) { schedule(); return; }
    if (Date.now() >= s.coins.nextAt) spawn();
  }

  /* --------------------------------------------------------------- spending */

  function canAfford(n) { return (DC.Game.state.blueCoins || 0) >= n; }

  function spend(n) {
    if (!canAfford(n)) return false;
    DC.Game.state.blueCoins -= n;
    DC.Events.emit('blueCoinsChanged', DC.Game.state.blueCoins);
    return true;
  }

  function award(n) {
    DC.Game.state.blueCoins = (DC.Game.state.blueCoins || 0) + n;
    DC.Game.state.coins.collected = (DC.Game.state.coins.collected || 0) + n;
    DC.Game.checkProgress();
    DC.Events.emit('blueCoinsChanged', DC.Game.state.blueCoins);
  }

  function count() { return DC.Game.state.blueCoins || 0; }
  function getActive() { return active; }

  DC.Coins = {
    update: update,
    spawn: spawn,
    collect: collect,
    expire: expire,
    schedule: schedule,
    canAfford: canAfford,
    spend: spend,
    award: award,
    count: count,
    getActive: getActive
  };
})(window.DC = window.DC || {});
