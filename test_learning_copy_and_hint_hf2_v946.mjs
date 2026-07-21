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
assert.match(upgrade,/健康学习家/);
assert.match(upgrade,/hr>=6&&hr<21/);

assert.match(spell,/var hintUsed = false/);
assert.match(spell,/hintUsed = true/);
assert.match(spell,/stats\.assisted\+\+/);
assert.match(spell,/使用了提示，不计独立答对/);
assert.match(spell,/独立正确/);

console.log('learning copy/hint HF2 v946: five-state wording + healthy-hours achievement + assisted-answer separation ✅');
