const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const html = fs.readFileSync(ROOT + 'index.html', 'utf8');
const SCRIPTS = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);

function boot(save) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.io/' });
  const w = dom.window;
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  if (save) w.localStorage.setItem('durianClicker.save.v1', save);
  SCRIPTS.forEach(f => w.eval(fs.readFileSync(ROOT + f, 'utf8')));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}
let fails = 0;
const eq = (l,g,e) => { if (String(g)!==String(e)) { fails++; console.log('FAIL',l,'| got',g,'| want',e); } else console.log('  ok  ',l,'=',g); };

let w = boot(), DC = w.DC, N = DC.N, G = DC.Game;

console.log('=== reset and import actually work ===');
G.addDurians(N.big(12345)); G.recalc();
const code = DC.Save.exportString();
w.document.getElementById('btn-reset').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
eq('confirm appears', w.document.getElementById('modal-confirm').hidden, false);
w.document.getElementById('confirm-ok').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
eq('reset clears durians', N.format(G.state.durians), '0');
eq('confirm closes', w.document.getElementById('modal-confirm').hidden, true);
w.document.getElementById('save-box').value = code;
w.document.getElementById('btn-import').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
w.document.getElementById('confirm-ok').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
eq('import restores durians', N.format(DC.Game.state.durians), '12.34K');
w.document.getElementById('btn-reset').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
w.document.getElementById('confirm-cancel').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
eq('cancel still cancels', N.format(DC.Game.state.durians), '12.34K');

console.log('\n=== click rate limiter ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id]=true; G.state.workers[x.id]=500; });
DC.CONFIG.upgrades.forEach(u => G.state.upgrades[u.id]=true);
DC.CONFIG.achievements.forEach(a => G.state.achievements[a.id]=Date.now());
G.recalc(); G.checkProgress(); G.recalc();
const cap = DC.CONFIG.balance.maxClickRate;
eq('cap is 30/sec', cap, 30);
function burst(n) {
  const dps = N.toNumber(G.derived.dps);
  G.state.durians = N.ZERO;
  for (let i=0;i<n;i++) G.click();
  return N.toNumber(G.state.durians) / dps;
}
const at10 = burst(10);
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id]=true; G.state.workers[x.id]=500; });
DC.CONFIG.upgrades.forEach(u => G.state.upgrades[u.id]=true);
DC.CONFIG.achievements.forEach(a => G.state.achievements[a.id]=Date.now());
G.recalc(); G.checkProgress(); G.recalc();
const at50000 = burst(50000);
console.log('     10 clicks -> ' + at10.toFixed(2) + 'x dps;  50,000 clicks in one frame -> ' + at50000.toFixed(1) + 'x');
eq('a console flood is worth far less than 50,000 clicks', at50000 < 50000 * 0.34 * 0.05, true);
eq('normal clicking is unaffected', at10 > 3 && at10 < 4, true);
eq('clicks still count for achievements', G.state.totalClicks >= 50000, true);

console.log('\n=== click upgrades all do something ===');
const dead = DC.CONFIG.upgrades.filter(u =>
  u.effects.some(e => e.type === 'clickFromDps' && Math.round(e.value*10000)/100 === 0));
eq('no click upgrade displays as 0%', dead.length, 0);
let share = 0;
DC.CONFIG.upgrades.forEach(u => u.effects.forEach(e => { if (e.type==='clickFromDps') share += e.value; }));
eq('full build reaches ~1/3 of dps', Math.abs(share - 1/3) < 0.01, true);
eq('click power matches that share',
   Math.abs(N.toNumber(G.derived.clickPower)/N.toNumber(G.derived.dps) - share) < 0.02, true);

console.log('\n=== event upgrades no longer stack away ===');
eq('event gain capped', G.derived.eventGain <= DC.CONFIG.events_settings.maxEventGain, true);
eq('event loss floored', G.derived.eventLoss >= DC.CONFIG.events_settings.minEventLoss, true);
eq('buff duration capped', G.derived.buffDuration <= DC.CONFIG.events_settings.maxBuffDuration, true);
const durs = [];
for (let i=0;i<20;i++){ G.state.buffs.length=0; DC.IslandEvents.trigger('gooey_goop');
  durs.push((G.state.buffs[0].endsAt - Date.now())/1000); }
const meanGoop = durs.reduce((a,b)=>a+b,0)/durs.length;
console.log('     Goop averages ' + meanGoop.toFixed(1) + 's (was under 1s)');
eq('Goop lasts a meaningful time', meanGoop > 5, true);
G.state.buffs.length = 0; G.recalc();

console.log('\n=== trailing zeros trimmed ===');
eq('18M not 18.00M', N.format(N.big(18e6), {mode:'abbreviated'}), '18M');
eq('1.5M keeps its decimal', N.format(N.big(1.5e6), {mode:'abbreviated'}), '1.5M');
eq('1.23M keeps both', N.format(N.big(1.23e6), {mode:'abbreviated'}), '1.23M');
eq('shortened too', N.format(N.big(18e6), {mode:'shortened'}), '18 million');

console.log('\n=== buy amounts ===');
eq('x100 present', !!w.document.querySelector('.amt[data-amount="100"]'), true);
eq('custom box present', !!w.document.getElementById('buy-custom'), true);

console.log('\n=== changelog ===');
w = boot(); DC = w.DC; G = DC.Game;
eq('content file loaded', DC.CONFIG.changelog.length > 0, true);
eq('fresh save is not nagged', w.document.getElementById('news-bar').hidden, true);
eq('fresh save marked as read', G.state.changelogSeen, DC.CONFIG.changelog[0].version);
// a returning player who has not read the newest entry
const old = JSON.parse(Buffer.from(DC.Save.exportString(),'base64').toString('utf8'));
old.changelogSeen = 'some-older-version';
const w2 = boot(JSON.stringify(old));
eq('returning player sees the prompt', w2.document.getElementById('news-bar').hidden, false);
eq('prompt shows the release title',
   w2.document.getElementById('news-line').textContent, w2.DC.CONFIG.changelog[0].title);
w2.document.getElementById('news-read').dispatchEvent(new w2.MouseEvent('click',{bubbles:true}));
eq('panel opens', w2.document.getElementById('modal-changelog').hidden, false);
// the prompt deliberately shows only the newest release; the full history is
// behind the Settings button
eq('the prompt shows just the newest release',
   w2.document.querySelectorAll('#changelog-body .changelog-entry').length, 1);
eq('with that release\u2019s bullets', w2.document.querySelectorAll('#changelog-body li').length,
   w2.DC.CONFIG.changelog[0].notes.length);
eq('prompt goes away', w2.document.getElementById('news-bar').hidden, true);
eq('marked as read', w2.DC.Game.state.changelogSeen, w2.DC.CONFIG.changelog[0].version);
eq('read state persists',
   w2.DC.Save.deserialize(w2.DC.Save.serialize(w2.DC.Game.state)).changelogSeen,
   w2.DC.CONFIG.changelog[0].version);
// dismissing counts as read too
const w3 = boot(JSON.stringify(old));
w3.document.getElementById('news-close').dispatchEvent(new w3.MouseEvent('click',{bubbles:true}));
eq('dismissing also marks read', w3.DC.Game.state.changelogSeen, w3.DC.CONFIG.changelog[0].version);
// The point is not to name exploits or explain how to reproduce them. Saying
// that autoclickers remain allowed is policy, not a how-to, so it is fine.
eq('no exploit wording in the notes',
   /exploit|cheat|dev ?tools|F12|inject|bypass/i.test(JSON.stringify(DC.CONFIG.changelog)), false);

console.log('\n=== clicks per second in stats ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
for (let i = 0; i < 12; i++) G.click();
G.state.playTime = 60;
DC.UI.selectTab('stats');
const prodTxt = w.document.getElementById('stats-list').textContent;
['Clicks per second, now', 'Clicks per second, average', 'Clicks per second, peak']
  .forEach(l => eq('stats shows "' + l + '"', prodTxt.indexOf(l) !== -1, true));
eq('current rate reported', G.currentClickRate() >= 12, true);
eq('average is clicks over play time', G.averageClickRate().toFixed(2), (12 / 60).toFixed(2));
eq('peak recorded', G.state.peakClickRate >= 12, true);
eq('peak survives a save', DC.Save.deserialize(DC.Save.serialize(G.state)).peakClickRate,
   G.state.peakClickRate);

console.log('\n=== no single upgrade is a giant multiplier ===');
const huge = DC.CONFIG.upgrades.filter(u =>
  u.effects.some(e => e.type === 'globalMult' && e.value > 1.75));
eq('nothing above +75% to all workers', huge.length, 0);
eq('the split parts exist', DC.CONFIG.upgrades.filter(u => /_p\d$/.test(u.id)).length > 20, true);
{
  const fam = DC.CONFIG.upgrades.filter(u => u.name.startsWith('Everything Is Durians'));
  eq('a former +300% is now a sequence', fam.length, 3);
  eq('and its parts cost progressively more', fam[2].cost > fam[0].cost, true);
}

console.log('\n=== flavour variety ===');
{
  const counts = {};
  DC.CONFIG.upgrades.forEach(u => {
    const f = u.description.split(/(?<=\.)\s+/).slice(1).join(' ').trim();
    if (f) counts[f] = (counts[f] || 0) + 1;
  });
  const worst = Math.max(...Object.values(counts));
  eq('no flavour line used more than 10 times', worst <= 10, true);
  eq('plenty of distinct lines', Object.keys(counts).length > 500, true);
}

console.log('\n=== new achievements ===');
const crewSizes = DC.CONFIG.achievements.filter(a => a.condition.type === 'totalWorkers')
  .map(a => a.condition.count);
eq('crew ladder reaches 100,000', Math.max(...crewSizes), 100000);
const upCounts = DC.CONFIG.achievements.filter(a => a.condition.type === 'upgradesBought')
  .map(a => a.condition.count);
eq('upgrade ladder reaches past 850', Math.max(...upCounts) >= 850, true);
eq('octodecillion exists',
   DC.CONFIG.achievements.some(a => /octodecillion/i.test(a.description)), true);
eq('novemdecillion band covered',
   DC.CONFIG.achievements.some(a => a.condition.amount === 1e57) &&
   DC.CONFIG.achievements.some(a => a.condition.amount === 1e60 || a.condition.amount === 1e63), true);

console.log('\n=== dark header ===');
{
  const cssTxt = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
  eq('header has a dark treatment', /body\.dark \.topbar\s*\{/.test(cssTxt), true);
  eq('and is no longer cream',
     /body\.dark \.topbar\s*\{[^}]*rgba\(28, 48, 64/.test(cssTxt), true);
}

console.log('\n=== blue coins collect on press, not drag ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.Coins.spawn('coin');
const coin = w.document.querySelector('#coin-layer .blue-coin');
eq('coin element rendered', !!coin, true);
eq('button is not draggable', coin.draggable, false);
eq('image is not draggable', coin.querySelector('img').getAttribute('draggable'), 'false');
const before = DC.Coins.count();
coin.dispatchEvent(new w.PointerEvent('pointerdown', { clientX: 40, clientY: 40, bubbles: true }));
// a lucky drop pays 3 instead of 1, so assert it went up rather than by how much
eq('press collects it', DC.Coins.count() > before, true);
eq('element removed', w.document.querySelectorAll('#coin-layer .blue-coin').length, 0);

DC.Coins.spawn('plane');
const plane = w.document.querySelector('#coin-layer .blue-coin');
eq('plane is not draggable', plane.draggable, false);
const b2 = DC.Coins.count();
plane.dispatchEvent(new w.PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
eq('press collects the plane too', DC.Coins.count() > b2, true);

const dragCss = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
eq('artwork cannot be dragged',
   /\.blue-coin img\s*\{[^}]*-webkit-user-drag:\s*none/.test(dragCss), true);
eq('clicks pass through the artwork to the button',
   /\.blue-coin img\s*\{[^}]*pointer-events:\s*none/.test(dragCss), true);

console.log('\n=== airplanes reach reduced-motion players ===');
// A blanket animation-duration override finished planeFly instantly and, with
// fill-mode forwards, parked the plane 140px past the right edge. Players with
// reduced motion enabled never saw one.
{
  const motionCss = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
  const block = motionCss.slice(motionCss.indexOf('@media (prefers-reduced-motion'));
  const scoped = block.slice(0, block.indexOf('\n}\n', block.indexOf('.blue-coin')) + 3);
  eq('reduced motion cancels the flight',
     /\.blue-coin\.is-plane\s*\{[^}]*animation:\s*none\s*!important/.test(scoped), true);
  eq('and brings it back on screen',
     /\.blue-coin\.is-plane\s*\{[^}]*left:\s*50%\s*!important/.test(scoped), true);
  eq('a static plane variant exists', /\.blue-coin\.is-plane\.is-static/.test(motionCss), true);
}
{
  // with the preference on, the plane is placed like a coin
  const wm = boot();
  wm.matchMedia = function (q) {
    return { matches: /reduced-motion/.test(q), media: q,
             addListener: function () {}, removeListener: function () {} };
  };
  wm.DC.Coins.spawn('plane');
  const p = wm.document.querySelector('#coin-layer .blue-coin');
  eq('plane rendered', !!p, true);
  eq('marked static', p.classList.contains('is-static'), true);
  eq('given an on-screen left', p.style.left.length > 0, true);
  eq('given an on-screen top', p.style.top.length > 0, true);
  const before = wm.DC.Coins.count();
  p.dispatchEvent(new wm.PointerEvent('pointerdown', { clientX: 30, clientY: 30, bubbles: true }));
  eq('and it can be collected', wm.DC.Coins.count() > before, true);
}
{
  // normal players still get the flyby
  const wn = boot();
  wn.matchMedia = function (q) {
    return { matches: false, media: q, addListener: function () {}, removeListener: function () {} };
  };
  wn.DC.Coins.spawn('plane');
  const p = wn.document.querySelector('#coin-layer .blue-coin');
  eq('flying plane is not static', p.classList.contains('is-static'), false);
  eq('flight duration set', p.style.getPropertyValue('--fly-seconds').length > 0, true);
}

console.log('\n=== dark mode text is readable ===');
// anything using --sea or --sea-deep for TEXT needs a dark override
const darkCss = dragCss;
['\\.item-owned', '\\.brand h1 span', '\\.offline-amount', '\\.board-score',
 '\\.tip em', '\\.news-body strong'].forEach(function (sel) {
  eq('dark override for ' + sel.replace(/\\\\/g, ''),
     new RegExp('body\\.dark ' + sel).test(darkCss), true);
});
eq('crew count matches the description colour in dark mode',
   /body\.dark \.item-owned \{ color: var\(--ink-soft\); \}/.test(darkCss), true);

console.log('\n=== abbreviated switches to powers of ten ===');
{
  const wp = boot(); const Np = wp.DC.N;
  const ab = v => Np.format(v, { mode: 'abbreviated' });
  eq('suffixes stay for readable sizes', ab(Np.big(4.2e12)), '4.2T');
  eq('and up to the last plain one', ab(Np.pow10(33)), '1Dc');
  eq('then powers of ten take over', /\u00D710\^/.test(ab(Np.pow10(36))), true);
  eq('no compound suffixes survive',
     [36, 45, 57, 93, 200].every(e => !/Dc|Vg|Tg/.test(ab(Np.pow10(e)))), true);
  eq('mantissa keeps two decimals', ab(Np.big(1.234e45)).indexOf('1.23') === 0, true);
  eq('and drops pointless zeros', ab(Np.pow10(45)).indexOf('1\u00D7') === 0, true);
  eq('works past a JS number', /\u00D710\^/.test(ab(Np.pow10(900))), true);
  eq('and no font-dependent superscripts are used',
     [36, 45, 61, 75, 308].every(function (e) {
       return !/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]/.test(ab(Np.pow10(e)));
     }), true);
  eq('shortened is unaffected', Np.format(Np.big(1.23e36), { mode: 'shortened' }),
     '1.23 undecillion');
  eq('menus use it too', (() => {
    wp.DC.Game.state.settings.numberFormat = 'full';
    return /\u00D710\^/.test(Np.formatMenu(Np.pow10(51)));
  })(), true);
}

console.log('\n=== offline production ===');
{
  const wo = boot(); const Do = wo.DC, Go = Do.Game, No = Do.N;
  eq('starts at 10% of normal', Do.CONFIG.offline.efficiency, 0.1);
  Go.recalc();
  eq('and the derived rate agrees', Go.derived.offlineEfficiency, 0.1);

  Do.CONFIG.workers.forEach(x => { Go.state.unlocked[x.id] = true; Go.state.workers[x.id] = 30; });
  Go.recalc();
  const away = Do.Offline.evaluate(Date.now() - 3600 * 1000);
  const expected = No.toNumber(No.mul(Go.derived.dps, 3600 * 0.1));
  eq('an hour away pays a tenth of an hour of production',
     Math.abs(No.toNumber(away.amount) - expected) / expected < 0.01, true);

  // the upgrades still raise it
  const eff = Do.CONFIG.upgrades.filter(u =>
    u.effects.some(e => e.type === 'offlineEfficiency')).sort((a, b) => a.cost - b.cost);
  Go.state.upgrades[eff[0].id] = true; Go.recalc();
  eq('the first offline upgrade raises it',
     Math.round(Go.derived.offlineEfficiency * 100), 15);
  eff.forEach(u => { Go.state.upgrades[u.id] = true; });
  Go.recalc();
  eq('a full build tops out at 90%', Math.round(Go.derived.offlineEfficiency * 100), 90);
  eq('offline never beats being online', Go.derived.offlineEfficiency <= 1, true);
  let sum = 0;
  eff.forEach(u => u.effects.forEach(e => { if (e.type === 'offlineEfficiency') sum += e.value; }));
  eq('the upgrades sum to +80%', Math.round(sum * 100), 80);

  Do.UI.selectTab('stats');
  const txt = wo.document.getElementById('stats-list').textContent;
  eq('stats shows the offline rate', /Offline production/.test(txt), true);
  eq('and the offline cap', /Offline counts for up to/.test(txt), true);
}

console.log('\n=== events always move the bank ===');
{
  const we = boot(); const De = we.DC, Ne = De.N, Ge = De.Game;
  De.CONFIG.workers.forEach(x => { Ge.state.unlocked[x.id] = true; Ge.state.workers[x.id] = 300; });
  De.CONFIG.upgrades.forEach(u => Ge.state.upgrades[u.id] = true);
  Ge.recalc();
  [1e40, 1e60, 1e80, 1e110].forEach(function (bank) {
    Ge.state.durians = Ne.big(bank);
    const before = Ne.toNumber(Ge.state.durians);
    const r = De.IslandEvents.trigger('king_boo');
    eq('gain registers at a bank of 1e' + Math.log10(bank),
       Ne.toNumber(Ge.state.durians) > before, true);
    eq('and the announced amount is not zero at 1e' + Math.log10(bank),
       Ne.toNumber(r.amount) > 0, true);
  });
  [1e60, 1e100].forEach(function (bank) {
    Ge.state.durians = Ne.big(bank);
    const before = Ne.toNumber(Ge.state.durians);
    De.IslandEvents.trigger('toadsworth_audit');
    eq('loss registers at a bank of 1e' + Math.log10(bank),
       Ne.toNumber(Ge.state.durians) < before, true);
  });
  // the floor must not distort ordinary play
  Ge.state.durians = Ne.mul(Ge.derived.dps, 600);
  const normal = De.IslandEvents.trigger('king_boo');
  eq('floor does not inflate a normal payout',
     Ne.toNumber(normal.amount) > Ne.toNumber(Ge.state.durians) * 0.0002 * 1.5, true);
}

console.log('\n=== click upgrades do what they say ===');
{
  const wc = boot(); const Dc = wc.DC, Nc = Dc.N, Gc = wc.DC.Game;
  Dc.CONFIG.workers.forEach(x => { Gc.state.unlocked[x.id] = true; Gc.state.workers[x.id] = 200; });
  Gc.state.upgrades.fludd_hover = true;      // put the production share ahead
  Gc.recalc();
  const before = Nc.toNumber(Gc.derived.clickPower);
  Gc.state.upgrades.gloves3 = true; Gc.recalc();
  eq('Spike-Proof Gauntlets adds exactly 50',
     Math.round(Nc.toNumber(Gc.derived.clickPower) - before), 50);

  // every flat click upgrade must add its stated amount, share route or not
  Dc.CONFIG.upgrades.forEach(function (u) {
    const flat = u.effects.find(function (e) { return e.type === 'clickAdd'; });
    if (!flat || Gc.state.upgrades[u.id]) return;
    const b = Nc.toNumber(Gc.derived.clickPower);
    Gc.state.upgrades[u.id] = true; Gc.recalc();
    const delta = Nc.toNumber(Gc.derived.clickPower) - b;
    if (Math.abs(delta - flat.value) > Math.max(1, flat.value * 0.01)) {
      fails++; console.log('FAIL ' + u.id + ' claims +' + flat.value + ' but added ' + delta);
    }
    Gc.state.upgrades[u.id] = false; Gc.recalc();
  });
  console.log('  ok   every clickAdd upgrade adds its stated amount');

  // multipliers apply to the gear route, and say so
  const gearMults = Dc.CONFIG.upgrades.filter(function (u) {
    return u.effects.some(function (e) { return e.type === 'clickMult'; });
  });
  eq('multiplier wording matches what it multiplies',
     gearMults.every(function (u) { return /gear bonus/i.test(u.description); }), true);
  const w2 = boot(); w2.DC.Game.recalc();
  const base = w2.DC.N.toNumber(w2.DC.Game.derived.clickPower);
  w2.DC.Game.state.upgrades.fludd_squirt = true; w2.DC.Game.recalc();
  eq('a x2 gear multiplier really doubles it early on',
     Math.round(w2.DC.N.toNumber(w2.DC.Game.derived.clickPower) / base), 2);
}

console.log('\n=== version label and changelog views ===');
{
  const wv = boot(); const Dv = wv.DC;
  eq('version is configured', typeof Dv.CONFIG.version, 'string');
  eq('shown beside the logo',
     wv.document.getElementById('brand-version').textContent, 'v' + Dv.CONFIG.version);

  // the What's new prompt shows only the newest release
  const old = JSON.parse(Buffer.from(Dv.Save.exportString(), 'base64').toString('utf8'));
  old.changelogSeen = 'something-older';
  const w1 = boot(JSON.stringify(old));
  w1.document.getElementById('news-read').dispatchEvent(new w1.MouseEvent('click', { bubbles: true }));
  eq('What\u2019s new shows one release',
     w1.document.querySelectorAll('#changelog-body .changelog-entry').length, 1);
  eq('and is titled What\u2019s new',
     /What/.test(w1.document.getElementById('changelog-title').textContent), true);

  // settings shows the lot
  const w2 = boot();
  w2.document.getElementById('btn-history').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  eq('settings shows every release',
     w2.document.querySelectorAll('#changelog-body .changelog-entry').length,
     w2.DC.CONFIG.changelog.length);
  eq('titled Changelog', w2.document.getElementById('changelog-title').textContent, 'Changelog');
  eq('and it opens without needing an unread release',
     w2.document.getElementById('modal-changelog').hidden, false);
}

console.log('\n=== balance tweaks ===');
{
  const wb = boot(); const Db = wb.DC;
  const grasp = Db.CONFIG.upgrades.find(function (u) { return u.name === 'The Grasping Hand'; });
  eq('The Grasping Hand costs 10B', grasp.cost, 1e10);
  var per = Db.CONFIG.achievementBonusPer || 0.01;
  Db.CONFIG.upgrades.forEach(function (u) {
    u.effects.forEach(function (e) { if (e.type === 'achievementBonus') per += e.value; });
  });
  // Halved twice before, then reduced again by the late-game brake, which
  // scales back achievementBonus on upgrades priced at or above 1e29. Around
  // 0.49 gives roughly x120 production at a full 239 achievements.
  eq('achievement scaling stays in range', per < 0.8 && per > 0.3, true);
}

console.log('\n=== hover no longer lifts elements ===');
const css = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
eq('no translateY on hover', /:hover\s*\{[^}]*translateY\(-/.test(css), false);

console.log('\n' + (fails ? fails + ' FAILURES' : 'All Update 13 tests passed.'));
process.exit(fails ? 1 : 0);
