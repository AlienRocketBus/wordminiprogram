#!/usr/bin/env node
// 主题 2.0 对比度门禁：每个主题 × 每对“字/图标压在什么上”的组合算 WCAG 对比度。
//   正文 ≥ 4.5，大字（≥24px 或 ≥18.66px 加粗）≥ 3，图标/边框/焦点框 ≥ 3。
//   有一对不达标 → 退出码 1（不让上线）。
// 用法：node 攻坚笔记/theme2/tools/theme2_contrast.mjs [--json 报告路径] [--quiet]
// 放在 攻坚笔记/ 下：不会被部署。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry } from './theme2_build.mjs';

export const NEED = { text: 4.5, large: 3, icon: 3 };
/* 两个主题至少要有多不一样（CIE ΔE，任一背景段）：TV-13 暗夜紫≈深空蓝 */
export const MIN_DISTINCT = 10;

/* 一个主题要检查的全部组合 */
export function pairsFor(R, id) {
  const t = R.get(id), v = R.roles(id), C = R.color, P = [];
  const scene = t.scene && t.scene.samples ? t.scene.samples : null;
  const add = (tier, fg, bgName, bg, fgName) => P.push({ tier, fg: fgName || fg, bg: bgName, fgColor: v[fg] || fg, bgColor: bg });
  const solid = k => C.hex(C.parse(v[k]));
  // ① 卡片上的四级文字
  for (const fg of ['ink_1', 'ink_2', 'ink_3', 'hi']) for (const bg of ['surface_1', 'surface_2']) add('text', fg, bg, solid(bg));
  add('text', 'ink_1', 'surface_3', solid('surface_3'));
  // ② 直接压在页面背景上的字（标题、说明）：背景三段 × 每团星云最浓处都算
  //    场景主题的页面字一律放在遮罩上（③），不直接压在画上
  const bgs = [];
  for (const b of ['bg_1', 'bg_2', 'bg_3']) {
    bgs.push([b, solid(b)]);
    for (const n of ['neb_1', 'neb_2', 'neb_3']) bgs.push([b + '+' + n, C.hex(C.over(v[n], v[b]))]);
  }
  if (!scene) for (const [name, col] of bgs) { add('text', 'ink_1', name, col); add('text', 'ink_2', name, col); add('text', 'hi', name, col); }
  // ③ 遮罩：叠在页面背景和场景图的每个取样色上
  const under = scene ? scene.map((s, i) => ['scene#' + i + s, s]).concat(bgs) : bgs;
  for (const [name, col] of under) {
    const comp = C.hex(C.over(v.scrim, col));
    add('text', 'on_scrim', 'scrim∘' + name, comp);
    add('text', 'hi', 'scrim∘' + name, comp);
  }
  // ④ 顶栏、底栏
  add('text', 'chrome_ink', 'chrome', solid('chrome'));
  add('text', 'nav_ink', 'nav', solid('nav')); add('text', 'nav_ink_on', 'nav', solid('nav'));
  // ⑤ 按钮、对错、角标、首页大卡
  for (const bg of ['accent_1', 'accent_2']) add('text', 'on_accent', bg, solid(bg));
  for (const bg of ['brand_1', 'brand_2']) add('text', 'on_brand', bg, solid(bg));
  add('text', 'on_good_surface', 'good_surface', solid('good_surface'));
  add('text', 'on_bad_surface', 'bad_surface', solid('bad_surface'));
  add('text', 'on_badge', 'badge_bg', solid('badge_bg'));
  add('text', '#FFFFFF', 'hero_a', R.HERO[0], 'white'); add('text', '#FFFFFF', 'hero_b', R.HERO[1], 'white');
  // ⑥ 彩色玩法卡上的标签底板：叠在 9 种卡色的每一个渐变端点上（最坏情况）
  for (const [k, [a, b]] of Object.entries(R.FEATURE)) for (const [end, col] of [['a', a], ['b', b]]) {
    add('text', 'on_plate', `plate∘f-${k}-${end}`, C.hex(C.over(v.plate, col)));
  }
  // ⑦ 图标 / 边框 / 焦点框 ≥ 3（有描边的图标取填充和描边里好的那个）
  for (const fg of ['good', 'bad', 'warn', 'focus', 'line_strong', 'gem', 'xp_1', 'xp_2']) for (const bg of ['surface_1', 'surface_2']) add('icon', fg, bg, solid(bg));
  for (const [fill, rim] of [['coin', 'coin_rim'], ['star', 'star_rim']]) for (const bg of ['surface_1', 'surface_2', 'chrome']) {
    const best = C.ratio(v[fill], v[bg]) >= C.ratio(v[rim], v[bg]) ? fill : rim;
    add('icon', best, bg, solid(bg), fill + '|' + rim);
  }
  add('icon', 'good', 'good_surface', solid('good_surface')); add('icon', 'bad', 'bad_surface', solid('bad_surface'));
  for (const b of ['bg_1', 'bg_2', 'bg_3']) add('icon', 'focus', b, solid(b));
  add('icon', 'badge_bg', 'surface_1', solid('surface_1'));
  return P.map(p => {
    const r = C.ratio(p.fgColor, p.bgColor);
    return { ...p, ratio: Math.round(r * 100) / 100, need: NEED[p.tier], ok: r >= NEED[p.tier] };
  });
}

/* 每两个“孩子能选的”主题，背景要看得出不一样（同一主题的打Boss舞台变体除外） */
export function distinctness(R) {
  const C = R.color, pick = R.THEMES.filter(t => ['palette', 'season', 'coin'].includes(t.family));
  const sig = id => { const v = R.roles(id); return ['bg_1', 'bg_2', 'bg_3'].map(k => v[k]).concat(['neb_1', 'neb_2', 'neb_3'].map(n => C.hex(C.over(v[n], v.bg_2)))); };
  const res = [];
  for (let i = 0; i < pick.length; i++) for (let j = i + 1; j < pick.length; j++) {
    const a = sig(pick[i].id), b = sig(pick[j].id);
    const d = Math.max(...a.map((x, k) => C.deltaE(x, b[k])));
    res.push({ a: pick[i].id, b: pick[j].id, deltaE: Math.round(d * 10) / 10, ok: d >= MIN_DISTINCT });
  }
  return res;
}

export function runGate(R) {
  const themes = {}; let fails = 0, pairs = 0;
  for (const t of R.THEMES) {
    const all = pairsFor(R, t.id), bad = all.filter(x => !x.ok);
    fails += bad.length; pairs += all.length;
    const m = tier => { const a = all.filter(x => x.tier === tier).map(x => x.ratio); return a.length ? Math.min(...a) : null; };
    themes[t.id] = { name: t.name, family: t.family, mode: t.mode, base: t.base, pairs: all.length, fail: bad.length, minText: m('text'), minIcon: m('icon'), bad, all };
  }
  const distinct = distinctness(R), notDistinct = distinct.filter(d => !d.ok);
  return { ok: fails === 0 && notDistinct.length === 0, fails, pairs, themes, distinct, notDistinct };
}

export function toMarkdown(rep) {
  const L = ['| 主题 | id | 类型 | 明暗 | 检查对数 | 不达标 | 最低文字 | 最低图标 |', '|---|---|---|---|---:|---:|---:|---:|'];
  for (const [id, r] of Object.entries(rep.themes)) L.push(`| ${r.name} | \`${id}\` | ${r.family} | ${r.mode} | ${r.pairs} | ${r.fail} | ${r.minText} | ${r.minIcon} |`);
  const dmin = rep.distinct.reduce((a, b) => (a && a.deltaE < b.deltaE ? a : b), null);
  L.push('', `共 ${Object.keys(rep.themes).length} 个主题、${rep.pairs} 对，不达标 ${rep.fails} 对；可选主题两两最小背景差 ΔE=${dmin ? dmin.deltaE + '（' + dmin.a + ' vs ' + dmin.b + '）' : '-'}，门槛 ${MIN_DISTINCT}。`);
  return L.join('\n') + '\n';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const R = loadRegistry();
  const rep = runGate(R);
  const ji = process.argv.indexOf('--json');
  if (ji > 0) {
    const out = path.resolve(process.argv[ji + 1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const slim = { ...rep, themes: Object.fromEntries(Object.entries(rep.themes).map(([k, v]) => [k, { ...v, all: v.all.map(({ fgColor, bgColor, ...x }) => ({ ...x, fgColor, bgColor })) }])) };
    fs.writeFileSync(out, JSON.stringify(slim, null, 1));
    fs.writeFileSync(out.replace(/\.json$/, '.md'), toMarkdown(rep));
  }
  if (!process.argv.includes('--quiet')) {
    for (const [id, r] of Object.entries(rep.themes)) {
      console.log(`${r.fail ? '❌' : '✅'} ${id.padEnd(22)} ${r.mode.padEnd(5)} 对数 ${r.pairs}  最低文字 ${r.minText}  最低图标 ${r.minIcon}` +
        (r.fail ? '  ' + r.bad.map(b => `${b.fg} on ${b.bg} = ${b.ratio} < ${b.need}`).join('; ') : ''));
    }
    for (const d of rep.notDistinct) console.log(`❌ 太像：${d.a} vs ${d.b} ΔE=${d.deltaE} < ${MIN_DISTINCT}`);
  }
  console.log(rep.ok ? `✅ 对比度门禁通过：${Object.keys(rep.themes).length} 个主题、${rep.pairs} 对全部达标` : `❌ 对比度门禁不通过：${rep.fails} 对不达标、${rep.notDistinct.length} 组主题太像`);
  process.exit(rep.ok ? 0 : 1);
}
