// Extract every word entry from the v1163 snapshot (read-only) into one JSON for auditing.
// Usage: node extract.mjs <snapshotDir> <outDir>
import fs from 'node:fs';
import path from 'node:path';

const S = process.argv[2];
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });

function evalExpr(code) { return new Function('return (' + code + ');')(); }

function sliceBlock(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) return null;
  const j = src.indexOf(endMarker, i);
  if (j < 0) return null;
  return { text: src.slice(i, j), start: i };
}
function lineOf(src, idx) { let n = 1; for (let k = 0; k < idx; k++) if (src.charCodeAt(k) === 10) n++; return n; }
function stripTags(h) { return String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function emojiKind(e) {
  e = String(e || '');
  if (/<svg/i.test(e)) return 'svg';
  if (/<img/i.test(e)) return 'img';
  if (/</.test(e)) return 'html';
  return 'emoji';
}
function svgTexts(e) { const r = []; String(e || '').replace(/<text[^>]*>([^<]*)<\/text>/g, (m, t) => { r.push(t); return m; }); return r; }

const entries = [];
const islands = {};
const files = fs.readdirSync(S).filter(f => /^island_\w+\.html$/.test(f)).sort();
for (const f of files) {
  const src = fs.readFileSync(path.join(S, f), 'utf8');
  const blk = sliceBlock(src, 'const DATA=[', 'const allW=DATA');
  if (!blk) { console.error('no DATA in', f); continue; }
  const code = blk.text.replace(/^const DATA=/, '').trim().replace(/;\s*$/, '');
  const DATA = evalExpr(code);
  const key = (src.match(/__hsnSaveKey\s*=\s*'([^']+)'/) || [])[1] || null;
  // local audio
  let la = null;
  const laM = src.match(/window\.__ISLAND_LOCAL_AUDIO = (\{[\s\S]*?\}|null);/);
  if (laM) { try { la = evalExpr(laM[1]); } catch (e) { la = { __err: String(e) }; } }
  // levels
  const lis = sliceBlock(src, 'const LISTEN_LEVELS=', 'const LISTEN_LEVEL_IDX');
  const clz = sliceBlock(src, 'const CLOZE_LEVELS=', 'const CLOZE_LEVEL_IDX');
  let LISTEN = null, CLOZE = null;
  const cutObj = t => { const body = t.replace(/^const [A-Z_]+=/, ''); const k = body.indexOf('\n};'); return body.slice(0, k + 2); };
  try { LISTEN = lis ? evalExpr(cutObj(lis.text)) : null; } catch (e) { LISTEN = { __err: String(e) }; }
  try { CLOZE = clz ? evalExpr(cutObj(clz.text)) : null; } catch (e) { CLOZE = { __err: String(e) }; }
  // line numbers for each entry: scan DATA region line by line
  const regionStartLine = lineOf(src, blk.start);
  const regionLines = blk.text.split('\n');
  const lineFor = [];
  regionLines.forEach((ln, k) => { const m = ln.match(/\{en:"((?:[^"\\]|\\.)*)"/); if (m) lineFor.push({ en: JSON.parse('"' + m[1] + '"'), line: regionStartLine + k }); });
  let li = 0;
  const words = [];
  DATA.forEach((cat, ci) => {
    cat.words.forEach((w, wi) => {
      // match line sequentially
      let line = null;
      for (let t = li; t < lineFor.length; t++) { if (lineFor[t].en === w.en) { line = lineFor[t].line; li = t + 1; break; } }
      const e = { src: f, island: f.replace(/^island_|\.html$/g, ''), key, cat: cat.cat, ci, wi, line, en: w.en, pn: w.pn, cn: w.cn, ex: w.ex, exCn: w.exCn, emojiKind: emojiKind(w.emoji), emojiText: emojiKind(w.emoji) === 'emoji' ? w.emoji : stripTags(w.emoji).slice(0, 80), svgText: svgTexts(w.emoji), emojiRaw: w.emoji, extraKeys: Object.keys(w).filter(k => !['en', 'pn', 'cn', 'emoji', 'ex', 'exCn'].includes(k)) };
      entries.push(e); words.push(w.en);
    });
  });
  islands[f] = { key, cats: DATA.map(c => ({ cat: c.cat, n: c.words.length })), nWords: words.length, LISTEN, CLOZE, localAudio: la, dataStartLine: regionStartLine };
}

// vocab_all.js
const vsrc = fs.readFileSync(path.join(S, 'vocab_all.js'), 'utf8');
const window = {}; const localStorage = { setItem() {} };
new Function('window', 'localStorage', vsrc)(window, localStorage);
const V = window.HANSEN_VOCAB_ALL;
const vocab = [];
for (const [g, arr] of Object.entries(V)) {
  arr.forEach((w, i) => {
    vocab.push({ src: 'vocab_all.js', group: g, idx: i, en: w.en, pn: w.pn, cn: w.cn, ex: w.ex, exCn: w.exCn, emojiKind: emojiKind(w.emoji), emojiText: emojiKind(w.emoji) === 'emoji' ? w.emoji : stripTags(w.emoji).slice(0, 80), svgText: svgTexts(w.emoji), emojiRaw: w.emoji, extraKeys: Object.keys(w).filter(k => !['en', 'pn', 'cn', 'emoji', 'ex', 'exCn'].includes(k)) });
  });
}

// generator sources
const idata = JSON.parse(fs.readFileSync(path.join(S, 'island_data.json'), 'utf8'));
const ldata = JSON.parse(fs.readFileSync(path.join(S, 'land_data.json'), 'utf8'));
const genSrc = [];
for (const [k, d] of Object.entries(idata)) {
  const code = d.DATA.replace(/^const DATA=/, '').trim().replace(/;\s*$/, '');
  const D = evalExpr(code);
  D.forEach(c => c.words.forEach(w => genSrc.push({ src: 'island_data.json', island: k, key: d.key, cat: c.cat, en: w.en, pn: w.pn, cn: w.cn, ex: w.ex, exCn: w.exCn, emojiRaw: w.emoji })));
}
for (const [k, d] of Object.entries(ldata)) {
  const cs = d.slots.filter(s => s.trim().startsWith('{cat:'));
  if (cs.length !== 2) { console.error('cat slots != 2 in land_data', k); continue; }
  const D = evalExpr('[' + cs[0] + '\n]},\n' + cs[1] + '\n]}\n]');
  D.forEach(c => c.words.forEach(w => genSrc.push({ src: 'land_data.json', island: k, cat: c.cat, en: w.en, pn: w.pn, cn: w.cn, ex: w.ex, exCn: w.exCn, emojiRaw: w.emoji })));
}

fs.writeFileSync(path.join(OUT, 'island_entries.json'), JSON.stringify(entries, null, 1));
fs.writeFileSync(path.join(OUT, 'vocab_entries.json'), JSON.stringify(vocab, null, 1));
fs.writeFileSync(path.join(OUT, 'gen_src_entries.json'), JSON.stringify(genSrc, null, 1));
fs.writeFileSync(path.join(OUT, 'islands_meta.json'), JSON.stringify(islands, null, 1));
console.log('island entries', entries.length, 'vocab entries', vocab.length, 'vocab groups', Object.keys(V).length, 'gen src entries', genSrc.length);
const byIsl = {}; entries.forEach(e => { byIsl[e.src] = (byIsl[e.src] || 0) + 1; });
console.log(JSON.stringify(byIsl));
const byG = {}; vocab.forEach(e => { byG[e.group] = (byG[e.group] || 0) + 1; });
console.log(JSON.stringify(byG));
console.log('island keys', JSON.stringify(Object.fromEntries(Object.entries(islands).map(([f, m]) => [f, m.key]))));
