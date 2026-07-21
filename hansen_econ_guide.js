// 单词大冒险 v946 HF6：设置页四份纯中文速查。
// 玩家只需要看“做什么、得多少、有什么限制”；内部账本与历史兼容不在这里展示。
(function () {
  'use strict';

  var CSS_ID = 'hsnEconGuideCss';
  var BOX_ID = 'hsnEconGuide';

  function removeLegacyGuide() {
    var legacyId = ['hsn', 'CoinGuide'].join('');
    var old = document.getElementById(legacyId);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = ''
      + '#' + BOX_ID + '{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif}'
      + '.hsn-eg-card{margin-top:12px;overflow:hidden}'
      + '.hsn-eg-toggle{display:flex;width:100%;align-items:center;gap:10px;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}'
      + '.hsn-eg-toggle:focus-visible{outline:3px solid #60a5fa;outline-offset:5px;border-radius:8px}'
      + '.hsn-eg-icon{font-size:22px;line-height:1;flex:0 0 auto}'
      + '.hsn-eg-headtext{min-width:0;flex:1}'
      + '.hsn-eg-title{display:block;font-size:17px;font-weight:900;line-height:1.35;color:var(--pal-ink,#f8fafc)}'
      + '.hsn-eg-sub{display:block;margin-top:2px;font-size:12.5px;font-weight:700;line-height:1.5;color:var(--pal-ink-3,#94a3b8)}'
      + '.hsn-eg-arrow{flex:0 0 auto;font-size:13px;color:var(--pal-ink-3,#94a3b8);transition:transform .18s ease}'
      + '.hsn-eg-card.open .hsn-eg-arrow{transform:rotate(90deg)}'
      + '.hsn-eg-panel[hidden]{display:none!important}'
      + '.hsn-eg-panel{margin-top:12px;color:var(--pal-ink-2,#e2e8f0)}'
      + '.hsn-eg-key{margin:0 0 9px;padding:10px 12px;border-radius:11px;background:rgba(37,99,235,.16);border:1px solid rgba(96,165,250,.38);font-size:14px;font-weight:850;line-height:1.55;color:var(--pal-ink,#f8fafc)}'
      + '.hsn-eg-row{display:grid;grid-template-columns:minmax(88px,.72fr) minmax(132px,1.28fr);gap:3px 10px;align-items:center;padding:10px 2px;border-bottom:1px solid rgba(148,163,184,.24)}'
      + '.hsn-eg-row:last-child{border-bottom:0}'
      + '.hsn-eg-do{font-size:14px;font-weight:900;line-height:1.45;color:var(--pal-ink,#f8fafc)}'
      + '.hsn-eg-get{font-size:14px;font-weight:900;line-height:1.45;color:#fbbf24}'
      + '.hsn-eg-tip{grid-column:2;font-size:12.5px;font-weight:650;line-height:1.5;color:var(--pal-ink-3,#94a3b8)}'
      + 'html.hsn-pal-light .hsn-eg-title,html.hsn-pal-light .hsn-eg-key,html.hsn-pal-light .hsn-eg-do{color:#172033}'
      + 'html.hsn-pal-light .hsn-eg-sub,html.hsn-pal-light .hsn-eg-tip,html.hsn-pal-light .hsn-eg-arrow{color:#475569}'
      + 'html.hsn-pal-light .hsn-eg-get{color:var(--pal-accent-text,#1e40af)}'
      + 'html.hsn-pal-light .hsn-eg-key{background:rgba(219,234,254,.82);border-color:rgba(37,99,235,.35)}'
      + '@media(max-width:350px){.hsn-eg-row{grid-template-columns:1fr}.hsn-eg-tip{grid-column:1}.hsn-eg-get{margin-top:1px}}'
      + '@media(prefers-reduced-motion:reduce){.hsn-eg-arrow{transition:none}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function card(id, icon, title, sub, body) {
    var panelId = 'hsnEgPanel' + id;
    return '<section class="settings-section hsn-eg-card" data-eg-card="' + id + '">'
      + '<button class="hsn-eg-toggle" type="button" aria-expanded="false" aria-controls="' + panelId + '">'
      + '<span class="hsn-eg-icon" aria-hidden="true">' + icon + '</span>'
      + '<span class="hsn-eg-headtext"><span class="hsn-eg-title">' + title + '</span><span class="hsn-eg-sub">' + sub + '</span></span>'
      + '<span class="hsn-eg-arrow" aria-hidden="true">▶</span>'
      + '</button>'
      + '<div class="hsn-eg-panel" id="' + panelId + '" hidden>' + body + '</div>'
      + '</section>';
  }

  function row(action, reward, tip) {
    return '<div class="hsn-eg-row">'
      + '<span class="hsn-eg-do">' + action + '</span>'
      + '<strong class="hsn-eg-get">' + reward + '</strong>'
      + (tip ? '<span class="hsn-eg-tip">' + tip + '</span>' : '')
      + '</div>';
  }

  var COIN_HTML = ''
    + '<div class="hsn-eg-key">做学习任务，就能拿金币。</div>'
    + row('第一次进入', '得到 300 金币', '整个游戏只送一次。')
    + row('答对普通题', '每题得到 1 金币', '同一单词每天最多 3 次；全天最多 2000。')
    + row('复习错题', '答对也得 1 金币', '和普通答题使用同一规则。')
    + row('完成每日任务', '每项 20～120 金币', '七项全领，再得到 100～240。')
    + row('每日签到', '每天得到 10～930 金币', '宝箱每天只能开一次。')
    + row('连续签到', '另得 120、250、600', '连续 14、30、100 天时领取。')
    + row('打赢 Boss', '首次 20～50；重打 5', '每轮把本页 Boss 各打赢一次，再得 300。')
    + row('参加拼写蜂', '每赢一词得 3～15', '连胜和整局胜利还有加奖；当天最多 2000。')
    + row('打出连胜', '到指定次数就给金币', '成就奖励要到成就页领取。')
    + row('战胜星海女帝', '另得 300 金币', '终战奖励只领一次。');

  var DIAMOND_HTML = ''
    + '<div class="hsn-eg-key">认真拼写，才能拿钻石。</div>'
    + row('单词达到五星', '得到 4 钻石', '探索单词 → 加固知识结晶；同一单词每天最多完成一组。')
    + row('完成一组拼写', '慢速 10 次；中速 7 次；快速 5 次', '全部完成，才会增加星星。')
    + row('记忆强化生效', '一组增加 2 颗星', '没有强化时，一组增加 1 颗。')
    + row('全岛单词五星', '得到 50 钻石', '一座岛只领一次。')
    + row('五星词达到段位', '依次得 20、40、80、150、300 钻石', '需要 30、100、250、500、800 个五星词。')
    + row('完成一轮 Boss', '得到 88 钻石', '每个 Boss 各胜一次；重复同一关不多算。')
    + row('战胜星海女帝', '得到 100 钻石', '八片单词大陆全通后挑战；只领一次。')
    + row('钻石新贵成就', '得到 20 钻石', '第一次拥有钻石后，到成就页领取。');

  var PET_HTML = ''
    + '<div class="hsn-eg-key">宠物升级：经验要够，已掌握单词也要够。</div>'
    + row('找练习单词', '看爪印没亮的单词', '就在“探索单词”里找。')
    + row('开始冲刺', '点“冲刺宠物掌握”', '系统会进入打字大师。')
    + row('完成拼写', '新词连续完整拼对 3 次', '不能看提示；已有进度时按页面补完。')
    + row('显示“还差 3 个”', '任选 3 个未掌握单词', '不是三个隐藏单词。')
    + row('宠物升级后', '经验和单词全部保留', '不会清零，继续向下一阶累计。');

  var PET_EXP_HTML = ''
    + '<div class="hsn-eg-key">所有岛屿的经验，都加给同一只宠物。</div>'
    + row('学会一个新单词', '得到 10 经验', '点“加入学习”才算。')
    + row('真正改对错题', '每次得到 10 经验', '同一单词每天最多 3 次。')
    + row('救回一个错词', '再得到 30 经验', '同一单词每天一次。')
    + row('挑战 Boss', '答对每题得 5 经验', '胜利再得 65、80 或 95。')
    + row('普通拼写对战', '每赢一词得 2、4 或 6 经验', '单词越长，得到越多。')
    + row('完成每日任务', '每项得到 20～200 经验', '完成后记得领取。')
    + row('每日签到', '得到 20～440 经验', '每天只能领取一次。')
    + row('完成小游戏', '答对和通关都会给经验', '难度越高，通常越多。');

  function bindGuide(root) {
    root.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('.hsn-eg-toggle') : null;
      if (!button || !root.contains(button)) return;
      var panelId = button.getAttribute('aria-controls');
      var panel = document.getElementById(panelId);
      if (!panel) return;
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
      var cardEl = button.closest ? button.closest('.hsn-eg-card') : button.parentNode;
      if (cardEl) cardEl.classList.toggle('open', !open);
    });
  }

  function ensureGuide() {
    removeLegacyGuide();
    var settings = document.getElementById('settingsContent');
    if (!settings || document.getElementById(BOX_ID)) return;
    injectCss();
    var root = document.createElement('div');
    root.id = BOX_ID;
    root.innerHTML = card('Coin', '🪙', '金币怎么得', '做什么，得多少', COIN_HTML)
      + card('Diamond', '💎', '钻石怎么得', '认真拼写，完成挑战', DIAMOND_HTML)
      + card('Pet', '🐾', '宠物怎么升级', '经验和掌握单词都要够', PET_HTML)
      + card('PetExp', '⚡', '宠物经验怎么得', '所有岛屿一起累计', PET_EXP_HTML);
    bindGuide(root);

    var palette = document.getElementById('hsnPalPicker');
    if (palette && palette.nextSibling) settings.insertBefore(root, palette.nextSibling);
    else if (palette) settings.appendChild(root);
    else settings.insertBefore(root, settings.firstChild);
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (typeof window.renderSettings === 'function' && !window.renderSettings.__hsnEcon946HF6) {
      var original = window.renderSettings;
      window.renderSettings = function () {
        var result = original.apply(this, arguments);
        try { ensureGuide(); } catch (e) {}
        return result;
      };
      window.renderSettings.__hsnEcon946HF6 = true;
    }
    try { ensureGuide(); } catch (e2) {}
    if (tries > 60) clearInterval(timer);
  }, 250);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureGuide);
  else ensureGuide();
})();
