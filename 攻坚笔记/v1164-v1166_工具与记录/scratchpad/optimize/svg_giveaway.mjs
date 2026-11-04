import fs from 'node:fs';
const S = process.argv[2];
const window = {}; const localStorage = { setItem(){} };
eval(fs.readFileSync(S + '/vocab_all.js', 'utf8'));
let svg = 0, give = [], byG = {};
for (const [k, arr] of Object.entries(window.HANSEN_VOCAB_ALL)) for (const w of arr) {
  const e = w.emoji || '';
  if (!/<svg/.test(e)) continue; svg++;
  const texts = [...e.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]).join(' ');
  if (texts && texts.toLowerCase().includes(w.en.toLowerCase())) { give.push(w.en); byG[k] = (byG[k] || 0) + 1; }
}
console.log('svg emoji', svg, 'svg containing the English word itself', give.length);
console.log(JSON.stringify(byG));
console.log(give.slice(0, 40).join(', '));
