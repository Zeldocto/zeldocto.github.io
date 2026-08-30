/* balance.js — measures the whole economy and reports what is out of line.
 *
 *   node balance.js [days]
 *
 * Runs a greedy-but-plausible player from a fresh save, then reports:
 *   1. Pacing      — time to each order of magnitude, and any droughts
 *   2. Crew        — output share and value-for-money across the roster
 *   3. Upgrades    — payback time for every upgrade, flagging dead and free ones
 *   4. Clicking    — click power against passive income
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const DAYS = parseInt(process.argv[2] || '120', 10);

function load() {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
  const w = dom.window;
  w.requestAnimationFrame = () => 0;
  ['config.js','content/upgrades.js','content/achievements.js','content/events.js',
   'content/skins.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js',
   'offline.js','events.js','coins.js','casino.js','store.js']
    .forEach(f => w.eval(fs.readFileSync(ROOT + 'js/' + f, 'utf8')));
  return w.DC;
}

const DC = load(), N = DC.N, G = DC.Game, C = DC.CONFIG;
const num = v => N.toNumber(v);
const fmtT = s => s < 3600 ? (s/60).toFixed(0)+'m'
              : s < 86400 ? (s/3600).toFixed(1)+'h'
              : (s/86400).toFixed(1)+'d';

/* ---------------------------------------------------------------- helpers */

/** DPS gain from owning an upgrade, measured by toggling it. */
function dpsDelta(id) {
  const had = G.state.upgrades[id];
  const before = num(G.derived.dps);
  G.state.upgrades[id] = true; G.recalc();
  const after = num(G.derived.dps);
  if (!had) delete G.state.upgrades[id];
  G.recalc();
  return after - before;
}

/* ------------------------------------------------------------- simulation */

G.recalc(); G.checkUnlocks();
const t0 = { magnitudes: {}, upgradeTimes: {}, droughts: [], perDay: [] };
let t = 0, dt = 60, lastMag = 0, lastBuy = 0, dayBuys = 0, day = 0;

// a modest amount of clicking early on, as a real player would
function clicksThisStep(elapsed) {
  if (elapsed < 600) return 3 * dt;        // engaged at the very start
  if (elapsed < 3600) return 1 * dt;
  if (elapsed < 86400) return 0.15 * dt;   // occasional
  return 0;
}

while (t < DAYS * 86400) {
  const clicks = Math.floor(clicksThisStep(t));
  for (let i = 0; i < clicks; i++) G.click();
  G.tick(dt);
  G.checkProgress();

  let bought = true;
  while (bought) {
    bought = false;
    // upgrades first when they pay for themselves reasonably
    for (const u of C.upgrades) {
      if (!DC.Upgrades.canBuy(u)) continue;
      DC.Upgrades.buy(u.id);
      t0.upgradeTimes[u.id] = t;
      lastBuy = t; dayBuys++; bought = true;
    }
    // then the best-value worker
    let best = null, bestVal = 0;
    for (const wk of C.workers) {
      if (!G.state.unlocked[wk.id]) continue;
      const cost = DC.Workers.costOf(wk);
      if (!N.gte(G.state.durians, cost)) continue;
      const val = num(G.derived.perWorker[wk.id]) / num(cost);
      if (val > bestVal) { bestVal = val; best = wk; }
    }
    if (best) { DC.Workers.buy(best.id, 1); lastBuy = t; bought = true; }
  }

  const mag = Math.floor(N.log10(G.state.totalEarned));
  if (mag > lastMag && mag >= 3) { t0.magnitudes[mag] = t; lastMag = mag; }

  if (t - lastBuy > 6 * 3600) { t0.droughts.push({ at: lastBuy, len: t - lastBuy }); lastBuy = t; }

  if (Math.floor(t / 86400) > day) { t0.perDay.push(dayBuys); dayBuys = 0; day++; }
  t += dt;
}

/* ------------------------------------------------------------------ report */

console.log('='.repeat(66));
console.log('BALANCE REPORT   ' + DAYS + ' simulated days   ' + C.upgrades.length +
            ' upgrades / ' + C.workers.length + ' crew');
console.log('='.repeat(66));

console.log('\n1. PACING');
const owned = C.upgrades.filter(u => G.state.upgrades[u.id]).length;
console.log('   upgrades bought      : ' + owned + '/' + C.upgrades.length +
            '  (' + Math.round(owned / C.upgrades.length * 100) + '%)');
console.log('   achievements earned  : ' + Object.keys(G.state.achievements).length +
            '/' + C.achievements.length);
console.log('   final production     : ' + N.format(G.derived.dps) + '/sec');
console.log('   total earned         : ' + N.format(G.state.totalEarned));
const times = Object.values(t0.upgradeTimes).sort((a, b) => a - b);
console.log('   last upgrade bought  : ' + (times.length ? fmtT(times[times.length - 1]) : 'n/a'));

console.log('\n   milestones:');
[3, 6, 9, 12, 18, 24, 30, 40, 50, 70, 100].forEach(m => {
  if (t0.magnitudes[m] !== undefined) {
    console.log('     1e' + String(m).padEnd(4) + ' at ' + fmtT(t0.magnitudes[m]));
  }
});

const bad = t0.droughts.filter(d => d.len > 12 * 3600);
console.log('\n   droughts over 12h with nothing to buy: ' + bad.length);
bad.slice(0, 5).forEach(d => console.log('     ' + fmtT(d.len) + ' starting at ' + fmtT(d.at)));
const early = t0.perDay.slice(0, 14).reduce((a, b) => a + b, 0);
const late = t0.perDay.slice(-14).reduce((a, b) => a + b, 0);
console.log('   purchases in first 14 days: ' + early + ',  last 14 days: ' + late);

console.log('\n2. CREW  (share of production, and value at the price you pay)');
const totalDps = num(G.derived.dps);
console.log('   ' + 'worker'.padEnd(23) + 'owned'.padStart(7) + 'share'.padStart(9) + '   per-durian value');
C.workers.forEach(wk => {
  const share = num(G.derived.workerDps[wk.id]) / totalDps * 100;
  const cost = num(DC.Workers.costOf(wk));
  const value = num(G.derived.perWorker[wk.id]) / cost;
  console.log('   ' + wk.name.padEnd(23) +
              String(G.state.workers[wk.id]).padStart(7) +
              (share.toFixed(2) + '%').padStart(9) +
              '   ' + value.toExponential(2));
});

console.log('\n3. UPGRADES  (payback = cost / DPS gained, lower is better value)');
const analysis = [];
C.upgrades.forEach(u => {
  const gain = dpsDelta(u.id);
  analysis.push({ id: u.id, name: u.name, cost: u.cost, gain: gain,
                  payback: gain > 0 ? u.cost / gain : Infinity });
});
const productive = analysis.filter(a => a.gain > 0);
const dead = analysis.filter(a => a.gain <= 0);
const pb = productive.map(a => a.payback).sort((a, b) => a - b);
const median = pb[Math.floor(pb.length / 2)];
console.log('   upgrades that raise DPS : ' + productive.length + '/' + C.upgrades.length);
console.log('   median payback          : ' + median.toExponential(2) + ' seconds of production');
console.log('   (click / offline / event upgrades do not raise DPS: ' + dead.length + ')');

const awful = productive.filter(a => a.payback > median * 500).sort((a, b) => b.payback - a.payback);
console.log('\n   POOR VALUE (payback over 500x the median): ' + awful.length);
awful.slice(0, 10).forEach(a => console.log('     ' + a.name.padEnd(32) +
  'cost ' + a.cost.toExponential(1).padStart(9) + '   payback ' + a.payback.toExponential(1)));

const free = productive.filter(a => a.payback < median / 500).sort((a, b) => a.payback - b.payback);
console.log('\n   SUSPICIOUSLY CHEAP (payback under 1/500th of median): ' + free.length);
free.slice(0, 10).forEach(a => console.log('     ' + a.name.padEnd(32) +
  'cost ' + a.cost.toExponential(1).padStart(9) + '   payback ' + a.payback.toExponential(1)));

console.log('\n4. CLICKING');
const ratio = num(G.derived.clickPower) / totalDps;
console.log('   one click is worth ' + ratio.toFixed(3) + ' seconds of production');
console.log('   sustained 8 clicks/sec = ' + (ratio * 8).toFixed(2) + 'x passive income');

console.log('\n' + '='.repeat(66));
