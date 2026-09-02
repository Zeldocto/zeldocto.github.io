/* Purchasable backgrounds: buying, equipping, persistence, and the store UI. */
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

let w = boot(), DC = w.DC, N = DC.N, G = DC.Game;

console.log('=== the catalogue ===');
const list = DC.CONFIG.backgrounds;
eq('six to buy plus the default', list.length, 7);
eq('ids are unique', new Set(list.map(b => b.id)).size, list.length);
eq('names are unique', new Set(list.map(b => b.name)).size, list.length);
eq('default is first and free', list[0].id + ':' + list[0].cost, 'default:0');
eq('named as intended',
   list.slice(1).map(b => b.name).join(', '),
   "Toybox Dreams, Mario VR, Yoshi's Isle, Pinna Dream, Sirena Sunset, Endgame");
eq('every one has art', list.every(b => b.image), true);
eq('and the art exists on disk', list.every(b => fs.existsSync(ROOT + b.image)), true);
const purchasable = list.filter(b => !b.reward);
eq('purchasable costs ascend',
   purchasable.every((b, i) => i === 0 || b.cost >= purchasable[i-1].cost), true);

console.log('\n=== owning and equipping ===');
eq('default is owned from the start', DC.Store.backgroundOwned('default'), true);
eq('the rest are not', DC.Store.backgroundOwned('toybox'), false);
eq('cannot buy what you cannot afford', DC.Store.buyBackground('toybox'), false);
G.addDurians(N.pow10(20)); G.recalc();
const before = N.toNumber(G.state.durians);
eq('buying works', DC.Store.buyBackground('toybox'), true);
eq('and it was paid for', N.toNumber(G.state.durians) < before, true);
eq('now owned', DC.Store.backgroundOwned('toybox'), true);
eq('and equipped on purchase', DC.Store.activeBackgroundId(), 'toybox');
eq('buying twice is refused', DC.Store.buyBackground('toybox'), false);
DC.Store.buyBackground('mariovr');
eq('switching back is free', DC.Store.equipBackground('toybox'), true);
eq('equipped', DC.Store.activeBackgroundId(), 'toybox');
eq('cannot equip what you do not own', DC.Store.equipBackground('endgame'), false);
eq('still on toybox', DC.Store.activeBackgroundId(), 'toybox');

console.log('\n=== it actually shows on screen ===');
const scene = w.document.getElementById('scene-img');
eq('scene uses the equipped art',
   scene.style.backgroundImage.indexOf('bg-toybox.png') !== -1, true);
DC.Store.equipBackground('mariovr');
eq('and follows a change',
   scene.style.backgroundImage.indexOf('bg-mariovr.png') !== -1, true);
DC.Store.equipBackground('default');
eq('default falls back to the original art',
   scene.style.backgroundImage.indexOf('placeholder-background') !== -1, true);

console.log('\n=== the store section ===');
DC.Store.equipBackground('mariovr');
w.document.getElementById('btn-store').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('two store tabs', w.document.querySelectorAll('.store-tab').length, 2);
eq('skins shown first',
   w.document.querySelector('.store-tab.is-active').dataset.store, 'skins');
w.document.querySelector('.store-tab[data-store="backgrounds"]')
  .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('switching sections works',
   w.document.querySelector('.store-tab.is-active').dataset.store, 'backgrounds');
const cards = [...w.document.querySelectorAll('#store-list .store-item')];
eq('a card per background', cards.length, list.length);
eq('every card has a preview',
   w.document.querySelectorAll('#store-list .bg-thumb').length, list.length);
eq('the equipped one says so',
   cards.some(c => /Equipped/.test(c.textContent)), true);
eq('owned ones say Owned', cards.some(c => /Owned/.test(c.textContent)), true);
eq('and the counter counts backgrounds',
   w.document.getElementById('store-owned').textContent, '3/' + list.length);
// buying from the card
const buyable = cards.find(c => c.classList.contains('affordable'));
buyable.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
eq('clicking an affordable card buys it', DC.Store.backgroundsOwnedCount() > 3, true);

console.log('\n=== Endgame is earned, not sold ===');
{
  const we = boot(); const De = we.DC, Ge = De.Game, Ne = De.N;
  const endgame = De.CONFIG.backgrounds.find(b => b.id === 'endgame');
  eq('marked as a reward', endgame.reward, true);
  eq('has no price', endgame.cost, null);
  eq('needs seven days', endgame.requires.seconds, 604800);
  eq('and says so', endgame.requirementText, 'Play for 7 days');

  Ge.addDurians(Ne.pow10(30)); Ge.recalc();
  eq('cannot be bought at any price', De.Store.buyBackground('endgame'), false);
  eq('canBuy refuses it', De.Store.canBuyBackground('endgame'), false);
  eq('not owned yet', De.Store.backgroundOwned('endgame'), false);

  Ge.state.playTime = 604800 - 1;
  Ge.checkProgress();
  eq('a second short is not enough', De.Store.backgroundOwned('endgame'), false);

  Ge.state.playTime = 604800;
  Ge.checkProgress();
  eq('granted at seven days', De.Store.backgroundOwned('endgame'), true);
  eq('and can then be equipped', De.Store.equipBackground('endgame'), true);
  eq('showing on screen',
     we.document.getElementById('scene-img').style.backgroundImage.indexOf('bg-endgame') !== -1, true);
  De.Save.save(true);
  eq('the unlock persists',
     boot(we.localStorage.getItem('durianClicker.save.v1')).DC.Store.backgroundOwned('endgame'), true);

  // the store shows how to get it rather than a price
  const wl = boot();
  wl.document.getElementById('btn-store').dispatchEvent(new wl.MouseEvent('click', { bubbles: true }));
  wl.document.querySelector('.store-tab[data-store="backgrounds"]')
    .dispatchEvent(new wl.MouseEvent('click', { bubbles: true }));
  const locked = [...wl.document.querySelectorAll('#store-list .store-item')]
    .find(c => /Endgame/.test(c.textContent));
  eq('listed as locked', locked.classList.contains('reward-locked'), true);
  eq('states how to earn it', /Play for 7 days/.test(locked.textContent), true);
  eq('and shows no price', /\d,\d/.test(locked.textContent), false);
}

console.log('\n=== it survives a save ===');
DC.Store.equipBackground('toybox');
DC.Save.save(true);
const w2 = boot(w.localStorage.getItem('durianClicker.save.v1'));
eq('purchases persist', w2.DC.Store.backgroundOwned('mariovr'), true);
eq('the equipped one persists', w2.DC.Store.activeBackgroundId(), 'toybox');
eq('and it is on screen after a reload',
   w2.document.getElementById('scene-img').style.backgroundImage.indexOf('bg-toybox') !== -1, true);
eq('buying a background does not flag the save',
   String(w2.DC.Game.state.integrity), 'undefined');

console.log('\n=== an unknown background in a save is dropped ===');
{
  const raw = JSON.parse(w.localStorage.getItem('durianClicker.save.v1'));
  raw.backgrounds.owned.not_a_real_one = true;
  raw.backgrounds.active = 'not_a_real_one';
  const w3 = boot(JSON.stringify(raw));
  eq('unknown id is not owned', w3.DC.Store.backgroundOwned('not_a_real_one'), false);
  eq('and it falls back to default', w3.DC.Store.activeBackgroundId(), 'default');
}

console.log('\n=== skins are untouched ===');
eq('skin catalogue intact', DC.CONFIG.skins.length, 20);
eq('skins still equip independently', (() => {
  const w4 = boot();
  w4.DC.Game.addDurians(w4.DC.N.pow10(20)); w4.DC.Game.recalc();
  w4.DC.Store.buy('sunset');
  w4.DC.Store.buyBackground('toybox');
  return w4.DC.Store.activeId() === 'sunset' && w4.DC.Store.activeBackgroundId() === 'toybox';
})(), true);

console.log('\n' + (fails ? fails + ' FAILURES' : 'Backgrounds working.'));
process.exit(fails ? 1 : 0);
