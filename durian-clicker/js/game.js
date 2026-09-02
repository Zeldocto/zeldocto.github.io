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
        numberFormat: 'abbreviated', // 'abbreviated' | 'shortened' | 'full'
        darkMode: false
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
      blueCoins: 0,
      coins: { nextAt: 0, spawned: 0, collected: 0 },
      casino: { spins: 0, wins: 0, coinSpins: 0, coinsSpent: 0, triples: 0,
                jackpots: 0, streak: 0, worstStreak: 0,
                wagered: N.ZERO, won: N.ZERO, biggestWin: N.ZERO },
      skins: { owned: { classic: true }, active: 'classic' },
      backgrounds: { owned: { default: true }, active: 'default' },
      buffs: [],                    // temporary event multipliers
      events: { seen: {}, total: 0, nextAt: 0 },
      eventGained: N.ZERO,          // durians handed over by good events
      lost: N.ZERO,                 // durians taken by setback events
      offlineEarned: N.ZERO,
      changelogSeen: null,          // version string of the last release read
      peakClickRate: 0,             // best clicks-per-second ever managed
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
      case 'blueCoins':      return (s.blueCoins || 0) >= req.count;
      case 'coinsCollected': return (s.coins.collected || 0) >= req.count;
      case 'casinoSpins':    return (s.casino.spins || 0) >= req.count;
      case 'casinoJackpots': return (s.casino.jackpots || 0) >= req.count;
      case 'skinsOwned':     return DC.Store ? DC.Store.ownedCount() >= req.count : false;
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
      case 'blueCoins':      return 'Unlocks with ' + req.count + ' Blue Coins';
      case 'coinsCollected': return 'Unlocks after collecting ' + req.count + ' Blue Coins';
      case 'casinoSpins':    return 'Unlocks after ' + req.count + ' spins';
      case 'casinoJackpots': return 'Unlocks after ' + req.count + ' jackpots';
      case 'skinsOwned':     return 'Unlocks with ' + req.count + ' skins owned';
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
    // Accumulated as bonuses and summed, not multiplied — see the caps in
    // CONFIG.events_settings.
    var eventChanceBonus = 0, eventGainBonus = 0;
    var eventLossReduction = 0, buffDurationBonus = 0;
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
            case 'eventChance':       eventChanceBonus += (fx.value - 1); break;
            case 'eventGain':         eventGainBonus += (fx.value - 1); break;
            case 'eventLoss':         eventLossReduction += (1 - fx.value); break;
            case 'buffDuration':      buffDurationBonus += (fx.value - 1); break;
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
    // Buffs do NOT multiply each other. A Shine Sprite (x7) landing while a
    // Shine Swarm (x25) is running used to give x175, which simply ended the
    // game for a minute. The strongest of each kind applies, and a penalty
    // (below 1) still bites even while a bonus is up.
    var now = Date.now();
    var bestProdUp = 1, worstProdDown = 1, bestClickUp = 1, worstClickDown = 1;
    for (var bi = 0; bi < s.buffs.length; bi++) {
      var b = s.buffs[bi];
      if (b.endsAt <= now) continue;
      var bp = b.prod !== undefined ? b.prod : 1;
      var bc = b.click !== undefined ? b.click : 1;
      if (bp >= 1) { if (bp > bestProdUp) bestProdUp = bp; }
      else if (bp < worstProdDown) worstProdDown = bp;
      if (bc >= 1) { if (bc > bestClickUp) bestClickUp = bc; }
      else if (bc < worstClickDown) worstClickDown = bc;
    }
    var buffProd = bestProdUp * worstProdDown;
    var buffClick = bestClickUp * worstClickDown;
    // Keep the un-buffed multiplier: leaderboards and stats should reflect the
    // economy you actually built, not whether a Shine Sprite happened to be
    // overhead when you submitted.
    var baseGlobalMult = globalMult;
    globalMult *= buffProd;

    // Worker counts are needed before production, because synergies read them.
    var counts = {}, totalWorkers = 0;
    CONFIG.workers.forEach(function (w) {
      counts[w.id] = s.workers[w.id] || 0;
      totalWorkers += counts[w.id];
    });

    var dps = N.ZERO, baseDps = N.ZERO;
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
      baseDps = N.add(baseDps, N.mul(total, baseGlobalMult / globalMult));
    });

    d.dps = dps;
    d.globalMult = globalMult;
    d.totalWorkers = totalWorkers;
    d.upgradesBought = bought;
    d.achievementsEarned = achievements;
    d.baseDps = baseDps;                 // excludes temporary event buffs
    d.baseGlobalMult = baseGlobalMult;
    var ev = CONFIG.events_settings;
    d.eventChance = Math.min(1 + eventChanceBonus, ev.maxEventChance || 3);
    d.eventGain = Math.min(1 + eventGainBonus, ev.maxEventGain || 3);
    d.eventLoss = Math.max(1 - eventLossReduction, ev.minEventLoss || 0.4);
    d.buffDuration = Math.min(1 + buffDurationBonus, ev.maxBuffDuration || 2.5);
    d.offlineEfficiency = offlineEfficiency;
    d.offlineMaxSeconds = CONFIG.offline.maxSeconds + offlineHours * 3600;
    d.buffProd = buffProd;
    d.buffClick = buffClick;

    // Multipliers apply to the WHOLE click, flat portion and the DPS-derived
    // portion together. Multiplying only the flat part made late-game ×3 and
    // ×15 multipliers feel like they did nothing, because the DPS share
    // dominates once Hover/Turbo nozzles are in play.
    // Click power is the BETTER of two routes, not the product of them:
    //
    //   flat gear   (gloves, nozzles, per-worker bonuses) x clickMult
    //   a share of production   (dps x clickFromDps)
    //
    // Multiplying them meant 24 multiplier upgrades compounded to 4,355x, and
    // the normaliser had to shrink every "% of your DPS" upgrade to 0.001% to
    // compensate — so Hover Nozzle, Turbo Nozzle and friends literally did
    // nothing and displayed as 0%. Taking the max keeps gear relevant early,
    // lets the production share carry the late game, and bounds the ratio at
    // whatever clickFromDps sums to.
    var clickFlat = N.big(CONFIG.balance.baseClickPower + clickAdd + clickFromWorkers * totalWorkers);
    var gearRoute = N.mul(clickFlat, clickMult);
    var shareRoute = N.mul(dps, clickFromDps);
    // The two routes ADD. Taking the larger of them meant that the moment the
    // production share pulled ahead, every piece of gear silently stopped
    // counting: "Spike-Proof Gauntlets: +50 Durians per click" added exactly
    // nothing, and a x2 click multiplier multiplied by 1.000. Adding them
    // keeps every description literally true. Gear simply becomes a small part
    // of a large total later on, which is honest and expected.
    d.clickPower = N.mul(N.add(gearRoute, shareRoute), buffClick);
    d.clickShare = clickFromDps;

    Events.emit('recalc');
  }

  /* ------------------------------------------------------- bank integrity */
  /*
   * The bank only ever changes in four places: addDurians, spendDurians, and
   * the two event setbacks. Each records what the total should now be, and the
   * tick loop checks once a second that it still is.
   *
   * So `DC.Game.state.durians = whatever` from the console is caught within a
   * second. Someone who calls the game's own addDurians instead is not — no
   * code running on the player's own machine can stop that — but the edit
   * people actually make is the direct one, and this catches it.
   */
  var stateMark = null;

  var CLICK_LIMIT = (function () {
    var v = CONFIG.balance.maxClickRate;
    return (typeof v === 'number' && v > 0) ? v : 30;
  })();
  var CLICK_OVERFLOW = (function () {
    var v = CONFIG.balance.overflowClickValue;
    return (typeof v === 'number' && v >= 0 && v <= 1) ? v : 0.02;
  })();

  /* Balance settings are read at load and never expected to change. */
  var BALANCE_MARK = JSON.stringify(CONFIG.balance);

  /** A compact fingerprint of everything that decides production. */
  function fingerprint() {
    var s = Game.state;
    var crew = 0, i;
    for (i = 0; i < CONFIG.workers.length; i++) {
      var id = CONFIG.workers[i].id;
      // position-weighted so swapping counts between crew still shows up
      crew += (s.workers[id] || 0) * (i + 1);
    }
    var ups = 0;
    for (var k in s.upgrades) {
      if (Object.prototype.hasOwnProperty.call(s.upgrades, k) && s.upgrades[k]) {
        ups += (typeof s.upgrades[k] === 'number') ? s.upgrades[k] : 1;
      }
    }
    return { m: s.durians.m, e: s.durians.e, crew: crew, ups: ups };
  }

  /** Records the current state as legitimate. Call after any sanctioned change. */
  function markBank() {
    stateMark = fingerprint();
  }

  /** What was changed behind the game's back, if anything. */
  function whatWasEdited() {
    if (!stateMark) return null;
    var now = fingerprint();
    if (now.crew !== stateMark.crew) return 'the crew changed outside the game';
    if (now.ups !== stateMark.ups) return 'the upgrade list changed outside the game';
    if (now.m !== stateMark.m || now.e !== stateMark.e) {
      return 'the Durian total changed outside the game';
    }
    return null;
  }

  /** Marks the save ineligible. Never reversible from inside the game. */
  function flagTampered(reason) {
    if (Game.state.integrity) return;
    Game.state.integrity = reason;
    console.warn('[Durian Clicker] ' + reason +
                 ' \u2014 this save is no longer eligible for the leaderboard.');
    Events.emit('integrityFailed', reason);
    if (DC.Save) DC.Save.save(true);
  }

  /*
   * Click income has a hard ceiling: clickPower x CLICK_LIMIT per second. This
   * is checked against what actually arrived, so even a script that replaces
   * the click function outright is caught by the money it produces rather than
   * by the route it took. Slack is generous — this is here to catch a hundred
   * times the limit, not a rounding difference.
   */
  var lastClickEarned = null;

  /**
   * Click income has a ceiling: clickPower x CLICK_LIMIT for each second of
   * game time. Checking the money rather than the route means a script that
   * replaces the click function outright is still caught.
   *
   * The window is the tick loop's own accumulated time, NOT wall-clock between
   * audits: a burst of clicks can all land in the same millisecond, and
   * measuring that against elapsed real time gave a ceiling of nearly zero and
   * accused honest autoclickers. Slack is 3x, so this catches a hundred times
   * the limit and never a legitimate fast clicker.
   */
  var lastAuditWall = 0;

  function auditClickIncome(windowSeconds) {
    var now = Date.now();
    // Use whichever window is LONGER: the tick loop's accumulated game time,
    // or the real time since the last audit. A burst of clicks can land in one
    // millisecond (game time is the fair measure), while a slow or backgrounded
    // tab can let real seconds pass between ticks (real time is the fair
    // measure). Taking the larger keeps honest players clean in both cases.
    var wall = lastAuditWall ? (now - lastAuditWall) / 1000 : 0;
    lastAuditWall = now;
    if (wall > windowSeconds) windowSeconds = wall;

    var earned = Game.state.clickEarned;
    if (lastClickEarned === null || !(windowSeconds > 0)) {
      lastClickEarned = earned;
      return;
    }
    var gained = N.sub(earned, lastClickEarned);
    lastClickEarned = earned;
    if (gained.m <= 0) return;

    var ceiling = N.mul(Game.derived.clickPower, CLICK_HARD_CAP * windowSeconds * 2);
    if (N.cmp(gained, ceiling) > 0) {
      flagTampered('clicks earned more than the click limit allows');
    }
  }

  function auditBank(windowSeconds) {
    auditClickIncome(windowSeconds);
    if (JSON.stringify(CONFIG.balance) !== BALANCE_MARK) {
      flagTampered('the balance settings were changed');
      BALANCE_MARK = JSON.stringify(CONFIG.balance);
    }
    var reason = whatWasEdited();
    if (reason) {
      flagTampered(reason);
      markBank();                       // resync: flag once, not every second
    }
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
    markBank();
  }

  function spendDurians(amount) {
    var s = Game.state;
    amount = N.big(amount);
    if (!N.gte(s.durians, amount)) return false;
    s.durians = N.sub(s.durians, amount);
    s.spent = N.add(s.spent, amount);
    markBank();
    return true;
  }

  /* Rolling one-second window of click times, for the rate limiter. */
  var recentClicks = [];

  /**
   * How much of a click actually pays. Up to maxClickRate per second it is the
   * full amount; past that the extra clicks are worth a small fraction. A
   * console script firing thousands of clicks per frame therefore earns
   * almost nothing, while anyone clicking by hand is unaffected.
   */
  /*
   * The limit is read ONCE, here, and kept in this closure. It used to be read
   * from CONFIG on every click, which meant `CONFIG.balance.maxClickRate = 0`
   * from the console turned the whole thing off in one line — the escape hatch
   * was doing more work for a cheat than it ever did for testing.
   *
   * Nothing outside this file can reach these values now, and editing CONFIG
   * afterwards has no effect on them.
   */
  /*
   * Clicks past CLICK_LIMIT still pay a fraction, but the fraction is not
   * unlimited: at a few thousand clicks a second the overflow alone added up
   * to more than the limit was meant to allow. Total click income in any
   * second is therefore capped at CLICK_HARD_CAP click-equivalents, after
   * which further clicks register (animation, achievements) and pay nothing.
   *
   * This also gives the income audit a ceiling it can trust: honest clicking
   * cannot exceed the cap at any rate, so anything above it came from
   * somewhere else.
   */
  var CLICK_HARD_CAP = CLICK_LIMIT * 2;
  var paidUnits = 0;

  function clickRateFactor() {
    var now = Date.now();
    while (recentClicks.length && now - recentClicks[0].t > 1000) {
      paidUnits -= recentClicks.shift().paid;
    }
    var paid;
    if (recentClicks.length < CLICK_LIMIT) paid = 1;
    else if (paidUnits < CLICK_HARD_CAP) paid = CLICK_OVERFLOW;
    else paid = 0;

    recentClicks.push({ t: now, paid: paid });
    paidUnits += paid;
    return paid;
  }

  /** Clicks in the last second, for the UI. */
  function currentClickRate() {
    var now = Date.now();
    while (recentClicks.length && now - recentClicks[0] > 1000) recentClicks.shift();
    if (recentClicks.length > (Game.state.peakClickRate || 0)) {
      Game.state.peakClickRate = recentClicks.length;
    }
    return recentClicks.length;
  }

  /** Clicks per second averaged over the whole save. */
  function averageClickRate() {
    var t = Game.state.playTime;
    return t > 0 ? Game.state.totalClicks / t : 0;
  }

  /** Player clicked the durian. Returns how much was earned. */
  function click() {
    var factor = clickRateFactor();
    var gained = factor === 1 ? Game.derived.clickPower
                              : N.mul(Game.derived.clickPower, factor);
    Game.state.totalClicks++;
    addDurians(gained, 'click');
    Events.emit('click', { amount: gained, throttled: factor !== 1 });
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
    if (DC.Store) {
      DC.Store.checkRewards();
      DC.Store.checkBackgroundRewards();
    }
  }

  /* ------------------------------------------------------------- the loop */

  var auditSeconds = 0;
  var lastTime = 0, lastWall = 0, accumulator = 0, uiAccumulator = 0, progressAccumulator = 0;

  function frame(now) {
    if (!Game.running) return;
    var dt = frameSeconds(now);

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

    // Audit BEFORE producing: production calls addDurians, which re-marks the
    // bank, and would quietly absorb an edit made since the last tick.
    auditSeconds += dt;
    if (auditSeconds >= 1) { auditBank(auditSeconds); auditSeconds = 0; }

    s.playTime += dt;
    var produced = N.mul(Game.derived.dps, dt);
    if (produced.m > 0) addDurians(produced, 'worker');
    if (DC.IslandEvents) DC.IslandEvents.update();
    if (DC.Coins) DC.Coins.update();
    currentClickRate();               // keeps the peak up to date
    Events.emit('tick', { dt: dt });
  }

  function start() {
    if (Game.running) return;
    Game.running = true;
    lastTime = performance.now();
    lastWall = Date.now();
    requestAnimationFrame(frame);
  }

  /**
   * How much game time this frame is worth.
   *
   * Idle games are routinely sped up by overriding the clock or the frame
   * driver from the console. Taking the SMALLER of two independent clocks
   * means speeding up either one alone gains nothing — both have to be
   * faked in step. It also means the frame rate is irrelevant: production is
   * paced by elapsed real seconds, so fast hardware earns no more than slow.
   */
  function frameSeconds(now) {
    var perfDelta = (now - lastTime) / 1000;
    var wallDelta = (Date.now() - lastWall) / 1000;
    lastTime = now;
    lastWall = Date.now();

    var dt = Math.min(perfDelta, wallDelta);
    if (!(dt > 0)) return 0;                        // clock went backwards
    var cap = CONFIG.balance.maxFrameSeconds || 1;
    if (dt > cap) dt = cap;                         // tab-away gaps are offline earnings
    return dt * (CONFIG.balance.timeScale || 1);
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
    markBank: markBank,
    auditBank: auditBank,
    flagTampered: flagTampered,
    currentClickRate: currentClickRate,
    averageClickRate: averageClickRate,
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
