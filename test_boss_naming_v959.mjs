#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

// v959 玩家命名合同：产品名称就是 Boss，且这是用户锁定的产品名；以后若想
// 改成任何同义词，必须先得到用户明确许可。任何进入运行包的 HTML/JS 都不得
// 再把 Boss 改叫“首领”。README、CHANGELOG 和历史文档不属于运行界面，保留
// 原文以避免篡改旧版本事实。
const excludedDirs = new Set([
  'node_modules', 'docs', '.devtools', '.github', 'evolution_reports', '__pycache__',
  // package_release.py 明确不把这两个原型目录放进部署包；命名合同与正式部署边界保持一致。
  'map8', 'newboss'
]);
function collectRuntimeFiles(dir, relative = '') {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name) && !/^release(?:_|$)/.test(entry.name)) {
        found.push(...collectRuntimeFiles(path.join(dir, entry.name), rel));
      }
    } else if (/\.(?:html|js|css)$/.test(entry.name)) {
      found.push(rel);
    }
  }
  return found;
}
const runtimeFiles = collectRuntimeFiles(ROOT).sort();

const forbiddenForms = [
  ['直接文字', /首领/u],
  ['Unicode 转义', /\\u(?:\{0*9996\}|0*9996)\s*\\u(?:\{0*9886\}|0*9886)/iu],
  ['HTML 实体', /&#(?:x0*9996|0*39318);?\s*&#(?:x0*9886|0*39046);?/iu],
  ['URL 百分号编码', /%e9%a6%96(?:\s|%20|%0a|%0d)*%e9%a2%86/iu],
  ['CSS 转义', /\\0*9996(?:\s+)?\\0*9886/iu],
  ['字符串拼接', /["'`]首["'`]\s*\+\s*["'`]领["'`]/u],
  ['转义字符串拼接', /["'`]\\u(?:\{0*9996\}|0*9996)["'`]\s*\+\s*["'`]\\u(?:\{0*9886\}|0*9886)["'`]/iu],
  ['字符码拼接', /String\.(?:fromCharCode|fromCodePoint)\(\s*(?:39318|0x0*9996)\s*,\s*(?:39046|0x0*9886)\s*\)/iu],
  ['数组拼接', /\[\s*["'`]首["'`]\s*,\s*["'`]领["'`]\s*\]\.join\(\s*["'`]["'`]\s*\)/u],
  ['concat 拼接', /["'`]首["'`]\.concat\(\s*["'`]领["'`]\s*\)/u]
];
function detectForbiddenForms(source) {
  return forbiddenForms.filter(([, pattern]) => pattern.test(source)).map(([form]) => form);
}

// 先证明防线本身真能抓住常见规避写法，避免以后重构成“测试通过但一绕就过”。
const attackSamples = new Map([
  ['直接文字', '首领'],
  ['Unicode 四位转义', String.raw`\u9996\u9886`],
  ['Unicode code point 转义', String.raw`\u{9996}\u{9886}`],
  ['HTML 十六进制实体', '&#x9996;&#x9886;'],
  ['HTML 十进制实体', '&#39318;&#39046;'],
  ['URL 百分号编码', '%E9%A6%96%E9%A2%86'],
  ['CSS 转义', String.raw`\9996\9886`],
  ['直接字符串拼接', "'首' + '领'"],
  ['转义字符串拼接', String.raw`'\u9996' + '\u9886'`],
  ['fromCharCode 十进制', 'String.fromCharCode(39318, 39046)'],
  ['fromCodePoint 十六进制', 'String.fromCodePoint(0x9996, 0x9886)'],
  ['数组 join', "['首', '领'].join('')"],
  ['concat', "'首'.concat('领')"]
]);
for (const [name, sample] of attackSamples) {
  assert.ok(detectForbiddenForms(sample).length > 0, `Boss 命名防线漏掉攻击样例：${name}`);
}

const forbidden = [];
for (const name of runtimeFiles) {
  const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
  for (const form of detectForbiddenForms(source)) {
    forbidden.push(`${name}（${form}）`);
  }
}
assert.deepEqual(
  forbidden,
  [],
  `玩家运行文件仍出现“首领”，必须统一恢复为 Boss：${forbidden.join(', ')}`
);

const roundBar = read('hansen_round_bar.js');
for (const phrase of [
  '还差 <b class="rb-remain">',
  '个 Boss，完成本轮得',
  '本轮全部 Boss 已核验',
  '个 Boss</div>',
  '每个 Boss 每轮只计算 1 次'
]) {
  assert.ok(roundBar.includes(phrase), `Boss 逐轮进度缺少正式文案：${phrase}`);
}

const roundReward = read('hansen_round_reward.js');
assert.ok(
  roundReward.includes("个 Boss 各胜 1 次，已全部核验"),
  'Boss 逐轮结算说明没有使用正式 Boss 名称'
);

const guide = read('hansen_econ_guide.js');
for (const phrase of [
  "row('打赢 Boss'",
  "row('完成一轮 Boss'",
  '每个 Boss 各胜一次',
  "row('挑战 Boss'"
]) {
  assert.ok(guide.includes(phrase), `设置速查缺少正式 Boss 文案：${phrase}`);
}

console.log(`PASS v959 Boss 命名合同：${runtimeFiles.length} 个部署 HTML/JS/CSS 不再出现“首领”`);
