import { chromium } from './playwright_loader.mjs';
const b=await chromium.launch({executablePath: process.env.HANSEN_CHROMIUM_PATH,args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:420,height:760}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8864/island_season1.html');
await p.waitForTimeout(1500);
// 探针: 试读BOSSES(const不可达则用startBoss间接) + 各prog值出哪个boss
const probe=await p.evaluate(()=>{
  var out={hasStartBoss:typeof window.startBoss, hasAttack:typeof window.HansenBossAttack, names:[]};
  try{
    for(var pr=0;pr<6;pr++){
      localStorage.setItem('season1_prog',String(pr));
      try{ if(window.startBoss) window.startBoss(); }catch(e){ out.names.push('ERR@'+pr+':'+e.message); continue; }
      // renderBossUI 会把 bossCurrent.name 放进 DOM, 找一下
      var el=document.querySelector('#bossContent, #bossName, .boss-name');
      var txt=document.body.innerText||'';
      var found='';
      ['破阵者','战争铁砧','流亡之刃','组装者','古老意志','铸星者'].forEach(function(n){ if(txt.indexOf(n)>=0) found+=n+' '; });
      out.names.push('prog'+pr+'→'+(found||'?'));
    }
  }catch(e){ out.err=e.message; }
  return out;
});
await b.close();
console.log('startBoss:',probe.hasStartBoss,' HansenBossAttack:',probe.hasAttack);
console.log('各进度出的boss:'); (probe.names||[]).forEach(x=>console.log('  '+x));
console.log('加载报错数:',errs.length); if(errs.length)console.log(errs.slice(0,6).join('\n'));
