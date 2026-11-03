// 主题 2.0 场景图实测（不联网、约 30 秒）
// 门禁里的场景取样色是“声明”出来的；这里去量真画面：
//   · 画廊 18 张照片：逐像素找最亮、最暗的点
//   · IMAX 8 个 canvas 场景：真跑 hansen_cinema_themes，在第 0.6 / 1.6 / 2.6 秒各截一帧，找最亮、最暗的点
// 然后把这个主题的遮罩（--t2-scrim）叠上去，遮罩上的字（on_scrim、hi）必须 ≥ 4.5。
// 用的是“最坏的那一个像素”，比取百分位更严：字放在场景的任何位置都看得清。
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, findOne, serve, browser, phone, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';

const t = scorer('主题 2.0 场景图实测');
const R = createRequire(import.meta.url)(path.join(ROOT, findOne(/^hansen_theme2_registry_v\d{4}\.js$/)));
const C = R.color;
const scenes = R.THEMES.filter(x => x.scene && (x.scene.kind === 'photo' || x.scene.kind === 'canvas'));
const page = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body>
<script src="/hansen_cinema_themes.js"></script></body></html>`;

/* 在页面里：返回一组像素里亮度最高/最低的颜色 */
const EXTREMES = `function(data){var lo=[255,255,255],hi=[0,0,0],L=1e9,H=-1;
  function l(r,g,b){function f(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);}
  for(var i=0;i<data.length;i+=4){var y=l(data[i],data[i+1],data[i+2]);if(y<L){L=y;lo=[data[i],data[i+1],data[i+2]];}if(y>H){H=y;hi=[data[i],data[i+1],data[i+2]];}}
  return {lo:lo,hi:hi};}`;

const srv = await serve({ '/__t2/art.html': page });
const br = await browser();
const results = [];
try {
  const ctx = await phone(br, srv.base);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(srv.base + '/__t2/art.html', { waitUntil: 'load' });
  for (const s of scenes) {
    let ext;
    if (s.scene.kind === 'photo') {
      ext = await pg.evaluate(async ({ img, EX }) => {
        const im = new Image(); im.src = '/' + img; await im.decode();
        const w = 240, h = Math.round(im.naturalHeight / im.naturalWidth * 240);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.drawImage(im, 0, 0, w, h);
        return [(0, eval)('(' + EX + ')')(c.getImageData(0, 0, w, h).data)];
      }, { img: s.scene.img, EX: EXTREMES });
    } else {
      await pg.evaluate(id => window.HansenCinema.apply(id), s.scene.id);
      ext = [];
      for (const ms of [600, 1000, 1000]) {
        await pg.waitForTimeout(ms);
        ext.push(await pg.evaluate(EX => {
          const cv = document.getElementById('hsnCinemaCanvas'); if (!cv) return null;
          const c = cv.getContext('2d');
          return (0, eval)('(' + EX + ')')(c.getImageData(0, 0, cv.width, cv.height).data);
        }, EXTREMES));
      }
      await pg.evaluate(() => window.HansenCinema.stop());
    }
    ext = ext.filter(Boolean);
    const v = R.roles(s.id), worst = { on_scrim: 99, hi: 99 };
    for (const e of ext) for (const px of [e.lo, e.hi]) {
      const comp = C.over(v.scrim, { r: px[0], g: px[1], b: px[2], a: 1 });
      worst.on_scrim = Math.min(worst.on_scrim, C.ratio(v.on_scrim, comp));
      worst.hi = Math.min(worst.hi, C.ratio(v.hi, comp));
    }
    results.push({ id: s.id, frames: ext.length, worst });
    t.ok(ext.length >= 1 && worst.on_scrim >= 4.5 && worst.hi >= 4.5,
      `${s.id}（${s.scene.kind === 'photo' ? '照片' : 'canvas ' + ext.length + ' 帧'}）：遮罩上的字最差 ${worst.on_scrim.toFixed(2)} / 数字 ${worst.hi.toFixed(2)}`, { ext });
  }
  const left = await pg.evaluate(() => ({ canvas: !!document.getElementById('hsnCinemaCanvas') }));
  t.ok(!left.canvas, '测完 canvas 已撤掉');
  t.ok(errs.length === 0, '页面 0 报错', errs);
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
t.ok(results.length === 26, `量了全部 26 个场景（画廊 18 + IMAX 8）`, results.length);
const failed = t.done();
process.exit(failed ? 1 : 0);
