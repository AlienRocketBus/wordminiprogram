// boss 攻击特效渲染+验证模板(改 BOSS/PHASES 复用) — 见交接文档 §9
// 用法: node .devtools/boss_fx_verify_template.mjs  (先起 http.server 8877 指向 dev/)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BOSS={name:'星核帝皇·弗沙欧',hp:1300,maxHp:1300,color:'#ffd35a',island:'island_land8.html'};
const PHASES=[[1030,'taunt1'],[2000,'charge'],[3800,'rise'],[4900,'orb'],[6000,'fire'],[6300,'taunt3']];
const bro=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const ctx=await bro.newContext({viewport:{width:390,height:844}}); const pg=await ctx.newPage();
await pg.goto('http://localhost:8877/'+BOSS.island,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1600);
await pg.evaluate(()=>{try{showScreen('boss')}catch(e){} try{startBoss()}catch(e){}}); await pg.waitForTimeout(700);
const t0=Date.now();
await pg.evaluate(b=>{try{window.HansenBossAttack(b,145,355,500)}catch(e){}},BOSS);
for(const [ms,label] of PHASES){ while(Date.now()-t0<ms) await pg.waitForTimeout(20); await pg.screenshot({path:`/tmp/fx_${label}.png`}); }
console.log('captured phases → /tmp/fx_*.png (用 PIL 分析顶边溢出/脚底台词/胸口台词框亮度·view 常挂)');
await bro.close();
