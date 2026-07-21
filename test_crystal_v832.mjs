import { chromium } from './playwright_loader.mjs';

const PORT = 8941;
const URL = `http://127.0.0.1:${PORT}/island_animal.html`;

const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
// 这是小程序运行回归，必须使用真实手机视口；桌面宽度会按产品设计进入 _frame
// 显示方式选择页，历史测试若沿用默认 1280px 就会误报 HansenCrystal 未加载。
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  serviceWorkers: 'block'
});
const errors = [];
page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/favicon|autoplay|Autoplay|net::ERR/i.test(t)) errors.push('CONSOLE: ' + t); } });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.HansenCrystal && window.HansenCrystal._onAnswer && window.allW && window.allW.length > 0, { timeout: 15000 });

const results = await page.evaluate(() => {
  // v941 起 animal 是 canonical 岛 ID；旧 island_animal 仅用于一次性迁移，
  // 新写入必须同时维护 canonical 主档与备份，不能继续拿旧别名断言当前状态。
  const KEY = 'hsn_crystal_animal';
  const R = [];
  const ok = (n, c, info) => R.push({ n, pass: !!c, info: info || '' });

  const loadM = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const saveM = (m) => { const raw=JSON.stringify(m); localStorage.setItem(KEY,raw); localStorage.setItem(KEY+'_bak',raw); };
  const setW = (i, w) => { const m = loadM(); m[i] = w; saveM(m); };
  const getW = (i) => loadM()[i];
  const gems = () => parseInt(localStorage.getItem('hansen_wallet_gems') || '0', 10);
  const setGlobal = (k, v) => localStorage.setItem(k, String(v));
  const getGlobal = (k) => parseInt(localStorage.getItem(k) || '0', 10);
  const A = window.HansenCrystal._onAnswer;
  const PAST = '2000-1-1';

  const clearCanonical = () => {
    if(!window.HansenCanonical||!Array.isArray(HansenCanonical.islands))return;
    HansenCanonical.islands.forEach(island=>{
      localStorage.setItem('hsn_crystal_'+island.id,'{}');
      localStorage.setItem('hsn_crystal_'+island.id+'_bak','{}');
      localStorage.removeItem('hsn_crystal_isldone_'+island.id);
    });
  };
  const seedCanonicalDone = (count,skipWholeId) => {
    let left=count;
    HansenCanonical.islands.forEach(island=>{
      const map={};
      for(let i=0;i<island.words&&left>0;i++){
        if(island.id===skipWholeId)continue;
        map[i]={lv:5,p:0,d:PAST,done:1};left--;
      }
      const raw=JSON.stringify(map);
      localStorage.setItem('hsn_crystal_'+island.id,raw);
      localStorage.setItem('hsn_crystal_'+island.id+'_bak',raw);
    });
    return left===0;
  };

  const resetAll = () => {
    clearCanonical();saveM({});
    setGlobal('hsn_crystal_total', 0);
    setGlobal('hsn_crystal_gems', 0);
    setGlobal('hsn_crystal_rank', 0);
    localStorage.setItem('hansen_wallet_gems', '0');
    localStorage.removeItem('hsn_crystal_boost_until');
    localStorage.removeItem('hsn_crystal_isldone_animal');
  };

  // ===== T1: 进度条即时反馈(答对就涨 p) =====
  resetAll();
  A(0, true);
  let w = getW(0);
  ok('T1 答对涨进度 p:0→1(即时反馈)', w && w.p === 1 && w.lv === 0, JSON.stringify(w));

  // ===== T2: 进度满 + 隔天 → 锁定1星 =====
  // 当前 w={lv:0,p:1,d:''}. 再答对一次 → p=2, d=''!==today → 锁星
  A(0, true);
  w = getW(0);
  ok('T2 进度满+隔天→锁1星(lv=1,p归0)', w && w.lv === 1 && w.p === 0, JSON.stringify(w));

  // ===== T3: 一天只锁1星(防刷核心) =====
  // 已锁过今天(d=today). 同一天再答对很多次都不能再锁
  A(0, true); A(0, true); A(0, true); A(0, true); A(0, true);
  w = getW(0);
  ok('T3 同一天狂答→只锁1星(lv仍=1·防刷)', w && w.lv === 1, JSON.stringify(w));

  // ===== T4: 隔天 → 进度满的词立即再锁1星(隔天复习) =====
  setW(0, { lv: 1, p: 1, d: PAST, done: 0 });  // canonical 不持久化 p=2；差一次+隔天
  A(0, true);
  w = getW(0);
  ok('T4 隔天→进度满立即再锁1星(lv=2)', w && w.lv === 2 && w.p === 0, JSON.stringify(w));

  // ===== T5: 答错不倒扣(鼓励试错) =====
  setW(0, { lv: 3, p: 1, d: PAST, done: 0 });
  A(0, false);
  w = getW(0);
  ok('T5 答错不倒扣(lv=3不变·p=1不变)', w && w.lv === 3 && w.p === 1, JSON.stringify(w));

  // ===== T6: 记忆强化 → 锁星翻倍(仍一天一次) =====
  resetAll();
  window.HansenCrystal.grantBoost(60, true);  // 激活buff
  setW(1, { lv: 1, p: 1, d: PAST, done: 0 });  // 差一次+隔天
  A(1, true);
  w = getW(1);
  ok('T6 记忆强化锁星翻倍(lv:1→3)', w && w.lv === 3, 'boosted=' + window.HansenCrystal.isBoosted() + ' ' + JSON.stringify(w));
  localStorage.removeItem('hsn_crystal_boost_until');

  // ===== T7: 满5星永久掌握 → 每词直接发4钻 =====
  resetAll();
  const g0 = gems();
  setW(2, { lv: 4, p: 1, d: PAST, done: 0 });  // 差1星满级·差一次·隔天
  A(2, true);
  w = getW(2);
  const g1 = gems();
  ok('T7 满5星永久掌握(done=1·lv=5)', w && w.done === 1 && w.lv === 5, JSON.stringify(w));
  ok('T7 永久掌握→发4钻(GEM_PER_WORD)', g1 - g0 === 4, `钻石 ${g0}→${g1} (+${g1 - g0})`);
  ok('T7 累计掌握+1', getGlobal('hsn_crystal_total') === 1, 'total=' + getGlobal('hsn_crystal_total'));

  // ===== T8: 已永久掌握的词锁定不再变 =====
  const gB = gems();
  A(2, true); A(2, true);
  ok('T8 已掌握词不再结晶(钻石不变)', gems() === gB && getGlobal('hsn_crystal_total') === 1, 'total=' + getGlobal('hsn_crystal_total'));

  // ===== T9: 传奇段位门槛800可达(适配952词) =====
  resetAll();
  ok('T9 canonical 真实预置799个已掌握词',seedCanonicalDone(799,'animal'),'总词位不足800');
  setGlobal('hsn_crystal_total', 799);
  setGlobal('hsn_crystal_rank', 4);  // 宗师(idx4·need500)
  const gR0 = gems();
  setW(3, { lv: 4, p: 1, d: PAST, done: 0 });  // 掌握第800个词
  A(3, true);
  const gR1 = gems();
  // 应得: 每词4钻 + 传奇晋升奖300钻 = 304
  ok('T9 第800词→晋升传奇(rank=5·适配952词)', getGlobal('hsn_crystal_rank') === 5, 'rank=' + getGlobal('hsn_crystal_rank'));
  ok('T9 传奇晋升奖300钻(+每词4=304)', gR1 - gR0 === 304, `钻石+${gR1 - gR0}`);

  // ===== T10: 单岛全词永久掌握 → 50钻大奖 =====
  resetAll();
  const N = window.allW.length;  // animal=42
  const m = {};
  for (let i = 0; i < N - 1; i++) m[i] = { lv: 5, p: 0, d: PAST, done: 1 };  // 前N-1词已掌握
  m[N - 1] = { lv: 4, p: 1, d: PAST, done: 0 };  // 最后1词差1星且差一次
  saveM(m);
  setGlobal('hsn_crystal_total', N - 1);
  const gI0 = gems();
  A(N - 1, true);  // 掌握最后1词 → 全岛通关
  const gI1 = gems();
  const isldone = localStorage.getItem('hsn_crystal_isldone_animal') === '1';
  // 应得: 每词4钻 + 单岛大奖50钻 = 54 (段位也可能跳·但N=42 < 100精英·只到熟练已发过·这里rank已设... 重置后rank=0,total到42→精英idx2? 需排除段位干扰)
  ok('T10 单岛全词掌握→标记isldone', isldone, 'isldone=' + isldone);
  ok('T10 单岛大奖50钻已含(总+≥54)', gI1 - gI0 >= 54, `钻石+${gI1 - gI0} (含每词4+岛50+可能段位)`);

  // ===== T11: 老存档兼容(无 p 字段) =====
  resetAll();
  setW(5, { lv: 2, d: PAST, done: 0 });  // 老v831存档·无p字段
  A(5, true);
  w = getW(5);
  ok('T11 老存档无p字段→自动补p=0并涨进度', w && w.p === 1 && w.lv === 2, JSON.stringify(w));

  // ===== T12: v833 克制反馈——普通答对不刷屏，真正锁星才出现 =====
  resetAll();
  const oldMemo=document.getElementById('hsnCrystalMemo');if(oldMemo)oldMemo.remove();
  A(7, true);
  let memo = document.getElementById('hsnCrystalMemo');
  ok('T12 普通答对只涨进度·不刷浮层', !memo, memo ? memo.className : 'none');
  setW(7,{lv:1,p:1,d:PAST,done:0});A(7,true);memo=document.getElementById('hsnCrystalMemo');
  ok('T12 真正锁星才显示记忆浮层', memo&&memo.classList.contains('show')&&/记忆|★/.test(memo.textContent), memo?memo.textContent.slice(0,40):'');

  // ===== T13: 面板渲染无报错 + 文案更新 =====
  resetAll();
  let panelOk = false, panelTxt = '';
  try {
    window.HansenCrystal.open();
    const panel = document.querySelector('.hcr-panel');
    panelTxt = panel ? panel.textContent : '';
    panelOk = !!panel && /记牢一个单词/.test(panelTxt) && /4 颗/.test(panelTxt) && /答错没关系/.test(panelTxt);
    // 关闭
    const mask = document.querySelector('.hcr-mask') || panel?.closest('div');
  } catch (e) { panelTxt = 'ERR:' + e.message; }
  ok('T13 面板渲染+当前大白话文案(记牢/答错没关系/每词4钻)', panelOk, panelTxt.slice(0, 80));

  // ===== T14: stats 返回 perWord(不再有 toNext/GEM_PER 报错) =====
  resetAll();
  let statsOk = false, statsInfo = '';
  try { const s = window.HansenCrystal.stats(); statsOk = s.perWord === 4 && typeof s.gTotal === 'number'; statsInfo = JSON.stringify(s); }
  catch (e) { statsInfo = 'ERR:' + e.message; }
  ok('T14 stats().perWord=4(无GEM_PER报错)', statsOk, statsInfo.slice(0, 90));

  return R;
});

await browser.close();

console.log('\n========== v832 知识结晶引擎 详尽测试 ==========\n');
let passN = 0, failN = 0;
for (const r of results) {
  console.log(`${r.pass ? '✅' : '❌'} ${r.n}${r.pass ? '' : '  →  ' + r.info}`);
  r.pass ? passN++ : failN++;
}
console.log(`\n通过 ${passN} / ${passN + failN}`);
if (errors.length) { console.log('\n⚠️ 控制台/页面错误:'); errors.forEach(e => console.log('  ' + e)); }
else console.log('✅ 无 console.error / pageerror');
console.log('\n' + (failN === 0 && errors.length === 0 ? '🎉🎉🎉 全部通过·零错误' : '❌ 有失败项,需修复'));
process.exit(failN === 0 && errors.length === 0 ? 0 : 1);
