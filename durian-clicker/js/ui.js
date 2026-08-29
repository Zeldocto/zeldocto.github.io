/* =============================================================================
 * ui.js — every DOM read/write in the game.
 * -----------------------------------------------------------------------------
 * Lists are built when their *structure* changes (a new unlock, a purchase, a
 * reset) and then only their numbers and affordability styling are refreshed on
 * each render frame. Keeps the frame cost flat no matter how much is on screen.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;
  var Game = DC.Game;

  var el = {};
  var workerRows = {};
  var upgradeRows = {};
  var lastTitleUpdate = 0;

  function $(id) { return document.getElementById(id); }

  function cache() {
    ['scene-img', 'brand-shine', 'durian-count', 'dps-line', 'durian-button', 'durian-img',
     'fx-layer', 'click-power', 'mini-total', 'mini-shines', 'worker-list', 'upgrade-list',
     'owned-upgrades', 'owned-heading', 'achievement-list', 'ach-progress-text', 'stats-list',
     'toasts', 'buy-amount', 'pip-upgrades', 'volume-slider', 'volume-slider-2', 'btn-mute',
     'btn-mute-2', 'save-box', 'settings-note', 'offline-text', 'offline-amount', 'offline-sub',
     'confirm-title', 'confirm-text', 'board-switch', 'board-list', 'board-status', 'board-name',
     'board-rank', 'board-note', 'btn-board-name', 'btn-board-submit', 'btn-board-refresh',
     'name-input', 'name-error', 'upgrade-search', 'upgrade-count', 'upgrade-more',
     'owned-details', 'owned-count', 'buff-bar', 'event-banner', 'event-icon',
     'event-title', 'event-text', 'event-amount'
    ].forEach(function (id) { el[id] = $(id); });
  }

  /* --------------------------------------------------------------- assets */

  function applyAssets() {
    el['durian-img'].src = CONFIG.assets.durian;
    el['brand-shine'].src = CONFIG.assets.shine;
    el['scene-img'].style.backgroundImage = 'url("' + CONFIG.assets.background + '")';
  }

  /* ------------------------------------------------------- click feedback */

  /** Removes the node when its animation ends, with a timer as a backstop. */
  function autoRemove(node, ms) {
    node.addEventListener('animationend', function () { node.remove(); });
    setTimeout(function () { node.remove(); }, ms);
  }

  function spawnClickFx(x, y, amount) {
    var layer = el['fx-layer'];
    // Autoclickers can outrun the animations — keep the layer bounded.
    if (layer.childElementCount > 80) return;

    var text = document.createElement('div');
    text.className = 'float-text';
    text.textContent = '+' + N.format(amount);
    text.style.left = x + 'px';
    text.style.top = y + 'px';
    layer.appendChild(text);
    autoRemove(text, 1400);

    for (var i = 0; i < 6; i++) {
      var p = document.createElement('div');
      var angle = Math.random() * Math.PI * 2;
      var dist = 40 + Math.random() * 55;
      p.className = 'particle';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      p.style.background = i % 2 ? 'var(--shine)' : 'var(--leaf)';
      layer.appendChild(p);
      autoRemove(p, 1000);
    }
  }

  function handleClick(event) {
    var btn = el['durian-button'];
    var gained = Game.click();

    btn.classList.remove('squash');
    void btn.offsetWidth;                    // restart the animation
    btn.classList.add('squash');

    var rect = el['fx-layer'].getBoundingClientRect();
    var x = (event.clientX !== undefined ? event.clientX - rect.left : rect.width / 2);
    var y = (event.clientY !== undefined ? event.clientY - rect.top : rect.height / 2);
    spawnClickFx(x, y, gained);

    el['durian-count'].classList.add('pop');
    setTimeout(function () { el['durian-count'].classList.remove('pop'); }, 90);

    DC.Audio.play('click');
    refreshCounters();
  }

  /* ------------------------------------------------------------- counters */

  function refreshCounters() {
    var s = Game.state, d = Game.derived;
    el['durian-count'].textContent = N.format(s.durians);
    el['dps-line'].textContent = N.formatRate(d.dps) + ' per second';
    el['click-power'].textContent = N.format(d.clickPower);
    el['mini-total'].textContent = N.format(s.totalEarned);
    el['mini-shines'].textContent = DC.Achievements.earnedCount() + '/' + DC.Achievements.total();

    var now = performance.now();
    if (now - lastTitleUpdate > 1000) {
      lastTitleUpdate = now;
      document.title = N.format(s.durians) + ' Durians — Durian Clicker';
    }
  }

  /* -------------------------------------------------------- worker shop */

  /** Unlocked entries, plus the next locked one as a teaser. */
  function visibleEntries(defs) {
    var out = [], teaserAdded = false;
    defs.forEach(function (def) {
      if (Game.state.unlocked[def.id]) out.push({ def: def, locked: false });
      else if (!teaserAdded) { out.push({ def: def, locked: true }); teaserAdded = true; }
    });
    return out;
  }

  function buildWorkers() {
    var list = el['worker-list'];
    list.innerHTML = '';
    workerRows = {};

    visibleEntries(CONFIG.workers).forEach(function (entry) {
      var def = entry.def;
      var row = document.createElement('button');
      row.className = 'item';
      row.type = 'button';

      if (entry.locked) {
        row.classList.add('locked');
        row.disabled = true;
        row.innerHTML =
          '<img class="item-icon" src="' + def.image + '" alt="">' +
          '<div><span class="item-name">???</span>' +
          '<span class="item-lock">🔒 ' + Game.describeRequirement(def.unlock) + '</span></div>' +
          '<div class="item-buy"></div>';
        list.appendChild(row);
        return;
      }

      row.innerHTML =
        '<img class="item-icon" src="' + def.image + '" alt="">' +
        '<div>' +
          '<span class="item-name">' + def.name + ' <span class="item-owned" data-owned></span></span>' +
          '<span class="item-desc">' + def.description + '</span>' +
          '<span class="item-meta" data-meta></span>' +
        '</div>' +
        '<div class="item-buy">' +
          '<div class="item-cost" data-cost></div>' +
          '<div class="item-qty" data-qty></div>' +
        '</div>';

      row.addEventListener('click', function () {
        var bought = DC.Workers.buy(def.id, Game.state.settings.buyAmount);
        if (bought > 0) DC.Audio.play('buyWorker');
      });

      list.appendChild(row);
      workerRows[def.id] = {
        row: row,
        owned: row.querySelector('[data-owned]'),
        meta: row.querySelector('[data-meta]'),
        cost: row.querySelector('[data-cost]'),
        qty: row.querySelector('[data-qty]')
      };
    });
  }

  function refreshWorkers() {
    var amount = Game.state.settings.buyAmount;
    CONFIG.workers.forEach(function (def) {
      var ref = workerRows[def.id];
      if (!ref) return;
      var v = DC.Workers.view(def, amount);
      ref.owned.textContent = v.owned ? '×' + N.withCommas(v.owned) : '';
      ref.meta.textContent = v.owned
        ? N.formatRate(v.each) + '/sec each · ' + N.formatRate(v.total) + '/sec total'
        : N.formatRate(v.each) + '/sec each';
      ref.cost.textContent = N.format(v.cost);
      ref.qty.textContent = v.amount > 1 ? 'buy ' + N.withCommas(v.amount) : 'Durians';
      ref.row.classList.toggle('affordable', v.canAfford);
      ref.row.classList.toggle('broke', !v.canAfford);
      ref.row.disabled = !v.canAfford;
    });
  }

  /* ------------------------------------------------------------ upgrades */

  var upgradeFilter = 'all';
  var upgradeSearch = '';
  var upgradeLimit = 40;          // 166 upgrades in one list is unreadable

  function matchesSearch(def) {
    if (!upgradeSearch) return true;
    var q = upgradeSearch.toLowerCase();
    return def.name.toLowerCase().indexOf(q) !== -1 ||
           def.description.toLowerCase().indexOf(q) !== -1;
  }

  function buildUpgrades() {
    var list = el['upgrade-list'];
    list.innerHTML = '';
    upgradeRows = {};

    var available = CONFIG.upgrades.filter(function (u) {
      if (!Game.state.unlocked[u.id]) return false;
      if (DC.Upgrades.owned(u.id) && !u.repeatable) return false;
      if (!matchesSearch(u)) return false;
      if (upgradeFilter === 'afford' && !N.gte(Game.state.durians, DC.Upgrades.costOf(u))) return false;
      return true;
    });
    available.sort(function (a, b) { return N.cmp(DC.Upgrades.costOf(a), DC.Upgrades.costOf(b)); });

    var lockedTeaser = (!upgradeSearch && upgradeFilter === 'all')
      ? CONFIG.upgrades.filter(function (u) { return !Game.state.unlocked[u.id]; })[0]
      : null;

    var shown = available.slice(0, upgradeLimit);

    el['upgrade-count'].textContent = available.length
      ? (available.length > shown.length
          ? 'Showing ' + shown.length + ' of ' + available.length + ' available'
          : available.length + ' available')
      : '';
    el['upgrade-more'].hidden = available.length <= shown.length;

    if (!available.length) {
      list.innerHTML = '<p class="empty-note">' + (
        upgradeSearch ? 'Nothing matches that search.'
        : upgradeFilter === 'afford' ? "Nothing you can afford just yet. Keep harvesting."
        : lockedTeaser ? 'No upgrades on the shelf right now. Keep clicking and hiring — more show up as you go.'
        : 'Every upgrade on the island is yours. Astonishing.'
      ) + '</p>';
    }

    shown.forEach(function (def) {
      var row = document.createElement('button');
      row.className = 'item';
      row.type = 'button';
      row.innerHTML =
        '<img class="item-icon" src="' + (def.icon || CONFIG.assets.upgradeDefault) + '" alt="">' +
        '<div>' +
          '<span class="item-name">' + escapeHtml(def.name) + '</span>' +
          '<span class="item-desc">' + escapeHtml(def.description) + '</span>' +
          '<span class="item-meta">' + escapeHtml(DC.Upgrades.describeEffects(def)) + '</span>' +
        '</div>' +
        '<div class="item-buy"><div class="item-cost" data-cost></div><div class="item-qty">Durians</div></div>';

      row.addEventListener('click', function () {
        if (DC.Upgrades.buy(def.id)) DC.Audio.play('buyUpgrade');
      });

      list.appendChild(row);
      upgradeRows[def.id] = { row: row, cost: row.querySelector('[data-cost]') };
    });

    if (lockedTeaser && shown.length === available.length) {
      var locked = document.createElement('div');
      locked.className = 'item locked';
      locked.innerHTML =
        '<img class="item-icon" src="' + (lockedTeaser.icon || CONFIG.assets.upgradeDefault) + '" alt="">' +
        '<div><span class="item-name">???</span>' +
        '<span class="item-lock">\u{1F512} ' + Game.describeRequirement(lockedTeaser.unlock) + '</span></div>' +
        '<div class="item-buy"></div>';
      list.appendChild(locked);
    }

    // Purchased upgrades collapse into a trophy grid so they don't swamp the tab.
    var owned = CONFIG.upgrades.filter(function (u) { return DC.Upgrades.owned(u.id); });
    el['owned-details'].hidden = owned.length === 0;
    el['owned-count'].textContent = owned.length;
    el['owned-upgrades'].innerHTML = owned.map(function (u) {
      return '<div class="owned-upgrade" title="' + escapeHtml(u.name + ' \u2014 ' + u.description) + '">' +
             '<img src="' + (u.icon || CONFIG.assets.upgradeDefault) + '" alt="' + escapeHtml(u.name) + '"></div>';
    }).join('');
  }

  function refreshUpgrades() {
    Object.keys(upgradeRows).forEach(function (id) {
      var def = Game.upgradeDef(id);
      var ref = upgradeRows[id];
      var v = DC.Upgrades.view(def);
      ref.cost.textContent = N.format(v.cost);
      ref.row.classList.toggle('affordable', v.canAfford);
      ref.row.classList.toggle('broke', !v.canAfford);
      ref.row.disabled = !v.canAfford;
    });

    // The pip has to consider every unlocked upgrade, not only the visible page.
    var anyAffordable = false;
    for (var i = 0; i < CONFIG.upgrades.length; i++) {
      var u = CONFIG.upgrades[i];
      if (!Game.state.unlocked[u.id]) continue;
      if (DC.Upgrades.owned(u.id) && !u.repeatable) continue;
      if (N.gte(Game.state.durians, DC.Upgrades.costOf(u))) { anyAffordable = true; break; }
    }
    el['pip-upgrades'].hidden = !anyAffordable;
  }

  /* -------------------------------------------------------- achievements */

  function buildAchievements() {
    el['ach-progress-text'].textContent = DC.Achievements.progressText();
    el['achievement-list'].innerHTML = DC.Achievements.list().map(function (a) {
      var title = a.earned ? a.def.name + ' — ' + a.def.description : 'Locked — ' + a.def.description;
      return '<div class="ach' + (a.earned ? ' earned' : '') + '" title="' + title + '">' +
             '<img src="' + CONFIG.assets.shine + '" alt="">' +
             '<div class="ach-name">' + (a.earned ? a.def.name : '???') + '</div></div>';
    }).join('');
  }

  /* ---------------------------------------------------------------- stats */

  /* Each stat is [key, label, valueFn]. Add a line by adding an entry. */
  function statGroups() {
    var s = Game.state, d = Game.derived;
    var crew = CONFIG.workers.filter(function (w) { return s.unlocked[w.id]; })
      .map(function (w) {
        return ['crew_' + w.id, w.plural || w.name + 's', function () {
          return N.withCommas(Game.state.workers[w.id] || 0) + ' · ' +
                 N.formatRate(Game.derived.workerDps[w.id]) + '/sec';
        }];
      });
    if (!crew.length) crew = [['crew_none', 'No crew hired yet', function () { return '—'; }]];

    return [
      { title: 'Durians', open: true, rows: [
        ['bank', 'In the bank', function () { return N.format(Game.state.durians); }],
        ['alltime', 'Earned all-time', function () { return N.format(Game.state.totalEarned); }],
        ['byclick', 'Earned by clicking', function () { return N.format(Game.state.clickEarned); }],
        ['bycrew', 'Earned by your crew', function () { return N.format(Game.state.workerEarned); }],
        ['spent', 'Spent', function () { return N.format(Game.state.spent); }]
      ] },
      { title: 'Production', open: true, rows: [
        ['perclick', 'Durians per click', function () { return N.format(Game.derived.clickPower); }],
        ['persec', 'Durians per second', function () { return N.formatRate(Game.derived.dps); }],
        ['clicks', 'Total clicks', function () { return N.withCommas(Game.state.totalClicks); }],
        ['globalmult', 'Global multiplier', function () { return '×' + Game.derived.globalMult.toFixed(2); }]
      ] },
      { title: 'Crew', open: true, rows: crew.concat([
        ['hired', 'Workers hired', function () { return N.withCommas(Game.derived.totalWorkers); }]
      ]) },
      { title: 'Progress', open: false, rows: [
        ['upgrades', 'Upgrades purchased', function () { return Game.derived.upgradesBought + ' / ' + CONFIG.upgrades.length; }],
        ['achievements', 'Achievements', function () { return DC.Achievements.progressText(); }],
        ['playtime', 'Play time', function () { return N.formatDuration(Game.state.playTime); }],
        ['started', 'Started', function () { return new Date(Game.state.startedAt).toLocaleDateString(); }]
      ] }
    ];
  }

  var statRefs = [];

  function buildStats() {
    var html = '', groups = statGroups();
    statRefs = [];
    groups.forEach(function (g) {
      html += '<details class="stats-group"' + (g.open ? ' open' : '') + '><summary>' + g.title + '</summary>';
      g.rows.forEach(function (r) {
        html += '<div class="stat-row"><dt>' + r[1] + '</dt><dd data-stat="' + r[0] + '">—</dd></div>';
      });
      html += '</details>';
    });
    el['stats-list'].innerHTML = html;
    groups.forEach(function (g) {
      g.rows.forEach(function (r) {
        var node = el['stats-list'].querySelector('[data-stat="' + r[0] + '"]');
        if (node) statRefs.push({ node: node, get: r[2] });
      });
    });
    refreshStats();
  }

  /** Only the numbers change here, so open/closed groups keep their state. */
  function refreshStats() {
    if (currentTab !== 'stats') return;
    statRefs.forEach(function (ref) { ref.node.textContent = ref.get(); });
  }

  /* ------------------------------------------------------- buffs + events */

  function refreshBuffs() {
    var buffs = DC.IslandEvents ? DC.IslandEvents.activeBuffs() : [];
    var bar = el['buff-bar'];
    if (!buffs.length) { bar.innerHTML = ''; return; }
    var now = Date.now();
    bar.innerHTML = buffs.map(function (b) {
      var left = Math.max(0, Math.ceil((b.endsAt - now) / 1000));
      var bad = (b.prod !== undefined && b.prod < 1);
      return '<span class="buff' + (bad ? ' buff-bad' : '') + '">' +
             escapeHtml(b.label) + ' <em>' + left + 's</em></span>';
    }).join('');
  }

  var eventTimer = null;

  function showEvent(result) {
    var def = result.def;
    el['event-icon'].src = def.icon || CONFIG.assets.shine;
    el['event-title'].textContent = def.title || def.name;
    el['event-text'].textContent = result.text || '';

    var amount = el['event-amount'];
    amount.className = 'event-amount';
    if (result.direction === 'gain') {
      amount.textContent = '+' + N.format(result.amount) + ' Durians';
      amount.classList.add('is-gain');
    } else if (result.direction === 'loss') {
      amount.textContent = '-' + N.format(result.amount) + ' Durians';
      amount.classList.add('is-loss');
    } else if (result.seconds) {
      amount.textContent = Math.round(result.seconds) + ' seconds';
      amount.classList.add(result.direction === 'debuff' ? 'is-loss' : 'is-gain');
    } else {
      amount.textContent = '';
    }

    var banner = el['event-banner'];
    banner.classList.toggle('is-bad', result.direction === 'loss' || result.direction === 'debuff');
    banner.hidden = false;
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');

    DC.Audio.play(result.direction === 'loss' || result.direction === 'debuff' ? 'unlock' : 'achievement');

    clearTimeout(eventTimer);
    eventTimer = setTimeout(hideEvent, (CONFIG.events_settings.bannerSeconds || 8) * 1000);
    refreshBuffs();
    refreshCounters();
  }

  function hideEvent() { el['event-banner'].hidden = true; }

  /* ---------------------------------------------------------- leaderboard */

  function buildBoardSwitch() {
    var wrap = el['board-switch'];
    wrap.innerHTML = '';
    DC.Leaderboard.boards().forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.label;
      btn.dataset.board = b.id;
      btn.className = b.id === DC.Leaderboard.state.board ? 'is-active' : '';
      btn.addEventListener('click', function () {
        DC.Leaderboard.load(b.id);
        buildBoardSwitch();
      });
      wrap.appendChild(btn);
    });
  }

  function refreshBoardHeader() {
    var lb = DC.Leaderboard;
    var name = lb.getName();
    el['board-name'].textContent = name || 'not set';
    el['btn-board-name'].textContent = name ? 'Change name' : 'Set name';
    el['btn-board-submit'].disabled = !name;

    var rank = lb.state.yourRank;
    el['board-rank'].textContent = !name
      ? 'Set a name to appear on the board.'
      : (rank ? 'You are #' + N.withCommas(rank) : '');

    var status = lb.state;
    el['board-status'].textContent = status.message || '';
    el['board-status'].classList.toggle('is-error', status.status === 'error');

    el['board-note'].innerHTML = lb.isOnline()
      ? 'Scores are self-reported and not verified — treat this as a fun board, not a record sheet.'
      : '<strong>Local demo mode.</strong> These scores live on this device only. ' +
        'Set <code>leaderboard.provider</code> in <code>js/config.js</code> to go online — see the README.';
  }

  function renderBoard() {
    var lb = DC.Leaderboard;
    var board = lb.boardDef();
    var list = el['board-list'];

    if (!lb.state.entries.length) {
      list.innerHTML = lb.state.status === 'loading'
        ? '<li class="empty-note">Loading…</li>'
        : '<li class="empty-note">Nobody on the board yet. Be the first.</li>';
      refreshBoardHeader();
      return;
    }

    list.innerHTML = lb.state.entries.map(function (e) {
      var meta = [];
      if (e.play_time) meta.push(N.formatDuration(e.play_time) + ' played');
      if (e.workers) meta.push(N.withCommas(e.workers) + ' crew');
      return '<li class="board-row' + (e.isYou ? ' is-you' : '') + (e.rank === 1 ? ' top1' : '') + '">' +
        '<div class="board-rank">' + e.rank + '</div>' +
        '<div class="board-player">' +
          '<div class="board-player-name">' + escapeHtml(e.name || 'Anonymous') + '</div>' +
          '<div class="board-player-meta">' + meta.join(' · ') + '</div>' +
        '</div>' +
        '<div class="board-score">' + escapeHtml(e[board.displayKey] || '—') + '</div>' +
      '</li>';
    }).join('');

    refreshBoardHeader();
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function openNameModal() {
    el['name-input'].value = DC.Leaderboard.getName();
    el['name-error'].textContent = '';
    openModal('modal-name');
    setTimeout(function () { el['name-input'].focus(); }, 50);
  }

  function saveName() {
    var raw = el['name-input'].value.trim();
    if (raw.length < 2) {
      el['name-error'].textContent = 'Names need at least two characters.';
      return;
    }
    DC.Leaderboard.setName(raw);
    closeModal('modal-name');
    refreshBoardHeader();
    DC.Save.save(true);
    DC.Leaderboard.submit({ ignoreThrottle: true, force: true }).then(function () {
      DC.Leaderboard.load();
    });
  }

  /* ----------------------------------------------------------------- tabs */

  var currentTab = 'workers';

  function selectTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.tab-page').forEach(function (p) {
      var on = p.id === 'page-' + name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (name === 'stats') buildStats();
    if (name === 'leaderboard') {
      buildBoardSwitch();
      refreshBoardHeader();
      // Don't re-hit the network on every tab switch.
      if (Date.now() - DC.Leaderboard.state.lastFetch > 30000) DC.Leaderboard.load();
      else renderBoard();
    }
  }

  /* --------------------------------------------------------------- toasts */

  function toast(title, subtitle, kind, icon) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<img src="' + (icon || CONFIG.assets.shine) + '" alt="">' +
                  '<div><strong>' + title + '</strong><span>' + (subtitle || '') + '</span></div>';
    el['toasts'].appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  /* --------------------------------------------------------------- modals */

  function openModal(id) { $(id).hidden = false; }
  function closeModal(id) {
    $(id).hidden = true;
    if (id === 'modal-confirm') confirmCallback = null;
  }

  var confirmCallback = null;
  function confirmDialog(title, text, onYes) {
    el['confirm-title'].textContent = title;
    el['confirm-text'].textContent = text;
    confirmCallback = onYes;
    openModal('modal-confirm');
  }

  function showOffline(info) {
    el['offline-text'].textContent = 'Your crew kept working for ' + N.formatDuration(info.cappedSeconds) + '.';
    el['offline-amount'].textContent = N.format(info.amount) + ' Durians';
    el['offline-sub'].textContent = info.wasCapped
      ? 'Offline earnings are capped at ' + N.formatDuration(CONFIG.offline.maxSeconds) + '.'
      : '';
    openModal('modal-offline');
    DC.Audio.play('offline');
  }

  /* -------------------------------------------------------------- wiring */

  function bindEvents() {
    // Durian: pointerdown feels snappier than click, and covers touch.
    el['durian-button'].addEventListener('pointerdown', handleClick);
    el['durian-button'].addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e); }
    });
    // The button already fires on pointerdown; stop the synthetic click too.
    el['durian-button'].addEventListener('click', function (e) { e.preventDefault(); });

    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { selectTab(t.dataset.tab); });
    });

    el['buy-amount'].addEventListener('click', function (e) {
      var btn = e.target.closest('.amt');
      if (!btn) return;
      var raw = btn.dataset.amount;
      Game.state.settings.buyAmount = raw === 'max' ? 'max' : parseInt(raw, 10);
      document.querySelectorAll('.amt').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      refreshWorkers();
    });

    // volume + mute (two copies: topbar and settings modal)
    [el['volume-slider'], el['volume-slider-2']].forEach(function (slider) {
      slider.addEventListener('input', function () { DC.Audio.setVolume(slider.value / 100); });
    });
    [el['btn-mute'], el['btn-mute-2']].forEach(function (btn) {
      btn.addEventListener('click', function () { DC.Audio.toggleMute(); });
    });
    DC.Events.on('audioSettings', function (a) {
      el['volume-slider'].value = Math.round(a.volume * 100);
      el['volume-slider-2'].value = Math.round(a.volume * 100);
      el['btn-mute'].textContent = a.muted ? '🔇' : '🔊';
      el['btn-mute'].setAttribute('aria-pressed', a.muted ? 'true' : 'false');
      el['btn-mute-2'].textContent = a.muted ? 'Unmute' : 'Mute';
    });

    // settings modal
    $('btn-settings').addEventListener('click', function () { openModal('modal-settings'); });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(b.dataset.close); });
    });
    document.querySelectorAll('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m && m.id !== 'modal-offline') closeModal(m.id);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ['modal-settings', 'modal-confirm', 'modal-name'].forEach(closeModal);
      }
    });

    $('btn-save').addEventListener('click', function () {
      var ok = DC.Save.save();
      note(ok ? 'Game saved.' : 'Save failed — check that your browser allows local storage.');
    });
    $('btn-export').addEventListener('click', function () {
      el['save-box'].value = DC.Save.exportString();
      el['save-box'].select();
      note('Save code ready. Copy it somewhere safe.');
    });
    $('btn-download').addEventListener('click', function () {
      DC.Save.downloadSaveFile();
      note('Save file downloaded.');
    });
    $('btn-copy').addEventListener('click', function () {
      if (!el['save-box'].value) el['save-box'].value = DC.Save.exportString();
      el['save-box'].select();
      var done = function () { note('Copied to clipboard.'); };
      if (navigator.clipboard) navigator.clipboard.writeText(el['save-box'].value).then(done, function () {
        document.execCommand('copy'); done();
      });
      else { document.execCommand('copy'); done(); }
    });
    $('btn-import').addEventListener('click', function () {
      var text = el['save-box'].value.trim();
      if (!text) return note('Paste a save code into the box first.');
      confirmDialog('Import this save?', 'Your current progress will be replaced by the pasted save.', function () {
        if (DC.Save.importString(text)) {
          rebuildAll();
          note('Save imported.');
          toast('Save imported', 'Welcome back to Isle Delfino.', 'unlock');
        } else {
          note("That save code couldn't be read. Check you copied all of it.");
        }
      });
    });
    $('btn-reset').addEventListener('click', function () {
      confirmDialog('Reset everything?', 'This wipes your Durians, crew, upgrades and achievements. It cannot be undone.', function () {
        DC.Save.wipe();
        Game.reset(true);
        DC.Save.save(true);
        rebuildAll();
        note('Save reset. Fresh island.');
      });
    });

    $('confirm-cancel').addEventListener('click', function () { closeModal('modal-confirm'); confirmCallback = null; });
    $('confirm-ok').addEventListener('click', function () {
      closeModal('modal-confirm');
      var cb = confirmCallback; confirmCallback = null;
      if (cb) cb();
    });

    el['btn-board-name'].addEventListener('click', openNameModal);
    el['name-input'].addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveName(); }
    });
    $('name-save').addEventListener('click', saveName);

    el['btn-board-submit'].addEventListener('click', function () {
      if (!DC.Leaderboard.getName()) return openNameModal();
      DC.Leaderboard.submit({ force: true }).then(function (res) {
        if (res.ok) {
          toast('Score submitted', 'You are on the board.', 'unlock');
          DC.Leaderboard.load();
        } else if (res.reason === 'throttled') {
          el['board-status'].textContent = 'Hold on ' + res.wait + 's before submitting again.';
        }
      });
    });
    el['btn-board-refresh'].addEventListener('click', function () { DC.Leaderboard.load(); });

    el['upgrade-search'].addEventListener('input', function () {
      upgradeSearch = el['upgrade-search'].value.trim();
      upgradeLimit = 40;
      buildUpgrades();
      refreshUpgrades();
    });
    document.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        upgradeFilter = b.dataset.filter;
        upgradeLimit = 40;
        document.querySelectorAll('[data-filter]').forEach(function (x) {
          x.classList.toggle('is-active', x === b);
        });
        buildUpgrades();
        refreshUpgrades();
      });
    });
    el['upgrade-more'].addEventListener('click', function () {
      upgradeLimit += 60;
      buildUpgrades();
      refreshUpgrades();
    });

    $('event-close').addEventListener('click', hideEvent);
    DC.Events.on('islandEvent', showEvent);
    DC.Events.on('buffsChanged', refreshBuffs);

    DC.Events.on('leaderboardLoaded', renderBoard);
    DC.Events.on('leaderboardStatus', function () {
      if (currentTab === 'leaderboard') refreshBoardHeader();
    });

    $('offline-collect').addEventListener('click', function () {
      DC.Offline.collect();
      closeModal('modal-offline');
      refreshCounters();
    });

    /* ---- game events -> UI ---- */
    DC.Events.on('render', function () {
      refreshCounters();
      refreshWorkers();
      refreshUpgrades();
      refreshStats();
      refreshBuffs();
    });
    DC.Events.on('unlock', function (opened) {
      buildWorkers();
      buildUpgrades();
      buildStats();
      DC.Audio.play('unlock');
      // A returning player can unlock dozens at once after a content update.
      // Show a few, then summarise, rather than burying the screen in toasts.
      var MAX_TOASTS = 3;
      opened.slice(0, MAX_TOASTS).forEach(function (o) {
        var isWorker = o.kind === 'worker';
        toast(isWorker ? o.item.name + ' available!' : 'New upgrade: ' + o.item.name,
              isWorker ? o.item.flavor || o.item.description : o.item.description,
              'unlock',
              isWorker ? o.item.image : (o.item.icon || CONFIG.assets.upgradeDefault));
      });
      if (opened.length > MAX_TOASTS) {
        toast((opened.length - MAX_TOASTS) + ' more unlocked',
              'Check the Upgrades tab.', 'unlock');
      }
    });
    DC.Events.on('achievement', function (list) {
      buildAchievements();
      DC.Audio.play('achievement');
      list.slice(0, 3).forEach(function (a) { toast('Shine get: ' + a.name, a.description); });
      if (list.length > 3) {
        toast((list.length - 3) + ' more Shines earned', 'Check the Shines tab.');
      }
    });
    DC.Events.on('buyWorker', function () { buildUpgrades(); refreshWorkers(); });
    DC.Events.on('buyUpgrade', function () { buildUpgrades(); buildWorkers(); });
    DC.Events.on('offlineEarnings', showOffline);
    DC.Events.on('saved', function () { note('Saved ' + new Date().toLocaleTimeString() + '.'); });
  }

  function note(text) {
    el['settings-note'].textContent = text;
    clearTimeout(note._t);
    note._t = setTimeout(function () {
      el['settings-note'].textContent = 'Progress saves automatically every few seconds.';
    }, 4000);
  }

  /* --------------------------------------------------------------- public */

  function rebuildAll() {
    buildWorkers();
    buildUpgrades();
    buildAchievements();
    buildStats();
    refreshCounters();
    refreshWorkers();
    refreshUpgrades();
    refreshStats();
    syncBuyAmountButtons();
  }

  function syncBuyAmountButtons() {
    var amount = String(Game.state.settings.buyAmount);
    document.querySelectorAll('.amt').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.amount === amount);
    });
  }

  function init() {
    cache();
    applyAssets();
    bindEvents();
    rebuildAll();
    selectTab('workers');
  }

  DC.UI = {
    init: init,
    rebuildAll: rebuildAll,
    toast: toast,
    confirmDialog: confirmDialog,
    selectTab: selectTab,
    refreshCounters: refreshCounters
  };
})(window.DC = window.DC || {});
