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
  const hs = await hall.locator('html').evaluate(el=>{
    const A=el.ownerDocument.getElementById('bgA'), B=el.ownerDocument.getElementById('bgB');
    const act=(A.style.opacity==='1')?A:B;
    return {
      land: el.classList.contains('landhall'),
      art: (el.ownerDocument.getElementById('artImg')||{}).src||'',
      bg: act.style.backgroundImage||'',
      blur: act.classList.contains('landblur')
    };
  });
  ok(hs.land, '殿堂进入land模式');
  ok(/bosses_bg\/land_jingyuan/.test(hs.bg) && !hs.blur, '🔴v973 L13真实场景清晰直出(2026-07-23交付)');
  ok(/land_jingyuan/.test(hs.art), '起始卡立绘=L13镜渊领主');
  await page.click('#__hsn_landhall div[role=button]');
  await page.waitForTimeout(400);
  ok(await page.locator('#__hsn_landhall').count() === 0, '× 真点关闭殿堂');
  await page.close();
}


/* ════ 场景7 · 🔴v986 大脑五态横幅：岛屿页 calm→安睡真图标 / 种30错词→urgent红色警报 ════ */
{
  console.log('S7 大脑五态横幅');
  const pgA = await freshPage();
  await pgA.addInitScript(()=>localStorage.clear());
  await gotoIsland(pgA);
  await pgA.waitForSelector('#hr_review_banner', { timeout: 15000 });
  await pgA.waitForTimeout(900);
  const ca = await pgA.evaluate(()=>{
    const el=document.getElementById('hr_review_banner');
    const img=el.querySelector('img');
    return { img: img?img.getAttribute('src'):null, loaded: img?(img.complete&&img.naturalWidth>0):false };
  });
  ok(ca.img && ca.img.includes('brain_rest') && ca.loaded, '安心态=brain_rest真图加载: '+ca.img);
  await pgA.close();
  const pgB = await freshPage();
  await pgB.addInitScript(()=>{
    localStorage.clear();
    const wr={}; for(let i=0;i<30;i++) wr[String(i)]=1;
    localStorage.setItem('hansen_canonical_progress_v941', JSON.stringify({islands:{animal:{wrongs:wr, srs:{}}}}));
  });
  await gotoIsland(pgB);
  await pgB.waitForSelector('#hr_review_banner', { timeout: 15000 });
  await pgB.waitForTimeout(900);
  const ur = await pgB.evaluate(()=>{
    const el=document.getElementById('hr_review_banner');
    const img=el.querySelector('img');
    return { bg:(el.style.background||''), title:(el.querySelector('span span')||{}).textContent||'',
             img: img?img.getAttribute('src'):null, loaded: img?(img.complete&&img.naturalWidth>0):false };
  });
  ok(ur.img && ur.img.includes('brain_alarm') && ur.loaded, '紧急态=brain_alarm真图加载');
  ok(/rgb\(239|ef4444/.test(ur.bg), '紧急态红色警报底色');
  ok(/积压/.test(ur.title) && /30/.test(ur.title), '紧急文案含积压30: '+ur.title.slice(0,18));
  await pgB.close();
}


/* ════ 场景8 · 🔴v988 亮色板补装修：专注打字结算/我的学习/猎人卡环境免疫 ════ */
{
  console.log('S8 亮色板补装修');
  const pg = await freshPage();
  await pg.addInitScript(()=>{ localStorage.clear(); localStorage.setItem('hansen_palette_global','cloud'); });
  await gotoIsland(pg);
  const r = await pg.evaluate(()=>{
    const probe=document.createElement('div');
    probe.innerHTML='<div class="htm-complete"><h2>T</h2><p>D</p></div><div id="hsn-ml"><div class="hsn-ml-title">M</div></div>';
    document.body.appendChild(probe);
    const out={ h2:getComputedStyle(probe.querySelector('h2')).color,
                p:getComputedStyle(probe.querySelector('p')).color,
                ml:getComputedStyle(probe.querySelector('.hsn-ml-title')).color };
    probe.remove();
    try{ if(window.HansenReview&&HansenReview._open) HansenReview._open(); }catch(e){}
    return out;
  });
  ok(/55,\s*48,\s*163|30,\s*64,\s*175/.test(r.h2), '结算标题→强调色: '+r.h2);
  ok(/71,\s*85,\s*105/.test(r.p), '结算正文→板岩深灰');
  ok(/15,\s*23,\s*42/.test(r.ml), '我的学习标题→墨字(v992起由#hsn-ml整层双色调接管)');
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ try{ document.dispatchEvent(new Event('visibilitychange')); }catch(e){} });
  await pg.waitForTimeout(700);
  const hc = await pg.evaluate(()=>{
    const c=document.getElementById('hr_rvrw_card');
    return c? { bg:getComputedStyle(c).backgroundImage.slice(0,60), fg:getComputedStyle(c).color } : null;
  });
  ok(hc && /120,\s*53,\s*15/.test(hc.bg) && /253,\s*230,\s*138/.test(hc.fg), '猎人卡环境免疫(实心深琥珀+暖金墨)');
  await pg.close();
}


/* ════ 场景9 · 🔴v991 浮层真双色调分离：亮色=亮底深字 / 暗色=深底浅字 ════ */
{
  console.log('S9 浮层双色调分离');
  const lum=(c)=>{const m=(c||'').match(/(\d+),\s*(\d+),\s*(\d+)/); return m? (+m[1]*.299+ +m[2]*.587+ +m[3]*.114) : -1;};
  for(const [pal, wantLightBg] of [['cloud', true], [null, false]]){
    const pg = await freshPage();
    await pg.addInitScript(p=>{ localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);
      const wr={}; for(let i=0;i<7;i++) wr[String(i)]=1;
      localStorage.setItem('hansen_canonical_progress_v941', JSON.stringify({islands:{animal:{wrongs:wr, srs:{}}}}));
    }, pal);
    await gotoIsland(pg);
    /* 🔴v996: 完形填空亮色装修合同(句卡白底+高亮词醒目) */
    await pg.evaluate(()=>{ try{ showScreen('cloze'); if(typeof startClozeLevel==='function') startClozeLevel('hard'); }catch(e){} });
    await pg.waitForTimeout(1600);
    const clz = await pg.evaluate(()=>{
      const s=document.querySelector('.cloze-sentence');
      const cn=document.querySelector('.cloze-cn');
      const hi=cn?cn.querySelector('span'):null;
      if(!s) return null;
      const cs=getComputedStyle(s);
      return { sentBg:cs.backgroundColor, sentFg:cs.color, hiFg:hi?getComputedStyle(hi).color:null };
    });
    if(clz){
      if(wantLightBg){
        ok(lum(clz.sentBg)>240, '亮色板 完形句卡白底(根治灰底)');
        ok(lum(clz.sentFg)<120, '亮色板 完形句卡深字');
        if(clz.hiFg) ok(/30, 58, 138/.test(clz.hiFg), '亮色板 目标词高亮为靛蓝(禁红规范·对比度8.6:1): '+clz.hiFg);
      } else {
        ok(lum(clz.sentFg)>150, '暗色板 完形句卡浅字');
      }
    }
    try{ await pg.evaluate(()=>{ showScreen('home'); }); }catch(e){}
    await pg.waitForTimeout(400);

    /* 🔴v995: 泡泡大作战亮色装修合同 */
    await pg.evaluate(()=>{ try{ showScreen('bubble'); if(typeof startBubbleLevel==='function') startBubbleLevel('hard'); }catch(e){} });
    await pg.waitForTimeout(1500);
    const bub = await pg.evaluate(()=>{
      const b=document.querySelector('.bubble');
      const it=document.querySelector('.bubble-stats .bs-item:not(#bbLvlBadge)');
      if(!b||!it) return null;
      const cs=getComputedStyle(it);
      return { bubbleFg:getComputedStyle(b).color, itemBg:cs.backgroundColor, itemFg:cs.color };
    });
    if(bub){
      ok(lum(bub.bubbleFg)>200, (pal?'亮色板':'暗色板')+' 泡泡内单词恒白字');
      if(wantLightBg){
        ok(lum(bub.itemBg)>240, '亮色板 状态条纯白底(根治灰底)');
        ok(lum(bub.itemFg)<120, '亮色板 状态条深字');
      } else {
        ok(lum(bub.itemFg)>150, '暗色板 状态条浅字');
      }
    }
    try{ await pg.evaluate(()=>{ if(typeof stopBubble==='function') stopBubble(); showScreen('home'); }); }catch(e){}
    await pg.waitForTimeout(400);

    /* 🔴v994: 打字大师结算页双色调合同 */
    const htm = await pg.evaluate(()=>{
      const host=document.getElementById('typingContent')||document.body;
      const probe=document.createElement('div');
      probe.innerHTML='<div class="htm-complete"><h2>T</h2><p>D<b>N</b></p></div>';
      host.appendChild(probe);
      const h2=probe.querySelector('h2'), pp=probe.querySelector('p');
      const o={h2:getComputedStyle(h2).color, p:getComputedStyle(pp).color};
      probe.remove(); return o;
    });
    ok(wantLightBg ? lum(htm.h2)<160 : lum(htm.h2)>150, (pal?'亮色板':'暗色板')+' 结算标题方向正确');
    ok(wantLightBg ? lum(htm.p)<160 : lum(htm.p)>150, (pal?'亮色板':'暗色板')+' 结算正文方向正确');

    /* 🔴v992: 我的学习页同族合同 */
    await pg.evaluate(()=>{ try{ if(window.HansenMyLearning&&HansenMyLearning._open) HansenMyLearning._open(); }catch(e){} });
    await pg.waitForTimeout(1100);
    const ml = await pg.evaluate(()=>{
      const m=document.getElementById('hsn-ml'); if(!m) return null;
      const cs=getComputedStyle(m);
      const isl=m.querySelector('.hsn-ml-isl .nm');
      return { bg:(cs.backgroundImage!=='none'?cs.backgroundImage:cs.backgroundColor), nm: isl? getComputedStyle(isl).color : null };
    });
    if(ml){
      const mlLight = /248,\s*250,\s*252/.test(ml.bg);
      ok(mlLight === wantLightBg, (pal?'亮色板':'暗色板')+' 我的学习页底色方向正确');
      if(ml.nm){
        const nl = lum(ml.nm);
        ok(wantLightBg ? nl<150 : nl>140, (pal?'亮色板':'暗色板')+' 岛屿名文字方向正确');
      }
    }
    await pg.evaluate(()=>{ try{ if(window.HansenMyLearning&&HansenMyLearning._close) HansenMyLearning._close(); }catch(e){} });
    await pg.waitForTimeout(500);
    await pg.evaluate(()=>{ try{ if(window.HansenSpellPractice) HansenSpellPractice.openSpellByListen(); }catch(e){} });
    await pg.waitForTimeout(1200);
    const r = await pg.evaluate(()=>{
      const m=document.getElementById('hsp_mask'); if(!m) return null;
      const cs=getComputedStyle(m);
      const t=[]; const walk=(el)=>{ el.childNodes.forEach(n=>{
        if(n.nodeType===3&&n.textContent.trim().length>=2) t.push(getComputedStyle(el).color);
        else if(n.nodeType===1) walk(n); });};
      walk(m);
      return { bg:(cs.backgroundImage!=='none'?cs.backgroundImage:cs.backgroundColor), texts:t.slice(0,10) };
    });
    const tag = pal ? '亮色板' : '暗色板';
    ok(!!r, tag+' 拼写层已打开');
    if(r){
      const bgLight = /248,\s*250,\s*252|255,\s*255,\s*255/.test(r.bg);
      ok(bgLight === wantLightBg, tag+' 底色方向正确(亮底='+bgLight+')');
      const vals = r.texts.filter(c=>lum(c)>=0);
      const darkRatio = vals.filter(c=>lum(c)<150).length / Math.max(vals.length,1);
      ok(wantLightBg ? darkRatio>=0.75 : darkRatio<=0.5, tag+' 文字方向正确(暗字占比'+darkRatio.toFixed(2)+')');
    }
    await pg.close();
  }
}

await browser.close(); srv.close();

console.log('\n══ 全程错误采集 ══');
if(errors.length){ errors.slice(0,8).forEach(e=>console.log('  ', e)); }
ok(errors.length === 0, `pageerror/console.error 全程为 0（实际 ${errors.length}）`);

if(fails){ console.log(`\n❌ 真机大补考未过：${fails} 项`); process.exit(1); }
console.log('\n🎉 v969 真机大补考全绿：横幅四态/中心卡/巡检/云卡片交互/飘字级联/纠错入账/Land/懒加载 · 零错误');
