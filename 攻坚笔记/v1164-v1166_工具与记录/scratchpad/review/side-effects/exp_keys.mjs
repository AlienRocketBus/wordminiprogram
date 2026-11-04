/* 一次真实会话后本机所有 localStorage 键：哪些被备份当成「SDK 的键」排除了（不能误伤玩家数据）、v1164 新增了哪些键、多大 */
import { H } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { consistencyLagMs: 0 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'k', path: '/island_animal.html', ready: () => !!(window.HansenAuth && window.HansenFriends && window.HansenBackup) });
await H.dismissIslandWelcome(p);
await H.loginPhone(p, '13544445555');
await p.eval(async () => { window.HansenSbProfile.setName('小键'); for (let i = 0; i < 40 && !(window.HansenSbProfile.readProfile() || {}).cid; i++) await new Promise((z) => setTimeout(z, 250)); });
await H.sleep(25000);
const r = await p.eval(() => {
  const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.push([k, (localStorage.getItem(k) || '').length]); }
  let items = []; try { items = window.HansenBackup.build().items.map((x) => x.key); } catch (e) { items = ['ERR ' + e.message]; }
  return { out, items };
});
const SDK = /^(?:credentials|user_info|lang|access_token|access_token_expire|refresh_token|login_type|anonymous_uuid|token_type)_|^device_id$|^x[-_]tcb[-_]|^tcb[_-]|^cloudbase/i;
const env = emu.env;
const sdk = r.out.filter(([k]) => SDK.test(k) || k.includes(env)).map(([k]) => k);
console.log('本机键共', r.out.length, '个；被当成 SDK 键排除的：', JSON.stringify(sdk));
console.log('进了备份的键：', r.items.length, '个；其中 v1164 新键：', JSON.stringify(r.items.filter((k) => /v1164|friend/.test(k))));
console.log('SDK 键有没有混进备份：', JSON.stringify(r.items.filter((k) => SDK.test(k) || k.includes(env))));
console.log('v1164 相关键大小：', JSON.stringify(r.out.filter(([k]) => /friend|v1164|pk_|ladder/.test(k))));
await p.close(); srv.close(); await browser.close();
