/* =============================================================================
 * store.js — the Tanooki Store. Buys and equips Durian skins.
 * -----------------------------------------------------------------------------
 * Skins are CSS (see js/content/skins.js), so they work with whatever art is in
 * CONFIG.assets.durian. Owning and equipping are separate: you keep everything
 * you buy and can switch freely from the home screen.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  function all() { return CONFIG.skins; }

  function def(id) {
    var list = all();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function owned(id) {
    return id === 'classic' || !!DC.Game.state.skins.owned[id];
  }

  function activeId() { return DC.Game.state.skins.active || 'classic'; }
  function active() { return def(activeId()); }

  function canBuy(id) {
    var d = def(id);
    if (!d || owned(id)) return false;
    return N.gte(DC.Game.state.durians, N.big(d.cost));
  }

  function buy(id) {
    var d = def(id);
    if (!d || owned(id)) return false;
    if (!DC.Game.spendDurians(N.big(d.cost))) return false;
    DC.Game.state.skins.owned[id] = true;
    DC.Game.checkProgress();
    DC.Events.emit('skinBought', d);
    equip(id);
    return true;
  }

  function equip(id) {
    if (!owned(id)) return false;
    DC.Game.state.skins.active = id;
    DC.Events.emit('skinChanged', def(id));
    return true;
  }

  function ownedCount() {
    return all().filter(function (s) { return owned(s.id); }).length;
  }

  /** Grouped by tier, in catalogue order, for the store list. */
  function byTier() {
    var order = [], groups = {};
    all().forEach(function (s) {
      var t = s.tier || 'Skins';
      if (!groups[t]) { groups[t] = []; order.push(t); }
      groups[t].push(s);
    });
    return order.map(function (t) { return { tier: t, skins: groups[t] }; });
  }

  DC.Store = {
    all: all,
    def: def,
    owned: owned,
    ownedCount: ownedCount,
    activeId: activeId,
    active: active,
    canBuy: canBuy,
    buy: buy,
    equip: equip,
    byTier: byTier
  };
})(window.DC = window.DC || {});
