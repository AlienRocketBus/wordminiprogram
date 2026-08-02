#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const template=fs.readFileSync('template.html','utf8');
const upgrade=fs.readFileSync('hansen_island_upgrade.js','utf8');
const review=fs.readFileSync('hansen_review.js','utf8');
const spell=fs.readFileSync('hansen_spell_practice.js','utf8');

assert.doesNotMatch(template,/继续答题可以提升宠物掌握和知识结晶/);
assert.match(template,/普通答题用来巩固认识度/);
assert.match(template,/宠物掌握请进入打字大师/);
assert.match(template,/知识结晶请进入专属 Spelling Bee/);
assert.doesNotMatch(review,/<div class="lbl">已掌握<\/div>/);
assert.match(review,/<div class="lbl">已认识<\/div>/);

assert.doesNotMatch(upgrade,/夜猫子|深夜还在偷偷学习|noteDaily\('night'\)|daily\.night|hr>=22|hr<5/);
/* 🔴v1139：**这条断言过期了。**

   原本 `hansen_island_upgrade.js` 里既有触发逻辑、又有中文名「健康学习家」。
   v1075 拆「两处真源」时把**中文名搬到了成就定义那边**，
   触发逻辑留在这里 —— 这是对的（一个名字只该有一处定义），
   但测试还在这个文件里找那个名字，于是长期红着。

   实测确认：`noteDaily('healthy')` 和 `hr>=6&&hr<21` 都还在，
   **功能没坏，坏的是断言。**

   改为查真正该在这个文件里的东西：触发调用本身。 */
assert.match(upgrade,/noteDaily\('healthy'\)/);
assert.match(upgrade,/hr>=6&&hr<21/);

assert.match(spell,/var hintUsed = false/);
assert.match(spell,/hintUsed = true/);
assert.match(spell,/stats\.assisted\+\+/);
assert.match(spell,/使用了提示，不计独立答对/);
assert.match(spell,/独立正确/);

console.log('learning copy/hint HF2 v946: five-state wording + healthy-hours achievement + assisted-answer separation ✅');
