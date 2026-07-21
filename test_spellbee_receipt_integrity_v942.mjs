// v942 Bee 资格完整性：拒绝 words/forged:*，真实 mastery+canonical receipt 分档幂等，cap journal 崩溃恢复。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const gemSource=fs.readFileSync(new URL('./hansen_spellbee_gems.js',import.meta.url),'utf8');
const beeHtml=fs.readFileSync(new URL('./spelling_bee.html',import.meta.url),'utf8');
const childStart=beeHtml.indexOf('var SB_STREAK_BONUS_CAP=5, SB_DAILY_COIN_CAP=2000;');
const childEnd=beeHtml.indexOf('var _advTimer=',childStart);
assert.ok(childStart>0&&childEnd>childStart);
const childSource=beeHtml.slice(childStart,childEnd);
const NOW=Date.parse('2026-07-14T12:00:00Z'),DAY='2026-7-14';
class FixedDate extends Date{constructor(...a){super(a.length?a[0]:NOW);}static now(){return NOW;}}

class Storage{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[String(k),String(v)]));this.count=new Map();this.rules=[];}
  fail(key,nth,mode='before'){this.rules.push({key:String(key),nth,mode});}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){k=String(k);v=String(v);const n=(this.count.get(k)||0)+1;this.count.set(k,n);const r=this.rules.find(x=>x.key===k&&x.nth===n);
    if(r&&r.mode==='before')throw new Error('fault-before:'+k);if(!(r&&r.mode==='noop'))this.map.set(k,v);if(r&&r.mode==='after')throw new Error('fault-after:'+k);}
  removeItem(k){this.map.delete(String(k));}
}
const read=(s,k,f={})=>{try{return JSON.parse(s.getItem(k)||JSON.stringify(f));}catch{return f;}};

function gemWallet(){const awards={},state={balance:0};return{state,awards,
  award(id,n){if(Object.hasOwn(awards,id))return awards[id]===n;awards[id]=n;state.balance+=n;return true;},
  seedAwards(ids){for(const id of ids)if(!Object.hasOwn(awards,id))awards[id]=0;return true;}};}
function gemEnv(storage,wallet){
  const canonical=()=>read(storage,'mock_bee_canonical',{});
  const ctx={console,JSON,Math,Date:FixedDate,isFinite,localStorage:storage,location:{pathname:'/island_land1.html'},
    allW:Array.from({length:30},(_,i)=>({en:'word'+i})),HansenGems:wallet,setTimeout(){return 1;},
    HansenCanonical:{currentRef(){return'land1';},resolve(){return{id:'season'};},toCanonicalIndex(_r,i){return i;},slotId(_r,i){return'season:'+i;},
      isLearned(_r,i){return (canonical()[i]||0)>0;},mastery(_r,i){return canonical()[i]||0;},isCrystalDone(){return false;}}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(gemSource,ctx,{filename:'hansen_spellbee_gems.js'});return ctx;
}
function advance(storage,i){const c=read(storage,'mock_bee_canonical',{});c[i]=(c[i]||0)+1;storage.setItem('mock_bee_canonical',JSON.stringify(c));}
function masteryReceipt(i){return{schema:1,rewardId:`sb:${DAY}:${i+1}`,day:DAY,coins:0,xp:0,kind:'mastery',word:'word'+i,index:i,createdAt:NOW+i};}
function settle(ctx,storage,i){
  const r=masteryReceipt(i),snap=ctx.HansenSpellbeeGems.prepare(r.word,i),b=ctx.HansenSpellbeeGems.begin(snap,r);
  assert.equal(b.ok,true);if(b.needsMark)advance(storage,i);const done=ctx.HansenSpellbeeGems.commit(r.rewardId);assert.equal(done.ok,true);return done;
}

// 漏洞复现输入：旧实现 Object.keys(words).length===20，会直接触发 1+2+5；v942 必须计 0、发 0。
{
  const words={};for(let i=0;i<20;i++)words['forged:'+i]='word'+i;
  assert.equal(Object.keys(words).length,20,'该输入在旧实现中正好越过全部三档');
  const storage=new Storage({hansen_bee_gem_daily:JSON.stringify({version:941,date:DAY,words,grantedTiers:[]})}),wallet=gemWallet(),ctx=gemEnv(storage,wallet);
  ctx.HansenSpellbeeGems._test.load();
  assert.equal(ctx.HansenSpellbeeGems.status().count,0);assert.equal(wallet.state.balance,0);
}

// 即使攻击者把 forged:* 塞进 v942 receipts，严格 ID/schema 也必须逐项 fail-closed。
{
  const receipts={};for(let i=0;i<20;i++)receipts['forged:'+i]={schema:1};
  const storage=new Storage({hansen_bee_gem_daily:JSON.stringify({version:942,date:DAY,receipts,grantedTiers:[]})}),wallet=gemWallet(),ctx=gemEnv(storage,wallet);
  ctx.HansenSpellbeeGems._test.load();assert.equal(ctx.HansenSpellbeeGems.status().count,0);assert.equal(wallet.state.balance,0);
}

// 真实 child mastery receipt + canonical 水位前进才计数；5/10/20 分别累计 1/3/8，reload/重复投递不二发。
{
  const storage=new Storage(),wallet=gemWallet();let ctx=gemEnv(storage,wallet);
  for(let i=0;i<5;i++)settle(ctx,storage,i);
  assert.equal(wallet.state.balance,1);assert.equal(ctx.HansenSpellbeeGems.status().count,5);
  const before=read(storage,'mock_bee_canonical')[4],again=ctx.HansenSpellbeeGems.begin(null,masteryReceipt(4));
  assert.equal(again.ok,true);assert.equal(again.committed,true);assert.equal(again.needsMark,false);assert.equal(read(storage,'mock_bee_canonical')[4],before);
  for(let i=5;i<10;i++)settle(ctx,storage,i);assert.equal(wallet.state.balance,3);
  for(let i=10;i<20;i++)settle(ctx,storage,i);assert.equal(wallet.state.balance,8);
  ctx=gemEnv(storage,wallet);ctx.HansenSpellbeeGems._test.load();ctx.HansenSpellbeeGems._test.load();
  assert.equal(ctx.HansenSpellbeeGems.status().count,20);assert.equal(wallet.state.balance,8);assert.equal(Object.keys(wallet.awards).filter(k=>k.startsWith('bee:')).length,3);
}

function childEnv(storage){
  const sent=[],parentWindow={postMessage(m){sent.push(JSON.parse(JSON.stringify(m)));}};
  const ctx={console,JSON,Math,Date:FixedDate,isFinite,localStorage:storage,_sbEmbed:true,parent:parentWindow,
    document:{hidden:false,addEventListener(){}},setTimeout(){return 1;},setInterval(){return 1;},addEventListener(){}};
  ctx.window=ctx;ctx.window.parent=parentWindow;ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);vm.runInContext(childSource,ctx,{filename:'spelling_bee-cap-journal.js'});return{ctx,sent};
}
const PENDING='hansen_sb_reward_pending_v942',TX='hansen_sb_cap_tx_v942';

// pending map 写入点崩溃：额度尚未扣；reload 从 journal 同时重建 pending+额度，再发送同一 ID。
{
  const storage=new Storage();storage.fail(PENDING,1);let child=childEnv(storage);
  assert.equal(child.ctx.sbQueueCappedReward(10,4,'word'),null);assert.ok(storage.getItem(TX));assert.equal(storage.getItem('hsn_sb_coin_today'),'0');assert.equal(child.sent.length,0);
  child=childEnv(storage);assert.equal(child.ctx.sbFlushRewardPending(),true);assert.equal(storage.getItem(TX),null);assert.equal(storage.getItem('hsn_sb_coin_today'),'10');
  assert.equal(child.sent.length,1);assert.equal(Object.keys(read(storage,PENDING)).length,1);
}

// pending 已写、额度确认写崩溃：journal 会阻止提前 post；reload 补完额度后才发送，不会免费绕过 cap。
{
  const storage=new Storage();storage.fail('hsn_sb_coin_today',2);let child=childEnv(storage);
  assert.equal(child.ctx.sbQueueCappedReward(10,4,'word'),null);assert.ok(storage.getItem(TX));assert.equal(Object.keys(read(storage,PENDING)).length,1);assert.equal(child.sent.length,0);
  child=childEnv(storage);assert.equal(child.ctx.sbFlushRewardPending(),true);assert.equal(storage.getItem(TX),null);assert.equal(storage.getItem('hsn_sb_coin_today'),'10');assert.equal(child.sent.length,1);
  const id=child.sent[0].rewardId;child.ctx.sbFlushRewardPending();assert.equal(storage.getItem('hsn_sb_coin_today'),'10');assert.equal(child.sent.at(-1).rewardId,id);
}

assert.match(beeHtml,/sbQueueCappedReward\(want,gainX,'word'\)/);
assert.match(beeHtml,/if\(!sbRecoverCapTransaction\(\)\)return false;/);
console.log('✅ v942 Bee 完整性：forged:* 0钻、真实5\/10\/20幂等、cap journal双断点恢复通过');
