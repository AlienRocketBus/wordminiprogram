import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./hansen_addiction.js',import.meta.url),'utf8');
const NOW=Date.parse('2026-07-14T12:00:00Z');
const DAY='2026-7-14',TXID='checkin:'+DAY,EFFECT='hansen_milestone_effects_v942',CHEST='hansen_addiction_chest_effects_v942';
class FixedDate extends Date{constructor(...a){super(a.length?a[0]:NOW);}static now(){return NOW;}}
class Storage{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
  key(i){return [...this.map.keys()][i]??null;}
  get length(){return this.map.size;}
}
const parse=(s,k,f={})=>{try{return JSON.parse(s.getItem(k)??JSON.stringify(f));}catch{return f;}};
class El{
  constructor(){this.style={};this.children=[];this.parentNode=null;this.firstChild=null;this.classList={add(){},remove(){}};}
  appendChild(x){this.children.push(x);x.parentNode=this;this.firstChild=this.children[0]||null;return x;}
  removeChild(x){this.children=this.children.filter(y=>y!==x);this.firstChild=this.children[0]||null;}
  insertBefore(x){return this.appendChild(x);}remove(){}addEventListener(){}setAttribute(){}
  querySelector(){return {addEventListener(){}};}querySelectorAll(){return [];}
}
function coinWallet(storage){
  const awards={};let balance=0;
  return {award(id,n){if(!Object.hasOwn(awards,id)){awards[id]=n;balance+=n;}return true;},seedAwards(ids){for(const id of ids)if(!Object.hasOwn(awards,id))awards[id]=0;return true;},balance(){return balance;},awards};
}
function boot(storage,{streak=0,receipt=null}={}){
  const body=new El(),head=new El(),wallet=coinWallet(storage),document={readyState:'complete',body,head,createElement(){return new El();},getElementById(){return null;},addEventListener(){},removeEventListener(){}};
  const ctx={console:{log(){},warn(){},error(){}},JSON,Math,Number,isFinite,Date:FixedDate,localStorage:storage,document,S:{streak,totalXP:0,xp:0,learned:[]},HansenCoins:wallet,
    HansenCheckin:{getStreak(){return streak;},getReceipt(day){return receipt&&receipt.day===day?receipt:null;}},location:{pathname:'/island_animal.html'},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},CustomEvent:function(){}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'hansen_addiction.js'});return {ctx,wallet};
}
function baseSeed(extra={}){return {hansen_milestone_awards_seeded_v942:'1',hansen_milestones_claimed:'[]',['hansen_snapshot_'+DAY]:'{}',...extra};}
function official(roll=.01){return {ok:true,day:DAY,txid:TXID,coin:100,xp:25,tag:'great',rarityRoll:roll};}
function chestTx({base=0,target=1,roll=.01,coinConfirmed=true}={}){return {version:942,txid:TXID,day:DAY,rarityRoll:roll,rarity:'legendary',coinConfirmed,
  pet:{source:'addiction:rare:'+TXID+':pet',amount:1,base,target,confirmed:false},complete:false};}

// 未确认的 huge/missing milestone target 不可信：按当前权威 base + 固定 120 分钟重建。
{
  const forged={version:942,days:14,source:'streak-milestone:14',createdAt:NOW,coin:true,
    boost:{minutes:120,target:8_000_000_000_000_000,confirmed:false},xp2x:{days:0,target:0,confirmed:true},complete:false};
  const storage=new Storage(baseSeed({[EFFECT]:JSON.stringify({14:forged}),hsn_crystal_boost_until:'1000'}));boot(storage,{streak:14});
  const tx=parse(storage,EFFECT)[14],expected=NOW+120*60000;
  assert.equal(tx.createdAt,NOW);assert.equal(tx.boost.base,1000);assert.equal(tx.boost.target,expected);assert.equal(tx.boost.confirmed,true);
  assert.equal(tx.xp2x.base,0);assert.equal(tx.xp2x.target,0);assert.equal(Number(storage.getItem('hsn_crystal_boost_until')),expected);assert.ok(expected<8_000_000_000_000_000);
}

// 已确认的早期结构只迁移元数据，不得按其伪造 boostUntil 再次延长权益。
{
  const legacy={coin:true,boostUntil:8_000_000_000_000_000,xpUntil:0,boostConfirmed:true,xpConfirmed:true,complete:true};
  const storage=new Storage(baseSeed({[EFFECT]:JSON.stringify({14:legacy}),hsn_crystal_boost_until:'1234'}));boot(storage,{streak:14});
  const tx=parse(storage,EFFECT)[14];assert.equal(storage.getItem('hsn_crystal_boost_until'),'1234');assert.equal(tx.boost.confirmed,true);assert.equal(tx.boost.base,1234);assert.equal(tx.complete,true);
}

// addiction ledger 不能自证签到：没有 HansenCheckin 正式 committed receipt 时，伪造 legendary 不发金币/碎片。
{
  const forged=chestTx({coinConfirmed:false}),raw=JSON.stringify({[TXID]:forged}),storage=new Storage(baseSeed({[CHEST]:raw,hansen_pet_pieces:'0'})),{ctx,wallet}=boot(storage,{receipt:null});
  assert.equal(ctx.HansenAddiction._test.settleChestReceipt({ok:true,day:DAY,txid:TXID,rarityRoll:.01}),false);
  assert.equal(ctx.HansenAddiction._test.recoverChestExtras(),false);assert.equal(wallet.balance(),0);assert.equal(storage.getItem('hansen_pet_pieces'),'0');assert.equal(storage.getItem(CHEST),raw);
}

// 有正式 receipt 也不能信任伪造 target；已有 tx 非法时 fail-closed，而不是从当前余额重新造一笔后抬高。
{
  const bad=chestTx({base:0,target:999999}),storage=new Storage(baseSeed({[CHEST]:JSON.stringify({[TXID]:bad}),hansen_pet_pieces:'5'})),{ctx,wallet}=boot(storage,{receipt:official()});
  assert.equal(ctx.HansenAddiction._test.settleChestReceipt(official()),false);assert.equal(storage.getItem('hansen_pet_pieces'),'5');assert.equal(wallet.balance(),0);
}

// 未确认碎片事务只接受当前余额精确等于 base 或 target；消费/并发形成的第三值绝不回抬。
{
  const tx=chestTx({base:5,target:6}),storage=new Storage(baseSeed({[CHEST]:JSON.stringify({[TXID]:tx}),hansen_pet_pieces:'4'})),{ctx,wallet}=boot(storage,{receipt:official()});
  assert.equal(ctx.HansenAddiction._test.settleChestReceipt(official()),false);assert.equal(storage.getItem('hansen_pet_pieces'),'4');assert.equal(wallet.balance(),0);assert.equal(parse(storage,CHEST)[TXID].pet.confirmed,false);
}

// 损坏碎片余额必须 fail-closed，不能按 0 重建并覆盖证据。
{
  const storage=new Storage(baseSeed({hansen_pet_pieces:'not-a-number'})),{ctx,wallet}=boot(storage,{receipt:official()});
  assert.equal(ctx.HansenAddiction._test.settleChestReceipt(official()),false);assert.equal(storage.getItem('hansen_pet_pieces'),'not-a-number');assert.equal(storage.getItem(CHEST),null);assert.equal(wallet.balance(),0);
}

console.log('addiction authority v942: bounded milestone targets + official check-in authorization + exact pet CAS ✅');
