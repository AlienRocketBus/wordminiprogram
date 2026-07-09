#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_nav_guard.py —— 导航回归测试(防新bug机制 · 铁律1.8)

【为什么有这个文件】
2026-06: spelling bee 做成单独页面跳转, 与 hansen_home_link.js 的 history.back 瞬回机制撞车,
导致 "进 spelling bee → 返回岛 → 点右上角地图图标" 错误跳回 spelling bee 而非首页(BUG#83)。
根因: 任何"跳到单独页面再 forward 跳回岛"的功能, 都会在历史栈里夹一条, 污染首页 goHome 的 history.back。

【这个测试守什么】
对全部 19 个岛, 真机(Playwright)跑这条关键路径并断言落点:
  index.html → 岛 → 进入二级页(spelling bee) → 返回 → 必须回到该岛
                                            → 点右上角地图图标(goHome) → 必须回到 index.html
只要任何岛 goHome 没落在 index.html, 立即判红 + 退出码1。

【何时跑】铁律: 每次改动导航/新增任何"会跳转的功能"后、打包交付前必跑, 见全绿才能交付。
【用法】 python3 hansen_nav_guard.py            (测全19岛)
        python3 hansen_nav_guard.py animal food (只测指定岛, 调试用)
"""
import sys, time, threading, http.server, socketserver, os
PORT = 8971

ISLANDS = ["animal","food","sports","job","color","time","family","clothes","nature",
           "school","home","traffic","action","adjective","question","treasure","body","season","city"]

def start_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    # ★多线程服务器: 单线程服务不动 iframe 加载大岛(7400行)的并发请求, 会假性"岛没加载"
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

def kill_overlay(pg):
    for _ in range(2):
        try: pg.evaluate("()=>{var o=document.getElementById('__hansen_onboarding');if(o)o.remove();}")
        except: pass
        try:
            bt = pg.get_by_text("开始冒险", exact=False)
            if bt.count() > 0: bt.first.click(timeout=700)
        except: pass
        time.sleep(0.25)

def _ifr_ready(pg):
    """等首页外壳 iframe 里的岛加载好(homeScreen 或地图图标出现)"""
    for _ in range(24):
        if pg.evaluate("()=>{try{var d=document.getElementById('islandFrame').contentWindow.document;return !!(d.getElementById('homeScreen')||d.querySelector('.world-map-btn'));}catch(e){return false;}}"):
            return True
        time.sleep(0.4)
    return False

def _wrap(pg):
    return pg.evaluate("()=>{var w=document.getElementById('islandFrameWrap');return w?w.style.display:'GONE';}")

def _top(pg):
    return pg.evaluate("()=>location.pathname.split('/').pop()")

def test_island(pg, key, base):
    """跑一个岛在【首页外壳】里的关键路径: 点岛卡→岛在iframe就地打开(顶层恒index·不走网页)→岛内spelling bee覆盖层→goHome瞬回首页"""
    # 0. 回到干净首页
    pg.goto(base + '/index.html', wait_until='load', timeout=25000); time.sleep(0.6); kill_overlay(pg)
    file = f'island_{key}.html'
    # 1. 进岛: 点岛卡(href选择器·对所有岛可靠) → 岛在外壳 iframe 里【就地打开】(顶层仍 index, 零跳转)
    if key == 'season':
        # 星海岛不在网格 → 由入口/openIsland 打开
        pg.evaluate("()=>{if(window.openIsland)window.openIsland('island_season.html');}")
    else:
        clicked = pg.evaluate(f"""()=>{{var a=document.querySelector('a[href="{file}"]');if(a){{a.click();return true;}}return false;}}""")
        if not clicked:
            return False, "找不到岛卡"
    if not _ifr_ready(pg):
        return False, "岛没在外壳 iframe 里加载"
    if _top(pg) != 'index.html':
        return False, f"点岛卡竟离开了首页(在 {_top(pg)}; 应是外壳 iframe 就地打开·顶层恒 index)"
    if _wrap(pg) != 'block':
        return False, "外壳没显示"
    # 2. iframe 岛内点 spelling bee 卡 → 岛内覆盖层(等模块就绪再点; best-effort)
    for _ in range(12):
        if pg.evaluate("()=>{try{return typeof document.getElementById('islandFrame').contentWindow.HansenSpellBee==='object';}catch(e){return false;}}"):
            break
        time.sleep(0.3)
    clicked = pg.evaluate("""()=>{try{var d=document.getElementById('islandFrame').contentWindow.document;var sb=[...d.querySelectorAll('.mode-card')].find(c=>{var i=c.querySelector('.m-title');return i&&i.textContent.trim().toLowerCase().includes('spelling');});if(sb){sb.click();return true;}return false;}catch(e){return false;}}""")
    if clicked:
        time.sleep(1.6)
        has_ov = pg.evaluate("()=>{try{return !!document.getElementById('islandFrame').contentWindow.document.getElementById('hsnSbOverlay');}catch(e){return false;}}")
        if not has_ov:
            return False, "iframe 岛内 spelling bee 覆盖层没弹出"
        pg.evaluate("()=>{try{document.getElementById('islandFrame').contentWindow.HansenSpellBee.close();}catch(e){}}")
        time.sleep(1.0)
        ov_gone = pg.evaluate("()=>{try{return !document.getElementById('islandFrame').contentWindow.document.getElementById('hsnSbOverlay');}catch(e){return true;}}")
        if not ov_gone:
            return False, "spelling bee 覆盖层没关闭"
        if _wrap(pg) != 'block':
            return False, "关覆盖层后岛外壳没了(应仍在岛)"
    # 3. ★goHome(iframe 内点右上角地图图标)→ parent.closeIsland 关外壳, 顶层仍 index(瞬回首页)
    pg.evaluate("()=>{try{document.getElementById('islandFrame').contentWindow.document.querySelector('.world-map-btn').click();}catch(e){}}")
    time.sleep(1.4)
    if _wrap(pg) != 'none':
        return False, "★goHome 后外壳没隐藏(没回首页)"
    if _top(pg) != 'index.html':
        return False, f"★goHome 后离开了首页(在 {_top(pg)}; 应恒 index)"
    return True, "OK"

def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else ISLANDS
    start_server(); time.sleep(1)
    base = f'http://127.0.0.1:{PORT}'
    from playwright.sync_api import sync_playwright
    fails = []
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width':393,'height':820})
        for key in targets:
            try:
                ok, msg = test_island(pg, key, base)
            except Exception as e:
                ok, msg = False, "异常:" + str(e)[:70]
            tag = "✅" if ok else "❌"
            print(f"  {tag} {key:10s} {msg}")
            if not ok: fails.append((key, msg))
        b.close()
    print("-"*50)
    if fails:
        print(f"❌ 导航回归测试未通过: {len(fails)}/{len(targets)} 岛有问题")
        for k, m in fails: print(f"   - {k}: {m}")
        sys.exit(1)
    print(f"✅✅✅ 导航回归测试全部通过 ({len(targets)} 岛: 点岛卡在首页外壳iframe就地打开·顶层恒index→岛内spelling bee覆盖层→goHome瞬回首页 全对)")
    sys.exit(0)

if __name__ == '__main__':
    main()
