/* =============================================================================
 * prestige.js — Golden Shines.
 * -----------------------------------------------------------------------------
 * Six times over the life of a save, a player can trade their entire run for a
 * permanent Golden Shine worth +10% Durians per click. Six Shines is the cap;
 * there is no seventh.
 *
 * The Shines are deliberately NOT stored inside Game.state. The run state is
 * thrown away wholesale on a prestige, and anything living in it would go with
 * it — so the count lives here, in its own closure, mirrored to its own
 * localStorage key. The save file carries a copy too, and whichever is higher
 * wins on load, so a rolled-back save or a cleared key cannot cost anyone a
 * Shine they earned.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var STORE_KEY = 'durianClicker.goldenShines';

  /* Own copy of the permanent data, outside the run. */
  var permanent = { shines: 0, prestiges: 0, claimedAt: [], carried: N.ZERO };

  /* Guards the whole claim so a double-click cannot award two Shines. */
  var claiming = false;

  function settings() { return CONFIG.prestige; }
  function maxShines() { return settings().requirements.length; }

  /** How many Golden Shines the player holds. */
  function shines() { return permanent.shines; }

  /** Total prestiges performed. Same as shines, kept separate for clarity. */
  function prestiges() { return permanent.prestiges; }

  /** 1 + 0.10 per Shine. Additive between Shines, as specified. */
  function clickMultiplier() {
    return 1 + permanent.shines * settings().clickBonusPerShine;
  }

  /** 1 + 0.05 per Shine, applied to everything the island produces. */
  function productionMultiplier() {
    return 1 + permanent.shines * settings().productionBonusPerShine;
  }

  /** The permanent click bonus as a percentage, for display. */
  function bonusPercent(count) {
    var n = count === undefined ? permanent.shines : count;
    return Math.round(n * settings().clickBonusPerShine * 100);
  }

  /** The permanent production bonus as a percentage, for display. */
  function productionPercent(count) {
    var n = count === undefined ? permanent.shines : count;
    return Math.round(n * settings().productionBonusPerShine * 100);
  }

  function isComplete() { return permanent.shines >= maxShines(); }

  /** The Durians needed for the next Shine, or null when complete. */
  function requirement() {
    if (isComplete()) return null;
    return N.big(settings().requirements[permanent.shines]);
  }

  /** Which Shine they are working toward, 1-based. Null when complete. */
  function nextShineNumber() {
    return isComplete() ? null : permanent.shines + 1;
  }

  /**
   * Eligibility, judged on the CURRENT balance every time it is asked. Spending
   * back below the requirement makes them ineligible again.
   */
  function canPrestige() {
    if (claiming || isComplete()) return false;
    var need = requirement();
    return !!need && N.gte(DC.Game.state.durians, need);
  }

  /* ------------------------------------------------------------ persistence */

  function writeStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(permanent));
    } catch (err) { /* private browsing: the save file copy still carries it */ }
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  /** Shape and clamp anything we load, from either source. */
  function sanitise(data) {
    if (!data || typeof data !== 'object') return null;
    var n = parseInt(data.shines, 10);
    if (!isFinite(n) || n < 0) n = 0;
    return {
      shines: Math.min(n, maxShines()),
      prestiges: Math.max(parseInt(data.prestiges, 10) || 0, 0),
      claimedAt: Array.isArray(data.claimedAt) ? data.claimedAt.slice(0, 12) : [],
      // Durians earned in every run before this one, so a prestige does not
      // knock the player off the leaderboard.
      carried: data.carried !== undefined ? N.deserialize(data.carried) : N.ZERO
    };
  }

  /**
   * Merges what the save file carried with what the dedicated key holds and
   * keeps the better of the two. Losing a permanent reward to a stale copy of
   * one source would be far worse than briefly trusting the higher number.
   */
  function load(fromSave) {
    var a = sanitise(fromSave);
    var b = sanitise(readStore());
    var best = { shines: 0, prestiges: 0, claimedAt: [], carried: N.ZERO };
    [a, b].forEach(function (src) {
      if (!src) return;
      if (src.shines > best.shines) best = src;
      else if (src.shines === best.shines && src.prestiges > best.prestiges) best = src;
    });
    // carried earnings are kept at the highest either source saw
    [a, b].forEach(function (src) {
      if (src && N.gte(src.carried, best.carried)) best.carried = src.carried;
    });
    permanent = best;
    writeStore();
    if (DC.Game) DC.Game.recalc();
    DC.Events.emit('prestigeLoaded', snapshot());
    return snapshot();
  }

  /** What goes into the save file alongside the run. */
  function serialize() {
    return {
      shines: permanent.shines,
      prestiges: permanent.prestiges,
      claimedAt: permanent.claimedAt.slice(),
      carried: N.serialize(permanent.carried)
    };
  }

  /** Everything earned across every run, including this one. */
  function lifetimeEarned() {
    return N.add(permanent.carried, DC.Game.state.totalEarned);
  }

  function snapshot() {
    return {
      shines: permanent.shines,
      max: maxShines(),
      prestiges: permanent.prestiges,
      bonusPercent: bonusPercent(),
      productionPercent: productionPercent(),
      complete: isComplete(),
      next: nextShineNumber(),
      requirement: requirement()
    };
  }

  /* ------------------------------------------------------------------ claim */

  /**
   * Awards exactly one Golden Shine and starts a fresh run.
   *
   * Validation happens HERE rather than in the button, so calling this from
   * the console without the Durians achieves nothing. The claiming flag makes
   * the whole thing atomic: a second call while one is in flight is rejected
   * outright, so no amount of clicking awards two Shines or resets twice.
   *
   * Returns { ok: true, shine, bonusPercent } or { ok: false, reason }.
   */
  function claim() {
    if (claiming) return { ok: false, reason: 'busy' };
    if (isComplete()) return { ok: false, reason: 'complete' };

    var need = requirement();
    if (!need || !N.gte(DC.Game.state.durians, need)) {
      return { ok: false, reason: 'not-enough' };
    }

    claiming = true;
    try {
      var number = permanent.shines + 1;

      // 1. permanent progression first, and written to its own key straight
      //    away — if anything below fails, the Shine is still banked.
      permanent.shines = number;
      permanent.prestiges += 1;
      permanent.claimedAt.push(Date.now());
      // Bank this run's earnings before the run is thrown away.
      permanent.carried = N.add(permanent.carried, DC.Game.state.totalEarned);
      writeStore();

      // 2. throw the run away and start again
      DC.Game.resetRun();

      // 3. the new run must be saved, or a reload would restore the old one
      if (DC.Save) DC.Save.save(true);

      var result = { ok: true, shine: number, bonusPercent: bonusPercent(),
                     productionPercent: productionPercent(),
                     complete: isComplete() };
      DC.Events.emit('prestiged', result);
      return result;
    } finally {
      claiming = false;
    }
  }

  DC.Prestige = {
    shines: shines,
    prestiges: prestiges,
    max: maxShines,
    clickMultiplier: clickMultiplier,
    productionMultiplier: productionMultiplier,
    bonusPercent: bonusPercent,
    productionPercent: productionPercent,
    isComplete: isComplete,
    requirement: requirement,
    nextShineNumber: nextShineNumber,
    canPrestige: canPrestige,
    claim: claim,
    load: load,
    serialize: serialize,
    lifetimeEarned: lifetimeEarned,
    snapshot: snapshot
  };
})(window.DC = window.DC || {});
