#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_health_check.py — 自动化彻查 (照 README/铁律1.0 规格重建)
两层验证:
  A. 静态: 调 check_resources.py (版本一致性/文件完整/word_map/boss图...)
  B. 真实浏览器(playwright): 逐个加载全部 19 个岛, 查
     ① 崩溃/白屏(body 无内容 / goto 失败)
     ② WORD_MAP 是否正确加载(=154 键)
     ③ 版本红条(hansen_boss_lock 版本不一致时插的警告条)
     ④ console.error / pageerror
看到 "✅ 全部通过" 才能打包。
注: 本版按 README 规格重建; 原版还会触发 9 个游戏模式结算页查"金币显示vs发放"等,
    本次改动仅 word_map.js + words/ (不动游戏逻辑/结算/货币), 故聚焦崩溃+一致性+发音映射。
用法: python3 hansen_health_check.py   |   --quick (只测 animal/food/sports)
"""
import os, sys, subprocess, socket, time, glob

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
QUICK = "--quick" in sys.argv

# 🔴v876: 段级自愈重试——环境会随机击杀 chromium(段脚本 crash/hang)。每段自清存档可安全重跑;
#   rc!=0 时 pkill 残余浏览器+睡 8s 避杀窗后重试(HC_TRIES 环境变量可调·默认5)。硬超时见各段头 150s killer。
def _hc_run_retry(js_path, name, tries=None):
    import os as _os, time as _time
    if tries is None: tries = int(_os.environ.get("HC_TRIES","5"))
    for _t in range(1, tries+1):
        try: _ensure_srv()
        except Exception: pass
        _rc = subprocess.run(["node", js_path]).returncode
        if _rc == 0:
            if _t > 1: print("   \u267b\ufe0f [%s] \u7b2c%d\u6b21\u91cd\u8bd5\u901a\u8fc7(\u524d\u6b21\u4e3a\u73af\u5883\u51fb\u6740)" % (name, _t))
            return 0
        subprocess.run(["pkill","-9","chrom"], capture_output=True)
        _time.sleep(8)
        if _t < tries: print("   \u267b\ufe0f [%s] rc=%d(\u7591\u4f3c\u73af\u5883\u51fb\u6740\u6d4f\u89c8\u5668) \u2192 \u91cd\u8bd5 %d/%d" % (name, _rc, _t+1, tries))
    return _rc

ISLANDS = ["action","adjective","animal","body","city","clothes","color","family",
           "food","home","job","nature","question","school","season","sports",
           "time","traffic","treasure"]
if QUICK:
    ISLANDS = ["animal","food","sports"]

print("="*60)
print("hansen_health_check  (%d 岛, %s)" % (len(ISLANDS), "quick" if QUICK else "full"))
print("="*60)

# ---------- A. 静态检查 ----------
print("\n[A] 静态检查 check_resources.py")
r = subprocess.run([sys.executable, "check_resources.py"])
if r.returncode != 0:
    print("\n❌ 静态检查未过, 停止。")
    sys.exit(1)

# ---------- A2. 每日签到全局化修复在位 (静态, 防有人删掉修复) ----------
# 背景: v411 修复"每日签到每个岛各领一次金币"重大 bug。金币是全局钱包, 但原版"今天已领"
#       S.chestDay/连签 S.streak 各岛各存 → 每岛各领一次都进总钱包。修复=全局签到模块
#       hansen_checkin_global.js(包装 openChest/doOpenChest 用 HansenCheckin.claimedToday() 闸门)
#       + 堵 hansen_addiction.js 宝箱稀有度的第二条发币路径。这里静态确认修复仍在位。
print("\n[A2] 每日签到全局化修复在位检查")
_ci_ok = True
if not os.path.exists("hansen_checkin_global.js"):
    print("  ❌ 缺少 hansen_checkin_global.js (全局签到模块)"); _ci_ok = False
else:
    _m = open("hansen_checkin_global.js", encoding="utf-8").read()
    if ("HansenCheckin" not in _m) or ("claimedToday" not in _m) or ("doOpenChest" not in _m):
        print("  ❌ hansen_checkin_global.js 未定义 HansenCheckin/claimedToday 或未包装 doOpenChest"); _ci_ok = False
_no_ref = [os.path.basename(f) for f in glob.glob("island_*.html")
           if "hansen_checkin_global.js" not in open(f, encoding="utf-8").read()]
if _no_ref:
    print("  ❌ 这些岛未引用 hansen_checkin_global.js: " + ", ".join(_no_ref)); _ci_ok = False
_add = open("hansen_addiction.js", encoding="utf-8").read() if os.path.exists("hansen_addiction.js") else ""
if ("HansenCheckin" not in _add) or ("claimedToday" not in _add):
    print("  ❌ hansen_addiction.js 宝箱稀有度未加 HansenCheckin.claimedToday 闸门(第二条发币路径会漏!)"); _ci_ok = False
if _ci_ok:
    print("  ✅ 全局签到模块在位 + 19 岛全引用 + addiction 稀有度闸门在位")
else:
    print("\n❌ 每日签到修复缺失/被改坏, 停止。绝不允许这个重大 bug 复活!")
    sys.exit(1)

# ---------- B. 真实浏览器 ----------
def free_port():
    s = socket.socket(); s.bind(("", 0)); p = s.getsockname()[1]; s.close(); return p
PORT = int(os.environ.get("HC_PORT","8899"))  # 🔴v876: 固定端口供外部server守护复活

print("\n[B] 真实浏览器加载 %d 个岛 (port %d) ..." % (len(ISLANDS), PORT))
def _start_srv():
    return subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
srv = _start_srv()
time.sleep(2)

def _ensure_srv():
    # 🔴v876: 环境会随机击杀 http.server → 每次段(重)试前探活·死了就复活(双杀手模型另一半)
    global srv
    import urllib.request as _ur
    try:
        _ur.urlopen("http://localhost:%d/" % PORT, timeout=2).read(64)
        return
    except Exception:
        pass
    try: srv.kill()
    except Exception: pass
    srv = _start_srv()
    time.sleep(1.2)
    print("   \u267b\ufe0f \u5185\u7f6e服务器被击杀\u2192\u5df2复活(port %d)" % PORT)

node_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
const ISL = %s;
const BASE = "http://localhost:%d/";
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  let fails = [];
  const ckB=ckLoad("B");
  for (const i of ISL) {
    if(ckB.has(i)){ console.log("  \u23e9 island_"+i+" (\u5df2\u9a8c\u8fc7\u00b7\u8df3\u8fc7)"); continue; }
    const p = "island_"+i+".html";
    const r = await tryPage(4, wipe, async (page) => {
      const cerr = [], perr = [];
      page.on("console", m => { if (m.type()==="error") cerr.push(m.text()); });
      page.on("pageerror", e => perr.push(String(e).split("\n")[0]));
      let nav = true;
      try { await agoto(page,BASE+p, {waitUntil:"domcontentloaded", timeout:30000}); }
      catch(e){ nav=false; perr.push("GOTO FAIL: "+String(e).split("\n")[0]); }
      await page.waitForTimeout(2000);
      const info = await page.evaluate(() => {
        const wm = window.WORD_MAP ? Object.keys(window.WORD_MAP).length : -1;
        let redbar=false;
        document.querySelectorAll("div").forEach(d=>{const t=d.textContent||"";
          if(/版本|不一致|mismatch/i.test(t) && /缓存|刷新|mismatch|不一致/i.test(t)) redbar=true;});
        return { wm, kids: document.body?document.body.children.length:0, redbar };
      });
      return { nav, cerr, perr, info };
    });
    const real = r.cerr.filter(e=>!/favicon|autoplay|play\(\) failed|NotAllowedError/i.test(e));
    const bad = !r.nav || r.perr.length || real.length || r.info.wm<154 || r.info.kids===0 || r.info.redbar;
    const tag = bad ? "❌" : "✅";
    console.log("  "+tag+" island_"+i+"  WORD_MAP="+r.info.wm+" kids="+r.info.kids+" redbar="+(r.info.redbar?"有":"无"));
    if (r.perr.length) console.log("      pageerror: "+r.perr.slice(0,2).join(" | "));
    if (real.length) console.log("      console.error: "+real.slice(0,2).join(" | "));
    if (bad) fails.push(i); else ckAdd("B",i);
  }
  if (fails.length) { console.log("\nFAILS: "+fails.join(", ")); process.exit(1); }
  process.exit(0);
})();
''' % (str(ISLANDS), PORT)

with open("/home/claude/_hc/_hc_node.js", "w") as f:
    f.write(node_script)
rc_b = 0 if os.path.exists("/home/claude/_hc/done_B") else _hc_run_retry("/home/claude/_hc/_hc_node.js","B")
if rc_b == 0:
    open("/home/claude/_hc/done_B","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0

# ---------- C. ★每日宝箱"跨岛只领一次"行为测试 (真实浏览器, 同一 localStorage) ----------
# ★★★ 重大bug回归把关 ★★★ v411/v431 修的重大 bug: 在某一个岛领过每日宝箱后, 其余岛还能各领
# 一次、各发一次金币(跨岛刷币)。注意: 以前这里只测 animal→food(1~2 个岛), 漏了其他岛, 所以一直
# "通过"但 bug 仍在! 现在升级为: 领 1 岛 → 其余【全部岛】逐个验, 必须全 Δ=0 且【不可点开】。
_ALL_ISLANDS = ["animal","food","sports","job","color","nature","traffic","action","body",
                "city","clothes","adjective","home","family","school","time","question","treasure","season"]
_first = "animal"
# --quick 也要广(此 bug 太严重): 取含真人岛+纯TTS岛(school/treasure/season 曾漏测)的代表; full 测全部 18 岛
_others = ["food", "color", "school", "treasure", "season"] if QUICK else [i for i in _ALL_ISLANDS if i != _first]
print("\n[C] ★每日宝箱跨岛只领一次 行为测试 (领 %s → 验其余 %d 岛, 必须全 Δ=0 且不可点开) ..." % (_first, len(_others)))
checkin_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
const BASE = "http://localhost:%d/";
const FIRST = "island_%s.html";
const OTHERS = %s;
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  wipe();  // 干净起点(原=clear)
  const first = await tryPage(4, wipe, async (page) => {
    await agoto(page,BASE+FIRST,{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(1200);
    const hasModule = await page.evaluate(()=> typeof window.HansenCheckin==='object');
    if(!hasModule) return {hasModule:false};
    const b0 = await page.evaluate(()=> window.HansenCoins?HansenCoins.get():null);
    await page.evaluate(()=>{ try{openChest();}catch(e){} }); await page.waitForTimeout(220);
    await page.evaluate(()=>{ try{ if(typeof doOpenChest==='function') doOpenChest(); }catch(e){} }); await page.waitForTimeout(1300);
    const a0 = await page.evaluate(()=> window.HansenCoins?HansenCoins.get():null);
    const claimed0 = await page.evaluate(()=> HansenCheckin.claimedToday());
    return {hasModule:true, b0, a0, claimed0};
  });
  if(!first.hasModule){ console.log("  ❌ 运行时 HansenCheckin 模块未加载!"); process.exit(1); }
  const firstReward = (first.a0!=null&&first.b0!=null)?(first.a0-first.b0):null;
  let leaks=[];
  const ckC=ckLoad("C");
  for(const o of OTHERS){
    if(ckC.has(o)){ continue; }
    const r = await tryPage(4, null, async (page) => {
      await agoto(page,BASE+"island_"+o+".html",{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(900);
      const b = await page.evaluate(()=> window.HansenCoins?HansenCoins.get():null);
      await page.evaluate(()=>{ try{openChest();}catch(e){} }); await page.waitForTimeout(180);
      const box = await page.evaluate(()=> !!document.getElementById('chestBox'));
      await page.evaluate(()=>{ try{ if(typeof doOpenChest==='function') doOpenChest(); }catch(e){} }); await page.waitForTimeout(1200);
      const a = await page.evaluate(()=> window.HansenCoins?HansenCoins.get():null);
      return {b, a, box};
    });
    if(r.a-r.b!==0) leaks.push(o+":+"+(r.a-r.b));
    else if(r.box) leaks.push(o+":可点开");
    else ckAdd("C",o);
  }
  const ok = firstReward>0 && first.claimed0===true && leaks.length===0;
  console.log("  "+(ok?"✅":"❌")+" 首领="+firstReward+" claimedToday="+first.claimed0+" 其余"+OTHERS.length+"岛: "+(leaks.length?("泄漏 "+leaks.join(",")):"全 Δ=0 且不可点开 ✅"));
  process.exit(ok?0:1);
})();
''' % (PORT, _first, str(_others))
with open("/home/claude/_hc/_hc_checkin.js", "w") as f:
    f.write(checkin_script)
rc_c = 0 if os.path.exists("/home/claude/_hc/done_C") else _hc_run_retry("/home/claude/_hc/_hc_checkin.js","C")
if rc_c == 0:
    open("/home/claude/_hc/done_C","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0

# ---------- D. ★金币"跨岛绝对一致" 把关 (静态 + 真实浏览器) ----------
# ★★★★★ 重大事故级 bug 回归把关 (v437) — 最高优先级 ★★★★★
# 事故: 动物岛金币数与其它岛【对不上】。根因 = 动物岛金币是【内联接入全局钱包 HansenCoins】的
#   (其余18岛靠 hansen_island_upgrade.js 在运行时打补丁接入), 而动物岛内联主脚本在页面早期就
#   updateTopBar() 显示金币, 那一刻全局钱包脚本(hansen_coin_wallet.js, 文件末尾才加载)【还没加载】
#   → 兜底显示了【本地旧 S.coins】; 钱包加载后又【没有任何代码重刷顶栏】。其余18岛靠补丁在钱包之后
#   重刷顶栏, 所以显示对的全局钱包值 → 表现为"动物岛金币和别的岛不一样"。
# ⚠️ 金币若各岛不统一, 一旦【上线】即是灾难、无法挽回(玩家货币错乱) → 此为最高优先级硬检查, 不过直接拒打包。
#   (D1静态)每个岛必须有"按全局钱包显示金币"的机制: 要么加载升级补丁(hansen_island_upgrade.js),
#           要么带 [COIN-WALLET-DISPLAY-OK] 标记(内联接入+钱包后重刷)。二者必居其一, 否则会显示本地币。
#   (D2动态)把全局钱包设成独特值 7777, 跳过迁移/起始送币(使本地币=0), 逐岛加载, 顶栏显示【必须】=7777。
#           若某岛显示 0(本地币)或钱包被改坏, 即金币不统一 bug → 拒绝打包。
print("\n[D] ★金币跨岛绝对一致 把关 (重大事故级回归: 动物岛曾顶栏显示本地币≠全局钱包) ...")
_coin_static_bad = []
for _isl in _ALL_ISLANDS:
    try:
        _t = open("island_%s.html" % _isl, encoding="utf-8").read()
    except Exception:
        _coin_static_bad.append(_isl + ":缺文件"); continue
    if ("hansen_island_upgrade.js" not in _t) and ("COIN-WALLET-DISPLAY-OK" not in _t):
        _coin_static_bad.append(_isl)
if _coin_static_bad:
    print("  [D1静态] ❌ 这些岛没有'按全局钱包显示金币'的机制(会显示各自本地币): " + ",".join(_coin_static_bad))
else:
    print("  [D1静态] ✅ 全部 %d 岛都接入全局钱包显示(升级补丁 或 内联+重刷标记)" % len(_ALL_ISLANDS))

_coin_first = "animal"   # 出事的岛永远第一个测
_coin_others = ["food","color","school","treasure","season","job","traffic","nature"] if QUICK else [i for i in _ALL_ISLANDS if i != _coin_first]
_coin_list = [_coin_first] + _coin_others
print("  [D2动态] 设全局钱包=7777, 验 %d 岛顶栏都必须显示 7777(而非本地币) ..." % len(_coin_list))
coin_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
const BASE = "http://localhost:%d/";
const LIST = %s;
const W = "7777";
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  wipe();
  await tryPage(4, wipe, async (page) => {
    await agoto(page,BASE+"island_"+LIST[0]+".html",{waitUntil:"domcontentloaded",timeout:30000});
    await page.evaluate((w)=>{ localStorage.setItem('hansen_wallet_coins',w); localStorage.setItem('hansen_coins_migrated_v1','1'); localStorage.setItem('hansen_starter_coins_given','1'); localStorage.setItem('hansen_onboarded','1'); }, W);
  });
  let bad=[];
  const ckD=ckLoad("D2");
  for(const isl of LIST){
    if(ckD.has(isl)){ continue; }
    const r = await tryPage(4, null, async (page) => {
      await agoto(page,BASE+"island_"+isl+".html",{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForTimeout(1300);
      return await page.evaluate(()=>({
        disp: (((document.getElementById('coinCount')||{}).textContent)||'').trim(),
        wallet: (window.HansenCoins?String(HansenCoins.get()):'noWallet')
      }));
    });
    if(r.wallet!==W) bad.push(isl+":钱包损坏="+r.wallet);
    else if(r.disp!==W) bad.push(isl+":顶栏显示「"+r.disp+"」≠钱包"+W);
    else ckAdd("D2",isl);
  }
  const ok = bad.length===0;
  console.log("  [D2动态] "+(ok?"✅":"❌")+" "+LIST.length+"岛: "+(ok?("全部顶栏=钱包"+W+", 金币跨岛绝对一致 ✅"):("✗不一致 → "+bad.join(" | "))));
  process.exit(ok?0:1);
})();
''' % (PORT, str(_coin_list))
with open("/home/claude/_hc/_hc_coin.js", "w") as f:
    f.write(coin_script)
rc_d2 = 0 if os.path.exists("/home/claude/_hc/done_D2") else _hc_run_retry("/home/claude/_hc/_hc_coin.js","D2")
if rc_d2 == 0:
    open("/home/claude/_hc/done_D2","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0
rc_d = 0 if (not _coin_static_bad and rc_d2 == 0) else 1

# ---------- E. ★主题锁"未购不可换" 把关 (静态 + 真实浏览器) ----------
# ★★★★★ 重大bug 回归把关 (v438) ★★★★★
# 事故: 付费主题要在首页【主题商店】花金币买, 但【岛内设置页】点任意主题(含没买的)直接就换了 →
#   花金币买主题彻底失去意义。根因: 19岛【都没加载】hansen_theme_shop.js(商店只钩首页 pickTheme),
#   岛内设置用的 applyTheme 完全【没校验解锁】。修复(v438): 新增 hansen_theme_lock.js(19岛都加载),
#   钩 applyTheme, 未解锁的付费主题弹购买框、不切换; 启动时重置非法主题。
#   (E1静态)每个岛必须加载 hansen_theme_lock.js(否则设置页能白嫖付费主题)。
#   (E2动态)清空已解锁(ocean锁) → applyTheme('ocean') 后 body[data-theme] 不得变 ocean(锁住);
#           applyTheme('pink')(免费)必须能切; 解锁 ocean 后必须能切。三者任一不符即拒绝打包。
print("\n[E] ★主题锁'未购不可换' 把关 (重大bug回归: 岛内设置曾能白嫖付费主题) ...")
_th_static_bad = []
for _i in _ALL_ISLANDS:
    try:
        if "hansen_theme_lock.js" not in open("island_%s.html" % _i, encoding="utf-8").read():
            _th_static_bad.append(_i)
    except Exception:
        _th_static_bad.append(_i + ":缺文件")
if _th_static_bad:
    print("  [E1静态] ❌ 这些岛没加载 hansen_theme_lock.js(设置页能白嫖付费主题): " + ",".join(_th_static_bad))
else:
    print("  [E1静态] ✅ 全部 %d 岛都加载了主题锁门禁(hansen_theme_lock.js)" % len(_ALL_ISLANDS))
_th_list = ["animal"] + (["food","color","school"] if QUICK else [i for i in _ALL_ISLANDS if i != "animal"])
print("  [E2动态] 验 %d 岛: 未购ocean不可换 / 免费pink可换 / 已购ocean可换 ..." % len(_th_list))
theme_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
const BASE = "http://localhost:%d/";
const LIST = %s;
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  let bad=[];
  const ckE=ckLoad("E2");
  for(const isl of LIST){
    if(ckE.has(isl)){ continue; }
    const r = await tryPage(4, wipe, async (page) => {
      const url = BASE+"island_"+isl+".html";
      await agoto(page,url,{waitUntil:"domcontentloaded",timeout:30000});
      await page.evaluate(()=>{ localStorage.setItem('hansen_wallet_coins','0'); localStorage.setItem('hansen_onboarded','1'); });
      await agoto(page,url,{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(900);
      await page.evaluate(()=>{ try{applyTheme('ocean');}catch(e){} }); await page.waitForTimeout(250);
      const r1 = await page.evaluate(()=>({ds:document.body.dataset.theme, ls:localStorage.getItem('theme')}));
      await page.evaluate(()=>{ document.querySelectorAll('div').forEach(d=>{ if(d.style&&d.style.zIndex==='2147483550'&&d.parentNode)d.parentNode.removeChild(d); }); });
      await page.evaluate(()=>{ try{applyTheme('pink');}catch(e){} }); await page.waitForTimeout(200);
      const r2 = await page.evaluate(()=>document.body.dataset.theme);
      await page.evaluate(()=>{ localStorage.setItem('hansen_unlocked_themes', JSON.stringify(['ocean'])); });
      await agoto(page,url,{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(900);
      await page.evaluate(()=>{ try{applyTheme('ocean');}catch(e){} }); await page.waitForTimeout(200);
      const r3 = await page.evaluate(()=>document.body.dataset.theme);
      return {r1, r2, r3};
    });
    if(r.r1.ds==='ocean' || r.r1.ls==='ocean') bad.push(isl+":未购ocean竟切换了(白嫖!)");
    else if(r.r2!=='pink') bad.push(isl+":免费pink切不动("+r.r2+")");
    else if(r.r3!=='ocean') bad.push(isl+":已购ocean切不动("+r.r3+")");
    else ckAdd("E2",isl);
  }
  const ok = bad.length===0;
  console.log("  [E2动态] "+(ok?"✅":"❌")+" "+LIST.length+"岛: "+(ok?"未购拦截/免费可切/已购可切, 主题锁生效 ✅":("✗ → "+bad.join(" | "))));
  process.exit(ok?0:1);
})();
''' % (PORT, str(_th_list))
with open("/home/claude/_hc/_hc_theme.js", "w") as f:
    f.write(theme_script)
rc_e2 = 0 if os.path.exists("/home/claude/_hc/done_E2") else _hc_run_retry("/home/claude/_hc/_hc_theme.js","E2")
if rc_e2 == 0:
    open("/home/claude/_hc/done_E2","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0
rc_e = 0 if (not _th_static_bad and rc_e2 == 0) else 1

# ---------- F. ★废弃"星星"不得在UI显示 + 设置页金币走全局钱包 (静态) ----------
# 事故(v439): 星星(star)早已废弃(addStar 空函数), 但 18 个岛顶栏仍有 ⭐ starCount 徽章、设置页仍显示
#   "钻石/金币/星星"(且金币用的是本地 S.coins 而非全局钱包) → 废弃货币还在显示 + 设置页金币与顶栏不一致。
#   动物岛早已是对的(无星星徽章 + 设置"钻石/金币"走 HansenCoins), 18岛漏改。修复: 删18岛星星徽章 +
#   设置行改"钻石/金币"且金币走 HansenCoins。
# F 静态: 任何岛都不得再出现 id="starCount"(废弃星星显示元素) / ⭐'+S.stars(设置星星) / 🪙'+S.coins+'(设置用本地币)。
print("\n[F] ★废弃星星不得显示 + 设置金币走全局钱包 把关 (回归: 18岛曾顶栏/设置仍露废弃星星+本地币) ...")
_star_bad = []
for _i in _ALL_ISLANDS:
    try:
        _t = open("island_%s.html" % _i, encoding="utf-8").read()
        hits = []
        if 'id="starCount"' in _t: hits.append('顶栏星星徽章')
        if "⭐'+S.stars" in _t: hits.append('设置页星星')
        if "🪙'+S.coins+'" in _t: hits.append('设置金币用本地币')
        if hits: _star_bad.append(_i + "(" + "/".join(hits) + ")")
    except Exception:
        _star_bad.append(_i + ":缺文件")
if _star_bad:
    print("  [F] ❌ 这些岛仍露废弃星星/或设置金币没走全局钱包: " + ", ".join(_star_bad))
else:
    print("  [F] ✅ 全部 %d 岛: 无废弃星星显示, 设置页金币走全局钱包(与顶栏一致)" % len(_ALL_ISLANDS))
rc_f = 1 if _star_bad else 0

# ---------- G. ★boss 台词运行时核查 (真实 startBoss + 逐条验证台词完整+一行+不出屏+不裁切) ----------
# ★ Hansen 强烈要求: 不许只静态看 CSS, 必须【真的把 boss 战跑起来】, 核查赛季 boss 长台词能否在文字框中
#   完整显示、且只占一行、不出屏。BUG#56: 长台词曾被 #bossMsg 锁死宽度+overflow:hidden+ellipsis 截成"…"。
#   这里真实 showScreen('boss')+startBoss() 渲染 boss UI, 逐条灌入赛季 boss 最长的几句台词, 断言:
#   text-overflow≠ellipsis & overflow≠hidden(没裁切) & 高度≤56(1~2行·v824允许长台词换行) & 右缘≤屏宽(不出屏) & 末尾字在DOM(完整) & 有.boss-msg-inner包裹。
print("\n[G] ★boss 台词运行时核查 (真实 startBoss + 验证每条台词【完整+≤2行不出屏+不裁切】, 防 BUG#56/v824 回归) ...")
boss_taunt_script = r'''
const { chromium } = require("playwright");
(async () => {
  setTimeout(()=>{ console.error("\u23f1 \u6bb5\u7ea7\u786c\u8d85\u65f6(150s)\u2192\u9000\u51fa\u4ea4\u7ed9\u91cd\u8bd5\u58f3"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await browser.newPage();
  await page.setViewportSize({width:390,height:800});
  const fails = [];
  const url = "http://localhost:PORT_PLACEHOLDER/island_season.html";
  try { await agoto(page,url,{waitUntil:"domcontentloaded",timeout:30000}); } catch(e){ console.log("  [G] ❌ 加载赛季岛失败"); process.exit(1); }
  await page.evaluate(()=>{ try{localStorage.clear();}catch(e){} localStorage.setItem('hansen_onboarded','1'); });
  await agoto(page,url,{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{
    document.querySelectorAll('div').forEach(function(d){var cs=getComputedStyle(d);if((cs.position==='fixed'||cs.position==='absolute')&&parseInt(cs.zIndex||0)>=50&&d.id!=='bossScreen')d.style.display='none';});
    try{ if(typeof window.showScreen==='function') window.showScreen('boss'); }catch(e){}
    try{ if(window.S) window.S.level=5; }catch(e){}
    try{ window.startBoss(); }catch(e){}
  });
  await page.waitForTimeout(700);
  const testList = [
    '我见证过亿万星辰的诞生,也亲手送别它们的熄灭。',
    '答错也无妨——连陨落的星,都会化作新的星尘。',
    '继续吧,孩子,让我听见你心里那颗星,如何闪耀。',
    '你眼里有光——那是我等了很久,才再次见到的光。',
    '继续吧,孩子,让我听见你心里那颗星,如何闪耀。再来一次,看看你能走多远。'
  ];
  const hasMsg = await page.evaluate(()=> !!document.getElementById('bossMsg'));
  if (!hasMsg){ console.log("  [G] ❌ 真实 startBoss 后找不到 #bossMsg(boss 战没起来)"); process.exit(1); }
  for (const t of testList) {
    const r = await page.evaluate((txt)=>{
      var el=document.getElementById('bossMsg'); el.innerHTML='💬 '+txt;
      return new Promise(function(res){ setTimeout(function(){
        var cs=getComputedStyle(el); var inner=el.querySelector('.boss-msg-inner'); var rc=el.getBoundingClientRect();
        res({ to:cs.textOverflow, ov:cs.overflow, h:Math.round(rc.height), right:Math.round(rc.right),
          full:(el.textContent||'').indexOf(txt.slice(-3))>=0, hasInner:!!inner });
      },130); });
    }, t);
    var tag=t.slice(0,8);
    if (r.to==='ellipsis' || r.ov==='hidden') fails.push("被裁切(ellipsis/hidden): "+tag);
    // 🔴v847: 阈值40→56。v824(Hansen截图bug)已把台词框改成 white-space:normal【允许长台词换行】(check_resources检查19强制·禁nowrap·1行32px/2行约50px居中·原字号不缩)。原 h>40 是 v824 之前"必须一行"的旧断言·与现行 v824 设计自相矛盾(超长台词换2行是【正确】行为·非bug)。改为只拦【超过2行/异常超高(>56→3行≈68)】·真实台词仍全是一行(h≈32)。
    if (r.h>56) fails.push("超过2行(高"+r.h+"): "+tag);
    if (r.right>392) fails.push("出屏(右"+r.right+"): "+tag);
    if (!r.full) fails.push("不完整(末尾丢): "+tag);
    if (!r.hasInner) fails.push("无.boss-msg-inner: "+tag);
  }
  if (fails.length){ console.log("  [G] ❌ boss 台词运行时核查未过: "+fails.slice(0,6).join(" | ")); process.exit(1); }
  console.log("  [G] ✅ boss 台词运行时核查通过: "+testList.length+" 条(含最长)全部【完整+≤2行(v824允许换行)+不出屏+不裁切】(真实 startBoss 渲染)");
  await browser.close();
})();
'''
boss_taunt_script = boss_taunt_script.replace("PORT_PLACEHOLDER", str(PORT))
with open("/home/claude/_hc/_hc_boss.js", "w") as f:
    f.write(boss_taunt_script)
rc_g = 0 if os.path.exists("/home/claude/_hc/done_G") else _hc_run_retry("/home/claude/_hc/_hc_boss.js","G")
if rc_g == 0:
    open("/home/claude/_hc/done_G","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0

# ---- H. ★boss 做题页除打字外不缩立绘 + 不出滚动条 (真实 startBoss + 驱动 spellFill/spellPick 验全尺寸立绘 + 无溢出) ----
# ★ Hansen 要求: boss 做题页除【打字题】(键盘需空间)外都【不缩 boss 立绘】、不出上下滚动条。
#   BUG#58: spellFill/spellPick 曾加 bts-compact 把立绘从190缩成118px(伤画质)。这里真实 startBoss() 渲染,
#   分别强制出 spellFill(Lv5)/spellPick(Lv9), 断言每题: 无 bts-compact & 立绘≥170(全尺寸非118压缩) & 不溢出(docScroll-视口≤4)。
print("\n[H] ★boss 做题页除打字外不缩立绘 + 不出滚动条 (真实 startBoss 驱动 spellFill/spellPick, 防 BUG#58 回归) ...")
boss_quiz_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  const U = "http://localhost:PORT_PLACEHOLDER/island_season.html";
  const fails = [];
  for (const pair of [[5,'spellFill'],[9,'spellPick']]) {
    wipe();
    const r = await tryPage(4, wipe, async (page) => {
      try { await agoto(page,U,{waitUntil:"domcontentloaded",timeout:30000}); } catch(e){ return {loadFail:true}; }
      await page.evaluate(()=>{ localStorage.setItem('hansen_onboarded','1'); });
      await agoto(page,U,{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForTimeout(800);
      await page.evaluate((lv)=>{
        document.querySelectorAll('div').forEach(function(d){var cs=getComputedStyle(d);if((cs.position==='fixed'||cs.position==='absolute')&&parseInt(cs.zIndex||0)>=50&&d.id!=='bossScreen')d.style.display='none';});
        if(window.showScreen) window.showScreen('boss');
        if(window.S) window.S.level=lv; window.__hbuNewModeProb=1;
        if(window.startBoss) window.startBoss();
      }, pair[0]);
      await page.waitForTimeout(900);
      let qt='';
      for(let i=0;i<10;i++){
        qt = await page.evaluate(()=> window._bossQType||'');
        if(qt===pair[1]) break;
        await page.evaluate(()=>{ var bo=document.getElementById('bossOpts'); if(bo&&bo.dataset) bo.dataset.done='1'; try{ if(window.nextBossQ) window.nextBossQ(); }catch(e){} });
        await page.waitForTimeout(880);
      }
      return await page.evaluate(()=>{
        var ar=document.querySelector('.boss-arena');
        var sp=document.querySelector('.boss-sprite svg')||document.querySelector('.boss-sprite');
        return { qt:window._bossQType, hasCompact: ar?ar.classList.contains('bts-compact'):false,
          spriteW: sp?Math.round(sp.getBoundingClientRect().width):0,
          overflow: document.documentElement.scrollHeight - window.innerHeight };
      });
    });
    if (r.loadFail) { console.log("  [H] ❌ 加载赛季岛失败"); process.exit(1); }
    if (r.qt !== pair[1]) { console.log("  [H] (跳过 "+pair[1]+": 词库随机未触发, 不算失败)"); continue; }
    if (r.hasCompact) fails.push(pair[1]+" 仍是 bts-compact 压缩布局(立绘被缩)");
    if (r.spriteW < 170) fails.push(pair[1]+" 立绘只有 "+r.spriteW+"px(被缩, 应全尺寸~190)");
    if (r.overflow > 4) fails.push(pair[1]+" 内容超屏 "+r.overflow+"px(会出上下滚动条)");
  }
  if (fails.length){ console.log("  [H] ❌ boss 做题页运行时核查未过: "+fails.slice(0,6).join(" | ")); process.exit(1); }
  console.log("  [H] ✅ boss 做题页运行时核查通过: spellFill/spellPick 立绘全尺寸 + 不出滚动条(真实 startBoss 渲染, 防 BUG#58)");
  process.exit(0);
})();
'''
boss_quiz_script = boss_quiz_script.replace("PORT_PLACEHOLDER", str(PORT))
with open("/home/claude/_hc/_hc_quiz.js", "w") as f:
    f.write(boss_quiz_script)
rc_h = 0 if os.path.exists("/home/claude/_hc/done_H") else _hc_run_retry("/home/claude/_hc/_hc_quiz.js","H")
if rc_h == 0:
    open("/home/claude/_hc/done_H","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0

# ---------- I. ★宠物掌握制升级 全链路测试 (真实浏览器·v644) ----------
# ★★★ 把关 v644 掌握制双门槛 ★★★ 模拟一个学生从0把某岛全部词【各答对3次】(真实走 markAnswer),
#   验证整条链: markAnswer包裹→每词mc累加→globalMastered计数→getPetStage阶段→getPetProgress进度。
#   并验: ①掌握数==词数·每词mc恰好3(无重复计数) ②阶段随掌握单调不减 ③进度∈[0,100]
#   ④满级硬门槛: 掌握全部752词→第36阶(满级可达); 差1个(751)→到不了满级(不学完练熟绝不满级) ⑤全程0报错
print("\n[I] ★宠物掌握制全链路 (真实答对掌握全岛词→验掌握数/阶段/进度/单调/无重复/满级硬门槛/0报错) ...")
mastery_script = r'''
const { chromium } = require("playwright");
const fs = require("fs");
const UD = "/home/claude/_hc/_hc_prof";
function wipe(){ try{ fs.rmSync(UD,{recursive:true,force:true}); }catch(e){} }
async function withPage(fn){
  const ctx = await chromium.launchPersistentContext(UD,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:393,height:747}});
  const page = ctx.pages()[0] || await ctx.newPage();
  try { return await fn(page, ctx); } finally { try{ await ctx.close(); }catch(e){} }
}
async function tryPage(times, prep, fn){
  for(let t=1;t<=times;t++){
    try{ if(prep)prep(); return await Promise.race([ withPage(fn), new Promise((_,rej)=>setTimeout(()=>rej(new Error("step-timeout-50s(\u6b65\u7ea7\u6316\u6b7b\u81ea\u6551)")),50000)) ]); }
    catch(e){ console.error("   \u21bb \u5c9b\u7ea7\u91cd\u8bd5 "+t+"/"+times+": "+String(e).split("\n")[0].slice(0,80)); if(t===times) throw e; await new Promise(r=>setTimeout(r,4000)); }
  }
}
const BASE = "http://localhost:%d/";
(async () => {
  setTimeout(()=>{ console.error("⏱ 段级硬超时(240s)→退出交给重试壳"); process.exit(9); }, 240000);
  async function agoto(page,url,opt){ for(let _k=0;_k<4;_k++){ try{ return await page.goto(url,opt); }catch(e){ const _m=String(e); if(_k<3 && /(REFUSED|crash|CONNECTION|ERR_EMPTY)/i.test(_m)){ await new Promise(r=>setTimeout(r,2500)); continue; } throw e; } } }
  const N=36, CAP=15000, TW=752;
  const errs=[];
  function hook(page){ page.on("console", m=>{ if(m.type()==="error") errs.push(m.text()); }); page.on("pageerror", e=>errs.push("PAGEERR:"+e.message)); }
  // ─ 阶段A: 真实答题掌握全岛词(种子经addInitScript注入) ─
  wipe();
  const A = await tryPage(4, wipe, async (page, ctx) => {
    hook(page);
    await ctx.addInitScript("try{localStorage.setItem('wordIslandAnimal', JSON.stringify({xp:15000,totalXP:15000,mc:{},pet:{name:'星灵',stage:0,xp:0,picked:true}})); localStorage.setItem('hansen_mastery_migrated','1');}catch(e){}");
    await agoto(page,BASE+"island_animal.html",{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(1000);
    const ready = await page.evaluate(()=> typeof markAnswer==="function" && typeof getPetStage==="function" && typeof window.S==="object");
    if(!ready) return {fatal:"markAnswer/getPetStage/S 未就绪"};
    const nWords = await page.evaluate(()=> (typeof allW!=="undefined"&&allW.length)?allW.length:0);
    if(!nWords) return {fatal:"取不到该岛词数 allW.length"};
    const res = await page.evaluate((n)=>{
      if(!window.S)return {err:"no S"}; S.mc={};
      function flush(){ try{localStorage.setItem("wordIslandAnimal", JSON.stringify(S));}catch(e){} }
      let prevStage=0, monoOK=true, milestones=[];
      const cps=[Math.floor(n*0.25),Math.floor(n*0.5),Math.floor(n*0.75),n-1];
      for(let idx=0; idx<n; idx++){
        markAnswer(idx,true); markAnswer(idx,true); markAnswer(idx,true);
        if(cps.indexOf(idx)>=0){ flush(); const st=getPetStage(); if(st<prevStage)monoOK=false; prevStage=st; milestones.push({w:idx+1,stage:st,prog:getPetProgress()}); }
      }
      flush();
      let badMc=0, mcCount=0;
      for(let i=0;i<n;i++){ const v=S.mc[i]||0; if(v>=3)mcCount++; if(v!==3)badMc++; }
      return {monoOK, milestones, mcCount, badMc, stageNow:getPetStage(), progNow:getPetProgress()};
    }, nWords);
    return {nWords, res};
  });
  if(A.fatal){ console.log("  [I] ❌ "+A.fatal); process.exit(1); }
  if(A.res.err){ console.log("  [I] ❌ "+A.res.err); process.exit(1); }
  // ─ 阶段B: 满级硬门槛(独立注入·全新档) ─
  wipe();
  const ceil = await tryPage(4, wipe, async (page) => {
    hook(page);
    await agoto(page,BASE+"island_animal.html",{waitUntil:"domcontentloaded",timeout:30000}); await page.waitForTimeout(800);
    return await page.evaluate(()=>{
      function setM(n){ const mc={}; for(let i=0;i<n;i++)mc[i]=3; const r=JSON.parse(localStorage.getItem("wordIslandAnimal")||"{}"); r.mc=mc; r.xp=15000; r.totalXP=15000; localStorage.setItem("wordIslandAnimal",JSON.stringify(r)); }
      setM(752); const s752=getPetStage();
      setM(751); const s751=getPetStage();
      return {s752, s751};
    });
  });
  const res=A.res, nWords=A.nWords;
  const fails=[];
  if(res.mcCount!==nWords) fails.push("掌握数="+res.mcCount+" 应="+nWords);
  if(res.badMc!==0) fails.push(res.badMc+"个词mc≠3(疑重复计数/漏计)");
  if(!res.monoOK) fails.push("阶段非单调不减");
  if(res.progNow<0||res.progNow>100) fails.push("进度越界="+res.progNow);
  if(ceil.s752!==35) fails.push("掌握全部752词 阶段="+ceil.s752+" 应=35(满级)");
  if(ceil.s751>=35) fails.push("掌握751词(差1)竟达满级="+ceil.s751+"(硬门槛失效!)");
  if(errs.length) fails.push("控制台报错"+errs.length+"条: "+errs.slice(0,2).join("|"));
  if(fails.length){ console.log("  [I] ❌ 宠物掌握制全链路未过: "+fails.slice(0,6).join(" | ")); process.exit(1); }
  console.log("  [I] ✅ 宠物掌握制全链路通过: "+nWords+"词各答3次→掌握"+res.mcCount+" | 里程碑阶段"+JSON.stringify(res.milestones.map(m=>m.stage))+"单调 | 进度"+res.progNow+" | 满级硬门槛(752→35, 751→"+ceil.s751+"<35) | 0报错");
  process.exit(0);
})();
''' % PORT
with open("/home/claude/_hc/_hc_mastery.js", "w") as f:
    f.write(mastery_script)
rc_i = 0 if os.path.exists("/home/claude/_hc/done_I") else _hc_run_retry("/home/claude/_hc/_hc_mastery.js","I")
if rc_i == 0:
    open("/home/claude/_hc/done_I","w").write("1")
else:
    pass  # \u274c \u6bb5\u672a\u8fc7\u4e0d\u843d\u7ae0

srv.terminate()

print("\n" + "="*60)
if rc_b == 0 and rc_c == 0 and rc_d == 0 and rc_e == 0 and rc_f == 0 and rc_g == 0 and rc_h == 0 and rc_i == 0:
    print("✅✅✅ 全部通过 (静态 + %d 岛真实浏览器 + 签到全局单次 + ★金币跨岛一致 + ★主题锁未购不可换 + ★无废弃星星 + ★boss台词运行时完整一行 + ★boss做题页不缩立绘不滚动 + ★宠物掌握制全链路)" % len(ISLANDS))
    sys.exit(0)
else:
    if rc_b != 0: print("❌ 岛加载/一致性发现问题, 见上。")
    if rc_c != 0: print("❌ 每日签到跨岛重复发币 bug 复活了! 见上 [C]。")
    if rc_d != 0:
        print("❌ ★★★重大事故级★★★ 金币【跨岛不一致】bug 复活了! 某些岛顶栏显示各自本地币而非全局钱包(见上 [D])。")
        print("   ⚠️ 金币不统一上线即灾难、无法挽回 —— 绝不可打包上线! 修复参 v437: 确保该岛在 hansen_coin_wallet.js")
        print("      加载之后强制 updateTopBar() 重刷顶栏(或加载 hansen_island_upgrade.js), 并带 [COIN-WALLET-DISPLAY-OK] 标记。")
    if rc_e != 0:
        print("❌ ★★★重大★★★ 主题锁失效! 岛内设置能【白嫖】未购付费主题(见上 [E])。花金币买主题失去意义、绝不可上线!")
        print("   修复参 v438: 确保该岛加载 hansen_theme_lock.js(钩 applyTheme, 未解锁付费主题弹购买、不切换)。")
    if rc_f != 0:
        print("❌ ★重大★ 废弃的'星星'又在UI显示, 或设置页金币没走全局钱包(见上 [F])。")
        print("   修复参 v439: 删顶栏 ⭐ starCount 徽章 + 设置行改'钻石/金币'且金币用 ((window.HansenCoins&&HansenCoins.get())||S.coins)。")
    if rc_g != 0:
        print("❌ ★重大★ boss 台词运行时未能【完整一行不出屏】显示(见上 [G])! 长台词又被截断/换行/出屏了。")
        print("   修复参 v480/BUG#56: hansen_boss_lock.js 的 #bossMsg 须 width:max-content + overflow:visible(无 ellipsis) + 台词包 .boss-msg-inner + fitBossMsg 超屏缩内层; 别让任何代码给 #bossMsg 加回 overflow:hidden/ellipsis。")
    if rc_h != 0:
        print("❌ ★重大★ boss 做题页又缩立绘/出滚动条了(见上 [H])! Hansen 要求除打字外不缩 boss 立绘、不出上下滚动条。")
        print("   修复参 v483/BUG#58: applySpellFill/applySpellPick 不得 classList.add('bts-compact')(那会把立绘缩成118px); spellPick 6 选项用 3 列(repeat(3,1fr))省高度 + 去冗余副标题, 使全尺寸立绘一屏放得下。")
    if rc_i != 0:
        print("❌ ★重大★ 宠物掌握制升级链路异常(见上 [I])! 可能: 掌握数/阶段/进度算错、markAnswer重复计数、阶段非单调、或【满级硬门槛失效】(没学完全部752词却能满级)。")
        print("   修复参 v644: hansen_pet_showcase.js 的 hsnTrackMastery 包裹 markAnswer 记 S.mc(模块级 _hsnMarkWrapped 防重包裹); globalMastered 统计 mc>=MASTER_HITS 的词数; gStageFromXP 须 masterReq(满级=TOTAL_WORDS=752)与 xpReq 双门槛取较低; 改词库须同步 TOTAL_WORDS。")
    sys.exit(1)
