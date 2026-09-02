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

  /** Reward skins are earned by meeting a condition, never bought. */
  function isReward(id) { return !!def(id).reward; }

  /**
   * Grants any reward skin whose condition is now met. Called from
   * Game.checkProgress, so it keeps up without polling.
   */
  function checkRewards() {
    var granted = [];
    all().forEach(function (skin) {
      if (!skin.reward || owned(skin.id)) return;
      if (skin.requires && DC.Game.meetsRequirement(skin.requires)) {
        DC.Game.state.skins.owned[skin.id] = true;
        granted.push(skin);
      }
    });
    if (granted.length) DC.Events.emit('skinUnlocked', granted);
    return granted;
  }

  function activeId() { return DC.Game.state.skins.active || 'classic'; }
  function active() { return def(activeId()); }

  function canBuy(id) {
    var d = def(id);
    if (!d || owned(id)) return false;
    if (d.reward) return false;              // earned, not for sale
    return N.gte(DC.Game.state.durians, N.big(d.cost));
  }

  function buy(id) {
    var d = def(id);
    if (!d || owned(id) || d.reward) return false;
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

  /* ------------------------------------------------------------ backdrops */
  /*
   * Backgrounds work exactly like skins: bought once, kept forever, switched
   * freely. Kept in their own state key so neither can clobber the other.
   */
  function allBackgrounds() { return CONFIG.backgrounds || []; }

  function backgroundDef(id) {
    var list = allBackgrounds();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function backgroundOwned(id) {
    return id === 'default' || !!DC.Game.state.backgrounds.owned[id];
  }

  /** Earned rather than sold. Cannot be bought at any price. */
  function backgroundIsReward(id) { return !!backgroundDef(id).reward; }

  /**
   * Grants any earned background whose condition is now met. Called from
   * Game.checkProgress, so it keeps up without polling.
   */
  function checkBackgroundRewards() {
    var granted = [];
    allBackgrounds().forEach(function (bg) {
      if (!bg.reward || backgroundOwned(bg.id)) return;
      if (bg.requires && DC.Game.meetsRequirement(bg.requires)) {
        DC.Game.state.backgrounds.owned[bg.id] = true;
        granted.push(bg);
      }
    });
    if (granted.length) DC.Events.emit('backgroundUnlocked', granted);
    return granted;
  }

  function canBuyBackground(id) {
    var d = backgroundDef(id);
    if (!d || backgroundOwned(id) || d.reward) return false;
    return N.gte(DC.Game.state.durians, N.big(d.cost));
  }

  function buyBackground(id) {
    var d = backgroundDef(id);
    if (!d || backgroundOwned(id) || d.reward) return false;
    if (!DC.Game.spendDurians(N.big(d.cost))) return false;
    DC.Game.state.backgrounds.owned[id] = true;
    equipBackground(id);
    DC.Events.emit('backgroundBought', d);
    return true;
  }

  function equipBackground(id) {
    if (!backgroundOwned(id)) return false;
    DC.Game.state.backgrounds.active = id;
    DC.Events.emit('backgroundChanged', backgroundDef(id));
    return true;
  }

  function activeBackground() { return backgroundDef(DC.Game.state.backgrounds.active); }
  function activeBackgroundId() { return DC.Game.state.backgrounds.active; }
  function backgroundsOwnedCount() {
    return allBackgrounds().filter(function (b) { return backgroundOwned(b.id); }).length;
  }

  DC.Store = {
    allBackgrounds: allBackgrounds,
    backgroundDef: backgroundDef,
    backgroundOwned: backgroundOwned,
    backgroundIsReward: backgroundIsReward,
    checkBackgroundRewards: checkBackgroundRewards,
    canBuyBackground: canBuyBackground,
    buyBackground: buyBackground,
    equipBackground: equipBackground,
    activeBackground: activeBackground,
    activeBackgroundId: activeBackgroundId,
    backgroundsOwnedCount: backgroundsOwnedCount,
    all: all,
    def: def,
    owned: owned,
    ownedCount: ownedCount,
    activeId: activeId,
    active: active,
    canBuy: canBuy,
    isReward: isReward,
    checkRewards: checkRewards,
    buy: buy,
    equip: equip,
    byTier: byTier
  };
})(window.DC = window.DC || {});
