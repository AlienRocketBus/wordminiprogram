// 🔴v963 逐星即时发钻专项回归（用户 2026-07-21 要求即时反馈）
// 覆盖：进行中词补发已锁星钻 / 老完成词第5星+1补齐 / 新方案词大额封存防双发 /
//       重放幂等 / 展示计数按账本重算。Mock 钱包把账本写入 localStorage，
//       使 hansen_crystal.js 的 gemAwardExists 走真实读取路径。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){this.d[String(k)]=String(v);}
  removeItem(k){delete this.d[String(k)];}
}
const j=JSON.stringify;
const LEDGER='hansen_gem_awards_v942';

function make(storage){
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;}};},head:{appendChild(){}},body:{children:[],appendChild(){}}};
  const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},clearInterval(){},addEventListener(){},innerWidth:390,innerHeight:844,allW:[{en:'a'},{en:'b'},{en:'c'}],__hsnSaveKey:'wordIslandVerbs'};
  c.window=c;c.globalThis=c;
  c.HansenCanonical={
    islands:[{id:'action',words:3}],currentRef(){return 'wordIslandVerbs';},
    resolve(ref){ref=String(ref||'').toLowerCase();return /action|wordislandverbs/.test(ref)?{id:'action',offset:0,length:3,words:3}:null;},
    toCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;},
    fromCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;}
  };
  const paid=[];
  c.HansenGems={
    seedAwards(ids){
      let led={};try{led=JSON.parse(storage.getItem(LEDGER)||'{}');}catch(e){led={};}
      (ids||[]).forEach(id=>{if(!Object.hasOwn(led,id))led[id]={amount:0,migrated:true};});
      storage.setItem(LEDGER,j(led));return true;
    },
    award(id,n){
      let led={};try{led=JSON.parse(storage.getItem(LEDGER)||'{}');}catch(e){led={};}
      if(Object.hasOwn(led,id))return true;
      led[id]={amount:n};storage.setItem(LEDGER,j(led));paid.push([id,n]);return true;
    },
    add(){return 0;},get(){return 0;}
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8'),c,{filename:'hansen_crystal.js'});
  return {c,paid,storage};
}

// ── S1: 进行中词(lv=2) → 启动对账即时补发已锁 2 星 = +2💎 ─────────────
{
  const {c,paid,storage}=make(new Storage({
    hsn_crystal_action:j({0:{lv:2,p:0,d:'2026-7-20',done:0}}),
    hansen_crystal_awards_seeded_v942:'1'
  }));
  c.HansenCrystal.reconcileCanonicalRewards();
  assert.deepEqual(paid,[['crystal:star:action:0:1',1],['crystal:star:action:0:2',1]],'S1 进行中词补发星1星2各+1');
  c.HansenCrystal.reconcileCanonicalRewards();
  assert.deepEqual(paid.length,2,'S1 重放幂等：账本已有不再发');
  const led=JSON.parse(storage.getItem(LEDGER));
  assert.equal(led['crystal:star:action:0:1'].amount,1);
  assert.equal(storage.getItem('hsn_crystal_gems'),'2','S1 展示计数=账本星钻求和');
}

// ── S2: 老完成词(done=1·大额已入账) → 第5星 +1 补齐；星1-4封存为0 ────
{
  const seed={};seed['crystal:word:action:1']={amount:4};
  const {c,paid,storage}=make(new Storage({
    hsn_crystal_action:j({1:{lv:5,p:0,d:'2026-7-1',done:1}}),
    hansen_crystal_awards_seeded_v942:'1',
    [LEDGER]:j(seed)
  }));
  c.HansenCrystal.reconcileCanonicalRewards();
  assert.deepEqual(paid,[['crystal:star:action:1:5',1]],'S2 老完成词只补第5星+1(人人5💎/词)');
  const led=JSON.parse(storage.getItem(LEDGER));
  assert.equal(led['crystal:star:action:1:1'].amount,0,'S2 星1封存为0(历史大额已覆盖)');
  assert.equal(led['crystal:star:action:1:4'].migrated,true);
  assert.equal(storage.getItem('hsn_crystal_gems'),'5','S2 展示=4(大额)+1(补齐)=5');
  c.HansenCrystal.reconcileCanonicalRewards();
  assert.equal(paid.length,1,'S2 重放幂等');
}

// ── S3: 新方案完成词(星1-5已逐星入账) → 大额收据封存·绝不双发 ─────────
{
  const seed={};for(let L=1;L<=5;L++)seed['crystal:star:action:2:'+L]={amount:1};
  const {c,paid,storage}=make(new Storage({
    hsn_crystal_action:j({2:{lv:5,p:0,d:'2026-7-21',done:1}}),
    hansen_crystal_awards_seeded_v942:'1',
    [LEDGER]:j(seed)
  }));
  c.HansenCrystal.reconcileCanonicalRewards();
  assert.deepEqual(paid,[],'S3 新方案词不发任何新钻(星钻已到账)');
  const led=JSON.parse(storage.getItem(LEDGER));
  assert.equal(led['crystal:word:action:2'].amount,0,'S3 大额收据被封存为0，历史对账永不双发');
  assert.equal(storage.getItem('hsn_crystal_gems'),'5','S3 展示=5颗星钻');
}

console.log('crystal star gems v963: in-progress backfill + veteran +1 top-up + lump seal (no double-pay) + idempotent replay + ledger-derived display ✅');
