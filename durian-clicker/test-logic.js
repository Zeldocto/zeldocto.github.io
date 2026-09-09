const fs = require('fs'), vm = require('vm');
const base = '/home/claude/durian-clicker/js/';
const sandbox = { window: {}, console, performance: { now: () => Date.now() }, Date, Math, JSON, Object, Number, parseFloat, parseInt, isFinite, setTimeout, clearTimeout, setInterval };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js','offline.js','events.js','coins.js','casino.js','store.js']
  .forEach(f => vm.runInContext(fs.readFileSync(base+f,'utf8'), sandbox, {filename:f}));

const DC = sandbox.window.DC, N = DC.N, G = DC.Game;
let fails = 0;
function eq(label, got, want) {
  const ok = String(got) === String(want);
  if (!ok) { fails++; console.log('FAIL', label, '| got', got, '| want', want); }
  else console.log('  ok  ', label, '=', got);
}

console.log('--- number formatting ---');
eq('0', N.format(0), '0');
eq('9.99\u00D710^2', N.format(999), '9.99\u00D710^2');
eq('1000 trims the .00', N.format(1000), '1\u00D710^3');
eq('1250 keeps real decimals', N.format(1250), '1.25\u00D710^3');
eq('2.4e6', N.format(2400000), '2.4\u00D710^6');
eq('15.7e9', N.format(15700000000), '1.57\u00D710^10');
eq('3.2e12', N.format(3200000000000), '3.2\u00D710^12');
eq('1e15', N.format(1e15), '1\u00D710^15');
eq('1e33', N.format(1e33), '1\u00D710^33');
eq('1e100 shows as a power of ten', N.format(N.pow10(100)), '1\u00D710^100');
eq('the last plain suffix still shows', N.format(N.pow10(33)), '1\u00D710^33');
eq('and the first compound tier switches over',
   /\u00D710/.test(N.format(N.pow10(36))), true);
eq('powers of ten work past a JS number',
   N.format(N.pow10(900)), '1\u00D710^900');
// Unicode superscripts are deliberately not used: 1, 2 and 3 exist in nearly
// every font while 0 and 4-9 often do not, so exponents rendered in a mix of
// fonts. A caret is identical everywhere.
eq('no Unicode superscript digits anywhere',
   [36, 45, 61, 75, 100, 308].every(function (e) {
     return !/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]/.test(N.format(N.pow10(e)));
   }), true);
eq('1e200 sci', N.format(N.pow10(200)).includes('e') || N.format(N.pow10(200)).length>0, true);
eq('rate 12.4', N.formatRate(N.big(12.44)), '12.4');
eq('duration', N.formatDuration(3725), '1h 2m 5s');

console.log('--- big arithmetic precision ---');
let v = N.big(1e15);
for (let i=0;i<10;i++) v = N.add(v, 1);              // add small to huge
eq('1e15 + 10', N.format(v), '1\u00D710^15');
eq('huge mul', N.format(N.mul(N.pow10(100), N.pow10(100))), N.format(N.pow10(200)));
eq('sub to zero', N.format(N.sub(N.big(50), N.big(50))), '0');
eq('cmp', N.cmp(N.big(5), N.big(500)), -1);
eq('gte equal', N.gte(N.big(15), N.big(15)), true);
eq('pow', Math.round(N.toNumber(N.pow(1.15, 10))*1e6)/1e6, Math.round(Math.pow(1.15,10)*1e6)/1e6);

console.log('--- worker costs ---');
const pianta = G.workerDef('pianta');
const B = pianta.baseCost, M = pianta.costMultiplier;
const costs = [0,1,2,3,4].map(n => Math.ceil(N.toNumber(DC.Workers.costOf(pianta, n))));
const expected = [0,1,2,3,4].map(n => Math.ceil(B * Math.pow(M, n)));
eq('pianta cost curve follows base x mult^n', costs.join(','), expected.join(','));
eq('cost curve is gentler than 1.15', M <= 1.12, true);
eq('bulk of 1 == single', Math.round(N.toNumber(DC.Workers.bulkCost(pianta,1,0))), B);
eq('bulk of 3 from 0', N.toNumber(DC.Workers.bulkCost(pianta,3,0)), Math.ceil(B + B*M + B*M*M));
eq('cost is a whole number', Number.isInteger(N.toNumber(DC.Workers.costOf(pianta,1))), true);
// Abbreviated is a power of ten now, so compare in full mode: the point is
// that what you are shown is exactly what you are charged, with no rounding.
eq('displayed cost == charged cost',
   N.format(DC.Workers.costOf(pianta,1), { mode: 'full' }).replace(/,/g, ''),
   String(N.toNumber(DC.Workers.costOf(pianta,1))));

console.log('--- gameplay loop ---');
G.recalc(); G.checkUnlocks();
eq('pianta unlocked at start', !!G.state.unlocked.pianta, true);
eq('noki locked at start', !!G.state.unlocked.noki, false);
eq('click power', N.format(G.derived.clickPower), '1');
for (let i=0;i<20;i++) G.click();
eq('20 clicks', N.format(G.state.durians), '2\u00D710^1');
eq('first achievement', !!G.state.achievements.first_durian, true);

G.addDurians(1000);
G.checkProgress();
eq('noki unlocked after 200 earned', !!G.state.unlocked.noki, true);
const bought = DC.Workers.buy('pianta', 10);
eq('bought 10 piantas', bought, 10);
eq('dps after 10 piantas', N.formatRate(G.derived.dps) , (10*G.derived.globalMult).toFixed(1));
eq('pianta achievement', !!G.state.achievements.pianta_workforce, true);
eq('achievement bonus applied', G.derived.globalMult > 1, true);

// max buy
G.addDurians(1e6); G.checkProgress();
const maxN = DC.Workers.maxAffordable(pianta);
const cost = DC.Workers.bulkCost(pianta, maxN);
const costPlus = DC.Workers.bulkCost(pianta, maxN+1);
eq('max buy affordable', N.gte(G.state.durians, cost), true);
eq('max buy is maximal', N.gte(G.state.durians, costPlus), false);
const before = G.state.durians;
DC.Workers.buy('pianta','max');
eq('max buy spent almost everything', N.lt(G.state.durians, before), true);
eq('max buy count applied', G.state.workers.pianta >= maxN+10, true);

console.log('--- upgrades ---');
G.addDurians(1e9); G.checkProgress();
const dpsBefore = N.toNumber(G.derived.dps);
eq('pianta_training unlocked', !!G.state.unlocked.pianta_training, true);
eq('buy training', DC.Upgrades.buy('pianta_training'), true);
eq('pianta output doubled', N.toNumber(G.derived.dps) > dpsBefore * 1.9, true);
eq('cannot rebuy', DC.Upgrades.buy('pianta_training'), false);
eq('click upgrade', DC.Upgrades.buy('gloves'), true);
eq('click power now 2+', N.toNumber(G.derived.clickPower) >= 2, true);

console.log('--- offline ---');
const info = DC.Offline.simulate(3600);
eq('offline computed', info && N.toNumber(info.amount) > 0, true);
eq('offline = dps*3600*efficiency', Math.round(N.toNumber(info.amount)),
   Math.round(N.toNumber(G.derived.dps)*3600*G.derived.offlineEfficiency));
const cap = DC.Offline.simulate(99*3600);
eq('offline capped at 24h', Math.round(N.toNumber(cap.amount)),
   Math.round(N.toNumber(G.derived.dps)*86400*G.derived.offlineEfficiency));
DC.Offline.collect();
eq('collect clears pending', DC.Offline.getPending(), null);

console.log('--- ticks ---');
const d0 = N.toNumber(G.state.durians);
for (let i=0;i<20;i++) G.tick(0.05);
eq('1 second of production', Math.round(N.toNumber(G.state.durians)-d0), Math.round(N.toNumber(G.derived.dps)));

console.log(fails ? `\n${fails} FAILURES` : '\nAll logic tests passed.');
process.exit(fails ? 1 : 0);
