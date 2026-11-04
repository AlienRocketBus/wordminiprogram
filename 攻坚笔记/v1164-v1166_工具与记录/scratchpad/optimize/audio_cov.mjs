import fs from 'node:fs';
const S = process.argv[2];
const window = {}; const localStorage = { setItem(){} };
eval(fs.readFileSync(S + '/vocab_all.js', 'utf8'));
eval(fs.readFileSync(S + '/word_map.js', 'utf8'));
eval(fs.readFileSync(S + '/sentence_map.js', 'utf8'));
eval(fs.readFileSync(S + '/hansen_ex_audio.js', 'utf8'));
const files = fs.readdirSync(S).filter(f => /^island_\w+\.html$/.test(f));
let report = [];
const exAudio = window.__HANSEN_EX_AUDIO || {};
for (const f of files) {
  const h = fs.readFileSync(S + '/' + f, 'utf8');
  const m = h.match(/window\.__ISLAND_LOCAL_AUDIO = (\{.*?\});/s);
  let la = {}; try { la = m ? JSON.parse(m[1]) : {}; } catch (e) { la = { _err: 1 }; }
  // words from DATA? find "en":"..." occurrences in DATA block is hard; use vocab key via ISLE_KEY
  const km = h.match(/__hsnSaveKey='([^']+)'/);
  const key = km && km[1];
  const words = (window.HANSEN_VOCAB_ALL[key] || []);
  let cov = 0, missing = [], exCov = 0;
  for (const w of words) { const l = w.en.toLowerCase(); if (la[l] || window.WORD_MAP[l] || window.WORD_MAP[w.en]) cov++; else missing.push(w.en); const exk = (w.ex || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); if (exAudio[exk] || window.SENTENCE_MAP[w.ex]) exCov++; }
  report.push([f, key, Object.keys(la).length, words.length, cov, exCov, missing.slice(0, 5).join(',')]);
}
for (const r of report) console.log(r.join(' | '));
// existence of files referenced
let missingFiles = 0, total = 0;
for (const v of Object.values(window.WORD_MAP)) { total++; if (!fs.existsSync(S + '/' + v)) missingFiles++; }
console.log('WORD_MAP entries', total, 'missing files', missingFiles, 'SENTENCE_MAP', Object.keys(window.SENTENCE_MAP).length, 'EX_AUDIO', Object.keys(exAudio).length);
