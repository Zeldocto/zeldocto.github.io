/* =============================================================================
 * casino.js — the slot machine.
 * -----------------------------------------------------------------------------
 * Every spin costs a Blue Coin AND a Durian stake. The Blue Coin is the real
 * limiter: without it you could spin freely with late-game Durians and farm
 * Blue Coins out of the jackpot, which would make them worthless. Coins are
 * scarce, so spins are scarce, and the reels stay a treat rather than a faucet.
 *
 * Reels are weighted (see CONFIG.casino.symbols). Three matching pays that
 * symbol's `triple` multiplier, two matching returns the stake, anything else
 * loses it. Blue Coin symbols also pay out actual Blue Coins — but a spin costs
 * more coins than it returns on average, so this can never be farmed.
 *
 * House edge is about 12% on the Durian stake — deliberately a sink. resolve()
 * is pure, so the odds are unit-testable.
 * ========================================================================== */
(function (DC) {
  'use strict';

  var N = DC.N;
  var CONFIG = DC.CONFIG;

  function cfg() { return CONFIG.casino; }
  function symbols() { return cfg().symbols; }

  function symbolById(id) {
    var list = symbols();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /** Weighted pick for one reel. */
  function spinReel(rng) {
    var list = symbols(), total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var roll = (rng || Math.random)() * total;
    for (i = 0; i < list.length; i++) {
      roll -= list[i].weight;
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /**
   * Works out what a set of reels pays. Pure — no state, no DOM.
   * Returns { reels, kind: 'triple'|'pair'|'none', multiplier, coins, symbol }
   */
  function resolve(reels) {
    var counts = {};
    reels.forEach(function (s) { counts[s.id] = (counts[s.id] || 0) + 1; });

    var bestId = null, bestCount = 0;
    Object.keys(counts).forEach(function (id) {
      if (counts[id] > bestCount) { bestCount = counts[id]; bestId = id; }
    });
    var sym = symbolById(bestId);

    if (bestCount >= 3) {
      return { reels: reels, kind: 'triple', symbol: sym,
               multiplier: sym.triple, coins: sym.tripleCoins || 0 };
    }
    if (bestCount === 2) {
      return { reels: reels, kind: 'pair', symbol: sym,
               multiplier: cfg().pairPayout, coins: 0 };
    }
    return { reels: reels, kind: 'none', symbol: null, multiplier: 0, coins: 0 };
  }

  function roll(rng) {
    var reels = [];
    for (var i = 0; i < cfg().reels; i++) reels.push(spinReel(rng));
    return reels;
  }

  /* ------------------------------------------------------------ stake sizing */

  /** Bet is a share of the bank, so it stays meaningful at every scale. */
  function betFor(fraction) {
    var bank = DC.Game.state.durians;
    var bet = N.mul(bank, fraction);
    var min = N.big(cfg().minBet);
    if (N.lt(bet, min)) bet = min;
    if (N.lt(bank, bet)) bet = bank;
    return N.ceil(bet);
  }

  /** A spin needs both a Blue Coin and enough Durians for the stake. */
  function canPlay(fraction) {
    if (!cfg().enabled) return false;
    if (!DC.Coins.canAfford(cfg().coinSpinCost)) return false;
    var bet = betFor(fraction);
    return N.gte(DC.Game.state.durians, bet) && bet.m > 0;
  }

  /** Why the spin button is disabled, for the UI to explain. */
  function blockedReason(fraction) {
    if (!cfg().enabled) return 'closed';
    if (!DC.Coins.canAfford(cfg().coinSpinCost)) return 'no-coins';
    var bet = betFor(fraction);
    if (!N.gte(DC.Game.state.durians, bet) || bet.m <= 0) return 'no-durians';
    return null;
  }

  /* ----------------------------------------------------------------- playing */

  /**
   * Plays one round. Returns a result object for the UI to animate, or null if
   * the player couldn't afford it.
   */
  function play(fraction, rng) {
    var s = DC.Game.state;
    if (!cfg().enabled) return null;
    if (blockedReason(fraction)) return null;

    var stake = betFor(fraction);

    // Take the coin first, then the stake. If either fails, nothing is spent.
    if (!DC.Coins.spend(cfg().coinSpinCost)) return null;
    if (!DC.Game.spendDurians(stake)) {
      DC.Coins.award(cfg().coinSpinCost);          // refund, never eat the coin
      return null;
    }

    var reels = roll(rng);
    var outcome = resolve(reels);
    var payout = N.mul(stake, outcome.multiplier);
    var coins = outcome.coins;

    if (payout.m > 0) DC.Game.addDurians(payout, 'worker');
    if (coins > 0) DC.Coins.award(coins);

    var c = s.casino;
    c.spins = (c.spins || 0) + 1;
    c.coinsSpent = (c.coinsSpent || 0) + cfg().coinSpinCost;
    c.wagered = N.add(c.wagered || N.ZERO, stake);
    c.won = N.add(c.won || N.ZERO, payout);
    if (outcome.kind === 'none') {
      c.streak = (c.streak || 0) + 1;
      if (c.streak > (c.worstStreak || 0)) c.worstStreak = c.streak;
    } else {
      c.wins = (c.wins || 0) + 1;
      c.streak = 0;
      if (N.gte(payout, c.biggestWin || N.ZERO)) c.biggestWin = payout;
    }
    if (outcome.kind === 'triple') c.triples = (c.triples || 0) + 1;
    if (outcome.symbol && outcome.symbol.id === 'coin' && outcome.kind === 'triple') {
      c.jackpots = (c.jackpots || 0) + 1;
    }

    DC.Game.checkProgress();

    var result = {
      reels: reels,
      kind: outcome.kind,
      symbol: outcome.symbol,
      stake: stake,
      coinCost: cfg().coinSpinCost,
      payout: payout,
      coins: coins,
      net: N.sub(payout, stake),
      jackpot: !!(outcome.symbol && outcome.symbol.id === 'coin' && outcome.kind === 'triple')
    };
    DC.Events.emit('slotsResult', result);
    return result;
  }

  /**
   * Blue Coins returned per coin spent. Must stay well under 1 or the slots
   * become a Blue Coin faucet and the whole scarcity model collapses.
   */
  function coinReturn() {
    var list = symbols(), total = 0;
    list.forEach(function (x) { total += x.weight; });
    var earned = 0;
    list.forEach(function (sym) {
      var p = sym.weight / total;
      earned += Math.pow(p, 3) * (sym.tripleCoins || 0);
    });
    return earned / cfg().coinSpinCost;
  }

  /** Theoretical return per unit staked — used by the balance test. */
  function expectedReturn() {
    var list = symbols(), total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;

    var ev = 0;
    list.forEach(function (sym) {
      var p = sym.weight / total;
      ev += Math.pow(p, 3) * sym.triple;                       // three matching
      ev += 3 * p * p * (1 - p) * cfg().pairPayout;            // exactly two
    });
    return ev;
  }

  DC.Casino = {
    play: play,
    resolve: resolve,
    roll: roll,
    spinReel: spinReel,
    betFor: betFor,
    canPlay: canPlay,
    blockedReason: blockedReason,
    coinReturn: coinReturn,
    symbols: symbols,
    symbolById: symbolById,
    expectedReturn: expectedReturn
  };
})(window.DC = window.DC || {});
