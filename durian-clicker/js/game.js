/* =============================================================================
 * game.js — state, derived production values, the tick loop, and the event bus.
 * -----------------------------------------------------------------------------
 * Nothing in here touches the DOM. ui.js listens for events and redraws.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  /* ------------------------------------------------------------ event bus */

  var listeners = {};
  var Events = {
    on: function (name, fn) {
      (listeners[name] || (listeners[name] = [])).push(fn);
      return fn;
    },
    emit: function (name, payload) {
      var list = listeners[name];
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try { list[i](payload); } catch (err) { console.error('[' + name + ']', err); }
      }
    }
  };
  DC.Events = Events;

  /* ---------------------------------------------------------- fresh state */

  function makePlayerId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function newState() {
    var s = {
      version: CONFIG.saveVersion,
      durians: N.big(CONFIG.balance.startingDurians),
      totalEarned: N.big(CONFIG.balance.startingDurians),
      clickEarned: N.ZERO,
      workerEarned: N.ZERO,
      spent: N.ZERO,
      totalClicks: 0,
      workers: {},
      upgrades: {},
      achievements: {},
      unlocked: {},
      settings: {
        volume: CONFIG.audio.defaultVolume,
        muted: CONFIG.audio.defaultMuted,
        buyAmount: 1,               // 1 | 10 | 'max'
        numberFormat: 'abbreviated' // 'abbreviated' | 'shortened' | 'full'
      },
      player: {
        // Two ids on purpose. `id` is the row key and is never published, so
        // nobody can overwrite your score. `publicId` is what comes back from
        // the board and only tells the client which row is yours.
        id: makePlayerId(),
        publicId: makePlayerId(),
        name: '',                   // asked for the first time they submit a score
        lastSubmit: 0
      },
      buffs: [],                    // temporary event multipliers
      events: { seen: {}, total: 0, nextAt: 0 },
      lost: N.ZERO,                 // durians taken by setback events
      offlineEarned: N.ZERO,
      playTime: 0,
      startedAt: Date.now(),
      lastSaved: Date.now()
    };
    CONFIG.workers.forEach(function (w) { s.workers[w.id] = 0; });
    return s;
  }

  var Game = {
    state: newState(),
    derived: {
      clickPower: N.ONE,
      dps: N.ZERO,
      perWorker: {},        // id -> durians/sec for ONE of them
      workerDps: {},        // id -> durians/sec for all owned
      globalMult: 1,
      totalWorkers: 0,
      upgradesBought: 0,
      achievementsEarned: 0
    },
    running: false
  };

  /* ------------------------------------------------------- requirements */

  /**
   * Shared by unlocks and achievements so both use the same vocabulary.
   * Add a new `case` here to invent a new kind of gate.
   */
  function meetsRequirement(req) {
    if (!req || req.type === 'always') return true;
    var s = Game.state, d = Game.derived;
    switch (req.type) {
      case 'totalEarned':    return N.gte(s.totalEarned, req.amount);
      case 'durians':        return N.gte(s.durians, req.amount);
      case 'clickEarned':    return N.gte(s.clickEarned, req.amount);
      case 'clicks':         return s.totalClicks >= req.count;
      case 'workerCount':    return (s.workers[req.id] || 0) >= req.count;
      case 'totalWorkers':   return d.totalWorkers >= req.count;
      case 'dps':            return N.gte(d.dps, req.amount);
      case 'upgrade':        return !!s.upgrades[req.id];
      case 'upgradesBought': return d.upgradesBought >= req.count;
      case 'achievement':    return !!s.achievements[req.id];
      case 'playTime':       return s.playTime >= req.seconds;
      case 'achievementCount': return d.achievementsEarned >= req.count;
      case 'eventsSeen':     return (s.events.total || 0) >= req.count;
      case 'eventTypeSeen':  return (s.events.seen[req.id] || 0) >= req.count;
      case 'offlineEarned':  return N.gte(s.offlineEarned, req.amount);
      default:
        console.warn('Unknown requirement type:', req.type);
        return false;
    }
  }

  /** Human-readable "🔒 Unlocks at ..." text for locked content. */
  function describeRequirement(req) {
    if (!req || req.type === 'always') return '';
    switch (req.type) {
      case 'totalEarned':    return 'Unlocks at ' + N.format(req.amount) + ' Durians earned';
      case 'durians':        return 'Unlocks at ' + N.format(req.amount) + ' Durians';
      case 'clickEarned':    return 'Unlocks after clicking out ' + N.format(req.amount) + ' Durians';
      case 'clicks':         return 'Unlocks after ' + N.withCommas(req.count) + ' clicks';
      case 'workerCount':    return 'Unlocks with ' + req.count + ' ' + workerName(req.id, req.count);
      case 'totalWorkers':   return 'Unlocks with ' + req.count + ' workers hired';
      case 'dps':            return 'Unlocks at ' + N.format(req.amount) + ' Durians/sec';
      case 'upgrade':        return 'Unlocks with ' + upgradeName(req.id);
      case 'upgradesBought': return 'Unlocks after ' + req.count + ' upgrades';
      case 'achievement':    return 'Unlocks with an achievement';
      case 'playTime':       return 'Unlocks after ' + N.formatDuration(req.seconds) + ' played';
      case 'achievementCount': return 'Unlocks with ' + req.count + ' achievements';
      case 'eventsSeen':     return 'Unlocks after ' + req.count + ' island events';
      case 'eventTypeSeen':  return 'Unlocks after ' + req.count + ' of a certain island event';
      case 'offlineEarned':  return 'Unlocks after collecting ' + N.format(req.amount) + ' offline';
      default:               return 'Locked';
    }
  }

  function workerDef(id) {
    for (var i = 0; i < CONFIG.workers.length; i++) if (CONFIG.workers[i].id === id) return CONFIG.workers[i];
    return null;
  }
  function upgradeDef(id) {
    for (var i = 0; i < CONFIG.upgrades.length; i++) if (CONFIG.upgrades[i].id === id) return CONFIG.upgrades[i];
    return null;
  }
  function workerName(id, count) {
    var w = workerDef(id);
    if (!w) return id;
    return count === 1 ? w.name : (w.plural || w.name + 's');
  }
  function upgradeName(id) {
    var u = upgradeDef(id);
    return u ? u.name : id;
  }

  /* ---------------------------------------------------- derived production */

  /** Recomputes click power and DPS from scratch. Cheap; call after any change. */
  function recalc() {
    var s = Game.state, d = Game.derived;

    var clickAdd = 0, clickMult = 1, clickFromDps = 0, clickFromWorkers = 0;
    var globalMult = 1;
    var workerMult = {};
    var workerScaling = {};     // id -> [{ per, value }]
    var workerSynergy = [];     // { target, source, value }
    var achievementBonus = CONFIG.achievementBonusPer;
    var eventChance = 1, eventGain = 1, eventLoss = 1, buffDuration = 1;
    var offlineEfficiency = CONFIG.offline.efficiency;
    var offlineHours = 0;
    var bought = 0;

    CONFIG.upgrades.forEach(function (u) {
      var owned = s.upgrades[u.id];
      if (!owned) return;
      var stacks = u.repeatable ? owned : 1;
      bought += stacks;
      (u.effects || []).forEach(function (fx) {
        for (var i = 0; i < stacks; i++) {
          switch (fx.type) {
            case 'clickAdd':          clickAdd += fx.value; break;
            case 'clickMult':         clickMult *= fx.value; break;
            case 'clickFromDps':      clickFromDps += fx.value; break;
            case 'clickFromWorkers':  clickFromWorkers += fx.value; break;
            case 'globalMult':        globalMult *= fx.value; break;
            case 'workerMult':        workerMult[fx.target] = (workerMult[fx.target] || 1) * fx.value; break;
            case 'workerScaling':
              (workerScaling[fx.target] || (workerScaling[fx.target] = [])).push(fx); break;
            case 'workerSynergy':     workerSynergy.push(fx); break;
            case 'achievementBonus':  achievementBonus += fx.value; break;
            case 'eventChance':       eventChance *= fx.value; break;
            case 'eventGain':         eventGain *= fx.value; break;
            case 'eventLoss':         eventLoss *= fx.value; break;
            case 'buffDuration':      buffDuration *= fx.value; break;
            case 'offlineEfficiency': offlineEfficiency += fx.value; break;
            case 'offlineHours':      offlineHours += fx.value; break;
            default: console.warn('Unknown effect type:', fx.type);
          }
        }
      });
    });

    var achievements = Object.keys(s.achievements).length;
    globalMult *= (1 + achievements * achievementBonus);

    // Temporary event buffs multiply everything.
    var buffProd = 1, buffClick = 1, now = Date.now();
    for (var bi = 0; bi < s.buffs.length; bi++) {
      if (s.buffs[bi].endsAt > now) {
        buffProd *= (s.buffs[bi].prod !== undefined ? s.buffs[bi].prod : 1);
        buffClick *= (s.buffs[bi].click !== undefined ? s.buffs[bi].click : 1);
      }
    }
    globalMult *= buffProd;

    // Worker counts are needed before production, because synergies read them.
    var counts = {}, totalWorkers = 0;
    CONFIG.workers.forEach(function (w) {
      counts[w.id] = s.workers[w.id] || 0;
      totalWorkers += counts[w.id];
    });

    var dps = N.ZERO;
    d.perWorker = {};
    d.workerDps = {};

    CONFIG.workers.forEach(function (w) {
      var count = counts[w.id];
      var mult = (workerMult[w.id] || 1) * globalMult;

      // Self-scaling: +value for every `per` of this worker owned.
      (workerScaling[w.id] || []).forEach(function (fx) {
        mult *= (1 + fx.value * Math.floor(count / fx.per));
      });

      // Cross-worker synergies, including the 'all' wildcard on either side.
      workerSynergy.forEach(function (fx) {
        if (fx.target !== 'all' && fx.target !== w.id) return;
        var sourceCount = fx.source === 'all' ? totalWorkers : (counts[fx.source] || 0);
        mult *= (1 + fx.value * sourceCount);
      });

      var each = N.mul(N.big(w.baseProduction), mult);
      d.perWorker[w.id] = each;
      var total = N.mul(each, count);
      d.workerDps[w.id] = total;
      dps = N.add(dps, total);
    });

    d.dps = dps;
    d.globalMult = globalMult;
    d.totalWorkers = totalWorkers;
    d.upgradesBought = bought;
    d.achievementsEarned = achievements;
    d.eventChance = eventChance;
    d.eventGain = eventGain;
    d.eventLoss = eventLoss;
    d.buffDuration = buffDuration;
    d.offlineEfficiency = offlineEfficiency;
    d.offlineMaxSeconds = CONFIG.offline.maxSeconds + offlineHours * 3600;
    d.buffProd = buffProd;
    d.buffClick = buffClick;

    // Multipliers apply to the WHOLE click, flat portion and the DPS-derived
    // portion together. Multiplying only the flat part made late-game ×3 and
    // ×15 multipliers feel like they did nothing, because the DPS share
    // dominates once Hover/Turbo nozzles are in play.
    var clickFlat = N.big(CONFIG.balance.baseClickPower + clickAdd + clickFromWorkers * totalWorkers);
    d.clickPower = N.mul(
      N.add(clickFlat, N.mul(dps, clickFromDps)),
      clickMult * buffClick
    );

    Events.emit('recalc');
  }

  /* ---------------------------------------------------------- earning API */

  function addDurians(amount, source) {
    var s = Game.state;
    amount = N.big(amount);
    if (amount.m <= 0) return;
    s.durians = N.add(s.durians, amount);
    s.totalEarned = N.add(s.totalEarned, amount);
    if (source === 'click') s.clickEarned = N.add(s.clickEarned, amount);
    else if (source === 'worker') s.workerEarned = N.add(s.workerEarned, amount);
  }

  function spendDurians(amount) {
    var s = Game.state;
    amount = N.big(amount);
    if (!N.gte(s.durians, amount)) return false;
    s.durians = N.sub(s.durians, amount);
    s.spent = N.add(s.spent, amount);
    return true;
  }

  /** Player clicked the durian. Returns how much was earned. */
  function click() {
    var gained = Game.derived.clickPower;
    Game.state.totalClicks++;
    addDurians(gained, 'click');
    Events.emit('click', { amount: gained });
    checkProgress();
    return gained;
  }

  /* ------------------------------------------------- unlocks + achievements */

  /** Unlocks are sticky: once open, they stay open even if the number drops. */
  function checkUnlocks() {
    var s = Game.state, opened = [];
    function scan(list, kind) {
      list.forEach(function (item) {
        if (s.unlocked[item.id]) return;
        if (meetsRequirement(item.unlock)) {
          s.unlocked[item.id] = true;
          opened.push({ kind: kind, item: item });
        }
      });
    }
    scan(CONFIG.workers, 'worker');
    scan(CONFIG.upgrades, 'upgrade');
    if (opened.length) Events.emit('unlock', opened);
    return opened;
  }

  function checkAchievements() {
    var s = Game.state, earned = [];
    CONFIG.achievements.forEach(function (a) {
      if (s.achievements[a.id]) return;
      if (meetsRequirement(a.condition)) {
        s.achievements[a.id] = Date.now();
        earned.push(a);
      }
    });
    if (earned.length) {
      recalc();                       // achievement bonus changed production
      Events.emit('achievement', earned);
    }
    return earned;
  }

  function checkProgress() {
    checkUnlocks();
    checkAchievements();
  }

  /* ------------------------------------------------------------- the loop */

  var lastTime = 0, accumulator = 0, uiAccumulator = 0, progressAccumulator = 0;

  function frame(now) {
    if (!Game.running) return;
    var dt = Math.min((now - lastTime) / 1000, 1);   // ignore huge tab-away gaps
    lastTime = now;

    var step = 1 / CONFIG.balance.tickRate;
    accumulator += dt;
    while (accumulator >= step) {
      tick(step);
      accumulator -= step;
    }

    uiAccumulator += dt;
    if (uiAccumulator >= 1 / CONFIG.balance.uiRefreshRate) {
      uiAccumulator = 0;
      Events.emit('render');
    }

    progressAccumulator += dt;
    if (progressAccumulator >= 0.25) {              // unlock checks 4x/sec is plenty
      progressAccumulator = 0;
      checkProgress();
    }

    requestAnimationFrame(frame);
  }

  function tick(dt) {
    var s = Game.state;
    s.playTime += dt;
    var produced = N.mul(Game.derived.dps, dt);
    if (produced.m > 0) addDurians(produced, 'worker');
    if (DC.IslandEvents) DC.IslandEvents.update();
    Events.emit('tick', { dt: dt });
  }

  function start() {
    if (Game.running) return;
    Game.running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function stop() { Game.running = false; }

  /** Wipes progress and starts over (settings are kept). */
  function reset(keepSettings) {
    var settings = Game.state.settings;
    var player = Game.state.player;
    Game.state = newState();
    if (keepSettings) {
      Game.state.settings = settings;
      Game.state.player = {
        id: player.id, publicId: player.publicId, name: player.name, lastSubmit: 0
      };
    }
    recalc();
    checkUnlocks();
    Events.emit('reset');
  }

  DC.Game = Game;
  Object.assign(Game, {
    newState: newState,
    recalc: recalc,
    click: click,
    tick: tick,
    start: start,
    stop: stop,
    reset: reset,
    addDurians: addDurians,
    spendDurians: spendDurians,
    meetsRequirement: meetsRequirement,
    describeRequirement: describeRequirement,
    checkUnlocks: checkUnlocks,
    checkAchievements: checkAchievements,
    checkProgress: checkProgress,
    workerDef: workerDef,
    upgradeDef: upgradeDef,
    workerName: workerName,
    makePlayerId: makePlayerId
  });
})(window.DC = window.DC || {});
