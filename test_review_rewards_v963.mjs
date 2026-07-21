/* v963 复习奖励系统 — 逻辑回归（Node 模拟环境，无浏览器）
 * 覆盖：纠错+2上限 / 隔天毕业防刷 / 老错词豁免 / 清空+30 / 今日完成+20幂等 / 连击里程碑 */
import fs from 'node:fs';

let fails = 0;
function ok(cond, name){
  if(cond){ console.log('  ✅', name); }
  else { console.log('  ❌', name); fails++; }
}
function ymd(d){ d=d||new Date(); const m=d.getMonth()+1,dd=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd; }
function yest(){ const d=new Date(); d.setDate(d.getDate()-1); return ymd(d); }

/* ---------- 模拟环境 ---------- */
const store = new Map();
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
globalThis.window = globalThis;
globalThis.document = { readyState:'complete', getElementById:()=>null, addEventListener:()=>{} };
globalThis.__hsnSaveKey = 'wordIslandFood';
globalThis.__hsnReviewSlot = idx => 'food:'+idx;
globalThis.__hsnSafeWrongCount = v => { v=Number(v); return (isFinite(v)&&v>0)?Math.floor(v):0; };
globalThis.allW = Array.from({length:30},(_,i)=>({en:'w'+i,cn:'词'+i}));
globalThis.S = { wrongs:{}, srs:{} };
globalThis.innerWidth = 390;
const uiLog = [];
globalThis.floatText = (x,y,t)=>uiLog.push('float:'+t);
globalThis.showToast = t=>uiLog.push('toast:'+t);
globalThis.playCoin = ()=>{};

function mkWallet(){
  const ledger = {}; let bal = 0;
  return {
    ledger, get bal(){ return bal; },
    award(id,n){ if(ledger[id]) return true; ledger[id]=n; bal+=n; return true; },
    hasAward(id){ return Object.prototype.hasOwnProperty.call(ledger,id); },
  };
}
globalThis.HansenCoins = mkWallet();
globalThis.HansenGems  = mkWallet();
/* 🔴迭代3 mock：横幅在Node中no-op；canonical提供全局到期计算所需最小面 */
globalThis.document.querySelector = () => null;
const CAN_STORE = { wrongs:{}, srs:{} };
globalThis.HansenCanonical = {
  TOTAL_WORDS: 952,
  islands: [{id:'food', start:100, words:56},{id:'season', start:712, words:240}],
  currentRef: () => 'wordIslandFood',
  resolve: (ref) => /food/i.test(String(ref)) ? {id:'food'} : null,
  read: () => CAN_STORE,
};

/* 与模板同语义的 markAnswer（错词增减内核） */
globalThis.markAnswer = function(idx, correct){
  const w = __hsnSafeWrongCount(S.wrongs[idx]);
  if(correct){ if(w){ const n=w-1; if(n) S.wrongs[idx]=n; else delete S.wrongs[idx]; } }
  else { S.wrongs[idx] = w+1; }
};

/* ---------- 加载被测模块 ---------- */
eval(fs.readFileSync(new URL('./hansen_review_rewards_v963.js', import.meta.url), 'utf8'));
const M = globalThis.HansenReviewRewardsV963;
ok(!!M && typeof markAnswer === 'function' && markAnswer.__rvrwWrapped, '模块加载并成功包装 markAnswer');
const day = ymd(), C = HansenCoins, G = HansenGems;

/* T1: 历史老错词（无建档）→ 纠错+2，归零毕业+15 豁免生效 */
console.log('T1 老错词毕业豁免');
S.wrongs[5] = 2;
markAnswer(5, true);
ok(C.ledger['rvrw:'+day+':food:5:c1'] === 2, '第1次纠错 +2');
markAnswer(5, true);
ok(C.ledger['rvrw:'+day+':food:5:c2'] === 2, '第2次纠错 +2');
ok(C.ledger['rvrw:'+day+':food:5:grad'] === 15, '老错词当天归零 → 毕业+15（豁免）');

/* T2: 防刷核心 — 当天造错当天清 → 无毕业金 */
console.log('T2 隔天防刷');
markAnswer(7, false);
ok(JSON.parse(store.get('hansen_review_wrong_since_v963'))['food:7'] === day, '新错词建档=今天');
markAnswer(7, true);
ok(C.ledger['rvrw:'+day+':food:7:c1'] === 2, '当天纠错仍有 +2');
ok(!C.hasAward('rvrw:'+day+':food:7:grad'), '当天毕业 ⛔ 不发 +15（防刷成立）');
ok(!JSON.parse(store.get('hansen_review_wrong_since_v963'))['food:7'], '归零后建档撤销');

/* T3: 昨天的错词今天清 → 毕业+15 */
console.log('T3 隔天毕业');
S.wrongs[8] = 1;
{ const m = JSON.parse(store.get('hansen_review_wrong_since_v963')||'{}'); m['food:8']=yest();
  store.set('hansen_review_wrong_since_v963', JSON.stringify(m)); }
markAnswer(8, true);
ok(C.ledger['rvrw:'+day+':food:8:grad'] === 15, '隔天错词归零 → 毕业+15');

/* T4: 纠错每词每天上限 3 次 */
console.log('T4 纠错上限');
S.wrongs[9] = 5;
markAnswer(9,true); markAnswer(9,true); markAnswer(9,true); markAnswer(9,true);
ok(C.hasAward('rvrw:'+day+':food:9:c3') && !C.hasAward('rvrw:'+day+':food:9:c4'.replace('c4','c4')), '前3次各+2');
ok(Object.keys(C.ledger).filter(k=>k.startsWith('rvrw:'+day+':food:9:c')).length === 3, '第4次不再发（3次/词/天封顶）');

/* T5: 当日清空 +30（已毕业 5/7/8 共3词，清掉剩余错词9） */
console.log('T5 清空错题本');
markAnswer(9,true);  // wrong 5→…剩1
ok(S.wrongs[9] === undefined || __hsnSafeWrongCount(S.wrongs[9])===0 ? true : (markAnswer(9,true), true), '清理中');
while(__hsnSafeWrongCount(S.wrongs[9])>0) markAnswer(9,true);
{ const m = JSON.parse(store.get('hansen_review_wrong_since_v963')||'{}'); delete m['food:9'];
  store.set('hansen_review_wrong_since_v963', JSON.stringify(m)); }
// 9是今天建档？不是——历史设置。9无建档→毕业豁免；此时今日毕业词=5,8,9=3词且错题空
ok(C.hasAward('rvrw:'+day+':food:9:grad'), '第3个毕业词入账');
ok(C.ledger['rvrw:'+day+':clearall'] === 30, '毕业≥3 且错题清空 → +30');

/* T6: 完成今日复习 +20 幂等 + 连击里程碑 */
console.log('T6 今日完成与连击');
const balBefore = C.bal;
M.onTodayComplete({reviewed:4, graduated:1, total:4});
ok(C.ledger['rvrw:'+day+':todaydone'] === 20, '完成今日复习 +20');
M.onTodayComplete({reviewed:4, graduated:1, total:4});
ok(C.bal === balBefore + 20, '重复调用不重复发');
ok(JSON.parse(store.get('hansen_review_streak_v963')).count === 1, '连击=1');
{ const s = JSON.parse(store.get('hansen_review_streak_v963')); s.last=yest(); s.count=2;
  store.set('hansen_review_streak_v963', JSON.stringify(s)); }
M._debug.tickStreak();
{ const s = JSON.parse(store.get('hansen_review_streak_v963'));
  ok(s.count === 3, '昨天有记录 → 连击升到3');
  ok(C.ledger['rvrw:streak:'+s.start+':m3'] === 20, '3天里程碑 +20 金币'); }
{ const s = JSON.parse(store.get('hansen_review_streak_v963')); s.last=yest(); s.count=6;
  store.set('hansen_review_streak_v963', JSON.stringify(s)); }
M._debug.tickStreak();
{ const s = JSON.parse(store.get('hansen_review_streak_v963'));
  ok(C.ledger['rvrw:streak:'+s.start+':m7'] === 50, '7天里程碑 +50 金币');
  ok(G.ledger['rvrwg:streak:'+s.start+':m7'] === 5, '7天里程碑 +5 钻石'); }

/* T7: 答错不发钱 */
console.log('T7 答错零奖励');
const b2 = C.bal;
markAnswer(11, false);
ok(C.bal === b2, '答错不产生任何金币');

/* T8: 全局/本岛到期统计（canonical口径·Land别名不重复·格式兼容） */
console.log('T8 全局到期统计');
CAN_STORE.wrongs = { '105':2, '110':1, '111':1, '120':1, '130':3, '800':1, '5':0 };
CAN_STORE.srs = {
  '110': { box:2, due: yest() },            // 到期(昨天)
  '111': { box:0, due: '2000-1-1' },        // 到期(不补零历史格式)
  '120': { box:1, due: '2099-12-31' },      // 未到期
  '130': { box:5, due: '2000-1-1' },        // 已毕业盒 → 不计
};
{
  const info = M._debug.globalDueInfo();
  ok(info.ok === true, '全局统计可用');
  ok(info.globalDue === 4, '全局到期=4 (105无SRS/110昨天/111旧格式/800跨岛)，实际='+info.globalDue);
  ok(info.localDue === 3, '本岛到期=3 (105/110/111在food区间)，实际='+info.localDue);
}

/* T9: 横幅状态机（本岛→今日复习 / 跨岛→总览 / 已清 / 安心） */
console.log('T9 横幅状态机');
{
  const t = ymd();
  ok(M._debug.bannerState({globalDue:4, localDue:3}, {last:'', count:0}) === 'local',  '本岛有到期 → local');
  ok(M._debug.bannerState({globalDue:2, localDue:0}, {last:'', count:0}) === 'cross',  '仅它岛有 → cross');
  ok(M._debug.bannerState({globalDue:0, localDue:0}, {last:t, count:5}) === 'done',    '全清且今日已计连击 → done');
  ok(M._debug.bannerState({globalDue:0, localDue:0}, {last:'', count:0}) === 'calm',   '无到期未打卡 → calm');
  const mLocal = M._debug.bannerModel();
  ok(/本岛 3/.test(mLocal.title) && /全部 4/.test(mLocal.title), '横幅文案含本岛/全部双数字');
}

console.log('');
if(fails){ console.log('❌ 失败', fails, '项'); process.exit(1); }
console.log('🎉 v963 复习奖励逻辑回归 全部通过 (钱包终额:', C.bal, '金币 /', G.bal, '钻石)');
