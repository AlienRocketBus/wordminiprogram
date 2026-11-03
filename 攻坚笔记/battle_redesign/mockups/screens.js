/* 拼写大PK · 对战界面 2.0 —— 所有画面/状态的样稿（screen.html?s=<状态>&theme=cosmos|cloud）
   这里的文案就是 SPEC.md 里定稿的文案。图片全部是游戏里的真文件（相对路径指到仓库根目录）。 */
(function () {
  'use strict';
  var R = '../../../';
  var P = new URLSearchParams(location.search);
  var LONG = P.get('long') === '1';
  var I = window.ICON || {};
  var SVG = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h12v14H8l-6-7z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M11 9l6 6M17 9l-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    check: I.check || '', speaker: I.speaker || ''
  };
  var ME = { n: '小明', av: '01' }, OP = { n: LONG ? '王小红同学的超长名字' : '小红', av: '05' };

  function img(p, cls, alt) { return '<img src="' + R + p + '" alt="' + (alt || '') + '"' + (cls ? ' class="' + cls + '"' : '') + '>'; }
  function av(n, cls, s) { return '<div class="av ' + (cls || '') + '"' + (s ? ' style="--s:' + s + 'px"' : '') + '>' + img('avatars/' + n + '.webp') + '</div>'; }
  function head(o) {
    o = o || {};
    var b = o.back === false ? '<span style="width:var(--tap)"></span>'
      : o.close ? '<button class="back ic" id="' + (o.id || 'bBack') + '" aria-label="' + (o.aria || '退出') + '">' + SVG.x + '</button>'
      : '<button class="back" id="' + (o.id || 'bBack') + '">' + SVG.back + (o.back || '返回') + '</button>';
    return '<header class="bhead">' + b + '<h1>' + (o.title || '') + '</h1><div class="slot">' + (o.slot || '<span style="width:var(--tap)"></span>') + '</div></header>';
  }
  function kb(off) {
    var rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    return '<div class="kb pr_kb' + (off ? ' off' : '') + '" id="prKb" role="group" aria-label="字母键盘">' + rows.map(function (r, i) {
      return '<div class="r pr_kbrow">' + r.split('').map(function (c) { return '<button class="k pr_key" data-k="' + c + '" aria-label="字母 ' + c + '">' + c + '</button>'; }).join('')
        + (i === 2 ? '<button class="k del pr_key pr_del" data-k="⌫" aria-label="删除一个字母">' + SVG.del + '</button>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function dots(arr) { return '<div class="dots" aria-hidden="true">' + arr.split('').map(function (c) { return '<i class="' + ({ w: 'w', l: 'l', c: 'c' }[c] || '') + '"></i>'; }).join('') + '</div>'; }
  function timer(sec, p, cls) { return '<div class="timer ' + (cls || '') + '" id="prClock" role="timer" aria-label="还剩 ' + sec + ' 秒" style="--p:' + p + '"><span class="num">' + sec + '</span><small>秒</small><i class="tl"></i></div>'; }
  function tbar(no, of, d, t) {
    return '<header class="bhead">' + '<button class="back ic" id="bQuit" aria-label="退出对战">' + SVG.x + '</button>'
      + '<div class="tb-mid"><span class="wordno">第 ' + no + ' / ' + of + ' 词</span>' + dots(d) + '</div>' + t + '</header>';
  }
  function st(kind, txt) { return '<span class="st2 ' + (kind || '') + '">' + txt + '</span>'; }
  function vsbar(o) {
    /* 两行：上面 头像·名字·分数 VS 分数·名字·头像；下面 两边各自的状态小牌（对手状态就挂在对手那一侧） */
    return '<div class="vsbar" id="bVs"><div class="vsrow">'
      + '<div class="sd' + (o.lead === 'me' ? ' lead' : '') + '">' + av(ME.av, 'me') + (o.myPlus ? '<span class="plus">+' + o.myPlus + '</span>' : '') + '<div class="nmx"><div class="nm">你</div>'
      + '<div class="sc num" id="prMy">' + o.my + '</div></div></div>'
      + '<span class="vs">VS</span>'
      + '<div class="sd r' + (o.lead === 'op' ? ' lead' : '') + '">' + av(OP.av, 'op' + (o.opOff ? ' off' : '')) + (o.opPlus ? '<span class="plus op">+' + o.opPlus + '</span>' : '') + '<div class="nmx"><div class="nm">' + OP.n + '</div>'
      + '<div class="sc num" id="prOpp">' + o.op + '</div></div></div>'
      + '</div><div class="vsst"><span>' + (o.mySt || st('', '拼写中')) + '</span><span id="prOppSt">' + (o.opSt || st('', '✍️ 正在拼')) + '</span></div></div>';
  }
  function slots(word, typed, cls, hintFirst) {
    var out = '';
    for (var i = 0; i < word.length; i++) {
      var c = typed[i] || '', k = '';
      if (cls === 'rv') { c = word[i]; k = 'rv'; }
      else if (cls === 'ok') { c = word[i]; k = 'ok'; }
      else if (cls === 'bad') { k = 'bad'; }
      else if (!c && i === 0 && hintFirst) { c = word[0]; k = 'hint'; }
      else if (i === typed.length) k = 'cur';
      out += '<span class="' + k + '">' + c + '</span>';
    }
    return '<input id="prIn" class="pr_in sr" readonly inputmode="none" aria-label="在这里拼出这个单词" value="' + typed + '"><div class="slots' + (cls ? ' lock' : '') + '" id="bSlots" aria-hidden="true">' + out + '</div>';
  }
  function prompt(kick, zh) { return '<div class="prompt" id="bPrompt"><div class="kick">' + kick + '</div><div class="zh pr_cn">' + zh + '</div></div>'; }
  function promptTts(kick) { return '<div class="prompt" id="bPrompt"><div class="kick">' + kick + '</div><button class="spk2" id="prSpk" aria-label="再听一次">' + img('icons/speaker_3d.webp') + '</button><button class="btn btn-brand again">🔁 再听一次</button></div>'; }
  function reveal(o) {
    return '<div class="reveal2 ' + (o.good ? 'good' : '') + '" id="bReveal" role="status"><div class="rmsg">' + o.msg + '</div><span class="sr">正确答案 〔' + o.en + ' ' + o.zh + '〕</span><span class="en">' + o.en + '</span><span class="zh2">' + o.zh + '</span><span class="say">' + SVG.speaker + '正在读</span></div>';
  }
  function block(o) {
    return '<main class="block">' + (o.ill ? (o.ill.indexOf('.') > 0 ? img(o.ill, 'ill') : '<div class="ill em" aria-hidden="true">' + o.ill + '</div>') : '')
      + '<h2>' + o.t + '</h2><p class="why">' + o.why + '</p>'
      + (o.hint ? '<div class="hint"><span aria-hidden="true">💡</span><span>' + o.hint + '</span></div>' : '')
      + (o.retry ? '<div class="retrying"><span class="bar"><i></i></span>' + o.retry + '</div>' : '')
      + '<div class="acts">' + (o.cta ? '<button class="btn btn-gold btn-xl" id="' + (o.ctaId || 'bCta') + '">' + o.cta + '</button>' : '')
      + (o.alt ? '<button class="btn-text dim" id="' + (o.altId || 'bAlt') + '">' + o.alt + '</button>' : '') + '</div>'
      + (o.tech ? '<details class="tech"' + (o.techOpen ? ' open' : '') + '><summary>给老师看的信息 ›</summary><pre>' + o.tech + '</pre></details>' : '')
      + '</main>';
  }
  function counter(start, fmt) { return '<span class="live-count" data-start="' + start + '" data-fmt="' + (fmt || 's') + '">' + fmtT(start, fmt) + '</span>'; }
  function fmtT(v, f) { if (f === 'mmss') { var m = Math.floor(v / 60), s = v % 60; return m + ':' + (s < 10 ? '0' : '') + s; } return String(v); }
  function ring(frac) { var C = 2 * Math.PI * 106; return '<svg class="ring" viewBox="0 0 220 220" aria-hidden="true"><circle class="trk" cx="110" cy="110" r="106"/><circle class="val" id="bRing" cx="110" cy="110" r="106" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - frac)).toFixed(1) + '" data-c="' + C.toFixed(1) + '"/></svg>'; }
  function sheet(inner) { return '<div class="scrim" aria-hidden="true"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + inner + '</div>'; }
  function wchips(list) { return '<div class="chipsw">' + list.map(function (w) { return '<button class="wchip ' + (w[2] ? 'ok' : 'no') + '" aria-label="再听 ' + w[0] + '">' + (w[2] ? SVG.check : '') + w[0] + ' <small>' + w[1] + '</small></button>'; }).join('') + '</div>'; }

  /* ------------------------------------------------------------------ 拼写大PK 主页 */
  function hub(o) {
    o = o || {};
    var me = o.out
      ? '<div class="panel me-strip">' + av('01', '', 56) + '<div class="who"><div class="nm">还没登录</div><div class="meta">登录后会给你一个竞赛 ID，同学用它加你</div></div></div>'
        + '<button class="btn btn-gold btn-xl btn-block" id="kReg" style="margin-top:10px">🔑 登录，和同学比一比</button>'
      : '<div class="panel me-strip" id="kMe">' + av('01', 'me', 56) + '<div class="who"><div class="nm">小明</div><div class="meta"><span class="cid">No.007</span> · 竞赛 ID</div></div><span class="tier">🐝 工蜂 <span class="num">1108</span></span></div>';
    return '<div class="bapp">' + head({ back: o.standalone ? '首页' : '返回', id: o.standalone ? 'pkBack' : 'kBack', title: '<span class="k_h1">⚔️ 拼写大PK</span>' })
      + me
      + '<div class="feat" style="margin-top:14px">'
      + '<button class="ft wide t-indigo" id="kLadder">' + img('icons/spelling_bee.webp', 'art') + '<div class="plate"><b>🏆 天梯排位</b><span>' + (o.out ? '赢了升段，越打越强' : '工蜂 · 还差 92 分升段') + '</span></div></button>'
      + '<button class="ft t-orange" id="kRooms">' + img('icons/gameconsole.webp', 'art') + '<div class="plate"><b>🏠 公开房间</b><span>' + (o.out ? '看看谁在等人' : '3 间房在等人') + '</span></div></button>'
      + '<button class="ft t-teal" id="kFriends">' + (o.badge ? '<span class="badge" aria-label="2 条新招呼">2</span>' : '') + img('ui/brain_mail.webp', 'art') + '<div class="plate"><b>👥 好友约战</b><span>' + (o.out ? '和同学一起玩' : '2 个好友在线') + '</span></div></button>'
      + '</div>'
      + (o.out ? '' : '<div class="lbl">我的战绩</div><div class="stats3"><div class="st"><b>6</b><span>赢了几局</span></div><div class="st"><b>🔥3</b><span>连胜</span></div><div class="st"><b>1.9<small style="font-size:15px">秒</small></b><span>最快拼对</span></div></div>')
      + '<div class="panel soft acct" style="margin-top:16px"><span class="t">' + (o.out ? '进度现在只存在这台手机上' : '已登录 · 换手机也能找回进度') + '</span>' + (o.out ? '' : '<button class="btn btn-ghost" id="kAcct">⚙️ 账号</button>') + '</div>'
      + '</div>'
      + (o.toast ? '<div class="toast" role="status">' + av('05', 'op', 40) + '<div class="t">小红：⚔️ 来一局？<small>房间码 45XF · 刚刚</small></div><button class="btn btn-gold">去应战</button></div>' : '')
      + (o.acct ? sheet('<h3>账号</h3><p class="p">已登录 小明 · No.007</p><div class="stack" style="margin-top:14px">'
        + '<button class="btn btn-brand btn-block" id="kPull">☁️ 从云端恢复进度</button>'
        + '<button class="btn btn-ghost btn-block" id="kSwitch">🔄 换个账号</button>'
        + '<button class="btn btn-ghost btn-block" id="kOut">🚪 退出登录</button>'
        + '<button class="btn-text dim" id="kDiag">🩺 云同步自检（给老师看）</button></div>') : '');
  }

  /* ------------------------------------------------------------------ 天梯主页 */
  function board(kind) {
    if (kind === 'loading') return '<div class="panel board" id="ldBoard" aria-busy="true"><div class="cap center" style="padding:10px">正在看大家打得怎么样…</div>'
      + [1, 2, 3, 4].map(function () { return '<div class="br"><span class="skel" style="width:24px"></span><span class="skel" style="flex:1"></span><span class="skel" style="width:44px"></span></div>'; }).join('') + '</div>';
    if (kind === 'empty') return '<div class="panel empty" id="ldBoard">' + img('ui/brain_explorer.webp') + '<b>还没有人上榜</b><p>打满 3 局定级赛就能上榜，<br>你可能就是第一个 🎈</p></div>';
    if (kind === 'error') return '<div class="panel inline-err" id="ldBoard">' + img('ui/brain_alarm.webp') + '<div class="t"><b>暂时看不到排行榜</b><span>可能是网络不太顺</span></div><button class="btn btn-brand">再试一次</button></div>';
    if (kind === 'config') return '<div class="panel inline-err" id="ldBoard">' + img('ui/brain_rest.webp') + '<div class="t"><b>排行榜还没准备好</b><span>云端设置还差一步，老师弄好就能看</span></div></div>';
    var rows = [['🥇', '乐乐', '蜂王', 1652], ['🥈', '阿杰', '守卫蜂', 1480], ['🥉', '甜甜', '守卫蜂', 1455], ['4', '小雨', '侦察蜂', 1260], ['5', '豆豆', '侦察蜂', 1201]];
    return '<div class="panel board" id="ldBoard">' + rows.map(function (r) { return '<div class="br"><span class="rk">' + r[0] + '</span><span class="nm">' + r[1] + '</span><span class="tg">' + r[2] + '</span><span class="sc">' + r[3] + '</span></div>'; }).join('')
      + '<div class="br gap">···</div><div class="br me"><span class="rk">23</span><span class="nm">小明 (你)</span><span class="tg">工蜂</span><span class="sc">1108</span></div></div>';
  }
  function ladder(o) {
    o = o || {};
    var hero = o.unranked
      ? '<div class="panel ladhero"><div class="medal none" aria-hidden="true">🐣</div><div class="info"><div class="tn">还没定级</div><div class="rt">打完 3 局定级赛，就知道你是哪一段</div><div class="slots3" aria-label="定级赛 1 / 3"><span class="won">赢</span><span>2</span><span>3</span></div></div></div>'
      : '<div class="panel ladhero"><div class="medal" aria-hidden="true">🐝</div><div class="info"><div class="tn">工蜂</div><div class="rt"><b>1108</b> 分 · 第 23 名</div><div class="prog" style="--p:.54"><i></i></div><div class="prog-t"><span>还差 <b class="num" style="color:var(--hi)">92</b> 分 → 🔍 侦察蜂</span><span>约赢 5 局</span></div></div></div>';
    return '<div class="bapp">' + head({ title: '🏆 天梯排位', id: 'ldX' })
      + hero
      + '<button class="btn btn-gold btn-xl btn-block btn-col" id="ldGo" style="margin-top:14px">⚡ 开始排位<span class="sub">找和你差不多厉害的人</span></button>'
      + '<p class="cap center" style="margin-top:8px">排位都是「⚡ 抢答赛」：谁先拼对谁得分</p>'
      + '<div class="lbl">🏅 排行榜 <small>每天更新</small></div>' + board(o.board || 'ranked')
      + (o.unranked ? '' : '<div class="lbl">我的战绩</div><div class="stats3"><div class="st"><b>12</b><span>赢了几局</span></div><div class="st"><b>🔥3</b><span>连胜</span></div><div class="st"><b>0.7<small style="font-size:15px">秒</small></b><span>最快拼对</span></div></div>'
        + '<details class="fold panel" style="margin-top:12px;padding:0"><summary class="hist" style="min-height:56px"><span class="t">最近对局<small>最近 5 局：赢 3 · 输 2</small></span><span class="d" aria-hidden="true">›</span></summary></details>'
        + '<details class="fold panel" style="margin-top:10px;padding:0"><summary class="hist" style="min-height:56px"><span class="t">📊 详细数据<small>胜率、抢先率、平均用时…给老师和家长看</small></span><span class="d" aria-hidden="true">›</span></summary></details>')
      + '</div>';
  }

  /* ------------------------------------------------------------------ 匹配 */
  function matching(o) {
    var ph = o.ph;
    var phase = '<div class="phase" aria-label="进度"><span class="' + (ph > 1 ? 'done' : 'on') + '">① 找对手</span><span class="' + (ph === 2 ? 'on' : ph > 2 ? 'done' : '') + '">② 开房等人</span><span class="' + (ph === 3 ? 'on' : '') + '">③ 开打</span></div>';
    if (ph === 3) {
      return '<div class="bapp">' + head({ back: false, title: '对手来了！' })
        + '<main class="grow" style="display:flex;flex-direction:column;justify-content:center">'
        + '<div class="seats" id="ldFound"><div class="seat">' + av(ME.av, 'me') + '<div class="nm">你</div><div class="tg">🐝 工蜂 · 1108</div></div><span class="vsb">VS</span>'
        + '<div class="seat">' + av(OP.av, 'op') + '<div class="nm">' + OP.n + '</div><div class="tg">🐝 工蜂 · 1120</div></div></div>'
        + '<div class="count3 num" aria-live="assertive">3</div><p class="p center">准备好，第一个词马上来</p>' + phase + '</main></div>';
    }
    var host = ph === 2;
    return '<div class="bapp">' + head({ back: '不找了', id: 'ldCancel', title: '🏆 天梯排位' })
      + '<main class="grow center" id="ldMatch">'
      + '<div class="radar">' + '<div class="rg"></div><div class="rg r2"></div><div class="rg r3"></div>' + ring(host ? 0.28 : 7 / 20) + av(ME.av, 'me')
      + '<span class="peek" style="left:6px;top:46px">?</span><span class="peek" style="right:2px;top:118px">?</span></div>'
      + '<h2 class="h-l" style="margin-top:12px">' + (host ? '已经帮你开好房，等对手进来…' : '正在找对手…') + '</h2>'
      + '<div class="bigcount num" style="margin-top:8px" aria-live="off"><small>已等</small> ' + counter(host ? 34 : 7) + '<small>秒</small></div>'
      + '<p class="cap" style="margin-top:6px" id="ldWhy">' + (host ? '还会再等 ' + counter(106, 'mmss') + '，有人进来就立刻开打' : '最多找 20 秒，没人就帮你开好房等别人') + '</p>'
      + phase
      + '<div class="tip">' + img('icons/speed_3d.webp') + '<span>小贴士：抢答赛里，谁先拼对谁拿 100 分。手快不如拼对！</span></div>'
      + '</main></div>';
  }

  /* ------------------------------------------------------------------ 大厅 */
  function room(av_, nm, tag, mode, lv, gold) {
    return '<div class="panel room">' + av(av_, 'op') + '<div class="t"><div class="nmrow"><span class="nm">' + nm + '</span>' + tag + '</div><div class="mt"><span class="m">' + mode + '</span><span class="lv">' + lv + '</span></div></div>'
      + '<button class="btn ' + (gold ? 'btn-gold' : 'btn-brand') + ' go" data-rid="r">开打 ›</button></div>';
  }
  function lobby(o) {
    o = o || {};
    var list;
    if (o.k === 'empty') list = '<div class="panel empty">' + img('ui/brain_explorer.webp') + '<b>现在还没有人开房</b><p>点上面的「➕ 开一间」，<br>等同学来和你打</p></div>';
    else if (o.k === 'error') list = '<div class="panel inline-err">' + img('ui/brain_alarm.webp') + '<div class="t"><b>看不到房间列表</b><span>网络不太顺，连上再试</span></div><button class="btn btn-brand" id="prRetry">再试一次</button></div>';
    else if (o.k === 'loading') list = '<div class="rooms" aria-busy="true">' + [1, 2, 3].map(function () { return '<div class="panel room"><div class="av empty">?</div><div class="t"><div class="skel" style="width:60%"></div><div class="skel" style="width:85%;margin-top:10px"></div></div></div>'; }).join('') + '</div><p class="upd">正在找房间…</p>';
    else list = '<div class="rooms" id="prList">'
      + room('12', '阿杰', '<span class="vs-tag same">和你差不多</span>', '⚡ 抢答赛', '工蜂 · 5 个词', true)
      + room('20', '甜甜同学今天也要赢', '<span class="vs-tag strong">比你强 💪</span>', '🔥 同步赛', '守卫蜂 · 10 个词')
      + room('33', '豆豆', '<span class="vs-tag new">新手</span>', '🎯 回合赛', '未定级 · 5 个词')
      + '</div><p class="upd">刚刚更新 · 每 5 秒自动刷新</p>';
    return '<div class="bapp">' + head({ title: '🏠 公开房间', slot: o.k === 'error' ? '' : '<span class="live"><i></i>' + (o.k === 'empty' ? '0' : o.k === 'loading' ? '…' : '3') + ' 间</span>' })
      + '<div class="hero2">'
      + (o.k === 'error' ? '<button class="btn btn-gold" id="prNew" disabled>➕ 开一间<span class="sub">连上网才能开</span></button>' : '<button class="btn btn-gold" id="prNew">➕ 开一间<span class="sub">自己当房主</span></button>')
      + '<button class="btn btn-brand" id="prCodeOpen">🔑 输入房间码<span class="sub">朋友给的码</span></button></div>'
      + '<div class="lbl">正在等人的房间</div>' + list + '</div>'
      + (o.code ? sheet('<h3>输入房间码</h3><p class="p">朋友给你的 4 位码，字母数字都行</p>'
        + '<div class="code in" role="textbox" aria-label="房间码" id="prCode"><span' + (o.code === 'err' ? ' class="bad"' : '') + '>4</span><span' + (o.code === 'err' ? ' class="bad"' : '') + '>5</span><span class="' + (o.code === 'err' ? 'bad' : 'cur') + '">' + (o.code === 'err' ? 'X' : '') + '</span><span' + (o.code === 'err' ? ' class="bad"' : '') + '>' + (o.code === 'err' ? 'F' : '') + '</span></div>'
        + (o.code === 'err' ? '<div class="field-err" role="alert">😕 没找到这间房 —— 码可能过期了，让朋友再发一次</div>' : '<p class="cap center" style="margin-top:10px">还差 2 位</p>')
        + '<button class="btn btn-gold btn-xl btn-block" id="prJoinCode" style="margin-top:14px">进房</button><div class="center"><button class="btn-text dim">先不进了</button></div>') : '');
  }

  /* ------------------------------------------------------------------ 选玩法 */
  function chooser(o) {
    o = o || {};
    var ask = o.ask || 'zh', m = o.m || 'C', who = o.who || 'pub';
    function ch(on, e, b, s, id, extra) { return '<button class="ch' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" id="' + id + '"><span class="e" aria-hidden="true">' + e + '</span><span class="t"><b>' + b + (extra || '') + '</b><span>' + s + '</span></span><span class="ck">' + SVG.check + '</span></button>'; }
    var names = { A: '⚡ 抢答赛', B: '🎯 回合赛', C: '🔥 同步赛' };
    return '<div class="bapp">' + head({ title: '开一间房', id: 'prBack' })
      + '<div class="step"><i>1</i>怎么出题</div><div class="choices two" role="radiogroup">'
      + ch(ask === 'zh', img('icons/spell_3d.webp'), '看中文', '看着中文拼', 'prAskZh') + ch(ask === 'tts', img('icons/speaker_3d.webp'), '听发音', '听读音来拼', 'prAskTts') + '</div>'
      + '<div class="step"><i>2</i>玩法</div><div class="choices" role="radiogroup">'
      + ch(m === 'A', '⚡', '抢答赛', '谁先拼对谁得分 · 每词 20 秒', 'prModeA', ' <span class="tag pill pill-gold">⭐ 计天梯</span>')
      + ch(m === 'B', '🎯', '回合赛', '各拼各的，两人都拼完再下一个', 'prModeB')
      + ch(m === 'C', '🔥', '同步赛', '拼对就有分，先拼对拿得多', 'prModeC', ' <span class="tag pill pill-good">推荐</span>') + '</div>'
      + '<div class="rulelink"><button class="btn-text" id="prRules">ⓘ 看看三种玩法的规则</button></div>'
      + '<div class="step"><i>3</i>谁能进</div><div class="choices two" role="radiogroup">'
      + ch(who === 'pub', '🌍', '大家都能进', '出现在公开列表', 'prPub') + ch(who === 'pri', '🔒', '只给好友', '发房间码给好友', 'prPri') + '</div>'
      + '<div class="dockcta"><button class="btn btn-gold btn-xl btn-block btn-col" id="prCreate">开房！<span class="sub">' + names[m] + ' · ' + (ask === 'zh' ? '看中文' : '听发音') + ' · 10 个词</span></button></div>'
      + '</div>'
      + (o.rules ? sheet('<h3>三种玩法怎么算分</h3><ul class="sheet-rules" style="margin-top:8px">'
        + '<li><b>⚡ 抢答赛</b>：同一个词一起拼，<b>先拼对的拿 100 分</b>，另一个人这词 0 分。有人拼对就马上下一个词。只有它计天梯分。</li>'
        + '<li><b>🎯 回合赛</b>：每词 15 秒，<b>先拼对 100 分，后拼对 80 分</b>。两个人都拼完（或时间到）才下一个词。</li>'
        + '<li><b>🔥 同步赛</b>：每词 15 秒，<b>先拼对 100 分，后拼对 60 分</b>，没拼对 0 分。两个人都拼完（或时间到）才下一个词。</li></ul>'
        + '<button class="btn btn-gold btn-block" style="margin-top:16px">知道了</button>') : '');
  }

  /* ------------------------------------------------------------------ 等对手 */
  function waiting(o) {
    o = o || {};
    var friend = o.friend;
    var seat2 = friend ? '<div class="seat">' + av(OP.av, 'op off') + '<div class="nm">' + OP.n + '</div><div class="tg">已邀请，等她进来</div></div>'
      : '<div class="seat"><div class="av empty">?</div><div class="nm">等对手</div><div class="tg">谁会来呢？</div></div>';
    var code = o.pri ? '<div class="panel" style="margin-top:16px;text-align:center"><div class="cap">把房间码发给好友</div><div class="code" id="prCodeBig" aria-label="房间码 4 5 X F"><span>4</span><span>5</span><span>X</span><span>F</span></div>'
      + (o.copied ? '<div class="copied" role="status">✅ 已复制！去微信粘贴给好友</div><p class="cap" style="margin-top:6px">复制不了？长按上面的码也行</p>' : '')
      + '<div class="row" style="margin-top:12px"><button class="btn btn-gold" id="prCopy">📋 复制邀请</button><button class="btn btn-brand" id="prSendFr">👥 发给好友</button></div></div>' : '';
    return '<div class="bapp">' + head({ back: '不等了', id: 'prBack', title: '等对手进来' })
      + '<div class="center"><span class="pill pill-gold" style="font-size:14px;padding:6px 12px">' + (o.pri ? '🔒 私密房 · ' : friend ? '👥 已邀请 ' + OP.n + ' · ' : '') + '🔥 同步赛 · 看中文 · 10 个词</span></div>'
      + '<div class="seats" id="prSeats">' + '<div class="seat">' + av(ME.av, 'me') + '<div class="nm">你</div><div class="tg">🐝 工蜂 · 房主</div></div><span class="vsb">VS</span>' + seat2 + '</div>'
      + '<div class="center" style="margin-top:14px"><div class="bigcount num" style="font-size:36px"><small>还会等你</small> ' + counter(102, 'mmss') + '</div>'
      + '<p class="cap" style="margin-top:6px">已等 ' + counter(18) + ' 秒 · ' + (friend ? OP.n + '点开邀请就自动开打' : '有人进来就自动开打') + '</p></div>'
      + code
      + (!o.pri && !friend ? '<div class="panel soft" style="margin-top:16px;display:flex;align-items:center;gap:12px">' + img('ui/brain_mail.webp', '', '') .replace('<img', '<img style="width:48px;height:48px"') + '<div style="flex:1" class="cap">没人来？叫个好友，他一点就能进你的房间</div><button class="btn btn-brand" id="prInvite">👥 叫好友</button></div>' : '')
      + (o.pri ? '<p class="cap center" style="margin-top:12px">私密房不在公开列表里，拿到码的人才能进</p>' : '')
      + '</div>'
      + (o.leave ? sheet('<h3>不等了吗？</h3><p class="p">房间会关掉，别人就进不来了。</p><div class="row" style="margin-top:16px"><button class="btn btn-ghost">不等了</button><button class="btn btn-gold">再等等</button></div>') : '');
  }

  /* ------------------------------------------------------------------ 进房（等房主确认） */
  function joining(o) {
    o = o || {};
    return '<div class="bapp">' + head({ back: false, title: '正在进房' })
      + '<main class="grow" style="display:flex;flex-direction:column;justify-content:center;text-align:center">'
      + '<div class="seats"><div class="seat">' + av(OP.av, 'op') + '<div class="nm">' + OP.n + '</div><div class="tg">房主</div></div><span class="vsb">VS</span><div class="seat">' + av(ME.av, 'me') + '<div class="nm">你</div><div class="tg">🐝 工蜂</div></div></div>'
      + '<h2 class="h-l" style="margin-top:18px">正在进房，等房主确认…</h2>'
      + '<p class="cap" style="margin-top:6px">已等 ' + counter(o.slow ? 9 : 2) + ' 秒 · 房主那边点头就开打</p>'
      + (o.slow ? '<div class="notice warn" style="margin:14px auto 0;max-width:340px"><span class="ic" aria-hidden="true">🐢</span>房主那边有点慢，可以再等等，也可以换一间房</div>' : '')
      + '<div class="acts" style="margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:6px">'
      + (o.slow ? '<button class="btn btn-brand" id="prJoinOther" style="min-width:220px">换一间房</button>' : '')
      + '<button class="btn btn-ghost" id="prJoinCancel" style="min-width:220px">取消</button></div></main></div>';
  }

  /* ------------------------------------------------------------------ 对战回合 */
  var KICK = { A: '⚡ 抢答赛 · 看中文', B: '🎯 回合赛 · 看中文', C: '🔥 同步赛 · 看中文' };
  function battle(o) {
    var mode = o.mode || 'A', secs = mode === 'A' ? 20 : 15;
    var t = o.t != null ? o.t : 14, tcls = o.tcls || (t <= 5 ? 'hot' : '');
    var body = '';
    body += vsbar(o.vs || { my: 200, op: 100 });
    if (o.notice) body += o.notice;
    body += '<div class="play">';
    body += o.tts ? promptTts('🔊 ' + (KICK[mode].split(' · ')[0]) + ' · 听发音') : prompt(KICK[mode], o.zh || '苹果');
    body += slots(o.word || 'apple', o.typed != null ? o.typed : 'ap', o.slotCls, o.hint !== false);
    if (o.reveal) body += reveal(o.reveal);
    else if (o.fb) body += o.fb;
    else body += '<div class="feedback" id="prHint" aria-live="polite"></div>';
    body += '</div>';
    return '<div class="bapp dock bt">' + tbar(o.no || 3, 10, o.dots || 'wwlcxxxxxx', timer(t, (t / secs).toFixed(2), tcls)) + body + kb(o.kbOff) + '</div>'
      + (o.quit ? sheet('<h3>现在退出就算输哦</h3><p class="p">这一局会记成输，天梯分也会扣。</p><div class="row" style="margin-top:16px"><button class="btn btn-ghost" id="bQuitYes">退出</button><button class="btn btn-gold" id="bQuitNo">接着打</button></div>') : '');
  }
  function notice(cls, ic, html, cd) { return '<div class="notice ' + cls + '" role="status"><span class="ic" aria-hidden="true">' + ic + '</span><span class="tx">' + html + '</span>' + (cd != null ? '<b class="cd num">' + cd + ' 秒</b>' : '') + '</div>'; }

  /* ------------------------------------------------------------------ 交卷后 */
  function submitted() {
    return '<div class="bapp bt">' + tbar(10, 10, 'wwlwwlwwwc', timer('–', 0, 'frozen'))
      + vsbar({ my: 700, op: 400, mySt: st('ok', '✅ 答完了'), opSt: st('', '✍️ 最后一个词') })
      + '<div class="panel wait-card" id="prWaitResult">' + img('ui/brain_explorer.webp', '', '').replace('<img', '<img style="width:88px;height:88px"')
      + '<h2 class="h-l" style="margin-top:6px">你答完了！</h2><p class="p" style="margin-top:4px">正在等对手交卷… ' + OP.n + ' 还在拼最后一个词</p>'
      + '<div class="bigcount num" style="margin-top:10px"><small>已等</small> ' + counter(12) + '<small>秒</small></div>'
      + '<p class="cap" style="margin-top:4px">最多等 45 秒，她不交卷就按规则算</p></div>'
      + '<div class="stack" style="margin-top:14px"><button class="btn btn-brand btn-block" id="prMine">先看我的成绩</button><button class="btn-text dim" id="prGiveUp">不等了，回房间列表</button></div></div>';
  }

  /* ------------------------------------------------------------------ 结算 */
  function result(o) {
    var words = [['apple', '苹果', 1], ['banana', '香蕉', 1], ['orange', '橙子', 0], ['grape', '葡萄', 1], ['pear', '梨', 1], ['peach', '桃子', 1], ['lemon', '柠檬', 0], ['melon', '瓜', 1], ['cherry', '樱桃', 1], ['mango', '芒果', 1]];
    var hero = { win: ['ui/brain_champion.webp', '你赢了！', '快了 0.4 秒，太厉害了'], lose: ['ui/brain_rest.webp', '差一点点！', '你拼对了 6 个词，最快 0.9 秒'], draw: ['ui/brain_explorer.webp', '打平啦！', '两个人一样厉害 🤝'], forfeit: ['ui/brain_champion.webp', '🏆 对手已离场，本局你胜', OP.n + ' 一直没交卷，按规则算你赢'] }[o.k];
    var my = { win: 700, lose: 500, draw: 600, forfeit: 700 }[o.k], op = { win: 400, lose: 600, draw: 600, forfeit: 300 }[o.k];
    var reward = o.ranked
      ? (o.k === 'lose'
        ? '<div class="panel reward"><span class="delta down num">-13</span><div class="t"><b>天梯分 1095</b><span>🛡 段位保护：再输 2 局也不会掉段</span></div></div>'
        : '<div class="panel reward"><span class="delta up num">+20</span><div class="t"><b>天梯分 1128 · 🐝 工蜂</b><span>还差 72 分 → 🔍 侦察蜂 · 约赢 4 局</span><div class="prog" style="--p:.64"><i></i></div></div></div>')
      : '<div class="panel reward"><span class="delta zero num">±0</span><div class="t"><b>本局不计天梯</b><span>只有 ⚡ 抢答赛计分 · 总战绩 6 胜 1 平 3 负</span></div></div>';
    var acts = o.ranked
      ? '<div class="row" style="margin-top:14px"><button class="btn btn-gold btn-xl" id="prAgain">⚡ 再来一局</button></div><div class="center"><button class="btn-text" id="prHome">回到岛屿 ›</button></div>'
      : '<div class="row" style="margin-top:14px"><button class="btn btn-gold" id="prAgain">和 ' + OP.n + ' 再来</button><button class="btn btn-brand" id="prBack2">回房间列表</button></div><div class="center"><button class="btn-text" id="prHome">回到岛屿 ›</button></div>';
    return '<div class="bapp">' + head({ title: o.ranked ? '天梯 · 抢答赛' : '🔥 同步赛 · 结果', id: 'prBack' })
      + '<section class="rs-hero" id="prResult">' + img(hero[0], 'rs-ic') + '<div class="ttl">' + hero[1] + '</div><div class="sub">' + hero[2] + '</div></section>'
      + '<div class="panel scorebig" aria-label="比分 你 ' + my + ' 比 ' + op + '">'
      + '<div class="sd' + (my > op ? ' win' : '') + '">' + av(ME.av, 'me') + '<div class="nm">你</div><div class="n" id="rsMy">' + my + '</div>' + (my > op ? '<span class="crown">👑 赢</span>' : '') + '</div>'
      + '<span class="colon">:</span>'
      + '<div class="sd' + (op > my ? ' win' : '') + '">' + av(OP.av, 'op') + '<div class="nm">' + OP.n + '</div><div class="n">' + op + '</div>' + (op > my ? '<span class="crown">👑 赢</span>' : '') + '</div></div>'
      + reward
      + '<div class="best"><div class="st"><b>' + (o.k === 'lose' ? 6 : 8) + '<small style="font-size:15px">/10</small></b><span>拼对</span></div><div class="st"><b>' + (o.k === 'lose' ? 3 : 6) + '</b><span>抢先</span></div><div class="st"><b>0.7<small style="font-size:15px">秒</small></b><span>最快</span></div></div>'
      + '<div class="panel" style="margin-top:10px"><div class="h-m">这一局的词 <small class="cap">点一下再听</small></div>' + wchips(words) + '</div>'
      + acts + '</div>';
  }

  /* ------------------------------------------------------------------ 好友 */
  function frRow(a, nm, sub, on, btn) {
    return '<div class="fr"><div class="avwrap">' + av(a, on ? 'op' : 'off') + '<i class="dot' + (on ? '' : ' away') + '"></i></div><div class="t"><div class="nm">' + nm + '</div><div class="sb">' + sub + '</div></div>' + btn + '</div>';
  }
  function friends(o) {
    o = o || {};
    if (o.out) return '<div class="bapp">' + head({ title: '👥 我的好友', id: 'frX' }) + block({ ill: 'ui/brain_mail.webp', t: '先登录才能加好友', why: '好友靠「竞赛 ID」互相加，<br>竞赛 ID 是登录时自动给你的。', cta: '🔑 去登录', ctaId: 'frGoLogin', alt: '先不了' }) + '</div>';
    var list = o.empty
      ? '<div class="panel empty">' + img('ui/brain_mail.webp') + '<b>还没有好友</b><p>让同学告诉你他的竞赛 ID，<br>点下面的「加好友」输进去</p></div>'
      : '<div class="panel" style="padding:0" id="frList">'
        + frRow('05', '小红', '🟢 在线 · 🐝 工蜂', true, '<button class="btn btn-gold">⚔️ 约战</button>')
        + frRow('12', '阿杰', '🟢 在线 · 🛡️ 守卫蜂', true, '<button class="btn btn-gold">⚔️ 约战</button>')
        + frRow('20', '甜甜', '25 分钟前来过', false, '<button class="more" aria-label="更多">⋯</button>')
        + frRow('33', '豆豆', '⏳ 等他也加你', false, '<button class="more" aria-label="更多">⋯</button>')
        + '</div>';
    var req = o.req ? '<div class="panel req" style="margin-top:4px;display:block"><div style="display:flex;gap:12px;align-items:center">' + av('41', 'op') + '<div class="t"><div class="nm">小刚 想加你为好友</div><div class="sb">No.031 · 🐝 幼蜂</div></div></div><div class="acts"><button class="btn btn-ghost">不加</button><button class="btn btn-gold">加他</button></div></div>' : '';
    var inbox = o.inbox ? '<div class="lbl">收到的招呼 <small>只能发固定的几句话</small></div><div class="panel" style="padding:0" id="frInbox">'
      + '<div class="msg new">' + av('05', 'op', 40) + '<div class="t"><b>小红：⚔️ 来一局？</b><small>刚刚 · 房间码 45XF</small></div><button class="btn btn-gold">去应战</button></div>'
      + '<div class="msg">' + av('12', 'op', 40) + '<div class="t"><b>阿杰：👍 打得好！</b><small>10 分钟前</small></div><button class="btn btn-ghost">回一句</button></div>'
      + '<div class="msg">' + av('20', 'op', 40) + '<div class="t"><b>甜甜：👋 你好呀</b><small>昨天</small></div></div></div>' : '';
    return '<div class="bapp">' + head({ title: '👥 我的好友', id: 'frX' })
      + '<div class="row" style="justify-content:space-between"><button class="btn-text dim" id="frStInfo" style="padding:0 6px">我的状态 ⓘ</button><div class="seg" role="radiogroup" aria-label="我的状态"><button class="on" id="frOn" role="radio" aria-checked="true">🟢 在线</button><button id="frHide" role="radio" aria-checked="false">🌙 隐身</button></div></div>'
      + req + inbox
      + '<div class="lbl">好友 <small>' + (o.empty ? '0' : '2 人在线') + '</small></div>' + list
      + '<div class="panel myid" style="margin-top:14px"><div class="t">你的竞赛 ID<b>No.007</b></div><button class="btn btn-ghost">📋 复制</button><button class="btn btn-brand" id="frAddOpen">＋ 加好友</button></div>'
      + '</div>'
      + (o.add ? sheet('<h3>加好友</h3><p class="p">输入同学的竞赛 ID 数字</p><div style="margin-top:12px"><input class="input focus" id="frCid" inputmode="numeric" value="' + (o.add === 'err' ? '12' : '') + '" placeholder="例如 31" aria-label="同学的竞赛 ID 数字"></div>'
        + (o.add === 'err' ? '<div class="field-err" role="alert">😕 加不上 —— 看看竞赛 ID 对不对</div>' : '<p class="cap center" style="margin-top:8px">竞赛 ID 在「拼写大PK」页面顶部，长这样：No.001</p>')
        + '<button class="btn btn-gold btn-xl btn-block" id="frAdd" style="margin-top:14px">加好友</button>') : '')
      + (o.stinfo ? sheet('<h3>在线和隐身</h3><ul class="sheet-rules" style="margin-top:8px"><li><b>🟢 在线</b>：好友能看到你「刚才还在」。网页不能像 App 那样一直挂着，所以这只表示你最近开着页面。</li><li><b>🌙 隐身</b>：隐身时好友看到的你和「不在线」一模一样，看不出差别。</li></ul><button class="btn btn-gold btn-block" style="margin-top:16px">知道了</button>') : '');
  }
  function friendDetail(o) {
    o = o || {};
    return '<div class="bapp">' + head({ title: OP.n, id: 'frBack', slot: '<button class="back ic" aria-label="更多">⋯</button>' })
      + '<div class="center" style="margin-top:6px"><div class="avwrap" style="display:inline-block">' + av(OP.av, 'op', 104) + '<i class="dot"></i></div><div class="h-l" style="margin-top:10px">' + OP.n + '</div><p class="cap">🟢 在线 · 🐝 工蜂 · 你们打过 5 局（你赢 3）</p></div>'
      + '<button class="btn btn-gold btn-xl btn-block" id="frPk" style="margin-top:16px">⚔️ 约她打一局</button>'
      + '<div class="lbl">打个招呼 <small>只能发这几句，不能打字</small></div><div class="qm">'
      + ['⚔️ 来一局？', '👍 打得好！', '😄 再来！', '👋 你好呀'].map(function (t, i) { return '<button class="btn btn-ghost' + (o.sent && i === 0 ? '" aria-pressed="true" style="border-color:var(--good)' : '') + '">' + t + '</button>'; }).join('') + '</div>'
      + (o.sent ? '<div class="copied" role="status" style="display:flex;justify-content:center">✅ 已发给 ' + OP.n + '：⚔️ 来一局？</div>' : '')
      + '</div>'
      + (o.invite ? sheet('<h3>约 ' + OP.n + ' 打一局</h3><p class="p">开一间只有你们俩能进的房，她会收到邀请</p>'
        + '<div class="choices" style="margin-top:12px"><button class="ch on" role="radio" aria-checked="true"><span class="e">🔥</span><span class="t"><b>同步赛 · 看中文</b><span>拼对就有分 · 10 个词</span></span><span class="ck">' + SVG.check + '</span></button>'
        + '<button class="ch" role="radio" aria-checked="false"><span class="e">⚡</span><span class="t"><b>抢答赛 · 看中文</b><span>谁先拼对谁得分</span></span><span class="ck">' + SVG.check + '</span></button></div>'
        + '<button class="btn btn-gold btn-xl btn-block" style="margin-top:14px">开房并邀请她</button>') : '');
  }

  /* ------------------------------------------------------------------ 状态表 */
  var S = {
    /* 拼写大PK 主页 */
    hub_island: { g: '主页', n: '拼写大PK · 岛内', f: function () { return hub(); } },
    hub_standalone: { g: '主页', n: '拼写大PK · 独立页 spelling_pk.html', f: function () { return hub({ standalone: 1 }); } },
    hub_loggedout: { g: '主页', n: '没登录', f: function () { return hub({ out: 1 }); } },
    hub_account: { g: '主页', n: '账号弹层（云端恢复/换号/退出/自检）', f: function () { return hub({ acct: 1 }); } },
    hub_invite_toast: { g: '主页', n: '收到好友邀请（角标 + 提示条）', f: function () { return hub({ badge: 1, toast: 1 }); } },
    /* 天梯 */
    ld_unranked: { g: '天梯', n: '没定级 · 排行榜正常', f: function () { return ladder({ unranked: 1 }); } },
    ld_ranked: { g: '天梯', n: '已定级 · 排行榜正常', f: function () { return ladder({}); } },
    ld_board_loading: { g: '天梯', n: '排行榜加载中', f: function () { return ladder({ board: 'loading' }); } },
    ld_board_empty: { g: '天梯', n: '排行榜空', f: function () { return ladder({ unranked: 1, board: 'empty' }); } },
    ld_board_error: { g: '天梯', n: '排行榜出错', f: function () { return ladder({ board: 'error' }); } },
    ld_board_config: { g: '天梯', n: '排行榜 · 云端设置还差一步', f: function () { return ladder({ board: 'config' }); } },
    /* 匹配 */
    mt_search: { g: '匹配', n: '找对手（每秒数一下）', f: function () { return matching({ ph: 1 }); } },
    mt_host: { g: '匹配', n: '20 秒后自己开房等人', f: function () { return matching({ ph: 2 }); } },
    mt_found: { g: '匹配', n: '对手来了 · 3-2-1', f: function () { return matching({ ph: 3 }); } },
    mt_timeout: { g: '匹配', n: '等太久没人', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_rest.webp', t: '这会儿人有点少', why: '找了 2 分钟还没遇到对手。<br>过一会儿再来试试吧 🙂', cta: '⚡ 再找一次', ctaId: 'ldReMatch', alt: '回天梯' }) + '</div>'; } },
    /* 错误（按种类，各是各的画面） */
    err_network: { g: '错误', n: 'network · 连不上网络', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_alarm.webp', t: '连不上网络', why: '对战要联网才能找到对手。<br>连上 Wi-Fi 或打开流量，再点一下。', retry: '正在自动重试…', cta: '再试一次', ctaId: 'ldRetry', alt: '先不玩了', tech: 'kind=network\nFailed to fetch · 03:12:45' }) + '</div>'; } },
    err_slow: { g: '错误', n: 'slow · 网络有点慢', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_alarm.webp', t: '网络有点慢', why: '云端回得很慢，可能是信号不好。<br>可以再等等，也可以靠近 Wi-Fi 再试。', retry: '还在等云端回话…', cta: '再试一次', alt: '先不玩了', tech: 'kind=slow\n请求 8.2 秒没回' }) + '</div>'; } },
    err_session: { g: '错误', n: 'session · 云端还没连上', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_rest.webp', t: '云端还没连上', why: '游戏刚打开，云端还在连。<br>等两三秒再点一下就好。', retry: '正在连云端…', cta: '再试一次', alt: '先不玩了', tech: 'kind=session\nensureSession 未完成' }) + '</div>'; } },
    err_expired: { g: '错误', n: 'expired · 云端登录过期了', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_rest.webp', t: '云端登录过期了', why: '太久没登录，云端要再认一下你。<br>重新登录一次就能继续，<b>段位和战绩都还在</b>。', cta: '🔑 重新登录', ctaId: 'prLogin', alt: '先不弄', tech: 'kind=expired\ncredentials expired' }) + '</div>'; } },
    err_config: { g: '错误', n: 'config · 云端设置还差一步', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_mail.webp', t: '云端设置还差一步', why: '这个功能要老师在云端打开一个开关。<br>把下面的信息拍照发给老师就行。', cta: '知道了', alt: '', tech: 'kind=config\n数据库缺少索引 pk_rooms(status,updatedAt)\n版本 1165', techOpen: 1 }) + '</div>'; } },
    err_gone: { g: '错误', n: 'gone · 房间已经不在了', f: function () { return '<div class="bapp">' + head({ title: '🏠 公开房间' }) + block({ ill: 'ui/brain_explorer.webp', t: '房间已经不在了', why: '房主可能已经走了。<br>回列表再挑一间吧。', cta: '回房间列表', ctaId: 'prBack2', alt: '' }) + '</div>'; } },
    err_taken: { g: '错误', n: 'taken · 房间被别人抢走了', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_alarm.webp', t: '这间房刚被别人抢走了', why: '大家都在抢空房，慢一步就没了。<br>再找一次就好。', cta: '⚡ 再找一次', ctaId: 'prReMatch', alt: '回天梯' }) + '</div>'; } },
    err_self: { g: '错误', n: 'self · 同一个账号', f: function () { return '<div class="bapp">' + head({ title: '🏠 公开房间' }) + block({ ill: 'ui/brain_explorer.webp', t: '这是你自己开的房间', why: '自己不能和自己打哦。', hint: '是不是在<b>两台手机（或两个页面）上登了同一个账号</b>？<br>和同学打，要各用各的账号。', cta: '回房间列表', alt: '' }) + '</div>'; } },
    err_loading: { g: '错误', n: '对战模块还在加载', f: function () { return '<div class="bapp">' + head({ title: '⚔️ 拼写大PK' }) + block({ ill: 'ui/brain_rest.webp', t: '还在准备中', why: '对战的部件还在下载，<br>等一两秒再点一次就好。', retry: '正在准备…', cta: '再试一次', alt: '' }) + '</div>'; } },
    /* 登录 / 起名 */
    need_login: { g: '登录', n: '排位要先登录（代替 confirm）', f: function () { return '<div class="bapp">' + head({ title: '🏆 天梯排位' }) + block({ ill: 'ui/brain_mail.webp', t: '先登录，分数才能记住', why: '排位要跟别人比，<br>所以得先有个账号记住你的分数。', cta: '🔑 去登录', ctaId: 'ldLogin', alt: '先不了' }) + '</div>'; } },
    need_name: { g: '登录', n: '起个名字（对手会看到）', f: function () { return hub() + sheet('<h3>给自己起个名字</h3><p class="p">对手会看到这个名字。<br>不要写真名全名哦。</p><div style="margin-top:12px"><input class="input focus" value="小明" aria-label="名字" maxlength="8"></div>'
      + '<div class="chipsw" style="justify-content:center">' + ['拼写小侠', '单词勇士', '快手蜂'].map(function (t) { return '<button class="wchip no" style="font-family:var(--font-body)">' + t + '</button>'; }).join('') + '</div>'
      + '<button class="btn btn-gold btn-xl btn-block" style="margin-top:14px">就叫这个</button>'); } },
    /* 大厅 */
    lb_rooms: { g: '大厅', n: '有房间', f: function () { return lobby({}); } },
    lb_loading: { g: '大厅', n: '加载中', f: function () { return lobby({ k: 'loading' }); } },
    lb_empty: { g: '大厅', n: '没有房间', f: function () { return lobby({ k: 'empty' }); } },
    lb_error: { g: '大厅', n: '列表出错（开房按钮也禁用）', f: function () { return lobby({ k: 'error' }); } },
    lb_code: { g: '大厅', n: '输入房间码', f: function () { return lobby({ code: 'typing' }); } },
    lb_code_err: { g: '大厅', n: '房间码不对', f: function () { return lobby({ code: 'err' }); } },
    /* 选玩法 */
    ch_default: { g: '选玩法', n: '看中文 · 同步赛 · 公开', f: function () { return chooser({}); } },
    ch_tts_A_private: { g: '选玩法', n: '听发音 · 抢答赛 · 只给好友', f: function () { return chooser({ ask: 'tts', m: 'A', who: 'pri' }); } },
    ch_rules: { g: '选玩法', n: '规则弹层', f: function () { return chooser({ rules: 1 }); } },
    /* 等待 */
    wt_public: { g: '等待', n: '公开房等人', f: function () { return waiting({}); } },
    wt_private: { g: '等待', n: '私密房 · 房间码', f: function () { return waiting({ pri: 1 }); } },
    wt_private_copied: { g: '等待', n: '私密房 · 已复制', f: function () { return waiting({ pri: 1, copied: 1 }); } },
    wt_friend: { g: '等待', n: '约好友 · 等她进来', f: function () { return waiting({ friend: 1 }); } },
    wt_leave: { g: '等待', n: '不等了？（确认）', f: function () { return waiting({ leave: 1 }); } },
    wt_timeout: { g: '等待', n: '等了 2 分钟没人', f: function () { return '<div class="bapp">' + head({ title: '等对手进来' }) + block({ ill: 'ui/brain_rest.webp', t: '这会儿没人来', why: '等了 2 分钟还没人进房。<br>可以再等一会儿，或者先去玩别的。', cta: '再等 2 分钟', alt: '回房间列表' }) + '</div>'; } },
    /* 进房 */
    jn_wait: { g: '进房', n: '等房主确认', f: function () { return joining({}); } },
    jn_slow: { g: '进房', n: '房主有点慢', f: function () { return joining({ slow: 1 }); } },
    /* 对战 */
    bt_A_mid: { g: '对战', n: 'A 抢答赛 · 拼到一半', f: function () { return battle({}); } },
    bt_A_opp: { g: '对战', n: 'A · 对手抢先拼对', f: function () { return battle({ t: 9, tcls: 'frozen', vs: { my: 200, op: 200, opPlus: 100, opSt: st('ok', '✅ 拼对了') }, typed: 'app', kbOff: 1, reveal: { msg: OP.n + ' 抢先拼对了！', en: 'apple', zh: '苹果' }, slotCls: 'rv' }); } },
    bt_A_mine: { g: '对战', n: 'A · 我抢先拼对', f: function () { return battle({ t: 11, tcls: 'frozen', vs: { my: 300, op: 100, myPlus: 100, lead: 'me', mySt: st('ok', '✅ 0.7 秒') }, slotCls: 'ok', kbOff: 1, reveal: { good: 1, msg: '🔥 你抢先拼对！+100 · 0.7 秒', en: 'apple', zh: '苹果' } }); } },
    bt_wrong: { g: '对战', n: '拼错了（还能改）', f: function () { return battle({ t: 12, typed: 'appel', slotCls: 'bad', fb: '<div class="feedback bad" id="prHint" role="alert">不对，再试试 · 删掉改一改</div>' }); } },
    bt_timeout: { g: '对战', n: '时间到 · 看答案', f: function () { return battle({ t: 0, tcls: 'frozen', vs: { my: 200, op: 100, mySt: st('miss', '⏱ 没拼完'), opSt: st('miss', '⏱ 没拼完') }, slotCls: 'rv', kbOff: 1, reveal: { msg: '时间到！正确答案是', en: 'apple', zh: '苹果' } }); } },
    bt_last5: { g: '对战', n: '最后 5 秒', f: function () { return battle({ t: 4, typed: 'appl' }); } },
    bt_B_waitopp: { g: '对战', n: 'B 回合赛 · 我拼对了，等对手', f: function () { return battle({ mode: 'B', t: 9, vs: { my: 300, op: 180, myPlus: 100, mySt: st('ok', '✅ 拼对了'), lead: 'me' }, slotCls: 'ok', kbOff: 1, notice: notice('good', '✅', '你拼对了 +100！等 ' + OP.n + ' 拼完', 9) }); } },
    bt_B_opp: { g: '对战', n: 'B · 对手先拼对，我还能拿 80', f: function () { return battle({ mode: 'B', t: 9, vs: { my: 180, op: 300, opPlus: 100, opSt: st('ok', '✅ 拼对了'), lead: 'op' }, typed: 'ap', notice: notice('', '⏳', OP.n + ' 拼对了！<span style="white-space:nowrap">你拼对还能拿 <b class="num">80</b> 分</span>', 9) }); } },
    bt_C_opp: { g: '对战', n: 'C 同步赛 · 对手先拼对，我还能拿 60', f: function () { return battle({ mode: 'C', t: 7, vs: { my: 160, op: 300, opPlus: 100, opSt: st('ok', '✅ 拼对了'), lead: 'op' }, typed: 'app', notice: notice('', '⏳', OP.n + ' 先拼对了！<span style="white-space:nowrap">你拼对还能拿 <b class="num">60</b> 分</span>', 7) }); } },
    bt_C_waitopp: { g: '对战', n: 'C · 我也拼对了，等时间到/对手', f: function () { return battle({ mode: 'C', t: 6, vs: { my: 220, op: 300, myPlus: 60, mySt: st('ok', '✅ +60'), lead: 'op' }, slotCls: 'ok', kbOff: 1, notice: notice('good', '✅', '你也拼对了 +60！等 ' + OP.n + ' 拼完', 6) }); } },
    bt_tts: { g: '对战', n: '听发音出题', f: function () { return battle({ tts: 1, typed: 'a', hint: false }); } },
    bt_net: { g: '对战', n: '网络不稳（提示在 VS 条下面）', f: function () { return battle({ notice: notice('warn', '📶', '网络有点慢，正在重连…别关页面').replace('class="notice', 'id="prNetWarn" class="notice') }); } },
    bt_idle: { g: '对战', n: '对手没动静（倒数）', f: function () { return battle({ vs: { my: 200, op: 100, opOff: 1, opSt: st('idle', '💤 没动静') }, notice: notice('warn', '💤', OP.n + ' 掉线了…不回来就算你赢', 26) }); } },
    bt_quit: { g: '对战', n: '点 × 退出（确认）', f: function () { return battle({ quit: 1 }); } },
    bt_longname: { g: '对战', n: '对手名字很长（320 宽检查）', f: function () { OP.n = '王小红同学的超长名字'; return battle({ vs: { my: 1200, op: 1100 } }); } },
    /* 交卷后 */
    sub_wait: { g: '交卷', n: '我交卷了，等对手（有出口）', f: submitted },
    /* 结算 */
    rs_win: { g: '结算', n: '赢 · 天梯（+分）', f: function () { return result({ k: 'win', ranked: 1 }); } },
    rs_lose: { g: '结算', n: '输 · 天梯（段位保护）', f: function () { return result({ k: 'lose', ranked: 1 }); } },
    rs_draw: { g: '结算', n: '平 · 房间赛（不计分）', f: function () { return result({ k: 'draw' }); } },
    rs_forfeit: { g: '结算', n: '对手没交卷 · 算你赢', f: function () { return result({ k: 'forfeit', ranked: 1 }); } },
    /* 好友 */
    fr_list: { g: '好友', n: '好友列表', f: function () { return friends({}); } },
    fr_empty: { g: '好友', n: '还没好友', f: function () { return friends({ empty: 1 }); } },
    fr_add: { g: '好友', n: '加好友（弹层）', f: function () { return friends({ add: 'typing' }); } },
    fr_add_err: { g: '好友', n: '加好友出错', f: function () { return friends({ add: 'err' }); } },
    fr_request: { g: '好友', n: '有人想加我', f: function () { return friends({ req: 1 }); } },
    fr_inbox: { g: '好友', n: '收到的招呼', f: function () { return friends({ inbox: 1 }); } },
    fr_detail: { g: '好友', n: '好友详情 · 快捷招呼已发', f: function () { return friendDetail({ sent: 1 }); } },
    fr_invite: { g: '好友', n: '约战 · 开私密房邀请', f: function () { return friendDetail({ invite: 1 }); } },
    fr_status: { g: '好友', n: '在线/隐身说明（ⓘ）', f: function () { return friends({ stinfo: 1 }); } },
    fr_loggedout: { g: '好友', n: '没登录', f: function () { return friends({ out: 1 }); } }
  };
  window.SCREENS = S;

  /* ------------------------------------------------------------------ 渲染 + 每秒一次的数字 */
  function render() {
    var k = P.get('s'); var host = document.getElementById('root');
    if (!host) return;
    if (!k || !S[k]) { host.innerHTML = '<div class="bapp"><h1 class="h-l" style="margin:20px 0">没有这个状态</h1></div>'; return; }
    document.title = S[k].n + ' · 对战 2.0 样稿';
    host.innerHTML = S[k].f();
    if (P.get('freeze') === '1') return;
    var t0 = Date.now(), nodes = [].slice.call(document.querySelectorAll('.live-count')), ringEl = document.getElementById('bRing');
    if (!nodes.length) return;
    /* 只改文字节点，不重建 DOM，不抢焦点；每秒一次，没有任何连续动画 */
    setInterval(function () {
      var d = Math.floor((Date.now() - t0) / 1000);
      nodes.forEach(function (n) {
        var s = +n.getAttribute('data-start'), f = n.getAttribute('data-fmt');
        var v = f === 'mmss' ? Math.max(0, s - d) : s + d;
        var txt = fmtT(v, f); if (n.textContent !== txt) n.textContent = txt;
      });
      if (ringEl && k === 'mt_search') { var c = +ringEl.getAttribute('data-c'); ringEl.setAttribute('stroke-dashoffset', (c * (1 - Math.min(1, (7 + d) / 20))).toFixed(1)); }
    }, 1000);
  }
  window.renderScreen = render;
})();
