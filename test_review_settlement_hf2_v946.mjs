#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('template.html','utf8');
const start=html.indexOf('function __hsnReviewDayKey()');
const end=html.indexOf('function renderReviewBrowse()',start);
assert.ok(start>=0&&end>start,'review reward and settlement functions must exist in template');
const source=html.slice(start,end);
assert.doesNotMatch(source,/reviewState\.sessionId|addXP\(10\)/,'review rewards must never use random-session receipts or bare XP writes');
assert.match(source,/currentQ!==question/,'delayed answer transition must be bound to its original question');
assert.match(source,/if\(!q\|\|q\.answered\)return/,'skip must be locked once the current answer is settling');

class MemoryStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}removeItem(k){this.map.delete(String(k));}
}

function harness({failFirst=false,seed={}}={}){
  const node={innerHTML:''},calls=[],toasts=[],storage=new MemoryStorage(seed),timers=[];
  let now=Date.parse('2026-07-17T12:00:00Z'),attempts=0;
  class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context={
    console,Math,Date:TestDate,JSON,Object,window:null,reviewState:null,localStorage:storage,
    location:{pathname:'/island_land2.html'},__hsnSaveKey:'wordIslandLand2',
    S:{stats:{reviewToday:0},wrongs:{}},allW:[{en:'a',cn:'A',emoji:'A'},{en:'b',cn:'B',emoji:'B'}],
    __HSN_MAX_STAT_COUNT:1000000,__hsnSafeStatCount:v=>Number.isInteger(v)&&v>=0?v:0,
    document:{getElementById(){return node;},querySelectorAll(){return[];}},
    HansenCanonical:{slotId(_ref,idx){return `season:${30+idx}`;}},
    HansenRewardEffectsV942:{xpAward(id,n){
      calls.push([id,n]);attempts++;if(failFirst&&attempts===1)return false;
      const ledger=JSON.parse(storage.getItem('hansen_reward_xp_awards_v942')||'{}');
      if(!Object.prototype.hasOwnProperty.call(ledger,id))ledger[id]={amount:n,actual:n,at:TestDate.now()};
      storage.setItem('hansen_reward_xp_awards_v942',JSON.stringify(ledger));return true;
    }},
    save(){context.saved=(context.saved||0)+1;return true;},
    bumpGameCount(k){context.bumped=(context.bumped||[]).concat(k);},
    showToast(t){toasts.push(t);},bigConfetti(){},showComboToast(){},confetti(){},
    setTimeout(fn){timers.push(fn);return timers.length;}
  };
  context.window=context;context.globalThis=context;
  vm.createContext(context);
  vm.runInContext('let reviewState=null;'+source+
    ';globalThis.__setReviewState=x=>{reviewState=x};globalThis.__getReviewState=()=>reviewState;'+
    'globalThis.__awardCorrect=__hsnAwardReviewCorrect;globalThis.__pruneReview=__hsnPruneReviewXpLedger;globalThis.__setNow=x=>{};',context);
  return {context,node,calls,toasts,storage,timers,setNow(v){now=v;}};
}
const state=(overrides={})=>({correct:0,total:4,rescued:[],modeLabel:'经典复习',currentQ:null,settling:false,settled:false,settlementPlan:null,...overrides});
const ledgerOf=h=>JSON.parse(h.storage.getItem('hansen_reward_xp_awards_v942')||'{}');

// 全跳过/零正确：零奖励、零宠物/任务副作用，并给出明确文案。
let h=harness();h.context.__setReviewState(state());h.context.reviewComplete();
assert.deepEqual(h.calls,[]);assert.equal(h.context.S.stats.reviewToday,0);assert.equal(h.context.bumped,undefined);
assert.match(h.node.innerHTML,/暂不发放结算奖励/);

// 只把 wrong 从 2 降到 1（有独立答对但未归零）不能领取毕业奖励。
h=harness();h.context.__setReviewState(state({correct:1,rescued:[]}));h.context.reviewComplete();
assert.deepEqual(h.calls,[]);assert.deepEqual(h.context.bumped,['review']);assert.match(h.node.innerHTML,/还没有单词真正归零/);

// 真正归零：按 day + canonical slot 支付一次 20 XP + 10 宠物经验。
h=harness();h.context.__setReviewState(state({correct:2,rescued:[0]}));h.context.reviewComplete();
assert.deepEqual(h.calls,[['review:2026-07-17:season:30:graduate',30]]);
assert.equal(h.context.S.stats.reviewToday,1);assert.match(h.node.innerHTML,/\+20 XP/);assert.match(h.node.innerHTML,/宠物 \+10/);

// 同日故意再次造错并归零：稳定收据已存在，不二次调用奖励引擎；跨日才有新收据。
h.context.__setReviewState(state({correct:1,rescued:[0]}));h.context.reviewComplete();
assert.equal(h.calls.length,1);assert.match(h.node.innerHTML,/今天的毕业奖励已经领过/);
h.setNow(Date.parse('2026-07-18T12:00:00Z'));h.context.__setReviewState(state({correct:1,rescued:[0]}));h.context.reviewComplete();
assert.equal(h.calls.at(-1)[0],'review:2026-07-18:season:30:graduate');

// 每词每日即时纠错 XP 只允许前三次，第4次不再调用奖励引擎。
h=harness();for(let i=0;i<4;i++)assert.equal(h.context.__awardCorrect(0).ok,true);
assert.deepEqual(h.calls.map(x=>x[0]),[
  'review:2026-07-17:season:30:correct:1','review:2026-07-17:season:30:correct:2','review:2026-07-17:season:30:correct:3'
]);

// 写账失败后保持同一收据可重试；成功过的分项不会重复。
h=harness({failFirst:true});h.context.__setReviewState(state({correct:1,rescued:[0]}));h.context.reviewComplete();
assert.equal(h.context.S.stats.reviewToday,0);assert.equal(h.context.__getReviewState().settling,false);assert.match(h.node.innerHTML,/重新尝试安全结算/);
h.context.reviewComplete();assert.deepEqual(h.calls.map(x=>x[0]),['review:2026-07-17:season:30:graduate','review:2026-07-17:season:30:graduate']);assert.equal(h.context.S.stats.reviewToday,1);

// 账本只裁剪 review 命名空间，保留当前 pending 与非 review 永久收据，总 review 项不超过 4096。
const recent=Date.parse('2026-07-17T11:00:00Z'),huge={'quest:forever':{amount:1,actual:1,at:1}};for(let i=0;i<5000;i++)huge[`review:2026-07-17:season:${i}:correct:1`]={amount:10,actual:10,at:recent+i};
const pending='review:2026-07-17:season:0:correct:1';h=harness({seed:{hansen_reward_xp_awards_v942:JSON.stringify(huge),hansen_reward_xp_pending_v942:JSON.stringify({id:pending})}});
assert.equal(h.context.__pruneReview(),true);const compact=ledgerOf(h),reviewKeys=Object.keys(compact).filter(k=>k.startsWith('review:'));
assert(reviewKeys.length<=4096);assert.ok(compact[pending]);assert.ok(compact['quest:forever']);

console.log('review settlement HF2 v946: net rescue rewards + daily canonical receipts + 3× instant cap + bounded ledger + retry/skip locks ✅');
