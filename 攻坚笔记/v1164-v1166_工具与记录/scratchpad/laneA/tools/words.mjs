// 从生成的岛页里取出 DATA，统计各种分档
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.argv[2];
const files = fs.readdirSync(ROOT).filter(f => /^island_[a-z0-9]+\.html$/.test(f)).sort();
export function loadData(file){
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const i = html.indexOf('const DATA=[');
  const j = html.indexOf('const allW=', i);
  const src = html.slice(i, j).replace('const DATA=', 'return ');
  return (new Function(src))();
}
for (const f of files) {
  const D = loadData(f); const W = D.flatMap(d => d.words);
  const L = W.map(w => w.en.length);
  const c = (fn) => W.filter(fn).length;
  console.log(f.padEnd(24), 'n=' + W.length,
    ' <=4:' + c(w => w.en.length <= 4), ' 5-6:' + c(w => w.en.length >= 5 && w.en.length <= 6), ' >=7:' + c(w => w.en.length >= 7),
    ' | <=7:' + c(w => w.en.length <= 7), ' 8:' + c(w => w.en.length === 8), ' >=9:' + c(w => w.en.length > 8));
}
