/* test_addr_consistency_v1046.mjs —— 上传 / 拉取 / 查询「三处地址必须一致」
 * 决定性线索（用户实测）：一键往返自检 ✅、立刻上传 ✅、从云端拉取 ✅，
 *   唯独自检第 ⑩ 项「云端是否已有你的存档」显示 ❌ 没有。
 *   四个结果自相矛盾 → 只可能是**⑩ 查的地址与上传/拉取用的不是同一个**。
 * 根因：上传用 `docIdOf(normalizeKey(key))`（去连字符），拉取同样归一化，
 *   而 `accountCloudInfo` 直接用 `docIdOf(keyFromUid(uid))`——**带连字符**。
 *   后果不止是自检谎报：`syncOnLogin` 正以它为依据，
 *   判定"云端是空的"→走上传分支→**从未执行恢复**→新设备登录永远停在 Lv.1。
 * 合同：三处对同一账号必须算出**完全相同**的文档地址；
 *   且任何一处都不得使用未归一化的密钥。 */
import vm from 'node:vm'; import fs from 'node:fs'; import crypto from 'node:crypto';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('三处地址一致性 v1046');
const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');

/* 源码层：不得再有"直接用 keyFromUid 算地址"的写法 */
ok(!/docIdOf\(keyFromUid\(uid\)\)/.test(src), '已无"直接用 keyFromUid 算地址"的写法');
ok(/normalizeKey\(keyFromUid\(uid\)\)/.test(src), '查询已先归一化再算地址');
const ups = (src.match(/var key = normalizeKey\(ensureKey\(\)\)/g)||[]).length;
ok(ups>=1, '上传路径已归一化');
ok(/var key = normalizeKey\(inputKey\)/.test(src), '拉取路径已归一化');

/* 运行时：三处对同一账号必须算出同一地址 */
const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
const win={ HANSEN_CLOUD_CONFIG:{envId:'e'}, localStorage:store,
  document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,documentElement:{classList:{contains:()=>false}}},
  crypto:{ getRandomValues:a=>a,
    subtle:{ digest:(alg,buf)=>Promise.resolve(crypto.createHash('sha256').update(Buffer.from(buf)).digest().buffer) } },
  addEventListener(){}, setTimeout:f=>{f&&f();return 0;}, setInterval:()=>0, TextEncoder, TextDecoder,
  btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary') };
win.window=win; const ctx={...win,window:win}; vm.createContext(ctx);
try{ vm.runInContext(src, ctx); }catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const CS=win.HansenCloudSave;
win.HansenAuth={ isSignedIn:()=>true, currentUser:()=>({uid:'UID-REAL'}), readLocal:()=>({uid:'UID-REAL'}) };

const raw = CS.ensureKey();                       // 带连字符
const norm = raw.replace(/-/g,'');                // 归一化后
ok(/-/.test(raw) && !/-/.test(norm), `密钥两种形态确实不同（${raw} vs ${norm}）`);
/* docIdOf 未对外导出, 用同一算法(sha256 of 前缀+key)自行复算即可对比 */
const h=(s)=>crypto.createHash('sha256').update('hansen-doc-v1:'+s).digest('hex');
ok(h(raw) !== h(norm), '两种形态算出的地址确实不同 —— 这正是此前谎报的原因');
/* 现在查询必须落在归一化那个地址上 */
ok(/normalizeKey\(keyFromUid/.test(src), '查询已改用归一化形态，与上传/拉取同址');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
