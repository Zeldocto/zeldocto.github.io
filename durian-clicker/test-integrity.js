/* Leaderboard integrity: an edited save must be caught and refused, and an
 * honest save must never be falsely accused. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);

function boot(saveJson) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.io/' });
  const w = dom.window;
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  if (saveJson) w.localStorage.setItem('durianClicker.save.v1', saveJson);
  SCRIPTS.forEach(f => w.eval(fs.readFileSync(ROOT + f, 'utf8')));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}
let fails = 0;
const eq = (l,g,e) => { if (String(g)!==String(e)) { fails++; console.log('FAIL',l,'| got',g,'| want',e); } else console.log('  ok  ',l,'=',g); };

console.log('=== an honest save is never accused ===');
let w = boot(), DC = w.DC, N = DC.N, G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id]=true; });
G.addDurians(N.big(1e9), 'worker');          // earned, so the crew is affordable
DC.Workers.buy('pianta', 25);
DC.Workers.buy('noki', 10);
G.recalc();
for (let i=0;i<50;i++) G.click();
for (let i=0;i<120;i++) G.tick(1);
G.state.playTime = 600;
DC.Save.save(true);
const honest = w.localStorage.getItem('durianClicker.save.v1');
eq('saves are signed', !!JSON.parse(honest).sig, true);
eq('normal play is not flagged', G.state.integrity, 'undefined');
const w2 = boot(honest);
eq('and it reloads clean', w2.DC.Game.state.integrity, 'undefined');
eq('verify agrees', w2.DC.Save.verify(JSON.parse(honest)), 'ok');
// buying, events and setbacks must not trip it either
{
  const wc = boot(); const Dc = wc.DC, Gc = Dc.Game;
  Dc.CONFIG.workers.forEach(x => { Gc.state.unlocked[x.id]=true; });
  Gc.addDurians(Dc.N.pow10(12)); Gc.recalc();
  Dc.Workers.buy('pianta', 10);
  Dc.IslandEvents.trigger('king_boo');
  Dc.IslandEvents.trigger('king_boo_greedy');
  Dc.IslandEvents.trigger('toadsworth_audit');
  for (let i=0;i<5;i++) Gc.tick(1);
  eq('buying, gains and setbacks stay clean', Gc.state.integrity, 'undefined');
}

console.log('\n=== the checks must not accuse honest players ===');
{
  // clicking before the first tick: earnings with zero recorded playTime
  const wn = boot(); const Dn = wn.DC, Gn = Dn.Game;
  for (let i = 0; i < 40; i++) Gn.click();
  Dn.Save.save(true);
  const raw = JSON.parse(wn.localStorage.getItem('durianClicker.save.v1'));
  eq('a brand-new clicker is not flagged', Dn.Save.verify(raw), 'ok');
  eq('playTime really is zero there', raw.playTime, 0);

  // Autoclickers are allowed, at any rate. The click limiter already removes
  // the advantage, so an integrity rule here would only punish players for
  // something we told them was fine.
  [10, 30, 100, 1000, 20000].forEach(function (cps) {
    const wf = boot(); const Df = wf.DC, Gf = Df.Game;
    Gf.state.playTime = 3600;
    Gf.state.totalClicks = 3600 * cps;
    Df.Save.save(true);
    eq(cps + ' clicks/sec stays eligible',
       Df.Save.verify(JSON.parse(wf.localStorage.getItem('durianClicker.save.v1'))), 'ok');
  });

  // an offline windfall leaves a big bank with little playTime
  const wo = boot(); const Do = wo.DC, Go = Do.Game;
  Do.CONFIG.workers.forEach(x => { Go.state.unlocked[x.id] = true; Go.state.workers[x.id] = 40; });
  Go.recalc();
  Go.addDurians(Do.N.mul(Go.derived.dps, 86400 * 30), 'worker');
  Go.state.playTime = 120;
  Do.Save.save(true);
  eq('a large offline grant is fine',
     Do.Save.verify(JSON.parse(wo.localStorage.getItem('durianClicker.save.v1'))), 'ok');
}

console.log('\n=== editing the total from the console is caught ===');
{
  const wt = boot(); const Dt = wt.DC, Gt = Dt.Game;
  Dt.CONFIG.workers.forEach(x => { Gt.state.unlocked[x.id]=true; Gt.state.workers[x.id]=5; });
  Gt.recalc();
  Gt.markBank();                    // as if this state had just been loaded
  Gt.tick(1);
  eq('clean before the edit', Gt.state.integrity, 'undefined');
  Gt.state.durians = Dt.N.pow10(60);          // the classic F12 edit
  Gt.tick(1);
  eq('flagged within a second', typeof Gt.state.integrity, 'string');
  eq('and it says why', /changed outside the game/.test(Gt.state.integrity), true);
  eq('the flag persists to disk',
     !!JSON.parse(wt.localStorage.getItem('durianClicker.save.v1')).integrity, true);
  const wr = boot(wt.localStorage.getItem('durianClicker.save.v1'));
  eq('and survives a reload', typeof wr.DC.Game.state.integrity, 'string');
}

console.log('\n=== adding crew from the console is caught ===');
{
  const wc = boot(); const Dc = wc.DC, Gc = Dc.Game, Nc = Dc.N;
  Dc.CONFIG.workers.forEach(x => { Gc.state.unlocked[x.id] = true; });
  Gc.addDurians(Nc.pow10(14)); Gc.recalc();
  Dc.Workers.buy('pianta', 20);            // buying is legitimate
  Gc.tick(1);
  eq('buying crew normally is fine', String(Gc.state.integrity), 'undefined');

  Gc.state.workers.piantajudge = 500000;   // the actual cheat used
  Gc.tick(1);
  eq('a pile of Pianta Judges is caught', typeof Gc.state.integrity, 'string');
  eq('and it names the crew', /crew changed outside the game/.test(Gc.state.integrity), true);
  eq('the flag reaches the save',
     !!JSON.parse(wc.localStorage.getItem('durianClicker.save.v1')).integrity, true);
}
{
  // even a single extra worker, on any crew
  const w1 = boot(); const D1 = w1.DC, G1 = D1.Game;
  D1.CONFIG.workers.forEach(x => { G1.state.unlocked[x.id] = true; });
  G1.markBank();
  G1.tick(1);
  G1.state.workers.pianta = (G1.state.workers.pianta || 0) + 1;
  G1.tick(1);
  eq('one extra worker is enough to catch', typeof G1.state.integrity, 'string');

  // and moving counts between crew, which a naive total would miss
  const w2 = boot(); const D2 = w2.DC, G2 = D2.Game, N2 = D2.N;
  D2.CONFIG.workers.forEach(x => { G2.state.unlocked[x.id] = true; });
  G2.addDurians(N2.pow10(14)); G2.recalc();
  D2.Workers.buy('pianta', 10);
  G2.tick(1);
  eq('clean before the swap', String(G2.state.integrity), 'undefined');
  G2.state.workers.pianta -= 10;
  G2.state.workers.piantajudge = (G2.state.workers.piantajudge || 0) + 10;
  G2.tick(1);
  eq('swapping cheap crew for expensive crew is caught',
     typeof G2.state.integrity, 'string');
}

console.log('\n=== granting upgrades from the console is caught ===');
{
  const wu = boot(); const Du = wu.DC, Gu = Du.Game, Nu = Du.N;
  Du.CONFIG.workers.forEach(x => { Gu.state.unlocked[x.id] = true; });
  Gu.addDurians(Nu.pow10(14)); Gu.recalc();
  Du.Upgrades.buy('gloves');               // buying is legitimate
  Gu.tick(1);
  eq('buying an upgrade is fine', String(Gu.state.integrity), 'undefined');
  Du.CONFIG.upgrades.slice(0, 200).forEach(u => { Gu.state.upgrades[u.id] = true; });
  Gu.tick(1);
  eq('granting yourself 200 upgrades is caught', typeof Gu.state.integrity, 'string');
  eq('and it names the upgrades',
     /upgrade list changed outside the game/.test(Gu.state.integrity), true);
}

console.log('\n=== earning normally never trips any of it ===');
{
  const wn = boot(); const Dn = wn.DC, Gn = Dn.Game, Nn = Dn.N;
  Dn.CONFIG.workers.forEach(x => { Gn.state.unlocked[x.id] = true; });
  Gn.addDurians(Nn.pow10(16)); Gn.recalc();
  for (let i = 0; i < 40; i++) {
    Dn.Workers.buy('pianta', 1);
    Dn.Workers.buy('noki', 1);
    for (let c = 0; c < 5; c++) Gn.click();
    Gn.tick(1);
  }
  Dn.IslandEvents.trigger('king_boo');
  Dn.IslandEvents.trigger('toadsworth_audit');
  Gn.tick(1); Gn.tick(1);
  eq('40 rounds of buying, clicking and events stay clean',
     String(Gn.state.integrity), 'undefined');
}

console.log('\n=== editing the save file is caught ===');
{
  const edited = JSON.parse(honest);
  edited.durians = { m: 9.99, e: 60 };
  const we = boot(JSON.stringify(edited));
  eq('flagged on load', /edited|impossible/.test(we.DC.Game.state.integrity || ''), true);
  eq('progress still loads', we.DC.N.toNumber(we.DC.Game.state.durians) > 0, true);

  const stripped = JSON.parse(honest);
  delete stripped.sig;
  eq('removing the signature does not help',
     boot(JSON.stringify(stripped)).DC.Game.state.integrity !== undefined, true);

  const wq = boot();
  const resigned = JSON.parse(honest);
  resigned.durians = { m: 5, e: 40 };
  resigned.totalEarned = { m: 1, e: 6 };
  resigned.sig = wq.DC.Save.signature(resigned);        // correctly re-signed
  eq('holding more than you ever earned is still caught',
     /impossible/.test(wq.DC.Save.verify(resigned)), true);
}

console.log('\n=== a save file cannot smuggle in unaffordable crew ===');
{
  const wa = boot(); const Da = wa.DC, Ga = Da.Game, Na = Da.N;
  Da.CONFIG.workers.forEach(x => { Ga.state.unlocked[x.id] = true; Ga.state.workers[x.id] = 900; });
  Da.CONFIG.upgrades.forEach(u => Ga.state.upgrades[u.id] = true);
  Ga.addDurians(Na.pow10(70)); Ga.recalc(); Ga.state.playTime = 200000;
  Da.Save.save(true);
  const good = JSON.parse(wa.localStorage.getItem('durianClicker.save.v1'));
  eq('an honest 900-of-each save passes', Da.Save.verify(good), 'ok');

  const huge = JSON.parse(JSON.stringify(good));
  huge.workers.piantajudge = 500000;
  huge.sig = Da.Save.signature(huge);                  // correctly re-signed
  eq('500,000 Pianta Judges rejected even when re-signed',
     /impossible/.test(Da.Save.verify(huge)), true);

  const modest = JSON.parse(JSON.stringify(good));
  modest.workers.piantajudge = 3000;
  modest.sig = Da.Save.signature(modest);
  eq('3,000 Judges on that bank is also rejected',
     /impossible/.test(Da.Save.verify(modest)), true);

  // and an ordinary early save must still pass
  const we = boot(); const De = we.DC, Ge = De.Game, Ne = De.N;
  De.CONFIG.workers.forEach(x => { Ge.state.unlocked[x.id] = true; });
  Ge.addDurians(Ne.big(5e5)); Ge.recalc();
  De.Workers.buy('pianta', 30);
  De.Workers.buy('noki', 5);
  Ge.state.playTime = 900;
  De.Save.save(true);
  eq('an ordinary early save passes',
     De.Save.verify(JSON.parse(we.localStorage.getItem('durianClicker.save.v1'))), 'ok');
}

console.log('\n=== an old unsigned save is grandfathered ===');
{
  const legacy = JSON.parse(honest);
  delete legacy.sig; delete legacy.saveVersion;
  const wg = boot(JSON.stringify(legacy));
  eq('pre-signing saves load clean', wg.DC.Game.state.integrity, 'undefined');
  wg.DC.Save.save(true);
  eq('and are signed from then on',
     !!JSON.parse(wg.localStorage.getItem('durianClicker.save.v1')).sig, true);
}

console.log('\n=== flagged saves cannot reach the leaderboard ===');
{
  const wf = boot(); const Df = wf.DC;
  Df.Game.state.player.name = 'Tester';
  Df.Game.flagTampered('test');
  Df.Leaderboard.submit({ force: true }).then(function (r) {
    eq('submission refused', r.reason, 'modified');
    console.log('\n' + (fails ? fails + ' FAILURES' : 'Integrity checks working.'));
    process.exit(fails ? 1 : 0);
  });
}
