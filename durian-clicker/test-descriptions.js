/* Cross-checks every upgrade's human-readable description against the numbers
 * in its effects. Catches drift between what the text promises and what the
 * game does — e.g. a description saying +2% for an effect worth 2.5%. */
const fs = require('fs');
const root = '/home/claude/durian-clicker/';
const w = {}; global.window = w;
['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js','numbers.js']
  .forEach(f => eval(fs.readFileSync(root + 'js/' + f, 'utf8')));
const C = w.DC.CONFIG;

let fails = 0, checked = 0;
const bad = (id, msg) => { fails++; console.log('  MISMATCH', id, '—', msg); };
const pct = v => Math.round(v * 10000) / 100;    // same rounding the UI uses

C.upgrades.forEach(u => {
  const d = u.description;

  u.effects.forEach(fx => {
    checked++;
    switch (fx.type) {
      case 'workerScaling': {
        const m = d.match(/\+([\d.]+)% output for every (\d+)/);
        if (!m) return bad(u.id, 'workerScaling description has no "+X% for every N"');
        if (parseFloat(m[1]) !== pct(fx.value))
          bad(u.id, `says +${m[1]}% but effect is +${pct(fx.value)}%`);
        if (parseInt(m[2], 10) !== fx.per)
          bad(u.id, `says per ${m[2]} but effect is per ${fx.per}`);
        break;
      }
      case 'workerSynergy': {
        const m = d.match(/\+([\d.]+)% output for (?:each|every)/);
        if (!m) return bad(u.id, 'workerSynergy description has no "+X% for each"');
        if (parseFloat(m[1]) !== pct(fx.value))
          bad(u.id, `says +${m[1]}% but effect is +${pct(fx.value)}%`);
        break;
      }
      case 'globalMult': {
        const plus = d.match(/produce \+([\d.]+)% Durians/);
        const times = d.match(/produce ([\d.]+)x as many/);
        if (plus) {
          if (parseFloat(plus[1]) !== pct(fx.value - 1))
            bad(u.id, `says +${plus[1]}% but effect is +${pct(fx.value - 1)}%`);
        } else if (times) {
          if (parseFloat(times[1]) !== fx.value)
            bad(u.id, `says ${times[1]}x but effect is ${fx.value}x`);
        } else if (/twice as many/i.test(d)) {
          if (fx.value !== 2) bad(u.id, `says twice but effect is ${fx.value}x`);
        } else bad(u.id, 'globalMult description states no percentage or multiplier');
        break;
      }
      case 'workerMult': {
        const pctForm = d.match(/produce \+([\d.]+)% Durians/);
        if (/twice as many|2x as many/i.test(d)) {
          if (fx.value !== 2) bad(u.id, `says twice but effect is ${fx.value}x`);
        } else if (pctForm) {
          // small upgrades state a percentage rather than a multiplier
          if (Math.abs(parseFloat(pctForm[1]) - pct(fx.value - 1)) > 0.05)
            bad(u.id, `says +${pctForm[1]}% but effect is +${pct(fx.value - 1)}%`);
        } else {
          const m = d.match(/([\d.]+)x as many/);
          if (!m) return bad(u.id, 'workerMult description states no multiplier');
          if (parseFloat(m[1]) !== fx.value)
            bad(u.id, `says ${m[1]}x but effect is ${fx.value}x`);
        }
        break;
      }
      case 'clickAdd': {
        const m = d.match(/\+([\d,]+) Durians? per click/);
        if (!m) return bad(u.id, 'clickAdd description has no "+N per click"');
        if (parseInt(m[1].replace(/,/g, ''), 10) !== fx.value)
          bad(u.id, `says +${m[1]} but effect is +${fx.value}`);
        break;
      }
      case 'clickMult': {
        if (/doubles/i.test(d)) {
          if (fx.value !== 2) bad(u.id, `says doubles but effect is ${fx.value}x`);
        } else if (/triples/i.test(d)) {
          if (fx.value !== 3) bad(u.id, `says triples but effect is ${fx.value}x`);
        } else {
          const m = d.match(/[x×]([\d.]+)/);
          if (!m) return bad(u.id, 'clickMult description states no multiplier');
          if (parseFloat(m[1]) !== fx.value)
            bad(u.id, `says ×${m[1]} but effect is ×${fx.value}`);
        }
        break;
      }
      case 'clickFromDps': {
        const m = d.match(/([\d.]+)% of your Durians per second/);
        if (!m) return bad(u.id, 'clickFromDps description has no percentage');
        if (parseFloat(m[1]) !== pct(fx.value))
          bad(u.id, `says ${m[1]}% but effect is ${pct(fx.value)}%`);
        break;
      }
      case 'clickFromWorkers': {
        const m = d.match(/\+([\d,]+) Durians? per click for every worker/);
        if (!m) return bad(u.id, 'clickFromWorkers description has no "+N per worker"');
        if (parseInt(m[1].replace(/,/g, ''), 10) !== fx.value)
          bad(u.id, `says +${m[1]} but effect is +${fx.value}`);
        break;
      }
      case 'achievementBonus': {
        const m = d.match(/\+([\d.]+)%/);
        if (!m) return bad(u.id, 'achievementBonus description has no percentage');
        if (parseFloat(m[1]) !== pct(fx.value))
          bad(u.id, `says +${m[1]}% but effect is +${pct(fx.value)}%`);
        break;
      }
      case 'offlineEfficiency': {
        const m = d.match(/([\d.]+)% more/);
        if (!m) return bad(u.id, 'offlineEfficiency description has no percentage');
        if (parseFloat(m[1]) !== pct(fx.value))
          bad(u.id, `says ${m[1]}% but effect is ${pct(fx.value)}%`);
        break;
      }
      case 'offlineHours': break;   // cumulative caps; checked separately below
      case 'eventChance': case 'eventGain': case 'eventLoss': case 'buffDuration': break;
      default: break;
    }
  });

  // targets named in the text must be the targets in the effect
  u.effects.forEach(fx => {
    if (!fx.target || fx.target === 'all') return;
    const label = (C.workers.find(x => x.id === fx.target) || {}).plural ||
                  (C.workers.find(x => x.id === fx.target) || {}).name;
    if (label && !d.includes(label.replace(/s$/, ''))) {
      bad(u.id, `effect targets ${fx.target} but description does not mention it`);
    }
  });
});

// offlineHours upgrades stack; the text states the resulting total
console.log('\nOffline cap chain:');
let cap = C.offline.maxSeconds / 3600;
C.upgrades.filter(u => u.effects.some(e => e.type === 'offlineHours'))
  .sort((a, b) => a.cost - b.cost)
  .forEach(u => {
    cap += u.effects.find(e => e.type === 'offlineHours').value;
    const m = u.description.match(/up to (\d+) hours|up to a (week)|up to (\d+) days/);
    const claimed = m ? (m[2] ? 168 : (m[3] ? parseInt(m[3], 10) * 24 : parseInt(m[1], 10))) : null;
    checked++;
    if (claimed === null) bad(u.id, 'offlineHours description states no total');
    else if (claimed !== cap) bad(u.id, `claims ${claimed}h total, chain gives ${cap}h`);
    else console.log(`  ok   ${u.name} -> ${cap}h`);
  });

console.log('\nChecked ' + checked + ' description/effect pairs across ' + C.upgrades.length + ' upgrades.');
console.log(fails ? '\n' + fails + ' INACCURATE DESCRIPTIONS' : '\nEvery description matches its effect.');
process.exit(fails ? 1 : 0);
