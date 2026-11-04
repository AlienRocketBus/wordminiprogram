const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_page_wiring_v1063.mjs —— 页面模块接线合同（全页自动枚举）
 *
 * 事故复盘：8 个 Land 页被连续漏了**四次**
 *   v1021 账号接线 / v1030 Lv.3 门槛 / v1038 全站音量 / v1048 开机云端恢复
 *   ——每一次都只改了 template.html，由 generate.py 分发到 19 个常规岛，
 *   而 island_land1~8 是**手工维护、不由 generate 生成**的，四次全部落空。
 *
 * 实测到的后果（v1063 修复前）：
 *   同一账号下  island_animal → 密钥 5S7W-BAVB-1EVE-6WAK（账号派生）
 *              island_land1  → 密钥 JG91E3ERCGK3WKA0  （设备随机）
 *   Land 页只有云存档、没有账号模块，ensureKey() 读不到登录态就退回**设备密钥**，
 *   于是 Land 页的进度不跟着账号走，**换设备永远找不回**。
 *   这正是 v1021 修过的那个 bug，在 Land 页上又活了 40 多个版本。
 *
 * 为什么以前没被发现：
 *   `test_tts_volume_v1038` 只检查了 island_animal 和 spelling_bee **两个页面**，
 *   所以 8 个 Land 页漏了这么久还一直是绿灯。
 *   **写死页面清单的测试，守不住"新页面/手工页面被漏掉"这件事。**
 *
 * 因此本台架的设计要点：**自动枚举全仓 HTML，不接受任何手工清单。**
 * 新增页面无需改测试就会自动纳入检查。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = __HSN_ROOT.replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('页面模块接线合同 v1063');

/* 只看代码，不看注释——本仓注释里大量引用旧代码原文 */
const codeOnly = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/* 自动枚举：排除纯演示/预览页（不承载玩法，不参与存档） */
const EXCLUDE = new Set(['_sw_upgrade_v944.html', '_vgprev.html', '武器图鉴预览.html', '武器攻击特效演示.html']);
const pages = fs.readdirSync(ROOT)
  .filter(n => n.endsWith('.html') && !EXCLUDE.has(n))
  .sort();
ok(pages.length >= 30, `自动枚举到 ${pages.length} 个页面（不是写死的清单）`);
ok(pages.filter(n => /^island_land[1-8]\.html$/.test(n)).length === 8, '8 个 Land 页在检查范围内');
ok(pages.includes('spelling_pk.html'), 'spelling_pk.html 在检查范围内');

const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const info = {};
for (const n of pages) {
  const raw = fs.readFileSync(path.join(ROOT, n), 'utf8');
  const code = codeOnly(raw);
  const has = (m) => new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(code);
  info[n] = {
    raw, code,
    speaks: /new SpeechSynthesisUtterance|speechSynthesis\.speak|function speak\s*\(/.test(code),
    cloudSave: has('hansen_cloud_save'),
    auth: has('hansen_auth_v1004'),
    restore: has('hansen_cloud_restore'),
    gate: has('hansen_signup_gate'),
    vol: has('hansen_tts_volume'),
    pkEntry: has('hansen_sb_pk_v1022') || /id="pkRooms"/.test(code),
    pkRoom: has('hansen_pk_room_v1065'),
    pkRoomUi: has('hansen_pk_room_ui_v1065'),
    volDeferred: /<script[^>]*\bdefer\b[^>]*hansen_tts_volume|<script[^>]*hansen_tts_volume[^>]*\bdefer\b/.test(code)
  };
}

/* ═══ ① 有云存档 → 必须有账号模块（v1021 合同）═══
   缺账号时 ensureKey() 退回设备随机密钥，进度不跟账号走，换设备找不回。 */
{
  const bad = pages.filter(n => info[n].cloudSave && !info[n].auth);
  ok(bad.length === 0, `★ 每个有云存档的页面都有账号模块（v1021）${bad.length ? ' —— 缺: ' + bad.join(', ') : ''}`);
  const withSave = pages.filter(n => info[n].cloudSave);
  ok(withSave.length >= 28, `有云存档的页面共 ${withSave.length} 个（19 常规岛 + 8 Land + PK 等）`);
}

/* ═══ ② 有云存档 → 必须有开机恢复与 Lv.3 门槛 ═══
   少了恢复：进这一页不检查云端存档；少了门槛：该页成为注册门槛的后门。 */
{
  const noRestore = pages.filter(n => info[n].cloudSave && !info[n].restore);
  const noGate = pages.filter(n => info[n].cloudSave && !info[n].gate);
  ok(noRestore.length === 0, `★ 有云存档的页面都有开机恢复（v1048）${noRestore.length ? ' —— 缺: ' + noRestore.join(', ') : ''}`);
  ok(noGate.length === 0, `★ 有云存档的页面都有 Lv.3 门槛（v1030）${noGate.length ? ' —— 缺: ' + noGate.join(', ') : ''}`);
}

/* ═══ ③ 会朗读单词 → 必须有音量模块，且不得 defer（v1038 合同）═══
   音量模块靠劫持 SpeechSynthesisUtterance 与 audio.play 生效，
   必须在任何发音代码之前同步执行；加了 defer 就可能来不及接管。 */
{
  const speaking = pages.filter(n => info[n].speaks);
  ok(speaking.length >= 28, `会朗读单词的页面共 ${speaking.length} 个`);
  const noVol = speaking.filter(n => !info[n].vol);
  ok(noVol.length === 0, `★ 每个会朗读的页面都有音量模块（v1038）${noVol.length ? ' —— 缺: ' + noVol.join(', ') : ''}`);
  const deferred = pages.filter(n => info[n].vol && info[n].volDeferred);
  ok(deferred.length === 0, `★ 音量模块一律不加 defer（要先于发音代码接管）${deferred.length ? ' —— 违规: ' + deferred.join(', ') : ''}`);
}

/* ═══ ④ Land 页必须与常规岛拥有同一套模块 ═══
   这 8 页手工维护、不由 generate.py 分发，是历次遗漏的重灾区。
   直接与 island_animal 逐项比对，任何一项缺失立刻报红。 */
{
  const ref = info['island_animal.html'];
  ok(!!ref, '基准页 island_animal.html 存在');
  for (const key of ['auth', 'cloudSave', 'restore', 'gate', 'vol']) {
    const bad = pages.filter(n => /^island_land[1-8]\.html$/.test(n) && info[n][key] !== ref[key]);
    ok(bad.length === 0, `★ 8 个 Land 页与常规岛的 ${key} 一致${bad.length ? ' —— 不一致: ' + bad.join(', ') : ''}`);
  }
}

/* ═══ ④b 有 PK 入口 → 必须有房间模块（v1065）═══
   「公开房间」按钮点了没反应，就是因为页面没带上房间服务/界面。
   这条同样自动枚举，新增页面不改测试也会被覆盖。 */
{
  const withEntry = pages.filter(n => info[n].pkEntry);
  ok(withEntry.length >= 20, `有 PK 入口的页面共 ${withEntry.length} 个`);
  const noSvc = withEntry.filter(n => !info[n].pkRoom);
  const noUi = withEntry.filter(n => !info[n].pkRoomUi);
  ok(noSvc.length === 0, `★ 有 PK 入口的页面都带房间服务${noSvc.length ? ' —— 缺: ' + noSvc.join(', ') : ''}`);
  ok(noUi.length === 0, `★ 有 PK 入口的页面都带房间界面${noUi.length ? ' —— 缺: ' + noUi.join(', ') : ''}`);
}

/* ═══ ⑤ 资源戳必须全仓统一（v1063）═══
   bump_version 原先只做「上一版 → 新版」字面替换，替不到落后多版的戳；
   spelling_pk.html 的 10 个脚本因此自 v1004/v1021 起再没更新过。
   浏览器与 SW 按**完整 URL** 缓存，URL 不变就一直供着当年缓存的旧文件内容——
   同一份 hansen_auth 在岛屿页是最新版、在 PK 页却停在 v1004，且毫无报错。 */
{
  const stale = [];
  for (const n of pages) {
    for (const m of info[n].code.matchAll(/\?v=(\d+)/g)) {
      if (m[1] !== VERSION) stale.push(`${n}:?v=${m[1]}`);
    }
  }
  ok(stale.length === 0, `★ 全仓资源戳统一为 v${VERSION}${stale.length ? ' —— 落后: ' + stale.slice(0, 6).join(', ') : ''}`);
}

/* ═══ ⑥ 工具层根因：清单不得再手工维护 ═══ */
{
  const bv = fs.readFileSync(path.join(ROOT, 'bump_version.py'), 'utf8');
  ok(/def _standalone_html/.test(bv), '★ bump_version 改为自动枚举 HTML（手工清单必然走散）');
  ok(/\?v=\\d\+|\?v=\\\\d\+/.test(bv) || /stamp_re/.test(bv), '★ bump_version 用正则归一资源戳（能追回落后多版的戳）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
