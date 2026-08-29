/* =============================================================================
 * debug.js — developer tools. Press Ctrl + `  to open.
 * Set CONFIG.debugEnabled = false in config.js for a production build; the
 * shortcut and the panel then do nothing at all.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  var panel, body, visible = false;

  function button(label, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    body.appendChild(b);
    return b;
  }

  function row(nodes) {
    var d = document.createElement('div');
    d.className = 'debug-row';
    nodes.forEach(function (n) { d.appendChild(n); });
    body.appendChild(d);
    return d;
  }

  function input(placeholder, value, width) {
    var i = document.createElement('input');
    i.placeholder = placeholder;
    i.value = value;
    if (width) i.style.maxWidth = width;
    return i;
  }

  function smallButton(label, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.width = 'auto';
    b.addEventListener('click', fn);
    return b;
  }

  function refreshUI() {
    DC.Game.recalc();
    DC.Game.checkProgress();
    DC.UI.rebuildAll();
  }

  function build() {
    body.innerHTML = '';

    button('+1,000 Durians', function () { DC.Game.addDurians(1e3); refreshUI(); });
    button('+1,000,000 Durians', function () { DC.Game.addDurians(1e6); refreshUI(); });
    button('+1 quadrillion Durians', function () { DC.Game.addDurians(1e15); refreshUI(); });
    button('×1,000 current Durians', function () {
      DC.Game.addDurians(N.mul(DC.Game.state.durians, 999)); refreshUI();
    });

    button('Unlock everything', function () {
      CONFIG.workers.concat(CONFIG.upgrades).forEach(function (d) { DC.Game.state.unlocked[d.id] = true; });
      refreshUI();
    });
    button('Grant all upgrades', function () {
      CONFIG.upgrades.forEach(function (u) {
        DC.Game.state.unlocked[u.id] = true;
        DC.Game.state.upgrades[u.id] = u.repeatable ? 1 : true;
      });
      refreshUI();
    });
    button('Grant all achievements', function () {
      CONFIG.achievements.forEach(function (a) { DC.Game.state.achievements[a.id] = Date.now(); });
      refreshUI();
    });

    // set worker counts
    var select = document.createElement('select');
    select.style.flex = '1';
    CONFIG.workers.forEach(function (w) {
      var o = document.createElement('option');
      o.value = w.id; o.textContent = w.name;
      select.appendChild(o);
    });
    var countInput = input('count', '50', '70px');
    row([select, countInput, smallButton('Set', function () {
      DC.Game.state.workers[select.value] = Math.max(0, parseInt(countInput.value, 10) || 0);
      DC.Game.state.unlocked[select.value] = true;
      refreshUI();
    })]);

    // offline simulation
    var secondsInput = input('seconds', '3600', '90px');
    row([secondsInput, smallButton('Simulate offline', function () {
      var s = parseFloat(secondsInput.value) || 0;
      if (!DC.Offline.simulate(s)) alert('No offline earnings — hire some workers first.');
    })]);

    var evSelect = document.createElement('select');
    evSelect.style.flex = '1';
    CONFIG.events.forEach(function (e) {
      var o = document.createElement('option');
      o.value = e.id; o.textContent = e.title || e.name;
      evSelect.appendChild(o);
    });
    row([evSelect, smallButton('Fire', function () {
      if (!DC.IslandEvents.trigger(evSelect.value)) alert('Event not eligible right now.');
      refreshUI();
    })]);
    button('Fire a random event', function () {
      if (!DC.IslandEvents.trigger()) alert('No eligible events — hire some workers first.');
      refreshUI();
    });
    button('Clear all buffs', function () {
      DC.Game.state.buffs.length = 0; refreshUI();
    });

    button('Submit to leaderboard', function () {
      DC.Leaderboard.submit({ force: true, ignoreThrottle: true }).then(function (r) {
        console.log('[Durian Clicker] leaderboard submit', r);
        if (!r.ok) alert('Submit skipped: ' + r.reason);
        DC.Leaderboard.load();
      });
    });
    button('Save now', function () { DC.Save.save(); });
    button('Reload from save', function () { DC.Save.load(); DC.UI.rebuildAll(); });
    button('Hard reset (no confirm)', function () {
      DC.Save.wipe(); DC.Game.reset(true); DC.UI.rebuildAll();
    });

    var pre = document.createElement('pre');
    button('Dump game state', function () {
      var snapshot = DC.Save.serialize(DC.Game.state);
      console.log('[Durian Clicker] state', DC.Game.state, snapshot);
      pre.textContent = JSON.stringify({
        durians: N.format(DC.Game.state.durians),
        dps: N.format(DC.Game.derived.dps),
        clickPower: N.format(DC.Game.derived.clickPower),
        workers: DC.Game.state.workers,
        upgrades: Object.keys(DC.Game.state.upgrades),
        achievements: Object.keys(DC.Game.state.achievements)
      }, null, 1);
    });
    body.appendChild(pre);

    var note = document.createElement('div');
    note.className = 'debug-note';
    note.textContent = 'Ctrl + ` toggles this panel. Disable it by setting debugEnabled: false in js/config.js.';
    body.appendChild(note);
  }

  function toggle(force) {
    visible = force !== undefined ? force : !visible;
    panel.hidden = !visible;
  }

  function init() {
    panel = document.getElementById('debug-panel');
    body = document.getElementById('debug-body');
    if (!panel) return;

    if (!CONFIG.debugEnabled) { panel.remove(); return; }

    build();
    document.getElementById('debug-close').addEventListener('click', function () { toggle(false); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote')) {
        e.preventDefault();
        toggle();
      }
    });
    console.log('[Durian Clicker] Debug tools ready — press Ctrl + ` to open. Game object: window.DC');
  }

  DC.Debug = { init: init, toggle: toggle };
})(window.DC = window.DC || {});
