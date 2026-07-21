// v942 Bee 钻石、连续签到里程碑、稀有签到宝箱的故障注入与 exactly-once 回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const beeSource=fs.readFileSync(new URL('./hansen_spellbee_gems.js',import.meta.url),'utf8');
const addictionSource=fs.readFileSync(new URL('./hansen_addiction.js',import.meta.url),'utf8');
const NOW=Date.parse('2026-07-14T12:00:00Z');
const quietConsole={log(){},error(){},warn(){},info(){}};
class FixedDate extends Date{constructor(...a){super(a.length?a[0]:NOW);}static now(){return NOW;}}

class FaultStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.count=new Map();this.rules=[];}
  seed(k,v){this.map.set(k,String(v));}
  fail(key,nth,mode='before'){this.rules.push({key,nth,mode});}
  setItem(k,v){k=String(k);v=String(v);const n=(this.count.get(k)||0)+1;this.count.set(k,n);const r=this.rules.find(x=>x.key===k&&x.nth===n);
    if(r&&r.mode==='before')throw new Error('fault-before:'+k+':'+n);if(!(r&&r.mode==='noop'))this.map.set(k,v);if(r&&r.mode==='after')throw new Error('fault-after:'+k+':'+n);}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  removeItem(k){this.map.delete(String(k));}
  key(i){return [...this.map.keys()][i]??null;}
  get length(){return this.map.size;}
}
const json=(s,k,f={})=>{try{return JSON.parse(s.getItem(k)||JSON.stringify(f));}catch{return f;}};

function wallet(storage,kind){
  const ledgerKey='mock_'+kind+'_awards',balanceKey='mock_'+kind+'_balance';let failIds=new Set();
  return {
    failOnce(id){failIds.add(id);},
    award(id,n){if(failIds.delete(id))return false;const l=json(storage,ledgerKey,{});if(l[id])return true;l[id]=n;storage.setItem(ledgerKey,JSON.stringify(l));storage.setItem(balanceKey,String((Number(storage.getItem(balanceKey))||0)+n));return true;},
    seedAwards(ids){const l=json(storage,ledgerKey,{});for(const id of ids)if(!l[id])l[id]=0;storage.setItem(ledgerKey,JSON.stringify(l));return true;},
    balance(){return Number(storage.getItem(balanceKey))||0;},ledger(){return json(storage,ledgerKey,{})}
  };
}

function beeEnv(storage,gemWallet){
  const ctx={console,JSON,Math,Date:FixedDate,isFinite,localStorage:storage,location:{pathname:'/island_land1.html'},
    allW:Array.from({length:30},(_,i)=>({en:'word'+i})),HansenGems:gemWallet,setTimeout(){return 1;},
    HansenCanonical:{currentRef(){return'land1';},slotId(_r,i){return'season:'+i;},resolve(){return{id:'season'};},toCanonicalIndex(_r,i){return i;},
      isCrystalDone(){return false;},isLearned(_r,i){return (json(storage,'mock_bee_mastery',{})[i]||0)>0;},mastery(_r,i){return json(storage,'mock_bee_mastery',{})[i]||0;}}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(beeSource,ctx,{filename:'hansen_spellbee_gems.js'});return ctx;
}
function recordWords(ctx,start,end){for(let i=start;i<end;i++){
  const snap=ctx.HansenSpellbeeGems.prepare('word'+i,i),receipt={schema:1,rewardId:'sb:2026-7-14:'+(i+1),day:'2026-7-14',coins:0,xp:0,kind:'mastery',word:'word'+i,index:i,createdAt:NOW+i};
  const begun=ctx.HansenSpellbeeGems.begin(snap,receipt);if(!begun.ok)continue;
  if(begun.needsMark){const m=json(ctx.localStorage,'mock_bee_mastery',{});m[i]=(m[i]||0)+1;ctx.localStorage.setItem('mock_bee_mastery',JSON.stringify(m));}
  ctx.HansenSpellbeeGems.commit(receipt.rewardId);
}}

// Bee 1：钱包 award 暂时失败，词位已落账；重载会用稳定 source 重试且只发一次。
{
  const s=new FaultStorage(),g=wallet(s,'gem');g.failOnce('bee:2026-7-14:tier:5');let c=beeEnv(s,g);recordWords(c,0,5);
  assert.equal(g.balance(),0);assert.deepEqual(json(s,'hansen_bee_gem_daily').grantedTiers,[]);
  c=beeEnv(s,g);c.HansenSpellbeeGems._test.load();
  assert.equal(g.balance(),1);assert.deepEqual(json(s,'hansen_bee_gem_daily').grantedTiers,[5]);
  c.HansenSpellbeeGems._test.load();assert.equal(g.balance(),1);
}

// Bee 2：award 已成功但 granted 日账回写失败；同 ID 重试不重复钻石。
{
  const s=new FaultStorage(),g=wallet(s,'gem');s.fail('hansen_bee_gem_daily',11,'before');let c=beeEnv(s,g);recordWords(c,0,5);
  assert.equal(g.balance(),1);assert.deepEqual(json(s,'hansen_bee_gem_daily').grantedTiers,[]);
  c=beeEnv(s,g);c.HansenSpellbeeGems._test.load();assert.equal(g.balance(),1);assert.deepEqual(json(s,'hansen_bee_gem_daily').grantedTiers,[5]);
}

// Bee 3：20 张真实 mastery/canonical 收据逐档对账；中间档失败后补齐 1+2+5，绝不重复。
{
  const s=new FaultStorage(),g=wallet(s,'gem');g.failOnce('bee:2026-7-14:tier:10');let c=beeEnv(s,g);recordWords(c,0,20);
  c=beeEnv(s,g);c.HansenSpellbeeGems._test.load();assert.equal(g.balance(),8);
  assert.deepEqual(json(s,'hansen_bee_gem_daily').grantedTiers,[5,10,20]);assert.equal(Object.keys(g.ledger()).filter(k=>k.startsWith('bee:')).length,3);
}

// Bee 4：v941 当天已发档位只 seed 新账本，不补发。
{
  const words={};for(let i=0;i<5;i++)words['season:'+i]='word'+i;
  const s=new FaultStorage({hansen_bee_gem_daily:JSON.stringify({version:941,date:'2026-7-14',words,grantedTiers:[5]})}),g=wallet(s,'gem');
  const c=beeEnv(s,g);c.HansenSpellbeeGems._test.load();assert.equal(g.balance(),0);assert.equal(g.ledger()['bee:2026-7-14:tier:5'],0);
}

class El{
  constructor(){this.style={};this.classList={add(){},remove(){}};this.children=[];this.parentNode=null;this.firstChild=null;}
  appendChild(x){this.children.push(x);x.parentNode=this;return x;}removeChild(x){this.children=this.children.filter(y=>y!==x);}remove(){}
  querySelector(){return{addEventListener(){}};}addEventListener(){}insertBefore(x){return this.appendChild(x);}setAttribute(){}
}
function addictionEnv(storage,{streak=0,coinWallet,receipt=null,base='success'}={}){
  const body=new El(),head=new El(),document={readyState:'complete',body,head,createElement(){return new El();},getElementById(){return null;},addEventListener(){},removeEventListener(){}};
  let calls=0;const committed=receipt;
  const ctx={console:quietConsole,JSON,Math,Date:FixedDate,isFinite,localStorage:storage,document,S:{streak,totalXP:0,xp:0,learned:[]},
    HansenCoins:coinWallet,HansenCheckin:{getStreak(){return streak;},claimedToday(){return false;},getReceipt(){return committed;}},
    doOpenChest(){calls++;if(base==='fail')return{ok:false,day:receipt?.day,txid:receipt?.txid};if(calls===1)return receipt;return{ok:false,receipt};},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},dispatchEvent(){return true;},CustomEvent:function(){},
    location:{pathname:'/island_animal.html'}};
  ctx.window=ctx;ctx.window.addEventListener=()=>{};vm.createContext(ctx);vm.runInContext(addictionSource,ctx,{filename:'hansen_addiction.js'});
  return {ctx,get calls(){return calls;}};
}

const EFFECT='hansen_milestone_effects_v942',CLAIM='hansen_milestones_claimed';
function settled(storage,day,coin,boostMinutes,xpDays=0){
  assert.ok(json(storage,CLAIM,[]).includes(day));assert.equal(Number(storage.getItem('mock_coin_balance'))||0,coin);
  assert.equal(Number(storage.getItem('hsn_crystal_boost_until'))||0,NOW+boostMinutes*60000);
  if(xpDays)assert.equal(Date.parse(storage.getItem('hansen_xp2x_until')),NOW+xpDays*86400000);
  const tx=json(storage,EFFECT)[day];assert.equal(tx.coin,true);assert.equal(tx.boost.confirmed,true);assert.equal(tx.xp2x.confirmed,true);assert.equal(tx.complete,true);
}
function retryMilestone(storage,streak){const w=wallet(storage,'coin'),e=addictionEnv(storage,{streak,coinWallet:w});for(let i=0;i<4;i++)e.ctx.HansenAddiction.checkMilestones();return e;}

// 里程碑 14 天：每个持久化断点和钱包失败都可重载恢复；目标时间不被重复延长。
for(const fault of [
  {name:'prepare-ledger',arm:s=>s.fail(EFFECT,1)},
  {name:'coin-award',coin:true},
  {name:'coin-confirm-ledger',arm:s=>s.fail(EFFECT,2)},
  {name:'boost-target',arm:s=>s.fail('hsn_crystal_boost_until',1)},
  {name:'boost-confirm-ledger',arm:s=>s.fail(EFFECT,3)},
  {name:'complete-ledger',arm:s=>s.fail(EFFECT,4)},
  {name:'claimed',arm:s=>s.fail(CLAIM,1)}
]){
  const s=new FaultStorage(),w=wallet(s,'coin');if(fault.arm)fault.arm(s);if(fault.coin)w.failOnce('streak-milestone:14');
  addictionEnv(s,{streak:14,coinWallet:w});retryMilestone(s,14);settled(s,14,120,120);
  const beforeBoost=s.getItem('hsn_crystal_boost_until');retryMilestone(s,14);assert.equal(s.getItem('hsn_crystal_boost_until'),beforeBoost,`${fault.name}: 不得重复延长`);
}

// 30 天 XP2X 的目标写入/确认写入失败也必须恢复，14 天旧领取不补发。
for(const fault of [
  {name:'xp-target',key:'hansen_xp2x_until',nth:1},
  {name:'xp-confirm-ledger',key:EFFECT,nth:4}
]){
  const seed={[CLAIM]:JSON.stringify([14]),[EFFECT]:JSON.stringify({14:{version:942,days:14,source:'streak-milestone:14',migrated:true,coin:true,boost:{confirmed:true},xp2x:{confirmed:true},complete:true}}),hansen_milestone_awards_seeded_v942:'1'};
  const s=new FaultStorage(seed),w=wallet(s,'coin');w.seedAwards(['streak-milestone:14']);s.fail(fault.key,fault.nth);
  addictionEnv(s,{streak:30,coinWallet:w});retryMilestone(s,30);settled(s,30,250,240,3);
  const b=s.getItem('hsn_crystal_boost_until'),x=s.getItem('hansen_xp2x_until');retryMilestone(s,30);assert.equal(s.getItem('hsn_crystal_boost_until'),b);assert.equal(s.getItem('hansen_xp2x_until'),x);
}

// 100 天仍使用固定 source 与 600/480 权益。
{
  const lower={14:{migrated:true},30:{migrated:true}},s=new FaultStorage({[CLAIM]:JSON.stringify([14,30]),[EFFECT]:JSON.stringify(lower),hansen_milestone_awards_seeded_v942:'1'}),w=wallet(s,'coin');
  w.seedAwards(['streak-milestone:14','streak-milestone:30']);retryMilestone(s,100);settled(s,100,600,480);assert.equal(w.ledger()['streak-milestone:100'],600);
}

function receiptFor(wanted,day='2026-7-14'){
  const rolls={legendary:.01,epic:.05,rare:.20,common:.50},rarityRoll=rolls[wanted];if(rarityRoll===undefined)throw new Error('rarity not found');
  return{ok:true,day,txid:'checkin:'+day,rarityRoll};
}

// 宝箱：正式签到失败绝不发附加奖励。
{
  const s=new FaultStorage(),w=wallet(s,'coin'),probe=addictionEnv(s,{coinWallet:w,receipt:receiptFor('legendary'),base:'fail'});
  probe.ctx.HansenAddiction._test.patchChest();probe.ctx.doOpenChest();assert.equal(w.balance(),0);assert.equal(Number(s.getItem('hansen_pet_pieces'))||0,0);assert.equal(s.getItem('hansen_addiction_chest_effects_v942'),null);
}

// 宝箱：成功 receipt 的 legendary 50 金币+1碎片，重复调用只 cleanup，不再发。
{
  const s=new FaultStorage(),w=wallet(s,'coin'),receipt=receiptFor('legendary');
  const e=addictionEnv(s,{coinWallet:w,receipt});e.ctx.HansenAddiction._test.patchChest();e.ctx.doOpenChest();e.ctx.doOpenChest();
  assert.equal(w.balance(),50);assert.equal(Number(s.getItem('hansen_pet_pieces')),1);assert.equal(Object.keys(w.ledger()).filter(k=>k.includes(receipt.txid)).length,1);
  assert.equal(json(s,'hansen_addiction_chest_effects_v942')[receipt.txid].rarityRoll,.01);
}

// 同一日不同用户使用各自 receipt.rarityRoll，不得因 txid/日期相同而得到相同稀有度。
{
  const legendary=receiptFor('legendary'),common=receiptFor('common'),sa=new FaultStorage(),sb=new FaultStorage(),wa=wallet(sa,'coin'),wb=wallet(sb,'coin');
  const a=addictionEnv(sa,{coinWallet:wa,receipt:legendary}),b=addictionEnv(sb,{coinWallet:wb,receipt:common});a.ctx.HansenAddiction._test.patchChest();b.ctx.HansenAddiction._test.patchChest();a.ctx.doOpenChest();b.ctx.doOpenChest();
  assert.equal(wa.balance(),50);assert.equal(Number(sa.getItem('hansen_pet_pieces')),1);assert.equal(wb.balance(),0);assert.equal(Number(sb.getItem('hansen_pet_pieces'))||0,0);
  assert.equal(a.ctx.HansenAddiction._test.chestRarity(legendary), 'legendary');assert.equal(b.ctx.HansenAddiction._test.chestRarity(common),'common');
}

// 严格拒绝携带非法 roll 的新 receipt；旧无 roll receipt 仍按 txid 稳定 fallback，并把 fallback roll 写入自身 tx。
{
  const s=new FaultStorage(),w=wallet(s,'coin'),day='2026-7-15',txid='checkin:'+day,legacy={ok:true,day,txid},e=addictionEnv(s,{coinWallet:w,receipt:legacy}),api=e.ctx.HansenAddiction._test;
  for(const bad of [-.1,1,NaN,Infinity,'0.1'])assert.equal(api.checkinReceipt({ok:true,day,txid,rarityRoll:bad}),null);
  const normalized=api.checkinReceipt(legacy);assert.ok(normalized);assert.equal(api.chestRarity(normalized),api.chestRarity(txid));assert.equal(api.settleChestReceipt(legacy),true);
  assert.equal(json(s,'hansen_addiction_chest_effects_v942')[txid].rarityRoll,normalized.rarityRoll);
}

// 宝箱：ledger 首写、coin、coin确认、碎片目标、碎片确认、complete 各断点均可由 receipt/ledger 重载补齐。
for(const fault of [
  {name:'ledger-first',arm:s=>s.fail('hansen_addiction_chest_effects_v942',1)},
  {name:'coin-award',coin:true},
  {name:'coin-confirm',arm:s=>s.fail('hansen_addiction_chest_effects_v942',2)},
  {name:'pet-target',arm:s=>s.fail('hansen_pet_pieces',1)},
  {name:'pet-confirm',arm:s=>s.fail('hansen_addiction_chest_effects_v942',3)},
  {name:'complete',arm:s=>s.fail('hansen_addiction_chest_effects_v942',4)}
]){
  const s=new FaultStorage(),w=wallet(s,'coin'),receipt=receiptFor('legendary');
  if(fault.arm)fault.arm(s);if(fault.coin)w.failOnce('addiction:rare:'+receipt.txid+':coins');
  const first=addictionEnv(s,{coinWallet:w,receipt});first.ctx.HansenAddiction._test.patchChest();first.ctx.doOpenChest();
  const reload=addictionEnv(s,{coinWallet:w,receipt});for(let i=0;i<4;i++)reload.ctx.HansenAddiction._test.recoverChestExtras();
  assert.equal(w.balance(),50,`${fault.name}: extra coin exactly once`);assert.equal(Number(s.getItem('hansen_pet_pieces')),1,`${fault.name}: pet piece exactly once`);
  const beforeCoin=w.balance(),beforePiece=s.getItem('hansen_pet_pieces');reload.ctx.HansenAddiction._test.recoverChestExtras();
  assert.equal(w.balance(),beforeCoin);assert.equal(s.getItem('hansen_pet_pieces'),beforePiece);
}

// 静态守卫：正式路径禁止 add()/addCoin，稳定 source 与 receipt 接口必须存在。
assert.match(beeSource,/bee:'\+s\.date\+':tier:'\+t\.n/);assert.match(beeSource,/HansenGems\.award|gm\.award/);
assert.match(addictionSource,/HansenCoins\.award\(tx\.source/);assert.match(addictionSource,/addiction:rare:/);
assert.doesNotMatch(addictionSource.slice(addictionSource.indexOf('function patchChest'),addictionSource.indexOf('function patchAddXP')),/addCoin\(|addGem\(/);

console.log('✅ v942 Bee/里程碑/稀有签到宝箱：稳定 source、故障恢复与 exactly-once 回归通过');
