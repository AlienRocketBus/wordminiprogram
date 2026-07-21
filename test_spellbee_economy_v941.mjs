import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const beeHtml = fs.readFileSync(new URL('./spelling_bee.html', import.meta.url), 'utf8');
const parentSource = fs.readFileSync(new URL('./hansen_spellbee.js', import.meta.url), 'utf8');
const gemSource = fs.readFileSync(new URL('./hansen_spellbee_gems.js', import.meta.url), 'utf8');

class Storage {
  constructor(seed={}) { this.data={...seed}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.data,k) ? this.data[k] : null; }
  setItem(k,v) { this.data[k]=String(v); }
  removeItem(k) { delete this.data[k]; }
}

// Bee 日账只按 hsn_sb_coin_today clamp；1999 边界不能越过 2000。
const ledgerStart = beeHtml.indexOf('var SB_STREAK_BONUS_CAP=5, SB_DAILY_COIN_CAP=2000;');
const ledgerEnd = beeHtml.indexOf('var _advTimer=', ledgerStart);
assert.ok(ledgerStart > 0 && ledgerEnd > ledgerStart);
const ledgerCode = beeHtml.slice(ledgerStart, ledgerEnd);
assert.doesNotMatch(ledgerCode, /HansenCoins|hansen_wallet_coins/, 'Bee 日上限不得读取全局钱包');
const day = new Date().toDateString();
const ledgerStorage = new Storage({hsn_sb_coin_day:day, hsn_sb_coin_today:'1999'});
const ledgerContext = {localStorage:ledgerStorage, Date, Math, isFinite, S:{bot:'hard',customCpm:80}, BOT_CPM:{easy:20,mid:50,hard:80}, letters:w=>w.en};
vm.createContext(ledgerContext);
vm.runInContext(ledgerCode, ledgerContext);
assert.equal(ledgerContext.sbTakeCoin(20), 1);
assert.equal(ledgerContext.sbCoinToday(), 2000);
assert.equal(ledgerContext.sbTakeCoin(1), 0);
ledgerStorage.setItem('hsn_sb_coin_today','999999');
assert.equal(ledgerContext.sbCoinToday(), 2000);
assert.equal(ledgerStorage.getItem('hsn_sb_coin_today'),'2000');

// canonical slot：Land1[0] 与 Season[0] 是同一 slot；同日只计一次。
const shared = new Storage();
const gems = [];
const receiptDay=(()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();})();
let receiptSeq=0;
function canonicalMastery(){try{return JSON.parse(shared.getItem('mock_bee_mastery')||'{}');}catch{return {};}}
function advanceCanonical(idx){const m=canonicalMastery();m[idx]=(m[idx]||0)+1;shared.setItem('mock_bee_mastery',JSON.stringify(m));}
function gemContext(ref='land1', mastered=false) {
  const context = {
    console, JSON, Math, Date, isFinite, localStorage:shared,
    location:{pathname:ref==='season'?'/island_season.html':'/island_land1.html'},
    allW:Array.from({length:30},(_,i)=>({en:'word'+i})),
    HansenCanonical:{
      currentRef(){return ref;},
      slotId(_ref,idx){return 'season:'+idx;},
      resolve(){return {id:'season'};},
      toCanonicalIndex(_ref,idx){return idx;},
      isCrystalDone(_ref,idx){return mastered && idx===9;},
      isLearned(_ref,idx){return (canonicalMastery()[idx]||0)>0;},
      mastery(_ref,idx){return canonicalMastery()[idx]||0;}
    },
    HansenGems:{add(n){gems.push(n);}},
    setTimeout(){return 1;}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(gemSource,context,{filename:'hansen_spellbee_gems.js'});
  return context;
}
function settleMastery(context,word,idx,receipt=null){
  const snap=context.HansenSpellbeeGems.prepare(word,idx);
  receipt=receipt||{schema:1,rewardId:`sb:${receiptDay}:${++receiptSeq}`,day:receiptDay,coins:0,xp:0,kind:'mastery',word,index:idx,createdAt:Date.now()+receiptSeq};
  const begun=context.HansenSpellbeeGems.begin(snap,receipt);assert.equal(begun.ok,true);
  if(begun.needsMark)advanceCanonical(idx);
  return {receipt,begun,done:context.HansenSpellbeeGems.commit(receipt.rewardId)};
}
let gc=gemContext('land1',false);
const snap=gc.HansenSpellbeeGems.prepare('word0',0);
assert.equal(snap.slot,'season:0');
assert.equal(snap.newBefore,true);
const first=settleMastery(gc,'word0',0);assert.equal(first.done.count,1);
const replay=gc.HansenSpellbeeGems.begin(null,first.receipt);assert.equal(replay.committed,true);assert.equal(replay.needsMark,false);
gc=gemContext('season',false);
const alias=settleMastery(gc,'word0',0);assert.equal(alias.done.eligible,false);assert.equal(alias.done.count,1);
for(let i=1;i<5;i++) settleMastery(gc,'word'+i,i);
assert.deepEqual(gems,[1]);
const masteredCtx=gemContext('land1',true);
const oldSnap=masteredCtx.HansenSpellbeeGems.prepare('word9',9);
assert.equal(oldSnap.newBefore,false);
const mastered=settleMastery(masteredCtx,'word9',9);assert.equal(mastered.done.eligible,false);assert.equal(mastered.done.count,5);

// v946 父页只接受当前 active iframe；旧普通 mastery 只严格核对词位后 ACK 清理，
// 不再 prepare/mark/commit（结晶只接受探索页 focused Bee 的 10/7/5 完成 proof）。
function makeParent() {
  const nodes=new Map(), listeners={}, acks=[], order=[], sourceWindow={postMessage(m){acks.push(m);if(m&&m.type==='hsn_sb_reward_ack')order.push('ack');}}, storage=new Storage();
  function element(tag) {
    const el={tag,style:{},children:[],parentNode:null,contentWindow:tag==='iframe'?sourceWindow:undefined,
      setAttribute(){},appendChild(ch){this.children.push(ch);ch.parentNode=this;},
      removeChild(ch){this.children=this.children.filter(x=>x!==ch);ch.parentNode=null;}
    };
    Object.defineProperty(el,'id',{get(){return this._id||'';},set(v){this._id=v;if(v)nodes.set(v,this);}});
    return el;
  }
  const body=element('body');
  body.appendChild=function(ch){this.children.push(ch);ch.parentNode=this;if(ch.id)nodes.set(ch.id,ch);};
  body.removeChild=function(ch){this.children=this.children.filter(x=>x!==ch);if(ch.id)nodes.delete(ch.id);ch.parentNode=null;};
  const awards=[], coinIds={}, xpIds={};
  const context={
    console, Math, JSON, isFinite, encodeURIComponent, localStorage:storage,
    document:{body,createElement:element,getElementById:id=>nodes.get(id)||null},
    history:{pushState(){},back(){}},
    addEventListener(type,fn){listeners[type]=fn;}, removeEventListener(){},
    allW:[{en:'apple'},{en:'banana'}],
    HansenSpellbeeGems:{prepare(en,idx){order.push('prepare');return {en,idx};},begin(){order.push('begin');return{ok:true,needsMark:true,committed:false};},commit(){order.push('commit');return{ok:true};}},
    markAnswer(idx,ok){order.push('mark');assert.equal(idx,0);assert.equal(ok,true);},
    HansenCoins:{award(id,n){if(coinIds[id]===undefined){coinIds[id]=n;awards.push(['coin',n]);}return coinIds[id]===n;}},
    HansenRewardEffectsV942:{xpAward(id,n){if(xpIds[id]===undefined){xpIds[id]=n;awards.push(['xp',n]);}return xpIds[id]===n;}}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(parentSource,context,{filename:'hansen_spellbee.js'});
  context.HansenSpellBee.open('food');
  return {context,listeners,sourceWindow,order,awards,storage,acks};
}
const p=makeParent();
const masteryPending={schema:1,rewardId:'sb:2026-7-14:10',day:'2026-7-14',coins:0,xp:0,kind:'mastery',word:'apple',index:0,createdAt:1};
p.storage.setItem('hansen_sb_reward_pending_v942',JSON.stringify({[masteryPending.rewardId]:masteryPending}));
p.listeners.message({source:{},data:{type:'hsn_sb_mastery',rewardId:masteryPending.rewardId,coins:0,xp:0,kind:'mastery',word:'apple',index:0,createdAt:1}});
assert.equal(p.awards.length,0,'伪造 source 必须被拒绝');
p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_mastery',rewardId:masteryPending.rewardId,coins:0,xp:0,kind:'mastery',word:'apple',index:0,createdAt:1}});
assert.deepEqual(p.order,['ack']);
const badSlot={schema:1,rewardId:'sb:2026-7-14:11',day:'2026-7-14',coins:0,xp:0,kind:'mastery',word:'banana',index:0,createdAt:2};
p.storage.setItem('hansen_sb_reward_pending_v942',JSON.stringify({[badSlot.rewardId]:badSlot}));
p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_mastery',rewardId:badSlot.rewardId,coins:0,xp:0,kind:'mastery',word:'banana',index:0,createdAt:2}});
assert.deepEqual(p.order,['ack'],'词位/文本不匹配必须被拒绝');
p.storage.setItem('hansen_sb_reward_pending_v942',JSON.stringify({'sb:2026-7-14:1':{schema:1,rewardId:'sb:2026-7-14:1',day:'2026-7-14',coins:20,xp:6,kind:'word',createdAt:3}}));
p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_reward',rewardId:'sb:2026-7-14:1',coins:20,xp:6,kind:'word',createdAt:3}});
assert.deepEqual(p.awards,[['coin',20],['xp',6]]);
for(const bad of [
  {coins:21,xp:0},{coins:0,xp:0},{coins:1.5,xp:0},{coins:1,xp:7},{coins:1,xp:-1},{coins:'oops',xp:0}
]) p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_reward',rewardId:'sb:2026-7-14:1',kind:'word',createdAt:3,...bad}});
assert.deepEqual(p.awards,[['coin',20],['xp',6]],'超界/非整数 payload 必须整笔拒绝');
p.storage.setItem('hansen_sb_reward_pending_v942',JSON.stringify({'sb:2026-7-14:2':{schema:1,rewardId:'sb:2026-7-14:2',day:'2026-7-14',coins:1,xp:0,kind:'match',createdAt:4}}));
p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_reward',rewardId:'sb:2026-7-14:2',coins:1,xp:0,kind:'match',createdAt:4}});
assert.deepEqual(p.awards.at(-1),['coin',1]);
p.context.HansenSpellBee.close();
p.listeners.message({source:p.sourceWindow,data:{type:'hsn_sb_reward',rewardId:'sb:2026-7-14:2',coins:1,xp:0,kind:'match',createdAt:4}});
assert.equal(p.awards.filter(x=>x[0]==='coin').length,2,'关闭后的旧 iframe 不得继续发奖');

assert.match(beeHtml,/hsn_sb_mastery[^\n]+index:/);
assert.match(beeHtml,/sbQueueCappedReward\(Math\.round\(10\*sbOppCoef\(\)\),0,'match'\)/);
console.log('✅ v941 Bee：专属日账硬封顶、canonical去重/新词快照、source与payload安全边界全部通过');
