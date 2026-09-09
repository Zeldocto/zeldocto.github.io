const { JSDOM } = require('jsdom'); const fs=require('fs'); const p='/home/claude/durian-clicker/';
const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://zeldocto.github.io/'});
const w=dom.window;
['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js','numbers.js','game.js','workers.js','upgrades.js','achievements.js','events.js','leaderboard.js']
  .forEach(f=>w.eval(fs.readFileSync(p+'js/'+f,'utf8')));
const DC=w.DC,N=DC.N,G=DC.Game,LB=DC.Leaderboard;
let fails=0; const eq=(l,g,e)=>{ if(String(g)!==String(e)){fails++;console.log('FAIL',l,'| got',g,'| want',e);} else console.log('  ok  ',l,'=',g); };

// point at a fake supabase project
DC.CONFIG.leaderboard.provider='supabase';
DC.CONFIG.leaderboard.supabase.url='https://abc123.supabase.co/';
DC.CONFIG.leaderboard.supabase.anonKey='anon-key-xyz';

const calls=[];
w.fetch = (url, opts={}) => {
  calls.push({url, opts});
  if (opts.method === 'HEAD') return Promise.resolve({ ok:true, headers:{ get:()=>'*/41' } });
  if (opts.method === 'POST') return Promise.resolve({ ok:true, text:()=>Promise.resolve('') });
  return Promise.resolve({ ok:true, json:()=>Promise.resolve([
    { public_id:'other-1', name:'Rival', total_log:9, total_display:'1.00B', dps_log:4, dps_display:'10.0K', play_time:7200, workers:120 }
  ])});
};

G.recalc(); G.checkUnlocks(); G.addDurians(50000); DC.Workers.buy('pianta',5);
LB.setName('zeldocto');

(async () => {
  console.log('--- configured detection ---');
  eq('reports online', LB.isOnline(), true);
  eq('reports configured', LB.isConfigured(), true);

  console.log('--- submit request shape ---');
  const r = await LB.submit({force:true, ignoreThrottle:true});
  eq('submit ok', r.ok, true);
  const post = calls.find(c=>c.opts.method==='POST');
  eq('posts to the rpc, not the table', post.url, 'https://abc123.supabase.co/rest/v1/rpc/submit_durian_score');
  eq('never writes to the table directly', /rest\/v1\/durian_scores/.test(post.url), false);
  eq('sends apikey header', post.opts.headers.apikey, 'anon-key-xyz');
  eq('minimal return', post.opts.headers.Prefer, 'return=minimal');
  const body = JSON.parse(post.opts.body);
  eq('rpc params are p_ prefixed', Object.keys(body).every(k=>k.startsWith('p_')), true);
  eq('body has private row key', typeof body.p_player_id, 'string');
  eq('body has public id', typeof body.p_public_id, 'string');
  eq('ids differ', body.p_player_id !== body.p_public_id, true);
  eq('body has name', body.p_name, 'zeldocto');
  eq('body sends log for sorting', typeof body.p_total_log, 'number');
  eq('body sends display string', typeof body.p_total_display, 'string');
  eq('body has verification meta', [body.p_play_time,body.p_total_clicks,body.p_workers,body.p_achievements].every(v=>typeof v==='number'), true);
  eq('body carries the Golden Shine count', typeof body.p_golden_shines, 'number');
  // Every key here must exist as a parameter on submit_durian_score, or the
  // whole call is rejected. The SQL is the source of truth for that list.
  {
    const sql = require('fs').readFileSync('/home/claude/durian-clicker/leaderboard-guard.sql', 'utf8');
    const params = (sql.match(/create or replace function public\.submit_durian_score\(([\s\S]*?)\)\s*returns/) || [])[1] || '';
    const declared = params.split(',').map(p => p.trim().split(/\s+/)[0]);
    eq('every sent key is a declared parameter',
       Object.keys(body).every(k => declared.indexOf(k) !== -1), true);
    eq('and the counts line up', Object.keys(body).length, declared.length);
  }
  eq('no big-number objects leak', /"m":|"e":/.test(post.opts.body), false);

  console.log('--- fetch request shape ---');
  await LB.load('total');
  const get = calls.find(c=>!c.opts.method && c.url.includes('order='));
  eq('orders by sort key desc', /order=total_log\.desc/.test(get.url), true);
  eq('applies configured limit', new RegExp('limit=' + DC.CONFIG.leaderboard.maxEntries).test(get.url), true);
  eq('entries parsed', LB.state.entries.length, 1);
  eq('never selects the private row key', /select=[^&]*player_id/.test(get.url) && !/select=[^&]*public_id/.test(get.url), false);
  eq('select excludes player_id', /\bplayer_id\b/.test(get.url.split('select=')[1].split('&')[0]), false);
  eq('rival not flagged as you', LB.state.entries[0].isYou, false);

  console.log('--- rank lookup when outside the top slice ---');
  await new Promise(r=>setTimeout(r,10));
  const head = calls.find(c=>c.opts.method==='HEAD');
  eq('head request for rank', !!head, true);
  eq('rank filter uses gt', /total_log=gt\./.test(head.url), true);
  eq('rank from content-range', LB.state.yourRank, 42);

  console.log('--- failure handling ---');
  w.fetch = () => Promise.reject(new Error('offline'));
  const bad = await LB.submit({force:true, ignoreThrottle:true});
  eq('submit fails softly', bad.ok, false);
  eq('reason is network', bad.reason, 'network');
  eq('status is error', LB.state.status, 'error');
  eq('progress reassurance in message', /progress is safe/.test(LB.state.message), true);
  await LB.load();
  eq('fetch failure clears entries', LB.state.entries.length, 0);
  eq('game still running after failure', N.toNumber(G.state.durians) > 0, true);

  console.log('--- payload safety (the null-column bug) ---');
  // Fresh save: nothing earned, no workers. log10(0) must not reach the wire.
  const fresh = new (Object.getPrototypeOf(Object).constructor)();
  G.state.totalEarned = N.ZERO; G.state.durians = N.ZERO;
  Object.keys(G.state.workers).forEach(k => G.state.workers[k] = 0);
  G.recalc();
  calls.length = 0;
  w.fetch = (url, opts={}) => { calls.push({url,opts});
    return Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) }); };
  await LB.submit({force:true, ignoreThrottle:true});
  let sent = JSON.parse(calls[0].opts.body);
  eq('zero total sends 0 not null', sent.p_total_log, 0);
  eq('zero dps sends 0 not null', sent.p_dps_log, 0);
  eq('no nulls anywhere in payload', /:null/.test(calls[0].opts.body), false);
  eq('every number is finite', Object.values(sent).every(v => typeof v !== 'number' || isFinite(v)), true);

  // Durians earned but still no workers — the common real-world case.
  G.addDurians(50000); G.recalc();
  calls.length = 0;
  await LB.submit({force:true, ignoreThrottle:true});
  sent = JSON.parse(calls[0].opts.body);
  eq('total_log positive', sent.p_total_log > 4, true);
  eq('dps_log still 0 with no crew', sent.p_dps_log, 0);
  eq('satisfies the >= 0 check constraint', sent.p_total_log >= 0 && sent.p_dps_log >= 0, true);

  // Fractional value: log10 would be negative and trip sane_total.
  G.state.totalEarned = N.big(0.5); G.recalc();
  calls.length = 0;
  await LB.submit({force:true, ignoreThrottle:true});
  eq('sub-1 value floored to 0', JSON.parse(calls[0].opts.body).p_total_log, 0);
  G.state.totalEarned = N.big(50000); G.recalc();

  console.log('--- server errors reach the player ---');
  w.fetch = () => Promise.resolve({ ok:false, status:400,
    text:()=>Promise.resolve('{"code":"23502","message":"null value in column \\"dps_log\\" violates not-null constraint"}') });
  // and a dropped connection must NOT be reported as a rejection
  const rej = await LB.submit({force:true, ignoreThrottle:true});
  eq('reported as rejected not network', rej.reason, 'rejected');
  eq('server message surfaced to UI', /violates not-null/.test(LB.state.message), true);

  console.log('--- key formats ---');
  // Legacy JWT anon key: bearer header is correct and expected.
  DC.CONFIG.leaderboard.supabase.anonKey = 'eyJhbGciOiJIUzI1NiJ9.legacy.anon';
  calls.length = 0;
  w.fetch = (url, opts={}) => { calls.push({url,opts});
    return Promise.resolve({ ok:true, text:()=>Promise.resolve(''), json:()=>Promise.resolve([]) }); };
  await LB.submit({force:true, ignoreThrottle:true});
  let h = calls[0].opts.headers;
  eq('legacy key sent as apikey', h.apikey, 'eyJhbGciOiJIUzI1NiJ9.legacy.anon');
  eq('legacy key also sent as bearer', h.Authorization, 'Bearer eyJhbGciOiJIUzI1NiJ9.legacy.anon');

  // New opaque publishable key: apikey ONLY, or the gateway 401s on JWT parse.
  DC.CONFIG.leaderboard.supabase.anonKey = 'sb_publishable_NAkqrWI96qG43ALKHhQDxg_p7q395cA';
  calls.length = 0;
  await LB.submit({force:true, ignoreThrottle:true});
  h = calls[0].opts.headers;
  eq('publishable key sent as apikey', h.apikey, 'sb_publishable_NAkqrWI96qG43ALKHhQDxg_p7q395cA');
  eq('publishable key NOT sent as bearer', h.Authorization, undefined);
  calls.length = 0;
  await LB.load('total');
  eq('fetch also omits bearer', calls[0].opts.headers.Authorization, undefined);
  eq('fetch still sends apikey', /^sb_publishable_/.test(calls[0].opts.headers.apikey), true);

  // A secret key must never be accepted in client code.
  DC.CONFIG.leaderboard.supabase.anonKey = 'sb_secret_dangerous';
  eq('secret key refused', LB.isConfigured(), false);
  const sec = await LB.submit({force:true, ignoreThrottle:true});
  eq('secret key blocks submit', sec.reason, 'unconfigured');
  DC.CONFIG.leaderboard.supabase.anonKey = 'anon-key-xyz';

  console.log('--- unconfigured project ---');
  DC.CONFIG.leaderboard.supabase.url='';
  eq('detects missing config', LB.isConfigured(), false);
  const un = await LB.submit({force:true, ignoreThrottle:true});
  eq('refuses to submit', un.reason, 'unconfigured');

  // The site and the database deploy separately and either can land first, so
  // asking for a column or parameter the server has not got yet must degrade
  // rather than take the leaderboard down.
  console.log('\n--- works whether or not leaderboard-guard.sql has been run ---');
  const MODULES = ['config.js','content/upgrades.js','content/upgrades-farshore.js',
    'content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js',
    'numbers.js','game.js','workers.js','upgrades.js','achievements.js','prestige.js',
    'events.js','leaderboard.js'];
  const trial = function (serverHasShines) {
    const dom = new JSDOM('<body></body>', { runScripts:'outside-only', url:'https://zeldocto.github.io/' });
    const w = dom.window;
    w.seen = { rpc:null, selects:[] };
    w.fetch = function (url, opts) {
      const u = String(url);
      if (u.indexOf('/rpc/') !== -1) {
        const body = JSON.parse(opts.body);
        if (!serverHasShines && 'p_golden_shines' in body) {
          return Promise.resolve({ ok:false, status:404, text:()=>Promise.resolve('{"code":"PGRST202"}') });
        }
        w.seen.rpc = body;
        return Promise.resolve({ ok:true, text:()=>Promise.resolve('') });
      }
      if (u.indexOf('select=') !== -1) {
        w.seen.selects.push(u);
        if (!serverHasShines && u.indexOf('golden_shines') !== -1) {
          return Promise.resolve({ ok:false, status:400, text:()=>Promise.resolve('column does not exist') });
        }
      }
      return Promise.resolve({ ok:true, json:()=>Promise.resolve([]), headers:{ get:()=>'0-0/0' } });
    };
    MODULES.forEach(f => w.eval(fs.readFileSync(p + 'js/' + f, 'utf8')));
    w.DC.CONFIG.leaderboard.provider = 'supabase';
    w.DC.CONFIG.leaderboard.supabase.url = 'https://abc123.supabase.co/';
    w.DC.CONFIG.leaderboard.supabase.anonKey = 'anon-key-xyz';
    w.DC.Game.state.player.name = 'zeldocto';
    return w;
  };

  const wNew = trial(true);
  const rNew = await wNew.DC.Leaderboard.submit({ force:true, ignoreThrottle:true });
  eq('up-to-date server accepts it', rNew.ok, true);
  eq('and receives the Shine count', 'p_golden_shines' in wNew.seen.rpc, true);

  // The count is now ALWAYS sent. A submission that quietly succeeds while
  // storing zero is worse than one that fails visibly — that is exactly how a
  // player ended up with a Golden Shine showing as 0 on the board.
  const wOld = trial(false);
  const rOld = await wOld.DC.Leaderboard.submit({ force:true, ignoreThrottle:true });
  eq('a server without the column fails loudly', rOld.ok, false);
  eq('rather than storing a silent zero', wOld.seen.rpc, null);
  await wOld.DC.Leaderboard.load();
  eq('and the board still loads',
     wOld.seen.selects.some(u => u.indexOf('golden_shines') === -1), true);

  console.log(fails?`\n${fails} FAILURES`:'\nAll Supabase provider tests passed.');
  process.exit(fails?1:0);
})();
