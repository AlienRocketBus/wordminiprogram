#!/usr/bin/env node
// 主题 2.0 构建：从 hansen_theme2_registry 生成 theme2_tokens.css（颜色只在 registry 里改）。
// 用法：node 攻坚笔记/theme2/tools/theme2_build.mjs          → 重新生成
//       node 攻坚笔记/theme2/tools/theme2_build.mjs --check  → 只比对，CSS 落后于 registry 就退出码 1
// 放在 攻坚笔记/ 下：cloudbaserc 忽略整个目录，package_release 不打包 .mjs → 永远不会发到线上。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);

export function findRegistry(dir = ROOT) {
  const f = fs.readdirSync(dir).filter(n => /^hansen_theme2_registry_v\d{4}\.js$/.test(n)).sort();
  if (f.length !== 1) throw new Error('应该正好有 1 个 hansen_theme2_registry_v*.js，实际 ' + f.length);
  return path.join(dir, f[0]);
}
export function loadRegistry(dir = ROOT) {
  const p = findRegistry(dir);
  delete require.cache[require.resolve(p)];
  return require(p);
}
const cssVar = k => '--t2-' + k.replace(/_/g, '-');

export function buildCSS(R) {
  const out = [];
  out.push('/* theme2_tokens.css — 主题 2.0 颜色角色。由 攻坚笔记/theme2/tools/theme2_build.mjs 从 hansen_theme2_registry 自动生成，不要手改。');
  out.push('   用法：<html data-t2-theme="…" data-t2-base="…" data-t2-mode="…">（registry 的 apply() 会写好）；');
  out.push('   组件只许用 var(--t2-*)。默认（没有属性时）= 深空蓝。所有主题都过了对比度门禁。 */');
  const shared = [];
  for (const [k, [a, b]] of Object.entries(R.FEATURE)) shared.push(`--t2-f-${k}-a:${a}`, `--t2-f-${k}-b:${b}`);
  shared.push(`--t2-hero-a:${R.HERO[0]}`, `--t2-hero-b:${R.HERO[1]}`);
  for (const [k, v] of Object.entries(R.FONTS)) shared.push(`--t2-font-${k}:${v}`);
  for (const [n, px] of R.TYPE) shared.push(`--t2-fs-${n}:${px}px`);
  shared.push('--t2-lh-tight:1.2', '--t2-lh-body:1.5');
  R.SPACE.forEach((px, i) => shared.push(`--t2-sp-${i + 1}:${px}px`));
  for (const [k, px] of Object.entries(R.RADIUS)) shared.push(`--t2-r-${k}:${px}px`);
  for (const [k, ms] of Object.entries(R.MOTION)) shared.push(`--t2-m-${k}:${ms}ms`);
  for (const [k, v] of Object.entries(R.EASE)) shared.push(`--t2-ease-${k}:${v}`);
  for (const [k, v] of Object.entries(R.Z)) shared.push(`--t2-z-${k}:${v}`);
  shared.push('--t2-tap:48px');
  out.push(':root{' + shared.join(';') + '}');
  // 基础角色：:root 默认深空蓝；任何元素都能用 data-t2-base 局部换（主题预览卡用得到）
  for (const [id, v] of Object.entries(R.BASES)) {
    const sel = id === 'cosmos' ? ':root,[data-t2-base="cosmos"]' : `[data-t2-base="${id}"]`;
    const body = R.ROLE_KEYS.map(k => {
      if (v[k] == null) throw new Error(`基础角色 ${id} 缺 ${k}`);
      return `${cssVar(k)}:${v[k]}`;
    });
    const e = R.ELEVATION[R.BASE_MODE[id]];
    body.push(`--t2-e-1:${e[0]}`, `--t2-e-2:${e[1]}`, `--t2-e-3:${e[2]}`, `--t2-mode:${R.BASE_MODE[id]}`);
    out.push(`${sel}{${body.join(';')}}`);
  }
  // 主题差异（只有装饰背景），写在基础角色之后 → 同优先级后者生效
  for (const t of R.THEMES) {
    if (!t.over) continue;
    const body = Object.entries(t.over).map(([k, v]) => {
      if (!R.ROLES[k]) throw new Error(`主题 ${t.id} 改了不存在的角色 ${k}`);
      return `${cssVar(k)}:${v}`;
    });
    out.push(`[data-t2-theme="${t.id}"]{${body.join(';')}}`);
  }
  // 画廊照片场景：只有装备了这个主题（<html data-t2-scene>）才会去下载这张图
  for (const t of R.THEMES) {
    if (!t.scene || t.scene.kind !== 'photo') continue;
    out.push(`[data-t2-scene="${t.scene.id}"] .t2-scene{background-image:url('${t.scene.img}')}`);
  }
  return out.join('\n') + '\n';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const R = loadRegistry();
  const css = buildCSS(R);
  const dst = path.join(ROOT, 'theme2_tokens.css');
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(dst) ? fs.readFileSync(dst, 'utf8') : '';
    if (cur !== css) { console.error('❌ theme2_tokens.css 和 registry 不一致：请运行 node 攻坚笔记/theme2/tools/theme2_build.mjs'); process.exit(1); }
    console.log('✅ theme2_tokens.css 与 registry 一致（' + css.length + ' 字节）');
  } else {
    fs.writeFileSync(dst, css);
    console.log('已生成 theme2_tokens.css：' + css.length + ' 字节，' + Object.keys(R.BASES).length + ' 套基础角色，' + R.THEMES.length + ' 个主题');
  }
}
