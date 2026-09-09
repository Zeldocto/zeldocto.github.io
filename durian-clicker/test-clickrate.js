/* The click rate limiter. A real save showed 47.8 clicks/sec sustained for 15
 * hours — 40.6% of everything earned came from clicking. Human play must be
 * unaffected; autoclickers must stop being a production strategy. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const FILES = ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js',
  'content/skins.js','content/backgrounds.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js',
  'offline.js','events.js','coins.js','casino.js','store.js'];

function fresh(cap) {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
  const w = dom.window;
  FILES.forEach(f => w.eval(fs.readFileSync(ROOT + 'js/' + f, 'utf8')));
  const DC = w.DC, G = DC.Game;
  if (cap !== undefined) DC.CONFIG.balance.maxClickRate = cap;
  DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 1000; });
  DC.CONFIG.upgrades.forEach(u => G.state.upgrades[u.id] = true);
  DC.CONFIG.achievements.forEach(a => G.state.achievements[a.id] = Date.now());
  G.recalc(); G.checkProgress(); G.recalc();
  return DC;
}
function burst(DC, n) {
  const N = DC.N, G = DC.Game;
  const dps = N.toNumber(G.derived.dps);
  G.state.durians = N.ZERO;
  for (let i = 0; i < n; i++) G.click();
  return N.toNumber(G.state.durians) / dps;
}

let fails = 0;
const eq = (l, g, e) => { if (String(g) !== String(e)) { fails++; console.log('FAIL', l, '| got', g, '| want', e); } else console.log('  ok  ', l, '=', g); };

const cap = fresh().CONFIG.balance.maxClickRate;
console.log('configured cap: ' + cap + ' clicks/sec\n');

console.log('=== human speeds are untouched ===');
[3, 6, 10].forEach(rate => {
  const capped = burst(fresh(), rate);
  const free = burst(fresh(999999), rate);
  eq(rate + '/sec unaffected', Math.abs(capped - free) < 0.001, true);
});

console.log('\n=== autoclicker speeds are curtailed ===');
const at48capped = burst(fresh(), 48);
const at48free = burst(fresh(999999), 48);
console.log('     48/sec: ' + at48free.toFixed(2) + 'x uncapped -> ' + at48capped.toFixed(2) + 'x capped');
eq('48/sec is cut by more than half', at48capped < at48free / 2, true);
const at100capped = burst(fresh(), 100);
const at100free = burst(fresh(999999), 100);
eq('100/sec is cut by more than 5x', at100capped < at100free / 5, true);
eq('doubling the rate past the cap barely helps',
   (at100capped / at48capped) < 1.5, true);

console.log('\n=== the limiter is a soft cap, not a wall ===');
eq('extra clicks still earn something', at100capped > at48capped, true);
eq('clicks still count toward achievements', (() => {
  const DC = fresh(); const before = DC.Game.state.totalClicks;
  for (let i = 0; i < 50; i++) DC.Game.click();
  return DC.Game.state.totalClicks - before;
})(), 50);

console.log('\n=== the window rolls ===');
{
  const DC = fresh(), N = DC.N, G = DC.Game;
  for (let i = 0; i < 40; i++) G.click();
  eq('rate is reported', G.currentClickRate() >= 40, true);
}

console.log('\n=== it can be switched off ===');
{
  const free = burst(fresh(999999), 48), same = burst(fresh(0), 48);
  eq('maxClickRate 0 disables the limiter', Math.abs(free - same) < 0.001, true);
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'Click rate limiter verified.'));
process.exit(fails ? 1 : 0);
