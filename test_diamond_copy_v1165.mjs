/* test_diamond_copy_v1165.mjs —— 主题商店 / 金币说明书写的「钻石怎么来」和代码里真正发钻石的地方一致
 *
 * 复查（v1165 第 2 轮 R2-DIA1）：主题商店写「💎 钻石怎么来：在拼写蜂里认真拼对单词、打败 Boss、完成成就」，
 *   钻石不够的提示也这么说 —— 可打普通 Boss 只给金币、144 个成就里只有「第一颗钻石」给钻石；
 *   真正最容易拿钻石的「连续复习 7 / 14 / 30 天」反而没写（规则里也没有）。违反「不要乱写」。
 *
 * 合同（静态：读文案，再对照各模块里真正发钻石的代码）：
 *   ① 代码里发钻石的只有这些：聚焦拼写蜂五星结晶（hansen_crystal awardGem）、连续复习里程碑（MILESTONES 里 g>0 的 7/14/30）、
 *      Boss 大满贯 88、星海女帝终战、「第一颗钻石」成就（claimAch 只有 gem1 走钻石钱包）
 *   ② 商店的提示、钻石不够的提示：不再说「打败 Boss」「完成成就」能得钻石；写了「5 颗星」「连续复习 7 天」「大满贯 / 全部 Boss」
 *   ③ 商店的「规则」和金币说明书的钻石卡：都列了连续复习 7 / 14 / 30 天
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const shop = read('hansen_diamond_shop.js'), rw = read('hansen_review_rewards_v963.js'), up = read('hansen_island_upgrade.js'),
  rr = read('hansen_round_reward.js'), cr = read('hansen_crystal.js'), eg = read('hansen_econ_guide.js');

console.log('\n▶ ① 代码里真正发钻石的地方');
const ms = (rw.match(/var MILESTONES = (\{[^;]+\});/) || [])[1] || '';
const msObj = ms ? Function('return ' + ms)() : {};
const gemDays = Object.keys(msObj).filter(k => msObj[k].g > 0).map(Number);
ok(gemDays.join(',') === '7,14,30' && msObj[7].g === 5 && msObj[14].g === 10 && msObj[30].g === 20, `连续复习里程碑给钻石：${gemDays.map(d => d + '天 ' + msObj[d].g + '💎').join('、')}`);
ok(/id==='gem1'\?\(window\.HansenGems/.test(up), '成就里只有「第一颗钻石」(gem1) 走钻石钱包，别的成就给金币');
ok(/addGems\(88\)/.test(rr), 'Boss 大满贯给 88 钻石');
ok(/function awardGem\(/.test(cr) && /HansenGems\.award\(source,n\)/.test(cr), '聚焦拼写蜂五星结晶（hansen_crystal）给钻石');

console.log('\n▶ ② 孩子看的提示');
const tip = (shop.match(/'<div class="dia-tip">([^<]*)'/) || [])[1] || '';
const toast = (shop.match(/shopToast\('(钻石不够啦！[^']*)'\)/) || [])[1] || '';
for (const [label, t] of [['商店提示', tip], ['钻石不够的提示', toast]]) {
  ok(t && !/打败 Boss、完成成就|打败 Boss|完成成就/.test(t), `${label}不再说「打败 Boss」「完成成就」能得钻石（${t}）`);
  ok(/5 颗星/.test(t) && /连续复习 7 天/.test(t) && /(大满贯|全部 Boss)/.test(t), `${label}写了「5 颗星」「连续复习 7 天」「一轮打败全部 Boss」`);
}

console.log('\n▶ ③ 规则 / 金币说明书');
const rules = (shop.match(/钻石只来自：([^<]*)<\/details>/) || [])[1] || '';
ok(/连续复习 7 \/ 14 \/ 30 天/.test(rules), `商店「规则」列了连续复习 7 / 14 / 30 天（${rules.slice(0, 60)}…）`);
ok(/row\('连续复习 7 天', '得到 5 钻石'/.test(eg), '金币说明书的钻石卡有「连续复习 7 天 → 得到 5 钻石」');
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 钻石怎么来写的都是真的');
process.exit(fails ? 1 : 0);
