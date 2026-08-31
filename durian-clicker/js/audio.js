/* =============================================================================
 * audio.js — one place for every sound in the game.
 * -----------------------------------------------------------------------------
 * To swap a sound, replace the file in assets/sounds/ or change the path in
 * CONFIG.sounds. If a file is missing or fails to decode, a short synthesised
 * blip plays instead so the game never goes silent by accident.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var CONFIG = DC.CONFIG;
  var POOL_SIZE = 4;                  // allows the same sound to overlap

  var pools = {};                     // key -> { elements: [], index, ok }
  var volume = CONFIG.audio.defaultVolume;
  var muted = CONFIG.audio.defaultMuted;
  var lastPlayed = {};
  var ctx = null;                     // lazily created AudioContext for fallback

  function init() {
    Object.keys(CONFIG.sounds).forEach(function (key) {
      var src = CONFIG.sounds[key];
      var pool = { elements: [], index: 0, ok: true };
      for (var i = 0; i < POOL_SIZE; i++) {
        var el = new Audio();
        el.preload = 'auto';
        el.src = src;
        el.volume = volume;
        el.addEventListener('error', function () { pool.ok = false; });
        pool.elements.push(el);
      }
      pools[key] = pool;
    });
    applyVolume();
  }

  function applyVolume() {
    var v = muted ? 0 : volume;
    Object.keys(pools).forEach(function (key) {
      pools[key].elements.forEach(function (el) { el.volume = v; });
    });
  }

  function play(key) {
    if (muted) return;
    var throttle = key === 'click' ? CONFIG.audio.clickThrottleMs : 0;
    var now = performance.now();
    if (throttle && lastPlayed[key] && now - lastPlayed[key] < throttle) return;
    lastPlayed[key] = now;

    var pool = pools[key];
    if (!pool || !pool.ok) return beep(key);

    var el = pool.elements[pool.index];
    pool.index = (pool.index + 1) % pool.elements.length;
    try {
      el.currentTime = 0;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* autoplay blocked until first tap */ });
    } catch (err) {
      beep(key);
    }
  }

  /* --------------------------------------------- synthesised fallback blip */

  var TONES = {
    click: 760, buyWorker: 520, buyUpgrade: 680,
    unlock: 590, achievement: 880, offline: 440
  };

  function beep(key) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = ctx || new AC();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = TONES[key] || 600;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.25), ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (err) { /* no audio available — fine */ }
  }

  /* ------------------------------------------------------------- controls */

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    DC.Game.state.settings.volume = volume;
    applyVolume();
    DC.Events.emit('audioSettings', { volume: volume, muted: muted });
  }

  function setMuted(m) {
    muted = !!m;
    DC.Game.state.settings.muted = muted;
    applyVolume();
    DC.Events.emit('audioSettings', { volume: volume, muted: muted });
  }

  function toggleMute() { setMuted(!muted); return muted; }

  /** Pull volume/mute out of a loaded save. */
  function syncFromState() {
    var s = DC.Game.state.settings;
    volume = typeof s.volume === 'number' ? s.volume : CONFIG.audio.defaultVolume;
    muted = !!s.muted;
    applyVolume();
    DC.Events.emit('audioSettings', { volume: volume, muted: muted });
  }

  /** Browsers need a user gesture before audio may start. */
  function unlockOnFirstGesture() {
    function go() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      Object.keys(pools).forEach(function (key) {
        var el = pools[key].elements[0];
        var p = el.play();
        if (p && p.then) p.then(function () { el.pause(); el.currentTime = 0; }).catch(function () {});
      });
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    }
    window.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  }

  DC.Audio = {
    init: init,
    play: play,
    setVolume: setVolume,
    setMuted: setMuted,
    toggleMute: toggleMute,
    syncFromState: syncFromState,
    unlockOnFirstGesture: unlockOnFirstGesture,
    getVolume: function () { return volume; },
    isMuted: function () { return muted; }
  };
})(window.DC = window.DC || {});
