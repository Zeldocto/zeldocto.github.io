/* =============================================================================
 * upgrades.js — buying upgrades. The effects themselves are applied in
 * game.js recalc(), so an upgrade is pure data: cost, unlock, effects.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  function owned(id) { return !!DC.Game.state.upgrades[id]; }

  function costOf(def) {
    if (!def.repeatable) return N.big(def.cost);
    var stacks = DC.Game.state.upgrades[def.id] || 0;
    return N.mul(N.big(def.cost), N.pow(def.costMultiplier || 1.5, stacks));
  }

  function canBuy(def) {
    var s = DC.Game.state;
    if (!s.unlocked[def.id]) return false;
    if (owned(def.id) && !def.repeatable) return false;
    return N.gte(s.durians, costOf(def));
  }

  function buy(id) {
    var def = DC.Game.upgradeDef(id);
    if (!def || !canBuy(def)) return false;
    var price = costOf(def);
    if (!DC.Game.spendDurians(price)) return false;

    var s = DC.Game.state;
    s.upgrades[id] = def.repeatable ? (s.upgrades[id] || 0) + 1 : true;
    DC.Game.recalc();
    DC.Game.checkProgress();
    DC.Events.emit('buyUpgrade', { def: def, cost: price });
    return true;
  }

  function pct(v) { return String(Math.round(v * 1000) / 10); }
  function targetLabel(t) {
    return t === 'all' ? 'All workers' : DC.Game.workerName(t, 2);
  }

  /** Plain-language summary of what an upgrade does, built from its effects. */
  function describeEffects(def) {
    return (def.effects || []).map(function (fx) {
      switch (fx.type) {
        case 'clickAdd':     return '+' + N.format(fx.value) + ' per click';
        case 'clickMult':    return '×' + fx.value + ' Durians per click';
        case 'clickFromDps': return '+' + (fx.value * 100).toFixed(0) + '% of your DPS per click';
        case 'globalMult':   return '+' + Math.round((fx.value - 1) * 100) + '% to all workers';
        case 'workerMult':   return '×' + fx.value + ' ' + DC.Game.workerName(fx.target, 2) + ' output';
        case 'clickFromWorkers': return '+' + N.format(fx.value) + ' per click, per worker';
        case 'workerScaling':
          return targetLabel(fx.target) + ' +' + pct(fx.value) + '% per ' + fx.per + ' owned';
        case 'workerSynergy':
          return targetLabel(fx.target) + ' +' + pct(fx.value) + '% per ' +
                 (fx.source === 'all' ? 'worker' : DC.Game.workerName(fx.source, 1));
        case 'achievementBonus': return '+' + pct(fx.value) + '% per achievement';
        case 'eventChance':  return 'Island events ×' + fx.value + ' as often';
        case 'eventGain':    return 'Good events pay ×' + fx.value;
        case 'eventLoss':    return 'Bad events cost ×' + fx.value;
        case 'buffDuration': return 'Buffs last ×' + fx.value + ' longer';
        case 'offlineEfficiency': return '+' + pct(fx.value) + '% offline production';
        case 'offlineHours': return '+' + fx.value + 'h offline cap';
        default:             return '';
      }
    }).filter(Boolean).join(' · ');
  }

  function view(def) {
    return {
      def: def,
      cost: costOf(def),
      owned: owned(def.id),
      canAfford: N.gte(DC.Game.state.durians, costOf(def)),
      unlocked: !!DC.Game.state.unlocked[def.id],
      effectText: describeEffects(def)
    };
  }

  DC.Upgrades = {
    owned: owned,
    costOf: costOf,
    canBuy: canBuy,
    buy: buy,
    view: view,
    describeEffects: describeEffects,
    all: function () { return CONFIG.upgrades; }
  };
})(window.DC = window.DC || {});
