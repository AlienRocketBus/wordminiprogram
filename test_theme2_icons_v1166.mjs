// 主题 2.0 小图标测试（不联网、约 5 秒）
//  ① 该有的图标都有（金币、钻石、经验、星、火、对、错、喇叭…）；SVG 合法；没有 id/渐变（同页多个不冲突）
//  ② 每个图标在亮、暗主题下都真的画出了像素（不是空白）
//  ③ swapEmoji 只换指定元素里的货币/状态 emoji，不碰输入框，重复调用不重复换
//  ④ emojiOk 能认出“画不出来的字”（空框）
//  ⑤ 无障碍：默认读屏不读；给了 label 才读
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, findOne, serve, browser, phone, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';

const t = scorer('主题 2.0 小图标');
const F = findOne(/^hansen_theme2_icons_v\d{4}\.js$/);
const I = createRequire(import.meta.url)(path.join(ROOT, F));
const names = I.names();
const need = ['coin', 'gem', 'xp', 'star', 'starOff', 'flame', 'check', 'cross', 'speaker'];
t.ok(need.every(n => names.includes(n)), '必需图标齐全：' + need.join(' '), names);
t.ok(names.every(n => I.NAME[n]), '每个图标都有中文名');
const all = names.map(n => I.svg(n)).join('');
t.ok(!/\sid=|<linearGradient|<radialGradient|url\(#/.test(all), '没有 id / 渐变引用（同页放 100 个也不冲突）');
t.ok(/var\(--t2-coin,#[0-9A-F]{6}\)/i.test(I.svg('coin')), '颜色走主题角色（并带兜底色）');
t.ok(I.EMOJI['🪙'] === 'coin' && I.EMOJI['💎'] === 'gem' && I.EMOJI['⭐'] === 'star' && I.EMOJI['🔊'] === 'speaker', 'emoji → 图标对照表');
const code = fs.readFileSync(path.join(ROOT, F), 'utf8');
const bare = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/'(?:\\.|[^'\\])*'/g, "''");
t.ok(!/=>|\blet\s|\bconst\s|`|\bclass\s/.test(bare), '只用 ES5 写法（旧手机内核）');
t.ok(!/setInterval|setTimeout|requestAnimationFrame|MutationObserver/.test(bare), '不自动扫页面、没有定时器');
t.ok(!/\?v=\d|\b1166\b/.test(code), '文件里没有版本号字面量');

const page = `<!doctype html><html data-t2-base="cosmos" data-t2-mode="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/theme2_tokens.css"><script src="/${F}"></script></head>
<body style="margin:0;background:var(--t2-surface-1)"><div id="grid" style="display:flex;flex-wrap:wrap;gap:8px;padding:8px"></div>
<div id="bar">金币 🪙 1,280 · 钻石 💎 36 · ⭐⭐ · 🔥5 <input id="inp" value="🪙"> <b>🍎</b></div><div id="other">🪙 不在范围里</div></body></html>`;
const srv = await serve({ '/__t2/ic.html': page });
const br = await browser();
try {
  const ctx = await phone(br, srv.base); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(srv.base + '/__t2/ic.html', { waitUntil: 'load' });
  const parse = await pg.evaluate(() => HansenIcons.names().filter(n => new DOMParser().parseFromString(HansenIcons.svg(n).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '), 'image/svg+xml').querySelector('parsererror')));
  t.ok(parse.length === 0, '每个 SVG 都能被解析（合法 XML）', parse);
  for (const mode of [['cosmos', 'dark'], ['cloud', 'light']]) {
    const res = await pg.evaluate(async ([b, m]) => {
      document.documentElement.setAttribute('data-t2-base', b); document.documentElement.setAttribute('data-t2-mode', m);
      const g = document.getElementById('grid'); g.innerHTML = '';
      HansenIcons.names().forEach(n => { const s = HansenIcons.el(n, { size: 32 }); s.dataset.n = n; s.style.color = 'var(--t2-ink-1)'; g.appendChild(s); });
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [...g.children].map(s => { const r = s.getBoundingClientRect(); return { n: s.dataset.n, x: r.left, y: r.top, w: r.width, h: r.height }; });
    }, mode);
    const shot = await pg.screenshot();
    const painted = await pg.evaluate(async ({ png, res }) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const bg = c.getImageData(2, 300, 1, 1).data;
      return res.map(r => { const d = c.getImageData(Math.round(r.x), Math.round(r.y), Math.max(1, Math.round(r.w)), Math.max(1, Math.round(r.h))).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) n++;
        return { n: r.n, frac: n / (d.length / 4), w: r.w }; });
    }, { png: shot.toString('base64'), res });
    const empty = painted.filter(p => p.frac < 0.08 || p.w < 30);
    t.ok(empty.length === 0, `${mode[0]}：${painted.length} 个图标都画出了清楚的像素（最少 ${Math.min(...painted.map(p => p.frac)).toFixed(2)} 的面积）`, empty);
  }
  const sw = await pg.evaluate(() => {
    const n1 = HansenIcons.swapEmoji(document.getElementById('bar')), n2 = HansenIcons.swapEmoji(document.getElementById('bar'));
    const bar = document.getElementById('bar');
    return { n1, n2, svgs: bar.querySelectorAll('svg').length, text: bar.textContent.replace(/\s+/g, ' ').trim(), inp: document.getElementById('inp').value,
      other: document.getElementById('other').textContent, apple: bar.querySelector('b').textContent };
  });
  t.ok(sw.n1 === 5 && sw.n2 === 0 && sw.svgs === 5, 'swapEmoji 换了 5 个（🪙💎⭐⭐🔥），再调一次换 0 个', sw);
  t.ok(sw.text === '金币 1,280 · 钻石 36 · · 5 🍎' && sw.apple === '🍎', '文字和非货币 emoji（单词配图 🍎）原样保留', sw.text);
  t.ok(sw.inp === '🪙' && sw.other.startsWith('🪙'), '不碰输入框、不碰范围外的元素');
  const ok = await pg.evaluate(() => ({ pua: HansenIcons.emojiOk('\uE0FF'), a: HansenIcons.emojiOk('A'), coin: HansenIcons.emojiOk('🪙'), jelly: HansenIcons.emojiOk('🪼') }));
  t.ok(ok.pua === false && ok.a === true, 'emojiOk：认得出“空框”（私用区字符）和正常字符', ok);
  console.log('  （本机：🪙 ' + (ok.coin ? '能显示' : '空框') + '，🪼 ' + (ok.jelly ? '能显示' : '空框') + '；旧手机要真机看）');
  const a11y = await pg.evaluate(() => ({ def: HansenIcons.svg('coin'), lab: HansenIcons.svg('coin', { label: '金币 <3>' }) }));
  t.ok(/aria-hidden="true"/.test(a11y.def) && /role="img" aria-label="金币 &lt;3&gt;"/.test(a11y.lab), '读屏：默认不读；给 label 才读，并且转义');
  t.ok(errs.length === 0, '页面 0 报错', errs);
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
const failed = t.done();
process.exit(failed ? 1 : 0);
