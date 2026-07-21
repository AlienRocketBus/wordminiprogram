import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./template.html', import.meta.url), 'utf8');
const match = html.match(/<style>([\s\S]*?)<\/style>/i);
assert.ok(match, 'template.html must contain its primary style block');
const css = match[1];

// Every brace must be structurally balanced outside strings/comments.  A stray
// closing brace was part of the v941 failure and can silently discard all CSS
// rules that follow it in a browser.
{
  let depth = 0, quote = '', comment = false, escaped = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i], n = css[i + 1];
    if (comment) { if (c === '*' && n === '/') { comment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      assert.ok(depth >= 0, `stray closing CSS brace near offset ${i}`);
    }
  }
  assert.equal(depth, 0, 'primary template CSS must have balanced braces');
  assert.equal(quote, '', 'primary template CSS must not end inside a string');
  assert.equal(comment, false, 'primary template CSS must not end inside a comment');
}

function matchingBrace(source, open) {
  let depth = 0;
  let quote = '';
  let comment = false;
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (comment) {
      if (c === '*' && n === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '*') { comment = true; i++; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

// Remove valid keyframe bodies, then reject percentage/from/to selectors at
// stylesheet level.  This catches the v941 corruption without rejecting frames
// that legitimately live inside @keyframes.
let withoutKeyframes = css;
const keyframe = /@(?:-webkit-)?keyframes\s+[-\w]+\s*\{/g;
let found;
const spans = [];
while ((found = keyframe.exec(css))) {
  const open = css.indexOf('{', found.index);
  const close = matchingBrace(css, open);
  assert.notEqual(close, -1, `unclosed keyframes near offset ${found.index}`);
  spans.push([found.index, close + 1]);
  keyframe.lastIndex = close + 1;
}
for (const [start, end] of spans.reverse()) {
  withoutKeyframes = withoutKeyframes.slice(0, start) + '\n' + withoutKeyframes.slice(end);
}

const orphan = withoutKeyframes.match(/(?:^|\})\s*(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*\d+(?:\.\d+)?%)*\s*\{/m);
if (orphan) {
  const line = withoutKeyframes.slice(0, orphan.index).split('\n').length;
  assert.fail(`orphan keyframe selector outside @keyframes near CSS line ${line}: ${orphan[0].trim()}`);
}

// Regression for a second v941 corruption: achIn had a complete keyframe block
// followed by another naked tail on the same line.
assert.equal((css.match(/@keyframes\s+achIn\b/g) || []).length, 1);
assert.equal((css.match(/10%,85%\{opacity:1;transform:translate\(-50%,0\)\}/g) || []).length, 1);

console.log('template CSS v942: no orphan keyframe frames or duplicated achIn tail ✅');
