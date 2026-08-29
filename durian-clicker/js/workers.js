/* =============================================================================
 * workers.js — cost scaling and purchasing for every worker type.
 * -----------------------------------------------------------------------------
 * Cost of the (n+1)th worker:      baseCost * costMultiplier^n
 * Cost of buying k more from n:    baseCost * r^n * (r^k - 1) / (r - 1)
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var Game = DC.Game;
  var CONFIG = DC.CONFIG;

  var MAX_BULK = 100000;   // safety cap on a single "max" purchase

  function count(id) { return DC.Game.state.workers[id] || 0; }

  /** Price of the next single worker. */
  function costOf(def, owned) {
    if (owned === undefined) owned = count(def.id);
    return N.ceil(N.mul(N.big(def.baseCost), N.pow(def.costMultiplier, owned)));
  }

  /** Price of buying `k` in one go. */
  function bulkCost(def, k, owned) {
    if (owned === undefined) owned = count(def.id);
    if (k <= 0) return N.ZERO;
    var r = def.costMultiplier;
    if (r === 1) return N.mul(N.big(def.baseCost), k);
    var first = N.mul(N.big(def.baseCost), N.pow(r, owned));   // exact, unrounded
    var growth = N.sub(N.pow(r, k), 1);                        // r^k - 1
    return N.ceil(N.div(N.mul(first, growth), r - 1));
  }

  /** How many can be bought right now with the current balance. */
  function maxAffordable(def, owned, funds) {
    if (owned === undefined) owned = count(def.id);
    funds = funds || DC.Game.state.durians;
    var r = def.costMultiplier;
    var first = costOf(def, owned);
    if (N.lt(funds, first)) return 0;
    if (r === 1) return Math.min(MAX_BULK, Math.floor(N.toNumber(N.div(funds, first))));

    // k = log_r( 1 + funds*(r-1)/first )
    var x = N.mul(N.div(funds, first), r - 1);
    var logX = N.toNumber(x) < 1e15
      ? Math.log10(1 + N.toNumber(x))
      : N.log10(x);
    var k = Math.floor(logX / Math.log10(r));
    if (k < 0) k = 0;
    // Trim in case floating point over-estimated by one.
    while (k > 0 && N.lt(funds, bulkCost(def, k, owned))) k--;
    return Math.min(MAX_BULK, k);
  }

  /**
   * Buy `amount` workers ('max' allowed). Returns the number actually bought.
   */
  function buy(id, amount) {
    var def = Game.workerDef(id);
    if (!def) return 0;
    var s = DC.Game.state;
    if (!s.unlocked[id]) return 0;

    var owned = count(id);
    var k = amount === 'max' ? maxAffordable(def, owned) : Math.max(1, amount | 0);
    if (k <= 0) return 0;

    var price = bulkCost(def, k, owned);
    if (!DC.Game.spendDurians(price)) return 0;

    s.workers[id] = owned + k;
    DC.Game.recalc();
    DC.Game.checkProgress();
    DC.Events.emit('buyWorker', { def: def, amount: k, cost: price, total: s.workers[id] });
    return k;
  }

  /** Everything the UI needs to draw one shop row. */
  function view(def, buyAmount) {
    var owned = count(def.id);
    var k = buyAmount === 'max' ? Math.max(1, maxAffordable(def, owned)) : buyAmount;
    var price = bulkCost(def, k, owned);
    var affordableCount = maxAffordable(def, owned);
    return {
      def: def,
      owned: owned,
      amount: k,
      cost: price,
      canAfford: buyAmount === 'max' ? affordableCount > 0 : N.gte(DC.Game.state.durians, price),
      each: DC.Game.derived.perWorker[def.id] || N.ZERO,
      total: DC.Game.derived.workerDps[def.id] || N.ZERO,
      unlocked: !!DC.Game.state.unlocked[def.id]
    };
  }

  DC.Workers = {
    count: count,
    costOf: costOf,
    bulkCost: bulkCost,
    maxAffordable: maxAffordable,
    buy: buy,
    view: view,
    all: function () { return CONFIG.workers; }
  };
})(window.DC = window.DC || {});
