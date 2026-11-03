// 时间平移：错一次 → 隔天答对(错题本清零, +15) → 按间隔复习到盒4 → 玩法里提前答对(rp) → 到期那天「今日复习」自评毕业
// 看毕业金 +15 是不是同一个词发了两次
import { newPage, BASE, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { ctx, page, errs } = await newPage({ init: false });
await ctx.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); }
    const off = Number(sessionStorage.getItem('__dayOff') || 0) * 86400000;
    const RD = Date;
    class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
    window.Date = D;
  } catch (e) {}
});
async function gotoDay(n) {
  await page.evaluate(n => sessionStorage.setItem('__dayOff', String(n)), n).catch(() => {});
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenReview && window.HansenCanonical && window.HansenReviewRewardsV963 && typeof markAnswer === 'function' && document.readyState !== 'loading', null, { timeout: 30000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
}
const I = 4;
const st = () => page.evaluate(i => {
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const slot = window.__hsnReviewSlot ? __hsnReviewSlot(i) : '';
  let grads = [];
  try { const raw = JSON.parse(localStorage.getItem('hansen_coin_awards_v941') || 'null'); } catch (e) {}
  for (let k = 0; k < localStorage.length; k++) { const key = localStorage.key(k); const v = localStorage.getItem(key) || ''; if (v.indexOf(':grad') >= 0 && v.indexOf(slot) >= 0) grads.push(key); }
  return { today: ymd(new Date()), wrong: S.wrongs[i] || 0, plan: S.srs && S.srs[i] ? JSON.stringify(S.srs[i]) : null, coins: (window.HansenCoins && HansenCoins.get) ? HansenCoins.get() : null, slot, gradKeysIn: grads };
}, I);
await gotoDay(0);
await page.evaluate(i => markAnswer(i, false), I);
console.log('day0 miss', JSON.stringify(await st()));
await gotoDay(1);
const c1a = await page.evaluate(() => HansenCoins.get());
await page.evaluate(i => markAnswer(i, true), I);
const s1 = await st(); console.log('day1 correct', JSON.stringify(s1), 'coin delta', s1.coins - c1a);
for (const [d, label] of [[3, 'box1->2'], [7, 'box2->3'], [14, 'box3->4']]) {
  await gotoDay(d);
  await page.evaluate(i => markAnswer(i, true), I);
  console.log('day' + d, label, JSON.stringify(await st()));
}
await gotoDay(20);
await page.evaluate(i => markAnswer(i, true), I);   // 未到期：只记证据 rp
console.log('day20 proof', JSON.stringify(await st()));
await gotoDay(29);
const c29 = await page.evaluate(() => HansenCoins.get());
await page.evaluate(() => HansenReview._openToday());
await page.waitForTimeout(300);
for (let step = 0; step < 10; step++) {
  const r = await page.evaluate(() => {
    const el = document.getElementById('hr_today'); if (!el) return 'gone';
    if (/今日复习完成/.test(el.textContent || '')) return 'done';
    const got = el.querySelector('#ht_b_got'); if (got) { got.click(); return 'got'; }
    const show = el.querySelector('#ht_b_show'); if (show) { show.click(); return 'show'; }
    return 'stuck';
  });
  if (r === 'done' || r === 'gone' || r === 'stuck') break;
  await page.waitForTimeout(150);
}
await page.waitForTimeout(600);
const s29 = await st();
const awards = await page.evaluate(i => { const slot = __hsnReviewSlot(i); const out = []; const W = window.HansenCoins; for (let d = 0; d <= 30; d++) { const dt = new Date(); dt.setDate(dt.getDate() - 29 + d); const y = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); const id = 'rvrw:' + y + ':' + slot + ':grad'; if (W.hasAward && W.hasAward(id)) out.push(id); } return out; }, I);
console.log('day29 self-grade', JSON.stringify(s29), 'coin delta', s29.coins - c29);
console.log('grad receipts for this word:', JSON.stringify(awards));
console.log('errs', errs);
await done();
