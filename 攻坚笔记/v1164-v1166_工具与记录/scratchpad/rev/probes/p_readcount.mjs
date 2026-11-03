// 每次答题读/写了几次权威账本（确定性的次数，不受机器忙闲影响）
import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
const r = await page.evaluate(() => {
  const K = HansenCanonical.STORE_KEY; let reads = 0, writes = 0;
  const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
  Storage.prototype.getItem = function (k) { if (k === K) reads++; return g.apply(this, arguments); };
  Storage.prototype.setItem = function (k) { if (k === K) writes++; return s.apply(this, arguments); };
  const out = {};
  const run = (label, fn) => { reads = 0; writes = 0; fn(); out[label] = { reads, writes }; };
  run('miss_new', () => markAnswer(20, false));
  run('correct_after_miss', () => markAnswer(20, true));
  run('correct_plain', () => markAnswer(21, true));
  run('miss_again', () => markAnswer(22, false));
  run('miss_existing', () => markAnswer(22, false));
  Storage.prototype.getItem = g; Storage.prototype.setItem = s;
  return out;
});
console.log(JSON.stringify(r));
await done();
