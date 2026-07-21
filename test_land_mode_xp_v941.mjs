import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const TYPING_REWARDS = [
  {xpPerWord:5, gemBonus:12, petXp:25},
  {xpPerWord:10, gemBonus:25, petXp:40},
  {xpPerWord:18, gemBonus:50, petXp:70}
];
const CLOZE_REWARDS = [
  {xpPerQ:5, gemBonus:15, petXp:30},
  {xpPerQ:8, gemBonus:25, petXp:45},
  {xpPerQ:14, gemBonus:40, petXp:65}
];

function extractExpression(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  const valueStart = start + startMarker.length;
  const end = source.indexOf(endMarker, valueStart);
  assert.notEqual(end, -1, `missing ${endMarker} after ${startMarker}`);
  return source.slice(valueStart, end).trim();
}

function extractObject(source, name) {
  const marker = `const ${name}=`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const objectStart = source.indexOf('{', start + marker.length);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = objectStart; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(objectStart, i + 1);
  }
  assert.fail(`unterminated ${name}`);
}

function loadPage(file) {
  const html = fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
  const dataExpr = extractExpression(html, 'const DATA=', ';\nconst allW=');
  const typingExpr = extractObject(html, 'TYPING_LEVELS');
  const clozeExpr = extractObject(html, 'CLOZE_LEVELS');
  const context = {console};
  vm.createContext(context);
  vm.runInContext(
    `const DATA=${dataExpr}; const allW=DATA.flatMap(d=>d.words);`+
    `const TYPING_LEVELS=${typingExpr}; const CLOZE_LEVELS=${clozeExpr};`+
    `this.__result={allW,TYPING_LEVELS,CLOZE_LEVELS};`,
    context,
    {filename:file}
  );
  return {html, ...context.__result};
}

function assertFiniteFields(level, numeric, strings, label) {
  for (const key of numeric) {
    assert.equal(Number.isFinite(level[key]), true, `${label}.${key} must be finite`);
    assert.ok(level[key] > 0, `${label}.${key} must be positive`);
  }
  for (const key of strings) {
    assert.equal(typeof level[key], 'string', `${label}.${key} must be a string`);
    assert.ok(level[key].trim(), `${label}.${key} must not be blank`);
  }
}

const pages = [];
for (let land = 1; land <= 8; land++) {
  const file = `island_land${land}.html`;
  const page = loadPage(file);
  pages.push(page);
  const {html, allW, TYPING_LEVELS, CLOZE_LEVELS} = page;
  assert.equal(allW.length, 30, `${file} must contain 30 physical Land words`);

  [1, 2, 3].forEach((key, index) => {
    const level = TYPING_LEVELS[key];
    assertFiniteFields(
      level,
      ['xpPerWord', 'gemBonus', 'petXp'],
      ['name', 'icon', 'c1', 'c2', 'cb', 'ct', 'ct2', 'desc', 'example'],
      `${file}.typing.${key}`
    );
    assert.deepEqual(
      {xpPerWord:level.xpPerWord, gemBonus:level.gemBonus, petXp:level.petXp},
      TYPING_REWARDS[index],
      `${file} typing rewards must match v941`
    );
    const count = allW.map((_, i) => i).filter(level.filter).length;
    assert.ok(count > 0, `${file} typing level ${key} must have questions`);
    const menu = `经验 +${level.xpPerWord * count + level.gemBonus} · 宠物经验 +${level.petXp}`;
    assert.doesNotMatch(menu, /NaN|undefined/, `${file} typing menu must be numeric`);
  });

  const clozeWords = [];
  ['easy', 'medium', 'hard'].forEach((key, index) => {
    const level = CLOZE_LEVELS[key];
    assertFiniteFields(
      level,
      ['xpPerQ', 'gemBonus', 'petXp'],
      ['name', 'icon', 'c1', 'c2', 'cb', 'ct', 'desc', 'example'],
      `${file}.cloze.${key}`
    );
    assert.deepEqual(
      {xpPerQ:level.xpPerQ, gemBonus:level.gemBonus, petXp:level.petXp},
      CLOZE_REWARDS[index],
      `${file} cloze rewards must match v941`
    );
    assert.ok(level.words.length > 0, `${file} cloze ${key} must have questions`);
    for (const word of level.words) {
      const record = allW.find(item => item.en === word);
      assert.ok(record, `${file} cloze must only reference its own allW: ${word}`);
      assert.match(record.ex, new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i'));
      clozeWords.push(word);
    }
    const menu = `经验 +${level.xpPerQ * level.words.length + level.gemBonus} · 宠物经验 +${level.petXp}`;
    const heading = `每题 +${level.xpPerQ} 经验 · ${level.example} · ${level.cb}`;
    assert.doesNotMatch(menu + heading, /NaN|undefined/, `${file} cloze UI must be numeric and defined`);
  });
  assert.equal(clozeWords.length, 30, `${file} cloze levels must cover all 30 Land words`);
  assert.equal(new Set(clozeWords).size, 30, `${file} cloze levels must not overlap`);
  assert.deepEqual(new Set(clozeWords), new Set(allW.map(word => word.en)), `${file} cloze must cover exactly its own allW`);

  const typingRuntime = html.slice(html.indexOf('function typeCheckWord'), html.indexOf('// CLOZE (完形填空)'));
  assert.match(typingRuntime, /addXP\(L\.xpPerWord\)/, `${file} correct typing must add base XP`);
  assert.match(typingRuntime, /addXP\(gemReward\)/, `${file} typing completion must add its completion XP`);
  assert.match(typingRuntime, /petTaskComplete\('⌨️ 打字大师 '\+L\.name,L\.petXp,'type'\)/, `${file} typing fixed task XP must use petXp once`);

  const clozeRuntime = html.slice(html.indexOf('function clozeAnswer'), html.indexOf('// REVIEW MODE'));
  assert.match(clozeRuntime, /addXP\(L\.xpPerQ\)/, `${file} correct cloze answer must add base XP`);
  assert.match(clozeRuntime, /addXP\(L\.gemBonus\)/, `${file} cloze completion must add its completion XP`);
  assert.match(clozeRuntime, /petTaskComplete\('📝 完形填空 '\+L\.name,L\.petXp,'cloze'\)/, `${file} cloze fixed task XP must use petXp once`);
}

// Land 8 has 12 / 8 / 10 words in the shared length tiers.  Completion XP and
// fixed pet-task XP are intentionally separate addXP calls and therefore both count.
const land8 = pages[7];
const typingCounts = [1, 2, 3].map(key => land8.allW.map((_, i) => i).filter(land8.TYPING_LEVELS[key].filter).length);
assert.deepEqual(typingCounts, [12, 8, 10]);
const typingFullXp = [1, 2, 3].map((key, index) => {
  const level = land8.TYPING_LEVELS[key];
  return typingCounts[index] * level.xpPerWord + level.gemBonus + level.petXp;
});
assert.deepEqual(typingFullXp, [97, 145, 300]);
assert.equal(typingFullXp.reduce((sum, value) => sum + value, 0), 542);

const clozeCounts = ['easy', 'medium', 'hard'].map(key => land8.CLOZE_LEVELS[key].words.length);
assert.deepEqual(clozeCounts, [12, 8, 10]);
const clozeFullXp = ['easy', 'medium', 'hard'].map((key, index) => {
  const level = land8.CLOZE_LEVELS[key];
  return clozeCounts[index] * level.xpPerQ + level.gemBonus + level.petXp;
});
assert.deepEqual(clozeFullXp, [105, 134, 245]);
assert.equal(clozeFullXp.reduce((sum, value) => sum + value, 0), 484);

console.log('✅ v941 Land typing/cloze: 8 pages × 3 tiers, 30-word coverage, defined UI and XP payout paths passed');
