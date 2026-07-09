/**
 * 📕 错题总览
 * 在岛页面拦截底部"单词"标签 → 弹出全岛错题总览
 * 可跳到任意岛复习 / 一起复习所有错题
 */
(function(){

  // v142am: 安全点击音效
  function _beep(){
    try {
      if(typeof window.playBeep === 'function') window.playBeep(1200, 0.05);
    } catch(e){}
  }

  'use strict';
  if(window.HansenWrongOverview) return;

  // 文件名 → ISLAND_META key 映射 (与 hansen_upgrade.js 同)
  const ISLAND_FILE_MAP = {
    'food': 'wordIslandFood',
    'animal': 'wordIslandAnimal',
    'sports': 'wordIslandSports',
    'job': 'wordIslandPeople',
    'color': 'wordIslandColorNum',
    'nature': 'wordIslandNature',
    'action': 'wordIslandVerbs',
    'traffic': 'wordIslandTransport',
    'body': 'wordIslandBody',
    'city': 'wordIslandCity',
    'clothes': 'wordIslandClothes',
    'home': 'wordIslandHouse',
    'family': 'wordIslandFamily',
    'school': 'wordIslandSchool',
    'time': 'wordIslandTime',
    'adjective': 'wordIslandAdj',
    'treasure': 'wordIslandMisc',
    'question': 'wordIslandPronouns',
    //🔴v875(Hansen·彻底打通): 星海终战hub+单词大陆8岛入册·错题/复习/最近记录与正片共用一套
    'season': 'wordIslandSeason',
    'land1': 'wordIslandLand1',
    'land2': 'wordIslandLand2',
    'land3': 'wordIslandLand3',
    'land4': 'wordIslandLand4',
    'land5': 'wordIslandLand5',
    'land6': 'wordIslandLand6',
    'land7': 'wordIslandLand7',
    'land8': 'wordIslandLand8'
  };

  // 每个 storage key 对应的岛信息
  const ISLAND_INFO = {
    'wordIslandAnimal':    {file:'island_animal.html', emoji:'🐯', name:'动物岛', shortName:'animal'},
    'wordIslandFood':      {file:'island_food.html', emoji:'🍔', name:'食物岛', shortName:'food'},
    'wordIslandSports':    {file:'island_sports.html', emoji:'⚽', name:'运动岛', shortName:'sports'},
    'wordIslandPeople':    {file:'island_job.html', emoji:'🦸', name:'职业岛', shortName:'job'},
    'wordIslandColorNum':  {file:'island_color.html', emoji:'🌈', name:'颜色数字岛', shortName:'color'},
    'wordIslandNature':    {file:'island_nature.html', emoji:'🌳', name:'自然岛', shortName:'nature'},
    'wordIslandVerbs':     {file:'island_action.html', emoji:'🏃', name:'动作岛', shortName:'action'},
    'wordIslandTransport': {file:'island_traffic.html', emoji:'🚗', name:'交通岛', shortName:'traffic'},
    'wordIslandBody':      {file:'island_body.html', emoji:'👤', name:'身体岛', shortName:'body'},
    'wordIslandCity':      {file:'island_city.html', emoji:'🏙️', name:'城市岛', shortName:'city'},
    'wordIslandClothes':   {file:'island_clothes.html', emoji:'👕', name:'服装岛', shortName:'clothes'},
    'wordIslandHouse':     {file:'island_home.html', emoji:'🏠', name:'房屋岛', shortName:'home'},
    'wordIslandFamily':    {file:'island_family.html', emoji:'👨‍👩‍👦', name:'家庭岛', shortName:'family'},
    'wordIslandSchool':    {file:'island_school.html', emoji:'🎒', name:'学校岛', shortName:'school'},
    'wordIslandTime':      {file:'island_time.html', emoji:'⏰', name:'时间岛', shortName:'time'},
    'wordIslandAdj':       {file:'island_adjective.html', emoji:'😊', name:'形容词岛', shortName:'adjective'},
    'wordIslandMisc':      {file:'island_treasure.html', emoji:'🔤', name:'常用词岛', shortName:'treasure'},
    'wordIslandPronouns':  {file:'island_question.html', emoji:'❓', name:'代词岛', shortName:'question'},
    //🔴v875(Hansen·彻底打通): 星海终战+大陆8岛错题进全局总览
    'wordIslandSeason':    {file:'island_season.html', emoji:'👑', name:'星海终战', shortName:'season'},
    'wordIslandLand1':    {file:'island_land1.html', emoji:'🌫️', name:'迷雾心湖', shortName:'land1'},
    'wordIslandLand2':    {file:'island_land2.html', emoji:'🌾', name:'风纹草原', shortName:'land2'},
    'wordIslandLand3':    {file:'island_land3.html', emoji:'⏳', name:'时之钟谷', shortName:'land3'},
    'wordIslandLand4':    {file:'island_land4.html', emoji:'⚒️', name:'铸剑锻炉山', shortName:'land4'},
    'wordIslandLand5':    {file:'island_land5.html', emoji:'💎', name:'晶石回廊', shortName:'land5'},
    'wordIslandLand6':    {file:'island_land6.html', emoji:'📚', name:'智慧藏书林', shortName:'land6'},
    'wordIslandLand7':    {file:'island_land7.html', emoji:'⛵', name:'万邦港城', shortName:'land7'},
    'wordIslandLand8':    {file:'island_land8.html', emoji:'🌋', name:'星火火山口', shortName:'land8'}
  };

  function safeJSON(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e){ return null; } }
  function getCurrentIsland(){
    const m = location.pathname.match(/island_([a-z0-9]+)\.html/i);  //🔴v875(Hansen·彻底打通): 岛名正则纳入数字·land1-8/season同门而入·复习STORAGE_KEY与错题总览在大陆岛正常点火
    return m ? m[1] : null;
  }
  const islandKey = getCurrentIsland();
  if(!islandKey) return;  // 只在岛内激活

  // 收集所有岛错题统计
  function collectAllIslandWrongs(){
    const result = [];
    Object.keys(ISLAND_INFO).forEach(storageKey => {
      const data = safeJSON(storageKey);
      if(!data || !data.wrongs) return;
      const wrongCount = Object.keys(data.wrongs).length;
      if(wrongCount > 0){
        result.push({
          storageKey,
          info: ISLAND_INFO[storageKey],
          wrongCount,
          wrongs: data.wrongs,
        });
      }
    });
    // 按错题数从多到少排序
    result.sort((a, b) => b.wrongCount - a.wrongCount);
    return result;
  }

  function getTotalWrongs(){
    let total = 0;
    Object.keys(ISLAND_INFO).forEach(k => {
      const d = safeJSON(k);
      if(d && d.wrongs) total += Object.keys(d.wrongs).length;
    });
    return total;
  }

  // ─────────────────────────────────────────────
  // 改底部"单词" 标签 → "📕 错题"
  // ─────────────────────────────────────────────
  function patchWordsTab(){
    const navExplore = document.getElementById('navExplore');
    if(!navExplore) return false;
    if(navExplore.dataset.hwoPatched) return true;
    navExplore.dataset.hwoPatched = '1';

    // 改图标和文字
    navExplore.innerHTML = `
      <span class="ni-icon"><img src="icons/ic_wrong.webp" alt="" draggable="false" style="width:50px;height:50px;object-fit:contain;vertical-align:middle;transform:translate(0px,2px);filter:drop-shadow(0 0 2px rgba(255,255,255,.9)) drop-shadow(0 1px 3px rgba(0,0,0,.5))" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></span><span class="ni-label">错题</span>
      <span class="hwo_total_badge" style="position:absolute;top:2px;right:14px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:8px;display:none;border:1.5px solid #0f172a;line-height:1.2"></span>
    `;
    navExplore.style.position = 'relative';

    // 拦截原 onclick (原本走 showScreen('explore'))
    navExplore.removeAttribute('onclick');
    navExplore.addEventListener('click', function(e){
      _beep();
      e.preventDefault();
      e.stopPropagation();
      openOverview();
    });

    // 更新 badge
    function updateBadge(){
      const n = getTotalWrongs();
      const b = navExplore.querySelector('.hwo_total_badge');
      if(b){
        b.textContent = n > 99 ? '99+' : n;
        b.style.display = n > 0 ? 'inline-block' : 'none';
      }
    }
    updateBadge();
    setInterval(updateBadge, 3000);

    return true;
  }

  function tryPatch(retries){
    if(patchWordsTab()) return;
    if(retries > 0) setTimeout(() => tryPatch(retries - 1), 500);
  }
  if(document.body) tryPatch(10);
  else document.addEventListener('DOMContentLoaded', () => tryPatch(10));

  // ─────────────────────────────────────────────
  // 错题总览 overlay
  // ─────────────────────────────────────────────
  function openOverview(){
    // 关掉旧的
    const old = document.getElementById('hwo_overlay');
    if(old) old.remove();

    const wrongsList = collectAllIslandWrongs();
    const total = getTotalWrongs();

    const overlay = document.createElement('div');
    overlay.id = 'hwo_overlay';
    
    let listHtml = '';
    if(wrongsList.length === 0){
      listHtml = `
        <div style="text-align:center;padding:60px 20px;color:#cbd5e1">
          <div style="font-size:64px;margin-bottom:18px">🌟</div>
          <div style="font-size:20px;font-weight:800;color:#22c55e;margin-bottom:8px">太棒了!</div>
          <div style="font-size:14px;color:#94a3b8;line-height:1.6">所有岛屿都没有错题<br>继续探险吧!</div>
        </div>
      `;
    } else {
      listHtml = wrongsList.map(item => `
        <div class="hwo_island_card" data-storage="${item.storageKey}" data-file="${item.info.file}" data-short="${item.info.shortName}">
          <span class="hwo_island_emoji">${item.info.emoji}</span>
          <div class="hwo_island_main">
            <div class="hwo_island_name">${item.info.name}</div>
            <div class="hwo_island_hint">点击进入复习</div>
          </div>
          <div class="hwo_island_count">
            <div class="hwo_count_num">${item.wrongCount}</div>
            <div class="hwo_count_lbl">个错题</div>
          </div>
        </div>
      `).join('');
    }

    overlay.innerHTML = `
      <style>
        @keyframes hwo_slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes hwo_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
        #hwo_overlay{
          position:fixed;inset:0;z-index:9999;
          background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);
          overflow-y:auto;padding:20px 16px 100px;
          animation:hwo_slideUp .4s ease-out;
        }
        #hwo_overlay .hwo_header{
          display:flex;align-items:center;gap:12px;margin-bottom:6px;padding-top:8px;
        }
        #hwo_overlay .hwo_back{
          background:rgba(255,255,255,.08);color:#cbd5e1;border:0;width:36px;height:36px;
          border-radius:10px;font-size:18px;cursor:pointer;flex-shrink:0;
        }
        #hwo_overlay .hwo_title{font-size:22px;font-weight:900;color:#fbbf24;letter-spacing:1px}
        #hwo_overlay .hwo_sub{color:#94a3b8;font-size:12px;margin-left:48px;margin-bottom:14px;line-height:1.5}
        #hwo_overlay .hwo_total{
          background:linear-gradient(135deg,#7c2d12,#991b1b);border:1px solid #dc2626;
          border-radius:14px;padding:14px 18px;margin-bottom:16px;
          display:flex;justify-content:space-between;align-items:center;color:#fff;
        }
        #hwo_overlay .hwo_total_n{font-size:32px;font-weight:900;color:#fde047;line-height:1}
        #hwo_overlay .hwo_total_lbl{font-size:13px;color:#fca5a5;margin-top:2px}
        #hwo_overlay .hwo_island_card{
          background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:14px;
          padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:14px;
          cursor:pointer;transition:transform .15s,background .15s;color:#fff;
        }
        #hwo_overlay .hwo_island_card:active{transform:scale(.98);background:rgba(99,102,241,.2)}
        #hwo_overlay .hwo_island_emoji{font-size:36px;flex-shrink:0;width:48px;text-align:center}
        #hwo_overlay .hwo_island_main{flex:1}
        #hwo_overlay .hwo_island_name{font-size:17px;font-weight:800;letter-spacing:.5px}
        #hwo_overlay .hwo_island_hint{font-size:12px;color:#94a3b8;margin-top:2px}
        #hwo_overlay .hwo_island_count{text-align:center;flex-shrink:0;
          background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;
          padding:6px 10px;border-radius:10px;min-width:54px;
        }
        #hwo_overlay .hwo_count_num{font-size:20px;font-weight:900;line-height:1}
        #hwo_overlay .hwo_count_lbl{font-size:10px;opacity:.9;margin-top:2px}
        #hwo_overlay .hwo_review_all{
          margin-top:24px;padding:18px;border-radius:16px;cursor:pointer;
          background:linear-gradient(135deg,#7c3aed,#5b21b6);
          color:#fff;text-align:center;
          box-shadow:0 8px 24px rgba(124,58,237,.4);
          animation:hwo_pulse 2.5s ease-in-out infinite;
        }
        #hwo_overlay .hwo_review_all .all_icon{font-size:38px;margin-bottom:6px}
        #hwo_overlay .hwo_review_all .all_name{font-size:18px;font-weight:900;letter-spacing:1px}
        #hwo_overlay .hwo_review_all .all_desc{font-size:12px;color:rgba(255,255,255,.8);margin-top:4px;line-height:1.5}
        #hwo_overlay .hwo_btm{text-align:center;color:#475569;font-size:11px;margin-top:24px;line-height:1.6}
      </style>
      
      <div class="hwo_header">
        <button class="hwo_back" onclick="window.HansenWrongOverview._close()">←</button>
        <div class="hwo_title">📕 错题总览</div>
      </div>
      <div class="hwo_sub">每个岛屿待复习单词</div>
      
      ${wrongsList.length > 0 ? `
      <div class="hwo_total">
        <div>
          <div class="hwo_total_n">${total}</div>
          <div class="hwo_total_lbl">个待复习单词</div>
        </div>
        <div style="font-size:54px">📕</div>
      </div>
      ` : ''}
      
      ${listHtml}
      
      ${wrongsList.length > 1 ? `
      <div class="hwo_review_all" onclick="window.HansenWrongOverview._reviewAll()">
        <div class="all_icon">📚</div>
        <div class="all_name">一起复习全部</div>
        <div class="all_desc">不分岛屿 · ${total} 个错题混在一起<br>一个一个温柔记住</div>
      </div>
      ` : ''}
      
      <div class="hwo_btm">
        💡 点击任意岛屿 = 进入该岛错题复习<br>
        点"一起复习全部" = 跨岛混合复习
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // 绑定每个岛卡片的点击 - 直接跳目标岛 + 自动开复习中心
    overlay.querySelectorAll('.hwo_island_card').forEach(card => {
      card.addEventListener('click', function(){
        _beep();
        const targetFile = card.dataset.file;
        const targetShort = card.dataset.short;
        
        // 如果点的就是当前岛: 直接打开复习中心, 不跳转
        if(targetShort === islandKey){
          window.HansenWrongOverview._close();
          // 不设 context, 让 review center 用本岛默认
          if(window.HansenReview && window.HansenReview._open){
            window.HansenReview._open();
          }
          return;
        }
        
        // 跨岛: 设 flag, 跳过去, 到那边自动开复习中心
        localStorage.setItem('hansen_autoOpenReviewCenter', '1');
        /* 🔴v860 收编进壳(Hansen: 彻底相通·不走网页): 框内跨岛一律走父窗口 openIsland(2秒加载体验+历史干净+保活簿记), 独立模式才裸跳。iframe裸href还会给联合历史加条目→返回键乱=网页感元凶。 */
        var _op = null;
        try{ _op = (window.parent && window.parent !== window && window.parent.openIsland) || null; }catch(e){}
        if(_op){ _op(targetFile); } else { location.href = targetFile; }
      });
    });
  }

  window.HansenWrongOverview = {
    _close: function(){
      _beep();
      const el = document.getElementById('hwo_overlay');
      if(el) el.remove();
    },
    _reviewAll: function(){
      _beep();
      // 收集所有岛错题
      const allWrongs = [];
      const allVocab = [];
      
      Object.keys(ISLAND_INFO).forEach(storageKey => {
        const data = safeJSON(storageKey);
        const vocab = safeJSON('hansen_vocab_' + storageKey);
        if(!vocab) return;
        
        vocab.forEach(w => allVocab.push(w));
        
        if(data && data.wrongs){
          Object.keys(data.wrongs).forEach(idx => {
            const w = vocab[Number(idx)];
            if(w){
              allWrongs.push({
                idx: Number(idx),
                count: data.wrongs[idx],
                word: w,
              });
            }
          });
        }
      });
      
      if(allWrongs.length === 0){
        const t = document.createElement('div');
        t.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:30px;cursor:pointer';
        t.innerHTML = '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:2px solid #22c55e;border-radius:18px;padding:30px;text-align:center;color:#fff;max-width:300px"><div style="font-size:48px;margin-bottom:10px">🌟</div><div style="font-size:18px;font-weight:800;color:#22c55e">所有岛屿都没有错题</div></div>';
        t.onclick = () => t.remove();
        document.body.appendChild(t);
        setTimeout(() => { if(t.parentNode) t.remove(); }, 2500);
        return;
      }
      
      this._close();
      window._huReviewContext = {
        wrongsList: allWrongs,
        vocabList: allVocab,
        title: '一起复习全部',
      };
      if(window.HansenReview && window.HansenReview._open){
        window.HansenReview._open();
      }
        },
  };

  // ─────────────────────────────────────────────
  // 自动打开雨 (跨岛跳转后用)
  // ─────────────────────────────────────────────
  // v142p: 早期遮罩由 hansen_early.js 设置, 这里只负责打开复习中心
  function autoOpenAfterReady(){
    let tries = 0;
    const maxTries = 50;
    function tryOpen(){
      tries++;
      if(window.HansenReview && window.HansenReview._open && window.allW){
        try {
          window.HansenReview._open();
          // 复习中心打开后, 移除遮罩 + body class
          setTimeout(() => {
            if(document.body) document.body.classList.remove('hansen-transitioning');
            const m = document.getElementById('hwo_transition_mask');
            if(m) m.remove();
          }, 150);
        } catch(e){
          if(document.body) document.body.classList.remove('hansen-transitioning');
          const m = document.getElementById('hwo_transition_mask');
          if(m) m.remove();
        }
        return;
      }
      if(tries >= maxTries){
        if(document.body) document.body.classList.remove('hansen-transitioning');
        const m = document.getElementById('hwo_transition_mask');
        if(m) m.remove();
        return;
      }
      setTimeout(tryOpen, 150);
    }
    setTimeout(tryOpen, 100);
  }
  
  // 检测是否需要自动打开 (flag 已被 early.js 读取并设 _hansenAutoOpening)
  if(window._hansenAutoOpening){
    autoOpenAfterReady();
  }

  console.log('%c[HansenWrongOverview]%c 错题总览已就绪',
              'color:#06b6d4;font-weight:bold', 'color:#94a3b8');
})();
