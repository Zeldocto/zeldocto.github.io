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

/* The signing function is no longer exported (handing a cheat the ability to
   re-sign an edited save defeated the point). These tests reproduce it so they
   can still check the "re-signed but impossible" cases. */
function resign(payload) {
  const copy = {};
  Object.keys(payload).sort().forEach(k => { if (k !== 'sig') copy[k] = payload[k]; });
  const text = JSON.stringify(copy) + '|isle-delfino|2';
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  payload.sig = h.toString(36);
  return payload;
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
eq('normal play is not flagged', G.integrity(), null);
const w2 = boot(honest);
eq('and it reloads clean', w2.DC.Game.integrity(), null);
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
  eq('buying, gains and setbacks stay clean', Gc.integrity(), null);
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

console.log('\n=== the flag cannot be cleared from the console ===');
{
  const wf = boot(); const Df = wf.DC, Gf = Df.Game, Nf = Df.N;
  Df.CONFIG.workers.forEach(x => { Gf.state.unlocked[x.id] = true; Gf.state.workers[x.id] = 20; });
  Gf.recalc(); Gf.markBank(); Gf.tick(1);
  Gf.state.durians = Nf.pow10(60); Gf.tick(1);
  eq('flagged to begin with', typeof Gf.integrity(), 'string');

  Gf.state.integrity = false;
  eq('state.integrity = false does nothing', typeof Gf.integrity(), 'string');
  Gf.state.integrity = undefined;
  eq('setting it undefined does nothing', typeof Gf.integrity(), 'string');
  try { Gf.integrity = function () { return null; }; } catch (e) { /* strict mode */ }
  eq('the getter cannot be replaced', typeof Gf.integrity === 'function' && !!Gf.integrity(), true);
  try { delete Gf.integrity; } catch (e) { /* non-configurable */ }
  eq('the getter cannot be deleted', typeof Gf.integrity === 'function' && !!Gf.integrity(), true);
  Gf.restoreIntegrity(null); Gf.restoreIntegrity(false); Gf.restoreIntegrity('');
  eq('restoreIntegrity cannot clear it', typeof Gf.integrity(), 'string');
  eq('the signing function is not exposed', typeof Df.Save.signature, 'undefined');

  // the flag is in-session only now: it is never written to the save, so a
  // reload starts clean rather than carrying an accusation forward
  Df.Save.save(true);
  eq('not persisted to the save',
     JSON.parse(wf.localStorage.getItem('durianClicker.save.v1')).integrity, undefined);
  eq('and a reload starts clean',
     boot(wf.localStorage.getItem('durianClicker.save.v1')).DC.Game.integrity(), null);
}

console.log('\n=== the click limiter cannot be switched off ===');
{
  const mk = function () {
    const wk = boot(); const Dk = wk.DC, Gk = Dk.Game;
    Dk.CONFIG.workers.forEach(x => { Gk.state.unlocked[x.id] = true; Gk.state.workers[x.id] = 50; });
    Gk.recalc(); Gk.state.durians = Dk.N.ZERO; Gk.markBank(); Gk.tick(1);
    return Dk;
  };

  // honest autoclicking, at any speed, stays clean
  [1, 10, 30, 100, 1000, 50000].forEach(function (rate) {
    const Dh = mk();
    for (let i = 0; i < rate; i++) Dh.Game.click();
    Dh.Game.tick(1);
    eq(rate + ' clicks/sec stays clean', String(Dh.Game.integrity()), 'null');
  });

  // total click income per second is bounded however fast you click
  const Db = mk(); const Nb = Db.N, Gb = Db.Game;
  const one = Nb.toNumber(Gb.derived.clickPower);
  Gb.state.durians = Nb.ZERO;
  const started = Date.now();
  for (let i = 0; i < 20000; i++) Gb.click();
  const elapsed = Math.max(0.001, (Date.now() - started) / 1000);
  const perSecond = (Nb.toNumber(Gb.state.durians) / one) / elapsed;
  console.log('     20,000 clicks paid ' + perSecond.toFixed(1) +
              ' click-equivalents per real second');
  // the budget is 60 a second; anything near that is the cap working, and a
  // rate far above it would mean the cap leaks
  eq('click income per second is capped however fast you go', perSecond < 150, true);

  // turning the limiter off from the console
  const Dz = mk();
  Dz.CONFIG.balance.maxClickRate = 0;
  for (let i = 0; i < 500; i++) Dz.Game.click();
  Dz.Game.tick(1);
  eq('maxClickRate = 0 no longer disables it', typeof Dz.Game.integrity(), 'string');
  eq('and it names the settings',
     /balance settings were changed/.test(Dz.Game.integrity()), true);

  const Do = mk();
  Do.CONFIG.balance.overflowClickValue = 1;
  for (let i = 0; i < 500; i++) Do.Game.click();
  Do.Game.tick(1);
  eq('overflowClickValue = 1 is caught too', typeof Do.Game.integrity(), 'string');

  // paying yourself click income directly
  const Da = mk();
  for (let i = 0; i < 1000; i++) Da.Game.addDurians(Da.Game.derived.clickPower, 'click');
  Da.Game.tick(1);
  eq('paying yourself click income is caught', typeof Da.Game.integrity(), 'string');
  eq('and it names the clicks',
     /clicks earned more than the click limit/.test(Da.Game.integrity()), true);

  // replacing the click function outright
  const Dr = mk(); const Nr = Dr.N, Gr = Dr.Game;
  for (let i = 0; i < 1000; i++) {
    Gr.state.clickEarned = Nr.add(Gr.state.clickEarned, Gr.derived.clickPower);
    Gr.addDurians(Gr.derived.clickPower, 'worker');
  }
  Gr.tick(1);
  eq('replacing click() entirely is caught', typeof Gr.integrity(), 'string');
}

console.log('\n=== editing the total from the console is caught ===');
{
  const wt = boot(); const Dt = wt.DC, Gt = Dt.Game;
  Dt.CONFIG.workers.forEach(x => { Gt.state.unlocked[x.id]=true; Gt.state.workers[x.id]=5; });
  Gt.recalc();
  Gt.markBank();                    // as if this state had just been loaded
  Gt.tick(1);
  eq('clean before the edit', Gt.integrity(), null);
  Gt.state.durians = Dt.N.pow10(60);          // the classic F12 edit
  Gt.tick(1);
  eq('flagged within a second', typeof Gt.integrity(), 'string');
  eq('and it says why', /changed outside the game/.test(Gt.integrity()), true);
  eq('but it is not written to the save',
     JSON.parse(wt.localStorage.getItem('durianClicker.save.v1')).integrity, undefined);
}

console.log('\n=== adding crew from the console is caught ===');
{
  const wc = boot(); const Dc = wc.DC, Gc = Dc.Game, Nc = Dc.N;
  Dc.CONFIG.workers.forEach(x => { Gc.state.unlocked[x.id] = true; });
  Gc.addDurians(Nc.pow10(14)); Gc.recalc();
  Dc.Workers.buy('pianta', 20);            // buying is legitimate
  Gc.tick(1);
  eq('buying crew normally is fine', String(Gc.integrity()), 'null');

  Gc.state.workers.piantajudge = 500000;   // the actual cheat used
  Gc.tick(1);
  eq('a pile of Pianta Judges is caught', typeof Gc.integrity(), 'string');
  eq('and it names the crew', /crew changed outside the game/.test(Gc.integrity()), true);
  eq('and nothing is written to the save',
     JSON.parse(wc.localStorage.getItem('durianClicker.save.v1')).integrity, undefined);
}
{
  // even a single extra worker, on any crew
  const w1 = boot(); const D1 = w1.DC, G1 = D1.Game;
  D1.CONFIG.workers.forEach(x => { G1.state.unlocked[x.id] = true; });
  G1.markBank();
  G1.tick(1);
  G1.state.workers.pianta = (G1.state.workers.pianta || 0) + 1;
  G1.tick(1);
  eq('one extra worker is enough to catch', typeof G1.integrity(), 'string');

  // and moving counts between crew, which a naive total would miss
  const w2 = boot(); const D2 = w2.DC, G2 = D2.Game, N2 = D2.N;
  D2.CONFIG.workers.forEach(x => { G2.state.unlocked[x.id] = true; });
  G2.addDurians(N2.pow10(14)); G2.recalc();
  D2.Workers.buy('pianta', 10);
  G2.tick(1);
  eq('clean before the swap', String(G2.integrity()), 'null');
  G2.state.workers.pianta -= 10;
  G2.state.workers.piantajudge = (G2.state.workers.piantajudge || 0) + 10;
  G2.tick(1);
  eq('swapping cheap crew for expensive crew is caught',
     typeof G2.integrity(), 'string');
}

console.log('\n=== granting upgrades from the console is caught ===');
{
  const wu = boot(); const Du = wu.DC, Gu = Du.Game, Nu = Du.N;
  Du.CONFIG.workers.forEach(x => { Gu.state.unlocked[x.id] = true; });
  Gu.addDurians(Nu.pow10(14)); Gu.recalc();
  Du.Upgrades.buy('gloves');               // buying is legitimate
  Gu.tick(1);
  eq('buying an upgrade is fine', String(Gu.integrity()), 'null');
  Du.CONFIG.upgrades.slice(0, 200).forEach(u => { Gu.state.upgrades[u.id] = true; });
  Gu.tick(1);
  eq('granting yourself 200 upgrades is caught', typeof Gu.integrity(), 'string');
  eq('and it names the upgrades',
     /upgrade list changed outside the game/.test(Gu.integrity()), true);
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
     String(Gn.integrity()), 'null');
}

console.log('\n=== editing the save file is caught ===');
{
  const edited = JSON.parse(honest);
  edited.durians = { m: 9.99, e: 60 };
  const we = boot(JSON.stringify(edited));
  eq('an edited save loads and plays', we.DC.N.toNumber(we.DC.Game.state.durians) > 0, true);
  eq('and is not accused', we.DC.Game.integrity(), null);
  // verify() still reports the problem for anyone who wants to use it
  eq('verify still reports it', /edited|impossible/.test(we.DC.Save.verify(edited)), true);

  const stripped = JSON.parse(honest);
  delete stripped.sig;
  eq('verify still notices a stripped signature',
     boot(JSON.stringify(stripped)).DC.Save.verify(stripped) !== 'ok', true);

  const wq = boot();
  const resigned = JSON.parse(honest);
  resigned.durians = { m: 5, e: 40 };
  resigned.totalEarned = { m: 1, e: 6 };
  resign(resigned);        // correctly re-signed
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
  resign(huge);                  // correctly re-signed
  eq('500,000 Pianta Judges rejected even when re-signed',
     /impossible/.test(Da.Save.verify(huge)), true);

  const modest = JSON.parse(JSON.stringify(good));
  modest.workers.piantajudge = 3000;
  resign(modest);
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

console.log('\n=== huge but honest totals are not rejected ===');
{
  // toNumber() returns Infinity past 1e308 and an honest save can get there,
  // so the plausibility checks work in log10 rather than raw numbers.
  [80, 200, 308, 400, 900].forEach(function (exp) {
    const wx = boot(); const Dx = wx.DC, Gx = Dx.Game, Nx = Dx.N;
    Dx.CONFIG.workers.forEach(x => { Gx.state.unlocked[x.id] = true; });
    Dx.CONFIG.upgrades.forEach(u => Gx.state.upgrades[u.id] = true);
    Gx.addDurians(Nx.pow10(exp), 'worker');
    Gx.state.playTime = 500000;
    Gx.recalc();
    Dx.Save.save(true);
    eq('a total of 1e' + exp + ' is accepted',
       Dx.Save.verify(JSON.parse(wx.localStorage.getItem('durianClicker.save.v1'))), 'ok');
  });

  // and the rule it replaces still works
  const wy = boot(); const Dy = wy.DC, Gy = Dy.Game, Ny = Dy.N;
  Dy.CONFIG.workers.forEach(x => { Gy.state.unlocked[x.id] = true; });
  Gy.addDurians(Ny.pow10(10), 'worker'); Gy.state.playTime = 1000;
  Dy.Save.save(true);
  const tweaked = JSON.parse(wy.localStorage.getItem('durianClicker.save.v1'));
  tweaked.durians = { m: 5, e: 40 };
  eq('holding more than you earned is still caught',
     /impossible/.test(Dy.Save.verify(tweaked)), true);
}

console.log('\n=== an old unsigned save is grandfathered ===');
{
  const legacy = JSON.parse(honest);
  delete legacy.sig; delete legacy.saveVersion;
  const wg = boot(JSON.stringify(legacy));
  eq('pre-signing saves load clean', wg.DC.Game.integrity(), null);
  wg.DC.Save.save(true);
  eq('and are signed from then on',
     !!JSON.parse(wg.localStorage.getItem('durianClicker.save.v1')).sig, true);
}

console.log('\n=== nobody is blocked from the leaderboard ===');
{
  // The client-side block was removed: it caught honest players and never
  // stopped a determined one. leaderboard-guard.sql enforces limits on the
  // server, which a player cannot reach.
  const wf = boot(); const Df = wf.DC, Gf = Df.Game, Nf = Df.N;
  Df.CONFIG.workers.forEach(x => { Gf.state.unlocked[x.id] = true; Gf.state.workers[x.id] = 10; });
  Gf.recalc(); Gf.markBank(); Gf.tick(1);
  Gf.state.durians = Nf.pow10(60);          // a blatant edit
  Gf.tick(1);
  eq('the audit still notices', typeof Gf.integrity(), 'string');
  Gf.state.player.name = 'Tester';
  Df.Leaderboard.submit({ force: true, ignoreThrottle: true }).then(function (r) {
    eq('but the client does not block the submission', r.reason === 'modified', false);

    // an honest save carrying a flag from the old build is cleared on load
    const wh = boot(); const Dh = wh.DC, Gh = Dh.Game;
    Dh.CONFIG.workers.forEach(x => { Gh.state.unlocked[x.id] = true; });
    Gh.addDurians(Dh.N.pow10(12)); Gh.recalc();
    Dh.Save.save(true);
    const raw = JSON.parse(wh.localStorage.getItem('durianClicker.save.v1'));
    raw.integrity = 'the save contains impossible values';
    const wc = boot(JSON.stringify(raw));
    eq('an old flag is cleared on load', wc.DC.Game.integrity(), null);
    wc.DC.Save.save(true);
    eq('and is not written back',
       JSON.parse(wc.localStorage.getItem('durianClicker.save.v1')).integrity, undefined);

    // and the save checks still LOAD everything, as they always did
    eq('an edited save still loads and plays',
       wc.DC.N.toNumber(wc.DC.Game.state.durians) > 0, true);

    console.log('\n' + (fails ? fails + ' FAILURES' : 'Integrity checks working.'));
    process.exit(fails ? 1 : 0);
  });
}
