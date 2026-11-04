import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2] + '/highlight_helper.js', 'utf8');
const window = {}; (new Function('window', src))(window);
const cases = JSON.parse(process.argv[3]);
for (const [en, cn, oldEx, newEx] of cases) {
  console.log(en, '|', cn, '\n   OLD:', window.smartHighlight(cn, oldEx, en), '\n   NEW:', window.smartHighlight(cn, newEx, en));
}
