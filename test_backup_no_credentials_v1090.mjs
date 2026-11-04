const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_backup_no_credentials_v1090.mjs —— 备份绝不能碰云端凭证
 *
 * ═══ 用户真机凭证生死簿抓到的完整现场（确凿证据）═══
 *
 *   1:05:59  🔑 登录成功  凭证已就位              ← SDK 写入新凭证 1340 字节
 *   1:06:04  写入 credentials_ambitious-…  1314 字节
 *            hansen_backup_v944.js:410        ← **是我们自己的备份恢复写的**
 *            applyTarget / replaceAll
 *   1:06:06  ❗删除 credentials_ambitious-…  原有 1314 字节
 *            → HTTP 400 invalid_grant | invalid refresh token.
 *                        for it may be has been refreshed by
 *
 * 链条：备份恢复把一份**旧的**凭证快照盖回 localStorage
 *    → SDK 拿着过期的 refresh_token 去刷新
 *    → 服务端回 invalid_grant
 *    → SDK 拦截器判鉴权失败 → 把整个凭证删掉
 *    → 此后 getLoginState() 永远 null，用户彻底登不上
 *
 * 为什么会被收进备份：v1019 把白名单改成**兜底收录**，
 * 初衷（"所有东西都跟着账号走"）是对的，但没想到 SDK 的凭证
 * 也躺在同一个 localStorage 里。
 *
 * 凭证是**会话态**不是玩家数据：跨设备搬过去毫无意义，
 * 而**搬回来会把当前有效会话打掉** —— 就是本次事故。
 *
 * 合同：
 *   ① 备份不得收录任何凭证类键
 *   ② 恢复/回滚同样不得写回凭证（旧备份里可能已经存着）
 *   ③ 玩家数据一个都不能少（不能因为堵这个口子误伤正常备份）
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('备份绝不碰云端凭证 v1090');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_backup_v944.js'), 'utf8');

function mk(seed) {
  const raw = Object.assign({}, seed);
  const store = {
    getItem: k => (k in raw ? raw[k] : null),
    setItem: (k, v) => { raw[k] = String(v); },
    removeItem: k => { delete raw[k]; },
    get length() { return Object.keys(raw).length; },
    key: i => Object.keys(raw)[i] || null
  };
  const win = { localStorage: store, console, Date, JSON, Object, Array, String, Number, Math, RegExp, Error,
    document: { addEventListener() {}, getElementById: () => null }, addEventListener() {}, setTimeout: () => 0 };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { B: ctx.window.HansenBackup, raw, store };
}

const CREDS = {
  'credentials_ambitious-d0g1d26xm740dc3d6': '{"access_token":"OLD","refresh_token":"STALE"}',
  'access_token_x': 'v',
  'refresh_token_y': 'v',
  'tcb_session': 'v'
};
const PLAYER = {
  'wordIslandAnimal': '{"learned":[1,2,3]}',
  'hansen_wallet_coins': '100',
  'hansen_gear': '{"weaponLvl":3}',
  'sb_best_cpm': '42',
  'season1_prog': '5'
};

/* ① 备份不得收录凭证 */
{
  const { B } = mk(Object.assign({}, CREDS, PLAYER));
  const keys = (B.build().items || []).map(x => x.key);
  const leaked = keys.filter(k => /^(?:credentials|access_token|refresh_token)|^tcb[_-]/i.test(k));
  ok(leaked.length === 0, `★ 凭证类键全部被排除${leaked.length ? '（漏了 ' + leaked.join(',') + '）' : ''}`);
  ok(keys.includes('credentials_ambitious-d0g1d26xm740dc3d6') === false,
     '★ 那个真实肇事的键确实不在备份里');
}

/* ② 玩家数据一个都不能少 */
{
  const { B } = mk(Object.assign({}, CREDS, PLAYER));
  const keys = (B.build().items || []).map(x => x.key);
  for (const k of Object.keys(PLAYER)) {
    ok(keys.includes(k), `玩家数据仍被收录：${k}`);
  }
}

/* ③ 恢复不得把凭证写回去 —— 旧备份里可能已经存着 */
{
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const i = code.indexOf('function rawEntryAllowed');
  const seg = code.slice(i, i + 320);
  ok(/credentialKey\(k\)/.test(seg),
     '★ 恢复/回滚路径(rawEntryAllowed)也拦凭证 —— 旧备份里可能已存着');
  ok(/function credentialKey/.test(code), '存在 credentialKey 判据');
  const oi = code.indexOf('function ownedKey');
  const oseg = code.slice(oi, oi + 260);
  ok(/credentialKey\(k\)/.test(oseg), '★ ownedKey 里也拦（收录侧）');
  const credAt = oseg.indexOf('credentialKey');
  const derivedAt = oseg.indexOf('derivedKey');
  ok(credAt >= 0 && credAt < derivedAt, '★ 凭证排除放在最前面，先于一切收录规则');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
