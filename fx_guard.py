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
        cmd = ['node', probe, SHOT] + ([ONLY] if ONLY else [])
        env = dict(os.environ); env['FXG_PORT'] = str(PORT)
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=DEV, env=env)
        if 'PROBE_OK' not in r.stdout:
            print('❌ 特效守卫: 真机探针失败\n' + (r.stdout or '')[-500:] + (r.stderr or '')[-500:])
            return 1

        rows = json.load(open(os.path.join(SHOT, 'probe.json'), encoding='utf-8'))
        lock = {}
        if os.path.exists(LOCK):
            lock = json.load(open(LOCK, encoding='utf-8')).get('bosses', {})

        newlock, bad = {}, []
        print('\n  ⭐ 特效不可破坏守卫 (每个 boss 真机放一遍·用像素证明特效真的画在屏幕上)')
        print('  ' + '-' * 84)
        print('  %-14s %-5s %-22s %-22s %s' % ('BOSS', 'Lv', '前景特效(元素/像素%)', '背景特效(元素/像素%)', '判定'))
        for row in rows:
            lv, name = row['lv'], row['name']
            A = '%s/%d_A.png' % (SHOT, lv)
            fB = '%s/%d_B.png' % (SHOT, lv)
            fC = '%s/%d_C.png' % (SHOT, lv)
            if not (os.path.exists(A) and os.path.exists(fB) and os.path.exists(fC)):
                bad.append('%s: 探针未出图' % name); continue
            front = _diff(A, fB)
            back = _diff(A, fC)
            fe, be = row['frontEls'], row['backEls'] + (1 if row['canvases'] else 0)
            issues = []

            # 铁律一: 有元素就必须画出像素(元素在、像素为0 = 被遮死)
            if row['frontEls'] + row['canvases'] > 0 and front < 0.8:
                issues.append('前景特效有元素却一个像素都没画出来=被遮死')
            if row['backEls'] > 0 and back < 1.5:
                issues.append('背景特效有元素却一个像素都没画出来=被遮死(v905 血案)')
            # 特效必须真的产出东西
            if row['frontEls'] + row['canvases'] + row['backEls'] == 0:
                issues.append('特效根本没产生任何元素=特效丢失/报错')
            # 铁律三: 0 报错
            if row['errors']:
                issues.append('特效播放报错: ' + row['errors'][0][:50])

            ref = lock.get(name)
            if ref and not BLESS:
                # 铁律二: 不得低于地板
                if front < ref.get('front_floor', 0):
                    issues.append('前景特效缩水 %.1f%% < 地板 %.1f%%' % (front, ref['front_floor']))
                if back < ref.get('back_floor', 0):
                    issues.append('背景特效缩水 %.1f%% < 地板 %.1f%%' % (back, ref['back_floor']))

            newlock[name] = {
                'lv': lv, 'front': front, 'back': back,
                'front_floor': round(front * 0.5, 1),
                'back_floor': round(back * 0.5, 1) if (row['backEls'] > 0 and back >= 2) else 0,
                'uses_back_layer': row['backEls'] > 0,
            }
            verdict = '✅' if not issues else ('❌ ' + ' / '.join(issues))
            if issues:
                bad.append('%s(Lv%d): %s' % (name, lv, ' / '.join(issues)))
            print('  %-14s %-5s %-22s %-22s %s'
                  % (name, 'Lv%d' % lv, '%d 个 / %.1f%%' % (fe, front), '%d 个 / %.1f%%' % (row['backEls'], back), verdict))

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
