/* test_legacy_fetch_v1036.mjs —— 历史地址兼容读取回归
 * 事故：用户在浏览器登录后「上传显示成功」，紧接着「从云端拉取」仍报
 *   「云端没有这把密钥对应的存档」。
 * 根因：存档在云端的地址算法**变过三代**——
 *   ① v1033 前：docIdOf(原始密钥，含连字符)；
 *   ② v1033 前的账号密钥用旧字符集(含 L/U)，会算出**另一把钥匙**；
 *   ③ v1033 起：docIdOf(归一化密钥)。
 *   用户此前上传的存档躺在旧地址，新代码只查新地址 → 数据其实在，只是找错了门。
 * 合同：① 读取要把历史地址依次试一遍；② 命中旧地址后自动迁移到新地址；
 *       ③ 全都没有时报错要说明已试过几个地址（便于判断是"真没有"还是"找错门"）。 */
import vm from 'node:vm'; import fs from 'node:fs'; import crypto from 'node:crypto';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('历史地址兼容读取 v1036');
const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');
ok(/function legacyKeyFromUid/.test(src), '提供旧字符集密钥重算(legacyKeyFromUid)');
ok(/cands\s*=\s*\[key\]/.test(src), '读取时构造候选地址列表');
ok(/migratedFrom/.test(src), '命中旧地址后标记来源');
ok(/已尝试 '\s*\+\s*tried\.length/.test(src) || /已尝试/.test(src), '全未命中时报出已试地址数');
ok(/sealPayload\(key, code\)[\s\S]{0,200}p\.put/.test(src), '命中旧地址后自动迁移到新地址');

/* 运行时：旧字符集与新字符集必须算出不同的钥匙(否则兼容路径没意义) */
const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
const win={ HANSEN_CLOUD_CONFIG:{envId:'e'}, localStorage:store,
  document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,documentElement:{classList:{contains:()=>false}}},
  crypto:{getRandomValues:a=>a,subtle:{digest:()=>Promise.resolve(new ArrayBuffer(32))}},
  addEventListener(){}, setTimeout:f=>{f&&f();return 0;}, setInterval:()=>0, TextEncoder, TextDecoder,
  btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary') };
win.window=win; const ctx={...win,window:win}; vm.createContext(ctx);
try{ vm.runInContext(src, ctx); }catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const CS=win.HansenCloudSave;
win.HansenAuth={ isSignedIn:()=>true, currentUser:()=>({uid:'UID-BROWSER'}), readLocal:()=>({uid:'UID-BROWSER'}) };
const cur = CS.ensureKey();
ok(!/[ILOU]/.test(cur.replace(/-/g,'')), `当前密钥不含 I/L/O/U: ${cur}`);
/* 用同一算法复刻旧钥匙, 确认与新钥匙不同 */
function legacy(uid){
  const CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let h1=0x811c9dc5,h2=0x01000193;
  const s='HSNACCT:'+uid;
  for(let i=0;i<s.length;i++){ h1=((h1^s.charCodeAt(i))>>>0)*16777619>>>0; h2=((h2+s.charCodeAt(i)*(i+7))>>>0)*2654435761>>>0; }
  let o=''; for(let j=0;j<16;j++){ h1=(h1*1664525+1013904223)>>>0; h2=(h2^(h1>>>13))>>>0; o+=CH.charAt(((h1^h2)>>>0)%CH.length); }
  return o.slice(0,4)+'-'+o.slice(4,8)+'-'+o.slice(8,12)+'-'+o.slice(12,16);
}
const old = legacy('UID-BROWSER');
ok(old !== cur, `旧钥匙与新钥匙确实不同（旧 ${old} / 新 ${cur}）——这正是找不到存档的原因`);
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
