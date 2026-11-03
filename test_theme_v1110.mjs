const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_theme_v1110.mjs —— 亮色/暗色两套主题
 *
 * 问题：v1107/v1108 新做的好友页、天梯页、对战屏**全是写死的深色十六进制**。
 * 全站早有配色系统（选亮色系时 `<html>` 加 `hsn-pal-light`），
 * 但这几屏不跟着变 —— 用户切了主题却有几屏还是黑的。
 *
 * 🔴 修的过程中我自己造了个更隐蔽的 bug：
 *   批量把 `#e2e8f0` 替换成 `var(--xx-txt)` 时，
 *   **连变量定义块里的颜色值也一起换了** →
 *     `--hpk-txt: var(--hpk-txt)`   自我引用
 *     `--hpk-txt: var(--hpk-card)`  指向卡片色（白）
 *   结果亮色下标题白底白字、对比度 1.0，完全看不见。
 *
 *   **教训：批量替换要排除定义处。** 定义和引用长得一样，
 *   正则分不出来，得靠人先想到。
 *
 * 合同：
 *   ① 三个界面都用变量，不留写死的深色
 *   ② 变量定义里不许出现自我引用 / 指向别的变量
 *   ③ 变量名带独有前缀，不与全站 palette 撞名
 *      （第一版用了 `--fr-txt`，而 palette 已在用，亮色下被设成 #ffffff）
 *   ④ 亮暗两套都要有完整定义
 */
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('亮色/暗色主题 v1110');

const FILES = [
  ['hansen_friends_ui_v1107.js', 'hpk'],
  ['hansen_ladder_ui_v1108.js', 'hpk'],
  ['hansen_pk_room_ui_v1065.js', 'pk']
];

for (const [fn, pfx] of FILES) {
  const src = fs.readFileSync((__HSN_ROOT + '') + fn, 'utf8');
  /* 变量定义是 JS 字符串拼接（'xx' + 'yy'），先把引号和加号剥掉再匹配，
     否则跨行的定义块永远匹配不到 —— 第一版就栽在这，
     测试报"没有亮色定义"而实际是有的（守卫查形不查实的又一例）。 */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'\s*\+\s*'/g, '');
  const short = fn.replace('hansen_', '').replace('.js', '');

  /* ① 有亮暗两套定义 */
  ok(new RegExp('html:root\\{--' + pfx + '-').test(code), `${short}: 有暗色（默认）变量定义`);
  ok(new RegExp('hsn-pal-light[^{]*\\{--' + pfx + '-').test(code), `★ ${short}: 有亮色变量定义`);

  /* ② 变量定义里不许自我引用或指向别的变量 —— 我就栽在这 */
  const defs = code.match(new RegExp('--' + pfx + '-[a-z0-9-]+:\\s*var\\(', 'g')) || [];
  ok(defs.length === 0,
     `★ ${short}: 变量定义里没有 var() 引用（实得 ${defs.length} 处）—— 自我引用会让颜色失控`);

  /* ③ 关键文字用变量而不是写死 */
  const hard = (code.match(/color:#[0-9a-fA-F]{6}/g) || [])
    .filter(x => !/#fff|#ffffff/i.test(x));
  ok(hard.length <= 2, `${short}: 写死的文字色 ≤2 处（实得 ${hard.length}）`);
}

/* ④ 不与全站 palette 撞名 */
{
  const pal = fs.readFileSync((__HSN_ROOT + 'hansen_palette.js'), 'utf8');
  const mine = new Set();
  for (const [fn] of FILES) {
    const s = fs.readFileSync((__HSN_ROOT + '') + fn, 'utf8');
    (s.match(/--(?:hpk|pk)-[a-z0-9-]+/g) || []).forEach(v => mine.add(v));
  }
  const clash = [...mine].filter(v => pal.includes(v));
  ok(clash.length === 0,
     `★ 变量名不与全站 palette 撞名（撞了 ${clash.length} 个）—— ` +
     `第一版用 --fr-txt 就撞了，亮色下被设成 #ffffff、标题变白底白字`);
  ok(mine.size >= 12, `变量够用（${mine.size} 个）`);
}

/* ⑤ 亮色定义里的文字色必须是深色（否则白底白字） */
{
  for (const [fn, pfx] of FILES) {
    const s = fs.readFileSync((__HSN_ROOT + '') + fn, 'utf8');
    /* 只在**亮色块内部**找 —— 之前的正则会跨过块边界匹到暗色的值，
       报"亮色下文字是浅色"其实是误判。先切出亮色那一段再查。 */
    const code2 = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/'\s*\+\s*'/g, '');
    const li = code2.indexOf('hsn-pal-light');
    const seg = li >= 0 ? code2.slice(li, code2.indexOf('}', li)) : '';
    const m = seg.match(new RegExp("--" + pfx + "-txt:\\s*(#[0-9a-fA-F]{6})"));
    if (!m) { ok(false, `${fn}: 找不到亮色的 txt 定义`); continue; }
    const hex = m[1];
    const lum = parseInt(hex.slice(1, 3), 16) * .299 + parseInt(hex.slice(3, 5), 16) * .587
              + parseInt(hex.slice(5, 7), 16) * .114;
    ok(lum < 100, `★ ${fn.replace('hansen_', '')}: 亮色下文字是深色 ${hex}（亮度 ${Math.round(lum)}）`);
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
