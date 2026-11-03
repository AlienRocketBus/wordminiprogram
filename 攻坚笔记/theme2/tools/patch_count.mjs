// 亮色补丁层还剩多少（主题 2.0 迁移的进度指标：每迁移一个组件就删掉它的补丁，目标 0）
// 用法：node 攻坚笔记/theme2/tools/patch_count.mjs [--json]
// 做法：在真浏览器里用亮色配色加载 hansen_palette.js，数它注入的 #hsnPaletteCSS 里有多少条规则、
//      多少个 [style*=…]（“行内写了某个颜色就换掉”）选择器、多少个 !important。
import { serve, browser } from './testkit.mjs';

export async function countPatch() {
  const page = `<!doctype html><html><head><meta charset="utf-8"><script>localStorage.setItem('hansen_palette_global','cloud');</script>
<script src="/hansen_palette.js"></script></head><body></body></html>`;
  const srv = await serve({ '/__t2/pc.html': page });
  const br = await browser();
  try {
    const ctx = await br.newContext(); await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, r => r.abort());
    const pg = await ctx.newPage(); await pg.goto(srv.base + '/__t2/pc.html', { waitUntil: 'load' });
    await pg.waitForFunction(() => document.getElementById('hsnPaletteCSS'), null, { timeout: 5000 }).catch(() => {});
    return await pg.evaluate(() => {
      const st = document.getElementById('hsnPaletteCSS'); if (!st || !st.sheet) return null;
      let rules = 0, selectors = 0, styleAttr = 0, important = 0;
      const walk = list => { for (const r of list) { if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; } if (!r.selectorText) continue;
        rules++; const sels = r.selectorText.split(','); selectors += sels.length; styleAttr += sels.filter(s => /\[style\*=/.test(s)).length;
        important += (r.cssText.match(/!important/g) || []).length; } };
      walk(st.sheet.cssRules);
      return { bytes: st.textContent.length, rules, selectors, styleAttrSelectors: styleAttr, important };
    });
  } finally { await br.close().catch(() => {}); await srv.close(); }
}

if (process.argv[1] && process.argv[1].endsWith('patch_count.mjs')) {
  const r = await countPatch();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else console.log(r ? `亮色补丁层（云端白）：${r.bytes} 字节、${r.rules} 条规则、${r.selectors} 个选择器，其中 [style*=…] ${r.styleAttrSelectors} 个、!important ${r.important} 个` : '没找到 #hsnPaletteCSS');
}
