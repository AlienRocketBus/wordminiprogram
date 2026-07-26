/* hansen_sb_pk_v1022.js —— 拼写大PK「页面内屏」
 *
 * 此前 PK 是用 iframe 加载独立页面 spelling_pk.html，每次点开都要走一次网页加载 → 有延迟。
 * 本模块把同一套界面改为**在当前页面内直接渲染**（与个人资料页同一做法），
 * 模块随岛屿页一次性加载完毕，点击即开、零网络往返——就像屋子里的房间之间来回走。
 *
 * 依赖（均已随岛屿页加载）：HansenSbProfile / HansenSbLadder / HansenAuth / HansenAuthUI
 */
(function () {
  'use strict';
  if (window.HansenSbPK) return;

  var ID = 'hsn_pk_screen';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function cloudReady() {
    try { var c = window.HANSEN_CLOUD_CONFIG; return !!(c && typeof c === 'object' && c.envId); }
    catch (e) { return false; }
  }
  function readLadder() {
    var d = { rating: 0, placed: false, games: 0, wins: 0, losses: 0, bestStreak: 0 };
    try {
      var o = JSON.parse(localStorage.getItem('hansen_sb_ladder_v1002'));
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        ['rating', 'games', 'wins', 'losses', 'bestStreak'].forEach(function (k) {
          var v = +o[k]; if (isFinite(v) && v >= 0) d[k] = Math.floor(v);
        });
        d.placed = !!o.placed;
      }
    } catch (e) {}
    return d;
  }

  function style() {
    if (document.getElementById('hsn_pk_css')) return;
    var css = [
      '#' + ID + '{position:fixed;inset:0;z-index:2147483400;display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      '  background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 55%,#312e81 100%);color:#e8eefc;padding:14px 12px 40px}',
      '#' + ID + '.on{display:block}',
      '#' + ID + ' .k_hd{display:flex;align-items:center;gap:10px;margin-bottom:14px}',
      '#' + ID + ' .k_back{background:rgba(255,255,255,.12);color:#e8eefc;border:0;border-radius:11px;padding:9px 13px;font:inherit;font-weight:800;cursor:pointer}',
      '#' + ID + ' .k_h1{font-size:20px;font-weight:900;letter-spacing:.5px}',
      '#' + ID + ' .k_sub{font-size:12px;opacity:.7;margin-top:2px;font-weight:700}',
      '#' + ID + ' .k_me{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.15);',
      '  border-radius:16px;padding:13px 14px;margin-bottom:12px;cursor:pointer}',
      '#' + ID + ' .k_ava{width:56px;height:56px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:34px;',
      '  background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.22),rgba(255,255,255,.05) 65%,transparent 74%)}',
      '#' + ID + ' .k_nm{font-size:17px;font-weight:900;line-height:1.25;word-break:break-all}',
      '#' + ID + ' .k_cid{margin-top:3px;font-size:12.5px;font-weight:800;letter-spacing:.4px;opacity:.9}',
      '#' + ID + ' .k_cid b{font-size:16px;font-variant-numeric:tabular-nums;letter-spacing:1.5px}',
      '#' + ID + ' .k_tier{margin-top:4px;font-size:12.5px;font-weight:800;color:#fde68a}',
      '#' + ID + ' .k_go{margin-left:auto;flex:none;opacity:.55;font-size:20px}',
      '#' + ID + ' .k_acct{display:flex;gap:8px;margin-bottom:6px}',
      '#' + ID + ' .k_ab{flex:1;min-height:44px;border-radius:12px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;',
      '  background:rgba(255,255,255,.10);color:#e8eefc;border:1px solid rgba(255,255,255,.16)}',
      '#' + ID + ' .k_ab.primary{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border-color:transparent}',
      '#' + ID + ' .k_tip{font-size:11.5px;opacity:.66;line-height:1.6;margin:6px 0 14px;font-weight:600}',
      '#' + ID + ' .k_card{border:0;width:100%;text-align:left;border-radius:18px;padding:16px;margin-bottom:12px;color:#fff;font:inherit;',
      '  cursor:pointer;display:block;box-shadow:0 4px 14px rgba(0,0,0,.24)}',
      '#' + ID + ' .k_c1{background:linear-gradient(135deg,#4f46e5,#4338ca)}',
      '#' + ID + ' .k_c2{background:linear-gradient(135deg,#0ea5e9,#0369a1)}',
      '#' + ID + ' .k_ic{font-size:34px;line-height:1}',
      '#' + ID + ' .k_t{font-size:18px;font-weight:900;margin-top:7px;letter-spacing:.4px}',
      '#' + ID + ' .k_d{font-size:12.5px;opacity:.9;margin-top:5px;line-height:1.6;font-weight:600}',
      '#' + ID + ' .k_sec{font-size:13px;font-weight:900;opacity:.82;margin:18px 0 9px;letter-spacing:.4px}',
      '#' + ID + ' .k_grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}',
      '#' + ID + ' .k_it{background:rgba(255,255,255,.07);border-radius:12px;padding:11px 12px}',
      '#' + ID + ' .k_v{font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}',
      '#' + ID + ' .k_l{font-size:11.5px;opacity:.72;margin-top:2px;font-weight:700}',
      '#' + ID + ' .k_note{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:14px;',
      '  padding:13px 14px;font-size:12.5px;line-height:1.7;opacity:.9;font-weight:600}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'hsn_pk_css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function render() {
    var el = document.getElementById(ID);
    if (!el) return;
    var P = window.HansenSbProfile;
    var L2 = window.HansenSbLadder;
    var A = window.HansenAuth;
    var p = P ? P.readProfile() : { name: '', cid: 0 };
    var L = readLadder();
    var tier = L2 ? L2.tierOf(L.rating || 1000) : null;
    var s = P ? P.collectStats() : { bestCpm: 0, learned: 0, days: 0 };
    var rate = L.games ? Math.round(L.wins / L.games * 100) : 0;

    var h = '<div class="k_hd"><button class="k_back" id="kBack">← 返回</button>'
      + '<div><div class="k_h1">⚔️ 拼写大PK</div><div class="k_sub">和真人比拼写，不是机器人</div></div></div>';

    /* 身份条 */
    h += '<div class="k_me" id="kMe"><span class="k_ava">' + (p.avatar || '🐝') + '</span><div style="min-width:0;flex:1">'
      + (p.name ? '<div class="k_nm">' + esc(p.name) + '</div>'
                : '<div class="k_nm" style="opacity:.7">点这里设置名字</div>')
      + '<div class="k_cid">🎫 竞赛 ID <b>No.' + (P ? P.fmtCid(p.cid) : '---') + '</b></div>'
      + (tier ? '<div class="k_tier">' + tier.icon + ' ' + tier.name
          + (L.placed ? ' · ' + L.rating + ' 分' : ' · 未定级') + '</div>' : '')
      + '</div><span class="k_go">›</span></div>';

    /* 账号区 */
    if (!A || !A.ready()) {
      h += '<div class="k_tip">☁️ 云端账号还没开通，进度暂存在本机。</div>';
    } else if (A.isSignedIn()) {
      var lc = A.readLocal();
      h += '<div class="k_tip">✅ 已登录 ' + esc(lc.phone || lc.username || '') + '　进度已跟随账号，换设备登录即可找回。</div>'
        /* 🔴v1048: 换设备后最需要的动作, 必须一眼能看见、随时可点 */
        + '<div class="k_acct"><button class="k_ab primary" id="kPull" style="flex:2">☁️ 从云端恢复进度</button></div>'
        + '<div class="k_acct"><button class="k_ab" id="kSwitch">🔄 切换账号</button>'
        + '<button class="k_ab" id="kOut">🚪 退出登录</button></div>';
    } else {
      h += '<div class="k_acct"><button class="k_ab primary" id="kReg">🔐 注册 / 登录</button></div>'
        + '<div class="k_tip">登录后进度存到云端，换手机登录同一账号，等级、卡册、成就全都在。</div>';
    }

    /* 两种模式 */
    h += '<button class="k_card k_c1" id="kRooms"><div class="k_ic">🏠</div>'
      + '<div class="k_t">大PK · 公开房间</div>'
      + '<div class="k_d">看看谁开了房，点进去直接开打。也可以自己开一间等人来。</div></button>'
      + '<button class="k_card k_c2" id="kLadder"><div class="k_ic">🏆</div>'
      + '<div class="k_t">天梯排位</div>'
      + '<div class="k_d">系统按分数匹配对手，赢了涨分升段。幼蜂 → 工蜂 → 侦察蜂 → 守卫蜂 → 蜂王 → 传奇蜂王。</div></button>';

    /* 战绩速览 */
    h += '<div class="k_sec">📊 我的战绩</div><div class="k_grid">'
      + '<div class="k_it"><div class="k_v">' + (s.bestCpm || 0) + '</div><div class="k_l">最快速度(字符/分)</div></div>'
      + '<div class="k_it"><div class="k_v">' + (L.games ? rate + '%' : '—') + '</div><div class="k_l">对战胜率</div></div>'
      + '<div class="k_it"><div class="k_v">' + (s.learned || 0) + '</div><div class="k_l">已掌握单词</div></div>'
      + '<div class="k_it"><div class="k_v">' + (s.days || 0) + '</div><div class="k_l">连续学习(天)</div></div>'
      + '</div>';

    /* 🔴v1027: 云同步自检入口——跨设备存档出问题时, 用户点一下截图即可定位断点 */
    h += '<div class="k_sec">🩺 遇到问题？</div>'
      + '<button class="k_ab" id="kDiag" style="width:100%">☁️ 云同步自检（把结果截图发给开发者）</button>';

    if (!cloudReady()) {
      h += '<div class="k_sec">🚧 即将开放</div>'
        + '<div class="k_note">大PK 与天梯马上就来。'
        + (L2 && P ? '按你现在的拼写速度，预计能从 <b>' + L2.tierOf(L2.placementEstimate(s.bestCpm || 0)).name + '</b> 起步。' : '')
        + '</div>';
    }

    el.innerHTML = h;
    bind();
  }

  function bind() {
    var q = function (id) { return document.getElementById(id); };
    var A = window.HansenAuth;
    if (q('kBack')) q('kBack').onclick = close;
    if (q('kMe')) q('kMe').onclick = function () {
      try {
        if (A && A.ready() && !A.isSignedIn() && window.HansenAuthUI) { HansenAuthUI.open(); return; }
        if (window.HansenSbProfile) HansenSbProfile._open();
      } catch (e) {}
    };
    if (q('kPull')) q('kPull').onclick = function () {
      var btn = this; btn.disabled = true; btn.textContent = '正在恢复…';
      try {
        if (!window.HansenCloudRestore) { alert('恢复模块未加载，请刷新页面'); btn.disabled = false; return; }
        HansenCloudRestore.now().then(function (r) {
          if (!r.ok) { alert('恢复没成功：' + (r.reason || '未知原因')); btn.disabled = false; btn.textContent = '☁️ 从云端恢复进度'; }
        });
      } catch (e) { btn.disabled = false; }
    };
    if (q('kReg')) q('kReg').onclick = function () {
      try { if (window.HansenAuthUI) HansenAuthUI.open(); } catch (e) {}
    };
    if (q('kSwitch')) q('kSwitch').onclick = function () {
      if (!confirm('切换账号会先退出当前账号，确定吗？')) return;
      A.signOut().then(function () { render(); try { if (window.HansenAuthUI) HansenAuthUI.open(); } catch (e) {} });
    };
    if (q('kOut')) q('kOut').onclick = function () {
      if (!confirm('退出后本机进度仍在，但不再同步到云端。确定退出？')) return;
      A.signOut().then(render);
    };
    var soon = function () { alert('这个模式马上就来，敬请期待！'); };
    if (q('kDiag')) q('kDiag').onclick = function () {
      try { if (window.HansenCloudDiag) HansenCloudDiag.open(); else alert('自检模块未加载'); } catch (e) {}
    };
    if (q('kRooms')) q('kRooms').onclick = soon;
    if (q('kLadder')) q('kLadder').onclick = soon;
  }

  function host() {
    var el = document.getElementById(ID);
    if (el) return el;
    style();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '拼写大PK');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function open() {
    var el = host();
    render();
    el.classList.add('on');
    try { el.scrollTop = 0; } catch (e) {}
  }
  function close() {
    var el = document.getElementById(ID);
    if (el) el.classList.remove('on');
  }

  /* 登录状态变化时即时刷新 */
  try {
    document.addEventListener('hsn-auth-changed', function () {
      var el = document.getElementById(ID);
      if (el && el.classList.contains('on')) render();
    });
  } catch (e) {}

  window.HansenSbPK = { open: open, close: close, _render: render };
})();
