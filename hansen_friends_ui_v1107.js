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

  function css() {
    if (q('hsn_fr_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_fr_css';
    st.textContent =
      '#' + ID + '{position:fixed;inset:0;z-index:2147482000;background:#0b1020;' +
        'display:none;overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif}' +
      '#' + ID + '.on{display:block}' +
      '.fr_wrap{max-width:520px;margin:0 auto;padding:16px 14px 40px}' +
      '.fr_top{display:flex;align-items:center;gap:10px;margin-bottom:14px}' +
      '.fr_h{font-size:20px;font-weight:900;color:#e2e8f0;flex:1}' +
      '.fr_x{background:none;border:0;color:#94a3b8;font-size:26px;cursor:pointer;padding:0 6px}' +
      '.fr_card{background:#111827;border:1px solid #1f2937;border-radius:14px;padding:12px 14px;margin-bottom:12px}' +
      '.fr_lbl{font-size:12.5px;color:#94a3b8;margin-bottom:8px}' +
      '.fr_row{display:flex;gap:8px}' +
      '.fr_in{flex:1;min-width:0;background:#0b1020;border:1px solid #334155;border-radius:10px;' +
        'color:#e2e8f0;padding:10px;font-size:16px;text-align:center;letter-spacing:2px}' +
      '.fr_btn{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border:0;' +
        'border-radius:10px;padding:10px 14px;font-size:15px;font-weight:700;cursor:pointer}' +
      '.fr_btn2{background:#1f2937;color:#cbd5e1}' +
      '.fr_item{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid #1f2937;cursor:pointer}' +
      '.fr_item:last-child{border-bottom:0}' +
      /* 🔴 离线整体变灰 —— 不是只去掉绿点，要一眼扫出谁能约 */
      '.fr_item.off{opacity:.45}' +
      '.fr_av{position:relative;width:44px;height:44px;border-radius:50%;background:#1e293b;' +
        'display:flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 44px}' +
      '.fr_item.on2 .fr_av{background:#312e81;box-shadow:0 0 0 2px #4f46e5}' +
      '.fr_dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;' +
        'background:#22c55e;border:2px solid #0b1020}' +
      '.fr_nm{font-size:16px;font-weight:700;color:#e2e8f0}' +
      '.fr_sub{font-size:12px;color:#94a3b8;margin-top:2px}' +
      '.fr_q{display:inline-block;background:#1f2937;border:1px solid #334155;border-radius:999px;' +
        'padding:9px 13px;margin:5px 5px 0 0;font-size:14px;color:#e2e8f0;cursor:pointer}' +
      '.fr_empty{color:#94a3b8;font-size:14px;text-align:center;padding:22px 8px;line-height:1.8}' +
      '.fr_st{display:flex;gap:8px}' +
      '.fr_st div{flex:1;text-align:center;border:1px solid #334155;border-radius:10px;' +
        'padding:9px 4px;cursor:pointer;font-size:14px;color:#cbd5e1}' +
      '.fr_st div.sel{border-color:#4f46e5;background:#1e1b4b;color:#fff;font-weight:700}';
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
  function open() {
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
      +   '<div style="font-size:11.5px;color:#64748b;margin-top:7px;line-height:1.6">'
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
      +   '<div style="font-size:11.5px;color:#64748b;margin-top:7px">'
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
        + '<div style="font-size:18px;color:#64748b">›</div>'
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
      +     (f.online ? 'background:#312e81;box-shadow:0 0 0 3px #4f46e5' : 'opacity:.5') + '">🐝'
      +     (f.online ? '<span class="fr_dot" style="width:16px;height:16px"></span>' : '')
      +   '</div>'
      +   '<div style="font-size:18px;font-weight:800;color:#e2e8f0">' + esc(f.name) + '</div>'
      +   '<div style="font-size:13px;color:' + (f.online ? '#22c55e' : '#64748b') + ';margin-top:4px">'
      +     'No.' + f.cid + ' · ' + esc(f.sub) + '</div>'
      + '</div>'

      + '<div class="fr_card">'
      +   '<div class="fr_lbl">发个招呼（只能发这些，不能打字）</div>'
      +   '<div>' + QUICK.map(function (x) {
              return '<span class="fr_q" data-q="' + esc(x.id) + '">'
                + x.emoji + ' ' + esc(x.text) + '</span>';
            }).join('') + '</div>'
      +   '<div id="frSent" style="font-size:13px;color:#34d399;min-height:20px;margin-top:10px"></div>'
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
          box.style.color = r.ok ? '#34d399' : '#f87171';
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
