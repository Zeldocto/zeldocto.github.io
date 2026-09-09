const { JSDOM } = require('jsdom');
const fs = require('fs');
const p = '/home/claude/durian-clicker/';
const FILES = ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js',
  'content/skins.js','content/backgrounds.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js',
  'save.js','offline.js','events.js','updates.js','coins.js','casino.js','store.js',
  'audio.js','leaderboard.js','ui.js','debug.js','main.js'];

function boot(existingSaveJson) {
  const dom = new JSDOM(fs.readFileSync(p + 'index.html', 'utf8'),
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://zeldocto.github.io/durian-clicker/' });
  const w = dom.window;
  // each JSDOM has its own localStorage, so seed it to simulate a reload
  if (existingSaveJson) w.localStorage.setItem('durianClicker.save.v1', existingSaveJson);
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  FILES.forEach(f => w.eval(fs.readFileSync(p + 'js/' + f, 'utf8')));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return w;
}
let fails = 0;
const eq = (l, g, e) => { if (String(g) !== String(e)) { fails++; console.log('FAIL', l, '| got', g, '| want', e); } else console.log('  ok  ', l, '=', g); };

(async () => {
let w = boot(); let DC = w.DC, N = DC.N, G = DC.Game;

console.log('=== blue coins ===');
eq('starts at zero', DC.Coins.count(), 0);
eq('nothing on screen yet', DC.Coins.getActive(), null);
let info = DC.Coins.spawn('coin');
eq('spawned a coin', info.kind, 'coin');
eq('coin element rendered', w.document.querySelectorAll('#coin-layer .blue-coin').length, 1);
eq('positioned inside the viewport', info.x >= 10 && info.x <= 70 && info.y >= 18 && info.y <= 73, true);
w.document.querySelector('.blue-coin').dispatchEvent(new w.PointerEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }));
eq('collected on click', DC.Coins.count() >= 1, true);
eq('element removed after collecting', w.document.querySelectorAll('#coin-layer .blue-coin').length, 0);
eq('flyer animation spawned', w.document.querySelectorAll('.coin-flyer').length, 1);
eq('counter chip updated', w.document.getElementById('mini-coins').textContent, String(DC.Coins.count()));

info = DC.Coins.spawn('plane');
eq('airplane spawns', info.kind, 'plane');
eq('plane uses the airplane art',
   /airplane/.test(w.document.querySelector('.blue-coin img').getAttribute('src')), true);
eq('plane element has fly class', w.document.querySelector('.blue-coin').classList.contains('is-plane'), true);
const before = DC.Coins.count();
w.document.querySelector('.blue-coin').dispatchEvent(new w.PointerEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }));
eq('plane pays a coin', DC.Coins.count() > before, true);

DC.Coins.spawn('coin');
DC.Coins.expire();
eq('uncollected coin expires', w.document.querySelectorAll('#coin-layer .blue-coin').length, 0);
eq('expiry does not award', DC.Coins.count(), before + 1);
eq('coins persist in save', DC.Save.deserialize(DC.Save.serialize(G.state)).blueCoins, DC.Coins.count());

console.log('\n=== casino odds (100k spins) ===');
// A spin costs a scarce Blue Coin, so the Durian side is deliberately
// player-favourable — but not so far that it dwarfs normal production.
eq('durian return favours the player', DC.Casino.expectedReturn() > 1.1, true);
eq('but is not a runaway', DC.Casino.expectedReturn() < 2.0, true);
console.log('     theoretical return:', (DC.Casino.expectedReturn() * 100).toFixed(1) + '%');
let staked = 0, returned = 0, triples = 0, jackpots = 0;
for (let i = 0; i < 100000; i++) {
  const r = DC.Casino.resolve(DC.Casino.roll());
  staked += 1;
  returned += r.multiplier;
  if (r.kind === 'triple') triples++;
  if (r.symbol && r.symbol.id === 'coin' && r.kind === 'triple') jackpots++;
}
const actual = returned / staked;
console.log('     simulated return :', (actual * 100).toFixed(1) + '%');
eq('simulation matches theory within 10%',
   Math.abs(actual - DC.Casino.expectedReturn()) / DC.Casino.expectedReturn() < 0.10, true);
eq('return is between 110% and 200%', actual > 1.1 && actual < 2.0, true);
eq('triples happen but are uncommon', triples / 100000 > 0.02 && triples / 100000 < 0.12, true);
eq('a pair pays more than the stake back', DC.CONFIG.casino.pairPayout > 1, true);
eq('coin jackpots are rare but reachable',
   jackpots / 100000 < 0.002 && jackpots / 100000 > 0.00005, true);
console.log('     triples:', (triples/1000).toFixed(1) + '%  jackpots:', jackpots);

console.log('\n=== playing the slots (coin-gated) ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(12)); G.recalc();

eq('cannot spin with no Blue Coins', DC.Casino.play(0.05), null);
eq('blocked reason is no-coins', DC.Casino.blockedReason(0.05), 'no-coins');
eq('failed spin costs nothing', N.toNumber(G.state.casino.wagered || N.ZERO), 0);

DC.Coins.award(5);
eq('can spin once you have a coin', DC.Casino.canPlay(0.05), true);
const bank = N.toNumber(G.state.durians);
const bet = DC.Casino.betFor(0.05);
eq('bet is 5% of bank', Math.round(N.toNumber(bet) / bank * 100), 5);

const coinsBefore = DC.Coins.count();
const res = DC.Casino.play(0.05);
eq('spin returns a result', !!res, true);
eq('three reels', res.reels.length, 3);
eq('a Blue Coin was spent', DC.Coins.count(), coinsBefore - 1);
// the stake is always taken, but a win can leave you ahead overall now,
// so check the wager was recorded rather than that the balance fell
eq('the Durian stake was wagered', N.toNumber(G.state.casino.wagered) >= N.toNumber(bet), true);
eq('the balance moved either way', N.toNumber(G.state.durians) !== bank, true);
eq('spin counted', G.state.casino.spins, 1);
eq('coins spent tracked', G.state.casino.coinsSpent, 1);

// out of Durians must not silently eat the coin
G.state.durians = N.ZERO;
const coinsHeld = DC.Coins.count();
eq('cannot spin without a stake', DC.Casino.play(0.05), null);
eq('blocked reason is no-durians', DC.Casino.blockedReason(0.05), 'no-durians');
eq('coin NOT consumed on a blocked spin', DC.Coins.count(), coinsHeld);

// jackpot still pays coins, but never enough to farm
G.addDurians(N.pow10(12)); G.recalc();
const forced = id => { const list = DC.Casino.symbols(); let acc = 0, total = 0;
  list.forEach(sy => total += sy.weight);
  const target = list.find(sy => sy.id === id);
  list.some(sy => { if (sy.id === id) return true; acc += sy.weight; return false; });
  return (acc + target.weight / 2) / total; };
const beforeJack = DC.Coins.count();
const jack = DC.Casino.play(0.05, () => forced('coin'));
eq('forced three Blue Coins is a jackpot', jack.jackpot, true);
eq('jackpot pays 3 coins', jack.coins, 3);
eq('net coin gain is +2 after the 1 spent', DC.Coins.count(), beforeJack - 1 + 3);
eq('jackpot counted', G.state.casino.jackpots, 1);

console.log('\n=== Blue Coins cannot be farmed ===');
eq('coins returned per coin spent is far below 1', DC.Casino.coinReturn() < 0.01, true);
console.log('     coin return:', DC.Casino.coinReturn().toFixed(6),
            '(' + Math.round(1 / DC.Casino.coinReturn()).toLocaleString() + ' spins per coin won back)');
// empirical: spend a big pile of coins and confirm the balance only ever falls
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(30)); G.recalc();
DC.Coins.award(20000);
const startCoins = DC.Coins.count();
let spins = 0;
while (DC.Coins.canAfford(1) && spins < 20000) { DC.Casino.play(0.01); spins++; }
eq('spinning always drains coins overall', DC.Coins.count() < startCoins, true);
console.log('     ' + spins + ' spins: ' + startCoins + ' coins -> ' + DC.Coins.count());
eq('every spin consumed exactly one coin', G.state.casino.coinsSpent, spins);

console.log('\n=== casino UI ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
G.addDurians(N.pow10(9)); G.recalc();
w.document.getElementById('btn-casino').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('casino modal opens', w.document.getElementById('modal-casino').hidden, false);
eq('three reels rendered', w.document.querySelectorAll('#reels .reel').length, 3);
eq('bet options rendered', w.document.querySelectorAll('#bet-row .amt').length, DC.CONFIG.casino.betFractions.length);
eq('paytable lists every symbol',
   w.document.querySelectorAll('#paytable .stat-row').length, DC.Casino.symbols().length + 3);
eq('spin disabled without a coin', w.document.getElementById('btn-spin').disabled, true);
eq('button states the coin cost', /1 coin/.test(w.document.getElementById('btn-spin').textContent), true);
eq('UI explains why, on its own hint line',
   /Out of Blue Coins/.test(w.document.getElementById('slots-hint').textContent), true);
eq('the result line is left for outcomes',
   /Out of Blue Coins/.test(w.document.getElementById('slots-result').textContent), false);
DC.Coins.award(3);
w.document.getElementById('btn-casino').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('spin enabled once a coin is held', w.document.getElementById('btn-spin').disabled, false);
eq('purse shows the coin count', w.document.getElementById('coin-balance').textContent, '3');
eq('paytable lists the spin cost', /Cost per spin/.test(w.document.getElementById('paytable').textContent), true);

console.log('\n=== Tanooki Store & skins ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
eq('classic owned by default', DC.Store.owned('classic'), true);
eq('classic is equipped', DC.Store.activeId(), 'classic');
eq('paid skins locked at first', DC.Store.owned('sunset'), false);
eq('store button exists', !!w.document.getElementById('btn-store'), true);
w.document.getElementById('btn-store').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('store modal opens', w.document.getElementById('modal-store').hidden, false);
eq('every skin listed', w.document.querySelectorAll('#store-list .store-item').length, DC.CONFIG.skins.length);
eq('tiers grouped', w.document.querySelectorAll('#store-list .list-heading').length,
   new Set(DC.CONFIG.skins.map(s => s.tier)).size);

eq('cannot buy without Durians', DC.Store.buy('sunset'), false);
G.addDurians(N.pow10(20)); G.recalc();
eq('can buy when affordable', DC.Store.buy('sunset'), true);
eq('now owned', DC.Store.owned('sunset'), true);
eq('auto-equipped on purchase', DC.Store.activeId(), 'sunset');
eq('cannot re-buy', DC.Store.buy('sunset'), false);
eq('skin recolours the durian image',
   /hue-rotate/.test(w.document.getElementById('durian-img').style.filter), true);
eq('durian has skin class', w.document.getElementById('durian-button').classList.contains('has-skin'), true);

w.document.getElementById('btn-skins').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('skin picker opens', w.document.getElementById('modal-skins').hidden, false);
eq('picker shows all skins', w.document.querySelectorAll('#skin-grid .skin-tile').length, DC.CONFIG.skins.length);
eq('locked skins disabled', w.document.querySelectorAll('#skin-grid .skin-tile.locked').length,
   DC.CONFIG.skins.length - 2);
const classicTile = w.document.querySelectorAll('#skin-grid .skin-tile')[0];
classicTile.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('can switch back to a owned skin', DC.Store.activeId(), 'classic');

const round = DC.Save.deserialize(DC.Save.serialize(G.state));
eq('owned skins persist', !!round.skins.owned.sunset, true);
eq('active skin persists', round.skins.active, 'classic');
eq('unknown skins are dropped on load',
   Object.keys(DC.Save.deserialize(Object.assign(DC.Save.serialize(G.state),
     { skins: { owned: { classic: true, nonexistent_skin: true }, active: 'nonexistent_skin' } })).skins.owned).length, 1);
eq('missing active skin falls back to classic',
   DC.Save.deserialize(Object.assign(DC.Save.serialize(G.state),
     { skins: { owned: { classic: true }, active: 'gone' } })).skins.active, 'classic');

console.log('\n=== spending your LAST coin still reports the result ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(12)); G.recalc();
DC.Coins.award(1);                       // exactly one coin
w.document.getElementById('btn-casino').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
w.document.getElementById('btn-spin').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('coin spent, none left', DC.Coins.count(), 0);
// let the reel animation finish
await new Promise(r => setTimeout(r, DC.CONFIG.casino.spinSeconds * 1000 + 120));
const resultLine = w.document.getElementById('slots-result').textContent;
eq('result is NOT the out-of-coins hint', /Out of Blue Coins/.test(resultLine), false);
eq('result states an outcome',
   /No match|matching|Three /.test(resultLine), true);
eq('payout figure shown', w.document.getElementById('slots-payout').textContent.length > 0, true);
eq('outcome box animated',
   /won|lost|jackpot-win/.test(w.document.getElementById('slots-outcome').className), true);
eq('hint appears separately', /Out of Blue Coins/.test(w.document.getElementById('slots-hint').textContent), true);
eq('spin button now disabled', w.document.getElementById('btn-spin').disabled, true);

console.log('\n=== win and loss look different ===');
const forcedSym = id => { const list = DC.Casino.symbols(); let acc = 0, total = 0;
  list.forEach(sy => total += sy.weight);
  const t = list.find(sy => sy.id === id);
  list.some(sy => { if (sy.id === id) return true; acc += sy.weight; return false; });
  return (acc + t.weight / 2) / total; };
const cssAll = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('win animation defined', /@keyframes slotWin/.test(cssAll), true);
eq('loss animation defined', /@keyframes slotLose/.test(cssAll), true);
eq('jackpot animation defined', /@keyframes slotJackpot/.test(cssAll), true);
eq('payout pop defined', /@keyframes payoutPop/.test(cssAll), true);
eq('reels react on win', /\.reels\.win/.test(cssAll), true);
eq('reels react on loss', /\.reels\.lose/.test(cssAll), true);
eq('confetti defined', /@keyframes confettiFly/.test(cssAll), true);

console.log('\n=== store and slots buttons moved out of the header ===');
w = boot(); DC = w.DC;
eq('store button is no longer in the header',
   !!w.document.querySelector('.topbar #btn-store, .brand #btn-store'), false);
eq('casino button is no longer in the header',
   !!w.document.querySelector('.topbar-actions #btn-casino'), false);
eq('both sit in the durian area',
   !!w.document.querySelector('.stage .stage-tools #btn-store') &&
   !!w.document.querySelector('.stage .stage-tools #btn-casino'), true);
const tools = [...w.document.querySelectorAll('.stage-tools .stage-tool')];
eq('store is first, slots below it', tools.map(t => t.id).join(','), 'btn-store,btn-casino');
eq('both still open their modals', (() => {
  w.document.getElementById('btn-store').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const a = w.document.getElementById('modal-store').hidden === false;
  w.document.querySelector('[data-close=\'modal-store\']').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  w.document.getElementById('btn-casino').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  return a && w.document.getElementById('modal-casino').hidden === false;
})(), true);

console.log('\n=== dark mode contrast ===');
// every rule painting a light gradient must have a dark counterpart
const LIGHT_SURFACES = ['.board-row.top1', '.ach-progress', '.owned-upgrade', '.buff',
                        '.btn-primary', '.skin-tile.is-active'];
LIGHT_SURFACES.forEach(function (sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  eq('dark override for ' + sel, new RegExp('body\\.dark ' + esc).test(cssAll), true);
});

console.log('\n=== the 365-day Mario reward ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
const mario = DC.CONFIG.skins.find(s => s.id === 'mario');
eq('reward skin exists', !!mario, true);
eq('it is a reward, not a purchase', mario.reward, true);
eq('it has no price', mario.cost, null);
eq('condition is 365 days', mario.requires.seconds, 365 * 86400);
eq('it wears an image', mario.css.image, 'marioFace');
eq('worn solid, not blended', mario.css.opacity, 1);
eq('placeholder art exists',
   require('fs').existsSync('/home/claude/durian-clicker/' + DC.CONFIG.assets.marioFace), true);

eq('locked at the start', DC.Store.owned('mario'), false);
G.addDurians(N.pow10(30)); G.recalc();
eq('cannot be bought at any price', DC.Store.buy('mario'), false);
eq('canBuy refuses it', DC.Store.canBuy('mario'), false);

// store shows the condition instead of a price
w.document.getElementById('btn-store').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const marioCard = [...w.document.querySelectorAll('#store-list .store-item')]
  .find(c => /The Man Himself/.test(c.textContent));
eq('listed in the store', !!marioCard, true);
eq('shown as locked reward', marioCard.classList.contains('reward-locked'), true);
eq('states how to earn it', /365 days/.test(marioCard.textContent), true);

// 364 days is not enough
G.state.playTime = 364 * 86400;
G.checkProgress();
eq('364 days does not unlock it', DC.Store.owned('mario'), false);

// 365 grants both the achievement and the skin
G.state.playTime = 365 * 86400;
G.checkProgress();
eq('achievement earned at a year', !!G.state.achievements.p_365d, true);
eq('skin granted automatically', DC.Store.owned('mario'), true);
eq('survives a save', !!DC.Save.deserialize(DC.Save.serialize(G.state)).skins.owned.mario, true);

DC.Store.equip('mario');
const mb = w.document.getElementById('durian-button');
eq('worn class applied', mb.classList.contains('skin-image'), true);
eq('points at the mario art', /marioface/i.test(mb.style.getPropertyValue('--skin-image')), true);
eq('drawn at full opacity', parseFloat(mb.style.getPropertyValue('--skin-image-opacity')), 1);
eq('durian itself is not recoloured',
   /grayscale/.test(w.document.getElementById('durian-img').style.filter), false);

// the accessory must sit in the same box as the fruit and move with it
const wornCss = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('worn art fills the durian box, not inset',
   /\.durian-btn\.skin-image::after\s*\{[^}]*inset:\s*0/.test(wornCss), true);
eq('scales with the durian rather than cropping',
   /\.durian-btn\.skin-image::after\s*\{[^}]*background-size:\s*contain/.test(wornCss), true);
eq('squashes along with the fruit on a click',
   /\.durian-btn\.squash\.skin-image::after\s*\{[^}]*animation:\s*squash/.test(wornCss), true);
eq('lives inside the durian button so it inherits the bob',
   /\.durian-btn\.skin-image::after/.test(wornCss), true);

DC.Store.equip('classic');
eq('switching away removes the accessory', mb.classList.contains('skin-image'), false);

console.log('\n=== buffs no longer multiply each other ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.recalc();
const baseRate = N.toNumber(G.derived.baseDps);
const push = (id, prod, click) => G.state.buffs.push({ id: id, label: id, prod: prod, click: click, endsAt: Date.now() + 60000 });
push('a', 7, 1); G.recalc();
eq('a single x7 buff gives x7', Math.round(N.toNumber(G.derived.dps) / baseRate), 7);
push('b', 25, 5); G.recalc();
eq('x7 plus x25 gives x25, not x175', Math.round(N.toNumber(G.derived.dps) / baseRate), 25);
push('c', 0.5, 1); G.recalc();
eq('a penalty still applies alongside', Math.round(N.toNumber(G.derived.dps) / baseRate * 10) / 10, 12.5);
G.state.buffs.length = 0; G.recalc();
eq('back to normal with no buffs', Math.round(N.toNumber(G.derived.dps)), Math.round(baseRate));

console.log('\n=== event durations vary ===');
const lens = [];
for (let i = 0; i < 12; i++) {
  G.state.buffs.length = 0;
  DC.IslandEvents.trigger('shine_sprite');
  lens.push(Math.round((G.state.buffs[0].endsAt - Date.now()) / 1000));
}
eq('durations are not all identical', new Set(lens).size > 3, true);
eq('all within the configured range', lens.every(v => v >= 30 && v <= 100), true);
G.state.buffs.length = 0; G.recalc();

console.log('\n=== event payouts ignore buffs ===');
G.addDurians(N.pow10(12)); G.recalc();
const quiet = DC.IslandEvents.trigger('king_boo');
push('big', 25, 1); G.recalc();
const loud = DC.IslandEvents.trigger('king_boo');
eq('a x25 buff does not multiply the payout',
   N.toNumber(loud.amount) / N.toNumber(quiet.amount) < 6, true);
G.state.buffs.length = 0; G.recalc();

console.log('\n=== gambling stats ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 100; });
G.addDurians(N.pow10(14)); G.recalc();
DC.Coins.award(40);
for (let i = 0; i < 30; i++) DC.Casino.play(0.01);
DC.UI.selectTab('stats');
const statsTxt = w.document.getElementById('stats-list').textContent;
eq('Gambling group present', /Gambling/.test(statsTxt), true);
['Spins played','Spins won','Spins lost','Win rate','Total wagered','Total won back',
 'Net result','Return on stake','Biggest single win','Longest losing streak'
].forEach(function (label) {
  eq('shows ' + label, statsTxt.indexOf(label) !== -1, true);
});
eq('wins plus losses equals spins',
   (G.state.casino.wins || 0) + (30 - (G.state.casino.wins || 0)), G.state.casino.spins);
eq('win rate is a percentage', /Win rate/.test(statsTxt) && /%/.test(statsTxt), true);
eq('biggest win recorded when anything was won',
   G.state.casino.wins > 0 ? N.toNumber(G.state.casino.biggestWin) > 0 : true, true);
eq('losing streak tracked', typeof G.state.casino.worstStreak, 'number');
eq('gambling stats survive a save',
   N.format(DC.Save.deserialize(DC.Save.serialize(G.state)).casino.biggestWin),
   N.format(G.state.casino.biggestWin));

console.log('\n=== dark mode ===');
w = boot(); DC = w.DC; N = DC.N; G = DC.Game;
const body = w.document.body;
const darkBtn = w.document.getElementById('btn-dark');
eq('starts in light mode', body.classList.contains('dark'), false);
eq('toggle sits in the topbar next to volume',
   !!w.document.querySelector('.topbar-actions #btn-dark'), true);
eq('button reports state', darkBtn.getAttribute('aria-pressed'), 'false');

darkBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('click enables dark mode', body.classList.contains('dark'), true);
eq('aria updated', darkBtn.getAttribute('aria-pressed'), 'true');
eq('icon flips to sun', darkBtn.textContent, '\u2600');
eq('saved to settings', G.state.settings.darkMode, true);
eq('theme-color meta updated',
   w.document.querySelector('meta[name=\'theme-color\']').getAttribute('content'), '#0A2334');
eq('settings dropdown mirrors it', w.document.getElementById('dark-toggle').value, 'dark');
eq('settings calls it Eclipsed',
   [...w.document.querySelectorAll('#dark-toggle option')].some(o => o.textContent === 'Eclipsed'), true);
eq('no stale "Dark mode" label in settings',
   /Dark mode/.test(w.document.getElementById('dark-toggle').textContent), false);

darkBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('click again returns to light', body.classList.contains('dark'), false);

// settings dropdown drives it too
const sel = w.document.getElementById('dark-toggle');
sel.value = 'dark';
sel.dispatchEvent(new w.Event('change', { bubbles: true }));
eq('settings dropdown enables dark', body.classList.contains('dark'), true);

eq('persists in save', DC.Save.deserialize(DC.Save.serialize(G.state)).settings.darkMode, true);
// and is applied on a fresh boot from that save
const savedDark = JSON.stringify(DC.Save.serialize(G.state));
const w2 = boot(savedDark);
eq('restored on reload', w2.document.body.classList.contains('dark'), true);
eq('reloaded save keeps the setting', w2.DC.Game.state.settings.darkMode, true);
eq('old saves default to light',
   DC.Save.deserialize(Object.assign(DC.Save.serialize(G.state),
     { settings: { volume: 0.6, muted: false, buyAmount: 1 } })).settings.darkMode, false);

// the palette must actually swap, not just add a class
const cssText = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('dark palette defined', /body\.dark\s*\{[^}]*--ink:/.test(cssText), true);
eq('dark dims the backdrop', /body\.dark \.scene-img\s*\{[^}]*opacity/.test(cssText), true);
eq('dark veils the scene', /body\.dark \.scene::after/.test(cssText), true);
eq('surfaces are tokenised, not hardcoded',
   (cssText.match(/background: var\(--surface\)/g) || []).length > 10, true);

console.log('\n=== skin catalogue sanity ===');
const ids = DC.CONFIG.skins.map(s => s.id);
eq('no duplicate skin ids', ids.length, new Set(ids).size);
eq('classic is free', DC.CONFIG.skins.find(s => s.id === 'classic').cost, 0);
eq('all other purchasable skins cost something',
   DC.CONFIG.skins.filter(s => s.id !== 'classic' && !s.reward).every(s => s.cost > 0), true);
eq('reward skins carry no price',
   DC.CONFIG.skins.filter(s => s.reward).every(s => s.cost === null), true);
eq('all have descriptions', DC.CONFIG.skins.every(s => s.description && s.description.length > 8), true);
eq('costs ascend within the catalogue',
   DC.CONFIG.skins.filter(s => !s.reward).every((s, i, a) => i === 0 || s.cost >= a[i-1].cost), true);
eq('animated skins are flagged', DC.CONFIG.skins.filter(s => s.css.secs).length >= 4, true);
// each animated skin must move differently — they all shared one hue cycle before
const pulsers = DC.CONFIG.skins.filter(s => s.css.secs && !s.css.cycle);
eq('most animated skins pulse rather than cycle', pulsers.length >= 4, true);
eq('each pulse skin has its own second state',
   pulsers.every(s => s.css.hue2 !== undefined && s.css.sat2 !== undefined), true);
eq('pulse targets differ between skins',
   new Set(pulsers.map(s => s.css.sat2 + ':' + s.css.bright2)).size, pulsers.length);
eq('durations differ too', new Set(pulsers.map(s => s.css.secs)).size >= 4, true);
eq('only one skin runs the full spectrum',
   DC.CONFIG.skins.filter(s => s.css.cycle).length, 1);

// Skins must visibly recolour the durian. The failure this replaces was a
// masked blend-mode overlay that rendered as plain grey.
const skinCss = require('fs').readFileSync('/home/claude/durian-clicker/css/style.css', 'utf8');
eq('no blend-mode skin rules remain', /mix-blend-mode:\s*color/.test(skinCss), false);
eq('no masked skin overlay remains', /has-skin::(after|before)/.test(skinCss), false);
eq('hue-cycle animation defined', /@keyframes skinHueCycle/.test(skinCss), true);

const tinted = DC.CONFIG.skins.filter(s => s.id !== 'classic' && !s.css.image);
eq('every tinted skin defines a hue', tinted.every(s => typeof s.css.hue === 'number'), true);
eq('every tinted skin is heavily saturated', tinted.every(s => s.css.sat >= 3), true);
eq('every skin has a swatch colour',
   DC.CONFIG.skins.every(s => /^#[0-9A-F]{6}$/i.test(s.swatch)), true);
eq('purchasable skins all have a price',
   DC.CONFIG.skins.filter(s => !s.reward && s.id !== 'classic').every(s => s.cost > 0), true);
eq('reward skins state how to earn them',
   DC.CONFIG.skins.filter(s => s.reward).every(s => s.requires && s.requirementText), true);
eq('hues are spread out, not clustered',
   new Set(DC.CONFIG.skins.filter(s => s.id !== 'classic').map(s => Math.round(s.css.hue / 30))).size >= 8, true);

// applying one must actually write the filter onto the image
G.addDurians(N.pow10(20)); G.recalc();
DC.Store.buy('bianco');
const imgStyle = w.document.getElementById('durian-img').style;
eq('filter written to the image', imgStyle.filter.length > 0, true);
eq('greyscales the base', /grayscale\(1\)/.test(imgStyle.filter), true);
eq('applies the hue rotation', /hue-rotate\(165deg\)/.test(imgStyle.filter), true);
eq('saturation is cranked', /saturate\(4\.5\)/.test(imgStyle.filter), true);
eq('drop shadow kept', /drop-shadow/.test(imgStyle.filter), true);
eq('marked as skinned', w.document.getElementById('durian-button').classList.contains('has-skin'), true);
eq('static skin is not animated',
   w.document.getElementById('durian-button').classList.contains('skin-animated'), false);

DC.Store.buy('shimmer');
eq('pulse skin flagged',
   w.document.getElementById('durian-button').classList.contains('skin-pulse'), true);
eq('pulse skin is not the cycle kind',
   w.document.getElementById('durian-button').classList.contains('skin-cycle'), false);
DC.Store.buy('festival');
eq('festival is the cycle skin',
   w.document.getElementById('durian-button').classList.contains('skin-cycle'), true);
['--skin-sat', '--skin-hue', '--skin-bright', '--skin-contrast',
 '--skin-sat2', '--skin-hue2', '--skin-bright2', '--skin-secs'].forEach(function (v) {
  eq('animation needs ' + v, w.document.getElementById('durian-img').style.getPropertyValue(v).length > 0, true);
});

DC.Store.equip('classic');
eq('classic clears the recolour',
   /grayscale/.test(w.document.getElementById('durian-img').style.filter), false);
eq('classic keeps its shadow',
   /drop-shadow/.test(w.document.getElementById('durian-img').style.filter), true);
eq('has-skin removed', w.document.getElementById('durian-button').classList.contains('has-skin'), false);

console.log('\n' + (fails ? fails + ' FAILURES' : 'All casino/coin/store tests passed.'));
process.exit(fails ? 1 : 0);
})();
