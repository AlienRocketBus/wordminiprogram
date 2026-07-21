import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const pages = [
  'template.html',
  ...fs.readdirSync(ROOT).filter((name) => /^island_[^.]+\.html$/.test(name)).sort(),
];

assert.equal(pages.length, 28, '生成模板和 27 个岛屿页必须全部参加日常卡片回归');

const contract = [
  '.daily-card:not(.boss-card){display:flex;flex-direction:column;align-items:center;justify-content:flex-start}',
  '.daily-card:not(.boss-card) .d-icon{width:100%;height:91px;min-height:91px;margin:0;display:flex;align-items:flex-end;justify-content:center;line-height:0}',
  '.daily-card:not(.boss-card) .d-icon>.qiw{display:block;width:min(91px,100%);max-width:100%;aspect-ratio:1/1;line-height:0;flex:none}',
  '.daily-card:not(.boss-card) .d-icon>.qiw>img{display:block;width:100%!important;height:100%!important;aspect-ratio:1/1;object-fit:contain}',
  '.daily-card:not(.boss-card) .d-label{position:absolute;left:0;right:0;bottom:3px;margin:0;transform:none;white-space:nowrap}',
  '#chestCard .d-icon>.qiw{transform:translateY(2.7778%)!important}',
  '#chestCard.chest-claimed .d-icon>.qiw{transform:translateY(0)!important}',
  '#questCard .d-icon>.qiw{transform:translateY(3.125%)!important}',
  '.daily-card:not(.boss-card) .d-icon{height:82px;min-height:82px;display:flex}',
  '.daily-card:not(.boss-card) .d-icon>.qiw{width:min(82px,100%);max-width:100%}',
];

// 这是用户指定的只读基准。v954 只能校准左侧两卡，不能顺手移动挑战 BOSS。
const bossContract = [
  '.daily-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 14px;margin-bottom:0}',
  '.daily-card{background:linear-gradient(135deg,var(--c1),var(--c2));border-radius:14px;padding:3px 6px;text-align:center;cursor:pointer;position:relative;transition:all .15s;border:1px solid rgba(255,255,255,.1)}',
  '.daily-card.boss-card{padding:3px 3px 3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}',
  '.daily-card.boss-card .boss-card-img{width:91px;height:91px;object-fit:contain;display:block;',
  '.daily-card.boss-card .boss-card-label{font-size:15px;font-weight:900;',
  'margin-top:5px;',
];

for (const name of pages) {
  const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
  for (const needle of contract) {
    assert.equal(html.split(needle).length - 1, 1, `${name}: 缺少或重复 v954 对齐合同：${needle}`);
  }
  for (const needle of bossContract) {
    assert.ok(html.includes(needle), `${name}: 挑战 BOSS 锁定基准被改动：${needle}`);
  }

  assert.equal((html.match(/id="chestCard"/g) || []).length, 1, `${name}: 每日宝箱入口必须唯一`);
  assert.equal((html.match(/id="questCard"/g) || []).length, 1, `${name}: 每日任务入口必须唯一`);
  assert.equal((html.match(/class="daily-card boss-card"/g) || []).length, 1, `${name}: 挑战 BOSS 入口必须唯一`);
  assert.ok(
    html.indexOf('id="chestCard"') < html.indexOf('id="questCard"')
      && html.indexOf('id="questCard"') < html.indexOf('class="daily-card boss-card"'),
    `${name}: 三卡顺序必须保持 每日宝箱 → 每日任务 → 挑战BOSS`,
  );

  assert.ok(!/#chestCard \.d-label\{transform:translateY\(/.test(html), `${name}: 旧宝箱标题位移会再次造成下溢`);
  assert.ok(!/#chestCard\.chest-claimed \.d-label\{transform:translateY\(/.test(html), `${name}: 旧已领取标题位移会再次造成下溢`);
  assert.ok(!html.includes('line-height:0;vertical-align:middle;transform:translate(0,10px)'), `${name}: 待领取宝箱仍残留旧 10px 包装层位移`);
  assert.ok(!html.includes('line-height:0;vertical-align:middle;transform:translate(0,3px)'), `${name}: 已领取宝箱仍残留旧 3px 包装层位移`);
  assert.ok(!html.includes('width:98px;height:98px;object-fit:contain;vertical-align:middle'), `${name}: 已领取宝箱仍为 98px，会再次溢出`);

  const start = html.indexOf('/* 🔴 v954: 右侧挑战BOSS是锁定基准。');
  const end = html.indexOf('.daily-card .d-sub', start);
  assert.ok(start >= 0 && end > start, `${name}: 无法定位 v954 专属样式块`);
  const v954Block = html.slice(start, end);
  assert.ok(!/\.boss-card\s*\{/.test(v954Block.replaceAll(':not(.boss-card)', '')), `${name}: v954 不得直接改写右侧基准`);
}

// 在 91px 标准槽和 82px 极窄槽中，两种透明补偿都把可见底边落到槽底；
// 允许的浮点误差远小于一个设备像素。
for (const size of [91, 82]) {
  const goldBottom = size * (280 / 288 + 0.027778);
  const taskBottom = size * (279 / 288 + 0.03125);
  assert.ok(Math.abs(goldBottom - size) < 0.01, `${size}px 金箱可见底没有对齐槽底`);
  assert.ok(Math.abs(taskBottom - size) < 0.01, `${size}px 任务图标可见底没有对齐槽底`);
}

// 2.7778%/3.125% 是依据这四张 288px 透明素材的可见底边计算的。素材一换，必须重新量边界，
// 不能继续沿用旧补偿值，否则“CSS 方框对齐、肉眼却不齐”的问题会复发。
const assetHashes = {
  'icons/chest_gold.webp': 'd04d8597a02cec4425fd541277391a2f2e6aaa1c26f9cd8669840b13c7ee6fba',
  'icons/chest_open.webp': '8416fe162b005b2c1f65e7d871deeac4700252a5a189c9c9deed4f72623e2c9e',
  'icons/task_3d.webp': '68a05ba0afd8ce0ea493785f793eddce1f6991852ccf38444cc9f9b60ec1551a',
  'icons/boss_arcade.webp': 'c225d5f8674346f1689e7867ccf579f20e89a81265ff91cfdd5bc8c6c2cc3d90',
};
for (const [name, expected] of Object.entries(assetHashes)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, name))).digest('hex');
  assert.equal(actual, expected, `${name}: 素材透明边界已变化，必须重新计算对齐补偿`);
}

console.log(`PASS v954 daily-card alignment contract: ${pages.length} pages; boss baseline locked; assets pinned`);
