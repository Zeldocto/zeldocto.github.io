/* Boots the game with modules deliberately missing, proving a partial upload
 * degrades gracefully instead of blanking the entire page. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const p = '/home/claude/durian-clicker/';
const ALL = ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js',
  'content/skins.js','content/backgrounds.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js',
  'save.js','offline.js','events.js','updates.js','coins.js','casino.js','store.js',
  'audio.js','leaderboard.js','ui.js','debug.js','main.js'];

function boot(skip) {
  skip = skip || [];
  const dom = new JSDOM(fs.readFileSync(p + 'index.html', 'utf8'),
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://x.io/' });
  const w = dom.window;
  w.Audio = class { constructor(){this.volume=1;} addEventListener(){} play(){return Promise.resolve();} pause(){} };
  w.requestAnimationFrame = () => 0;
  w.fetch = () => Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) });
  const thrown = [];
  ALL.filter(f => !skip.includes(f)).forEach(f => {
    try { w.eval(fs.readFileSync(p + 'js/' + f, 'utf8')); } catch (e) { thrown.push(f); }
  });
  try { w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true })); }
  catch (e) { thrown.push('boot:' + e.message); }
  return { w, thrown };
}

let fails = 0;
const eq = (l, g, e) => { if (String(g) !== String(e)) { fails++; console.log('FAIL', l, '| got', g, '| want', e); } else console.log('  ok  ', l, '=', g); };
const rows = w => w.document.querySelectorAll('#worker-list .item').length;

console.log('=== full deploy ===');
let r = boot();
eq('no errors', r.thrown.length, 0);
eq('crew renders', rows(r.w) > 0, true);
eq('no boot error shown', r.w.document.querySelectorAll('.boot-error').length, 0);

console.log('\n=== the failure that blanked the page: store.js missing ===');
r = boot(['store.js']);
eq('boot does not throw to the caller', r.thrown.filter(x => x.startsWith('boot:')).length, 0);
eq('crew STILL renders', rows(r.w) > 0, true);
eq('counters still work', r.w.document.getElementById('durian-count').textContent, '0');
eq('shop tabs still work', r.w.document.querySelectorAll('.tab').length > 0, true);
eq('store button hidden, not broken', r.w.document.getElementById('btn-store').hidden, true);
eq('skin button hidden too', r.w.document.getElementById('btn-skins').hidden, true);

console.log('\n=== other optional modules missing ===');
[['coins.js', 'coin-chip'], ['casino.js', 'btn-casino']].forEach(([file, hiddenId]) => {
  const rr = boot([file]);
  eq(file + ': game still renders', rows(rr.w) > 0, true);
  eq(file + ': control hidden', rr.w.document.getElementById(hiddenId).hidden, true);
});
r = boot(['events.js']);
eq('events.js missing: game still renders', rows(r.w) > 0, true);
r = boot(['updates.js', 'leaderboard.js', 'debug.js']);
eq('three optional modules missing: still renders', rows(r.w) > 0, true);

console.log('\n=== a REQUIRED module missing is reported, not silent ===');
r = boot(['workers.js']);
const err = r.w.document.querySelector('.boot-error');
eq('boot error panel shown', !!err, true);
eq('names the missing file', /js\/workers\.js/.test(err.textContent), true);
eq('reassures about the save', /progress has not been touched/.test(err.textContent), true);

r = boot(['numbers.js']);
eq('numbers.js missing is reported', !!r.w.document.querySelector('.boot-error'), true);

console.log('\n=== skins are visible ===');
r = boot();
const DC = r.w.DC, N = DC.N;
DC.Game.addDurians(N.pow10(20)); DC.Game.recalc();
DC.Store.buy('bianco');
const f = r.w.document.getElementById('durian-img').style.filter;
eq('greyscales the base', /grayscale\(1\)/.test(f), true);
eq('rotates the hue', /hue-rotate\(165deg\)/.test(f), true);
eq('saturation cranked', /saturate\(4\.5\)/.test(f), true);
eq('shadow preserved', /drop-shadow/.test(f), true);
DC.Store.equip('classic');
eq('classic is unfiltered', /grayscale/.test(r.w.document.getElementById('durian-img').style.filter), false);

console.log('\n' + (fails ? fails + ' FAILURES' : 'All resilience tests passed.'));
process.exit(fails ? 1 : 0);
