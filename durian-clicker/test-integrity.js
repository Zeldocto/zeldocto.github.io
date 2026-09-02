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
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id]=true; G.state.workers[x.id]=25; });
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
     /edited/.test(boot(JSON.stringify(stripped)).DC.Game.state.integrity || ''), true);

  const wq = boot();
  const resigned = JSON.parse(honest);
  resigned.durians = { m: 5, e: 40 };
  resigned.totalEarned = { m: 1, e: 6 };
  resigned.sig = wq.DC.Save.signature(resigned);        // correctly re-signed
  eq('holding more than you ever earned is still caught',
     /impossible/.test(wq.DC.Save.verify(resigned)), true);
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
