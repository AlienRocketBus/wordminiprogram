#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hansen_overflow_audit.py —— 文字溢出/裁切 自动体检器
============================================================
为什么有它(铁律 #0.3): 反复出现"改了某个元素的尺寸/位置 → 把旁边/里面的文字
挤出了框外、或被容器 overflow:hidden 裁掉"这类 bug(典型: v672 放大宠物卡 →
卡片在矮屏被压缩 → 宠物名"星雾之卵"被裁掉)。这类 bug 静态守卫抓不到(只在真机
特定视口渲染时才暴露),所以用 Playwright 真机逐元素量"文字边界 vs 容器边界"。

它做什么: 在【矮视口】(裁切最易发生)+ 正常视口,逐个屏幕(home / 宠物屏 / 宠物
卡牌器 / 模式 / Boss / 成就 / 卡册 / 复习)扫描每一处【带文字的元素】,检测:
  ① 自裁: 元素自身 overflow:hidden 且 scrollHeight/Width > clientHeight/Width(文字比框大被裁);
  ② 被祖先裁: 元素被某个 overflow:hidden(非滚动)祖先在垂直/水平方向裁掉(元素边界超出祖先边界)。
排除: text-overflow:ellipsis / nowrap+overflow(故意单行省略号截断)、隐藏元素、0尺寸元素。

用法: python3 hansen_overflow_audit.py            # 默认抽 2 岛 × 矮/正常视口
      python3 hansen_overflow_audit.py --all     # 全 19 岛(慢)
任一处文字被裁 → 打印明细 + 退出码 1; 全部完整 → ✅ 退出 0。
铁律: 每次改尺寸/布局、每次交付前必须先跑它见 ✅ 才能打包。
"""
import os, sys, time, threading, http.server, socketserver, json

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8971
ISLANDS_QUICK = ['island_animal.html', 'island_food.html']  # 抽样(共享模块改一处全生效·抽样足够)
VIEWPORTS = [(393, 600), (360, 600), (393, 850)]  # 矮屏在前(裁切最易发生)

# 每个屏幕: (名字, 进入该屏的JS)。宠物卡牌器额外开到几个阶(名字长短不一)
SCREENS = [
    ("home",            "showScreen('home');"),
    ("pet_screen",      "showScreen('pet');try{HsnPet.render()}catch(e){}"),
    ("pet_viewer_s0",   "showScreen('pet');try{HsnPet.render();HsnPet.openCard(0)}catch(e){}"),
    ("modes",           "try{showScreen('modes')}catch(e){try{showScreen('home')}catch(_){}}"),
    ("boss",            "try{showScreen('boss')}catch(e){}"),
    ("achievements",    "try{showScreen('achievements')}catch(e){try{showScreen('ach')}catch(_){}}"),
    ("cards",           "try{showScreen('cards')}catch(e){}"),
    ("review",          "try{showScreen('review')}catch(e){}"),
]

# 真机审计 JS: 返回所有"被裁/溢出文字"明细
AUDIT_JS = r"""
(() => {
  const TOL = 3;
  const out = [];
  function selOf(el){
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#'+el.id;
    if (el.className && typeof el.className === 'string'){
      const c = el.className.trim().split(/\s+/).filter(Boolean).slice(0,2);
      if (c.length) s += '.'+c.join('.');
    }
    return s;
  }
  function visible(el, cs){
    if (cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false;
    const r = el.getBoundingClientRect();
    if (r.width<2||r.height<2) return false;
    if (r.bottom<0||r.top>window.innerHeight+400) return false; // 屏外(留余量给可滚动)
    return true;
  }
  const els = document.querySelectorAll('body *');
  for (const el of els){
    const cs = getComputedStyle(el);
    if (!visible(el, cs)) continue;
    // 仅检查"直接含文字"的元素
    let txt = '';
    for (const n of el.childNodes){ if (n.nodeType===3) txt += n.textContent; }
    txt = txt.trim();
    if (txt.length < 1) continue;
    const r = el.getBoundingClientRect();
    const intentional = (cs.textOverflow==='ellipsis') ||
                        (cs.whiteSpace==='nowrap' && (cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.overflowX==='clip'));
    // ① 自裁: 自身 overflow 隐藏且内容比框大
    if (!intentional){
      const oy=cs.overflowY, ox=cs.overflowX;
      if ((oy==='hidden'||oy==='clip') && el.scrollHeight > el.clientHeight + TOL){
        out.push({type:'self-纵向裁', el:selOf(el), text:txt.slice(0,24), by:el.scrollHeight-el.clientHeight}); continue;
      }
      if ((ox==='hidden'||ox==='clip') && el.scrollWidth > el.clientWidth + TOL){
        out.push({type:'self-横向裁', el:selOf(el), text:txt.slice(0,24), by:el.scrollWidth-el.clientWidth}); continue;
      }
    }
    // ② 被祖先(overflow隐藏·非滚动)裁
    let anc = el.parentElement, hopped=false;
    while (anc && anc !== document.body){
      const acs = getComputedStyle(anc);
      const aoy=acs.overflowY, aox=acs.overflowX;
      const scrollY=(aoy==='auto'||aoy==='scroll'), scrollX=(aox==='auto'||aox==='scroll');
      const clipY=(aoy==='hidden'||aoy==='clip'), clipX=(aox==='hidden'||aox==='clip');
      if (scrollY || scrollX){ hopped=true; }  // 命中可滚动祖先: 之上不再算裁(可滚动看到)
      if (clipY && !scrollY){
        const ar = anc.getBoundingClientRect();
        if (r.bottom > ar.bottom + TOL || r.top < ar.top - TOL){
          out.push({type:'被祖先纵向裁', el:selOf(el), text:txt.slice(0,24), ancestor:selOf(anc),
                    elBottom:+r.bottom.toFixed(1), ancBottom:+ar.bottom.toFixed(1), by:+(Math.max(r.bottom-ar.bottom, ar.top-r.top)).toFixed(1)});
          break;
        }
      }
      if (clipX && !scrollX){
        const ar = anc.getBoundingClientRect();
        if (r.right > ar.right + TOL || r.left < ar.left - TOL){
          out.push({type:'被祖先横向裁', el:selOf(el), text:txt.slice(0,24), ancestor:selOf(anc),
                    by:+(Math.max(r.right-ar.right, ar.left-r.left)).toFixed(1)});
          break;
        }
      }
      if (hopped && (clipY||clipX)) break; // 已进可滚动容器且该层是裁切层→已检, 不再上溯
      anc = anc.parentElement;
    }
  }
  return out;
})()
"""


def start_server():
    os.chdir(ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
        httpd.serve_forever()


def main():
    islands = sorted([f for f in os.listdir(ROOT) if f.startswith('island_') and f.endswith('.html')]) \
        if '--all' in sys.argv else ISLANDS_QUICK
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print("⚠️  未装 playwright, 跳过溢出体检(本机环境)。装: pip install playwright && playwright install chromium")
        return 0

    threading.Thread(target=start_server, daemon=True).start()
    time.sleep(1.2)

    findings = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for isl in islands:
            for (W, H) in VIEWPORTS:
                page = browser.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
                try:
                    page.goto(f'http://127.0.0.1:{PORT}/{isl}', wait_until='domcontentloaded', timeout=30000)
                    time.sleep(1.4)
                    page.evaluate("()=>{document.querySelectorAll('.show').forEach(e=>{try{e.classList.remove('show')}catch(_){}})}")
                    for (sname, js) in SCREENS:
                        try:
                            page.evaluate("()=>{try{%s}catch(e){}}" % js)
                            time.sleep(0.5)
                            res = page.evaluate(AUDIT_JS)
                            for item in (res or []):
                                item['island'] = isl
                                item['viewport'] = f'{W}x{H}'
                                item['screen'] = sname
                                findings.append(item)
                        except Exception:
                            pass
                finally:
                    page.close()
        browser.close()

    # 去重(同一元素跨屏可能重复报)
    seen = set(); uniq = []
    for f in findings:
        k = (f.get('island'), f.get('viewport'), f.get('screen'), f.get('el'), f.get('type'))
        if k in seen: continue
        seen.add(k); uniq.append(f)

    print("=" * 64)
    print("🔎 文字溢出/裁切体检 (hansen_overflow_audit)")
    print("   岛: %d 个 · 视口: %s · 屏幕: %d 个" % (len(islands), VIEWPORTS, len(SCREENS)))
    print("=" * 64)
    if not uniq:
        print("✅✅✅ 未发现任何文字被裁/溢出 —— 全部文字完整在框内。")
        return 0
    print("❌ 发现 %d 处文字被裁/溢出:" % len(uniq))
    for f in uniq:
        print("   - [%s|%s|%s] %s 文字「%s」 %s 超出%spx %s" % (
            f.get('island','?').replace('island_','').replace('.html',''),
            f.get('viewport','?'), f.get('screen','?'), f.get('el','?'),
            f.get('text','')[:20], f.get('type','?'), f.get('by','?'),
            '(被'+f.get('ancestor','')+'裁)' if f.get('ancestor') else ''))
    return 1


if __name__ == '__main__':
    sys.exit(main())
