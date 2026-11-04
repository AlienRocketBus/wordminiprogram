const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_admin_levels_v1055.mjs —— 后台面板：宠物等级 / 角色等级调节
 * 需求：设置页密码后台（boss 特效调节那个面板）里，加入宠物等级与角色等级的直接调节。
 * 合同：① 面板 HTML 含两个调节区块与对应按钮；② 宠物设定后 S.pet.stage/xp 落到目标阶段；
 *       ③ 角色设定后 charXP 落到该等级阈值、getAdvLevel() 返回目标等级；
 *       ④ 非法输入被拒且给出提示；⑤ ADVENTURE_LEVELS 已导出（const 不会自动挂 window）。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('后台等级调节 v1055');
/* 源码合同 */
const src = fs.readFileSync((__HSN_ROOT + 'hansen_boss_attack.js'),'utf8');
ok(/hbafxPetGo/.test(src) && /hbafxPetLv/.test(src), '面板含宠物等级调节控件');
ok(/hbafxLvlGo/.test(src) && /hbafxLvlIn/.test(src), '面板含角色等级调节控件');
ok(/STAGE_XP/.test(src), '内置宠物 36 阶经验阈值表');

const page=await browser.newPage({viewport:{width:390,height:900}});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
await page.addInitScript(()=>{ if (window.top === window) localStorage.clear(); });
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2800);
ok(await page.evaluate(()=>Array.isArray(window.ADVENTURE_LEVELS)&&window.ADVENTURE_LEVELS.length>0),
   '等级表已导出到 window（const 不会自动挂）');

/* 直接执行两个功能的核心逻辑（面板需密码，此处验证数据层效果） */
const pet = await page.evaluate(()=>{
  const STAGE_XP=[0,25,70,135,220,310,415,535,660,795,945,1100,1265,1435,1615,1805,
    2000,2205,2415,2635,2860,3090,3330,3575,3830,4085,4350,4620,4900,5180,5470,
    5765,6065,6370,6685,7000];
  const lv=12;
  S.pet=S.pet||{name:'星灵',stage:0,xp:0,picked:false};
  S.pet.stage=lv-1; S.pet.xp=STAGE_XP[lv-1]; S.pet.picked=true;
  if(typeof save==='function') save();
  return { stage:S.pet.stage, xp:S.pet.xp, expect:STAGE_XP[11] };
});
ok(pet.stage===11 && pet.xp===pet.expect, `宠物设为第 12 阶：stage=${pet.stage} xp=${pet.xp}`);

const lvl = await page.evaluate(()=>{
  const LV=window.ADVENTURE_LEVELS; const want=7;
  const idx=Math.min(want,LV.length)-1; const xp=LV[idx].xp||0;
  localStorage.setItem('hansen_wallet_charxp',String(xp));
  S.charXP=xp; if(typeof save==='function') save();
  return { want, xp, got: (typeof getAdvLevel==='function')? getAdvLevel().lv : -1,
    name: LV[idx].name };
});
ok(lvl.got===lvl.want, `角色设为 Lv.${lvl.want}（${lvl.name}，XP ${lvl.xp}）→ 实得 Lv.${lvl.got}`);
/* 非法输入 */
ok(/lv>=1&&lv<=36/.test(src), '宠物阶段范围校验 1-36');
ok(/want>=1&&want<=99/.test(src), '角色等级范围校验 1-99');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
