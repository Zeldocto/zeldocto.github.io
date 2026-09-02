/* Production must be paced by real elapsed time, not by how fast the machine
 * or the browser runs. Idle games get sped up by overriding the clock or by
 * pumping the frame driver; neither should pay. */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const ROOT = '/home/claude/durian-clicker/';
const FILES = ['config.js','content/upgrades.js','content/upgrades-farshore.js',
  'content/achievements.js','content/events.js','content/changelog.js','content/skins.js',
  'numbers.js','game.js','workers.js','upgrades.js','achievements.js','offline.js',
  'events.js','coins.js','casino.js','store.js'];

/**
 * Runs the real frame loop for `realSeconds` of wall-clock time, delivering
 * frames at `fps`, with the two clocks advancing at the given rates.
 * Returns Durians earned.
 */
function run(opts) {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
  const w = dom.window;
  let wallMs = 1000000, perfMs = 0;
  const frames = [];
  w.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  w.performance = { now: () => perfMs };
  w.Date = class extends Date { static now() { return wallMs; } };
  FILES.forEach(f => w.eval(fs.readFileSync(ROOT + 'js/' + f, 'utf8')));
  const DC = w.DC, N = DC.N, G = DC.Game;
  // Island events pay out from inside the tick loop, which adds hundreds of
  // seconds of production at random and swamps what we are measuring here.
  if (DC.IslandEvents) DC.IslandEvents.update = function () {};
  if (DC.Coins) DC.Coins.update = function () {};
  DC.CONFIG.workers.forEach(x => { G.state.unlocked[x.id] = true; G.state.workers[x.id] = 10; });
  G.recalc();
  G.state.durians = N.ZERO;

  const frameCount = Math.round(opts.realSeconds * opts.fps);
  const realStepMs = 1000 / opts.fps;
  G.start();
  for (let i = 0; i < frameCount; i++) {
    wallMs += realStepMs * (opts.wallRate === undefined ? 1 : opts.wallRate);
    perfMs += realStepMs * (opts.perfRate === undefined ? 1 : opts.perfRate);
    const fn = frames.shift();
    if (fn) fn(perfMs);
  }
  return { earned: N.toNumber(G.state.durians), dps: N.toNumber(G.derived.dps) };
}

let fails = 0;
const eq = (l, g, e) => { if (String(g) !== String(e)) { fails++; console.log('FAIL', l, '| got', g, '| want', e); } else console.log('  ok  ', l, '=', g); };
const near = (a, b, tol) => Math.abs(a - b) / Math.max(1e-9, b) < tol;

console.log('=== frame rate does not change earnings ===');
const at60 = run({ realSeconds: 10, fps: 60 });
const at240 = run({ realSeconds: 10, fps: 240 });
const at15 = run({ realSeconds: 10, fps: 15 });
console.log('     10 real seconds:  60fps ' + at60.earned.toFixed(1) +
            ' | 240fps ' + at240.earned.toFixed(1) + ' | 15fps ' + at15.earned.toFixed(1));
eq('240Hz earns the same as 60Hz', near(at240.earned, at60.earned, 0.02), true);
eq('15fps earns the same as 60Hz', near(at15.earned, at60.earned, 0.02), true);
eq('and it matches 10 seconds of production', near(at60.earned, at60.dps * 10, 0.05), true);

console.log('\n=== speeding a single clock buys nothing ===');
const fastPerf = run({ realSeconds: 10, fps: 60, perfRate: 20 });
eq('performance.now sped up 20x earns no more',
   near(fastPerf.earned, at60.earned, 0.05), true);
const fastWall = run({ realSeconds: 10, fps: 60, wallRate: 20 });
eq('Date.now sped up 20x earns no more',
   near(fastWall.earned, at60.earned, 0.05), true);

console.log('\n=== pumping the frame driver buys nothing ===');
// 20x the frames in the same real time
const pumped = run({ realSeconds: 10, fps: 1200 });
eq('1200fps earns the same as 60fps', near(pumped.earned, at60.earned, 0.03), true);

console.log('\n=== a huge gap is not credited as production ===');
// three frames, each jumping ten minutes: the cap allows one second apiece,
// and the rest is offline earnings' job, not the frame loop's
const gap = run({ realSeconds: 3, fps: 1, wallRate: 600, perfRate: 600 });
const secondsCredited = gap.earned / gap.dps;
console.log('     three 10-minute jumps credited ' + secondsCredited.toFixed(2) + ' seconds');
eq('a 10-minute jump credits about a second, not ten minutes',
   secondsCredited < 4, true);
eq('and it is not simply zero', secondsCredited > 0.5, true);

console.log('\n=== the testing knob still works ===');
{
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://x.io/' });
  const w = dom.window;
  FILES.forEach(f => w.eval(fs.readFileSync(ROOT + 'js/' + f, 'utf8')));
  eq('timeScale ships at 1', w.DC.CONFIG.balance.timeScale, 1);
  eq('frame cap is configured', w.DC.CONFIG.balance.maxFrameSeconds > 0, true);
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'Production is paced by real time.'));
process.exit(fails ? 1 : 0);
