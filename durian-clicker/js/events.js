/* =============================================================================
 * events.js — the random island event engine.
 * -----------------------------------------------------------------------------
 * Picks an eligible event by weight on a randomised timer, applies its effect,
 * and emits 'islandEvent' for the UI. Temporary buffs live in state.buffs and
 * are folded into production by game.js recalc().
 *
 * Event content lives in js/content/events.js.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  function cfg() { return CONFIG.events_settings; }

  /* ---------------------------------------------------------- scheduling */

  /** Random seconds until the next event, scaled by any eventChance upgrades. */
  function rollInterval() {
    var c = cfg();
    var span = c.maxIntervalSeconds - c.minIntervalSeconds;
    var seconds = c.minIntervalSeconds + Math.random() * span;
    var chance = DC.Game.derived.eventChance || 1;
    return seconds / Math.max(0.1, chance);
  }

  function schedule(fromNow) {
    DC.Game.state.events.nextAt = Date.now() + (fromNow !== undefined ? fromNow : rollInterval()) * 1000;
  }

  /* ------------------------------------------------------------ eligibility */

  function eligible() {
    var s = DC.Game.state;
    return CONFIG.events.filter(function (e) {
      if (e.require && !DC.Game.meetsRequirement(e.require)) return false;
      // Buff and second-based payouts are meaningless with no production.
      if (e.effect.type !== 'gainFlat' && N.toNumber(DC.Game.derived.dps) <= 0) return false;
      // Don't take Durians from someone who has none to spare.
      if (!e.good && N.lt(s.durians, cfg().minBankForSetbacks)) return false;
      return true;
    });
  }

  function pick(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += (list[i].weight || 1);
    var roll = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      roll -= (list[i].weight || 1);
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /* -------------------------------------------------------------- effects */

  function between(min, max) { return min + Math.random() * (max - min); }

  /**
   * Applies an event and returns a plain result the UI can render:
   *   { def, amount (Big or null), direction: 'gain'|'loss'|'buff', text }
   */
  function apply(def) {
    var s = DC.Game.state, d = DC.Game.derived;
    var fx = def.effect;
    var gainMult = def.good ? (d.eventGain || 1) : 1;
    var lossMult = def.good ? 1 : (d.eventLoss !== undefined ? d.eventLoss : 1);
    var result = { def: def, amount: null, direction: 'buff', text: def.text };

    switch (fx.type) {
      case 'gainSeconds': {
        var secs = between(fx.min, fx.max) * gainMult;
        var amount = N.mul(d.dps, secs);
        DC.Game.addDurians(amount, 'worker');
        result.amount = amount;
        result.direction = 'gain';
        break;
      }
      case 'gainFlat': {
        var flat = N.mul(N.big(between(fx.min, fx.max)), gainMult);
        DC.Game.addDurians(flat, 'worker');
        result.amount = flat;
        result.direction = 'gain';
        break;
      }
      case 'losePercent': {
        var pct = between(fx.min, fx.max) * lossMult;
        var taken = N.mul(s.durians, pct);
        s.durians = N.max(N.sub(s.durians, taken), N.ZERO);
        s.lost = N.add(s.lost || N.ZERO, taken);
        result.amount = taken;
        result.direction = 'loss';
        break;
      }
      case 'loseSeconds': {
        var lsecs = between(fx.min, fx.max) * lossMult;
        var loss = N.max(N.mul(d.dps, lsecs), N.ZERO);
        if (N.gte(loss, s.durians)) loss = s.durians;   // never go negative
        s.durians = N.sub(s.durians, loss);
        s.lost = N.add(s.lost || N.ZERO, loss);
        result.amount = loss;
        result.direction = 'loss';
        break;
      }
      case 'buff': {
        var duration = fx.seconds * (d.buffDuration || 1);
        addBuff({
          id: def.id,
          label: fx.label || def.name,
          prod: fx.prod !== undefined ? fx.prod : 1,
          click: fx.click !== undefined ? fx.click : 1,
          endsAt: Date.now() + duration * 1000
        });
        result.direction = def.good ? 'buff' : 'debuff';
        result.seconds = duration;
        break;
      }
      default:
        console.warn('Unknown event effect:', fx.type);
    }

    // Bookkeeping the achievements read from.
    s.events.seen[def.id] = (s.events.seen[def.id] || 0) + 1;
    s.events.total = (s.events.total || 0) + 1;
    return result;
  }

  /* ---------------------------------------------------------------- buffs */

  function addBuff(buff) {
    var buffs = DC.Game.state.buffs;
    // Re-triggering the same buff refreshes it rather than stacking forever.
    for (var i = 0; i < buffs.length; i++) {
      if (buffs[i].id === buff.id) { buffs[i] = buff; DC.Game.recalc(); return; }
    }
    buffs.push(buff);
    DC.Game.recalc();
  }

  /** Drops expired buffs. Called from the tick. */
  function pruneBuffs() {
    var buffs = DC.Game.state.buffs;
    var now = Date.now(), changed = false;
    for (var i = buffs.length - 1; i >= 0; i--) {
      if (buffs[i].endsAt <= now) { buffs.splice(i, 1); changed = true; }
    }
    if (changed) {
      DC.Game.recalc();
      DC.Events.emit('buffsChanged');
    }
  }

  /* ----------------------------------------------------------------- tick */

  function update() {
    if (!cfg().enabled) return;
    pruneBuffs();

    var s = DC.Game.state;
    if (!s.events.nextAt) { schedule(); return; }
    if (Date.now() < s.events.nextAt) return;

    var options = eligible();
    if (!options.length) { schedule(60); return; }   // try again shortly

    var def = pick(options);
    var result = apply(def);
    schedule();

    DC.Game.checkProgress();
    DC.Events.emit('islandEvent', result);
  }

  /** Debug/testing hook: fire a specific event, or a random eligible one. */
  function trigger(id) {
    var def = null;
    if (id) {
      for (var i = 0; i < CONFIG.events.length; i++) {
        if (CONFIG.events[i].id === id) def = CONFIG.events[i];
      }
    } else {
      var options = eligible();
      if (!options.length) return null;
      def = pick(options);
    }
    if (!def) return null;
    var result = apply(def);
    DC.Game.checkProgress();
    DC.Events.emit('islandEvent', result);
    return result;
  }

  /** Seconds until the next event, for the UI. */
  function timeUntilNext() {
    var at = DC.Game.state.events.nextAt;
    return at ? Math.max(0, (at - Date.now()) / 1000) : null;
  }

  function activeBuffs() {
    var now = Date.now();
    return DC.Game.state.buffs.filter(function (b) { return b.endsAt > now; });
  }

  DC.IslandEvents = {
    update: update,
    trigger: trigger,
    schedule: schedule,
    activeBuffs: activeBuffs,
    timeUntilNext: timeUntilNext,
    pruneBuffs: pruneBuffs,
    all: function () { return CONFIG.events; }
  };
})(window.DC = window.DC || {});
