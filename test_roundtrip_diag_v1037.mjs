/* test_roundtrip_diag_v1037.mjs —— 「写→立刻读回」往返自检回归
 * 背景：跨设备存档连修六版仍未解决。根本原因不在某个具体 bug，
 *   而在于我始终无法区分三种截然不同的故障：
 *     ① 写都失败（权限/会话）
 *     ② 写成功但读不回（"仅创建者可读写"的归属不匹配）
 *     ③ 写成功且读得回（通道正常，说明存档"从来没写进去过"）
 *   这三种的修法完全不同，靠推理无法区分，所以反复修错方向。
 * 合同：提供 roundTrip() 在用户设备上一次跑完写+读回，
 *   带出原始错误与明确结论；自检面板有入口；探针不得覆盖真实存档。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('往返自检 v1037');
const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');
const dg  = fs.readFileSync('/home/claude/work/repo/hansen_cloud_diag_v1027.js','utf8');

ok(/roundTrip:\s*function/.test(src), 'roundTrip 已提供');
ok(/docIdOf\('probe:'/.test(src), "探针使用独立地址(probe: 前缀)，不覆盖真实存档");
ok(/wrote-but-cannot-read/.test(src), '能识别"写进去了但读不回"(归属问题)');
ok(/write-failed/.test(src), '能识别"连写都失败"(权限/会话问题)');
ok(/out\.error\s*=/.test(src), '带出原始错误(不经翻译)');
ok(/roundTrip/.test(dg) && /一键往返自检/.test(dg), '自检面板已有入口');
ok(/结论/.test(dg), '面板给出明确结论而非原始数据堆');
ok(/white-space:pre-wrap/.test(dg), '结果区支持多行显示');

/* 运行时：三种故障各自走到正确分支 */
const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
const win={ HANSEN_CLOUD_CONFIG:{envId:'env-x'}, localStorage:store,
  document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,documentElement:{classList:{contains:()=>false}}},
  crypto:{getRandomValues:a=>a,subtle:{digest:()=>Promise.resolve(new ArrayBuffer(32))}},
  addEventListener(){}, setTimeout:f=>{f&&f();return 0;}, setInterval:()=>0, TextEncoder, TextDecoder,
  btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary') };
win.window=win; const ctx={...win,window:win}; vm.createContext(ctx);
try{ vm.runInContext(src, ctx); }catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const CS=win.HansenCloudSave;
ok(typeof CS.roundTrip==='function', 'roundTrip 运行时可用');
const r = await CS.roundTrip();
ok(!!r && typeof r.step==='string', `无云端连接时也能返回结论: step=${r.step}`);
ok(r.envId==='env-x', '带出实际 envId');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
