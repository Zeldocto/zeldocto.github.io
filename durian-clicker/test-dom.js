const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = '/home/claude/durian-clicker/';

const html = fs.readFileSync(path + 'index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://zeldocto.github.io/durian-clicker/' });
const { window } = dom;

// Minimal shims jsdom lacks.
window.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
window.requestAnimationFrame = () => 0;
window.HTMLMediaElement && (window.HTMLMediaElement.prototype.play = () => Promise.resolve());
window.navigator.clipboard = { writeText: () => Promise.resolve() };
window.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(''), json: () => Promise.resolve([]) });
window.document.execCommand = () => true;

let errors = [];
window.addEventListener('error', e => errors.push(e.message));
const origError = console.error;
console.error = (...a) => { errors.push(a.join(' ')); origError(...a); };

['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js',
 'numbers.js','game.js','workers.js','upgrades.js','achievements.js',
 'save.js','offline.js','events.js','updates.js','coins.js','casino.js','store.js','audio.js','leaderboard.js','ui.js','debug.js','main.js']
  .forEach(f => window.eval(fs.readFileSync(path + 'js/' + f, 'utf8')));

// jsdom finishes parsing before we eval, so fire the boot event ourselves.
window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

const doc = window.document;
const DC = window.DC, N = DC.N, G = DC.Game;
let fails = 0;
const eq = (label, got, want) => {
  if (String(got) !== String(want)) { fails++; console.log('FAIL', label, '| got', got, '| want', want); }
  else console.log('  ok  ', label, '=', got);
};

console.log('--- boot ---');
eq('durian image applied', doc.getElementById('durian-img').getAttribute('src'), 'assets/placeholder-durian.png');
eq('background applied', /placeholder-background/.test(doc.getElementById('scene-img').style.backgroundImage), true);
eq('worker rows rendered', doc.querySelectorAll('#worker-list .item').length, 2); // pianta + locked noki teaser
eq('locked teaser text', /Unlocks at/.test(doc.querySelector('#worker-list .item.locked .item-lock').textContent), true);
eq('achievement tiles', doc.querySelectorAll('#achievement-list .ach').length, DC.CONFIG.achievements.length);
eq('counter shows 0', doc.getElementById('durian-count').textContent, '0');
eq('click power shows 1', doc.getElementById('click-power').textContent, '1');

console.log('--- shine links home ---');
const shineLink = doc.getElementById('brand-shine-link');
eq('shine is wrapped in a link', !!shineLink, true);
eq('points at the site root', shineLink.getAttribute('href'), 'https://zeldocto.github.io/');
eq('still shows the shine art',
   /placeholder-shine/.test(shineLink.querySelector('img').getAttribute('src')), true);
eq('link is labelled for screen readers',
   shineLink.querySelector('img').getAttribute('alt').length > 0, true);
eq('not hidden from assistive tech',
   shineLink.querySelector('img').hasAttribute('aria-hidden'), false);

console.log('--- clicking ---');
const durian = doc.getElementById('durian-button');
for (let i = 0; i < 5; i++) {
  durian.dispatchEvent(new window.PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
}
eq('5 clicks counted', G.state.totalClicks, 5);
eq('counter updated', doc.getElementById('durian-count').textContent, '5');
eq('float text spawned', doc.querySelectorAll('#fx-layer .float-text').length > 0, true);
eq('particles spawned', doc.querySelectorAll('#fx-layer .particle').length > 0, true);

console.log('--- buying via the DOM ---');
G.addDurians(500); G.recalc(); G.checkProgress(); DC.Events.emit('render');
const piantaRow = doc.querySelectorAll('#worker-list .item')[0];
eq('row marked affordable', piantaRow.classList.contains('affordable'), true);
piantaRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('pianta hired via click', G.state.workers.pianta, 1);
eq('dps line updated', /per second/.test(doc.getElementById('dps-line').textContent), true);

// buy amount toggle
doc.querySelector('.amt[data-amount="10"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('buy amount set to 10', G.state.settings.buyAmount, 10);
eq('qty label shows bulk', /buy 10/.test(doc.querySelector('#worker-list .item .item-qty').textContent), true);
doc.querySelector('.amt[data-amount="max"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('buy amount set to max', G.state.settings.buyAmount, 'max');
doc.querySelector('.amt[data-amount="1"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('--- unlock flow ---');
G.addDurians(5000); G.checkProgress(); DC.Events.emit('render');
eq('noki now unlocked', !!G.state.unlocked.noki, true);
eq('noki row visible', doc.querySelectorAll('#worker-list .item').length >= 3, true);
eq('toast appeared', doc.querySelectorAll('#toasts .toast').length > 0, true);

console.log('--- upgrades tab ---');
for (let i = 0; i < 20; i++) durian.dispatchEvent(new window.PointerEvent('pointerdown', { clientX: 90, clientY: 90, bubbles: true }));
G.checkProgress(); DC.Events.emit('render');
eq('gloves unlocked after 15 clicks', !!G.state.unlocked.gloves, true);
DC.UI.selectTab('upgrades');
eq('upgrades page visible', doc.getElementById('page-upgrades').hidden, false);
const upRow = doc.querySelector('#upgrade-list .item:not(.locked)');
eq('an upgrade is listed', !!upRow, true);
if (upRow) {
  upRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  eq('upgrade purchased', Object.keys(G.state.upgrades).length >= 1, true);
  eq('moved to owned grid', doc.querySelectorAll('#owned-upgrades .owned-upgrade').length >= 1, true);
}

console.log('--- stats tab ---');
DC.UI.selectTab('stats');
eq('stats groups rendered', doc.querySelectorAll('#stats-list .stats-group').length, 7);
eq('island events group present', /Island events/.test(doc.getElementById('stats-list').textContent), true);
eq('gambling group present', /Gambling/.test(doc.getElementById('stats-list').textContent), true);
eq('stats has play time', /Play time/.test(doc.getElementById('stats-list').textContent), true);

console.log('--- save round trip ---');
DC.Save.save(true);
const code = DC.Save.exportString();
eq('export produced a code', code.length > 40, true);
const snapshot = {
  durians: N.format(G.state.durians),
  pianta: G.state.workers.pianta,
  clicks: G.state.totalClicks,
  upgrades: Object.keys(G.state.upgrades).length,
  achievements: Object.keys(G.state.achievements).length
};
G.reset(true);
eq('reset cleared durians', N.format(G.state.durians), '0');
eq('import succeeded', DC.Save.importString(code), true);
eq('durians restored', N.format(G.state.durians), snapshot.durians);
eq('piantas restored', G.state.workers.pianta, snapshot.pianta);
eq('clicks restored', G.state.totalClicks, snapshot.clicks);
eq('upgrades restored', Object.keys(G.state.upgrades).length, snapshot.upgrades);
eq('achievements restored', Object.keys(G.state.achievements).length, snapshot.achievements);

console.log('--- reload from localStorage ---');
const before = N.format(G.state.durians);
DC.Save.save(true);
G.reset(true);
DC.Save.load();
eq('localStorage reload', N.format(G.state.durians), before);

console.log('--- offline popup ---');
DC.UI.rebuildAll();
DC.Offline.simulate(7200);
eq('offline modal shown', doc.getElementById('modal-offline').hidden, false);
eq('offline amount rendered', /Durians/.test(doc.getElementById('offline-amount').textContent), true);
eq('offline duration text', /2h/.test(doc.getElementById('offline-text').textContent), true);
const beforeCollect = N.toNumber(G.state.durians);
doc.getElementById('offline-collect').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('offline collected', N.toNumber(G.state.durians) > beforeCollect, true);
eq('offline modal closed', doc.getElementById('modal-offline').hidden, true);
eq('24h cap message', (() => { DC.Offline.simulate(60*3600); return /capped/.test(doc.getElementById('offline-sub').textContent); })(), true);
doc.getElementById('offline-collect').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

console.log('--- settings + debug ---');
doc.getElementById('btn-settings').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('settings modal opens', doc.getElementById('modal-settings').hidden, false);
doc.getElementById('btn-export').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('save box filled', doc.getElementById('save-box').value.length > 40, true);
doc.getElementById('btn-reset').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('reset asks for confirmation', doc.getElementById('modal-confirm').hidden, false);
doc.getElementById('confirm-cancel').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('cancel keeps progress', N.toNumber(G.state.durians) > 0, true);

// Debug is disabled for the release build, so the panel must not exist at all.
eq('debug panel absent in release build', doc.getElementById('debug-panel'), null);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true }));
eq('shortcut does nothing', doc.getElementById('debug-panel'), null);

// ...but re-enabling it in config must still work for development.
DC.CONFIG.debugEnabled = true;

console.log('--- mute ---');
doc.getElementById('btn-mute').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('mute toggles', DC.Audio.isMuted(), true);
eq('mute icon updates', doc.getElementById('btn-mute').textContent, '🔇');
doc.getElementById('btn-mute').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

eq('honest play is not flagged', String(G.integrity()), 'null');

console.log('--- leaderboard ---');
const LB = DC.Leaderboard;
// config.js ships pre-filled with the live Supabase project; exercise the
// provider-agnostic UI against the local backend.
DC.CONFIG.leaderboard.provider = 'local';
eq('local provider selected', LB.isOnline(), false);
eq('player id generated', typeof G.state.player.id === 'string' && G.state.player.id.length > 5, true);
eq('public id differs from row key', G.state.player.publicId !== G.state.player.id, true);
eq('legacy save gets a public id', (() => {
  const legacy = DC.Save.serialize(G.state); delete legacy.player.publicId;
  return !!DC.Save.deserialize(legacy).player.publicId;
})(), true);
eq('no name yet', LB.getName(), '');
DC.UI.selectTab('leaderboard');
eq('board tab visible', doc.getElementById('page-leaderboard').hidden, false);
eq('board switch rendered', doc.querySelectorAll('#board-switch button').length, DC.CONFIG.leaderboard.boards.length);
eq('submit disabled without name', doc.getElementById('btn-board-submit').disabled, true);
eq('local mode notice shown', /Local demo mode/.test(doc.getElementById('board-note').textContent), true);

// name flow
doc.getElementById('btn-board-name').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('name modal opens', doc.getElementById('modal-name').hidden, false);
doc.getElementById('name-input').value = 'z';
doc.getElementById('name-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('rejects one-character name', /two characters/.test(doc.getElementById('name-error').textContent), true);
doc.getElementById('name-input').value = '  zeldocto  ';
doc.getElementById('name-save').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
eq('name trimmed and saved', LB.getName(), 'zeldocto');
eq('name modal closed', doc.getElementById('modal-name').hidden, true);
eq('name persists in save', DC.Save.deserialize(DC.Save.serialize(G.state)).player.name, 'zeldocto');

(async () => {
  await LB.submit({ force: true, ignoreThrottle: true });
  await LB.load();
  eq('entry appears on board', LB.state.entries.length, 1);
  eq('your row flagged', LB.state.entries[0].isYou, true);
  eq('rank computed', LB.state.yourRank, 1);
  eq('row rendered', doc.querySelectorAll('#board-list .board-row').length, 1);
  eq('row marked as you', doc.querySelector('#board-list .board-row').classList.contains('is-you'), true);
  eq('score displayed', /\d/.test(doc.querySelector('.board-score').textContent), true);
  eq('name html-escaped', !/<script/.test(doc.getElementById('board-list').innerHTML), true);

  // big numbers survive the round trip as log + display
  G.state.totalEarned = N.pow10(120);
  await LB.submit({ force: true, ignoreThrottle: true });
  await LB.load();
  eq('huge score sorts by log10', Math.round(LB.state.entries[0].total_log), 120);
  eq('huge score display kept', LB.state.entries[0].total_display, N.format(N.pow10(120)));
  eq('still one row per player', LB.state.entries.length, 1);

  // throttle
  const r = await LB.submit({ force: true });
  eq('throttles rapid submits', r.reason, 'throttled');

  // second board sorts independently
  await LB.load('dps');
  eq('switched board', LB.state.board, 'dps');
  eq('dps board renders', doc.querySelectorAll('#board-list .board-row').length, 1);

  // XSS attempt
  LB.setName('<img src=x onerror=alert(1)>');
  await LB.submit({ force: true, ignoreThrottle: true });
  await LB.load('total');
  eq('script name escaped in DOM', doc.querySelectorAll('#board-list img').length, 0);
  eq('escaped name shown as text', /img src=x/.test(doc.querySelector('.board-player-name').textContent), true);
  LB.setName('zeldocto');

  console.log('\nconsole errors:', errors.length ? errors : 'none');
  if (errors.length) fails += errors.length;
  console.log(fails ? `${fails} FAILURES` : 'All DOM tests passed.');
  process.exit(fails ? 1 : 0);
})();
