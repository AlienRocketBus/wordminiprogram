// 静态核对：每个岛的完形各档，哪些词能挖空、挖的是哪个写法
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
const files = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();
let lost = 0, inflected = [];
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const i = html.indexOf('const DATA=['), j = html.indexOf('const allW=', i);
  const DATA = (new Function(html.slice(i, j).replace('const DATA=', 'return ')))();
  const allW = DATA.flatMap(d => d.words);
  const ci = html.indexOf('const CLOZE_LEVELS={');
  let depth = 0, k = html.indexOf('{', ci), e = k;
  for (; e < html.length; e++) { if (html[e] === '{') depth++; else if (html[e] === '}') { depth--; if (!depth) break; } }
  const CL = (new Function('allW', 'return ' + html.slice(k, e + 1)))(allW);
  const hs = html.indexOf('var __HSN_CLOZE_IRREG'), he = html.indexOf('window.__hsnClozeMatch=__hsnClozeMatch;');
  let match = null;
  if (hs > 0) { const window = {}; match = (new Function('window', html.slice(hs, he) + 'return __hsnClozeMatch;'))(window); }
  else match = (w) => { const m = new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').exec(w.ex || ''); return m ? { index: m.index, text: m[0] } : null; };
  const row = [];
  for (const lv of Object.keys(CL)) {
    const words = CL[lv].words.map(en => allW.find(w => w.en === en)).filter(Boolean);
    const ok = words.filter(w => match(w));
    const bad = words.filter(w => !match(w)).map(w => w.en);
    if (bad.length) lost += bad.length;
    words.forEach(w => { const m = match(w); if (m && m.text.toLowerCase() !== w.en.toLowerCase()) inflected.push(f.replace('island_', '').replace('.html', '') + ':' + w.en + '→' + m.text); });
    row.push(`${lv} ${ok.length}/${words.length}` + (bad.length ? ' 缺[' + bad.join(',') + ']' : ''));
  }
  console.log(f.padEnd(24), row.join(' | '));
}
console.log('\n出不了题的词:', lost);
console.log('变形挖空:', inflected.length, inflected.join('  '));
