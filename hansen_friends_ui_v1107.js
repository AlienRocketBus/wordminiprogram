/* hansen_friends_ui_v1107.js —— 好友界面
 *
 * 一屏搞定四件事：
 *   ① 我的状态（在线 / 隐身）—— 一眼能切
 *   ② 加好友（输竞赛 ID）
 *   ③ 好友列表 —— **在线的头像是亮的 + 绿点，离线的整个变灰**
 *   ④ 点好友 → 发快捷语 / 约战
 *
 * 设计上刻意做的几件事：
 *   · 在线的人**排在最前面** —— 你想找的就是能马上打的那个
 *   · 离线的人整体降到 45% 不透明度，不是只把绿点去掉 ——
 *     一眼扫过去就知道谁能约
 *   · 措辞用「刚才还在」而不是「在线中」——
 *     网页没有真正的长连接，页面一关就没心跳，
 *     手机切到微信后台页面还会被冻结。**不想让这个功能骗人。**
 *   · 快捷语面板里**没有输入框** —— 这是产品硬约束的视觉体现
 */
(function () {
  'use strict';
  if (window.HansenFriendsUI) return;

  var ID = 'hsn_friends_screen';
  var _timer = null;

  function F() { return window.HansenFriends; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function q(id) { return document.getElementById(id); }


  /* ── 🔴v1110 亮色/暗色主题 ──────────────────────────────────

     全站早就有配色系统（`hansen_palette.js`）：选亮色系时
     `<html>` 会加上 `hsn-pal-light` 类。
     但我 v1107/v1108 新做的界面**全是写死的深色十六进制**，
     在亮色模式下会是一块突兀的黑 —— 用户切了主题却有几屏不跟着变。

     ⚠️ 变量名必须带独有前缀：第一版我用了 `--fr-txt`，
        而**全站 palette 已经在用这个名字**（亮色下它是 #ffffff），
        于是我的标题在亮色模式下变成白底白字、对比度 1.0 完全看不见。
        改用 `--hpk-*` 前缀，与任何既有变量都不重名。

     改法：把颜色收进一组变量，亮色系下整组换掉。
     **不是给每个元素单独写 !important 覆盖**（那会越堆越乱），
     而是让所有样式都只引用变量，主题只负责改变量。 */
  var THEME_VARS =
    'html:root{' +
      '--hpk-bg:#0b1020;--hpk-card:#111827;--hpk-line:#1f2937;' +
      '--hpk-txt:#e8eefc;--hpk-dim:#a9b4c7;--hpk-faint:#7c879b;' +
      '--hpk-in-bg:#0b1020;--hpk-in-line:#334155;' +
      '--hpk-btn2:#1f2937;--hpk-btn2-txt:#cbd5e1;' +
      '--hpk-av:#1e293b;--hpk-av-on:#312e81;--hpk-accent:#4f46e5;' +
      '--hpk-sel-bg:#1e1b4b;--hpk-ok:#34d399;--hpk-bad:#f87171' +
    '}' +
    'html.hsn-pal-light:root, html.hsn-pal-light{' +
      '--hpk-bg:#f4f6fb;--hpk-card:#ffffff;--hpk-line:#e3e7ee;' +
      '--hpk-txt:#0f172a;--hpk-dim:#4b5563;--hpk-faint:#6b7280;' +
      '--hpk-in-bg:#f9fafb;--hpk-in-line:#cbd5e1;' +
      '--hpk-btn2:#eef1f6;--hpk-btn2-txt:#1f2937;' +
      '--hpk-av:#e8ecf5;--hpk-av-on:#dbe1ff;--hpk-accent:#4338ca;' +
      '--hpk-sel-bg:#e8ecff;--hpk-ok:#047857;--hpk-bad:#b91c1c' +
    '}';

      /* 🔴v1111：**背景用主题变量，文字就不能写死。**
         `.fr_st div.sel` 原来是 `background:var(--hpk-sel-bg);color:#fff` ——
         暗色下选中态是深紫底白字没问题，亮色下背景变成 #e8ecff（很浅），
         白字就完全看不见了（实测对比度 1.0）。
         凡是背景跟主题走的元素，前景色必须一起跟。

      /* 🔴v1110：这几条必须 !important。
         全站 palette 在亮色系下有一批 `color:#fff!important` 的规则
         （为了让深色卡片上的白字在任何配色下都可读）。
         我们这几屏是**自己的深/浅底**，被那批规则波及会变成白底白字。
         只给"标题/数值"这类关键文字加，不滥用 —— 其余仍走变量级联。 */
  function css() {
    if (q('hsn_fr_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_fr_css';
    st.textContent = THEME_VARS +
      '#' + ID + '{position:fixed;inset:0;z-index:2147482000;background:var(--hpk-bg);' +
        'display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '#' + ID + '.on{display:block}' +
      'html .fr_wrap{max-width:520px;margin:0 auto;padding:16px 14px 40px}' +
      'html .fr_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
      'html .fr_h{font-size:20px;font-weight:900;color:var(--hpk-txt)!important;flex:1}' +
      'html .fr_x{background:none;border:0;color:var(--hpk-dim);font-size:26px;cursor:pointer;padding:0 6px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}' +
      'html .fr_card{background:var(--hpk-card);border:1px solid var(--hpk-line);border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
      'html .fr_lbl{font-size:12.5px;color:var(--hpk-dim)!important;margin-bottom:8px}' +
      'html .fr_row{display:flex;gap:8px}' +
      'html .fr_in{flex:1;min-width:0;background:var(--hpk-bg);border:1px solid var(--hpk-in-line);border-radius:10px;' +
        'color:var(--hpk-txt);padding:10px;font-size:16px;text-align:center;letter-spacing:2px}' +
      'html .fr_btn{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border:0;' +
        'border-radius:10px;padding:10px 14px;font-size:15px;font-weight:700;cursor:pointer}' +
      'html .fr_btn2{background:var(--hpk-line);color:var(--hpk-btn2-txt)}' +
      'html .fr_item{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--hpk-line);cursor:pointer}' +
      'html .fr_item:last-child{border-bottom:0}' +
      /* 🔴 离线整体变灰 —— 不是只去掉绿点，要一眼扫出谁能约 */
      'html .fr_item.off{opacity:.45}' +
      'html .fr_av{position:relative;width:44px;height:44px;border-radius:50%;background:var(--hpk-av);' +
        'display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 44px}' +
      'html .fr_item.on2 .fr_av{background:var(--hpk-av-on);box-shadow:0 0 0 2px #4f46e5}' +
      'html .fr_dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;' +
        'background:#22c55e;border:2px solid var(--hpk-bg)}' +
      'html .fr_nm{font-size:16px;font-weight:700;color:var(--hpk-txt)!important}' +
      'html .fr_sub{font-size:12px;color:var(--hpk-dim);margin-top:2px}' +
      'html .fr_q{display:inline-block;background:var(--hpk-line);border:1px solid var(--hpk-in-line);border-radius:999px;' +
        'padding:9px 13px;margin:5px 5px 0 0;font-size:14px;color:var(--hpk-txt);cursor:pointer}' +
      'html .fr_empty{color:var(--hpk-dim);font-size:14px;text-align:center;padding:22px 8px;line-height:1.8}' +
      'html .fr_st{display:flex;gap:8px}' +
      'html .fr_st div{flex:1;text-align:center;border:1px solid var(--hpk-in-line);border-radius:10px;' +
        'padding:9px 4px;cursor:pointer;font-size:14px;color:var(--hpk-btn2-txt)}' +
      'html .fr_st div.sel{border-color:var(--hpk-accent);background:var(--hpk-sel-bg);color:var(--hpk-txt)!important;font-weight:700}';
    document.head.appendChild(st);
  }

  function host() {
    var el = q(ID);
    if (el) return el;
    css();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '好友');
    document.body.appendChild(el);
    return el;
  }

  function paint(inner) {
    var el = host();
    el.innerHTML = '<div class="fr_wrap">' + inner + '</div>';
    el.classList.add('on');
  }

  function close() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    var el = q(ID);
    if (el) el.classList.remove('on');
  }

  /* ── 主屏 ─────────────────────────────────────────────── */

  /* 🔴v1113：**打开自己之前先关掉同级的另一屏。**

     实测：天梯页和好友页能同时开着，而且 z-index 一模一样
     （都是 2147482000）—— 谁盖在上面全看 DOM 插入顺序，
     用户会看到两屏叠在一起、点击穿透到下面那屏。

     这类"全屏浮层"必须互斥：打开一个就关掉另一个。
     不靠调 z-index 谁高谁低 —— 那只是把问题藏起来，
     下面那屏仍然存在、仍在跑它的轮询定时器。 */
  function closePeers() {
    var peers = ['HansenFriendsUI', 'HansenLadderUI', 'HansenPkRoomUI'];
    peers.forEach(function (n) {
      try {
        var m = window[n];
        if (m && m !== window.HansenFriendsUI && typeof m.close === 'function') m.close();
      } catch (e) {}
    });
  }

  function open() {
    closePeers();
    render([], true);
    refresh();
    /* 每 15 秒刷新在线状态 —— 太频繁会烧云开发的读次数 */
    if (_timer) clearInterval(_timer);
    _timer = setInterval(refresh, 15000);
  }

  function render(friends, loading, notice) {
    var st = F() ? F().myStatus() : 'online';
    var on = friends.filter(function (f) { return f.online; }).length;

    paint(
      '<div class="fr_top"><div class="fr_h">👥 我的好友</div>'
      + '<button class="fr_x" id="frX">×</button></div>'

      /* 我的状态 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">我的状态</div>'
      +   '<div class="fr_st">'
      +     '<div id="frOn" class="' + (st === 'online' ? 'sel' : '') + '">🟢 在线</div>'
      +     '<div id="frHide" class="' + (st === 'hidden' ? 'sel' : '') + '">🌙 隐身</div>'
      +   '</div>'
      +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:7px;line-height:1.6">'
      +     (st === 'hidden'
          ? '隐身时好友看到的你和「不在线」一模一样，看不出差别。'
          : '好友能看到你「刚才还在」。<br>'
            + '（网页不能像 App 那样一直挂着，所以这只表示你最近开着页面）')
      +   '</div>'
      + '</div>'

      /* 加好友 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">加好友（输对方的竞赛 ID 数字）</div>'
      +   '<div class="fr_row">'
      +     '<input class="fr_in" id="frCid" inputmode="numeric" placeholder="例如 2" autocomplete="off">'
      +     '<button class="fr_btn" id="frAdd">加好友</button>'
      +   '</div>'
      +   '<div style="font-size:11.5px;color:var(--hpk-faint);margin-top:7px">'
      +     '竞赛 ID 在「拼写大PK」页面顶部，长这样：No.001'
      +   '</div>'
      + '</div>'

      /* 好友列表 */
      + '<div class="fr_card">'
      +   '<div class="fr_lbl">好友 ' + (friends.length ? '· ' + on + ' 人刚才还在' : '') + '</div>'
      +   '<div id="frList">'
      +     (loading ? '<div class="fr_empty">正在读取…</div>'
              : (notice
                  ? '<div class="fr_empty">' + esc(notice) + '</div>'
                  : listHtml(friends)))
      +   '</div>'
      + '</div>'
    );

    if (q('frX')) q('frX').onclick = close;
    if (q('frOn')) q('frOn').onclick = function () { F().setStatus('online'); refresh(); };
    if (q('frHide')) q('frHide').onclick = function () { F().setStatus('hidden'); refresh(); };
    if (q('frAdd')) q('frAdd').onclick = doAdd;
    var ci = q('frCid');
    if (ci) ci.onkeydown = function (ev) { if (ev.key === 'Enter') doAdd(); };
    bindList(friends);
  }

  function listHtml(friends) {
    if (!friends.length) {
      return '<div class="fr_empty">还没有好友。<br>'
        + '让同学告诉你他的竞赛 ID，输在上面就能加。</div>';
    }
    return friends.map(function (f, i) {
      return '<div class="fr_item ' + (f.online ? 'on2' : 'off') + '" data-i="' + i + '">'
        + '<div class="fr_av">🐝' + (f.online ? '<span class="fr_dot"></span>' : '') + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div class="fr_nm">' + esc(f.name) + '</div>'
        +   '<div class="fr_sub">No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
        + '</div>'
        + '<div style="font-size:18px;color:var(--hpk-faint)">›</div>'
        + '</div>';
    }).join('');
  }

  function bindList(friends) {
    var box = q('frList');
    if (!box) return;
    box.querySelectorAll('.fr_item').forEach(function (el) {
      el.onclick = function () {
        var f = friends[Number(el.getAttribute('data-i'))];
        if (f) detail(f);
      };
    });
  }

  function refresh() {
    if (!F()) return;
    F().listFriends().then(function (r) {
      if (!q(ID) || !q(ID).classList.contains('on')) return;
      /* 🔴v1109：**没登录要明说**。
         原来只在列表处显示"还没有好友"，用户根本不知道是因为没登录，
         会以为功能坏了 —— 这就是"界面说谎"的一种。 */
      if (r && !r.ok && /登录/.test(r.reason || '')) {
        render([], false, '先登录才能加好友');
        return;
      }
      render((r && r.friends) || [], false);
    })['catch'](function (e) {
      if (!q(ID) || !q(ID).classList.contains('on')) return;
      render([], false, '连不上云端：' + String((e && e.message) || e).slice(0, 40));
    });
  }

  function doAdd() {
    var ci = q('frCid');
    var btn = q('frAdd');
    var cid = String((ci && ci.value) || '').trim();
    if (!cid) { alert('先输入对方的竞赛 ID 数字'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '添加中…'; }
    F().addFriend(cid).then(function (r) {
      if (btn) { btn.disabled = false; btn.textContent = '加好友'; }
      if (!r.ok) { alert(r.reason || '加不上'); return; }
      if (ci) ci.value = '';
      alert('已加 ' + r.name + ' 为好友');
      refresh();
    })['catch'](function (e) {
      if (btn) { btn.disabled = false; btn.textContent = '加好友'; }
      alert(String((e && e.message) || e));
    });
  }

  /* ── 好友详情：发快捷语 / 约战 ───────────────────────────
     🔴 这一屏**没有输入框** —— 这是"不能打字聊天"这条产品约束
        在界面上的直接体现，不是靠禁用某个功能藏起来的。 */
  function detail(f) {
    var QUICK = (F() && F().QUICK) || [];
    paint(
      '<div class="fr_top"><button class="fr_x" id="frBack">←</button>'
      + '<div class="fr_h">' + esc(f.name) + '</div></div>'

      + '<div class="fr_card" style="text-align:center">'
      +   '<div class="fr_av" style="margin:0 auto 10px;width:64px;height:64px;font-size:32px;'
      +     (f.online ? 'background:var(--hpk-av-on);box-shadow:0 0 0 3px #4f46e5' : 'opacity:.5') + '">🐝'
      +     (f.online ? '<span class="fr_dot" style="width:16px;height:16px"></span>' : '')
      +   '</div>'
      +   '<div style="font-size:18px;font-weight:800;color:var(--hpk-txt)">' + esc(f.name) + '</div>'
      +   '<div style="font-size:13px;color:' + (f.online ? '#22c55e' : 'var(--hpk-faint)') + ';margin-top:4px">'
      +     'No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
      + '</div>'

      + '<div class="fr_card">'
      +   '<div class="fr_lbl">发个招呼（只能发这些，不能打字）</div>'
      +   '<div>' + QUICK.map(function (x) {
              return '<span class="fr_q" data-q="' + esc(x.id) + '">'
                + x.emoji + ' ' + esc(x.text) + '</span>';
            }).join('') + '</div>'
      +   '<div id="frSent" style="font-size:13px;color:var(--hpk-ok);min-height:20px;margin-top:10px"></div>'
      + '</div>'

      + '<button class="fr_btn" id="frPk" style="width:100%;margin-bottom:10px">'
      +   '⚔️ 开个房间叫他来打</button>'
      + '<button class="fr_btn fr_btn2" id="frDel" style="width:100%">删除好友</button>'
    );

    if (q('frBack')) q('frBack').onclick = function () { open(); };
    host().querySelectorAll('.fr_q').forEach(function (el) {
      el.onclick = function () {
        var qid = el.getAttribute('data-q');
        F().sendQuick(f.cid, qid).then(function (r) {
          var box = q('frSent');
          if (!box) return;
          box.textContent = r.ok
            ? ('已发出：' + r.sent.emoji + ' ' + r.sent.text)
            : ('没发出去：' + (r.reason || '未知'));
          box.style.color = r.ok ? 'var(--hpk-ok)' : 'var(--hpk-bad)';
        });
      };
    });
    if (q('frPk')) q('frPk').onclick = function () {
      close();
      /* 开私密房 —— 拿到码发给他，这是 v1105 做好的路径 */
      try {
        if (window.HansenPkRoomUI && HansenPkRoomUI.open) HansenPkRoomUI.open();
      } catch (e) {}
    };
    if (q('frDel')) q('frDel').onclick = function () {
      if (!window.confirm('确定删除好友 ' + f.name + '？')) return;
      F().removeFriend(f.cid).then(function () { open(); });
    };
  }

  window.HansenFriendsUI = { open: open, close: close, _detail: detail };
})();
