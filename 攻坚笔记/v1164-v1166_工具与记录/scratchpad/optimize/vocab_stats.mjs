import fs from 'node:fs';
const S = process.argv[2];
const src = fs.readFileSync(S + '/vocab_all.js', 'utf8');
const window = {}; const localStorage = { setItem(){} };
eval(src);
const V = window.HANSEN_VOCAB_ALL;
let tot = 0; const all = new Map(); const rows = [];
const lens = []; const exLens = [];
let multiword = 0, svgEmoji = 0, noEx = 0, noPn = 0;
for (const [k, arr] of Object.entries(V)) {
  tot += arr.length;
  const avgLen = arr.reduce((a, w) => a + w.en.length, 0) / arr.length;
  const exw = arr.reduce((a, w) => a + (w.ex ? w.ex.split(/\s+/).length : 0), 0) / arr.length;
  rows.push([k, arr.length, avgLen.toFixed(1), exw.toFixed(1), arr.slice(0, 4).map(w => w.en).join(',')]);
  for (const w of arr) { const key = w.en.toLowerCase(); all.set(key, (all.get(key) || []).concat(k)); lens.push(w.en.length); if (/\s/.test(w.en)) multiword++; if (/<svg|<span/.test(w.emoji || '')) svgEmoji++; if (!w.ex) noEx++; if (!w.pn) noPn++; }
}
const dups = [...all.entries()].filter(([, v]) => v.length > 1);
console.log('groups', Object.keys(V).length, 'total', tot, 'unique', all.size, 'dups', dups.length, 'multiword', multiword, 'svgEmoji', svgEmoji, 'noEx', noEx, 'noPn', noPn);
for (const r of rows) console.log(r.join(' | '));
console.log('dups sample', dups.slice(0, 20).map(([w, v]) => w + ':' + v.join('/')).join('; '));
// longest words
const sorted = [...all.keys()].sort((a, b) => b.length - a.length);
console.log('longest', sorted.slice(0, 20).join(', '));
