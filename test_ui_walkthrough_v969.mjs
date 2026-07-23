// 🔴v969 真机大补考：v963–v968 全部新增界面的真浏览器实打实走查
// 铁律：真开页面·真点按钮·真走用户路径；pageerror/console.error 全程必须为 0。
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8952;

let fails = 0;
const ok = (c, n) => { console.log((c ? '  ✅ ' : '  ❌ ') + n); if(!c) fails++; };

/* ── 静态服务 ── */
const MIME = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.svg':'image/svg+xml','.css':'text/css'};
const srv = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{
    if(e){ res.writeHead(404); res.end(); return; }
    res.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});
    res.end(d);
  });
});
await new Promise(r=>srv.listen(PORT,r));

const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const errors = [];
async function freshPage(){
  const page = await browser.newPage({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, serviceWorkers:'block' });
  page.on('pageerror', e=>errors.push('PAGE:'+String(e.message).slice(0,160)));
  page.on('console', m=>{ if(m.type()==='error') errors.push('CONSOLE:'+m.text().slice(0,160)); });
  return page;
}
/* 像真人一样：有弹窗就关掉(每日卡/答题反馈等真实弹层) */
async function calm(page){
  for(let i=0;i<6;i++){
    const m = page.locator('#alertModal.show, .modal-bg.show');
    if(await m.count() === 0) return;
    const btn = m.first().locator('button');
    try{
      if(await btn.count() > 0) await btn.first().click({ timeout: 800 });
      else await page.keyboard.press('Escape');
    }catch(e){ try{ await page.keyboard.press('Escape'); }catch(_e){} }
    await page.waitForTimeout(350);
  }
}
async function closeCenter(page){
  await page.evaluate(()=>{ try{ window.HansenReview && HansenReview._close && HansenReview._close(); }catch(e){} });
  await page.waitForTimeout(300);
}
async function gotoIsland(page, file='island_animal.html'){
  await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>window.allW && window.allW.length>0 && window.HansenReviewRewardsV963 && window.HansenCloudSave, { timeout: 30000 });
  await page.waitForTimeout(600);
  await calm(page);
}

/* ════ 场景1 · 触发横幅：安心态 → 本岛到期态 → 真点横幅进今日复习 ════ */
{
  console.log('S1 触发横幅四态与点击');
  const page = await freshPage();
  await gotoIsland(page);
  ok(await page.locator('#hr_review_banner').count() === 1, '横幅注入首页');
  const calmTxt = await page.locator('#hr_review_banner').innerText();
  ok(/没有要复习|悄悄记牢|已清空|巡检/.test(calmTxt), '初始为安心/已清态文案');

  // 真实用户路径造一个到期错词：答错 → 打开复习中心(播种SRS) → 关闭
  await page.evaluate(()=>{ markAnswer(3, false); });
  await calm(page);
  await page.click('#navReview');
  await page.waitForTimeout(800);
  await closeCenter(page);
  await page.evaluate(()=>{ HansenReviewRewardsV963.refresh(); });
  await page.waitForTimeout(400);
  const diag = await page.evaluate(()=>{
    const can = window.HansenCanonical && HansenCanonical.read ? HansenCanonical.read() : null;
    return encodeURIComponent(JSON.stringify({
      canSrs: can && can.srs ? Object.keys(can.srs).slice(0,4) : 'no-can',
      canWrongs: can && can.wrongs ? Object.keys(can.wrongs).slice(0,4) : 'nw',
      localSrs: window.S && S.srs ? Object.keys(S.srs).slice(0,4) : 'ns',
      info: window.HansenReviewRewardsV963._debug ? 'x' : 'y'
    }));
  });
  console.log('  [DIAG-S1]', decodeURIComponent(diag));
  const hot = await page.locator('#hr_review_banner').innerText();
  ok(/本岛|到期|个单词/.test(hot), '出现到期热态文案: ' + hot.split('\n')[0].slice(0,30));

  // 真点横幅 → 应打开今日复习(出现自评按钮)
  await calm(page);
  await page.click('#hr_review_banner');
  await page.waitForTimeout(900);
  const body = await page.evaluate(()=>document.body.innerText);
  ok(/记住了|今日复习|没记住/.test(body), '点横幅进入今日复习界面');
  // 真点返回键关闭今日复习
  if(await page.locator('#hr_today_back').count()){
    await page.click('#hr_today_back');
    await page.waitForTimeout(400);
    ok(await page.locator('#hr_today').count() === 0, '返回键真点可关闭今日复习');
  }
  await page.close();
}

/* ════ 场景2 · 复习中心状态卡：连击/称号/巡检名单 ════ */
{
  console.log('S2 复习中心状态卡');
  const page = await freshPage();
  await page.addInitScript(()=>{
    const y = new Date(); y.setDate(y.getDate()-1);
    const ymd = d=>`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    localStorage.setItem('hansen_review_patrol_v963', JSON.stringify({ 'animal:5': { due: ymd(y), stage: 1 } }));
    localStorage.setItem('hansen_review_streak_v963', JSON.stringify({ start:'2026-07-01', last: ymd(y), count: 6 }));
  });
  await gotoIsland(page);
  await page.click('#navReview');
  await page.waitForSelector('#hr_rvrw_card', { timeout: 8000 });
  const card = await page.locator('#hr_rvrw_card').innerText();
  ok(/猎人/.test(card), '状态卡展示猎人称号');
  console.log('  [DIAG-S2]', encodeURIComponent(card).slice(0,300));
  ok(/连续复习|连击/.test(card), '状态卡展示连击(实际措辞:连续复习)');
  ok(/毕业巡检期/.test(card), '巡检名单在状态卡露面');
  ok(/任意游戏答对即通过/.test(card), '巡检玩法指引文案');
  await page.close();
}

/* ════ 场景3 · 云存档卡片全交互（v965+v966修复回归）════ */
{
  console.log('S3 云存档卡片');
  const page = await freshPage();
  await gotoIsland(page);
  await calm(page);
  await page.click('.util-card:has-text("设置")');
  await page.waitForSelector('#hsnCloudCard', { timeout: 8000 });
  ok(true, '设置页注入 ☁️ 云卡片');
  const st = await page.locator('#hsnCloudStatus').innerText();
  ok(/待开通/.test(st), 'envId 未配置显示待开通态');

  // 密钥点按显示
  await page.click('#hsnCloudKey');
  await page.waitForTimeout(300);
  const key = (await page.locator('#hsnCloudKey').innerText()).trim();
  ok(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(key), '点按显示16位四段密钥: ' + key);

  // 🔴v966修复回归：输入中触发重绘不得吞输入
  await page.fill('#hsnCloudRestoreKey', 'ABCD-EFGH');
  await page.evaluate(()=>{ HansenCloudSave._debug.renderCard(); });
  await page.waitForTimeout(200);
  ok(await page.inputValue('#hsnCloudRestoreKey') === 'ABCD-EFGH', '重绘保护：输入内容不被吞');

  // 自检按钮 → 未配置指引
  await page.click('#hsnCloudTest');
  await page.waitForTimeout(400);
  ok(/开通指南/.test(await page.locator('#hsnCloudMsg').innerText()), '自检给出开通指引');

  // 非法密钥恢复 → 友好报错
  await page.fill('#hsnCloudRestoreKey', 'XX');
  await page.click('#hsnCloudRestore');
  await page.waitForTimeout(500);
  ok(/格式不对|尚未开通/.test(await page.locator('#hsnCloudMsg').innerText()), '非法密钥友好报错');
  await page.close();
}

/* ════ 场景4 · 飘字级联 + 纠错金币真机路径 ════ */
{
  console.log('S4 飘字级联与纠错奖励');
  const page = await freshPage();
  await gotoIsland(page);
  // 造到期词(真实路径): 答错→开中心播种→关
  await page.evaluate(()=>{ markAnswer(7, false); });
  await calm(page);
  await page.evaluate(()=>{ markAnswer(8, false); });
  await calm(page);
  await page.click('#navReview');
  await page.waitForTimeout(700);
  await closeCenter(page);
  const coins0 = await page.evaluate(()=>window.HansenCoins ? HansenCoins.get() : -1);
  await calm(page);
  await page.evaluate(()=>{ markAnswer(7, true); markAnswer(8, true); });   // 双词连答→级联
  await page.waitForTimeout(350);
  const floats = await page.evaluate(()=>Array.from(document.querySelectorAll('.float-text')).map(e=>({t:e.textContent, top:e.style.top})));
  ok(floats.length >= 2, `连发飘字 ${floats.length} 条: ` + floats.map(f=>f.t).join(' | ').slice(0,60));
  ok(new Set(floats.map(f=>f.top)).size === floats.length, '级联错位：各条 top 互不重叠');
  const coins1 = await page.evaluate(()=>HansenCoins.get());
  ok(coins1 >= coins0 + 4, `双词纠错真实入账 ${coins0}→${coins1}`);
  await page.close();
}

/* ════ 场景5 · Land 横幅 + 懒加载生效 ════ */
{
  console.log('S5 Land页与懒加载');
  const page = await freshPage();
  await page.goto(`http://127.0.0.1:${PORT}/island_land1.html`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(()=>window.allW && window.HansenReviewRewardsV963, { timeout: 30000 });
  await page.waitForTimeout(600);
  ok(await page.locator('#hr_review_banner').count() === 1, 'Land 页横幅注入');
  const lazy = await page.evaluate(()=>document.querySelectorAll('img[loading=lazy]').length);
  ok(lazy > 0, `Land 懒加载图片生效 ×${lazy}`);
  await page.close();
}


/* ════ 场景6 · 🔴v971 星海大陆殿堂：卡册→点已拥有Land卡→全屏殿堂双层背景 ════ */
{
  console.log('S6 星海大陆殿堂');
  const page = await freshPage();
  await page.addInitScript(()=>{
    localStorage.setItem('hansen_land_cardbook', JSON.stringify({owned:{L11:true,L13:true},frags:{},pity:0,totalDraws:0}));
  });
  await gotoIsland(page);
  await page.click('#navCards');
  await page.waitForTimeout(900);
  const thumb = page.locator(`div[onclick*="__hsnOpenLandHall('L13')"]`);
  ok(await thumb.count() === 1, '图鉴中已拥有L13缩略可点');
  await thumb.scrollIntoViewIfNeeded();
  await thumb.click();
  await page.waitForSelector('#__hsn_landhall iframe', { timeout: 8000 });
  const src = await page.getAttribute('#__hsn_landhall iframe', 'src');
  ok(/land=1&card=L13/.test(src) && /lown=/.test(src), '殿堂iframe URL合同: '+src.slice(-46));
  const hall = page.frameLocator('#__hsn_landhall iframe');
  await hall.locator('#artImg').waitFor({ timeout: 10000 });
  const hs = await hall.locator('html').evaluate(el=>({
    land: el.classList.contains('landhall'),
    art: (el.ownerDocument.getElementById('artImg')||{}).src||'',
    blur: el.ownerDocument.getElementById('bgA').classList.contains('landblur') || el.ownerDocument.getElementById('bgB').classList.contains('landblur')   /* v972: 清单空→兜底层带landblur */
  }));
  ok(hs.land && hs.blur, '殿堂land模式·未交付卡走模糊兜底(清单门禁)');
  ok(/land_jingyuan/.test(hs.art), '起始卡立绘=L13镜渊领主');
  await page.click('#__hsn_landhall div[role=button]');
  await page.waitForTimeout(400);
  ok(await page.locator('#__hsn_landhall').count() === 0, '× 真点关闭殿堂');
  await page.close();
}

await browser.close(); srv.close();

console.log('\n══ 全程错误采集 ══');
if(errors.length){ errors.slice(0,8).forEach(e=>console.log('  ', e)); }
ok(errors.length === 0, `pageerror/console.error 全程为 0（实际 ${errors.length}）`);

if(fails){ console.log(`\n❌ 真机大补考未过：${fails} 项`); process.exit(1); }
console.log('\n🎉 v969 真机大补考全绿：横幅四态/中心卡/巡检/云卡片交互/飘字级联/纠错入账/Land/懒加载 · 零错误');
