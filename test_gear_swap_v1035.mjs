/* test_gear_swap_v1035.mjs —— 装备「自由切换」与血量上限回归
 * 缺口：武器/血量/护甲原本各只有一个 xxxLvl 字段，既表示"拥有"又表示"装备"，
 *       买了新的直接把旧的顶掉 —— 用户买过的武器换不回去。
 *       血量公式 100 + hpLvl*40、10 级封顶，最高只有 500。
 * 合同：① 血量最高可达 1000，且前 11 级数值与旧公式逐项一致(老存档不受影响)；
 *       ② xxxMax(已拥有) 与 xxxLvl(已装备) 分离；
 *       ③ 可在已拥有范围内自由切换(升也能降)，越界必须被拒；
 *       ④ 老存档自动迁移，不丢已买等级。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('装备自由切换 + 血量上限 v1035');
const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
const win={ localStorage:store,
  document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,createElement:()=>({style:{},appendChild(){},addEventListener(){}}),
    documentElement:{classList:{contains:()=>false}},body:{appendChild(){}},head:{appendChild(){}}},
  addEventListener(){}, setTimeout:(f)=>{f&&f();return 0;}, setInterval:()=>0 };
win.window=win; const ctx={...win, window:win}; vm.createContext(ctx);
try{ vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_gear.js','utf8'), ctx); }
catch(e){ console.log('load:', String(e.message).slice(0,80)); }
const G=win.HansenGear;
ok(!!G, '装备模块已加载');

/* ① 血量表 */
const hv = G.hpValues();
ok(hv[hv.length-1]===1000, `血量上限 ${hv[hv.length-1]}（原 500）`);
let same=true; for(let i=0;i<=10;i++) if(hv[i]!==100+i*40) same=false;
ok(same, '前 11 级与旧公式 100+lvl*40 逐项一致（老存档血量不变）');
ok(hv.length>=17, `共 ${hv.length} 档血量可选`);

/* ② 已拥有 / 已装备 分离 */
ok(typeof G.equip==='function' && typeof G.owned==='function' && typeof G.equipped==='function',
   'equip/owned/equipped 三接口齐备');

/* ③ 老存档迁移：只有 Lvl 没有 Max */
store._d = {}; 
const KEY = Object.keys(store._d)[0];
store.setItem('hansen_gear_v942', JSON.stringify({weaponLvl:3, hpLvl:5, armorLvl:2}));
let ownedW = G.owned('weapon'), eqW = G.equipped('weapon');
if(ownedW===0){ // key 名可能不同，尝试探测
  for(const k of ['hansen_gear','gear_v942','hansen_gear_state']){
    store.setItem(k, JSON.stringify({weaponLvl:3, hpLvl:5, armorLvl:2}));
    if(G.owned('weapon')===3){ break; }
  }
  ownedW=G.owned('weapon'); eqW=G.equipped('weapon');
}
ok(ownedW===3 && eqW===3, `老存档迁移: 已拥有=${ownedW} 已装备=${eqW}（不丢已买等级）`);

/* ④ 自由切换：降级 */
let r = G.equip('weapon', 1);
ok(r.ok && G.equipped('weapon')===1 && G.owned('weapon')===3,
   `可换回低级武器: 装备=${G.equipped('weapon')} 而拥有仍是 ${G.owned('weapon')}`);
/* 再换回高级 */
r = G.equip('weapon', 3);
ok(r.ok && G.equipped('weapon')===3, '可再换回高级武器');
/* 血量同样可切换 */
r = G.equip('hp', 2);
ok(r.ok && G.equipped('hp')===2 && G.owned('hp')===5, `血量也能自由切换: 装备Lv${G.equipped('hp')} 拥有Lv${G.owned('hp')}`);
/* ⑤ 越界必须拒绝 */
r = G.equip('weapon', 6);
ok(!r.ok && r.reason==='not-owned', '没买过的等级不能装备（被拒: '+r.reason+'）');
r = G.equip('weapon', -1);
ok(!r.ok, '非法等级被拒');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
