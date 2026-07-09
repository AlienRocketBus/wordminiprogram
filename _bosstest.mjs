import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});
await p.goto('http://localhost:8864/island_season1.html');await p.waitForTimeout(1300);
const r=await p.evaluate(()=>{
  var out={};
  out.islandKey = (typeof getCurrentIslandKey==='function')?getCurrentIslandKey():'no fn';
  out.BOSSES_global = typeof BOSSES;
  out.BOSSES_window = typeof window.BOSSES;
  try{ out.BOSSES_len = (typeof BOSSES!=='undefined')?BOSSES.length:-1; out.b0=(typeof BOSSES!=='undefined')?BOSSES[0].name:'?'; out.b5=(typeof BOSSES!=='undefined'&&BOSSES[5])?BOSSES[5].name:'?'; }catch(e){out.err=e.message;}
  out.BOSS_CARDS = typeof BOSS_CARDS;
  out.renderBossPicker = typeof window.hansenRenderBossPicker;
  out.startBoss = typeof window.startBoss;
  return out;
});
await b.close();
console.log(JSON.stringify(r,null,1));
