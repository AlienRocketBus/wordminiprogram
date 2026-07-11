// hansen_avatar.js v2 (v773) — 🧑‍🎤 换头像系统(左上角无框头像→66形象选择器·卡牌纯色背景可调色·设为头像)
//  v773改: 卡片只放形象(contain完整显示·宽如章鱼不再被裁)·名字移到卡片下方独立框(不再压住人物形象)·网格同样图完整+名字在缩略图下方·头像图升到720px更清晰。
//  铁律: 绝无旋转/闪烁/震屏; class全加 hsn-av- 前缀防冲突; 纯display切换不用全局[hidden]。
(function(){
  if(window.HsnAvatar) return; 
  var CHARS=[{"n": 1, "animal": "灰狼", "job": "消防员", "name": "阿焰", "img": "avatars/01.webp"}, {"n": 2, "animal": "棕熊", "job": "医生", "name": "暖诊", "img": "avatars/02.webp"}, {"n": 3, "animal": "橘猫", "job": "咖啡师", "name": "拿铁", "img": "avatars/03.webp"}, {"n": 4, "animal": "鹿", "job": "机长", "name": "云岭", "img": "avatars/04.webp"}, {"n": 5, "animal": "树蛙", "job": "巫师", "name": "噗噜", "img": "avatars/05.webp"}, {"n": 6, "animal": "松鼠", "job": "园丁", "name": "松果", "img": "avatars/06.webp"}, {"n": 7, "animal": "考拉", "job": "图书管理员", "name": "慢翻", "img": "avatars/07.webp"}, {"n": 8, "animal": "企鹅", "job": "宇航员", "name": "星跃", "img": "avatars/08.webp"}, {"n": 9, "animal": "河狸", "job": "水手", "name": "船板", "img": "avatars/09.webp"}, {"n": 10, "animal": "刺猬", "job": "护林员", "name": "针山", "img": "avatars/10.webp"}, {"n": 11, "animal": "老虎", "job": "厨师", "name": "大勺", "img": "avatars/11.webp"}, {"n": 12, "animal": "大象", "job": "骑士", "name": "铁鼻", "img": "avatars/12.webp"}, {"n": 13, "animal": "羊驼", "job": "魔术师", "name": "蓬蓬", "img": "avatars/13.webp"}, {"n": 14, "animal": "鳄鱼", "job": "建筑工", "name": "砖头", "img": "avatars/14.webp"}, {"n": 15, "animal": "袋鼠", "job": "邮递员", "name": "跳袋", "img": "avatars/15.webp"}, {"n": 16, "animal": "犀牛", "job": "陶艺师", "name": "泥碗", "img": "avatars/16.webp"}, {"n": 17, "animal": "狐獴", "job": "科学家", "name": "立瓶", "img": "avatars/17.webp"}, {"n": 18, "animal": "骆驼", "job": "教授", "name": "沙翁", "img": "avatars/18.webp"}, {"n": 19, "animal": "大猩猩", "job": "举重教练", "name": "铁臂", "img": "avatars/19.webp"}, {"n": 20, "animal": "鸭子", "job": "潜水员", "name": "扑通", "img": "avatars/20.webp"}, {"n": 21, "animal": "山羊", "job": "登山者", "name": "攀角", "img": "avatars/21.webp"}, {"n": 22, "animal": "马", "job": "铁匠", "name": "锻蹄", "img": "avatars/22.webp"}, {"n": 23, "animal": "海象", "job": "渔夫", "name": "长牙", "img": "avatars/23.webp"}, {"n": 24, "animal": "火烈鸟", "job": "芭蕾舞者", "name": "单足", "img": "avatars/24.webp"}, {"n": 25, "animal": "蝙蝠", "job": "DJ", "name": "夜音", "img": "avatars/25.webp"}, {"n": 26, "animal": "猞猁", "job": "滑雪者", "name": "雪耳", "img": "avatars/26.webp"}, {"n": 27, "animal": "章鱼", "job": "服务生", "name": "八手", "img": "avatars/27.webp"}, {"n": 28, "animal": "孔雀", "job": "时装设计师", "name": "翎裁", "img": "avatars/28.webp"}, {"n": 29, "animal": "陆龟", "job": "瑜伽教练", "name": "慢盘", "img": "avatars/29.webp"}, {"n": 30, "animal": "仓鼠", "job": "商人", "name": "鼓囊", "img": "avatars/30.webp"}, {"n": 31, "animal": "牦牛", "job": "茶摊老板", "name": "暖茶", "img": "avatars/31.webp"}, {"n": 32, "animal": "海豹", "job": "救生员", "name": "浪哨", "img": "avatars/32.webp"}, {"n": 33, "animal": "鸵鸟", "job": "短跑选手", "name": "疾腿", "img": "avatars/33.webp"}, {"n": 34, "animal": "树懒", "job": "花店主", "name": "慢瓣", "img": "avatars/34.webp"}, {"n": 35, "animal": "天鹅", "job": "花滑选手", "name": "滑翎", "img": "avatars/35.webp"}, {"n": 36, "animal": "水豚", "job": "面包师", "name": "暖揉", "img": "avatars/36.webp"}, {"n": 37, "animal": "猎豹", "job": "摄影师", "name": "速拍", "img": "avatars/37.webp"}, {"n": 38, "animal": "鹈鹕", "job": "冰淇淋小贩", "name": "大兜", "img": "avatars/38.webp"}, {"n": 39, "animal": "臭鼬", "job": "萨克斯手", "name": "尾韵", "img": "avatars/39.webp"}, {"n": 40, "animal": "犰狳", "job": "矿工", "name": "甲镐", "img": "avatars/40.webp"}, {"n": 41, "animal": "小熊猫", "job": "钟表匠", "name": "环尾", "img": "avatars/41.webp"}, {"n": 42, "animal": "鼹鼠", "job": "电工", "name": "掘线", "img": "avatars/42.webp"}, {"n": 43, "animal": "豪猪", "job": "理发师", "name": "刺剪", "img": "avatars/43.webp"}, {"n": 44, "animal": "鬣蜥", "job": "冲浪教练", "name": "浪脊", "img": "avatars/44.webp"}, {"n": 45, "animal": "雪貂", "job": "水管工", "name": "长溜", "img": "avatars/45.webp"}, {"n": 46, "animal": "㺢㹢狓", "job": "裁缝", "name": "纹尺", "img": "avatars/46.webp"}, {"n": 47, "animal": "野牛", "job": "列车长", "name": "鸣轨", "img": "avatars/47.webp"}, {"n": 48, "animal": "龙猫", "job": "护士", "name": "软团", "img": "avatars/48.webp"}, {"n": 49, "animal": "穿山甲", "job": "考古学家", "name": "鳞铲", "img": "avatars/49.webp"}, {"n": 50, "animal": "袋熊", "job": "法官", "name": "稳槌", "img": "avatars/50.webp"}, {"n": 51, "animal": "短尾矮袋鼠", "job": "牙医", "name": "笑齿", "img": "avatars/51.webp"}, {"n": 52, "animal": "美西螈", "job": "游泳教练", "name": "粉鳃", "img": "avatars/52.webp"}, {"n": 53, "animal": "眼镜猴", "job": "天文学家", "name": "大眸", "img": "avatars/53.webp"}, {"n": 54, "animal": "貘", "job": "发明家", "name": "巧鼻", "img": "avatars/54.webp"}, {"n": 55, "animal": "公鸡", "job": "乐队指挥", "name": "晨棒", "img": "avatars/55.webp"}, {"n": 56, "animal": "巨嘴鸟", "job": "导游", "name": "彩喙", "img": "avatars/56.webp"}, {"n": 57, "animal": "獴", "job": "兽医", "name": "灵尾", "img": "avatars/57.webp"}, {"n": 58, "animal": "豚鼠", "job": "糖果店主", "name": "甜罐", "img": "avatars/58.webp"}, {"n": 59, "animal": "食蚁兽", "job": "清洁工", "name": "长扫", "img": "avatars/59.webp"}, {"n": 60, "animal": "鹦鹉", "job": "流行歌手", "name": "鸣彩", "img": "avatars/60.webp"}, {"n": 61, "animal": "鸭嘴兽", "job": "地质学家", "name": "扁喙", "img": "avatars/61.webp"}, {"n": 62, "animal": "鹳鸟", "job": "药剂师", "name": "长嘴", "img": "avatars/62.webp"}, {"n": 63, "animal": "土拨鼠", "job": "气象员", "name": "测风", "img": "avatars/63.webp"}, {"n": 64, "animal": "壁虎", "job": "玻璃清洁工", "name": "黏掌", "img": "avatars/64.webp"}, {"n": 65, "animal": "黑猫", "job": "执法官", "name": "玄影", "img": "avatars/65.webp"}, {"n": 66, "animal": "特别形象", "job": "", "name": "僵尸舞王", "img": "avatars/66.webp"}];
  var HSNAVV='?v=916'; for(var _ci=0;_ci<CHARS.length;_ci++){ CHARS[_ci].img+=HSNAVV; } /* 头像图缓存戳·build.py统一升版刷新 */
  /* 🔴v787 头像图加载失败重试: 切换头像复用同一<img>时·先清掉上一张失败残留(重试计数/已失败标记/?占位)·让新图重新走 hansenImgErr 的3次重试·并确保 onerror 接上。根治"头像偶尔加载不出来一直空白"——原头像所有img都没接全局重试 hansenImgErr·一次网络抖动(微信WebView慢网)失败就永久空白 */
  function _avImgReset(img){ if(!img) return; try{ img.dataset.imgTries='0'; img.dataset.errored=''; img.style.display=''; var p=img.parentNode; if(p){ var ds=p.querySelectorAll('div'); for(var _k=0;_k<ds.length;_k++){ if(ds[_k].textContent==='?'&&!ds[_k].id) p.removeChild(ds[_k]); } } }catch(e){} if(!img.getAttribute('onerror')&&!img.onerror) img.onerror=function(){ window.hansenImgErr&&window.hansenImgErr(this); }; }
  var PALETTE=['#ff6b6b','#ff8a4c','#ffb443','#ffd23f','#9bd14a','#3fc380','#23c1a0','#34c3e0',
    '#4db8ff','#5b8def','#7b7bef','#a06bff','#c77dff','#ff7ab6','#ff5d8f','#e63946',
    '#f4a261','#e9c46a','#2a9d8f','#457b9d','#8d99ae','#6d597a','#b56576','#264653'];
  function defColor(n){ return PALETTE[(n*7)%PALETTE.length]; }
  var LS='hsn_avatar';
  function load(){ try{return JSON.parse(localStorage.getItem(LS))||{};}catch(e){return {};} }
  function save(s){ try{localStorage.setItem(LS,JSON.stringify(s));}catch(e){} }
  var state=load(); if(!state.colors) state.colors={}; if(!state.cur) state.cur=1;
  function colorOf(n){ return state.colors[n]||defColor(n); }
  function charOf(n){ for(var i=0;i<CHARS.length;i++){ if(CHARS[i].n===n) return CHARS[i]; } return CHARS[0]; }
  var $=function(id){ return document.getElementById(id); };

  function injectCSS(){
    if($('hsn-av-css')) return;
    var s=document.createElement('style'); s.id='hsn-av-css';
    s.textContent=
    '.avatar.hsn-av-on{border:0!important;box-shadow:none!important;border-radius:13px!important;width:var(--hsnAvSize,60px)!important;height:var(--hsnAvSize,60px)!important;overflow:hidden;font-size:0;position:relative;background:#2a3360}'+
    '.top-bar{height:62px!important;box-sizing:border-box}'+
    '.avatar.hsn-av-on::after{display:none!important}'+
    '.avatar.hsn-av-on .hsn-av-img{position:absolute;inset:0;margin:auto;max-width:var(--hsnAvImg,95%);max-height:var(--hsnAvImg,95%);width:auto;height:auto;object-fit:contain;display:block}'+
    '.hsn-av-sheet{position:fixed;inset:0;z-index:100000;background:linear-gradient(180deg,#1a2150,#0f1530);transform:translateY(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;visibility:hidden;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#eaf0ff;-webkit-tap-highlight-color:transparent}'+
    '.hsn-av-sheet.hsn-av-open{transform:translateY(0);visibility:visible}'+
    '.hsn-av-head{display:flex;align-items:center;padding:calc(env(safe-area-inset-top,0px) + 14px) 14px 12px;gap:10px;border-bottom:1px solid rgba(255,255,255,.1);flex:none}'+
    '.hsn-av-title{flex:1;text-align:center;font-size:18px;font-weight:800}'+
    '.hsn-av-close,.hsn-av-back{width:38px;height:38px;border:0;border-radius:11px;background:rgba(255,255,255,.08);color:#eaf0ff;font-size:22px;line-height:1;cursor:pointer;font-weight:700;font-family:inherit}'+
    '.hsn-av-back{font-size:26px}'+
    '.hsn-av-grid{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:max-content;align-content:start;gap:11px;padding:14px 14px 40px}'+
    '.hsn-av-cell{position:relative;border-radius:16px;overflow:hidden;cursor:pointer;background:#222a4d;border:1.5px solid rgba(255,255,255,.08);transition:transform .14s ease}'+
    '.hsn-av-cell:active{transform:scale(.96)}'+
    '.hsn-av-cell .hsn-av-thumb{position:relative;width:100%;height:128px;overflow:hidden}'+
    '.hsn-av-cell .hsn-av-thumb img{position:absolute;inset:0;margin:auto;max-width:86%;max-height:86%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 4px 7px rgba(0,0,0,.3))}'+
    '.hsn-av-cell .hsn-av-cn{padding:7px 4px 9px;text-align:center;font-size:12.5px;font-weight:800;color:#fff;line-height:1.25}'+
    '.hsn-av-cell .hsn-av-cj{display:block;font-size:9.5px;font-weight:600;color:#9fb0d8;margin-top:1px}'+
    '.hsn-av-cell.hsn-av-cur{border-color:#f5c451;box-shadow:0 0 0 1.5px #f5c451,0 0 14px rgba(245,196,81,.4)}'+
    '.hsn-av-cell.hsn-av-cur::after{content:"\\2713 \u5f53\u524d";position:absolute;top:6px;left:6px;background:linear-gradient(135deg,#f5c451,#e8a93a);color:#3a2606;font-size:9px;font-weight:900;padding:2px 6px;border-radius:7px;z-index:2}'+
    '.hsn-av-detail{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 10px 40px;display:flex;flex-direction:column;align-items:center}'+
    '.hsn-av-cardwrap{position:relative;width:100%;max-width:300px;margin:0 auto}'+ /* 🔴v783 卡片外包层(不overflow)·箭头悬浮其外侧深色空白·卡片恢复满尺寸不再被箭头挤小 */
    '.hsn-av-card{position:relative;width:100%;max-width:300px;height:0;padding-bottom:120%;border-radius:24px;overflow:hidden;box-shadow:0 14px 36px rgba(0,0,0,.5),inset 0 2px 0 rgba(255,255,255,.18)}'+
    '.hsn-av-cardbg{position:absolute;inset:0;transition:background .22s ease}'+
    '.hsn-av-cardbg::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 16%,rgba(255,255,255,.26),transparent 60%),linear-gradient(transparent 74%,rgba(0,0,0,.1))}'+
    '.hsn-av-cardimg{position:absolute;left:50%;bottom:4%;transform:translateX(-50%);max-width:92%;max-height:92%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 8px 16px rgba(0,0,0,.4));z-index:1}'+
    '.hsn-av-cardimg.hsn-av-big{bottom:auto;top:50%;transform:translate(-50%,-50%);max-width:96%;max-height:104%}'+ /* 🔴v781 僵尸舞王(#66)窄长图·详情卡单独放大居中→手碰顶脚碰底 */
    '.hsn-av-nav{position:absolute;top:50%;transform:translateY(-50%);width:26px;height:62px;border:0;border-radius:11px;background:rgba(255,255,255,.1);color:#eaf0ff;font-size:22px;font-weight:900;line-height:1;cursor:pointer;z-index:4;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0;-webkit-tap-highlight-color:transparent}'+ /* 🔴v783 箭头绝对悬浮在卡片外侧深色空白·不占卡片宽度(卡片恢复满尺寸)·不在绿卡上·纯scale无旋转闪烁 */
    '.hsn-av-nav:active{background:rgba(255,255,255,.2);transform:translateY(-50%) scale(.88)}'+
    '.hsn-av-prev{right:100%;margin-right:3px}.hsn-av-next{left:100%;margin-left:3px}'+
    '.hsn-av-nameplate{text-align:center;margin-top:16px;width:100%}'+
    '.hsn-av-nameplate b{display:block;font-size:25px;font-weight:900;color:#fff;letter-spacing:1px;text-shadow:0 1px 3px rgba(0,0,0,.4)}'+
    '.hsn-av-nameplate span{display:block;font-size:14px;font-weight:600;color:#9fb0d8;margin-top:5px}'+
    '.hsn-av-pl{align-self:flex-start;margin:22px 2px 10px;font-size:13px;font-weight:800;color:#9fb0d8}'+
    '.hsn-av-sw{display:grid;grid-template-columns:repeat(8,1fr);gap:9px;width:100%}'+
    '.hsn-av-sw .hsn-av-s{aspect-ratio:1;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.16);position:relative;transition:transform .12s ease}'+
    '.hsn-av-sw .hsn-av-s:active{transform:scale(.88)}'+
    '.hsn-av-sw .hsn-av-s.on{border-color:#fff;box-shadow:0 0 0 2px #f5c451}'+
    '.hsn-av-sw .hsn-av-s.on::after{content:"\\2713";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;text-shadow:0 1px 3px rgba(0,0,0,.7)}'+
    '.hsn-av-custom{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:13px;font-weight:700;color:#9fb0d8;cursor:pointer}'+
    '.hsn-av-custom input[type=color]{width:34px;height:34px;border:0;border-radius:10px;background:none;cursor:pointer;padding:0}'+
    '.hsn-av-setbtn{margin-top:24px;width:100%;max-width:300px;padding:16px;border:0;border-radius:16px;cursor:pointer;background:linear-gradient(135deg,#f5c451,#e8a93a);color:#3a2606;font-size:17px;font-weight:900;letter-spacing:2px;box-shadow:0 8px 20px rgba(245,196,81,.4);transition:transform .14s ease;font-family:inherit}'+
    '.hsn-av-setbtn:active{transform:scale(.97)}'+
    '.hsn-av-toast{position:fixed;left:50%;bottom:46px;transform:translateX(-50%) translateY(20px);z-index:100001;opacity:0;background:rgba(20,26,54,.96);border:1px solid #f5c451;color:#f5c451;font-weight:800;font-size:14px;padding:12px 22px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.5);transition:opacity .25s,transform .25s;pointer-events:none;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}'+
    '.hsn-av-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    document.head.appendChild(s);
  }

  function render(){
    var el=$('avatarIcon'); if(!el) return; injectCSS();
    var c=charOf(state.cur);
    if(el.className.indexOf('hsn-av-on')<0) el.className+=' hsn-av-on';
    el.style.background=colorOf(c.n);
    var img=el.querySelector('img.hsn-av-img');
    if(!img){
      el.textContent='';
      img=document.createElement('img'); img.className='hsn-av-img'; img.alt=''; img.onerror=function(){ window.hansenImgErr&&window.hansenImgErr(this); }; el.appendChild(img);/*🔴v787 顶栏头像图加载失败重试*/
    }
    if(img.getAttribute('src')!==c.img){ _avImgReset(img); img.src=c.img; }/*🔴v787 换头像复用同img·先重置重试残留*/
    el.onclick=function(e){ if(e){e.stopPropagation();} openPicker(); };
    el.title='\u70b9\u6211\u6362\u5934\u50cf';
    var tn=document.querySelector('.top-name');
    if(tn && !tn._hsnLvMap && typeof window.showLevelMap==='function'){
      tn._hsnLvMap=1; tn.style.cursor='pointer'; tn.title='\u67e5\u770b\u5192\u9669\u8005\u56fe\u9274';
      tn.addEventListener('click',function(){ try{ window.showLevelMap(); }catch(e){} });
    }
  }

  var built=false, viewN=null;
  function buildPicker(){
    if(built) return; built=true; injectCSS();
    var wrap=document.createElement('div');
    wrap.innerHTML=
    '<div class="hsn-av-sheet" id="hsnAvSheet">'+
      '<div class="hsn-av-head">'+
        '<button class="hsn-av-back" id="hsnAvBack" style="display:none">\u2039</button>'+
        '<div class="hsn-av-title" id="hsnAvTitle">\u9009\u62e9\u5934\u50cf</div>'+
        '<button class="hsn-av-close" id="hsnAvClose">\u00d7</button>'+
      '</div>'+
      '<div class="hsn-av-grid" id="hsnAvGrid"></div>'+
      '<div class="hsn-av-detail" id="hsnAvDetail" style="display:none">'+
        '<div class="hsn-av-cardwrap">'+
          '<div class="hsn-av-card" id="hsnAvCard"><div class="hsn-av-cardbg" id="hsnAvCardBg"></div>'+
            '<img class="hsn-av-cardimg" id="hsnAvCardImg" alt="" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></div>'+
          '<button class="hsn-av-nav hsn-av-prev" id="hsnAvPrev" aria-label="\u4e0a\u4e00\u4e2a">\u2039</button>'+
          '<button class="hsn-av-nav hsn-av-next" id="hsnAvNext" aria-label="\u4e0b\u4e00\u4e2a">\u203a</button>'+
        '</div>'+
        '<div class="hsn-av-nameplate"><b id="hsnAvCardName"></b><span id="hsnAvCardSub"></span></div>'+
        '<div class="hsn-av-pl">\ud83c\udfa8 \u5361\u724c\u80cc\u666f\u7eaf\u8272 \u2014 \u70b9\u4e00\u4e0b\u6362\u989c\u8272</div>'+
        '<div class="hsn-av-sw" id="hsnAvSw"></div>'+
        '<label class="hsn-av-custom"><input type="color" id="hsnAvCustom" value="#4db8ff"> \u81ea\u5b9a\u4e49\u4efb\u610f\u989c\u8272</label>'+
        '<button class="hsn-av-setbtn" id="hsnAvSet">\u8bbe \u4e3a \u5934 \u50cf</button>'+
      '</div>'+
    '</div>'+
    '<div class="hsn-av-toast" id="hsnAvToast"></div>';
    while(wrap.firstChild){ document.body.appendChild(wrap.firstChild); }
    $('hsnAvClose').onclick=closePicker;
    $('hsnAvBack').onclick=showGrid;
    $('hsnAvCustom').oninput=function(){ applyColor(this.value); };
    $('hsnAvSet').onclick=function(){
      state.cur=viewN; save(state); render();
      var c=charOf(viewN); toast('\u5df2\u628a\u300c'+c.name+'\u300d\u8bbe\u4e3a\u5934\u50cf \u2713');
      setTimeout(closePicker,520);
    };
    $('hsnAvPrev').onclick=function(e){ if(e){e.stopPropagation();} navDetail(-1); }; /* 🔴v781 上一个角色 */
    $('hsnAvNext').onclick=function(e){ if(e){e.stopPropagation();} navDetail(1); };  /* 🔴v781 下一个角色 */
  }
  function renderGrid(){
    var g=$('hsnAvGrid'); g.innerHTML='';
    for(var i=0;i<CHARS.length;i++){ (function(c){
      var d=document.createElement('div');
      d.className='hsn-av-cell'+(c.n===state.cur?' hsn-av-cur':'');
      d.innerHTML='<div class="hsn-av-thumb" style="background:'+colorOf(c.n)+'"><img loading="lazy" src="'+c.img+'" alt="" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></div>'+
        '<div class="hsn-av-cn">'+c.name+'<span class="hsn-av-cj">'+c.animal+(c.job?'\u00b7'+c.job:'')+'</span></div>';
      d.onclick=function(){ openDetail(c.n); };
      g.appendChild(d);
    })(CHARS[i]); }
  }
  var _gridScroll=0; /* 🔴v793 网格滚动位置·详情返回时恢复·不跳回顶部 */
  function showGrid(){ renderGrid(); $('hsnAvDetail').style.display='none'; var _g=$('hsnAvGrid'); _g.style.display='grid'; $('hsnAvBack').style.display='none'; $('hsnAvTitle').textContent='\u9009\u62e9\u5934\u50cf'; try{ _g.scrollTop=_gridScroll; }catch(e){} } /* 🔴v793 返回网格时重新renderGrid→立即反映刚在详情里改的卡牌背景色(及时生效)·并恢复滚动位置 */
  function openPicker(){ buildPicker(); _gridScroll=0; showGrid(); var sh=$('hsnAvSheet'); sh.classList.add('hsn-av-open'); } /* 🔴v793 showGrid已含renderGrid·去掉重复渲染·新开网格回顶部 */
  function closePicker(){ var sh=$('hsnAvSheet'); if(sh) sh.classList.remove('hsn-av-open'); }
  function openDetail(n){
    var _g=$('hsnAvGrid'); if(_g && _g.style.display!=='none'){ _gridScroll=_g.scrollTop; } /* 🔴v793 进详情前记住网格滚动位置(仅网格可见时记·避免详情内左右翻角色时被覆盖) */
    viewN=n; var c=charOf(n);
    $('hsnAvGrid').style.display='none'; $('hsnAvDetail').style.display='flex'; $('hsnAvBack').style.display='';
    $('hsnAvTitle').textContent='\u5f62\u8c61\u8be6\u60c5';
    var im=$('hsnAvCardImg'); _avImgReset(im); im.src=c.img; im.className='hsn-av-cardimg'+(c.n===66?' hsn-av-big':''); /* 🔴v781 #66僵尸舞王窄长图详情卡放大居中 🔴v787 切换头像先重置重试残留 */
    $('hsnAvCardName').textContent=c.name; $('hsnAvCardSub').textContent=c.job?(c.animal+' \u00b7 '+c.job):c.animal;
    renderSwatches(); applyColor(colorOf(n)); $('hsnAvDetail').scrollTop=0;
  }
  function navDetail(dir){ /* 🔴v781 左右箭头翻角色(按数组序·首尾循环) */
    if(viewN==null) return;
    var idx=0; for(var i=0;i<CHARS.length;i++){ if(CHARS[i].n===viewN){ idx=i; break; } }
    idx=(idx+dir+CHARS.length)%CHARS.length;
    openDetail(CHARS[idx].n);
  }
  function applyColor(col){
    if(viewN==null) return;
    $('hsnAvCardBg').style.background=col; state.colors[viewN]=col; save(state); /* 🔴v782 换色只存该角色背景色·不改谁是头像(state.cur不动)·选『设为头像』才换头像 */
    try{ if(col.length===7) $('hsnAvCustom').value=col; }catch(e){}
    var sws=document.querySelectorAll('#hsnAvSw .hsn-av-s');
    for(var i=0;i<sws.length;i++){ sws[i].className='hsn-av-s'+(sws[i].getAttribute('data-c').toLowerCase()===col.toLowerCase()?' on':''); }
    if(viewN===state.cur){ render(); } /* 仅当前头像角色换色→顶栏小图标颜色才即时跟着变(非当前角色只存色·设为头像后才生效)(v774) */
  }
  function renderSwatches(){
    var sw=$('hsnAvSw'); sw.innerHTML='';
    for(var i=0;i<PALETTE.length;i++){ (function(col){
      var b=document.createElement('div'); b.className='hsn-av-s'; b.setAttribute('data-c',col); b.style.background=col;
      b.onclick=function(){ applyColor(col); }; sw.appendChild(b);
    })(PALETTE[i]); }
  }
  var toastT;
  function toast(msg){ var t=$('hsnAvToast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(function(){ t.classList.remove('show'); },1600); }

  function applySavedSize(){ try{
    var de=document.documentElement;
    var fr=parseInt(localStorage.getItem('hansen_av_frame'),10); if(!isNaN(fr)){ if(fr>60)fr=60; if(fr<32)fr=32; de.style.setProperty('--hsnAvSize',fr+'px'); }
    var ig=parseInt(localStorage.getItem('hansen_av_img'),10); if(!isNaN(ig)) de.style.setProperty('--hsnAvImg',ig+'%');
  }catch(e){} }
  window.HsnAvatar={ render:render, open:openPicker, close:closePicker, applySize:applySavedSize };
  function boot(){ applySavedSize(); try{ render(); }catch(e){} }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); } 
  boot();
})();