const { JSDOM } = require('jsdom');
const fs = require('fs');
const p = '/home/claude/durian-clicker/';

function boot(existingSaveJson) {
  const dom = new JSDOM(fs.readFileSync(p + 'index.html', 'utf8'),
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://zeldocto.github.io/durian-clicker/' });
  const w = dom.window;
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  if (existingSaveJson) w.localStorage.setItem('durianClicker.save.v1', existingSaveJson);
  ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js',
   'numbers.js','game.js','workers.js','upgrades.js','achievements.js','save.js',
   'offline.js','events.js','updates.js','coins.js','casino.js','store.js','audio.js','leaderboard.js','ui.js','debug.js','main.js']
    .forEach(f => w.eval(fs.readFileSync(p + 'js/' + f, 'utf8')));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}

let fails = 0;
const eq = (l, g, e) => {
  if (String(g) !== String(e)) { fails++; console.log('FAIL', l, '| got', g, '| want', e); }
  else console.log('  ok  ', l, '=', g);
};

(async () => {
// ---------------------------------------------------------------------------
console.log('=== content inventory ===');
let w = boot();
let DC = w.DC, N = DC.N, G = DC.Game;
eq('upgrade count', DC.CONFIG.upgrades.length, 992);
eq('achievement count', DC.CONFIG.achievements.length, 239);
eq('event count', DC.CONFIG.events.length >= 12, true);
eq('worker count', DC.CONFIG.workers.length, 14);

const upIds = DC.CONFIG.upgrades.map(u => u.id);
eq('no duplicate upgrade ids', upIds.length, new Set(upIds).size);
const achIds = DC.CONFIG.achievements.map(a => a.id);
eq('no duplicate achievement ids', achIds.length, new Set(achIds).size);
const evIds = DC.CONFIG.events.map(e => e.id);
eq('no duplicate event ids', evIds.length, new Set(evIds).size);

// every effect type an upgrade uses must be handled by recalc
const handled = new Set(['clickAdd','clickMult','clickFromDps','clickFromWorkers','globalMult',
  'workerMult','workerScaling','workerSynergy','achievementBonus','eventChance','eventGain',
  'eventLoss','buffDuration','offlineEfficiency','offlineHours']);
const used = new Set(); DC.CONFIG.upgrades.forEach(u => u.effects.forEach(e => used.add(e.type)));
eq('all effect types handled', [...used].every(t => handled.has(t)), true);

// every synergy/scaling target must be a real worker or 'all'
const workerIds = new Set(DC.CONFIG.workers.map(x => x.id));
let badTarget = [];
DC.CONFIG.upgrades.forEach(u => u.effects.forEach(e => {
  if (e.target && e.target !== 'all' && !workerIds.has(e.target)) badTarget.push(u.id + ':' + e.target);
  if (e.source && e.source !== 'all' && !workerIds.has(e.source)) badTarget.push(u.id + ':' + e.source);
}));
eq('all effect targets valid', badTarget.length ? badTarget.join(',') : 'none', 'none');

// every requirement type must be understood
let badReq = [];
DC.CONFIG.upgrades.concat(DC.CONFIG.workers).forEach(x => {
  try { G.meetsRequirement(x.unlock); } catch (e) { badReq.push(x.id); }
  if (G.describeRequirement(x.unlock) === 'Locked') badReq.push(x.id + ':desc');
});
DC.CONFIG.achievements.forEach(a => { try { G.meetsRequirement(a.condition); } catch(e){ badReq.push(a.id); } });
eq('all requirement types understood', badReq.length ? badReq.join(',') : 'none', 'none');
eq('all upgrades have descriptions', DC.CONFIG.upgrades.every(u => u.description && u.description.length > 10), true);
eq('all upgrades have costs', DC.CONFIG.upgrades.every(u => u.cost > 0 && isFinite(u.cost)), true);

// ---------------------------------------------------------------------------
console.log('\n=== new crew ordering ===');
const order = DC.CONFIG.workers.map(x => x.id);
eq('Fruit Lady between Pianta and Noki',
   order.indexOf('pianta') < order.indexOf('fruitlady') && order.indexOf('fruitlady') < order.indexOf('noki'), true);
eq('Mushroom Dealer between Toad and Piantissimo',
   order.indexOf('toad') < order.indexOf('mushroompianta') && order.indexOf('mushroompianta') < order.indexOf('piantissimo'), true);
eq('Tanooki between Piantissimo and Shadow Mario',
   order.indexOf('piantissimo') < order.indexOf('tanooki') && order.indexOf('tanooki') < order.indexOf('shadowmario'), true);
eq('Chuckster after Shadow Mario', order.indexOf('shadowmario') < order.indexOf('chuckster'), true);
eq('costs strictly ascending', DC.CONFIG.workers.every((x,i,a) => i===0 || x.baseCost > a[i-1].baseCost), true);
eq('production strictly ascending', DC.CONFIG.workers.every((x,i,a) => i===0 || x.baseProduction > a[i-1].baseProduction), true);
eq('every worker has art', DC.CONFIG.workers.every(x => /^assets\/.+\.png$/.test(x.image)), true);
eq('every new worker has tier upgrades', ['fruitlady','mushroompianta','tanooki','chuckster']
   .every(id => DC.CONFIG.upgrades.filter(u => u.effects.some(e => e.target === id)).length >= 10), true);
eq('every new worker has achievements', ['fruitlady','mushroompianta','tanooki','chuckster']
   .every(id => DC.CONFIG.achievements.some(a => a.condition.id === id)), true);

console.log('\n=== v1 SAVE MIGRATION (the one that must not break) ===');
// Build a realistic v1 save: no buffs, no events, no offlineEarned, no lost.
const v1 = {
  version: 1,
  durians: { m: 4.2, e: 11 },
  totalEarned: { m: 8.8, e: 11 },
  clickEarned: { m: 2.0, e: 6 },
  workerEarned: { m: 8.7, e: 11 },
  spent: { m: 4.4, e: 11 },
  totalClicks: 4820,
  workers: { pianta: 312, noki: 288, yoshi: 201, toad: 176, piantissimo: 140, shadowmario: 96 },
  upgrades: { gloves:true, gloves2:true, fludd_squirt:true, fludd_hover:true, fludd_turbo:true,
              pianta_training:true, pianta_festival:true, noki_logistics:true, noki_shells:true,
              yoshi_juice:true, toad_brigade:true, piantissimo_shoes:true, shadow_brush:true,
              farming:true, irrigation:true, shine_blessing:true },
  achievements: { first_durian:1, blistered:1, enthusiast:1, hoarder:1, a_lot_of_fruit:1,
                  smells_like_home:1, pianta_workforce:1, pianta_union:1, noki_workforce:1,
                  yoshi_workforce:1, staffed_up:1, plaza_economy:1, shine_get:1, manual_labor:1 },
  unlocked: {},
  settings: { volume: 0.4, muted: false, buyAmount: 10 },
  player: { id: 'veteran-row-key-1234', publicId: 'veteran-pub-5678', name: 'zeldocto', lastSubmit: 0 },
  playTime: 41000,
  startedAt: Date.now() - 41000000,
  lastSaved: Date.now() - 5000
};
['gloves','gloves2','fludd_squirt','fludd_hover','fludd_turbo','pianta_training','pianta_festival',
 'noki_logistics','noki_shells','yoshi_juice','toad_brigade','piantissimo_shoes','shadow_brush',
 'farming','irrigation','shine_blessing','pianta','noki','yoshi','toad','piantissimo','shadowmario']
 .forEach(id => v1.unlocked[id] = true);

w = boot(JSON.stringify(v1));
DC = w.DC; N = DC.N; G = DC.Game;

eq('durians preserved exactly', N.format(G.state.durians), '4.2\u00D710^11');
eq('total earned preserved', N.format(G.state.totalEarned), '8.8\u00D710^11');
eq('clicks preserved', G.state.totalClicks, 4820);
eq('play time preserved', Math.round(G.state.playTime), 41000);
Object.keys(v1.workers).forEach(function (id) {
  eq('worker ' + id + ' preserved', G.state.workers[id], v1.workers[id]);
});
eq('new crew default to zero', DC.CONFIG.workers.filter(x=>!(x.id in v1.workers))
   .every(x=>G.state.workers[x.id]===0), true);
eq('all 16 old upgrades still owned', Object.keys(G.state.upgrades).length, 16);
eq('all 14 old achievements kept', Object.keys(G.state.achievements).filter(k=>G.state.achievements[k]).length >= 14, true);
eq('leaderboard name kept', G.state.player.name, 'zeldocto');
eq('private row key kept', G.state.player.id, 'veteran-row-key-1234');
eq('settings kept', G.state.settings.buyAmount, 10);
eq('buy amount button synced', w.document.querySelector('.amt[data-amount="10"]').classList.contains('is-active'), true);

console.log('  -- new fields default cleanly --');
eq('buffs array created', Array.isArray(G.state.buffs), true);
eq('events object created', typeof G.state.events.seen, 'object');
eq('events total starts at 0', G.state.events.total, 0);
eq('lost defaults to a Big', N.format(G.state.lost), '0');
eq('offlineEarned defaults to a Big', N.format(G.state.offlineEarned), '0');
eq('new upgrades NOT auto-owned', !!G.state.upgrades.pianta_t3, false);
eq('new achievements NOT auto-earned', !!G.state.achievements.quadrillion, false);

console.log('  -- veteran immediately gets new content to chase --');
const newlyUnlocked = DC.CONFIG.upgrades.filter(u => G.state.unlocked[u.id] && !G.state.upgrades[u.id]);
eq('new upgrades unlocked for veteran', newlyUnlocked.length > 20, true);
const newAch = Object.keys(G.state.achievements).length;
eq('some new achievements earned on load', newAch > 14, true);
eq('production still positive', N.toNumber(G.derived.dps) > 0, true);

console.log('  -- re-saving keeps everything --');
const round = DC.Save.deserialize(DC.Save.serialize(G.state));
eq('durians survive re-save', N.format(round.durians), N.format(G.state.durians));
eq('workers survive re-save', JSON.stringify(round.workers), JSON.stringify(G.state.workers));
eq('new crew in save too', typeof round.workers.chuckster, 'number');
eq('achievements survive re-save', Object.keys(round.achievements).length, Object.keys(G.state.achievements).length);

// ---------------------------------------------------------------------------
console.log('\n=== new effect types actually work ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
G.state.workers.pianta = 100; G.state.workers.noki = 50;
DC.CONFIG.workers.forEach(x => G.state.unlocked[x.id] = true);
G.recalc();
const basePianta = N.toNumber(G.derived.perWorker.pianta);

G.state.upgrades.pianta_village = true; G.recalc();   // +1% per 25 owned -> 100/25 = 4 -> x1.04
eq('workerScaling applies', Math.round(N.toNumber(G.derived.perWorker.pianta) / basePianta * 100) / 100, 1.04);

delete G.state.upgrades.pianta_village;
G.state.upgrades.syn_noki_teach = true; G.recalc();   // +0.2% per Noki -> 50 * 0.002 = x1.10
eq('workerSynergy applies', Math.round(N.toNumber(G.derived.perWorker.pianta) / basePianta * 100) / 100, 1.10);

delete G.state.upgrades.syn_noki_teach;
// derive the expectation from config so balance tweaks don't break the test
const censusFx = G.upgradeDef('syn_census').effects.find(e => e.type === 'workerSynergy');
const totalCrew = DC.CONFIG.workers.reduce((n, x) => n + (G.state.workers[x.id] || 0), 0);
G.state.upgrades.syn_census = true; G.recalc();
eq('all-target synergy applies to every worker',
   Math.round(N.toNumber(G.derived.perWorker.noki) / (8 * G.derived.globalMult) * 1000) / 1000,
   Math.round((1 + censusFx.value * totalCrew) * 1000) / 1000);

delete G.state.upgrades.syn_census;
G.state.upgrades.click_crew1 = true; G.recalc();      // +10 per worker, 150 workers
eq('clickFromWorkers applies', N.toNumber(G.derived.clickPower) >= 1500, true);

delete G.state.upgrades.click_crew1;
const beforeAch = G.derived.globalMult;
G.state.upgrades.shine_hoard1 = true; G.recalc();
eq('achievementBonus raises global mult', G.derived.globalMult >= beforeAch, true);

G.state.upgrades.offline_time1 = true; G.recalc();
eq('offlineHours extends the cap', G.derived.offlineMaxSeconds, 86400 + 12 * 3600);
G.state.upgrades.offline1 = true; G.recalc();
// derive the expected rate from the upgrade itself, so retuning the values
// does not break this again
{
  const up = DC.CONFIG.upgrades.find(u => u.id === 'offline1');
  const add = up.effects.find(e => e.type === 'offlineEfficiency').value;
  eq('offlineEfficiency raises rate',
     Math.round(G.derived.offlineEfficiency * 1000) / 1000,
     Math.round((DC.CONFIG.offline.efficiency + add) * 1000) / 1000);
}

// ---------------------------------------------------------------------------
console.log('\n=== island events ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => G.state.unlocked[x.id] = true);
G.state.workers.pianta = 200; G.state.workers.noki = 200;
G.addDurians(N.pow10(9)); G.recalc(); G.checkProgress();

const dpsNow = N.toNumber(G.derived.dps);
let r = DC.IslandEvents.trigger('king_boo');
eq('king boo pays out', r.direction, 'gain');
// base payouts were reduced in the event rebalance; check it scales with
// production rather than asserting an old magnitude
eq('payout is dps-scaled', N.toNumber(r.amount) >= dpsNow * 60 * 0.99, true);
eq('event recorded', G.state.events.seen.king_boo, 1);
eq('event total incremented', G.state.events.total, 1);
eq('banner shown', w.document.getElementById('event-banner').hidden, false);
eq('banner shows gain', /^\+/.test(w.document.getElementById('event-amount').textContent), true);

const bank = N.toNumber(G.state.durians);
r = DC.IslandEvents.trigger('king_boo_greedy');
eq('greedy boo takes durians', r.direction, 'loss');
eq('bank actually decreased', N.toNumber(G.state.durians) < bank, true);
eq('never goes negative', N.toNumber(G.state.durians) >= 0, true);
eq('loss recorded in stats', N.toNumber(G.state.lost) > 0, true);

r = DC.IslandEvents.trigger('sirena_bill');
eq('sirena bill is a loss', r.direction, 'loss');
eq('sirena recorded', G.state.events.seen.sirena_bill, 1);

console.log('  -- buffs --');
const dpsBefore = N.toNumber(G.derived.dps);
DC.IslandEvents.trigger('shine_sprite');
eq('shine buff active', DC.IslandEvents.activeBuffs().length, 1);
eq('buff multiplies production', Math.round(N.toNumber(G.derived.dps) / dpsBefore), 7);
eq('buff chip rendered', w.document.querySelectorAll('#buff-bar .buff').length, 1);
G.state.buffs[0].endsAt = Date.now() - 1;
DC.IslandEvents.pruneBuffs();
eq('expired buff removed', DC.IslandEvents.activeBuffs().length, 0);
const unbuffed = N.toNumber(G.derived.dps);
eq('buff no longer multiplying', G.derived.buffProd, 1);
eq('production back within 2% of baseline', Math.abs(unbuffed - dpsBefore) / dpsBefore < 0.02, true);

DC.IslandEvents.trigger('gooey_goop');
eq('debuff halves production', Math.round(N.toNumber(G.derived.dps) / dpsBefore * 10) / 10, 0.5);
eq('debuff chip marked bad', w.document.querySelector('#buff-bar .buff').classList.contains('buff-bad'), true);
G.state.buffs.length = 0; G.recalc();

DC.IslandEvents.trigger('yoshi_spill');
eq('click buff multiplies clicks', N.toNumber(G.derived.clickPower) > 10, true);
G.state.buffs.length = 0; G.recalc();

console.log('  -- upgrades modify events --');
G.state.upgrades.boo_bargain = true; G.recalc();
eq('eventGain doubles good payouts', G.derived.eventGain, 2);
G.state.upgrades.hotel_haggling = true; G.recalc();
eq('eventLoss halves setbacks', G.derived.eventLoss, 0.5);
G.state.upgrades.luck_charm = true; G.recalc();
eq('eventChance raises frequency', G.derived.eventChance, 1.25);
G.state.upgrades.buff_bottle = true; G.recalc();
eq('buffDuration extends buffs', G.derived.buffDuration, 1.5);

console.log('  -- scheduling and safety --');
DC.IslandEvents.schedule();
const wait = DC.IslandEvents.timeUntilNext();
eq('next event scheduled in range', wait > 0 && wait <= 900, true);
eq('events persist in save', DC.Save.deserialize(DC.Save.serialize(G.state)).events.total >= 5, true);

// setbacks must not hit a nearly-broke player
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
G.state.workers.pianta = 10; G.state.unlocked.pianta = true; G.recalc();
let setbackHit = false;
for (let i = 0; i < 200; i++) {
  G.state.durians = N.big(50);          // stay poor: good events would top us up
  const res = DC.IslandEvents.trigger();
  if (res && res.direction === 'loss') setbackHit = true;
}
eq('no setbacks while nearly broke', setbackHit, false);

// ---------------------------------------------------------------------------
console.log('\n=== upgrade list stays usable with 166 upgrades ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.upgrades.forEach(u => G.state.unlocked[u.id] = true);
G.addDurians(N.pow10(30)); G.recalc();
DC.UI.rebuildAll(); DC.UI.selectTab('upgrades');
const rows = w.document.querySelectorAll('#upgrade-list .item:not(.locked)').length;
eq('list is paged, not 166 rows', rows <= 40, true);
eq('count line shown', /Showing 40 of/.test(w.document.getElementById('upgrade-count').textContent), true);
eq('show more button visible', w.document.getElementById('upgrade-more').hidden, false);
w.document.getElementById('upgrade-more').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('show more reveals more', w.document.querySelectorAll('#upgrade-list .item:not(.locked)').length > 40, true);

const search = w.document.getElementById('upgrade-search');
search.value = 'Corona';
search.dispatchEvent(new w.Event('input', { bubbles: true }));
const found = [...w.document.querySelectorAll('#upgrade-list .item-name')].map(n => n.textContent);
eq('search finds Corona Mountain', found.some(t => /Corona/.test(t)), true);
eq('search narrows the list', found.length < DC.CONFIG.upgrades.length / 20, true);
search.value = '';
search.dispatchEvent(new w.Event('input', { bubbles: true }));

G.state.durians = N.big(1000);
G.recalc();
w.document.getElementById('filter-afford').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
DC.Events.emit('render');
const affordable = [...w.document.querySelectorAll('#upgrade-list .item:not(.locked)')];
eq('affordable filter only shows affordable', affordable.every(r => r.classList.contains('affordable')), true);
w.document.getElementById('filter-all').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

console.log('\n=== menus never use full numbers ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; });
G.addDurians(N.big(1.2345e32)); G.recalc();
G.state.settings.numberFormat = 'full';
DC.UI.rebuildAll();
eq('the big counter honours full mode',
   /,/.test(w.document.getElementById('durian-count').textContent) &&
   w.document.getElementById('durian-count').textContent.length > 20, true);
const costText = w.document.querySelector('#worker-list .item-cost').textContent;
eq('shop costs stay abbreviated', costText.length < 12, true);
eq('shop cost is not a full number', /,\d{3},\d{3},\d{3}/.test(costText), false);
DC.UI.selectTab('stats');
const bankRow = [...w.document.querySelectorAll('#stats-list .stat-row')]
  .find(r => /In the bank/.test(r.textContent));
eq('stats stay abbreviated', bankRow.querySelector('dd').textContent.length < 14, true);
// shortened mode is readable, so menus keep it
G.state.settings.numberFormat = 'shortened';
DC.UI.rebuildAll();
// (the first worker costs 20, so check the formatter itself rather than a
// row that happens to hold a small number)
eq('shortened is kept in menus', /nonillion/.test(N.formatMenu(N.big(1.2345e32))), true);
eq('full mode still downgrades to abbreviated in menus', (() => {
  G.state.settings.numberFormat = 'full';
  return N.formatMenu(N.big(1.2345e32));
})(), '1.23\u00D710^32');
G.state.settings.numberFormat = 'abbreviated';

console.log('\n=== two decimals throughout ===');
// The mantissa is always normalised to 1-9.99 now, so "12.34" no longer
// occurs; what still matters is that two decimals survive rather than being
// rounded away.
const mantissa = v => N.format(N.big(v), { mode: 'abbreviated' }).split('\u00D7')[0];
eq('1.23 keeps two', mantissa(1.23e30), '1.23');
eq('two decimals survive normalising', mantissa(1.234e31), '1.23');
eq('and a third is not invented', /^\d(\.\d{1,2})?$/.test(mantissa(1.2345e20)), true);

eq('trailing zeros are dropped', N.format(N.big(18e6), { mode: 'abbreviated' }), '1.8\u00D710^7');
eq('shortened matches', N.format(N.big(1.2345e32), { mode: 'shortened' }), '123.45 nonillion');

console.log('\n=== buy amounts ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
eq('x100 button exists', !!w.document.querySelector('.amt[data-amount="100"]'), true);
w.document.querySelector('.amt[data-amount="100"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('x100 selects', G.state.settings.buyAmount, 100);
const custom = w.document.getElementById('buy-custom');
eq('custom box exists', !!custom, true);
custom.value = '37';
custom.dispatchEvent(new w.Event('input', { bubbles: true }));
eq('custom amount applies', G.state.settings.buyAmount, 37);
eq('custom box marked active', custom.classList.contains('is-active'), true);
eq('preset buttons deselected',
   [...w.document.querySelectorAll('.amt')].some(b => b.classList.contains('is-active')), false);
custom.value = '999999';
custom.dispatchEvent(new w.Event('input', { bubbles: true }));
eq('custom amount capped at the bulk limit', G.state.settings.buyAmount, 100000);
w.document.querySelector('.amt[data-amount="10"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('choosing a preset clears the custom highlight', custom.classList.contains('is-active'), false);
G.state.settings.buyAmount = 100;
DC.UI.rebuildAll();
eq('a saved custom preset is restored',
   w.document.querySelector('.amt[data-amount="100"]').classList.contains('is-active'), true);
// a bulk buy of 100 actually works
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; });
G.addDurians(N.pow10(20)); G.recalc();
const got = DC.Workers.buy('pianta', 100);
eq('buying 100 at once works', got, 100);

console.log('\n=== counter font ===');
const idx = require('fs').readFileSync('/home/claude/durian-clicker/index.html', 'utf8');
eq('font-face declared', /@font-face/.test(idx), true);
eq('points at smsscript.ttf', /assets\/fonts\/smsscript\.ttf/.test(idx), true);
const cssTxt = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('applied to the counter only',
   /\.count \{[^}]*font-family: 'SMS Script'/.test(cssTxt), true);
eq('falls back to the display font',
   /'SMS Script', var\(--font-display\)/.test(cssTxt), true);

console.log('\n=== number format setting ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
const sel = w.document.getElementById('number-format');
eq('default is abbreviated', sel.value, 'abbreviated');
G.addDurians(N.big(1250000)); G.recalc(); DC.Events.emit('render');
eq('abbreviated display', w.document.getElementById('durian-count').textContent, '1.25\u00D710^6');
sel.value = 'shortened'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
eq('shortened display', w.document.getElementById('durian-count').textContent, '1.25 million');
sel.value = 'full'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
eq('full display', w.document.getElementById('durian-count').textContent, '1,250,000');
eq('setting saved', G.state.settings.numberFormat, 'full');
eq('setting survives reload', DC.Save.deserialize(DC.Save.serialize(G.state)).settings.numberFormat, 'full');
sel.value = 'abbreviated'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));

console.log('\n=== tooltips ===');
DC.UI.selectTab('achievements');
const achNode = w.document.querySelector('#achievement-list .ach');
eq('achievements are focusable', achNode.tabIndex, 0);
eq('no native title attribute', achNode.hasAttribute('title'), false);
achNode.dispatchEvent(new w.MouseEvent('click', { bubbles: false }));
const tip = w.document.getElementById('tip');
eq('tap pins a tooltip', tip.hidden, false);
eq('tooltip is pinned', tip.classList.contains('is-pinned'), true);
eq('tooltip has a title', tip.querySelector('strong').textContent.length > 0, true);
eq('tooltip explains how to unlock', /Not yet earned|Earned/.test(tip.querySelector('em').textContent), true);
w.document.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('clicking away dismisses it', tip.hidden, true);

console.log('\n=== debug disabled for release ===');
eq('debugEnabled off', DC.CONFIG.debugEnabled, false);
eq('debug panel removed from DOM', w.document.getElementById('debug-panel'), null);
w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true }));
eq('ctrl+backtick does nothing', w.document.getElementById('debug-panel'), null);

console.log('\n=== island events in stats ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(12)); G.recalc();
DC.IslandEvents.trigger('king_boo');
DC.IslandEvents.trigger('sirena_bill');
DC.UI.selectTab('stats');
const statsText = w.document.getElementById('stats-list').textContent;
eq('stats has an Island events group', /Island events/.test(statsText), true);
eq('shows events witnessed', /Events witnessed/.test(statsText), true);
eq('shows gains from events', /Gained from events/.test(statsText), true);
eq('shows setback losses', /Lost to setbacks/.test(statsText), true);
eq('shows next event timer', /Next event in/.test(statsText), true);
eq('breaks down by event type', /King Boo/.test(statsText), true);
eq('gained total is tracked', N.toNumber(G.state.eventGained) > 0, true);
eq('eventGained survives a save', N.format(DC.Save.deserialize(DC.Save.serialize(G.state)).eventGained),
   N.format(G.state.eventGained));

console.log('\n=== base vs boosted DPS ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(12)); G.recalc();
const plainDps = N.toNumber(G.derived.dps);
eq('base equals live with no buff', N.toNumber(G.derived.baseDps), plainDps);
DC.IslandEvents.trigger('shine_sprite');
// (the event itself earns an achievement, which nudges the global multiplier,
//  so compare live-vs-base rather than against the pre-event snapshot)
eq('live dps is exactly 7x the base while buffed',
   Math.round(N.toNumber(G.derived.dps) / N.toNumber(G.derived.baseDps)), 7);
eq('base dps is below live dps', N.toNumber(G.derived.baseDps) < N.toNumber(G.derived.dps), true);
DC.CONFIG.leaderboard.provider = 'local';
DC.Leaderboard.setName('zeldocto');
await DC.Leaderboard.submit({ force: true, ignoreThrottle: true });
const row = DC.Leaderboard.providers.local.read()[0];
eq('leaderboard submits BASE dps, not buffed',
   Math.round(Math.pow(10, row.dps_log) / N.toNumber(G.derived.baseDps) * 100) / 100, 1);
eq('and not the 7x buffed figure',
   Math.pow(10, row.dps_log) < N.toNumber(G.derived.dps) / 6, true);
eq('achievements submitted for the shines column', typeof row.achievements, 'number');
await DC.Leaderboard.load('dps');
DC.UI.selectTab('leaderboard');
eq('dps board explains buffs are excluded',
   /before temporary Shine/.test(w.document.getElementById('board-status').textContent), true);
eq('row meta shows shines', /shines/.test(w.document.querySelector('.board-player-meta').textContent), true);

console.log('\n=== shines layout ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.UI.selectTab('achievements');
const boxes = [...w.document.querySelectorAll('#achievement-list .ach-group')];
eq('groups are collapsible', boxes.length > 0 && boxes[0].tagName, 'DETAILS');
eq('every group is a details element', boxes.length,
   new Set(DC.CONFIG.achievements.map(a => a.group)).size);
eq('in-progress groups start open', boxes.every(b => b.open), true);
// a fully-completed group folds away
DC.CONFIG.achievements.filter(a => a.group === 'Clicking').forEach(a => G.state.achievements[a.id] = Date.now());
DC.UI.rebuildAll(); DC.UI.selectTab('achievements');
const clicking = [...w.document.querySelectorAll('#achievement-list .ach-group')]
  .find(b => /Clicking/.test(b.querySelector('summary').textContent));
eq('completed group collapses by default', clicking.open, false);
clicking.open = true;
clicking.dispatchEvent(new w.Event('toggle'));
DC.UI.rebuildAll(); DC.UI.selectTab('achievements');
const clicking2 = [...w.document.querySelectorAll('#achievement-list .ach-group')]
  .find(b => /Clicking/.test(b.querySelector('summary').textContent));
eq('manual open state is remembered across rebuilds', clicking2.open, true);
eq('all tiles still present',
   w.document.querySelectorAll('#achievement-list .ach').length, DC.CONFIG.achievements.length);

// Structural guard: the container must not itself be the tile grid, or every
// category collapses into one narrow column (which is exactly what happened).
const listEl = w.document.getElementById('achievement-list');
eq('container is not a tile grid', listEl.classList.contains('ach-grid'), false);
eq('container is the group list', listEl.classList.contains('ach-list'), true);
eq('every tile grid sits inside a group',
   [...w.document.querySelectorAll('#achievement-list .ach-grid')]
     .every(g => g.parentElement.classList.contains('ach-group')), true);
eq('every tile sits inside a tile grid',
   [...w.document.querySelectorAll('#achievement-list .ach')]
     .every(t => t.parentElement.classList.contains('ach-grid')), true);
eq('groups are direct children of the container',
   [...w.document.querySelectorAll('#achievement-list .ach-group')]
     .every(g => g.parentElement === listEl), true);
eq('tiles carry an accessible label',
   [...w.document.querySelectorAll('#achievement-list .ach')].every(t => t.getAttribute('aria-label')), true);

// the CSS that drives all of this
const cssText = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('.ach-list is not a grid', /\.ach-list\s*\{[^}]*display:\s*block/.test(cssText), true);

console.log('\n=== update notification ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
eq('buildId set', typeof DC.CONFIG.buildId, 'string');
eq('banner hidden initially', w.document.getElementById('update-bar').hidden, true);
// same build -> silence
w.fetch = () => Promise.resolve({ ok:true, json:()=>Promise.resolve({ build: DC.CONFIG.buildId }) });
DC.Updates.check();
await new Promise(r => setTimeout(r, 20));
eq('no prompt when build matches', w.document.getElementById('update-bar').hidden, true);
// new build -> prompt
// A ROUTINE deploy (no force flag) must only show the banner.
w.fetch = () => Promise.resolve({ ok:true, json:()=>Promise.resolve({ build: 'brand-new-build' }) });
G.addDurians(N.big(12345));
let autoReloaded = false;
DC.Updates.reloadNow = function () { autoReloaded = true; };
DC.Updates.check();
await new Promise(r => setTimeout(r, 20));
const bar = w.document.getElementById('update-bar');
eq('prompt shown on new build', bar.hidden, false);
eq('prompt offers an Update now button', !!w.document.getElementById('update-now'), true);
eq('routine deploy does NOT count down',
   /Reloading in/.test(w.document.getElementById('update-line').textContent), false);
await new Promise(r => setTimeout(r, 1200));
eq('routine deploy never force-reloads', autoReloaded, false);

// A deploy that asks for it pulls everyone across.
const wf = boot();
wf.fetch = () => Promise.resolve({ ok:true,
  json:()=>Promise.resolve({ build: 'urgent-build', force: true }) });
let forcedReload = false;
wf.DC.Updates.reloadNow = function () { forcedReload = true; };
wf.DC.Updates.check();
await new Promise(r => setTimeout(r, 30));
eq('forced deploy counts down',
   /Reloading in \d+/.test(wf.document.getElementById('update-line').textContent), true);
eq('forced deploy reloads without being asked', await (async () => {
  await new Promise(r => setTimeout(r, (DC.CONFIG.updateCheck.countdownSeconds + 1) * 1000));
  return forcedReload;
})(), true);

// the master switch still overrides a forced deploy
const wo = boot();
wo.DC.CONFIG.updateCheck.allowAutoReload = false;
wo.fetch = () => Promise.resolve({ ok:true,
  json:()=>Promise.resolve({ build: 'urgent-build-2', force: true }) });
let overridden = false;
wo.DC.Updates.reloadNow = function () { overridden = true; };
wo.DC.Updates.check();
await new Promise(r => setTimeout(r, 1400));
eq('allowAutoReload:false blocks even a forced deploy', overridden, false);
eq('progress saved before prompting',
   N.format(DC.Save.deserialize(DC.Save.loadRaw()).durians), N.format(G.state.durians));
// dismissing must cancel the automatic reload, not just hide the bar
let reloaded = false;
DC.Updates.reloadNow = function () { reloaded = true; };
w.document.getElementById('update-close').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('dismissable', bar.hidden, true);
await new Promise(r => setTimeout(r, 1200));
eq('dismissing cancels the auto reload', reloaded, false);

// pressing the button reloads immediately, forced or not
w.fetch = () => Promise.resolve({ ok:true, json:()=>Promise.resolve({ build: 'another-build' }) });
DC.Updates.check();
await new Promise(r => setTimeout(r, 30));
w.document.getElementById('update-now').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('Update now reloads at once', reloaded, true);

// loop guard: if a reload did not bring the new build, stop auto-reloading
const w3 = boot();
try { w3.sessionStorage.setItem('durianClicker.reloadedFor', 'stuck-build'); } catch (e) {}
w3.fetch = () => Promise.resolve({ ok:true, json:()=>Promise.resolve({ build: 'stuck-build', force: true }) });
let looped = false;
w3.DC.Updates.reloadNow = function () { looped = true; };
w3.DC.Updates.check();
await new Promise(r => setTimeout(r, 1400));
eq('loop guard prevents a reload cycle', looped, false);
eq('falls back to manual instructions',
   /Ctrl/.test(w3.document.getElementById('update-line').textContent), true);
// network failure must stay silent
w.fetch = () => Promise.reject(new Error('offline'));
DC.Updates.check();
await new Promise(r => setTimeout(r, 20));
eq('offline check stays silent', bar.hidden, true);

console.log('\n=== island event scoping ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(12)); G.recalc();
// durations are rolled per occurrence now, so compare averages over many runs
const dur = id => { G.state.buffs.length = 0; DC.IslandEvents.trigger(id); return (G.state.buffs[0].endsAt - Date.now()) / 1000; };
const mean = id => { let t = 0; for (let i = 0; i < 60; i++) t += dur(id); return t / 60; };
const goodBase = mean('shine_sprite'), badBase = mean('gooey_goop');
G.state.upgrades.buff_bottle = true; G.recalc();
eq('good-buff upgrade extends good buffs', mean('shine_sprite') > goodBase * 1.2, true);
eq('good-buff upgrade does NOT extend bad buffs',
   Math.abs(mean('gooey_goop') - badBase) / badBase < 0.15, true);
G.state.upgrades.hotel_haggling = true; G.recalc();
eq('bad-event upgrade shortens bad buffs', mean('gooey_goop') < badBase * 0.8, true);
eq('bad-event upgrade does NOT shorten good buffs', mean('shine_sprite') > goodBase * 1.2, true);

console.log('\n=== new crew ordering (Update 3) ===');
const o3 = DC.CONFIG.workers.map(x => x.id);
eq('Ricco between Shadow Mario and Chuckster',
   o3.indexOf('shadowmario') < o3.indexOf('riccoconverter') && o3.indexOf('riccoconverter') < o3.indexOf('chuckster'), true);
eq('Giant Pianta Tree sits above Chuckster',
   o3.indexOf('chuckster') < o3.indexOf('giantpiantatree'), true);
eq('Corona Mountain follows the Tree',
   o3.indexOf('giantpiantatree') < o3.indexOf('coronamountain'), true);
eq('Pianta Judge is the last crew', o3[o3.length - 1], 'piantajudge');
eq('14 crew total', DC.CONFIG.workers.length, 14);
eq('costs still strictly ascending', DC.CONFIG.workers.every((x,i,a) => i===0 || x.baseCost > a[i-1].baseCost), true);
eq('production still strictly ascending', DC.CONFIG.workers.every((x,i,a) => i===0 || x.baseProduction > a[i-1].baseProduction), true);
eq('Ricco flavor text as specified',
   DC.CONFIG.workers.find(x=>x.id==='riccoconverter').flavor, 'Perfect RNG, everytime.');

console.log('\n=== achievement grouping ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
eq('every achievement has a group', DC.CONFIG.achievements.every(a => !!a.group), true);
const seenGroups = [];
DC.CONFIG.achievements.forEach(a => { if (seenGroups[seenGroups.length-1] !== a.group) seenGroups.push(a.group); });
eq('groups are contiguous in content', seenGroups.length, new Set(seenGroups).size);
DC.UI.selectTab('achievements');
const titles = [...w.document.querySelectorAll('#achievement-list .ach-group-title')];
eq('group headings rendered', titles.length, new Set(seenGroups).size);
eq('headings show progress counts', /\d+\/\d+/.test(titles[0].textContent), true);
eq('each group has its own grid', w.document.querySelectorAll('#achievement-list .ach-grid').length, titles.length);
eq('all achievements still shown',
   w.document.querySelectorAll('#achievement-list .ach').length, DC.CONFIG.achievements.length);
// a group's tiles must all belong to that group
const firstGrid = w.document.querySelector('#achievement-list .ach-grid');
// ordering within a group must be sensible, not just contiguous
{
  const crew = DC.CONFIG.achievements.filter(a => a.group === 'Crew');
  const roster = DC.CONFIG.workers.map(x => x.id);
  const seenWorkers = [];
  crew.forEach(a => {
    const id = a.condition.id;
    if (seenWorkers[seenWorkers.length - 1] !== id) seenWorkers.push(id);
  });
  eq('each worker\'s crew achievements are contiguous',
     seenWorkers.length, new Set(seenWorkers).size);
  eq('crew achievements follow roster order',
     seenWorkers.map(id => roster.indexOf(id)).every((v, i, a) => i === 0 || v > a[i-1]), true);
  // and ascending within a worker
  let ascending = true;
  for (let i = 1; i < crew.length; i++) {
    if (crew[i].condition.id === crew[i-1].condition.id &&
        crew[i].condition.count <= crew[i-1].condition.count) ascending = false;
  }
  eq('counts ascend within each worker', ascending, true);
}
{
  // same-condition-type entries stay together in every group
  const groups = {};
  DC.CONFIG.achievements.forEach(a => (groups[a.group] || (groups[a.group] = [])).push(a.condition.type));
  const mixed = Object.keys(groups).filter(g => {
    const seq = []; groups[g].forEach(t => { if (seq[seq.length-1] !== t) seq.push(t); });
    return seq.length !== new Set(seq).size;
  });
  eq('condition types are contiguous in every group', mixed.length ? mixed.join(',') : 'none', 'none');
}
eq('first group holds only its own members',
   firstGrid.querySelectorAll('.ach').length,
   DC.CONFIG.achievements.filter(a => a.group === seenGroups[0]).length);

console.log('\n=== key autorepeat exploit ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
const btn = w.document.getElementById('durian-button');
btn.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', repeat: false, bubbles: true }));
eq('first Enter press counts', G.state.totalClicks, 1);
for (let i = 0; i < 100; i++) {
  btn.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }));
}
eq('held Enter does not spam', G.state.totalClicks, 1);
for (let i = 0; i < 50; i++) {
  btn.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true }));
}
eq('held Space does not spam either', G.state.totalClicks, 1);
btn.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', repeat: false, bubbles: true }));
eq('deliberate presses still work', G.state.totalClicks, 2);

console.log('\n=== leaderboard number formatting is local ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.leaderboard.provider = 'local';
G.addDurians(N.big(2.5e9)); G.recalc();
DC.Leaderboard.setName('zeldocto');
G.state.settings.numberFormat = 'full';        // submitter uses full numbers
  await DC.Leaderboard.submit({ force: true, ignoreThrottle: true });
  const stored = DC.Leaderboard.providers.local.read()[0];
  eq('stored string is canonical, not the local format', stored.total_display, '2.5\u00D710^9');
  eq('stored log is a number', typeof stored.total_log, 'number');

  await DC.Leaderboard.load('total');
  DC.UI.selectTab('leaderboard');
  eq('leaderboard stays readable even in full mode',
     w.document.querySelector('.board-score').textContent, '2.5\u00D710^9');

  G.state.settings.numberFormat = 'abbreviated';
  DC.UI.rebuildAll(); DC.UI.selectTab('leaderboard');
  eq('viewer in abbreviated mode sees abbreviated',
     w.document.querySelector('.board-score').textContent, '2.5\u00D710^9');

  G.state.settings.numberFormat = 'shortened';
  DC.UI.rebuildAll(); DC.UI.selectTab('leaderboard');
  eq('viewer in shortened mode sees words',
     w.document.querySelector('.board-score').textContent, '2.5 billion');

  console.log('\n=== toast flood control ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.workers[x.id] = 500; });
G.addDurians(N.pow10(28)); G.recalc(); G.checkProgress();
const toasts = w.document.querySelectorAll('#toasts .toast').length;
eq('mass unlock does not flood toasts', toasts <= 8, true);

  console.log('\n' + (fails ? fails + ' FAILURES' : 'All Update 2 tests passed.'));
  process.exit(fails ? 1 : 0);
})();
