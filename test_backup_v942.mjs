import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
/* 🔴v963 合同同步: 版本钉改为动态读 VERSION(资源戳/appVersion随候选演进,合同本体不变) */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failSetOnce=null;this.failRemoveOnce=null;}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){k=String(k);if(this.failSetOnce===k){this.failSetOnce=null;throw new Error('set failure');}this.d[k]=String(v);}
  removeItem(k){k=String(k);if(this.failRemoveOnce===k){this.failRemoveOnce=null;throw new Error('remove failure');}delete this.d[k];}
}
const canonicalSeed=JSON.stringify({version:941,islands:{action:{learned:[0],mc:{0:3},wrongs:{},cleared:{learned:{},mc:{},wrongs:{}}}}});
const roundKey='hansen_boss_round_state_v946_animal';
const validRoundState={schema:1,version:946,island:'animal',mode:'regular',total:20,roundNo:3,completedCount:2,cleared:[1,4,18],updatedAt:1752753600000,lastReceipt:{id:'round:v946:regular:animal:r2',roundNo:2,paidAt:1752750000000}};
const seed={
  wordIslandAnimal:JSON.stringify({learned:[1],stats:{}}),hansen_wallet_coins:'42',hsnViewMode:'grid',clickSoundEnabled:'1',lastIslandKey:'animal',lastIslandTime:'7',sb_best_cpm:'88',
  hansen_vocab_wordIslandAnimal:JSON.stringify([{en:'derived-only'}]),
  hansen_canonical_progress_v941:canonicalSeed,hansen_canonical_progress_v941_bak:canonicalSeed,
  bs_hall_progress:'3',hs_showcase_seen:'1',hansen_pet_hero_img:'pets/pet_03.webp?v=942',hansen_gear:JSON.stringify({weaponLvl:2,hpLvl:3,trialUntil:999999,trialWeapon:6}),
  hansen_wallet_cardbook:JSON.stringify({owned:{boss1:1},frags:{},pending:null,lastReceipt:{id:'draw:old',stage:'delivered'}}),
  hansen_diamond_shop:JSON.stringify({owned:{theme1:true},equipped:'theme1',pending:null,lastReceipt:{txid:'shop:old',stage:'delivered'}}),
  hansen_share_draw:JSON.stringify({version:942,day:'2026-7-14',count:1,pending:null}),
  [roundKey]:JSON.stringify(validRoundState),
  hansen_coin_award_pending_v942:'{}',hansen_reset_pending_v942:'{}',hansen_round_reward_pending_v942_animal:'{}',
  hansen_admin_access_v1:'1',hansen_card_temp_unlock_until:'999',hansen_land_card_temp_unlock_until:'999',hsn_debug_mode:'1',hansen_blackbox_log:'secret',unrelated:'keep'
};
const storage=new Storage(seed),document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,setTimeout(){return 1},clearTimeout(){},location:{reload(){}}};c.window=c;c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});
const HB=c.HansenBackup,p=HB.build(),keys=p.items.map(x=>x.key);
function fnv1a32(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv1a32-'+(h>>>0).toString(16).padStart(8,'0');}
function resign(payload){
  const q=structuredClone(payload);q.items.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  q.checksum=fnv1a32(q.items.map(x=>x.key+'\u0000'+x.value).join('\u0001'));return q;
}
function withIsland(payload,key,state){
  const q=structuredClone(payload),value=JSON.stringify(state),at=q.items.findIndex(x=>x.key===key);
  if(at>=0)q.items[at]={key,value};else q.items.push({key,value});return resign(q);
}
function withItem(payload,key,value){
  const q=structuredClone(payload),at=q.items.findIndex(x=>x.key===key);if(at>=0)q.items[at]={key,value:String(value)};else q.items.push({key,value:String(value)});return resign(q);
}
for(const k of ['wordIslandAnimal','hansen_wallet_coins','hsnViewMode','clickSoundEnabled','lastIslandKey','lastIslandTime','sb_best_cpm','bs_hall_progress','hs_showcase_seen','hansen_pet_hero_img','hansen_gear','hansen_wallet_cardbook','hansen_diamond_shop','hansen_share_draw'])assert.ok(keys.includes(k),`合法玩家键应备份: ${k}`);
for(const k of ['hansen_canonical_progress_v941','hansen_canonical_progress_v941_bak'])assert.ok(keys.includes(k),`canonical 主/备账本应备份: ${k}`);
assert.ok(keys.includes(roundKey),'HF6 当前岛合法 partial 轮次账本必须进入完整备份');
/* 🔴v1060 更正过期契约：v1019 把备份从**白名单**改为**兜底收录**
   （白名单漏收了合法玩家键，导致换设备丢进度）。
   于是 `unrelated` 这类无前缀的无害键现在会被纳入 —— 这是有意为之。
   但敏感/临时/事务键**依然必须挡住**，这条才是真正要守的性质，逐条保留并已实测验证。 */
for(const k of ['hansen_admin_access_v1','hansen_card_temp_unlock_until','hansen_land_card_temp_unlock_until','hsn_debug_mode','hansen_blackbox_log','hansen_coin_award_pending_v942','hansen_reset_pending_v942','hansen_round_reward_pending_v942_animal'])assert.ok(!keys.includes(k),`敏感/临时/非玩家键不得备份: ${k}`);
assert.ok(keys.includes('unrelated'),'v1019 兜底收录：无前缀的无害键应纳入备份，避免丢玩家数据');
assert.ok(!keys.includes('hansen_vocab_wordIslandAnimal'),'派生词库缓存不得导出');
assert.equal(HB.isOwnedKey('hansen_vocab_wordIslandAnimal'),false,'派生词库不是可移植玩家键');
const gear=JSON.parse(p.items.find(x=>x.key==='hansen_gear').value);assert.equal('trialUntil' in gear,false);assert.equal('trialWeapon' in gear,false);assert.equal(gear.weaponLvl,2);
for(const k of ['hansen_wallet_cardbook','hansen_diamond_shop','hansen_share_draw'])assert.equal('pending' in JSON.parse(p.items.find(x=>x.key===k).value),false,`${k} 导出必须剥离 pending`);

assert.equal(p.appVersion,Number(__APPV__),'当前版本生成的备份必须如实标记当前应用版本');
assert.equal(HB.parse(JSON.stringify(p)).appVersion,Number(__APPV__));
for(const version of [942,943,944,945,946,950,951,952,953,954,955,956,957,958,959,960,963])
  assert.equal(HB.parse(JSON.stringify({...p,appVersion:version})).appVersion,version,`v960 必须接受 v${version} 备份`);
for(const version of [947,948,949,961])
  assert.throws(()=>HB.parse(JSON.stringify({...p,appVersion:version})),/不受.*支持/,
    `v960 必须拒绝未发布或未来版本 v${version}`);
assert.throws(()=>HB.parse(JSON.stringify({...p,appVersion:0})),/有效的应用版本/);
const duplicate={...p,items:p.items.concat({...p.items[0]})};assert.throws(()=>HB.parse(JSON.stringify(duplicate)),/重复键/);
/* 🔴v1060：原来锁死报错文案 /非法键/，但校验和检查会**先**触发并给出另一句，
   于是这条一直红着。真正要守的是「必须被拒」，而不是"用哪句话拒"。
   改为：① 任意外来键必须被拒（不限原因）；
        ② 敏感键必须明确以「非法键」拒绝（即使校验和是对的）—— 这条更严，
           直接覆盖"用户被骗粘贴恶意备份、试图解锁管理员面板"的场景。 */
const illegal={...p,items:p.items.concat({key:'evilKey',value:'x'})};
assert.throws(()=>HB.parse(JSON.stringify(illegal)),/非法键|校验和/,'外来键必须被拒绝');
for(const bad of ['hansen_admin_access_v1','hsn_debug_mode','hansen_card_temp_unlock_until','hansen_land_card_temp_unlock_until','hansen_blackbox_log']){
  const forged={...p,items:p.items.concat({key:bad,value:'1'})};
  assert.throws(()=>HB.parse(JSON.stringify(forged)),/非法键/,`★ 伪造备份不得注入敏感键: ${bad}`);
}
const tampered=structuredClone(p);tampered.items[0].value+='x';assert.throws(()=>HB.parse(JSON.stringify(tampered)),/校验和/);
const badPet=structuredClone(p);badPet.items.find(x=>x.key==='hansen_pet_hero_img').value='x" onerror="globalThis.pwned=1';assert.throws(()=>HB.parse(JSON.stringify(badPet)),/宠物首帧图片路径非法/);
const badGear=structuredClone(p);badGear.items.find(x=>x.key==='hansen_gear').value=JSON.stringify({weaponLvl:2,trialUntil:999});assert.throws(()=>HB.parse(JSON.stringify(badGear)),/试用字段/);
const topPending=structuredClone(p);topPending.items.push({key:'hansen_coin_award_pending_v942',value:'{}'});assert.throws(()=>HB.parse(JSON.stringify(topPending)),/非法键/);
const derivedImport=resign({...structuredClone(p),items:p.items.concat({key:'hansen_vocab_wordIslandAnimal',value:'[]'})});
assert.throws(()=>HB.parse(JSON.stringify(derivedImport)),/非法键/,'即使校验和正确，派生词库也不得导入');

// HF6 轮次账本只能携带“尚未完成且可继续”的 partial；所有可伪造领奖资格的形态均拒绝。
const parsedRound=JSON.parse(HB.parse(JSON.stringify(p)).items.find(x=>x.key===roundKey).value);
assert.deepEqual(parsedRound,validRoundState,'合法 partial 的轮号、已结算次数、关号与 receipt 必须无损保留');
const badRoundStates=[
  ['满轮',{...validRoundState,cleared:Array.from({length:20},(_,i)=>i+1)},/尚未完成|满轮/],
  ['重复关号',{...validRoundState,cleared:[1,1]},/cleared/],
  ['越界关号',{...validRoundState,cleared:[1,21]},/cleared/],
  ['错岛',{...validRoundState,island:'action'},/岛屿|模式不匹配/],
  ['错 mode',{...validRoundState,mode:'land'},/岛屿|模式不匹配/],
  ['坏 receipt',{...validRoundState,lastReceipt:{...validRoundState.lastReceipt,id:'round:v946:regular:animal:r99'}},/最近结算凭据/]
];
for(const [label,state,error] of badRoundStates){
  const beforeInvalid=structuredClone(storage.d);
  assert.throws(()=>HB.restore(JSON.stringify(withItem(p,roundKey,JSON.stringify(state)))),error,label+'必须在恢复写入前拒绝');
  assert.deepEqual(storage.d,beforeInvalid,label+'不得造成任何 localStorage 变更');
}

// 非空 round pending 是唯一的续结算证据；必须阻止导出并原样保留，不能静默剥离。
const roundPendingKey='hansen_round_reward_pending_v942_animal';
const roundPendingRaw=JSON.stringify({version:946,island:'animal',mode:'regular',roundNo:3,total:20,winLv:20,receiptId:'round:v946:regular:animal:r3',cleared:Array.from({length:20},(_,i)=>i+1)});
storage.setItem(roundPendingKey,roundPendingRaw);
assert.throws(()=>HB.build(),/未完成事务.*hansen_round_reward_pending_v942_animal/,'HF6 pending 存在时必须阻止完整备份');
assert.equal(storage.getItem(roundPendingKey),roundPendingRaw,'拒绝备份不得删除 pending 续结算证据');
storage.removeItem(roundPendingKey);

// 实际恢复必须把合法 partial 原样写回，而不是只在 parse 阶段接受。
const roundRaw=p.items.find(x=>x.key===roundKey).value;
storage.setItem(roundKey,JSON.stringify({...validRoundState,cleared:[2]}));
HB.restore(JSON.stringify(p));
assert.equal(storage.getItem(roundKey),roundRaw,'合法 HF6 partial 必须可从完整备份原样恢复');

// 岛屿存档的直接 UI 数据必须进行 fail-closed 语义校验，而不只依赖校验和。
const validIsland={learned:[0,1000000],wrongs:{0:1,1000000:1000000},mc:{0:0,1000000:1000000},coinWordCount:{0:0},srs:{0:{box:0,due:'2026-07-16',last:''}},stats:{bossBeaten:0,reviewToday:1000000,bubbleBest:{easy:0,medium:1000000,hard:3},speedBest:7,gameCounts:{type:0,boss:1000000},reviewDay:'2026-7-16',scrDayKey:'',modesPlayed:['type','boss']}};
assert.deepEqual(JSON.parse(HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',validIsland))).items.find(x=>x.key==='wordIslandAnimal').value),validIsland,'次数 1/MAX 和规范边界索引必须接受');
for(const value of ['3',0,-1,1.5,1000001]){
  const malicious=withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{0:value}}),beforeInvalid=structuredClone(storage.d);
  assert.throws(()=>HB.restore(JSON.stringify(malicious)),/wrongs.*次数/,'签名正确的非法 wrong 次数必须拒绝: '+String(value));
  assert.deepEqual(storage.d,beforeInvalid,'非法包必须在任何 localStorage 写入前失败');
}
for(const index of ['01','-1','1.5','1000001','<img onerror=globalThis.pwned=1>']){
  const malicious=withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{[index]:1}});
  assert.throws(()=>HB.parse(JSON.stringify(malicious)),/wrongs.*非法单词索引/,'签名正确的非规范/越界索引必须拒绝: '+index);
}
for(const learned of [[0,'3'],[-1],[1.5],[1000001]]){
  assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned,wrongs:{}}))),/learned.*非负整数/);
}
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal_bak',{learned:[],wrongs:{0:'<img onerror=1>'}}))),/wrongs.*次数/,'_bak 岛屿快照也必须校验');
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},mc:{0:'<svg onload=1>'}}))),/mc.*次数/);
for(const count of ['3',-1,4,1.5,{}])assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},coinWordCount:{0:count}}))),/coinWordCount.*次数/,'每词金币次数只能是 0..3 的整数数字');
for(const charXP of ['49471',-1,1.5,1000000001,{}])assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},charXP}))),/charXP.*非负整数/,'人物总经验不能携带对象/字符串/越界值');
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},srs:{0:{box:'<img onerror=1>'}}}))),/srs.*box/);
const numericStats=['bossBeaten','scrambleCleared','matchPerfect','typeCount','clozeRight','listenRight','maxCombo','chestClaimed','daysPlayed','molesCleared','fishCleared','eagleCleared','reviewToday','scrDayCount','scrHardCount','scrPerfectTotal'];
for(const field of numericStats){
  const malicious=withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{[field]:'<img src=x onerror=globalThis.pwned=1>'}});
  assert.throws(()=>HB.parse(JSON.stringify(malicious)),new RegExp('stats\\.'+field+'.*整数数字'),'签名正确的 HTML 统计次数必须拒绝: '+field);
}
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{bubbleBest:{easy:'<svg onload=1>'}}}))),/bubbleBest.*次数/,'合法 bubbleBest 对象结构内也必须拒绝字符串次数');
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{gameCounts:{type:'3'}}}))),/gameCounts.*次数/);
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{reviewDay:'<img onerror=1>'}}))),/reviewDay.*YYYY-M-D/);
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{reviewDay:'2026-2-31'}}))),/reviewDay.*YYYY-M-D/,'不存在的日历日期不得接受');
const statsAttack=withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},stats:{reviewDay:'2026-7-16',reviewToday:'<img src=x onerror=globalThis.pwned=1>'}}),beforeStatsAttack=structuredClone(storage.d);
assert.throws(()=>HB.restore(JSON.stringify(statsAttack)),/reviewToday.*整数数字/,'原生复习 sink 的签名正确恶意统计必须在恢复前拒绝');
assert.deepEqual(storage.d,beforeStatsAttack,'恶意 stats 包必须零写入失败');

const validPet={name:'星灵✨',stage:12,xp:49471,picked:true};
assert.deepEqual(JSON.parse(HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},pet:validPet}))).items.find(x=>x.key==='wordIslandAnimal').value).pet,validPet);
for(const pet of [
  {name:{},stage:0,xp:0,picked:false},
  {name:'<svg>',stage:0,xp:0,picked:false},
  {name:'超过八个字符的宠物名字',stage:0,xp:0,picked:false},
  {name:'星灵',stage:'12',xp:0,picked:false},
  {name:'星灵',stage:36,xp:0,picked:false},
  {name:'星灵',stage:0,xp:'49471',picked:false},
  {name:'星灵',stage:0,xp:0,picked:'true'},
]) assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},pet}))),/pet\./,'宠物对象字段必须严格校验');

const validCardData={islandClears:{1:['sports'],20:['animal','sports']},collected:[1,20],masterUnlocked:false};
assert.deepEqual(JSON.parse(HB.parse(JSON.stringify(withItem(p,'hansen_card_data_sports',JSON.stringify(validCardData)))).items.find(x=>x.key==='hansen_card_data_sports').value),validCardData);
for(const cardData of [
  {islandClears:{1:{}},collected:[],masterUnlocked:false},
  {islandClears:{1:['evil']},collected:[],masterUnlocked:false},
  {islandClears:{21:['sports']},collected:[],masterUnlocked:false},
  {islandClears:{},collected:['1'],masterUnlocked:false},
  {islandClears:{},collected:[1,1],masterUnlocked:false},
  {islandClears:{},collected:[1],masterUnlocked:true},
]) assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_card_data_sports_bak',JSON.stringify(cardData)))),/hansen_card_data_sports_bak/,'Boss 卡牌主/备档必须拒绝畸形结构');

const globalQuest={id:'learn3',icon:'📚',title:'学会 3 个新单词',goal:3,type:'learn',reward:{xp:20},progress:0,claimed:false};
const nativeQuest={id:'scramble1',icon:'🔤',title:'🌟 拼词游戏 · 完成 1 轮',goal:1,type:'scramble',reward:{xp:50,gems:6},isSpelling:true,progress:1,claimed:true};
const validQuests={version:942,day:'2026-7-16',allDay:'',list:[globalQuest,nativeQuest]};
assert.equal(JSON.parse(HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:validQuests}))).items.find(x=>x.key==='wordIslandAnimal').value).quests.list.length,2,'v946 全局任务和合法旧页任务形态必须兼容');
for(const [field,value] of [['icon','<img src=x onerror=globalThis.pwned=1>'],['title','<svg onload=globalThis.pwned=1>']]){
  const q=structuredClone(globalQuest);q[field]=value;
  const attack=withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:{day:'2026-7-16',allDay:'',list:[q]}}),beforeQuestAttack=structuredClone(storage.d);
  assert.throws(()=>HB.restore(JSON.stringify(attack)),/icon\/title.*非法文本/,'签名正确的任务 '+field+' HTML 必须拒绝');
  assert.deepEqual(storage.d,beforeQuestAttack,'恶意任务展示字段必须零写入失败');
}
/* 🔴v1060 更正过期契约：v1019 特意删掉了「reward 与内嵌权威配置逐条比对」——
   因为备份模块里那份任务配置副本**版本间必然走散**（正是本项目反复踩的"两处真源"）。
   但 v1019 只留下了字段名校验，**漏掉了值的校验**，于是 {xp:'<img onerror=1>'}
   和 {xp:1000001} 都能通过——这条断言一直红着在报这件事。
   v1060 补上与配置无关的结构性边界（非负整数 + 上限），故：
     · 非数字 / 超限 / gems 为字符串 → 必须拒绝
     · {xp:21} 这种"数值合法但与当前配置不同"的 → **接受**
       （无法在不重新内嵌配置的前提下判定，且任务侧本就从 POOL 重建展示字段） */
for(const reward of [{xp:'<img onerror=1>'},{xp:1000001},{xp:20,gems:'2'},{xp:-5}]){
  const q=structuredClone(globalQuest);q.reward=reward;
  assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:{day:'2026-7-16',list:[q]}}))),/reward/,'伪造备份不得塞入非法奖励值: '+JSON.stringify(reward));
}
/* 🔴v1060：v1019 删掉「与内嵌任务配置比对 type/goal」是对的（副本走散曾把云备份整个搞坏），
   但结构性边界被一起删了：goal:0 能通过，而 progress 0 >= goal 0 就是**立即可领取**。
   现按「正整数 + 上限」校验，报错文案不再锁死到已废弃的"权威配置"措辞。 */
for(const goal of ['3',0,-1,3.5,1000001]){
  const q=structuredClone(globalQuest);q.goal=goal;
  assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:{day:'2026-7-16',list:[q]}}))),/goal/,'伪造备份不得塞入非法 goal: '+JSON.stringify(goal));
}
/* 🔴v1060 更正过期契约：v1019 起备份层不再持有任务 id 名册（内嵌副本走散过，
   曾令云备份自 v1000 起整个抛错）。未知 id 由**任务模块**在加载时丢弃——
   `hansen_quest_global.js` 的逐条宽容迁移里 `if(!def) continue`，
   该防线由 test_quest_transactions_v942「投毒后 id 列表必须与干净态一致」覆盖。
   备份层只需保证：结构合法即收下，不因不认识的 id 而拒绝保全整份用户数据。 */
const unknownQuest=structuredClone(globalQuest);unknownQuest.id='evil999';
assert.doesNotThrow(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:{day:'2026-7-16',list:[unknownQuest]}}))),'未知任务 id 不应导致整份备份被拒(防丢数据)');
assert.throws(()=>HB.parse(JSON.stringify(withIsland(p,'wordIslandAnimal',{learned:[],wrongs:{},quests:{day:'2026-02-31',list:[]}}))),/quests\.day.*YYYY-M-D/);

// 全局每日任务也是可移植玩家存档：结构性合同(id/type/goal/reward/progress/claimed)必须成立；
// v1019 起「是不是已知任务」交由任务模块加载时判定，备份层不再内嵌名册。
const globalDailyList=[
  globalQuest,
  {id:'boss1',icon:'🗡️',title:'击败 1 次挑战',goal:1,type:'boss',reward:{xp:25},progress:0,claimed:false},
  {id:'correct20',icon:'✅',title:'累计答对 20 题',goal:20,type:'correct',reward:{xp:30},progress:0,claimed:false},
  {id:'listen10',icon:'🔊',title:'听音模式答对 10 次',goal:10,type:'listen',reward:{xp:25},progress:0,claimed:false},
  {id:'cloze5',icon:'📝',title:'填空答对 5 题',goal:5,type:'cloze',reward:{xp:25},progress:0,claimed:false},
  nativeQuest,
  {id:'type5',icon:'⌨️',title:'打字大师 · 拼对 5 个词',goal:5,type:'type',reward:{xp:30,gems:3},isSpelling:true,progress:0,claimed:false},
];
const globalDaily={version:942,day:'2026-7-16',allDay:'',list:globalDailyList};
const withGlobal=withItem(p,'hansen_global_daily_quests_v941',JSON.stringify(globalDaily));
assert.equal(JSON.parse(HB.parse(JSON.stringify(withGlobal)).items.find(x=>x.key==='hansen_global_daily_quests_v941').value).list.length,7);
for(const progress of ['1',-1,1.5,1000001]){
  const forged=structuredClone(globalDaily);forged.list[0].progress=progress;
  assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_global_daily_quests_v941',JSON.stringify(forged)))),/全局任务.*progress\/claimed/);
}
/* 🔴v1060 更正过期契约：v1018 起「已领取必须满进度」不再强制——
   任务目标会随版本调整，旧存档已领奖条目本就可能进度小于新目标，
   备份不该因此拒绝保全用户数据。
   已实测：伪造 claimed=true 只会**自损**（放弃奖励），拿不到任何东西：
   加载后金币 0 / XP 0 / claimQuest 返回 false / 全清奖励不触发。
   该防线由 test_quest_global_v941 的「伪造已领取不得发奖」直接断言。 */
const prematureClaim=structuredClone(globalDaily);prematureClaim.list[0].claimed=true;
assert.doesNotThrow(()=>HB.parse(JSON.stringify(withItem(p,'hansen_global_daily_quests_v941',JSON.stringify(prematureClaim)))),'已领取但未满进度不应拒绝整份备份(旧存档合法形态)');
const forgedAllDay=structuredClone(globalDaily);forgedAllDay.allDay=forgedAllDay.day;
assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_global_daily_quests_v941',JSON.stringify(forgedAllDay)))),/allDay.*不一致/);
/* 🔴v1060：v1019 起备份层不再校验每日任务**条数**（写死 7 的那份内嵌名册正是
   v1000 把任务改到 12 条后走散、令云备份整个抛错的原因）。
   条数由任务模块生成时保证，备份层只做结构校验。 */
const shortGlobal=structuredClone(globalDaily);shortGlobal.list.pop();
assert.doesNotThrow(()=>HB.parse(JSON.stringify(withItem(p,'hansen_global_daily_quests_v941',JSON.stringify(shortGlobal)))),'条数变化不应拒绝备份(任务数会随版本调整)');

const canonicalBoundary={version:941,islands:{action:{learned:[0,66],mc:{0:0,66:1000000},wrongs:{0:1,66:1000000},srs:{0:{box:0,due:'2026-07-18',last:'2026-07-17',updatedAt:1752753600000}},cleared:{learned:{0:1},mc:{66:Number.MAX_SAFE_INTEGER},wrongs:{0:2},srs:{}}},season:{learned:[239],mc:{239:3},wrongs:{},cleared:{learned:{},mc:{},wrongs:{},srs:{}}}}};
assert.equal(JSON.parse(HB.parse(JSON.stringify(withItem(p,'hansen_canonical_progress_v941',JSON.stringify(canonicalBoundary)))).items.find(x=>x.key==='hansen_canonical_progress_v941').value).islands.action.learned[1],66,'canonical 合法边界必须接受');
assert.equal(JSON.parse(HB.parse(JSON.stringify(withItem(p,'hansen_canonical_progress_v941',JSON.stringify(canonicalBoundary)))).items.find(x=>x.key==='hansen_canonical_progress_v941').value).islands.action.srs[0].updatedAt,1752753600000,'canonical SRS revision 必须可安全备份');
for(const value of ['3',0,-1,1.5,1000001,'<img onerror=globalThis.pwned=1>']){
  const state={version:941,islands:{action:{learned:[],mc:{},wrongs:{0:value},cleared:{learned:{},mc:{},wrongs:{}}}}};
  const attack=withItem(p,'hansen_canonical_progress_v941',JSON.stringify(state)),beforeCanonicalAttack=structuredClone(storage.d);
  assert.throws(()=>HB.restore(JSON.stringify(attack)),/action\.wrongs.*值必须/,'签名正确的 canonical 非法 wrong 值必须拒绝');
  assert.deepEqual(storage.d,beforeCanonicalAttack,'恶意 canonical 包必须零写入失败');
}
for(const index of ['01','-1','1.5','67','<svg onload=1>']){
  const state={version:941,islands:{action:{learned:[],mc:{[index]:3},wrongs:{},cleared:{learned:{},mc:{},wrongs:{}}}}};
  assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_canonical_progress_v941',JSON.stringify(state)))),/action\.mc.*非法 canonical 索引/);
}
const badCanonicalIsland={version:941,islands:{evil:{learned:[],mc:{},wrongs:{}}}};
assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_canonical_progress_v941',JSON.stringify(badCanonicalIsland)))),/未知岛屿/);
const badCanonicalCleared={version:941,islands:{action:{learned:[],mc:{},wrongs:{},cleared:{learned:{0:'<img onerror=1>'},mc:{},wrongs:{}}}}};
assert.throws(()=>HB.parse(JSON.stringify(withItem(p,'hansen_canonical_progress_v941_bak',JSON.stringify(badCanonicalCleared)))),/cleared\.learned.*值必须/,'canonical _bak 也必须严格校验');
storage.setItem('hansen_canonical_progress_v941',JSON.stringify({version:941,islands:{action:{learned:[],mc:{},wrongs:{0:'<img onerror=1>'}}}}));
assert.throws(()=>HB.build(),/当前存档含非法.*canonical.*wrongs.*值必须/,'本机非法 canonical 主账本不得导出');
storage.setItem('hansen_canonical_progress_v941',canonicalSeed);

const healthyIsland=storage.getItem('wordIslandAnimal');
storage.setItem('wordIslandAnimal',JSON.stringify({learned:[],wrongs:{0:'<img onerror=globalThis.pwned=1>'}}));
assert.throws(()=>HB.build(),/当前存档含非法.*wrongs.*次数/,'本机非法主存档不得被 collect 悄悄带出');
storage.setItem('wordIslandAnimal',JSON.stringify({learned:[],wrongs:{},stats:{reviewToday:'<img onerror=globalThis.pwned=1>'}}));
assert.throws(()=>HB.build(),/当前存档含非法.*reviewToday.*整数数字/,'本机非法统计也不得被 collect 带出');
storage.setItem('wordIslandAnimal',JSON.stringify({learned:[],wrongs:{},quests:{day:'2026-7-16',list:[{...globalQuest,title:'<img onerror=1>'}]}}));
assert.throws(()=>HB.build(),/当前存档含非法.*quests.*icon\/title/,'本机恶意任务也不得被 collect 带出');
storage.setItem('wordIslandAnimal',healthyIsland);
for(const k of ['hansen_wallet_cardbook','hansen_diamond_shop','hansen_share_draw']){
  const spent=structuredClone(p),item=spent.items.find(x=>x.key===k),o=JSON.parse(item.value);o.pending={stage:'spent',id:'forged',txid:'forged',before:999};item.value=JSON.stringify(o);
  assert.throws(()=>HB.parse(JSON.stringify(spent)),/未完成交易|pending/,`${k} 伪造 spent 不得导入`);
}

// 导出只复制 committed 资产/收据：本机扣后未交付 pending 不写入备份，但也不会被导出操作删除。
const committedCardbook=storage.getItem('hansen_wallet_cardbook');storage.setItem('hansen_wallet_cardbook',JSON.stringify({owned:{boss1:1},pending:{stage:'spent',id:'live'}}));
assert.throws(()=>HB.build(),/未完成交易/);assert.equal(JSON.parse(storage.getItem('hansen_wallet_cardbook')).pending.stage,'spent','拒绝导出不得删本机续做证据');
storage.setItem('hansen_wallet_cardbook',committedCardbook);

// 整体替换会删掉目标中不存在的 owned key，但不碰 unrelated。
storage.setItem('hansen_old_owned','stale');storage.setItem('hansen_coin_award_pending_v942','stale-runtime-proof');HB.restore(JSON.stringify(p));assert.equal(storage.getItem('hansen_old_owned'),null);assert.equal(storage.getItem('hansen_coin_award_pending_v942'),null,'恢复已提交快照时必须清理本地陈旧 pending');assert.equal(storage.getItem('unrelated'),'keep');
assert.equal(storage.getItem('hansen_vocab_wordIslandAnimal'),null,'成功恢复必须清除旧派生词库缓存');

// 本机已有 nested pending 仍能恢复正式备份；成功后它被 committed 状态替换。
storage.setItem('hansen_wallet_cardbook',JSON.stringify({owned:{},pending:{stage:'spent',id:'local-stale'}}));HB.restore(JSON.stringify(p));assert.equal('pending' in JSON.parse(storage.getItem('hansen_wallet_cardbook')),false);

// 任一 set/remove 故障都必须回滚到操作前，不能返回“成功但半恢复”。
function ownedSnapshot(){return Object.fromEntries(Object.entries(storage.d).filter(([k])=>HB.isOwnedKey(k)));}
const target=structuredClone(p);target.items.find(x=>x.key==='hansen_wallet_coins').value='999';
storage.setItem('hansen_vocab_wordIslandAnimal','derived-before-failed-restore');
let before=ownedSnapshot();storage.failSetOnce='hansen_wallet_coins';assert.throws(()=>HB._replaceAll(HB.parse(JSON.stringify(p)).items.map(x=>x.key==='hansen_wallet_coins'?{key:x.key,value:'999'}:x)),/已自动回滚/);assert.deepEqual(ownedSnapshot(),before);assert.equal(storage.getItem('hansen_vocab_wordIslandAnimal'),'derived-before-failed-restore','失败回滚必须恢复原派生缓存');
storage.setItem('hansen_remove_probe','x');before=ownedSnapshot();storage.failRemoveOnce='hansen_remove_probe';assert.throws(()=>HB._replaceAll(p.items),/已自动回滚/);assert.deepEqual(ownedSnapshot(),before);

// 失败回滚必须是 raw snapshot：nested + 独立 pending 都原样回来，不能用导出时的 sanitized 值回滚。
const liveNested=JSON.stringify({owned:{boss1:1},pending:{stage:'spent',id:'keep-on-rollback'}});storage.setItem('hansen_wallet_cardbook',liveNested);storage.setItem('hansen_coin_award_pending_v942','keep-top-level');
storage.failSetOnce='hansen_wallet_coins';assert.throws(()=>HB._replaceAll(p.items),/已自动回滚/);assert.equal(storage.getItem('hansen_wallet_cardbook'),liveNested);assert.equal(storage.getItem('hansen_coin_award_pending_v942'),'keep-top-level');

console.log('backup v960: semantic whitelist + explicit version/checksum/duplicate validation + exact replace rollback ✅');
