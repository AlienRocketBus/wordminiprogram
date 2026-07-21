// v942 真实模块集成：签到正式 receipt 是贾维斯稀有宝箱附加奖励的唯一上游凭证。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const checkinSource=fs.readFileSync(new URL('./hansen_checkin_global.js',import.meta.url),'utf8');
const addictionSource=fs.readFileSync(new URL('./hansen_addiction.js',import.meta.url),'utf8');
const quietConsole={log(){},warn(){},error(){},info(){}};

const DAY='2026-7-14';
const [YEAR,MONTH,DATE]=DAY.split('-').map(Number);
const NOW=Date.UTC(YEAR,MONTH-1,DATE,12);
class FixedDate extends Date{
  constructor(...args){super(args.length?args[0]:NOW);}
  static now(){return NOW;}
}

class FaultStorage{
  constructor(){this.map=new Map();this.count=new Map();this.rules=[];}
  fail(key,nth=1){this.rules.push({key,nth});}
  getItem(key){key=String(key);return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){
    key=String(key);value=String(value);
    const n=(this.count.get(key)||0)+1;this.count.set(key,n);
    if(this.rules.some(r=>r.key===key&&r.nth===n))throw new Error('fault:'+key+':'+n);
    this.map.set(key,value);
  }
  removeItem(key){this.map.delete(String(key));}
  key(i){return [...this.map.keys()][i]??null;}
  get length(){return this.map.size;}
}
function parse(storage,key,fallback={}){
  try{return JSON.parse(storage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}
}
function coins(storage){
  const LEDGER='integration_coin_awards',BALANCE='integration_coin_balance';
  const failures=new Set();
  return {
    failOnce(id){failures.add(id);},
    award(id,amount){
      if(failures.delete(id))return false;
      const ledger=parse(storage,LEDGER,{});
      if(ledger[id])return true;
      ledger[id]=amount;storage.setItem(LEDGER,JSON.stringify(ledger));
      storage.setItem(BALANCE,String((Number(storage.getItem(BALANCE))||0)+amount));
      return true;
    },
    seedAwards(ids){const ledger=parse(storage,LEDGER,{});for(const id of ids)if(!ledger[id])ledger[id]=0;storage.setItem(LEDGER,JSON.stringify(ledger));return true;},
    balance(){return Number(storage.getItem(BALANCE))||0;},
    ledger(){return parse(storage,LEDGER,{})}
  };
}
class El{
  constructor(){this.id='';this.style={};this.children=[];this.parentNode=null;this.firstChild=null;this.classList={add(){},remove(){}};}
  appendChild(x){this.children.push(x);x.parentNode=this;this.firstChild=this.children[0]||null;return x;}
  removeChild(x){this.children=this.children.filter(y=>y!==x);this.firstChild=this.children[0]||null;}
  insertBefore(x){return this.appendChild(x);}
  remove(){}querySelector(){return null;}querySelectorAll(){return [];}addEventListener(){}setAttribute(){}getBoundingClientRect(){return{left:0,top:0,width:10,height:10};}
}
function load(storage,wallet,randomWord=0){
  const body=new El(),head=new El();
  const document={readyState:'complete',body,head,createElement(){return new El();},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){},removeEventListener(){}};
  const reward={coin:100,xp:25,tag:'great'};
  let randomCalls=0;
  const ctx={console:quietConsole,JSON,Math,Number,Date:FixedDate,isFinite,parseInt,localStorage:storage,document,HansenCoins:wallet,crypto:{getRandomValues(a){randomCalls++;a[0]=randomWord>>>0;return a;}},
    S:{streak:0,totalXP:0,xp:0,charXP:0,learned:[],stats:{}},__hsnSaveKey:'wordIslandAnimal',__hsnSaveNow(){return true;},
    doOpenChest(){return this.HansenCheckin.claimReward(reward);},openChest(){},
    location:{pathname:'/island_animal.html'},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
    addEventListener(){},removeEventListener(){},dispatchEvent(){return true;},CustomEvent:function(){}};
  Object.defineProperty(ctx,'__rarityRandomCalls',{get(){return randomCalls;}});
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(checkinSource,ctx,{filename:'hansen_checkin_global.js'});
  vm.runInContext(addictionSource,ctx,{filename:'hansen_addiction.js'});
  ctx.HansenAddiction._test.patchChest();
  return ctx;
}

const baseId='checkin:'+DAY+':coin',extraId='addiction:rare:checkin:'+DAY+':coins';

// 超出基础协议 880/440 的伪造 committed receipt 不能成为贾维斯附加奖的可信上游。
{
  const storage=new FaultStorage(),wallet=coins(storage),key='hansen_checkin_receipt_v942:'+DAY;
  const forged=JSON.stringify({schema:1,day:DAY,txid:'checkin:'+DAY,coin:100000,xp:100000,tag:'critical',rarityRoll:0,committed:true});storage.setItem(key,forged);
  const ctx=load(storage,wallet);assert.equal(ctx.HansenCheckin.getReceipt(),null);assert.equal(ctx.HansenAddiction._test.recoverChestExtras(),true);
  assert.equal(wallet.balance(),0);assert.equal(Number(storage.getItem('hansen_pet_pieces'))||0,0);assert.equal(storage.getItem('hansen_addiction_chest_effects_v942'),null);assert.equal(storage.getItem(key),forged);
}

// 基础签到失败时，addiction 不能提前发；重试成功、重复点击和整页重载均 exactly once。
{
  const storage=new FaultStorage(),wallet=coins(storage);wallet.failOnce(baseId);
  let ctx=load(storage,wallet);
  const failed=ctx.doOpenChest();
  assert.equal(failed.ok,false);assert.equal(failed.pending,true);
  assert.equal(wallet.balance(),0);assert.equal(storage.getItem('hansen_checkin_last'),null);
  assert.equal(storage.getItem('hansen_addiction_chest_effects_v942'),null);

  const success=ctx.doOpenChest();
  assert.deepEqual(JSON.parse(JSON.stringify(success)),{ok:true,day:DAY,txid:'checkin:'+DAY,coin:100,xp:25,tag:'great',rarityRoll:0});
  assert.equal(wallet.balance(),150);assert.equal(Number(storage.getItem('hansen_wallet_charxp')),25);
  assert.equal(Number(storage.getItem('hansen_pet_pieces')),1);
  assert.equal(wallet.ledger()[baseId],100);assert.equal(wallet.ledger()[extraId],50);

  const duplicate=ctx.doOpenChest();assert.equal(duplicate.ok,false);assert.equal(duplicate.already,true);
  assert.equal(wallet.balance(),150);assert.equal(Number(storage.getItem('hansen_pet_pieces')),1);

  ctx=load(storage,wallet,0xffffffff);assert.equal(ctx.HansenCheckin.getReceipt().txid,'checkin:'+DAY);assert.equal(ctx.HansenCheckin.getReceipt().rarityRoll,0);assert.equal(ctx.__rarityRandomCalls,0);
  assert.equal(ctx.HansenAddiction._test.recoverChestExtras(),true);
  assert.equal(wallet.balance(),150);assert.equal(Number(storage.getItem('hansen_pet_pieces')),1);
}

// 基础 receipt 已提交、addiction 首次 ledger 写失败：新页面仅凭正式 getReceipt 补发一次。
{
  const storage=new FaultStorage(),wallet=coins(storage);
  storage.fail('hansen_addiction_chest_effects_v942',1);
  let ctx=load(storage,wallet),result=ctx.doOpenChest();
  assert.equal(result.ok,true);assert.equal(wallet.balance(),100);assert.equal(Number(storage.getItem('hansen_pet_pieces'))||0,0);
  assert.equal(ctx.HansenCheckin.getReceipt().txid,'checkin:'+DAY);

  ctx=load(storage,wallet);assert.equal(ctx.HansenAddiction._test.recoverChestExtras(),true);
  assert.equal(wallet.balance(),150);assert.equal(Number(storage.getItem('hansen_pet_pieces')),1);
  assert.equal(ctx.HansenAddiction._test.recoverChestExtras(),true);assert.equal(wallet.balance(),150);
}

// 同日两个用户抽样独立：A=0 传说，B=0.5 普通；各自重载均复用原 roll。
{
  const sa=new FaultStorage(),sb=new FaultStorage(),wa=coins(sa),wb=coins(sb),a=load(sa,wa,0),b=load(sb,wb,0x80000000);
  const ra=a.doOpenChest(),rb=b.doOpenChest();assert.equal(ra.day,rb.day);assert.equal(ra.rarityRoll,0);assert.equal(rb.rarityRoll,0.5);
  assert.equal(wa.balance(),150);assert.equal(Number(sa.getItem('hansen_pet_pieces')),1);assert.equal(wb.balance(),100);assert.equal(Number(sb.getItem('hansen_pet_pieces'))||0,0);
  const atx=parse(sa,'hansen_addiction_chest_effects_v942')[ra.txid],btx=parse(sb,'hansen_addiction_chest_effects_v942')[rb.txid];assert.equal(atx.rarityRoll,0);assert.equal(btx.rarityRoll,0.5);
  const ar=load(sa,wa,0xffffffff),br=load(sb,wb,0);assert.equal(ar.HansenCheckin.getReceipt().rarityRoll,0);assert.equal(br.HansenCheckin.getReceipt().rarityRoll,0.5);assert.equal(ar.__rarityRandomCalls,0);assert.equal(br.__rarityRandomCalls,0);
}

console.log('✅ v942 真实签到↔贾维斯集成：正式 receipt、失败恢复、重复调用与重载 exactly-once 通过');
