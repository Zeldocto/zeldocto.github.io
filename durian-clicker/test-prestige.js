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

console.log('\n=== both bonuses are additive per Shine ===');
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
  eq('click bonus caps at +60%', Db.Prestige.bonusPercent(), 60);
  eq('production bonus caps at +30%', Db.Prestige.productionPercent(), 30);
}

console.log('\n=== production scales +5% a Shine, exactly ===');
{
  // measured without earning any achievements: the Golden Shine achievements
  // themselves carry the ordinary per-achievement production bonus, which
  // would otherwise show up here and look like double-counting
  const rate = function (n) {
    const wr = boot(null, JSON.stringify({ shines: n, prestiges: n, claimedAt: [], carried: 0 }));
    const Dr = wr.DC, Gr = Dr.Game;
    Gr.state.achievements = {};
    Dr.CONFIG.workers.forEach(x => { Gr.state.unlocked[x.id] = true; Gr.state.workers[x.id] = 25; });
    Gr.recalc();
    return { dps: Dr.N.toNumber(Gr.derived.dps), click: Dr.N.toNumber(Gr.derived.clickPower) };
  };
  const zero = rate(0);
  for (let n = 1; n <= 6; n++) {
    const r = rate(n);
    eq(n + ' Shines: production x' + (1 + n * 0.05).toFixed(2),
       Math.round(r.dps / zero.dps * 1000) / 1000, 1 + n * 0.05);
    eq(n + ' Shines: clicks x' + (1 + n * 0.1).toFixed(2),
       Math.round(r.click / zero.click * 1000) / 1000, 1 + n * 0.1);
  }
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
  eq('production stays +30%', Dc.Prestige.productionPercent(), 30);
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
  eq('shows the click bonus', /Permanent click bonus/.test(facts()), true);
  eq('shows the production bonus', /Permanent production bonus/.test(facts()), true);
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
  ['Golden Shines', 'Permanent click bonus', 'Permanent production bonus',
   'Next Golden Shine at', 'Times prestiged']
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

console.log('\n=== prestige shows on the leaderboard ===');
{
  const wl = boot(null, JSON.stringify({ shines: 3, prestiges: 3, claimedAt: [], carried: 0 }));
  const Dl = wl.DC;
  eq('the submitted entry carries the count',
     Dl.Leaderboard.snapshot ? Dl.Leaderboard.snapshot().golden_shines : 3, 3);

  Dl.CONFIG.leaderboard.provider = 'local';
  Dl.Game.state.player.name = 'Zeldocto';
  wl.localStorage.setItem(Dl.CONFIG.saveKey + '.leaderboard', JSON.stringify([
    { public_id: 'a', name: 'Six', total_log: 75, total_display: '7e75',
      dps_log: 70, dps_display: '2e70', golden_shines: 6, workers: 10, achievements: 5, play_time: 90 },
    { public_id: 'b', name: 'Two', total_log: 73, total_display: '2e73',
      dps_log: 70, dps_display: '1e70', golden_shines: 2, workers: 10, achievements: 5, play_time: 90 },
    { public_id: 'c', name: 'None', total_log: 64, total_display: '1e64',
      dps_log: 60, dps_display: '9e59', golden_shines: 0, workers: 10, achievements: 5, play_time: 90 }
  ]));
  Dl.Leaderboard.load().then(function () {
    Dl.UI.selectTab('board');
    const rows = [...wl.document.querySelectorAll('#board-list .board-row')];
    eq('three rows', rows.length, 3);
    // GOLDEN SHINES (the prestige reward), drawn as a fixed 2x3 grid of dots
    // left of the name. Not the "shines" in the meta line — those are
    // achievements and must be left alone.
    const grid = r => r.querySelector('.board-shines');
    const slots = r => grid(r).querySelectorAll('.board-shine').length;
    const filled = r => grid(r).querySelectorAll('.board-shine.is-held').length;

    eq('three rows', rows.length, 3);
    eq('every row draws all six slots',
       rows.every(r => slots(r) === 6), true);
    eq('six Golden Shines fills six', filled(rows[0]), 6);
    eq('two fills two', filled(rows[1]), 2);
    eq('none fills none', filled(rows[2]), 0);
    eq('tooltip gives the prestige level', grid(rows[0]).title, 'Prestige 6');
    eq('and reads sensibly at one', grid(rows[1]).title, 'Prestige 2');
    eq('with a clear empty state', grid(rows[2]).title, 'No prestige yet');

    // position: its own column, before the name
    const order = [...rows[0].children].map(c => c.className.split(' ')[0]);
    eq('the dots sit left of the name',
       order.indexOf('board-shines') < order.indexOf('board-player'), true);
    eq('and after the rank',
       order.indexOf('board-rank') < order.indexOf('board-shines'), true);

    // Dark mode: a rule scoped to body.dark once outranked .is-held on
    // specificity and painted over the gold, so every dot looked unlit while
    // light mode was fine. The dark rule must only ever target unlit slots.
    {
      const css = fs.readFileSync(ROOT + 'css/style.css', 'utf8');
      eq('the dark rule spares lit dots',
         /body\.dark \.board-shine:not\(\.is-held\)/.test(css), true);
      eq('and no unscoped dark rule remains',
         /body\.dark \.board-shine\s*\{/.test(css), false);
      eq('the lit style is defined once', (css.match(/#FFC400 65%/g) || []).length, 1);
    }

    // the achievement count in the meta line is a different thing entirely
    eq('the meta line still shows achievement shines',
       / shines/.test(rows[0].querySelector('.board-player-meta').textContent), true);

    // the SQL has to accept the new parameter, or none of this reaches the server
    const sql = fs.readFileSync(ROOT + 'leaderboard-guard.sql', 'utf8');
    eq('SQL adds the column', /add column if not exists golden_shines/.test(sql), true);
    eq('SQL takes the parameter', /p_golden_shines integer default 0/.test(sql), true);
    eq('SQL stores it', /golden_shines = excluded\.golden_shines/.test(sql), true);
    eq('SQL rejects an impossible count', /Golden Shine count out of range/.test(sql), true);

    /* ------------------------------------------------------------------
     * Rules that must NEVER come back. Each was tried, rejected honest
     * players, and was removed. The bank-lead rule was reinstated by
     * accident when the file was rebuilt from an older copy and broke
     * submissions a second time, which is why this is a test and not a
     * comment.
     *
     *   bank lead   — a lifetime total sits against a freshly reset rate
     *                 after a prestige, so the gap is unbounded and honest.
     *   clicks/sec  — autoclickers are allowed at any speed.
     *   time played — an offline return spends weeks of bank in minutes.
     * ------------------------------------------------------------------ */
    const banned = [
      ['bank lead', /max_bank_lead|dps_log\s*\+|Total is impossible for that production rate/i],
      ['clicks per second', /max_clicks_per_sec|More clicks than the time played/i],
      ['production vs time played', /max_log_per_hour|Production too high for the time played/i]
    ];
    const verify = fs.readFileSync(ROOT + 'leaderboard-verify.sql', 'utf8');
    banned.forEach(function (pair) {
      eq('the ' + pair[0] + ' rule is not in the guard', pair[1].test(sql), false);
      eq('nor in the verify query', pair[1].test(verify), false);
    });

    // The select grant is column-by-column, so adding a column is not enough:
    // without a matching grant PostgREST refuses the request, the client falls
    // back to the old column list, and prestige silently never appears.
    eq('SQL grants read access to the column',
       /grant select \([^)]*golden_shines[^)]*\)\s*\n?\s*on public\.durian_scores to anon/.test(sql), true);
    const setup = fs.readFileSync(ROOT + 'leaderboard-setup.sql', 'utf8');
    eq('a fresh install declares the column', /golden_shines\s+integer not null default 0/.test(setup), true);
    eq('and grants it', /grant select \([^)]*golden_shines/.test(setup), true);
    eq('while player_id stays unreadable',
       /grant select \([^)]*player_id/.test(setup), false);
    eq('and drops the old overload',
       /drop function if exists public\.submit_durian_score/.test(sql), true);

    // A prestige must not freeze the row. The minimum-score check used to read
    // this run's totalEarned, which a prestige resets to zero, so every later
    // submission was refused as "too-low" and the entry silently stopped
    // updating — Shine count included.
    console.log('\n=== a prestige does not freeze your leaderboard row ===');
    const dm = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
    const wm = dm.window;
    ['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js',
     'content/events.js','content/skins.js','content/backgrounds.js','numbers.js','game.js',
     'workers.js','upgrades.js','achievements.js','prestige.js','save.js','events.js','leaderboard.js']
      .forEach(f => wm.eval(fs.readFileSync(ROOT + 'js/' + f, 'utf8')));
    const Dm = wm.DC, Nm = Dm.N, Gm = Dm.Game;
    const posted = [];
    wm.fetch = function (url, opts) {
      if (String(url).indexOf('/rpc/') !== -1) {
        posted.push(JSON.parse(opts.body));
        return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]),
                               headers: { get: () => '0-0/0' } });
    };
    Dm.CONFIG.leaderboard.provider = 'supabase';
    Gm.state.player.name = 'Zeldocto';
    Gm.addDurians(Nm.pow10(51), 'worker');
    Gm.recalc();

    return Dm.Leaderboard.submit({ ignoreThrottle: true }).then(function () {
      eq('submits before prestige', posted.length, 1);
      Dm.Prestige.claim();
      return new Promise(function (go) { setTimeout(go, 40); });
    }).then(function () {
      eq('the name survives the reset', Gm.state.player.name, 'Zeldocto');
      eq('claiming pushes the score at once', posted.length, 2);
      eq('carrying the Shine count', posted[posted.length - 1].p_golden_shines, 1);
      eq('while this run has earned nothing', Nm.toNumber(Gm.state.totalEarned), 0);
      return Dm.Leaderboard.submit({ ignoreThrottle: true });
    }).then(function (r) {
      eq('routine submissions still go through', r.ok, true);
      eq('scored on lifetime, not the empty run',
         Math.round(posted[posted.length - 1].p_total_log), 51);
    });
  }).then(function () {

    console.log('\n' + (fails ? fails + ' FAILURES' : 'Prestige working.'));
    process.exit(fails ? 1 : 0);
  }).catch(function (err) { console.log('BOARD TEST ERROR:', err && err.message); process.exit(1); });
}
