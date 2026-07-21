import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failOnce=null;this.failGetOnce=null;this.failGetKey=null;this.resetTrace();}
  get length(){return Object.keys(this.d).length;}
  key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){k=String(k);this.reads.push(k);if(this.failGetKey===k||this.failGetOnce===k){if(this.failGetOnce===k)this.failGetOnce=null;throw new Error('SecurityError');}return Object.hasOwn(this.d,k)?this.d[k]:null;}
  setItem(k,v){k=String(k);this.writes.push(k);if(this.failOnce===k){this.failOnce=null;throw new Error('QuotaExceededError');}this.d[k]=String(v);}
  removeItem(k){k=String(k);this.removes.push(k);delete this.d[k];}
  resetTrace(){this.reads=[];this.writes=[];this.removes=[];}
}
class FixedDate extends Date{
  // Check-in uses local calendar dates; the fixture must not roll into the
  // next day merely because the test host is east of UTC.
  constructor(...a){super(...(a.length?a:['2026-07-14T12:00:00']));}
  static now(){return new FixedDate().getTime();}
}
const day='2026-7-14',receiptKey='hansen_checkin_receipt_v942:'+day;
function make(storage,randomWord=0x80000000){
  const listeners={};
  const document={readyState:'loading',addEventListener(t,f){(listeners[t]??=[]).push(f);},getElementById(){return null;},createElement(){return {style:{},classList:{add(){}}};},head:{appendChild(){}},body:{appendChild(){}}};
  let randomCalls=0;
  const c={console,localStorage:storage,document,Date:FixedDate,JSON,Math,Number,isFinite,crypto:{getRandomValues(a){randomCalls++;a[0]=randomWord>>>0;return a;}},setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},clearInterval(){},
    S:{totalXP:100,charXP:0,chestDay:'',streak:1,stats:{chestClaimed:2}},__hsnSaveKey:'wordIslandAnimal',__hsnSaveNow(){return true;},updateTopBar(){}};
  Object.defineProperty(c,'__rarityRandomCalls',{get(){return randomCalls;}});
  c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_checkin_global.js',import.meta.url),'utf8'),c);
  return c;
}

// 正常领取：coin/XP/当天防刷锁/本岛状态使用同一持久 receipt，重复调用不重发。
const s1=new Storage(),c1=make(s1);let coins=0;const coinLedger={};
c1.HansenCoins={award(id,n){if(!coinLedger[id]){coinLedger[id]=n;coins+=n;}return true;}};
let r=c1.HansenCheckin.claimReward({coin:20,xp:30,tag:'great'});
assert.deepEqual(JSON.parse(JSON.stringify(r)),{ok:true,day,txid:'checkin:'+day,coin:20,xp:30,tag:'great',rarityRoll:0.5});assert.equal(c1.__rarityRandomCalls,1);
assert.equal(coins,20);assert.equal(s1.getItem('hansen_wallet_charxp'),'30');assert.equal(s1.getItem('hansen_checkin_last'),day);
assert.equal(c1.S.totalXP,130);assert.equal(c1.S.stats.chestClaimed,3);assert.equal(c1.S.chestDay,day);
const stable=c1.HansenCheckin.getReceipt();assert.deepEqual(JSON.parse(JSON.stringify(stable)),JSON.parse(JSON.stringify(r)));
r=c1.HansenCheckin.claimReward({coin:999,xp:999,tag:'critical'});
assert.equal(r.ok,false);assert.equal(r.already,true);assert.deepEqual(JSON.parse(JSON.stringify(r.receipt)),JSON.parse(JSON.stringify(stable)));
assert.equal(coins,20);assert.equal(s1.getItem('hansen_wallet_charxp'),'30');
assert.equal(c1.__rarityRandomCalls,1,'重复领取不得重抽 rarityRoll');

// XP 首写失败：金币 source 已提交也不会重发；重试必须复用第一次抽出的 11/22，不能采纳第二次的 999/999。
const s2=new Storage(),c2=make(s2,0x40000000);let coin2=0;const ledger2={};
c2.HansenCoins={award(id,n){if(!ledger2[id]){ledger2[id]=n;coin2+=n;}return true;}};
s2.failOnce='hansen_wallet_charxp';r=c2.HansenCheckin.claimReward({coin:11,xp:22,tag:'normal'});
assert.equal(r.ok,false);assert.equal(coin2,11);assert.equal(s2.getItem('hansen_checkin_last'),null);assert.equal(JSON.parse(s2.getItem(receiptKey)).coin,11);
r=c2.HansenCheckin.claimReward({coin:999,xp:999,tag:'critical'});
assert.equal(r.ok,true);assert.equal(r.coin,11);assert.equal(r.xp,22);assert.equal(r.rarityRoll,0.25);assert.equal(c2.__rarityRandomCalls,1);assert.equal(coin2,11);assert.equal(s2.getItem('hansen_wallet_charxp'),'22');

// 两种提交边界：receipt 已提交而 LAST 写失败时，getReceipt 可供外层附加奖恢复；重载后只补 marker。
const s3=new Storage(),c3=make(s3);let coin3=0;const ledger3={};
c3.HansenCoins={award(id,n){if(!ledger3[id]){ledger3[id]=n;coin3+=n;}return true;}};
s3.failOnce='hansen_checkin_last';r=c3.HansenCheckin.claimReward({coin:9,xp:8,tag:'critical'});
assert.equal(r.ok,false);assert.equal(r.pending,true);assert.equal(c3.HansenCheckin.getReceipt().txid,'checkin:'+day);
assert.equal(coin3,9);assert.equal(s3.getItem('hansen_wallet_charxp'),'8');assert.equal(s3.getItem('hansen_checkin_last'),null);
const c3Reload=make(s3,0xffffffff);c3Reload.HansenCoins=c3.HansenCoins;assert.equal(c3Reload.HansenCheckin.recover(),true);
assert.equal(s3.getItem('hansen_checkin_last'),day);assert.equal(coin3,9);assert.equal(s3.getItem('hansen_wallet_charxp'),'8');
assert.equal(c3Reload.HansenCheckin.getReceipt().rarityRoll,0.5);assert.equal(c3Reload.__rarityRandomCalls,0,'重载必须复用已持久 roll，不调用新随机源');

// 同一天两个用户的首次 receipt 使用各自独立随机源，不再全员按日期得到同一稀有度。
{
  const sa=new Storage(),sb=new Storage(),a=make(sa,0x01000000),b=make(sb,0xc0000000),la={},lb={};
  a.HansenCoins={award(id,n){if(!la[id])la[id]=n;return true;}};b.HansenCoins={award(id,n){if(!lb[id])lb[id]=n;return true;}};
  const ra=a.HansenCheckin.claimReward({coin:1,xp:1,tag:'normal'}),rb=b.HansenCheckin.claimReward({coin:1,xp:1,tag:'normal'});
  assert.equal(ra.day,rb.day);assert.notEqual(ra.rarityRoll,rb.rarityRoll);assert.equal(ra.rarityRoll,0x01000000/4294967296);assert.equal(rb.rarityRoll,0.75);
}

// 存在 rarityRoll 字段时必须严格校验；越界值不得被当作旧 receipt fallback。
{
  const sx=new Storage({[receiptKey]:JSON.stringify({schema:1,day,txid:'checkin:'+day,coin:1,xp:1,tag:'normal',rarityRoll:1,committed:true})}),x=make(sx,0);
  assert.equal(x.HansenCheckin.getReceipt(),null);
}

// 基础 receipt 的硬边界为 coin<=880、XP<=440；超限候选必须在随机/receipt/余额之前零写拒绝。
{
  const sx=new Storage(),x=make(sx,0),calls=[];x.HansenCoins={award(id,n){calls.push([id,n]);return true;}};sx.resetTrace();
  for(const candidate of [
    {coin:881,xp:1,tag:'normal'},
    {coin:1,xp:441,tag:'normal'},
    {coin:100000,xp:100000,tag:'critical'},
    {coin:'880',xp:440,tag:'critical'}
  ])assert.deepEqual(JSON.parse(JSON.stringify(x.HansenCheckin.claimReward(candidate))),{ok:false,error:'invalid-reward'});
  assert.deepEqual(calls,[]);assert.equal(x.__rarityRandomCalls,0);assert.equal(sx.d[receiptKey],undefined);assert.equal(sx.d.hansen_wallet_charxp,undefined);assert.deepEqual(sx.writes,[]);assert.deepEqual(sx.removes,[]);

  const maxStorage=new Storage(),maxCtx=make(maxStorage,0),maxLedger={};maxCtx.HansenCoins={award(id,n){if(!maxLedger[id])maxLedger[id]=n;return true;}};
  const max=maxCtx.HansenCheckin.claimReward({coin:880,xp:440,tag:'critical'});assert.equal(max.ok,true);assert.equal(max.coin,880);assert.equal(max.xp,440);assert.equal(maxCtx.HansenCheckin.getReceipt().coin,880);assert.equal(maxCtx.HansenCheckin.getReceipt().xp,440);
}

// 已落盘的伪造超限 receipt 不能被 public/recover 接受，也不能被覆盖成“新的一天计划”。
{
  const forgedRaw=JSON.stringify({schema:1,day,txid:'checkin:'+day,coin:100000,xp:100000,tag:'critical',rarityRoll:0,committed:false});
  const sx=new Storage({[receiptKey]:forgedRaw}),x=make(sx,0);let coinCalls=0;x.HansenCoins={award(){coinCalls++;return true;}};sx.resetTrace();
  assert.equal(x.HansenCheckin.getReceipt(),null);assert.equal(x.HansenCheckin.recover(),false);assert.deepEqual(JSON.parse(JSON.stringify(x.HansenCheckin.claimReward({coin:1,xp:1,tag:'normal'}))),{ok:false,error:'invalid-receipt'});
  assert.equal(coinCalls,0);assert.equal(sx.d[receiptKey],forgedRaw);assert.equal(sx.d.hansen_wallet_charxp,undefined);assert.deepEqual(sx.writes,[]);assert.deepEqual(sx.removes,[]);
}

// XP 去重账本损坏或 SecurityError 必须 fail-closed：不覆盖坏账本、不发金币/XP、不创建 receipt。
for(const mode of ['corrupt','read-error']){
  const seed={hansen_charxp_awards_v942:mode==='corrupt'?'{broken':'{}',hansen_wallet_charxp:'44'},sx=new Storage(seed),x=make(sx,0);let coinCalls=0;
  x.HansenCoins={award(){coinCalls++;return true;}};sx.resetTrace();if(mode==='read-error')sx.failGetOnce='hansen_charxp_awards_v942';
  const out=x.HansenCheckin.claimReward({coin:10,xp:10,tag:'normal'});assert.equal(out.ok,false);assert.equal(out.error,'xp-ledger-unavailable');
  assert.equal(coinCalls,0);assert.equal(sx.d.hansen_charxp_awards_v942,seed.hansen_charxp_awards_v942);assert.equal(sx.d.hansen_wallet_charxp,'44');assert.equal(sx.d[receiptKey],undefined);assert.deepEqual(sx.writes,[]);assert.deepEqual(sx.removes,[]);
}

// 伪造/损坏 XP pending 不能把全局人物经验写到任意 target。
const s4=new Storage({hansen_wallet_charxp:'44'}),c4=make(s4);
for(const bad of [
  {id:'checkin:'+day+':xp',amount:-5,before:44,target:39,at:1},
  {id:'checkin:'+day+':xp',amount:441,before:44,target:485,at:1},
  {id:'checkin:'+day+':xp',amount:5,before:44,target:999999,at:1},
  {id:'checkin:'+day+':xp',amount:null,before:44,target:44,at:1},
  {id:'evil:xp',amount:5,before:44,target:49,at:1}
]){
  s4.setItem('hansen_charxp_award_pending_v942',JSON.stringify(bad));assert.equal(c4.HansenCheckin.recover(),false);assert.equal(s4.getItem('hansen_wallet_charxp'),'44');assert.equal(s4.getItem('hansen_charxp_award_pending_v942'),null);
}

// streak/day 是一笔双键事务：第二键失败须回滚；硬崩在两键之间时，重载按 journal 精确续做且不重复 +1。
{
  const streakKey='hansen_checkin_streak',streakDayKey='hansen_checkin_streak_day',streakPendingKey='hansen_checkin_streak_pending_v942';
  for(const failKey of [streakPendingKey,streakKey,streakDayKey]){
    const failedStorage=new Storage({[streakKey]:'7',[streakDayKey]:'2026-7-13'}),failedCtx=make(failedStorage);failedStorage.failOnce=failKey;
    assert.equal(failedCtx.HansenCheckin.touchLogin(),7);assert.equal(failedStorage.getItem(streakKey),'7');assert.equal(failedStorage.getItem(streakDayKey),'2026-7-13');assert.equal(failedStorage.getItem(streakPendingKey),null,'可回滚故障不得遗留分裂双键');
  }
  const sx=new Storage({[streakKey]:'7',[streakDayKey]:'2026-7-13'}),x=make(sx);
  assert.equal(x.HansenCheckin.touchLogin(),8);assert.equal(sx.getItem(streakKey),'8');assert.equal(sx.getItem(streakDayKey),day);assert.equal(sx.getItem(streakPendingKey),null);assert.equal(x.HansenCheckin.touchLogin(),8,'当天重试不得再次推进');

  const plan={schema:1,id:'streak:'+day,day,beforeStreak:'7',beforeDay:'2026-7-13',targetStreak:8,targetDay:day,at:FixedDate.now()};
  const crashed=new Storage({[streakKey]:'8',[streakDayKey]:'2026-7-13',[streakPendingKey]:JSON.stringify(plan)}),reload=make(crashed);
  assert.equal(reload.HansenCheckin.touchLogin(),8);assert.equal(crashed.getItem(streakKey),'8');assert.equal(crashed.getItem(streakDayKey),day);assert.equal(crashed.getItem(streakPendingKey),null);assert.equal(reload.HansenCheckin.touchLogin(),8);
}

// 加载顺序是协议的一部分：checkin 内层先装，addiction 外层才能读取正式 receipt。
const html=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
const cacheVersion=fs.readFileSync(new URL('./VERSION',import.meta.url),'utf8').trim();
const checkinScriptIndex=html.indexOf('hansen_checkin_global.js?v='+cacheVersion);
const addictionScriptIndex=html.indexOf('hansen_addiction.js?v='+cacheVersion);
assert.ok(checkinScriptIndex>=0&&addictionScriptIndex>=0&&checkinScriptIndex<addictionScriptIndex);
assert.match(html,/HansenCheckin\.claimReward\(\{day:today\(\),coin:chosen\.amount,xp:__checkinXP,tag:__huTag\}\)/);
assert.match(html,/__checkinCoinMax=880,__checkinXPMax=440/);

console.log('check-in transaction v942: strict 880\/440 receipt + fail-closed XP ledger + streak journal + rarity retry contract ✅');
