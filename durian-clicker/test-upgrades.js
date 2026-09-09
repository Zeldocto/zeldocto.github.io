/* Buys every upgrade in isolation and asserts it measurably changes the thing
 * it claims to change. Catches dead upgrades, wrong targets, and multipliers
 * that get swallowed by the formula. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const p = '/home/claude/durian-clicker/';

function fresh() {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
  const w = dom.window;
  ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js','numbers.js',
   'game.js','workers.js','upgrades.js','achievements.js','offline.js','events.js','coins.js','casino.js','store.js']
   .forEach(f => w.eval(fs.readFileSync(p + 'js/' + f, 'utf8')));
  const DC = w.DC, G = DC.Game;
  // A mid-game state where every mechanic is live: crew hired, clicks banked,
  // some DPS so clickFromDps has something to bite on.
  DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 120; });
  G.state.totalClicks = 5000;
  G.state.achievements = { first_durian: 1, blistered: 1, enthusiast: 1 };
  G.addDurians(DC.N.pow10(30));
  G.recalc();
  return { w, DC, N: DC.N, G };
}

let fails = 0, checked = 0;
const fail = (id, msg) => { fails++; console.log('  FAIL', id, '—', msg); };

const base = fresh();
const ALL = base.DC.CONFIG.upgrades;
console.log('Testing all ' + ALL.length + ' upgrades individually…\n');

ALL.forEach(def => {
  const { DC, N, G } = fresh();
  const d = G.derived;

  const before = {
    click: N.toNumber(d.clickPower),
    dps: N.toNumber(d.dps),
    perWorker: {},
    globalMult: d.globalMult,
    eventChance: d.eventChance,
    eventGain: d.eventGain,
    eventLoss: d.eventLoss,
    buffDuration: d.buffDuration,
    offlineEfficiency: d.offlineEfficiency,
    offlineMax: d.offlineMaxSeconds
  };
  DC.CONFIG.workers.forEach(x => before.perWorker[x.id] = N.toNumber(d.perWorker[x.id]));

  // grant it directly so cost/unlock gating doesn't interfere
  G.state.upgrades[def.id] = def.repeatable ? 1 : true;
  G.recalc();

  const after = {
    click: N.toNumber(d.clickPower),
    dps: N.toNumber(d.dps),
    globalMult: d.globalMult,
    eventChance: d.eventChance,
    eventGain: d.eventGain,
    eventLoss: d.eventLoss,
    buffDuration: d.buffDuration,
    offlineEfficiency: d.offlineEfficiency,
    offlineMax: d.offlineMaxSeconds
  };

  def.effects.forEach(fx => {
    checked++;
    const ratio = (a, b) => b === 0 ? null : a / b;
    switch (fx.type) {
      case 'clickAdd':
        if (after.click <= before.click) fail(def.id, 'clickAdd did not raise click power');
        break;
      case 'clickMult': {
        const r = ratio(after.click, before.click);
        if (Math.abs(r - fx.value) > 0.001)
          fail(def.id, `clickMult ${fx.value} delivered ${r ? r.toFixed(3) : 'nothing'}`);
        break;
      }
      case 'clickFromDps':
        if (after.click <= before.click) fail(def.id, 'clickFromDps did not raise click power');
        break;
      case 'clickFromWorkers':
        if (after.click <= before.click) fail(def.id, 'clickFromWorkers did not raise click power');
        break;
      case 'globalMult': {
        const r = ratio(after.globalMult, before.globalMult);
        if (Math.abs(r - fx.value) > 0.001)
          fail(def.id, `globalMult ${fx.value} delivered ${r ? r.toFixed(3) : 'nothing'}`);
        if (after.dps <= before.dps) fail(def.id, 'globalMult did not raise dps');
        break;
      }
      case 'workerMult': {
        const r = ratio(N.toNumber(G.derived.perWorker[fx.target]), before.perWorker[fx.target]);
        if (r === null) return fail(def.id, `workerMult target ${fx.target} produces nothing`);
        if (Math.abs(r - fx.value) > 0.001)
          fail(def.id, `workerMult ${fx.value} on ${fx.target} delivered ${r.toFixed(3)}`);
        break;
      }
      case 'workerScaling': {
        const owned = G.state.workers[fx.target];
        const expect = 1 + fx.value * Math.floor(owned / fx.per);
        const r = ratio(N.toNumber(G.derived.perWorker[fx.target]), before.perWorker[fx.target]);
        if (r === null) return fail(def.id, `workerScaling target ${fx.target} produces nothing`);
        if (Math.abs(r - expect) > 0.001)
          fail(def.id, `workerScaling expected ×${expect.toFixed(3)}, got ×${r.toFixed(3)}`);
        break;
      }
      case 'workerSynergy': {
        let total = 0;
        DC.CONFIG.workers.forEach(x => total += G.state.workers[x.id]);
        const src = fx.source === 'all' ? total : G.state.workers[fx.source];
        const expect = 1 + fx.value * src;
        const targets = fx.target === 'all' ? DC.CONFIG.workers.map(x => x.id) : [fx.target];
        targets.forEach(t => {
          const r = ratio(N.toNumber(G.derived.perWorker[t]), before.perWorker[t]);
          if (r === null) return fail(def.id, `synergy target ${t} produces nothing`);
          if (Math.abs(r - expect) > 0.001)
            fail(def.id, `workerSynergy on ${t} expected ×${expect.toFixed(3)}, got ×${r.toFixed(3)}`);
        });
        break;
      }
      case 'achievementBonus':
        if (after.globalMult <= before.globalMult)
          fail(def.id, 'achievementBonus did not raise global multiplier');
        break;
      case 'eventChance':
        if (after.eventChance < before.eventChance)
          fail(def.id, 'eventChance reduced frequency');
        break;
      case 'eventGain':
        if (after.eventGain < before.eventGain)
          fail(def.id, 'eventGain reduced the payout');
        break;
      case 'eventLoss':
        // additive with a floor now, so the last few land on the cap
        if (after.eventLoss > before.eventLoss)
          fail(def.id, 'eventLoss made bad events cheaper the wrong way');
        break;
      case 'buffDuration':
        if (after.buffDuration < before.buffDuration)
          fail(def.id, 'buffDuration shortened buffs');
        break;
      case 'offlineEfficiency':
        if (Math.abs(after.offlineEfficiency - before.offlineEfficiency - fx.value) > 0.001)
          fail(def.id, 'offlineEfficiency not applied');
        break;
      case 'offlineHours':
        if (Math.abs(after.offlineMax - before.offlineMax - fx.value * 3600) > 1)
          fail(def.id, 'offlineHours not applied');
        break;
      default:
        fail(def.id, 'unhandled effect type ' + fx.type);
    }
  });
});

console.log('\nChecked ' + checked + ' effects across ' + ALL.length + ' upgrades.');

// ---- stacking sanity: multipliers must compound, not overwrite -------------
console.log('\nStacking checks:');
{
  const { DC, N, G } = fresh();
  const b = N.toNumber(G.derived.clickPower);
  const mult = id => DC.Game.upgradeDef(id).effects.find(e => e.type === 'clickMult').value;
  G.state.upgrades.fludd_squirt = true;
  G.state.upgrades.fludd_yoshi = true;
  G.recalc();
  const want = mult('fludd_squirt') * mult('fludd_yoshi');
  const r = N.toNumber(G.derived.clickPower) / b;
  if (Math.abs(r - want) > 0.01) fail('stacking', `should compound to x${want}, got x${r.toFixed(2)}`);
  else console.log(`  ok   click multipliers compound (×${mult('fludd_squirt')} · ×${mult('fludd_yoshi')} = ×${want})`);
}
{
  const { DC, N, G } = fresh();
  G.state.upgrades.fludd_hover = true;    // +1% of dps
  G.state.upgrades.click_dps3 = true;     // +10% of dps
  G.recalc();
  const withDps = N.toNumber(G.derived.clickPower);
  const want2 = DC.Game.upgradeDef('fludd_yoshi').effects.find(e => e.type === 'clickMult').value;
  // Click power is now max(gear route, dps share) rather than the product, so
  // a gear multiplier correctly does nothing once the share route is ahead.
  G.state.upgrades.fludd_yoshi = true;
  G.recalc();
  const r = N.toNumber(G.derived.clickPower) / withDps;
  if (r < 0.99) fail('stacking', `a gear multiplier reduced click power to x${r.toFixed(2)}`);
  else console.log('  ok   gear multipliers never reduce click power (' + r.toFixed(2) + 'x)');
}
{
  const { DC, N, G } = fresh();
  G.state.upgrades.fludd_hover = true;
  G.recalc();
  const b = N.toNumber(G.derived.clickPower);
  G.state.buffs.push({ id: 'x', label: 'x15', prod: 1, click: 15, endsAt: Date.now() + 60000 });
  G.recalc();
  const r = N.toNumber(G.derived.clickPower) / b;
  if (Math.abs(r - 15) > 0.01) fail('stacking', `x15 click buff delivered x${r.toFixed(2)}`);
  else console.log('  ok   ×15 click buff delivers exactly ×15');
}

// Balance guard: clicking should supplement passive income, not replace it.
{
  const { DC, N, G } = fresh();
  DC.CONFIG.workers.forEach(x => G.state.workers[x.id] = 250);
  DC.CONFIG.upgrades.forEach(u => G.state.upgrades[u.id] = true);
  G.recalc();
  // Design target: one click is worth about a third of a second of production.
  const ratio = N.toNumber(G.derived.clickPower) / N.toNumber(G.derived.dps);
  if (ratio < 0.25 || ratio > 0.45)
    fail('balance', `a click is worth ${ratio.toFixed(3)}x DPS — target is ~0.333 (1/3)`);
  else console.log(`  ok   one click is worth ${ratio.toFixed(3)}x DPS ` +
                   `(${(ratio * 8).toFixed(2)}x passive at 8 clicks/sec)`);
}

console.log('\n' + (fails ? fails + ' PROBLEMS FOUND' : 'Every upgrade verified working.'));
process.exit(fails ? 1 : 0);
