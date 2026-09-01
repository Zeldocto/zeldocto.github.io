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
     'event-title', 'event-text', 'event-amount', 'tip', 'number-format',
     'update-bar', 'update-icon', 'update-line', 'store-icon', 'casino-icon', 'coin-chip',
     'coin-chip-icon', 'mini-coins', 'coin-layer', 'store-list', 'store-balance',
     'store-owned', 'skin-grid', 'reels', 'slots-result', 'bet-row', 'btn-spin',
     'coin-balance', 'spin-coin-icon', 'lead-coin-icon', 'paytable', 'btn-skins',
     'slots-hint', 'slots-payout', 'slots-outcome',
     'btn-dark', 'dark-toggle', 'buy-custom',
     'news-bar', 'news-icon', 'news-line', 'changelog-body', 'brand-version', 'changelog-title'
    ].forEach(function (id) { el[id] = $(id); });
  }

  /* ----------------------------------------------------------- changelog */

  function buildChangelog(onlyLatest) {
    var list = DC.Changelog.entries();
    if (onlyLatest) list = list.slice(0, 1);
    el['changelog-body'].innerHTML = list.map(function (entry, i) {
      return '<section class="changelog-entry' + (i === 0 ? ' is-latest' : '') + '">' +
        '<h3>' + escapeHtml(entry.title || entry.version) +
        '<span>' + escapeHtml(entry.version) + '</span></h3>' +
        '<ul>' + (entry.notes || []).map(function (n) {
          return '<li>' + escapeHtml(n) + '</li>';
        }).join('') + '</ul></section>';
    }).join('') || '<p class="empty-note">Nothing to report yet.</p>';
  }

  /** From the "What's new" prompt: just the release they have not read. */
  function openChangelog() {
    el['changelog-title'].textContent = 'What\u2019s new';
    buildChangelog(true);
    openModal('modal-changelog');
    DC.Changelog.markRead();
    el['news-bar'].hidden = true;
  }

  /** From Settings: the whole history, any time. */
  function openFullChangelog() {
    el['changelog-title'].textContent = 'Changelog';
    buildChangelog(false);
    closeModal('modal-settings');
    openModal('modal-changelog');
  }

  /* -------------------------------------------------------- update prompt */

  var updateTimer = null;

  function stopUpdateCountdown() {
    if (updateTimer) { clearInterval(updateTimer); updateTimer = null; }
  }

  function startUpdateCountdown(info) {
    stopUpdateCountdown();
    if (!info || !info.autoReload) {
      el['update-line'].innerHTML = info && info.loopGuarded
        ? 'The new files are not coming through. Press <kbd>Ctrl</kbd> + ' +
          '<kbd>Shift</kbd> + <kbd>R</kbd> to force a refresh.'
        : 'Refresh whenever you are ready \u2014 or hit the button.';
      return;
    }

    var left = info.seconds || 10;
    var tick = function () {
      el['update-line'].textContent = left > 0
        ? 'Reloading in ' + left + '\u2026'
        : 'Reloading\u2026';
      if (left <= 0) {
        stopUpdateCountdown();
        DC.Updates.reloadNow();
        return;
      }
      left--;
    };
    tick();
    updateTimer = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------ dark mode */

  function applyDarkMode() {
    var on = !!Game.state.settings.darkMode;
    document.body.classList.toggle('dark', on);
    el['btn-dark'].textContent = on ? '☀' : '🌙';
    el['btn-dark'].setAttribute('aria-pressed', on ? 'true' : 'false');
    el['btn-dark'].title = on ? 'Switch to Bright Island' : 'Switch to Eclipsed';
    el['dark-toggle'].value = on ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', on ? '#0A2334' : '#0E86B8');
  }

  function setDarkMode(on) {
    Game.state.settings.darkMode = !!on;
    applyDarkMode();
    DC.Save.save(true);
  }

  /* --------------------------------------------------------------- assets */

  function applyAssets() {
    el['durian-img'].src = CONFIG.assets.durian;
    el['brand-shine'].src = CONFIG.assets.shine;
    el['scene-img'].style.backgroundImage = 'url("' + CONFIG.assets.background + '")';
    el['store-icon'].src = CONFIG.assets.store;
    if (el['brand-version'] && CONFIG.version) {
      el['brand-version'].textContent = 'v' + CONFIG.version;
    }
    el['casino-icon'].src = CONFIG.assets.slots;
    el['coin-chip-icon'].src = CONFIG.assets.blueCoin;
    el['spin-coin-icon'].src = CONFIG.assets.blueCoin;
    el['lead-coin-icon'].src = CONFIG.assets.blueCoin;
    applySkin();
    applyDarkMode();
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
    text.textContent = '+' + N.formatMenu(amount);
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
    if (suppressCounters) return;
    var s = Game.state, d = Game.derived;
    el['durian-count'].textContent = N.format(s.durians);
    el['dps-line'].textContent = N.formatRate(d.dps) + ' per second';
    el['click-power'].textContent = N.format(d.clickPower);
    el['mini-total'].textContent = N.format(s.totalEarned);
    el['mini-shines'].textContent = DC.Achievements.earnedCount() + '/' + DC.Achievements.total();
    if (DC.Coins) {
      el['mini-coins'].textContent = N.withCommas(DC.Coins.count());
      el['coin-balance'].textContent = DC.Coins.count();
    }

    var now = performance.now();
    if (now - lastTitleUpdate > 1000) {
      lastTitleUpdate = now;
      document.title = N.formatMenu(s.durians) + ' Durians — Durian Clicker';
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
      ref.cost.textContent = N.formatMenu(v.cost);
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
    el['owned-upgrades'].innerHTML = '';
    owned.forEach(function (u) {
      var node = document.createElement('div');
      node.className = 'owned-upgrade';
      node.tabIndex = 0;
      node.innerHTML = '<img src="' + (u.icon || CONFIG.assets.upgradeDefault) +
                       '" alt="' + escapeHtml(u.name) + '">';
      bindTip(node, function () {
        return tipHtml(u.name, u.description, DC.Upgrades.describeEffects(u) || 'Purchased');
      });
      el['owned-upgrades'].appendChild(node);
    });
  }

  function refreshUpgrades() {
    Object.keys(upgradeRows).forEach(function (id) {
      var def = Game.upgradeDef(id);
      var ref = upgradeRows[id];
      var v = DC.Upgrades.view(def);
      ref.cost.textContent = N.formatMenu(v.cost);
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

  var achGroupOpen = {};      // remembers which categories the player opened

  function buildAchievements() {
    el['ach-progress-text'].textContent = DC.Achievements.progressText();
    var wrap = el['achievement-list'];
    wrap.innerHTML = '';

    // Keep each category together, in the order the content file declares them.
    var order = [], buckets = {};
    DC.Achievements.list().forEach(function (a) {
      var g = a.def.group || 'Milestones';
      if (!buckets[g]) { buckets[g] = []; order.push(g); }
      buckets[g].push(a);
    });

    order.forEach(function (groupName) {
      var items = buckets[groupName];
      var earned = items.filter(function (a) { return a.earned; }).length;
      var complete = earned === items.length;

      var box = document.createElement('details');
      box.className = 'ach-group';
      // Finished categories fold away; anything still in progress stays open.
      box.open = achGroupOpen[groupName] !== undefined ? achGroupOpen[groupName] : !complete;
      box.addEventListener('toggle', function () { achGroupOpen[groupName] = box.open; });

      var head = document.createElement('summary');
      head.className = 'ach-group-title';
      head.innerHTML = escapeHtml(groupName) +
                       ' <span>' + earned + '/' + items.length + '</span>';
      box.appendChild(head);

      var grid = document.createElement('div');
      grid.className = 'ach-grid';

      items.forEach(function (a) {
        var node = document.createElement('div');
        node.className = 'ach' + (a.earned ? ' earned' : '');
        node.tabIndex = 0;
        node.setAttribute('aria-label',
          a.earned ? a.def.name + ' — earned' : 'Locked: ' + a.def.description);
        node.innerHTML = '<img src="' + CONFIG.assets.shine + '" alt="">';

        bindTip(node, function () {
          var note;
          if (a.earned) {
            note = a.earnedAt
              ? 'Earned ' + new Date(a.earnedAt).toLocaleDateString() + ' at ' +
                new Date(a.earnedAt).toLocaleTimeString()
              : 'Earned';
          } else {
            note = 'Not yet earned';
          }
          return tipHtml(a.earned ? a.def.name : 'Locked Shine', a.def.description, note);
        });

        grid.appendChild(node);
      });

      box.appendChild(grid);
      wrap.appendChild(box);
    });
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
        ['bank', 'In the bank', function () { return N.formatMenu(Game.state.durians); }],
        ['alltime', 'Earned all-time', function () { return N.formatMenu(Game.state.totalEarned); }],
        ['byclick', 'Earned by clicking', function () { return N.formatMenu(Game.state.clickEarned); }],
        ['bycrew', 'Earned by your crew', function () { return N.formatMenu(Game.state.workerEarned); }],
        ['spent', 'Spent', function () { return N.formatMenu(Game.state.spent); }]
      ] },
      { title: 'Production', open: true, rows: [
        ['perclick', 'Durians per click', function () { return N.formatMenu(Game.derived.clickPower); }],
        ['persec', 'Durians per second', function () {
          var d = Game.derived;
          var boosted = N.toNumber(d.dps), base = N.toNumber(d.baseDps);
          if (base > 0 && boosted / base > 1.001) {
            return N.formatRate(d.dps) + '  (base ' + N.formatRate(d.baseDps) + ')';
          }
          return N.formatRate(d.dps);
        }],
        ['clicks', 'Total clicks', function () { return N.withCommas(Game.state.totalClicks); }],
        ['cps_now', 'Clicks per second, now', function () { return N.withCommas(Game.currentClickRate()); }],
        ['cps_avg', 'Clicks per second, average', function () { return Game.averageClickRate().toFixed(2); }],
        ['cps_peak', 'Clicks per second, peak', function () { return N.withCommas(Game.state.peakClickRate || 0); }],
        ['globalmult', 'Global multiplier', function () { return '×' + Game.derived.globalMult.toFixed(2); }]
      ] },
      { title: 'Crew', open: true, rows: crew.concat([
        ['hired', 'Workers hired', function () { return N.withCommas(Game.derived.totalWorkers); }]
      ]) },
      { title: 'Island events', open: true, rows: [
        ['ev_total', 'Events witnessed', function () { return N.withCommas(Game.state.events.total || 0); }],
        ['ev_gained', 'Gained from events', function () { return N.formatMenu(Game.state.eventGained || N.ZERO); }],
        ['ev_lost', 'Lost to setbacks', function () { return N.formatMenu(Game.state.lost || N.ZERO); }],
        ['ev_buffs', 'Active effects', function () {
          if (!DC.IslandEvents) return 'none';
          var b = DC.IslandEvents.activeBuffs();
          if (!b.length) return 'none';
          return b.map(function (x) { return x.label; }).join(', ');
        }],
        ['ev_next', 'Next event in', function () {
          if (!DC.IslandEvents) return '\u2014';
          var t = DC.IslandEvents.timeUntilNext();
          return t === null ? '—' : N.formatDuration(t);
        }]
      ].concat(eventBreakdown()) },
      { title: 'Blue Coins', open: false, rows: [
        ['coin_have', 'Blue Coins held', function () { return N.withCommas(DC.Coins.count()); }],
        ['coin_found', 'Blue Coins collected', function () { return N.withCommas(Game.state.coins.collected || 0); }],
        ['coin_spent', 'Spent at the slots', function () { return N.withCommas(Game.state.casino.coinsSpent || 0); }],
        ['skins_owned', 'Skins owned', function () { return DC.Store.ownedCount() + '/' + DC.Store.all().length; }]
      ] },
      { title: 'Gambling', open: false, rows: [
        ['g_spins', 'Spins played', function () { return N.withCommas(Game.state.casino.spins || 0); }],
        ['g_wins', 'Spins won', function () { return N.withCommas(Game.state.casino.wins || 0); }],
        ['g_losses', 'Spins lost', function () {
          var c = Game.state.casino;
          return N.withCommas(Math.max(0, (c.spins || 0) - (c.wins || 0)));
        }],
        ['g_rate', 'Win rate', function () {
          var c = Game.state.casino;
          return c.spins ? (c.wins / c.spins * 100).toFixed(1) + '%' : '\u2014';
        }],
        ['g_wagered', 'Total wagered', function () { return N.formatMenu(Game.state.casino.wagered || N.ZERO); }],
        ['g_won', 'Total won back', function () { return N.formatMenu(Game.state.casino.won || N.ZERO); }],
        ['g_net', 'Net result', function () {
          var net = N.sub(Game.state.casino.won || N.ZERO, Game.state.casino.wagered || N.ZERO);
          return (net.m < 0 ? '\u2212' : '+') + N.formatMenu(net.m < 0 ? N.neg(net) : net);
        }],
        ['g_return', 'Return on stake', function () {
          var c = Game.state.casino;
          if (!c.wagered || c.wagered.m === 0) return '\u2014';
          return (N.toNumber(N.div(c.won || N.ZERO, c.wagered)) * 100).toFixed(1) + '%';
        }],
        ['g_biggest', 'Biggest single win', function () { return N.formatMenu(Game.state.casino.biggestWin || N.ZERO); }],
        ['g_triples', 'Three of a kind', function () { return N.withCommas(Game.state.casino.triples || 0); }],
        ['g_jack', 'Blue Coin jackpots', function () { return N.withCommas(Game.state.casino.jackpots || 0); }],
        ['g_streak', 'Longest losing streak', function () { return N.withCommas(Game.state.casino.worstStreak || 0); }],
        ['g_house', 'House edge by design', function () {
          return DC.Casino ? (100 - DC.Casino.expectedReturn() * 100).toFixed(1) + '%' : '\u2014';
        }]
      ] },
      { title: 'Progress', open: false, rows: [
        ['upgrades', 'Upgrades purchased', function () { return Game.derived.upgradesBought + ' / ' + CONFIG.upgrades.length; }],
        ['achievements', 'Achievements', function () { return DC.Achievements.progressText(); }],
        ['playtime', 'Play time', function () { return N.formatDuration(Game.state.playTime); }],
        ['started', 'Started', function () { return new Date(Game.state.startedAt).toLocaleDateString(); }]
      ] }
    ];
  }

  /** One stats line per event type the player has actually seen. */
  function eventBreakdown() {
    var seen = Game.state.events.seen || {};
    return CONFIG.events.filter(function (e) { return seen[e.id]; }).map(function (e) {
      return ['ev_' + e.id, e.title || e.name, function () {
        return N.withCommas(Game.state.events.seen[e.id] || 0) + '\u00D7';
      }];
    });
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

  /* -------------------------------------------------------------- tooltip */

  /* Native title= tooltips wait about a second, sit wherever the OS decides and
   * ignore our styling, and never appear on touch at all. This replaces them:
   * shows instantly, tracks the pointer, and taps open a pinned version. */

  var tipPinned = false;

  function tipHtml(title, body, note) {
    return '<strong>' + escapeHtml(title) + '</strong>' +
           (body ? '<span>' + escapeHtml(body) + '</span>' : '') +
           (note ? '<em>' + escapeHtml(note) + '</em>' : '');
  }

  function moveTip(x, y) {
    var tip = el['tip'];
    var pad = 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + pad, top = y + pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (left < 8) left = 8;
    if (top + h > window.innerHeight - 8) top = y - h - pad;
    if (top < 8) top = 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function showTip(html, x, y, pinned) {
    var tip = el['tip'];
    tip.innerHTML = html;
    tip.hidden = false;
    tip.classList.toggle('is-pinned', !!pinned);
    tipPinned = !!pinned;
    moveTip(x, y);
  }

  function hideTip(force) {
    if (tipPinned && !force) return;
    tipPinned = false;
    el['tip'].hidden = true;
  }

  /** Attaches tooltip behaviour to an element. Data comes from a getter so the
   *  text can reflect current state at the moment it's shown. */
  function bindTip(node, getContent) {
    node.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;      // touch uses tap instead
      showTip(getContent(), e.clientX, e.clientY, false);
    });
    node.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || tipPinned) return;
      moveTip(e.clientX, e.clientY);
    });
    node.addEventListener('pointerleave', function () { hideTip(); });
    node.addEventListener('click', function (e) {
      // Tap (or click) pins it open so mobile players can read it.
      e.stopPropagation();
      var rect = node.getBoundingClientRect();
      showTip(getContent(), rect.left + rect.width / 2, rect.bottom, true);
    });
  }

  /* --------------------------------------------------------------- casino */

  var betFraction = null;      // null = whichever is selected
  var spinning = false;
  // While a spin animates, the Durian counters are frozen. Otherwise the
  // numbers give the result away before the reels stop.
  var suppressCounters = false;

  function buildBetRow() {
    var row = el['bet-row'];
    row.innerHTML = '<span class="buy-amount-label">Bet</span>';
    CONFIG.casino.betFractions.forEach(function (f, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'amt' + ((betFraction === null ? i === 0 : betFraction === f) ? ' is-active' : '');
      b.textContent = Math.round(f * 100) + '%';
      b.title = Math.round(f * 100) + '% of your Durians';
      b.addEventListener('click', function () {
        betFraction = f;
        buildBetRow();
        refreshCasino();
      });
      row.appendChild(b);
    });
    if (betFraction === null) betFraction = CONFIG.casino.betFractions[0];
  }

  function buildPaytable() {
    var rows = DC.Casino.symbols().map(function (sym) {
      return '<div class="stat-row"><dt><img class="pay-icon" src="' + sym.icon + '" alt=""> ' +
             escapeHtml(sym.name) + ' &times;3</dt><dd>' + sym.triple + '&times; bet' +
             (sym.tripleCoins ? ' + ' + sym.tripleCoins + ' coins' : '') + '</dd></div>';
    }).join('');
    el['paytable'].innerHTML = rows +
      '<div class="stat-row"><dt>Any two matching</dt><dd>' +
      CONFIG.casino.pairPayout + '&times; bet</dd></div>' +
      '<div class="stat-row"><dt>Long-run return</dt><dd>' +
      Math.round(DC.Casino.expectedReturn() * 100) + '% of stake</dd></div>' +
      '<div class="stat-row"><dt>Cost per spin</dt><dd>1 Blue Coin + your stake</dd></div>';
  }

  function refreshCasino() {
    var f = betFraction || CONFIG.casino.betFractions[0];
    var bet = DC.Casino.betFor(f);
    var blocked = DC.Casino.blockedReason(f);

    el['btn-spin'].textContent = '\u25B6 Spin \u00B7 1 coin + ' + N.formatMenu(bet);
    el['btn-spin'].disabled = spinning || !!blocked;
    el['coin-balance'].textContent = DC.Coins.count();

    // The hint lives on its own line. Writing it into the result line meant
    // that spending your LAST coin wiped the win/loss message you had just
    // earned, because the spin left you with none.
    var hint = '';
    if (!spinning && blocked === 'no-coins') {
      hint = 'Out of Blue Coins. Watch for one on screen \u2014 or an airplane.';
    } else if (!spinning && blocked === 'no-durians') {
      hint = 'Not enough Durians for that stake.';
    }
    el['slots-hint'].textContent = hint;
  }

  function setReels(reels) {
    var imgs = el['reels'].querySelectorAll('.reel-img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].src = reels[i].icon;
      imgs[i].alt = reels[i].name;
    }
  }

  /** Win and loss each get their own message, colour and animation. */
  function showSpinOutcome(result) {
    var box = el['slots-outcome'];
    var line = el['slots-result'];
    var payout = el['slots-payout'];
    var won = result.kind !== 'none';

    if (!won) {
      line.textContent = 'No match \u2014 ' + N.formatMenu(result.stake) +
                         ' Durians and a Blue Coin gone.';
      payout.textContent = '\u2212' + N.formatMenu(result.stake);
    } else if (result.kind === 'triple') {
      line.textContent = 'Three ' + result.symbol.name + 's!' +
                         (result.coins ? ' And ' + result.coins + ' Blue Coins.' : '');
      payout.textContent = '+' + N.formatMenu(result.payout);
    } else {
      line.textContent = 'Two matching \u2014 your stake comes back.';
      payout.textContent = '+' + N.formatMenu(result.payout);
    }

    line.className = 'slots-result ' + (won ? 'is-win' : 'is-loss');
    payout.className = 'slots-payout ' + (won ? 'is-win' : 'is-loss');

    // restart the animation even on repeat outcomes
    box.classList.remove('won', 'lost', 'jackpot-win');
    el['reels'].classList.remove('win', 'lose');
    void box.offsetWidth;
    box.classList.add(won ? (result.jackpot ? 'jackpot-win' : 'won') : 'lost');
    el['reels'].classList.add(won ? 'win' : 'lose');

    if (won) confettiBurst(result.jackpot);
  }

  /** A small shower of symbols over the machine on a win. */
  function confettiBurst(big) {
    var host = el['reels'];
    var rect = host.getBoundingClientRect();
    var count = big ? 26 : 12;
    for (var i = 0; i < count; i++) {
      var bit = document.createElement('div');
      bit.className = 'slot-confetti';
      bit.style.left = (rect.left + Math.random() * rect.width) + 'px';
      bit.style.top = (rect.top + rect.height * 0.4) + 'px';
      bit.style.setProperty('--dx', (Math.random() * 220 - 110) + 'px');
      bit.style.setProperty('--dy', (-90 - Math.random() * 140) + 'px');
      bit.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      bit.style.background = big
        ? ['#5BB8F5', '#BFF0FF', '#FFD429'][i % 3]
        : ['#FFD429', '#FFE79A', '#7FB03A'][i % 3];
      document.body.appendChild(bit);
      autoRemove(bit, 1400);
    }
  }

  function doSpin() {
    if (spinning) return;
    var result = DC.Casino.play(betFraction);
    if (!result) return;

    spinning = true;
    // Do NOT refresh the counters here. The stake and any winnings are applied
    // the moment the spin resolves internally, so redrawing now shows the
    // player their result before the reels have finished turning.
    suppressCounters = true;
    el['btn-spin'].disabled = true;
    DC.Audio.play('spin');
    el['slots-result'].textContent = 'Spinning\u2026';
    el['slots-result'].className = 'slots-result';
    el['slots-payout'].textContent = '';
    el['slots-outcome'].classList.remove('won', 'lost', 'jackpot-win');
    el['reels'].classList.remove('win', 'lose');
    el['reels'].classList.add('spinning');

    // Roll visible junk while it spins, then land on the real result.
    var tick = setInterval(function () { setReels(DC.Casino.roll()); }, 90);
    setTimeout(function () {
      clearInterval(tick);
      setReels(result.reels);
      el['reels'].classList.remove('spinning');
      spinning = false;

      showSpinOutcome(result);

      suppressCounters = false;
      refreshCasino();
      refreshCounters();
    }, CONFIG.casino.spinSeconds * 1000);
  }

  /* ---------------------------------------------------------------- skins */

  /** Skins are CSS variables on the durian button, so any art works. */
  /** Builds the filter chain for a skin. Empty string means the stock durian. */
  function skinFilter(skin) {
    var c = (skin && skin.css) || {};
    if (c.hue === undefined) return '';
    return 'grayscale(1) sepia(1)' +
           ' saturate(' + c.sat + ')' +
           ' hue-rotate(' + c.hue + 'deg)' +
           ' brightness(' + c.bright + ')' +
           ' contrast(' + c.contrast + ')';
  }

  /**
   * Skins are one filter on the durian image. The earlier version layered a
   * masked, colour-blended overlay on top, which rendered as barely-tinted grey
   * in practice; a filter chain has no blending or stacking-context failure.
   */
  function applySkin() {
    if (!DC.Store) return;
    var skin = DC.Store.active();
    var btn = el['durian-button'];
    var img = el['durian-img'];
    var chain = skinFilter(skin);
    var shadow = 'drop-shadow(0 12px 16px rgba(6, 48, 70, 0.42))';

    img.style.filter = chain ? chain + ' ' + shadow : shadow;
    var c = (skin && skin.css) || {};
    btn.classList.toggle('has-skin', !!chain);
    // Two kinds of movement: 'pulse' breathes between two themed states,
    // 'cycle' runs the whole spectrum. Previously everything used the cycle,
    // which is why four different skins looked like the same rainbow.
    btn.classList.toggle('skin-pulse', !!(c.secs && !c.cycle));
    btn.classList.toggle('skin-cycle', !!c.cycle);

    img.style.setProperty('--skin-sat', c.sat !== undefined ? c.sat : 1);
    img.style.setProperty('--skin-hue', (c.hue !== undefined ? c.hue : 0) + 'deg');
    img.style.setProperty('--skin-bright', c.bright !== undefined ? c.bright : 1);
    img.style.setProperty('--skin-contrast', c.contrast !== undefined ? c.contrast : 1);
    img.style.setProperty('--skin-sat2', c.sat2 !== undefined ? c.sat2 : (c.sat || 1));
    img.style.setProperty('--skin-hue2', (c.hue2 !== undefined ? c.hue2 : (c.hue || 0)) + 'deg');
    img.style.setProperty('--skin-bright2', c.bright2 !== undefined ? c.bright2 : (c.bright || 1));
    img.style.setProperty('--skin-contrast2', c.contrast2 !== undefined ? c.contrast2 : (c.contrast || 1));
    img.style.setProperty('--skin-secs', (c.secs || 7) + 's');

    // Worn accessories sit on the fruit rather than tinting it: the art is
    // drawn over the durian at full size and inherits its movement.
    var worn = c.image ? CONFIG.assets[c.image] : null;
    btn.classList.toggle('skin-image', !!worn);
    btn.style.setProperty('--skin-image', worn ? 'url("' + worn + '")' : 'none');
    btn.style.setProperty('--skin-image-opacity',
      c.opacity !== undefined ? c.opacity : 1);
  }

  function skinPreviewStyle(skin) {
    var css = skin.css || {};
    if (css.image && CONFIG.assets[css.image]) {
      return 'background:' + (skin.swatch || '#8FBF3F') +
             ';background-image:url("' + CONFIG.assets[css.image] +
             '");background-size:contain;background-position:center;background-repeat:no-repeat;';
    }
    return 'background:' + (skin.swatch || '#8FBF3F') + ';';
  }

  function buildSkinGrid() {
    var grid = el['skin-grid'];
    grid.innerHTML = '';
    DC.Store.all().forEach(function (skin) {
      var have = DC.Store.owned(skin.id);
      var node = document.createElement('button');
      node.type = 'button';
      node.className = 'skin-tile' + (have ? '' : ' locked') +
                       (DC.Store.activeId() === skin.id ? ' is-active' : '');
      node.disabled = !have;
      node.innerHTML = '<span class="skin-swatch" style="' + skinPreviewStyle(skin) + '"></span>' +
                       '<span class="skin-name">' + escapeHtml(have ? skin.name : 'Locked') + '</span>';
      if (!have && skin.reward && skin.requirementText) {
        node.title = skin.requirementText;
      }
      if (have) {
        node.addEventListener('click', function () {
          DC.Store.equip(skin.id);
          buildSkinGrid();
          DC.Audio.play('buyUpgrade');
        });
      }
      grid.appendChild(node);
    });
  }

  /* ---------------------------------------------------------- Tanooki Store */

  function buildStore() {
    el['store-balance'].textContent = N.formatMenu(Game.state.durians);
    el['store-owned'].textContent = DC.Store.ownedCount() + '/' + DC.Store.all().length;

    var list = el['store-list'];
    list.innerHTML = '';

    DC.Store.byTier().forEach(function (group) {
      var head = document.createElement('h3');
      head.className = 'list-heading';
      head.textContent = group.tier;
      list.appendChild(head);

      var row = document.createElement('div');
      row.className = 'store-grid';

      group.skins.forEach(function (skin) {
        var have = DC.Store.owned(skin.id);
        var afford = DC.Store.canBuy(skin.id);
        var reward = DC.Store.isReward(skin.id);
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'store-item' +
          (have ? ' owned' : (reward ? ' reward-locked' : (afford ? ' affordable' : ' broke')));
        card.innerHTML =
          '<span class="skin-swatch big" style="' + skinPreviewStyle(skin) + '"></span>' +
          '<span class="store-item-body">' +
            '<span class="store-item-name">' + escapeHtml(skin.name) + '</span>' +
            '<span class="store-item-desc">' + escapeHtml(skin.description) + '</span>' +
          '</span>' +
          '<span class="store-item-cost">' +
            (have ? (DC.Store.activeId() === skin.id ? 'Equipped' : 'Owned')
                  : (reward ? '\u{1F512} ' + escapeHtml(skin.requirementText || 'Earned')
                            : N.formatMenu(skin.cost))) + '</span>';

        card.addEventListener('click', function () {
          if (have) { DC.Store.equip(skin.id); DC.Audio.play('buyUpgrade'); buildStore(); return; }
          if (DC.Store.buy(skin.id)) {
            DC.Audio.play('buyUpgrade');
            toast('Skin unlocked', skin.name, 'unlock');
            buildStore();
          }
        });
        row.appendChild(card);
      });
      list.appendChild(row);
    });
  }

  /* ---------------------------------------------------------- Blue Coins */

  var coinNode = null;

  function showCoin(info) {
    removeCoin();
    var node = document.createElement('button');
    node.type = 'button';
    node.className = 'blue-coin' + (info.kind === 'plane' ? ' is-plane' : '') +
                     (info.lucky ? ' is-lucky' : '');
    node.setAttribute('aria-label', info.kind === 'plane'
      ? 'An airplane! Click for a Blue Coin' : 'A Blue Coin! Click to collect');
    node.draggable = false;
    node.innerHTML = '<img draggable="false" src="' +
      (info.kind === 'plane' ? CONFIG.assets.airplane : CONFIG.assets.blueCoin) + '" alt="">';
    // Belt and braces: some browsers still start a drag from the button.
    node.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // Someone who has asked for reduced motion should not be shown a flying
    // plane at all — and the blanket animation override used to fling it
    // offscreen, so they never saw one. Give them a stationary plane instead.
    var stillPlease = false;
    try {
      stillPlease = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (err) { stillPlease = false; }

    if (info.kind === 'plane' && !stillPlease) {
      node.style.top = info.fromTop + '%';
      node.style.setProperty('--fly-seconds', CONFIG.blueCoins.planeFlightSeconds + 's');
    } else if (info.kind === 'plane') {
      node.classList.add('is-static');
      node.style.left = info.x + '%';
      node.style.top = info.y + '%';
    } else {
      node.style.left = info.x + '%';
      node.style.top = info.y + '%';
    }

    // pointerdown, not click: a click needs press and release on the same
    // spot, so the smallest drag cancelled the collection entirely.
    node.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var reward = DC.Coins.collect();
      if (reward > 0) burstCoin(e.clientX, e.clientY, reward);
    });

    el['coin-layer'].appendChild(node);
    coinNode = node;
  }

  function removeCoin() {
    if (coinNode) { coinNode.remove(); coinNode = null; }
  }

  /** The satisfying bit: the coin flies to the counter and the total ticks up. */
  function burstCoin(x, y, reward) {
    removeCoin();
    DC.Audio.play('coin');

    var chip = el['coin-chip'].getBoundingClientRect();
    var flyer = document.createElement('div');
    flyer.className = 'coin-flyer';
    flyer.innerHTML = '<img src="' + CONFIG.assets.blueCoin + '" alt="">' +
                      '<span>+' + reward + '</span>';
    flyer.style.left = x + 'px';
    flyer.style.top = y + 'px';
    flyer.style.setProperty('--to-x', (chip.left + chip.width / 2 - x) + 'px');
    flyer.style.setProperty('--to-y', (chip.top + chip.height / 2 - y) + 'px');
    document.body.appendChild(flyer);
    setTimeout(function () { flyer.remove(); }, 1000);

    // sparkle ring at the pickup point
    for (var i = 0; i < 8; i++) {
      var p = document.createElement('div');
      var a = (i / 8) * Math.PI * 2;
      p.className = 'particle';
      p.style.position = 'fixed';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = i % 2 ? '#5BB8F5' : '#BFF0FF';
      p.style.setProperty('--dx', Math.cos(a) * 60 + 'px');
      p.style.setProperty('--dy', Math.sin(a) * 60 + 'px');
      document.body.appendChild(p);
      autoRemove(p, 900);
    }

    setTimeout(function () {
      el['coin-chip'].classList.add('pop');
      setTimeout(function () { el['coin-chip'].classList.remove('pop'); }, 400);
    }, 620);
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
      amount.textContent = '+' + N.formatMenu(result.amount) + ' Durians';
      amount.classList.add('is-gain');
    } else if (result.direction === 'loss') {
      amount.textContent = '-' + N.formatMenu(result.amount) + ' Durians';
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

    var boardNote = lb.boardDef().note;
    el['board-status'].textContent = status.message || (boardNote || '');
    el['board-status'].classList.toggle('is-error', status.status === 'error');

    el['board-note'].innerHTML = lb.isOnline()
      ? 'Scores are self-reported and not verified — treat this as a fun board, not a record sheet.'
      : '<strong>Local demo mode.</strong> These scores live on this device only. ' +
        'Set <code>leaderboard.provider</code> in <code>js/config.js</code> to go online — see the README.';
  }

  /**
   * Scores are stored as log10 plus a display string. Rebuilding the number
   * from the log means everyone sees the board in THEIR chosen number format,
   * rather than in whatever format the submitting player happened to use.
   */
  function boardScore(entry, board) {
    var log = entry[board.sortKey];
    if (typeof log === 'number' && isFinite(log)) {
      if (log <= 0) return '0';
      return N.formatMenu(N.pow10(log));
    }
    return entry[board.displayKey] || '—';     // pre-log rows, if any
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
      if (e.achievements) meta.push(N.withCommas(e.achievements) + ' shines');
      if (e.workers) meta.push(N.withCommas(e.workers) + ' crew');
      if (e.play_time) meta.push(N.formatDuration(e.play_time) + ' played');
      return '<li class="board-row' + (e.isYou ? ' is-you' : '') + (e.rank === 1 ? ' top1' : '') + '">' +
        '<div class="board-rank">' + e.rank + '</div>' +
        '<div class="board-player">' +
          '<div class="board-player-name">' + escapeHtml(e.name || 'Anonymous') + '</div>' +
          '<div class="board-player-meta">' + meta.join(' · ') + '</div>' +
        '</div>' +
        '<div class="board-score">' + escapeHtml(boardScore(e, board)) + '</div>' +
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

  var TOAST_MS = 6000;      // was 4000 — several testers found it too quick to read

  function toast(title, subtitle, kind, icon) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<img src="' + (icon || CONFIG.assets.shine) + '" alt="">' +
                  '<div><strong>' + title + '</strong><span>' + (subtitle || '') + '</span></div>';
    el['toasts'].appendChild(t);
    setTimeout(function () { t.remove(); }, TOAST_MS);
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
    el['offline-amount'].textContent = N.formatMenu(info.amount) + ' Durians';
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
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      // Holding the key down makes the browser fire keydown on autorepeat,
      // which was a free autoclicker. Only the initial press counts.
      if (e.repeat) return;
      handleClick(e);
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
      syncBuyAmountButtons();
      refreshWorkers();
    });

    function applyCustomAmount() {
      var n = parseInt(el['buy-custom'].value, 10);
      if (!n || n < 1) return;                  // empty or nonsense: ignore
      n = Math.min(n, 100000);                  // matches the bulk-buy cap
      if (String(n) !== el['buy-custom'].value) el['buy-custom'].value = n;
      Game.state.settings.buyAmount = n;
      syncBuyAmountButtons();
      refreshWorkers();
    }
    el['buy-custom'].addEventListener('input', applyCustomAmount);
    el['buy-custom'].addEventListener('focus', applyCustomAmount);

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
      // Grab the callback BEFORE closing: closeModal clears it, so reading it
      // afterwards always found null and Reset and Import silently did nothing.
      var cb = confirmCallback;
      closeModal('modal-confirm');
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

    // Tapping anywhere else closes a pinned tooltip.
    document.addEventListener('click', function () { hideTip(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(true); });
    window.addEventListener('scroll', function () { hideTip(true); }, true);

    el['number-format'].addEventListener('change', function () {
      Game.state.settings.numberFormat = el['number-format'].value;
      DC.Save.save(true);
      rebuildAll();
      note('Number display updated.');
    });

    el['btn-dark'].addEventListener('click', function () {
      setDarkMode(!Game.state.settings.darkMode);
    });
    el['dark-toggle'].addEventListener('change', function () {
      setDarkMode(el['dark-toggle'].value === 'dark');
    });

    if (DC.Store) $('btn-store').addEventListener('click', function () {
      buildStore();
      openModal('modal-store');
    });
    if (DC.Casino) $('btn-casino').addEventListener('click', function () {
      buildBetRow();
      buildPaytable();
      setReels(DC.Casino.roll());
      el['slots-result'].textContent = 'Place a bet to spin.';
      el['slots-result'].className = 'slots-result';
      el['slots-payout'].textContent = '';
      el['slots-outcome'].classList.remove('won', 'lost', 'jackpot-win');
      refreshCasino();
      openModal('modal-casino');
    });
    if (DC.Store) $('btn-skins').addEventListener('click', function () {
      buildSkinGrid();
      openModal('modal-skins');
    });
    if (DC.Casino) el['btn-spin'].addEventListener('click', doSpin);

    if (DC.Coins) bindTip(el['coin-chip'], function () {
      return tipHtml('Blue Coins',
        'Rare finds. A coin or an airplane shows up on screen every few minutes \u2014 click it before it goes.',
        'Spend them in the Casino for a premium spin.');
    });

    DC.Events.on('coinSpawn', showCoin);
    DC.Events.on('coinExpired', removeCoin);
    DC.Events.on('coinCollected', function () { refreshCounters(); });
    DC.Events.on('blueCoinsChanged', function () { refreshCounters(); });
    DC.Events.on('skinChanged', applySkin);
    DC.Events.on('skinBought', applySkin);
    DC.Events.on('skinUnlocked', function (list) {
      list.forEach(function (skin) {
        toast('Skin unlocked: ' + skin.name, skin.description, 'unlock');
      });
      DC.Audio.play('achievement');
    });

    $('news-read').addEventListener('click', openChangelog);
    $('btn-history').addEventListener('click', openFullChangelog);
    $('news-close').addEventListener('click', function () {
      DC.Changelog.markRead();          // dismissing counts as read
      el['news-bar'].hidden = true;
    });
    DC.Events.on('changelogAvailable', function (entry) {
      el['news-icon'].src = CONFIG.assets.shine;
      el['news-line'].textContent = entry.title || 'Tap to see what is new.';
      el['news-bar'].hidden = false;
    });

    $('update-close').addEventListener('click', function () {
      // Dismiss also cancels the automatic reload — nobody should be yanked
      // out of a session they asked to stay in.
      stopUpdateCountdown();
      el['update-bar'].hidden = true;
    });
    DC.Events.on('updateAvailable', function (info) {
      el['update-icon'].src = CONFIG.assets.shine;
      el['update-bar'].hidden = false;
      DC.Audio.play('unlock');
      startUpdateCountdown(info);
    });
    $('update-now').addEventListener('click', function () {
      stopUpdateCountdown();
      DC.Updates.reloadNow();
    });

    $('event-close').addEventListener('click', hideEvent);
    DC.Events.on('islandEvent', function (r) {
      showEvent(r);
      if (currentTab === 'stats') buildStats();     // new event type = new row
    });
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

  /** Runs a build step, logging rather than letting one failure blank the UI. */
  function step(name, fn) {
    try { fn(); }
    catch (err) { console.error('[Durian Clicker] UI step "' + name + '" failed:', err); }
  }

  function rebuildAll() {
    step('workers', buildWorkers);
    step('upgrades', buildUpgrades);
    step('achievements', buildAchievements);
    step('stats', buildStats);
    step('counters', refreshCounters);
    step('worker values', refreshWorkers);
    step('upgrade values', refreshUpgrades);
    step('stat values', refreshStats);
    step('buy buttons', syncBuyAmountButtons);
    step('settings', syncSettingsControls);
  }

  function syncSettingsControls() {
    el['number-format'].value = Game.state.settings.numberFormat || 'abbreviated';
    applyDarkMode();
  }

  var PRESET_AMOUNTS = ['1', '10', '100', 'max'];

  function syncBuyAmountButtons() {
    var amount = String(Game.state.settings.buyAmount);
    var isPreset = PRESET_AMOUNTS.indexOf(amount) !== -1;
    document.querySelectorAll('.amt').forEach(function (b) {
      b.classList.toggle('is-active', isPreset && b.dataset.amount === amount);
    });
    el['buy-custom'].classList.toggle('is-active', !isPreset);
    if (!isPreset && el['buy-custom'].value !== amount) el['buy-custom'].value = amount;
  }

  /** Hides any control whose backing module is absent. */
  function hideUnavailableFeatures() {
    var pairs = [
      [DC.Store,  ['btn-store', 'btn-skins']],
      [DC.Casino, ['btn-casino']],
      [DC.Coins,  ['coin-chip']]
    ];
    pairs.forEach(function (pair) {
      if (pair[0]) return;
      pair[1].forEach(function (id) {
        var node = $(id);
        if (node) node.hidden = true;
      });
    });
  }

  function init() {
    cache();
    applyAssets();
    hideUnavailableFeatures();
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
