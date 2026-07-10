import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const bro = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
// pc() 现在支持 hex; effBg 从 gradient 里也抓 hex 首色
const AUDIT=`(function(){
function pc(s){s=(s||'').trim();if(s[0]==='#'){var h=s.slice(1);if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),1];}var m=(s.match(/[\\d.]+/g)||[]).map(Number);if(m.length<3)return[0,0,0,0];return[m[0],m[1],m[2],m.length>3?m[3]:1];}
function firstCol(bi){var m=bi.match(/rgba?\\([^)]+\\)/);if(m)return m[0];m=bi.match(/#[0-9a-fA-F]{6}/);if(m)return m[0];m=bi.match(/#[0-9a-fA-F]{3}\\b/);if(m)return m[0];return null;}
function over(t,b){var a=t[3]+b[3]*(1-t[3]);if(a<=0)return[0,0,0,0];return[(t[0]*t[3]+b[0]*b[3]*(1-t[3]))/a,(t[1]*t[3]+b[1]*b[3]*(1-t[3]))/a,(t[2]*t[3]+b[2]*b[3]*(1-t[3]))/a,a];}
function effBg(el){var st=[],n=el;while(n&&n.nodeType===1){var cs=getComputedStyle(n);var bi=cs.backgroundImage;if(bi&&bi!=='none'){var fc=firstCol(bi);if(fc){var g=pc(fc);if(g[3]>0)st.push(g);}}var bc=pc(cs.backgroundColor);if(bc[3]>0)st.push(bc);n=n.parentElement;}var r=[255,255,255,1];for(var i=st.length-1;i>=0;i--)r=over(st[i],r);return r;}
function lum(c){var a=[c[0],c[1],c[2]].map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];}
function ct(a,b){var l1=lum(a),l2=lum(b);return Math.round(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05))*10)/10;}
var bad=[];document.querySelectorAll('body *').forEach(function(el){var direct=[].filter.call(el.childNodes,function(n){return n.nodeType===3&&n.textContent.trim();}).map(n=>n.textContent).join('');if(!direct||!/[\\u4e00-\\u9fa5A-Za-z0-9]/.test(direct))return;var cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)<0.4)return;var r=el.getBoundingClientRect();if(r.width<8||r.height<6||r.bottom<0||r.top>2600)return;var bg=effBg(el);var c=ct(pc(cs.color),bg);if(c<3){var id=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:(''+el.className))||el.tagName;bad.push(id.split(' ').slice(0,2).join('.').slice(0,18)+' "'+direct.trim().slice(0,7)+'" c='+c+' 底亮'+Math.round(lum(bg)*100)/100);}});return [...new Set(bad)].slice(0,14);})()`;
async function ac(url, setup, label){
  const ctx=await bro.newContext({viewport:{width:390,height:1500}});
  await ctx.addInitScript(()=>{try{localStorage.setItem('hansen_palette_global','cloud');}catch(e){}});
  const pg=await ctx.newPage();
  try{ await pg.goto(url,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1600); if(setup) await pg.evaluate(setup).catch(()=>{}); await pg.waitForTimeout(1000);
    const bad=await pg.evaluate(AUDIT); console.log(`【${label}】${bad.length?'❌ '+bad.length+'\\n    '+bad.join('\\n    '):'✅'}`);
  }catch(e){ console.log(`【${label}】err ${e.message.slice(0,40)}`); }
  await ctx.close();
}
await ac('http://localhost:8877/index.html', null, '主页');
await ac('http://localhost:8877/island_animal.html', ()=>{try{startEagle();}catch(e){}}, '雄鹰选择器');
await bro.close();
