/* Font paths are easy to get wrong and fail silently — the text just renders in
 * the fallback face. This resolves every @font-face URL against the page's real
 * location on disk and checks the file is there. */
const fs = require('fs');
const path = require('path');
const gameDir = process.argv[2];                 // .../durian-clicker
const siteRoot = path.resolve(gameDir, '..');    // GitHub Pages root

const html = fs.readFileSync(path.join(gameDir, 'index.html'), 'utf8');
const faces = [...html.matchAll(/@font-face\s*\{[^}]*?font-family:\s*'([^']+)'[^}]*?url\('([^']+)'\)[^}]*?\}/gs)];

let fails = 0;
console.log('Declared faces: ' + faces.length + '\n');
faces.forEach(([, family, url]) => {
  const resolved = path.resolve(gameDir, url);
  const exists = fs.existsSync(resolved);
  const rel = path.relative(siteRoot, resolved);
  console.log((exists ? '  ok   ' : '  MISSING ') + family.padEnd(12) + ' -> ' + url);
  console.log('         resolves to /' + rel.replace(/\\/g, '/'));
  if (!exists) { fails++; console.log('         NOT FOUND on disk'); }
  if (/^https?:|^\/\//.test(url)) return;
  if (/^zeldocto\.github\.io/.test(url)) {
    fails++; console.log('         looks like a URL but is being read as a folder name');
  }
});

// the CSS must actually use the family it declares
const css = fs.readFileSync(path.join(gameDir, 'css/style.css'), 'utf8');
const used = faces.filter(([, family]) => css.includes("'" + family + "'"));
console.log('\nFaces referenced by the stylesheet: ' + used.length + ' of ' + faces.length);
const counter = /\.count \{[^}]*font-family:\s*'([^']+)'/.exec(css);
console.log('Counter font-family: ' + (counter ? counter[1] : 'NOT SET'));
if (!counter) fails++;
else if (!faces.some(([, f]) => f === counter[1])) {
  fails++; console.log('  the counter asks for a family that is never declared');
}
const fallback = /\.count \{[^}]*font-family:\s*'[^']+',\s*var\(--font-display\)/.test(css);
console.log('Falls back to the UI font: ' + fallback);
if (!fallback) fails++;

console.log(fails ? '\n' + fails + ' FONT PROBLEMS' : '\nEvery declared font resolves to a real file.');
process.exit(fails ? 1 : 0);
