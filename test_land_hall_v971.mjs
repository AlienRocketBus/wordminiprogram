// 🔴v971 星海大陆殿堂·Node契约：数据导出/开启器URL/未拥有拒开/临时全解锁
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let fails=0; const ok=(c,n)=>{console.log((c?'  ✅ ':'  ❌ ')+n); if(!c)fails++;};
const store=new Map();
const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
let lastIframe=null;
const mkEl=(tag)=>({tag,style:{},children:[],src:'',textContent:'',
  setAttribute(){},addEventListener(){},appendChild(c){this.children.push(c); if(c.tag==='iframe')lastIframe=c;},
  get parentNode(){return null;}});
const ctx={console,localStorage:storage,Date,JSON,Math,parseInt,isFinite,String,Object,Array,
  location:{pathname:'/island_animal.html'},encodeURIComponent,
  document:{getElementById:()=>null,createElement:t=>mkEl(t),body:{appendChild(m){ (m.children||[]).forEach(c=>{if(c.tag==='iframe')lastIframe=c;}); }}},
  setTimeout,clearTimeout};
ctx.window=ctx; ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('./hansen_land_cards.js',import.meta.url),'utf8'),ctx,{filename:'hansen_land_cards.js'});

console.log('T1 数据导出');
const L=ctx.HansenLandCards;
ok(!!L && Array.isArray(L.list) && L.list.length===40, '导出40张Land卡: '+(L&&L.list&&L.list.length));
const c0=L.list[0];
ok(c0.id==='L11' && c0.img.indexOf('bosses/')===0 && c0.name && c0.rarity && c0.desc, '卡字段齐备(id/img/name/rarity/desc)');

console.log('T2 开启器');
store.set('hansen_land_cardbook', JSON.stringify({owned:{L11:true,L13:true},frags:{},pity:0,totalDraws:0}));
ctx.__hsnOpenLandHall('L13');
ok(!!lastIframe, '已拥有卡→创建殿堂iframe');
ok(/boss_hall\.html\?v=\d+&land=1&card=L13&lown=L11%2CL13|lown=L11,L13/.test(decodeURIComponent(lastIframe.src)), '殿堂URL含land模式/起始卡/已拥有集: '+decodeURIComponent(lastIframe.src));
lastIframe=null;
ctx.__hsnOpenLandHall('L22');
ok(lastIframe===null, '未拥有卡→拒绝开殿堂');

console.log('T3 临时全解锁');
store.set('hansen_land_card_temp_unlock_until', String(Date.now()+3600000));
ctx.__hsnOpenLandHall('L84');
ok(!!lastIframe && decodeURIComponent(lastIframe.src).split('lown=')[1].split(',').length===40, '临时解锁→lown含全40张');

console.log('');
if(fails){console.log('❌ 失败',fails);process.exit(1);}
console.log('land hall v971: 40-card export + hall URL contract + not-owned rejected + temp-unlock full roster ✅');
