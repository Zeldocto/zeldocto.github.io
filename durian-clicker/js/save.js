/* =============================================================================
 * save.js — localStorage persistence, autosave, export/import.
 * -----------------------------------------------------------------------------
 * Big numbers are stored as {m, e} pairs so no precision is lost through JSON.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var BIG_FIELDS = ['durians', 'totalEarned', 'clickEarned', 'workerEarned', 'spent'];

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
    if (data.player) Object.assign(state.player, data.player);
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

  function save(silent) {
    try {
      var payload = serialize(DC.Game.state);
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
    DC.Game.state = deserialize(data);
    DC.Game.recalc();
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

    DC.Game.state = deserialize(data);
    DC.Game.recalc();
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
    exportString: exportString,
    importString: importString,
    downloadSaveFile: downloadSaveFile,
    startAutosave: startAutosave,
    stopAutosave: stopAutosave
  };
})(window.DC = window.DC || {});
