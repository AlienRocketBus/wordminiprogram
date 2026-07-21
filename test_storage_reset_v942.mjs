import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage {
  constructor(seed={}){this.data=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failKey=null;this.failGet=false;this.failGetKey=null;this.failRemoveKey=null;this.resetTrace();}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){k=String(k);this.reads.push(k);if(this.failGet||this.failGetKey===k)throw new Error('SecurityError');return Object.hasOwn(this.data,k)?this.data[k]:null;}
  setItem(k,v){k=String(k);this.writes.push(k);if(this.failKey===k)throw new Error('QuotaExceededError');this.data[k]=String(v);}
  removeItem(k){k=String(k);this.removes.push(k);if(this.failRemoveKey===k)throw new Error('remove failed');delete this.data[k];}
  resetTrace(){this.reads=[];this.writes=[];this.removes=[];}
}
function functionSource(src,name){
  const start=src.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const open=src.indexOf('{',start);let depth=0,quote='',esc=false,line=false,block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(`unclosed ${name}`);
}

const html=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const baseState=step=>({step,learned:[],wrongs:{},mc:{},stats:{gameCounts:{},modesPlayed:[]},totalXP:0,achievements:[],achPending:[],achNew:[]});
const storage=new Storage(),toasts=[];
const ctx={console,localStorage:storage,S:baseState(1),Date,JSON,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail;}},showToast:m=>toasts.push(m),setTimeout(){},clearTimeout(){}};
ctx.window=ctx;ctx.dispatchEvent=()=>{};vm.createContext(ctx);
vm.runInContext(functionSource(html,'__hsnParseSave'),ctx);
const saveBlock=html.slice(html.indexOf('var __hsnSaveKey='),html.indexOf('/* v938:',html.indexOf('var __hsnSaveKey=')));
vm.runInContext(saveBlock,ctx);
const resetHelpers=html.slice(html.indexOf('function __hsnResetJournalKey'),html.indexOf('function load()',html.indexOf('function __hsnResetJournalKey')));
vm.runInContext(resetHelpers,ctx);

assert.equal(ctx.save(),true);
const firstMain=storage.getItem('⟦⟦ISLE_KEY⟧⟧');
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),firstMain,'首次保存建立同值安全快照');
ctx.S.step=2;assert.equal(ctx.save(),true);
const secondMain=storage.getItem('⟦⟦ISLE_KEY⟧⟧');
assert.equal(JSON.parse(secondMain).step,2);
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),firstMain,'第二次保存后 backup 必须仍是第一次已知良好值');

storage.failKey='⟦⟦ISLE_KEY⟧⟧';ctx.S.step=3;
assert.equal(ctx.save(),false,'主档 quota 失败必须显式返回 false');
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),secondMain);
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),firstMain,'主档失败绝不能破坏旧 backup');
assert.match(toasts.at(-1),/未保存/);

// 主档成功、backup quota 失败属于“不完整保存”：明确返回 false，保留旧安全快照。
storage.failKey='⟦⟦ISLE_KEY⟧⟧_bak';ctx.S.step=4;
assert.equal(ctx.save(),false,'安全快照失败不能伪报完整成功');
assert.equal(JSON.parse(storage.getItem('⟦⟦ISLE_KEY⟧⟧')).step,4);
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),firstMain);
assert.match(ctx.__hsnLastSaveError,/QuotaExceededError/);

// 主档损坏时才从 backup 恢复，并修复主档；健康 backup 不应被 load 覆盖。
storage.failKey=null;storage.setItem('⟦⟦ISLE_KEY⟧⟧','{broken');ctx.S=baseState(0);
vm.runInContext(functionSource(html,'load'),ctx);ctx.load();
assert.equal(ctx.S.step,1);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),firstMain);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),firstMain);

// 合法 JSON 但空对象不是健康主档；必须回退完整 backup。
storage.setItem('⟦⟦ISLE_KEY⟧⟧','{}');ctx.S=baseState(0);ctx.load();assert.equal(ctx.S.step,1);

// 危险属性不得进入 S 原型。
storage.setItem('⟦⟦ISLE_KEY⟧⟧','{"learned":[],"stats":{"gameCounts":{}},"__proto__":{"polluted":true},"step":8}');ctx.S=baseState(0);ctx.load();
assert.equal(ctx.S.step,8);assert.equal(ctx.S.polluted,undefined);assert.equal(Object.getPrototypeOf(ctx.S).polluted,undefined);

// 读取异常进入只读保护，权限恢复前 save 不得用当前空状态覆盖旧档。
const protectedMain=storage.getItem('⟦⟦ISLE_KEY⟧⟧'),protectedBak=storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak');storage.failGet=true;ctx.load();storage.failGet=false;
assert.equal(ctx.__hsnStorageReadOnly,true);ctx.S.step=999;assert.equal(ctx.save(),false);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),protectedMain);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),protectedBak);ctx.__hsnStorageReadOnly=false;

// 单项清除必须同时操作权威账本/钱包。
const cleared=[],ach=[];ctx.S={stats:{gameCounts:{}},learned:[1],wrongs:{1:2},achievements:['w1'],achPending:['w2'],achNew:['w2']};
ctx.HansenCanonical={clearCurrent:f=>{cleared.push([...f]);return true;}};ctx.HansenAch={reset:()=>{ach.push('reset');return true;}};ctx.save=()=>true;delete ctx.__hsnSaveNow;
const partialMsg={textContent:'',style:{}};ctx.document={getElementById(id){return id==='partialResetMsg'?partialMsg:null;}};ctx.renderSettings=()=>{};
vm.runInContext(functionSource(html,'_doResetStat'),ctx);
ctx._doResetStat('learned','已掌握单词');ctx._doResetStat('wrongs','错词列表');ctx._doResetStat('achievements','成就');
assert.deepEqual(cleared,[['learned'],['wrongs']]);assert.deepEqual(ach,['reset']);assert.deepEqual(plain(ctx.S.achievements),[]);assert.deepEqual(plain(ctx.S.achPending),[]);

// 单项重置必须先完整读取“明确相关键”；中途读取失败时权威账本、S、存储都零变更。
const partialSaveKey='⟦⟦ISLE_KEY⟧⟧',canonicalKey='hansen_canonical_progress_v941',otherOriginKey='other_app_private';
const oldPartialMain=JSON.stringify({...baseState(4),learned:[1]}),oldPartialBak=JSON.stringify({...baseState(3),learned:[2]});
storage.setItem(partialSaveKey,oldPartialMain);storage.setItem(partialSaveKey+'_bak',oldPartialBak);
storage.setItem(canonicalKey,'canonical-before');storage.setItem(canonicalKey+'_bak','canonical-bak-before');storage.setItem(otherOriginKey,'other-app-newer');
ctx.S={...baseState(4),learned:[1]};let partialAuthorityCalls=0,partialSaveCalls=0;
ctx.HansenCanonical={STORE_KEY:canonicalKey,allSaveAliases:()=>[partialSaveKey],clearCurrent:()=>{partialAuthorityCalls++;storage.setItem(canonicalKey,'canonical-tx');return true;}};
ctx.__hsnSaveNow=()=>{partialSaveCalls++;return true;};storage.resetTrace();storage.failGetKey=canonicalKey;
assert.equal(ctx._doResetStat('learned','已掌握单词'),false);storage.failGetKey=null;
assert.equal(partialAuthorityCalls,0);assert.equal(partialSaveCalls,0);assert.deepEqual(plain(ctx.S.learned),[1]);
assert.equal(storage.data[partialSaveKey],oldPartialMain);assert.equal(storage.data[canonicalKey],'canonical-before');
assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[]);assert.ok(storage.reads.includes(partialSaveKey));assert.ok(storage.reads.includes(canonicalKey));
assert.ok(!storage.reads.includes(otherOriginKey),'同源其它应用键不得被快照读取');

// 原有失败回滚：权威账本及 save 的确定写入都恢复；无关键既不读取，也不写入/删除。
ctx.S={...baseState(4),learned:[1]};partialAuthorityCalls=0;
ctx.HansenCanonical.clearCurrent=()=>{partialAuthorityCalls++;storage.setItem(canonicalKey,'canonical-tx');storage.setItem(canonicalKey+'_bak','canonical-bak-tx');return true;};
ctx.__hsnSaveNow=()=>{const raw=JSON.stringify(ctx.S);storage.setItem(partialSaveKey,raw);storage.setItem(partialSaveKey+'_bak',oldPartialMain);return false;};storage.resetTrace();
assert.equal(ctx._doResetStat('learned','已掌握单词'),false);assert.equal(partialAuthorityCalls,1);
assert.deepEqual(plain(ctx.S.learned),[1]);assert.equal(storage.data[partialSaveKey],oldPartialMain);assert.equal(storage.data[partialSaveKey+'_bak'],oldPartialBak);
assert.equal(storage.data[canonicalKey],'canonical-before');assert.equal(storage.data[canonicalKey+'_bak'],'canonical-bak-before');
assert.equal(storage.data[otherOriginKey],'other-app-newer');assert.ok(![...storage.reads,...storage.writes,...storage.removes].includes(otherOriginKey));
assert.match(partialMsg.textContent,/未能完整保存/);assert.doesNotMatch(partialMsg.textContent,/✅/);

// CAS 回滚：权威写入之后若另一标签页写入新值，失败回滚不得覆盖并发事实。
const concurrentMain=JSON.stringify({...baseState(88),learned:[88]}),concurrentCanonical='canonical-from-other-tab',concurrentNewKey='other_app_created_during_reset';
storage.setItem(partialSaveKey,oldPartialMain);storage.setItem(partialSaveKey+'_bak',oldPartialBak);storage.setItem(canonicalKey,'canonical-before');ctx.S={...baseState(4),learned:[1]};
ctx.HansenCanonical.clearCurrent=()=>{storage.setItem(canonicalKey,'canonical-tx');return true;};
ctx.__hsnSaveNow=()=>{storage.setItem(partialSaveKey,JSON.stringify(ctx.S));storage.setItem(partialSaveKey,concurrentMain);storage.setItem(canonicalKey,concurrentCanonical);storage.data[concurrentNewKey]='created-by-other-tab';return false;};storage.resetTrace();
assert.equal(ctx._doResetStat('learned','已掌握单词'),false);assert.deepEqual(plain(ctx.S.learned),[1]);
assert.equal(storage.data[partialSaveKey],concurrentMain,'并发主档必须保留');assert.equal(storage.data[canonicalKey],concurrentCanonical,'并发权威账本必须保留');
assert.equal(storage.data[concurrentNewKey],'created-by-other-tab','事务期间新增的同源无关键不得被删除');
assert.equal(storage.data[partialSaveKey+'_bak'],oldPartialBak);assert.equal(storage.data[otherOriginKey],'other-app-newer');assert.ok(![...storage.reads,...storage.writes,...storage.removes].includes(otherOriginKey));assert.ok(![...storage.reads,...storage.writes,...storage.removes].includes(concurrentNewKey));

// 全岛重置：先写 crash journal，再分阶段清双快照/canonical/crystal/地图，全部收口后才刷新。
const oldResetMain=JSON.stringify({...baseState(9),learned:[1],wrongs:{1:1},totalXP:99}),oldResetBak=JSON.stringify({...baseState(8),learned:[2],totalXP:98});
storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),learned:[1],wrongs:{1:1},totalXP:99};
storage.setItem('season_word_mastery','{"alpha":3}');storage.setItem('season_wrong_words','{"beta":true}');storage.setItem('season_boss_perfect','{"1":true}');storage.setItem('land1_prog','7');
let reloads=0,alerts=[];ctx.__hsnSaveKey='⟦⟦ISLE_KEY⟧⟧';ctx.HansenCanonical={snapshot:()=>({old:true}),clearCurrent:f=>{cleared.push([...f]);return true;},restoreSnapshot:()=>true};
ctx.HansenCrystal={snapshotCurrentSlice:()=>({id:'action',map:{}}),clearCurrentSlice:()=>true,restoreSnapshot:()=>true};
ctx.location={pathname:'/island_action.html',reload(){reloads++;}};ctx.showAlertMsg=m=>alerts.push(m);
vm.runInContext(functionSource(html,'_actuallyDoReset'),ctx);

// HF6 当前岛重置必须先恢复奖励事务；recover 失败时零写入、零删除、零 journal。
const actionRoundKey='hansen_boss_round_state_v946_action',animalRoundKey='hansen_boss_round_state_v946_animal',actionCountKey='hansen_boss_round_count_action';
const actionRoundRaw=JSON.stringify({schema:1,version:946,island:'action',mode:'regular',total:20,roundNo:2,completedCount:1,cleared:[2,7],updatedAt:1752753600000,lastReceipt:{id:'round:v946:regular:action:r1',roundNo:1,paidAt:1752750000000}});
const animalRoundRaw=JSON.stringify({schema:1,version:946,island:'animal',mode:'regular',total:20,roundNo:4,completedCount:3,cleared:[5],updatedAt:1752753600000,lastReceipt:{id:'round:v946:regular:animal:r3',roundNo:3,paidAt:1752750000000}});
storage.setItem(actionRoundKey,actionRoundRaw);storage.setItem(animalRoundKey,animalRoundRaw);storage.setItem(actionCountKey,'1');
storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),learned:[1],totalXP:99};
let recoverCalls=0;ctx.HansenRoundReward={recover:()=>{recoverCalls++;return false;}};storage.resetTrace();const blockedMain=storage.getItem('⟦⟦ISLE_KEY⟧⟧'),blockedBak=storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak');storage.resetTrace();
assert.equal(ctx._actuallyDoReset(),false,'奖励 pending 无法恢复时必须阻止当前岛重置');
assert.equal(recoverCalls,1);assert.equal(reloads,0);assert.equal(storage.getItem(actionRoundKey),actionRoundRaw);assert.equal(storage.getItem(animalRoundKey),animalRoundRaw);assert.equal(storage.getItem(actionCountKey),'1');
assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),blockedMain);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),blockedBak);assert.equal(storage.getItem('hansen_reset_pending_v942:⟦⟦ISLE_KEY⟧⟧'),null);
assert.deepEqual(storage.writes,[],'recover 失败后不得写任何玩家状态');assert.deepEqual(storage.removes,[],'recover 失败后不得删任何玩家状态');assert.match(alerts.at(-1),/未完成结算|停止重置/);

// recover 成功后只删当前物理岛的 v946 state；旧 count 继续用于轮号迁移，其它岛完全保留。
ctx.HansenRoundReward.recover=()=>{recoverCalls++;return true;};storage.resetTrace();assert.equal(ctx._actuallyDoReset(),undefined);
assert.equal(reloads,1);assert.equal(storage.getItem(actionRoundKey),null,'当前 action 的 HF6 state 必须随整岛重置清除');assert.ok(storage.removes.includes(actionRoundKey),'HF6 state 必须进入 journal 的 extras 删除阶段');
assert.equal(storage.getItem(actionCountKey),'1','旧完成轮数 count 必须保留，不能被当前岛进度重置误删');assert.equal(storage.getItem(animalRoundKey),animalRoundRaw,'其它岛 HF6 state 必须保留');
assert.equal(storage.getItem('hansen_reset_pending_v942:⟦⟦ISLE_KEY⟧⟧'),null);

// 继续原有星海总岛覆盖；先恢复其旧主/备档并把 reload 计数归零。
ctx.location.pathname='/island_season.html';reloads=0;storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),learned:[1],wrongs:{1:1},totalXP:99};ctx._actuallyDoReset();
assert.equal(reloads,1);assert.deepEqual(cleared.at(-1),['learned','wrongs','mc','srs']);const freshSaved=JSON.parse(storage.getItem('⟦⟦ISLE_KEY⟧⟧'));
assert.deepEqual(plain(freshSaved.learned),[]);assert.deepEqual(plain(freshSaved.wrongs),{});assert.equal(freshSaved.totalXP,99);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),storage.getItem('⟦⟦ISLE_KEY⟧⟧'),'重置成功必须是 fresh 双快照');
assert.equal(storage.getItem('season_word_mastery'),null);assert.equal(storage.getItem('season_wrong_words'),null);assert.equal(storage.getItem('season_boss_perfect'),null);assert.equal(storage.getItem('land1_prog'),'7','星海总岛重置不得误删 Land 子岛进度');
assert.equal(storage.getItem('hansen_reset_pending_v942:⟦⟦ISLE_KEY⟧⟧'),null,'全 phase 完成才删 journal');

// journal 首写失败：还没有事务恢复依据，因此必须一个字节都不改。
storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),totalXP:99};
const journalKey='hansen_reset_pending_v942:⟦⟦ISLE_KEY⟧⟧',beforeJournalReload=reloads;storage.failKey=journalKey;ctx._actuallyDoReset();storage.failKey=null;
assert.equal(reloads,beforeJournalReload);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),oldResetMain);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),oldResetBak);assert.equal(storage.getItem(journalKey),null);

// 模拟崩溃窗口：main 已 fresh、backup 仍旧。journal 在时 load 必须强制读 fresh，恢复后双档收口。
storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),totalXP:99};
storage.failKey='⟦⟦ISLE_KEY⟧⟧_bak';const beforeCrashReload=reloads;ctx._actuallyDoReset();storage.failKey=null;
assert.equal(reloads,beforeCrashReload);assert.ok(storage.getItem(journalKey));assert.deepEqual(JSON.parse(storage.getItem('⟦⟦ISLE_KEY⟧⟧')).learned,[]);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'),oldResetBak);
ctx.S=baseState(0);ctx.load();assert.deepEqual(plain(ctx.S.learned),[],'pending journal 存在时不得从旧 backup 复活');assert.equal(ctx.S.totalXP,99);
assert.equal(ctx.__hsnResumeReset(true),true);assert.equal(reloads,beforeCrashReload+1);assert.equal(storage.getItem(journalKey),null);assert.equal(storage.getItem('⟦⟦ISLE_KEY⟧⟧'),storage.getItem('⟦⟦ISLE_KEY⟧⟧_bak'));

// canonical phase 失败不回滚已提交 phase，保留 journal 到重启后幂等续做；旧学习进度不能闪回。
storage.setItem('⟦⟦ISLE_KEY⟧⟧',oldResetMain);storage.setItem('⟦⟦ISLE_KEY⟧⟧_bak',oldResetBak);ctx.S={...baseState(9),totalXP:99};ctx.HansenCanonical.clearCurrent=()=>false;
const beforeCanonReload=reloads;ctx._actuallyDoReset();assert.equal(reloads,beforeCanonReload);let pending=JSON.parse(storage.getItem(journalKey));assert.equal(pending.mainDone,true);assert.equal(pending.crystalDone,true);assert.equal(pending.canonicalDone,false);
ctx.S=baseState(0);ctx.load();assert.deepEqual(plain(ctx.S.learned),[]);ctx.HansenCanonical.clearCurrent=f=>{cleared.push([...f]);return true;};assert.equal(ctx.__hsnResumeReset(true),true);assert.equal(reloads,beforeCanonReload+1);assert.equal(storage.getItem(journalKey),null);

console.log('storage/reset v942: scoped fail-closed snapshots + CAS rollback + crash journal phases + authoritative reset recovery ✅');
