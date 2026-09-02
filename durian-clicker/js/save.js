/* =============================================================================
 * save.js — localStorage persistence, autosave, export/import.
 * -----------------------------------------------------------------------------
 * Big numbers are stored as {m, e} pairs so no precision is lost through JSON.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var BIG_FIELDS = ['durians', 'totalEarned', 'clickEarned', 'workerEarned', 'spent',
                    'lost', 'offlineEarned', 'eventGained'];

  /* ------------------------------------------------------- (de)serialising */

  function serialize(state) {
    var out = {
      version: CONFIG.saveVersion,
      totalClicks: state.totalClicks,
      workers: Object.assign({}, state.workers),
      upgrades: Object.assign({}, state.upgrades),
      achievements: Object.assign({}, state.achievements),
      unlocked: Object.assign({}, state.unlocked),
      settings: Object.assign({}, state.settings),
      player: Object.assign({}, state.player),
      blueCoins: state.blueCoins,
      coins: Object.assign({}, state.coins),
      casino: Object.assign({}, state.casino, {
        wagered: N.serialize(state.casino.wagered || N.ZERO),
        won: N.serialize(state.casino.won || N.ZERO),
        biggestWin: N.serialize(state.casino.biggestWin || N.ZERO)
      }),
      skins: { owned: Object.assign({}, state.skins.owned), active: state.skins.active },
      backgrounds: { owned: Object.assign({}, state.backgrounds.owned),
                     active: state.backgrounds.active },
      buffs: state.buffs.slice(),
      events: { seen: Object.assign({}, state.events.seen),
                total: state.events.total, nextAt: state.events.nextAt },
      changelogSeen: state.changelogSeen,
      integrity: state.integrity,
      peakClickRate: state.peakClickRate,
      playTime: state.playTime,
      startedAt: state.startedAt,
      lastSaved: Date.now()
    };
    BIG_FIELDS.forEach(function (f) { out[f] = N.serialize(state[f]); });
    return out;
  }

  function deserialize(data) {
    var state = DC.Game.newState();
    if (!data || typeof data !== 'object') return state;

    data = migrate(data);

    BIG_FIELDS.forEach(function (f) {
      if (data[f] !== undefined) state[f] = N.deserialize(data[f]);
    });
    if (typeof data.totalClicks === 'number') state.totalClicks = data.totalClicks;
    if (typeof data.playTime === 'number') state.playTime = data.playTime;
    if (typeof data.changelogSeen === 'string') state.changelogSeen = data.changelogSeen;
    if (data.integrity) state.integrity = data.integrity;
    if (typeof data.peakClickRate === 'number') state.peakClickRate = data.peakClickRate;
    if (typeof data.startedAt === 'number') state.startedAt = data.startedAt;
    if (typeof data.lastSaved === 'number') state.lastSaved = data.lastSaved;

    // Only copy across ids that still exist in the config, so removing content
    // from config.js can never corrupt a save.
    CONFIG.workers.forEach(function (w) {
      var v = data.workers && data.workers[w.id];
      state.workers[w.id] = typeof v === 'number' ? v : 0;
      if (data.unlocked && data.unlocked[w.id]) state.unlocked[w.id] = true;
    });
    CONFIG.upgrades.forEach(function (u) {
      if (data.upgrades && data.upgrades[u.id]) state.upgrades[u.id] = data.upgrades[u.id];
      if (data.unlocked && data.unlocked[u.id]) state.unlocked[u.id] = true;
    });
    CONFIG.achievements.forEach(function (a) {
      if (data.achievements && data.achievements[a.id]) state.achievements[a.id] = data.achievements[a.id];
    });

    if (data.settings) Object.assign(state.settings, data.settings);
    if (!state.settings.numberFormat) state.settings.numberFormat = 'abbreviated';
    state.settings.darkMode = !!state.settings.darkMode;
    if (data.player) Object.assign(state.player, data.player);
    // Update 2 additions. Absent in v1 saves, which is fine — they default.
    if (typeof data.blueCoins === 'number') state.blueCoins = data.blueCoins;
    if (data.coins) Object.assign(state.coins, data.coins);
    if (data.casino) {
      Object.assign(state.casino, data.casino);
      state.casino.wagered = N.deserialize(data.casino.wagered || 0);
      state.casino.won = N.deserialize(data.casino.won || 0);
      state.casino.biggestWin = N.deserialize(data.casino.biggestWin || 0);
    }
    if (data.skins) {
      // Only keep skins that still exist in the catalogue.
      state.skins.owned = { classic: true };
      CONFIG.skins.forEach(function (sk) {
        if (data.skins.owned && data.skins.owned[sk.id]) state.skins.owned[sk.id] = true;
      });
      var wanted = data.skins.active;
      state.skins.active = (wanted && state.skins.owned[wanted]) ? wanted : 'classic';
    }
    if (data.backgrounds) {
      // Same rule as skins: keep only what still exists in the catalogue.
      state.backgrounds.owned = { default: true };
      (CONFIG.backgrounds || []).forEach(function (bg) {
        if (data.backgrounds.owned && data.backgrounds.owned[bg.id]) {
          state.backgrounds.owned[bg.id] = true;
        }
      });
      var wantedBg = data.backgrounds.active;
      state.backgrounds.active =
        (wantedBg && state.backgrounds.owned[wantedBg]) ? wantedBg : 'default';
    }
    if (Array.isArray(data.buffs)) state.buffs = data.buffs.filter(function (b) {
      return b && typeof b.endsAt === 'number' && b.endsAt > Date.now();
    });
    if (data.events) {
      if (data.events.seen) state.events.seen = Object.assign({}, data.events.seen);
      if (typeof data.events.total === 'number') state.events.total = data.events.total;
      if (typeof data.events.nextAt === 'number') state.events.nextAt = data.events.nextAt;
    }
    // Saves made before public ids existed still need one.
    if (!state.player.publicId) state.player.publicId = DC.Game.makePlayerId();
    return state;
  }

  /** Bump CONFIG.saveVersion and add a step here when the format changes. */
  function migrate(data) {
    var v = data.version || 1;
    // if (v < 2) { ...transform...; v = 2; }
    data.version = v;
    return data;
  }

  /* --------------------------------------------------------------- storage */

  /* --------------------------------------------------------- save integrity */
  /*
   * A signature over the stored payload, plus a few consistency checks. This
   * catches hand-edited localStorage and pasted export strings, which is how
   * saves are usually altered and shared. It does not defeat someone working
   * through the console, and nothing client-side would.
   *
   * A failing save still LOADS — losing real progress to a false positive
   * would be far worse than the cheating — it is simply marked ineligible.
   */
  var SIGNED_VERSION = 2;

  function signature(payload) {
    var copy = {};
    Object.keys(payload).sort().forEach(function (k) {
      if (k !== 'sig') copy[k] = payload[k];
    });
    var text = JSON.stringify(copy) + '|isle-delfino|' + SIGNED_VERSION;
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  /** Internal consistency, independent of the signature. */
  function looksPlausible(data) {
    try {
      var earned = N.toNumber(N.deserialize(data.totalEarned || 0));
      var held = N.toNumber(N.deserialize(data.durians || 0));
      if (!isFinite(earned) || !isFinite(held)) return false;
      if (held > earned * 1.0001) return false;          // held more than ever earned

      // Crew has to have been paid for. Costs rise 10% a head, so owning n of
      // a worker means having spent at least baseCost x (1.1^n - 1) / 0.1 on
      // it alone. Compared against everything ever earned, with plenty of
      // slack — this is here to catch 500,000 Pianta Judges, not to audit
      // anyone's spending.
      var workers = data.workers || {};
      for (var i = 0; i < CONFIG.workers.length; i++) {
        var def = CONFIG.workers[i];
        var n = workers[def.id] || 0;
        if (!n) continue;
        if (n > 1e6) return false;                       // beyond any real save
        var mult = def.costMultiplier || 1.1;
        var spentLog = Math.log10(def.baseCost) +
                       n * Math.log10(mult) - Math.log10(mult - 1);
        if (spentLog > Math.log10(Math.max(earned, 1)) + 1) return false;
      }
      // NOTE: there is deliberately no click-rate rule here.
      //
      // Autoclickers are allowed. The rate limiter in game.js already removes
      // the advantage — clicks past maxClickRate earn a fraction — and
      // totalClicks still counts every one of them so click achievements keep
      // working. A plausibility rule on clicks per second would therefore
      // catch nothing the limiter has not already neutralised, while banning
      // people from the leaderboard for playing the way we said they could.
      return true;
    } catch (err) {
      return true;                                        // never block on our own bug
    }
  }

  /** 'ok' or a human-readable reason. */
  function verify(data) {
    if (!data) return 'ok';
    if (data.integrity) return data.integrity;
    if (!looksPlausible(data)) return 'the save contains impossible values';
    if (!data.sig) {
      // Saves written before signing existed are grandfathered and re-signed
      // on the next write.
      return (data.saveVersion >= SIGNED_VERSION)
        ? 'the save file was edited' : 'ok';
    }
    if (data.sig !== signature(data)) return 'the save file was edited';
    return 'ok';
  }

  function save(silent) {
    try {
      var payload = serialize(DC.Game.state);
      payload.saveVersion = SIGNED_VERSION;
      payload.sig = signature(payload);
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(payload));
      DC.Game.state.lastSaved = payload.lastSaved;
      if (!silent) DC.Events.emit('saved', { at: payload.lastSaved });
      return true;
    } catch (err) {
      console.error('Save failed:', err);
      DC.Events.emit('saveError', err);
      return false;
    }
  }

  function loadRaw() {
    try {
      var raw = localStorage.getItem(CONFIG.saveKey);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Could not read save:', err);
      return null;
    }
  }

  /** Returns the saved data (or null) and applies it to the live game. */
  function load() {
    var data = loadRaw();
    if (!data) return null;
    var verdict = verify(data);
    DC.Game.state = deserialize(data);
    if (verdict !== 'ok') DC.Game.state.integrity = verdict;
    DC.Game.recalc();
    DC.Game.markBank();                 // the loaded total is the baseline
    DC.Game.checkUnlocks();
    DC.Events.emit('loaded', data);
    return data;
  }

  function wipe() {
    try { localStorage.removeItem(CONFIG.saveKey); } catch (err) { console.error(err); }
  }

  /* ---------------------------------------------------------- export/import */

  function exportString() {
    var json = JSON.stringify(serialize(DC.Game.state));
    try { return btoa(unescape(encodeURIComponent(json))); }
    catch (err) { return json; }        // fall back to plain JSON
  }

  /** Accepts either the base64 export string or raw JSON. */
  function importString(text) {
    if (!text) return false;
    text = String(text).trim();
    var data = null;
    try {
      data = JSON.parse(text);
    } catch (err) {
      try { data = JSON.parse(decodeURIComponent(escape(atob(text)))); }
      catch (err2) { return false; }
    }
    if (!data || typeof data !== 'object') return false;

    var importVerdict = verify(data);
    DC.Game.state = deserialize(data);
    if (importVerdict !== 'ok') DC.Game.state.integrity = importVerdict;
    DC.Game.recalc();
    DC.Game.markBank();
    DC.Game.checkUnlocks();
    save(true);
    DC.Events.emit('imported', data);
    return true;
  }

  function downloadSaveFile() {
    var blob = new Blob([exportString()], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = 'durian-clicker-save-' + stamp + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* -------------------------------------------------------------- autosave */

  var timer = null;

  function startAutosave() {
    if (!CONFIG.autosave.enabled) return;
    stopAutosave();
    timer = setInterval(function () { save(true); }, CONFIG.autosave.intervalSeconds * 1000);

    // Catch tab close / background / mobile app switch.
    window.addEventListener('beforeunload', function () { save(true); });
    window.addEventListener('pagehide', function () { save(true); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save(true);
    });
  }

  function stopAutosave() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  DC.Save = {
    save: save,
    load: load,
    loadRaw: loadRaw,
    wipe: wipe,
    serialize: serialize,
    deserialize: deserialize,
    signature: signature,
    verify: verify,
    looksPlausible: looksPlausible,
    exportString: exportString,
    importString: importString,
    downloadSaveFile: downloadSaveFile,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave
  };
})(window.DC = window.DC || {});
