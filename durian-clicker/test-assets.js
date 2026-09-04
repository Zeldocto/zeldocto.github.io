/* Every asset path referenced anywhere in config or content must exist on disk.
 * A broken image is invisible in unit tests but obvious to players. */
const fs = require('fs');
const path = require('path');
const root = '/home/claude/durian-clicker/';
const w = {}; global.window = w;
['config.js','content/upgrades.js','content/upgrades-farshore.js','content/achievements.js','content/events.js','content/skins.js','content/backgrounds.js']
  .forEach(f => eval(fs.readFileSync(root + 'js/' + f, 'utf8')));
const C = w.DC.CONFIG;

let fails = 0, checked = 0;
function check(label, p) {
  checked++;
  if (!p) return;
  if (typeof p !== 'string' || !/^assets\//.test(p)) {
    fails++; console.log('  BAD PATH', label, '->', JSON.stringify(p));
    return;
  }
  if (!fs.existsSync(path.join(root, p))) {
    fails++; console.log('  MISSING ', label, '->', p);
  }
}

Object.keys(C.assets).forEach(k => check('assets.' + k, C.assets[k]));
Object.keys(C.sounds).forEach(k => check('sounds.' + k, C.sounds[k]));
C.workers.forEach(x => check('worker ' + x.id, x.image));
C.upgrades.forEach(u => check('upgrade ' + u.id, u.icon));
C.events.forEach(e => check('event ' + e.id, e.icon));

// also catch anything hard-coded in the HTML
const html = fs.readFileSync(root + 'index.html', 'utf8');
(html.match(/(?:src|href)="(assets\/[^"]+)"/g) || []).forEach(m => {
  const p = m.match(/"(assets\/[^"]+)"/)[1].split('?')[0];
  check('index.html ' + p, p);
});

// every local script and stylesheet must carry the current build stamp, or a
// cached copy will keep being served after a deploy
const stamped = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m => m[1]);
const unstamped = stamped.filter(u => !/\?v=/.test(u));
checked += stamped.length;
if (unstamped.length) {
  fails += unstamped.length;
  console.log('  NOT CACHE-BUSTED:', unstamped.join(', '));
}
const buildId = (fs.readFileSync(path.join(root, 'js/config.js'), 'utf8')
  .match(/buildId:\s*'([^']+)'/) || [])[1];
const wrongStamp = stamped.filter(u => !u.includes('?v=' + buildId));
if (wrongStamp.length) {
  fails += wrongStamp.length;
  console.log('  STALE STAMP (expected ' + buildId + '):', wrongStamp.slice(0, 3).join(', '));
}
const declared = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).build;
checked++;
if (declared !== buildId) {
  fails++;
  console.log('  version.json says "' + declared + '" but config says "' + buildId + '"');
}

// every image the game ships should be reachable, or it's dead weight
const referenced = new Set();
[C.assets, C.sounds].forEach(o => Object.values(o).forEach(v => referenced.add(v)));
C.workers.forEach(x => referenced.add(x.image));
C.upgrades.forEach(u => referenced.add(u.icon));
C.events.forEach(e => referenced.add(e.icon));
const orphans = fs.readdirSync(path.join(root, 'assets'))
  .filter(f => /\.(png|jpg|webp)$/.test(f))
  .filter(f => !referenced.has('assets/' + f));

console.log('Checked ' + checked + ' asset references.');
if (orphans.length) console.log('Unreferenced art (harmless, but unused):', orphans.join(', '));
// Every content file must parse. A stray quote in changelog.js once shipped
// and silently disabled the whole "What's new" feature in production.
{
  const cp = require('child_process');
  ['js/content/changelog.js','js/content/backgrounds.js','js/content/skins.js',
   'js/content/events.js','js/content/upgrades.js','js/content/achievements.js',
   'js/content/upgrades-farshore.js'].forEach(function (f) {
    checked++;
    const r = cp.spawnSync('node', ['--check', path.join(root, f)], { encoding: 'utf8' });
    if (r.status !== 0) {
      fails++;
      console.log('  SYNTAX ERROR in ' + f + ': ' + (r.stderr || '').split('\n')[2]);
    }
  });
  console.log(fails ? '' : '  ok   all content files parse');
}

console.log(fails ? '\n' + fails + ' BROKEN ASSET REFERENCES' : '\nAll asset references resolve.');
process.exit(fails ? 1 : 0);
