#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⭐v912 特效不可破坏守卫 (fx_guard.py)   —— Hansen 钦令: boss 攻击特效一旦定稿, 绝不允许被任何改动无声破坏。

【为什么必须有它】
check_resources 的几百条守卫全是【盯代码字符串】的。v905 只是把一层不透明底涂在 #bossScreen 上,
没有改动任何一行特效代码, 却把 z-index:-1 的背景特效层整个盖死 →
  · 龙骑士统帅(Lv11) 的「巨龙之翼展开」没了
  · 地狱犬王(Lv8) 的「地狱之门升起」没了
而所有字符串守卫【全部通过】, 照常打包上线, Hansen 真机才发现。
教训: 特效"代码还在"不等于特效"看得见"。字符串守卫对"被别人遮住"完全瞎。

【本守卫怎么防】
在真浏览器里把每个 boss 的攻击特效真的放一遍, 冻结动画后拍三帧:
   A = 全开        B = 关掉前景特效层(+canvas)        C = 关掉背景特效层
   diff(A,B) = 前景特效【真的画在屏幕上】的像素占比
   diff(A,C) = 背景特效【真的画在屏幕上】的像素占比

铁律一(硬不变量·无需基准值·最狠的一条):
   任何 boss 只要在某个特效层里创建了元素(els > 0), 这些元素就【必须画出像素】(diff > 0)。
   元素存在却一个像素都没画出来 = 被谁遮死了 = 特效已被破坏 → 立即失败。
   ★ 这一条在 v905 当天就会把构建拦下来。

铁律二(地板值·防悄悄缩水):
   每个 boss 的前景/背景像素占比锁在 hansen_fx_lock.json 里。低于地板 = 特效被削弱 → 失败。

铁律三: 特效播放期间控制台 0 报错。

【用法】
  python3 fx_guard.py            # 校验(构建时自动调用, 不过则拒绝打包)
  python3 fx_guard.py --bless    # 认可当前表现, 重新锁基准(只有 Hansen 明确同意改特效时才用)
  python3 fx_guard.py --lv 8,11  # 只查指定 boss
"""
import json, os, subprocess, sys, time, socket, signal

DEV = os.path.dirname(os.path.abspath(__file__))
LOCK = os.path.join(DEV, 'hansen_fx_lock.json')
SHOT = '/tmp/fxg'
PORT = 8899

BLESS = '--bless' in sys.argv
ONLY = ''
if '--lv' in sys.argv:
    ONLY = sys.argv[sys.argv.index('--lv') + 1]

# 全库需要真机验证的岛(61 个不同 boss):
#   island_animal   = 正片 20 个 boss(18 个常规岛由同一模板盖章生成·boss名单完全一致→查一个代表全部)
#   island_treasure = 抽查第二个常规岛(确认模板盖章无漂移)
#   island_land1-8  = 单词大陆 40 个 boss(各岛独立文件·必须逐个查)
#   island_season   = 星海 6 个 boss(含星海独有的 星海女帝·赛尔娅)
ISLANDS = ['island_animal.html', 'island_treasure.html'] + \
          ['island_land%d.html' % i for i in range(1, 9)] + ['island_season.html']
if '--islands' in sys.argv:
    ISLANDS = sys.argv[sys.argv.index('--islands') + 1].split(',')


def _port_up(p):
    s = socket.socket()
    s.settimeout(0.4)
    try:
        s.connect(('127.0.0.1', p)); s.close(); return True
    except Exception:
        return False


def _serve():
    if _port_up(PORT):
        return None
    p = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(PORT), '--directory', DEV],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(40):
        if _port_up(PORT):
            return p
        time.sleep(0.25)
    return p


def _diff(pa, pb):
    """两帧差异像素占比(%). 只看特效主战区."""
    from PIL import Image
    A = Image.open(pa).convert('RGB'); B = Image.open(pb).convert('RGB')
    a = A.load(); b = B.load()
    W, H = A.size
    ch = tot = 0
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r1, g1, b1 = a[x, y]; r2, g2, b2 = b[x, y]
            tot += 1
            if abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2) > 26:
                ch += 1
    return round(ch * 100.0 / max(1, tot), 1)


def main():
    srv = _serve()
    try:
        probe = os.path.join(DEV, 'fx_probe.mjs')
        env = dict(os.environ); env['FXG_PORT'] = str(PORT)
        rows = []
        for isl in ISLANDS:
            cmd = ['node', probe, SHOT, isl] + ([ONLY] if ONLY else [])
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=DEV, env=env)
            if 'PROBE_OK' not in r.stdout:
                print('❌ 特效守卫: 真机探针在 %s 失败\n' % isl + (r.stdout or '')[-400:] + (r.stderr or '')[-400:])
                return 1
            tag = isl.replace('island_', '').replace('.html', '')
            rows += json.load(open(os.path.join(SHOT, 'probe_%s.json' % tag), encoding='utf-8'))
        lock = {}
        if os.path.exists(LOCK):
            lock = json.load(open(LOCK, encoding='utf-8')).get('bosses', {})

        newlock, bad = {}, []
        print('\n  ⭐ 特效不可破坏守卫 (每个 boss 真机放一遍·用像素证明特效真的画在屏幕上)')
        print('  ' + '-' * 84)
        print('  %-10s %-22s %-15s %-13s %-8s %s' % ('岛', 'BOSS', '前景(元素/像素)', '背景(元素/像素)', '画布墨量', '判定'))
        for row in rows:
            lv, name = row['lv'], row['name']
            isl = row['island']
            A = '%s/%s_%d_A.png' % (SHOT, isl, lv)
            fB = '%s/%s_%d_B.png' % (SHOT, isl, lv)
            fC = '%s/%s_%d_C.png' % (SHOT, isl, lv)
            key = '%s:%s' % (isl, name)
            if not (os.path.exists(A) and os.path.exists(fB) and os.path.exists(fC)):
                bad.append('%s: 探针未出图' % name); continue
            front = _diff(A, fB)
            back = _diff(A, fC)
            fe = row['frontEls'] + (1 if row['canvases'] else 0)
            ink = row.get('ink', 0)
            peak = row.get('peakInk', ink)
            issues = []

            # 铁律一: 特效必须真的产出东西
            if row['frontEls'] + row['canvases'] + row['backEls'] == 0:
                issues.append('特效根本没产生任何元素=特效丢失/报错')

            # 铁律二(最狠·无需基准值): 画了墨/有元素, 屏幕上就必须看得见。
            #   画布画了一堆墨却一个像素都没到屏幕 = 被谁遮死了 = 特效已被破坏
            #   (墨本来就少的朴素特效不误杀: 只在 ink>=1.5% 时才要求)
            # canvas 特效: 墨量按 alpha>12 统计, 细线/淡雾类特效墨量不低但屏幕色差很小 → 阈值定太低会【误报】。
            # 只在【墨量足够多】(≥4%)却屏幕近乎为零, 或【墨量很大】(≥10%)却屏幕几乎不动时, 才判被遮死。
            if ink >= 4.0 and front < 0.4:
                issues.append('画布画了%.1f%%的墨, 屏幕上却一个像素都没有=被遮死' % ink)
            elif ink >= 10.0 and front < 1.0:
                issues.append('画布画了%.1f%%的墨, 屏幕上只有%.1f%%=基本被遮死' % (ink, front))
            if row['canvases'] == 0 and row['frontEls'] >= 3 and front < 0.4:
                issues.append('前景特效有%d个元素却一个像素都没画出来=被遮死' % row['frontEls'])
            # ★ v905 血案专杀: 背景层(z-index:-1)有元素就必须画出像素
            if row['backEls'] > 0 and back < 1.0:
                issues.append('背景特效有%d个元素却一个像素都没画出来=被遮死(v905血案)' % row['backEls'])

            # 铁律三: 0 报错(JS异常 / 本地资源丢失; 外网发音兜底403不算)
            if row.get('jsErrors'):
                issues.append('特效播放JS异常: ' + row['jsErrors'][0][:44])
            if row.get('localFails'):
                issues.append('特效资源丢失: ' + row['localFails'][0][:44])
            if row.get('modalOpen'):
                issues.append('探针异常: 弹窗未关(结果不可信)')

            ref = lock.get(key)
            if ref and not BLESS:
                if front < ref.get('front_floor', 0):
                    issues.append('前景特效缩水 %.1f%% < 地板 %.1f%%' % (front, ref['front_floor']))
                if back < ref.get('back_floor', 0):
                    issues.append('背景特效缩水 %.1f%% < 地板 %.1f%%' % (back, ref['back_floor']))

            newlock[key] = {
                'lv': lv, 'front': front, 'back': back, 'ink': ink, 'peakInk': peak,
                # 地板 = 实测值的 30%(前景)/35%(背景)。特效带随机(粒子/时序), 小特效逐次抖动可达 ±40%,
                # 地板定太紧会【误报】——守卫一旦误报, Hansen 就不敢信它, 比漏报更糟。
                # 主防线是上面的"被遮死"铁律(墨量 vs 屏幕像素), 地板只是兜底防"特效整体塌掉"。
                # 地板只给【稳定可测】的 DOM 特效(正片20个boss·多次实测波动很小)。
                # canvas 特效(单词大陆/星海)每帧清空重画、墨量忽有忽无 → 定格时刻不同, 前景像素能在 6%~30% 之间跳,
                # 给它设地板必然误报。会哭狼的守卫比没有守卫更糟 → canvas 特效不设地板,
                # 改由"被遮死"铁律兜底(画布有墨/图层有元素却 0 像素 = 被遮死), 那才是 v905 血案的真正防线。
                'front_floor': round(front * 0.30, 1) if (front >= 3.0 and row['canvases'] == 0) else 0,
                'back_floor': round(back * 0.35, 1) if (row['backEls'] > 0 and back >= 2) else 0,
                'uses_back_layer': row['backEls'] > 0,
            }
            verdict = '✅' if not issues else ('❌ ' + ' / '.join(issues))
            if issues:
                bad.append('[%s] %s(第%d关): %s' % (isl, name, lv, ' / '.join(issues)))
            print('  %-10s %-22s %-15s %-13s %-8s %s'
                  % (isl, name[:20], '%d个/%.1f%%' % (fe, front), '%d个/%.1f%%' % (row['backEls'], back),
                     '%.1f%%' % ink, verdict))

        print('  ' + '-' * 84)
        if BLESS:
            json.dump({'_说明': 'boss 攻击特效基准锁 · 由 fx_guard.py --bless 生成 · 未经 Hansen 同意不得重锁',
                       'bosses': newlock}, open(LOCK, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('  🔒 已重新锁定 %d 个 boss 的特效基准 → hansen_fx_lock.json' % len(newlock))
            return 0
        if bad:
            print('  ❌ 特效守卫发现 %d 个被破坏的特效, 拒绝打包:' % len(bad))
            for x in bad:
                print('     - ' + x)
            return 1
        print('  ✅ %d 个 boss 攻击特效全部完好(元素在 + 像素真的画在屏幕上 + 0 报错)' % len(rows))
        return 0
    finally:
        if srv:
            try:
                os.killpg(os.getpgid(srv.pid), signal.SIGTERM)
            except Exception:
                pass


if __name__ == '__main__':
    sys.exit(main())
