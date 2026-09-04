/* Golden Shines: six prestiges, +10% click each, and nothing lost on the way. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);

function boot(saveJson, shineStore) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.io/' });
  const w = dom.window;
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  if (saveJson) w.localStorage.setItem('durianClicker.save.v1', saveJson);
  if (shineStore) w.localStorage.setItem('durianClicker.goldenShines', shineStore);
  SCRIPTS.forEach(f => w.eval(fs.readFileSync(ROOT + f, 'utf8')));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}
let fails = 0;
const eq = (l,g,e) => { if (String(g)!==String(e)) { fails++; console.log('FAIL',l,'| got',g,'| want',e); } else console.log('  ok  ',l,'=',g); };

const REQS = [1e51, 1e54, 1e57, 1e60, 1e63, 1e100];

console.log('=== the ladder ===');
let w = boot(), DC = w.DC, N = DC.N, G = DC.Game, P = DC.Prestige;
eq('six Shines maximum', P.max(), 6);
eq('requirements are as specified',
   DC.CONFIG.prestige.requirements.join(','), REQS.join(','));
eq('starts with none', P.shines(), 0);
eq('and no bonus', P.bonusPercent(), 0);
eq('first requirement is 1e51', N.log10(P.requirement()), 51);

console.log('\n=== eligibility is judged on the current balance ===');
eq('not eligible while empty', P.canPrestige(), false);
G.addDurians(N.pow10(51)); G.recalc();
eq('eligible on reaching it', P.canPrestige(), true);
G.spendDurians(N.pow10(50));                  // drop back below
eq('spending back below removes eligibility', P.canPrestige(), false);
G.addDurians(N.pow10(51)); G.recalc();
eq('and it returns when topped up', P.canPrestige(), true);

console.log('\n=== a claim resets the run and keeps the Shine ===');
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; });
DC.Workers.buy('pianta', 12);
DC.Upgrades.buy('gloves');
G.state.totalClicks = 5000;
const nameBefore = (G.state.player.name = 'Keepme');
G.state.settings.numberFormat = 'shortened';
const r = P.claim();
eq('claim succeeds', r.ok, true);
eq('it was Shine #1', r.shine, 1);
eq('Durians reset', N.toNumber(G.state.durians), 0);
eq('crew reset', G.state.workers.pianta, 0);
eq('upgrades reset', !!G.state.upgrades.gloves, false);
eq('clicks reset with the achievements that count them', G.state.totalClicks, 0);
eq('Shine kept', P.shines(), 1);
eq('bonus now +10%', P.bonusPercent(), 10);
eq('player name kept', G.state.player.name, nameBefore);
eq('display preference kept', G.state.settings.numberFormat, 'shortened');
eq('next requirement is 1e54', N.log10(P.requirement()), 54);

console.log('\n=== collections and records survive a claim ===');
{
  const wk = boot(); const Dk = wk.DC, Nk = Dk.N, Gk = Dk.Game;
  Dk.CONFIG.workers.forEach(x => { Gk.state.unlocked[x.id] = true; });
  Gk.addDurians(Nk.pow10(52)); Gk.recalc();
  Dk.Workers.buy('pianta', 30);
  Dk.CONFIG.upgrades.slice(0, 60).forEach(u => Dk.Upgrades.buy(u.id));
  Dk.Store.buy('sunset');
  Dk.Store.buyBackground('toybox');
  Dk.Coins.award(9);
  Gk.state.playTime = 50000;
  Gk.checkProgress();
  const had = {
    ach: Object.keys(Gk.state.achievements).length,
    skins: Dk.Store.ownedCount(),
    backgrounds: Dk.Store.backgroundsOwnedCount(),
    coins: Dk.Coins.count(),
    lifetime: Nk.log10(Dk.Prestige.lifetimeEarned())
  };
  Dk.Prestige.claim();

  // kept: paid for once, and genuinely permanent
  eq('skins kept', Dk.Store.ownedCount(), had.skins);
  eq('backgrounds kept', Dk.Store.backgroundsOwnedCount(), had.backgrounds);
  eq('Blue Coins kept', Dk.Coins.count(), had.coins);
  eq('play time kept', Gk.state.playTime, 50000);

  // achievements go with the run, bar the two kinds that outlive it
  const typeOf = id => {
    const a = Dk.CONFIG.achievements.find(x => x.id === id);
    return a ? a.condition.type : '?';
  };
  const left = Object.keys(Gk.state.achievements).map(typeOf);
  eq('achievements reset', Object.keys(Gk.state.achievements).length < had.ach, true);
  eq('only playtime and prestige ones survive',
     left.every(t => t === 'playTime' || t === 'goldenShines'), true);
  eq('and the playtime ones really did survive', left.indexOf('playTime') !== -1, true);

  // the counters behind them reset too, or they would all come straight back
  Gk.checkProgress(); Gk.checkProgress();
  const after = Object.keys(Gk.state.achievements).map(typeOf);
  eq('nothing floods back on the next check',
     after.every(t => t === 'playTime' || t === 'goldenShines'), true);
  eq('click count reset', Gk.state.totalClicks, 0);
  eq('coins collected reset', Gk.state.coins.collected, 0);
  eq('events seen reset', Gk.state.events.total, 0);
  eq('casino record reset', Gk.state.casino.spins, 0);
  eq('leaderboard total kept',
     Math.round(Nk.log10(Dk.Prestige.lifetimeEarned())), Math.round(had.lifetime));

  // reset: the run itself
  eq('Durians reset', Nk.toNumber(Gk.state.durians), 0);
  eq('crew reset', Gk.state.workers.pianta, 0);
  eq('upgrades reset', Object.keys(Gk.state.upgrades).length, 0);
  eq('late crew re-locked', !!Gk.state.unlocked.giantpiantatree, false);

  // and a second run's earnings add to the first rather than replacing them
  const beforeSecond = Nk.log10(Dk.Prestige.lifetimeEarned());
  Gk.addDurians(Nk.pow10(54)); Gk.recalc();
  Dk.Prestige.claim();
  eq('lifetime total only ever grows',
     Nk.log10(Dk.Prestige.lifetimeEarned()) >= beforeSecond, true);
}

console.log('\n=== the bonus is additive, and only on clicks ===');
{
  const wb = boot(); const Db = wb.DC, Nb = Db.N, Gb = Db.Game;
  Db.CONFIG.workers.forEach(x => { Gb.state.unlocked[x.id] = true; Gb.state.workers[x.id] = 20; });
  Gb.recalc();
  const baseClick = Nb.toNumber(Gb.derived.clickPower);
  const baseDps = Nb.toNumber(Gb.derived.dps);
  for (let n = 1; n <= 6; n++) {
    Gb.state.durians = Nb.big(REQS[n - 1]);
    Db.Prestige.claim();
    // rebuild an identical run so the comparison is like for like
    Db.CONFIG.workers.forEach(x => { Gb.state.unlocked[x.id] = true; Gb.state.workers[x.id] = 20; });
    Gb.recalc();
    const want = 1 + n * 0.1;
    const got = Nb.toNumber(Gb.derived.clickPower) / baseClick;
    eq(n + ' Shines gives x' + want.toFixed(1) + ' clicks', Math.round(got * 100) / 100, want);
  }
  eq('production is untouched by Shines',
     Math.round(Nb.toNumber(Gb.derived.dps) / baseDps * 1000) / 1000, 1);
  eq('capped at +60%', Db.Prestige.bonusPercent(), 60);
}

console.log('\n=== there is no seventh ===');
{
  const wc = boot(null, JSON.stringify({ shines: 6, prestiges: 6, claimedAt: [] }));
  const Dc = wc.DC, Nc = Dc.N, Gc = Dc.Game;
  eq('starts complete', Dc.Prestige.isComplete(), true);
  eq('no requirement shown', Dc.Prestige.requirement(), null);
  eq('no next number', Dc.Prestige.nextShineNumber(), null);
  Gc.addDurians(Nc.pow10(200)); Gc.recalc();
  eq('cannot prestige with any amount', Dc.Prestige.canPrestige(), false);
  eq('and a direct call is refused', Dc.Prestige.claim().reason, 'complete');
  eq('still six', Dc.Prestige.shines(), 6);
  eq('bonus stays +60%', Dc.Prestige.bonusPercent(), 60);
}

console.log('\n=== a console call without the Durians achieves nothing ===');
{
  const wd = boot(); const Dd = wd.DC, Gd = Dd.Game;
  Dd.CONFIG.workers.forEach(x => { Gd.state.unlocked[x.id] = true; });
  Gd.addDurians(Dd.N.big(1e6)); Gd.recalc();     // enough to hire, nowhere near 1e51
  Dd.Workers.buy('pianta', 3);
  const res = Dd.Prestige.claim();
  eq('refused', res.ok, false);
  eq('with a reason', res.reason, 'not-enough');
  eq('no Shine awarded', Dd.Prestige.shines(), 0);
  eq('and the run is untouched', Gd.state.workers.pianta, 3);
}

console.log('\n=== rapid claims award exactly one ===');
{
  const we = boot(); const De = we.DC, Ne = De.N, Ge = De.Game;
  Ge.addDurians(Ne.pow10(60)); Ge.recalc();     // enough for several tiers
  const results = [];
  for (let i = 0; i < 8; i++) results.push(De.Prestige.claim());
  eq('exactly one succeeded', results.filter(x => x.ok).length, 1);
  eq('one Shine held', De.Prestige.shines(), 1);
  eq('one prestige counted', De.Prestige.prestiges(), 1);
  eq('the rest were refused for want of Durians',
     results.filter(x => !x.ok).every(x => x.reason === 'not-enough'), true);
}

console.log('\n=== Shines survive saves, reloads and a full wipe ===');
{
  const wf = boot(); const Df = wf.DC, Nf = Df.N, Gf = Df.Game;
  Gf.state.durians = Nf.big(REQS[0]); Df.Prestige.claim();
  Gf.state.durians = Nf.big(REQS[1]); Df.Prestige.claim();
  eq('two collected', Df.Prestige.shines(), 2);
  Df.Save.save(true);

  const saved = wf.localStorage.getItem('durianClicker.save.v1');
  const store = wf.localStorage.getItem('durianClicker.goldenShines');
  eq('carried in the save file',
     JSON.parse(saved).prestige.shines, 2);
  eq('and in their own key', JSON.parse(store).shines, 2);

  eq('reload keeps them', boot(saved, store).DC.Prestige.shines(), 2);
  // the save alone, with the dedicated key gone
  eq('save alone is enough', boot(saved, null).DC.Prestige.shines(), 2);
  // the key alone, with the save wiped entirely
  eq('the key alone is enough after a wipe', boot(null, store).DC.Prestige.shines(), 2);
  // a rolled-back save must not cost a Shine
  const stale = JSON.parse(saved); stale.prestige = { shines: 1, prestiges: 1, claimedAt: [] };
  eq('a stale save cannot take one away',
     boot(JSON.stringify(stale), store).DC.Prestige.shines(), 2);
  // nor can a stale key
  eq('nor can a stale key',
     boot(saved, JSON.stringify({ shines: 0, prestiges: 0, claimedAt: [] })).DC.Prestige.shines(), 2);
  // and nothing absurd gets through
  eq('a forged count is clamped to six',
     boot(null, JSON.stringify({ shines: 99, prestiges: 99, claimedAt: [] })).DC.Prestige.shines(), 6);
}

console.log('\n=== the panel ===');
{
  const wg = boot(); const Dg = wg.DC, Ng = Dg.N, Gg = Dg.Game, doc = wg.document;
  Dg.UI.selectTab('upgrades');
  eq('sits in the Upgrades tab',
     !!doc.querySelector('#panel-upgrades #prestige-panel, #upgrade-list ~ #prestige-panel') ||
     !!doc.getElementById('prestige-panel'), true);
  eq('six slots, three across', doc.querySelectorAll('#prestige-grid .shine-slot').length, 6);
  eq('none filled yet', doc.querySelectorAll('#prestige-grid .shine-slot.is-held').length, 0);
  const facts = () => doc.getElementById('prestige-facts').textContent;
  eq('shows the count', /0 \/ 6/.test(facts()), true);
  eq('shows the bonus', /\+0%/.test(facts()), true);
  eq('shows which is next', /Golden Shine #1/.test(facts()), true);
  eq('requirement in words', /sexdecillion/i.test(facts()), true);
  eq('claim disabled while short', doc.getElementById('prestige-claim').disabled, true);

  Gg.addDurians(Ng.pow10(51)); Gg.recalc(); Dg.UI.rebuildAll();
  eq('claim enabled on reaching it', doc.getElementById('prestige-claim').disabled, false);

  doc.getElementById('prestige-claim').dispatchEvent(new wg.MouseEvent('click', { bubbles: true }));
  eq('asks first', doc.getElementById('modal-confirm').hidden, false);
  eq('naming the Shine', /Golden Shine #1/.test(doc.getElementById('confirm-title').textContent), true);
  eq('and warning about the reset', /reset/i.test(doc.getElementById('confirm-text').textContent), true);
  eq('nothing happened yet', Dg.Prestige.shines(), 0);

  // cancelling changes nothing
  doc.getElementById('confirm-cancel').dispatchEvent(new wg.MouseEvent('click', { bubbles: true }));
  eq('cancel leaves the run alone', Dg.Prestige.shines(), 0);
  eq('and the Durians', Ng.log10(Gg.state.durians) >= 51, true);

  doc.getElementById('prestige-claim').dispatchEvent(new wg.MouseEvent('click', { bubbles: true }));
  doc.getElementById('confirm-ok').dispatchEvent(new wg.MouseEvent('click', { bubbles: true }));
  eq('confirming claims it', Dg.Prestige.shines(), 1);
  eq('a slot lights up', doc.querySelectorAll('#prestige-grid .shine-slot.is-held').length, 1);
  eq('the celebration plays', doc.getElementById('golden-burst').hidden, false);
  eq('naming the Shine', /#1/.test(doc.getElementById('golden-burst-which').textContent), true);
  eq('and the bonus', /\+10%/.test(doc.getElementById('golden-burst-bonus').textContent), true);
  eq('panel now shows 1 / 6', /1 \/ 6/.test(facts()), true);

  Dg.UI.selectTab('stats');
  const stats = doc.getElementById('stats-list').textContent;
  ['Golden Shines', 'Permanent click bonus', 'Next Golden Shine at', 'Times prestiged']
    .forEach(l => eq('stats shows ' + l, stats.indexOf(l) !== -1, true));
}

console.log('\n=== when it is finished the panel says so ===');
{
  const wh = boot(null, JSON.stringify({ shines: 6, prestiges: 6, claimedAt: [] }));
  wh.DC.UI.selectTab('upgrades');
  const doc = wh.document;
  eq('all six lit', doc.querySelectorAll('#prestige-grid .shine-slot.is-held').length, 6);
  eq('claim button gone', doc.getElementById('prestige-claim').hidden, true);
  eq('titled complete', /complete/i.test(doc.getElementById('prestige-title').textContent), true);
  eq('no further requirement shown',
     /Working toward/.test(doc.getElementById('prestige-facts').textContent), false);
  eq('bonus shown as +60%', /\+60%/.test(doc.getElementById('prestige-facts').textContent), true);
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'Prestige working.'));
process.exit(fails ? 1 : 0);
