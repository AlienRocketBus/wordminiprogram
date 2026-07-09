#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate.py — 「印章」统一架构生成器 (14 槽位版)
  从 template.html(标准壳母版) + island_data.json(每岛专属数据) 盖章生成全部 19 个岛 HTML。
  改母版或某岛数据后重跑本脚本 → 19 岛全部重新盖章, 永不再分叉。
  机制已验证无损: generate(template, animal数据) 与 animal 标准壳逐字一致。
每岛 14 槽位 = 6个const块(DATA/BOSSES/LISTEN_LEVELS/TYPING_LEVELS/CLOZE_LEVELS/avatars)
  + 8个token(中文全名zh/主题词theme/英文ISLE名/英文title名/存档key/拼写对战短key/真人发音表local_audio/额外CSS extra_css)。
标准壳(animal)提供其余一切: 全部20游戏模式/boss攻防/宠物/抽卡/新成就系统(36成就)/12岛单词图标类CSS/通用音频机制。
用法: python3 generate.py   (在含 template.html 与 island_data.json 的目录运行)
"""
import json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

PH = {'DATA':'⟦⟦ISLE_DATA⟧⟧','BOSSES':'⟦⟦ISLE_BOSSES⟧⟧','LISTEN':'⟦⟦ISLE_LISTEN⟧⟧','TYPING':'⟦⟦ISLE_TYPING⟧⟧',
      'CLOZE':'⟦⟦ISLE_CLOZE⟧⟧','AVATARS':'⟦⟦ISLE_AVATARS⟧⟧','ZH':'⟦⟦ISLE_ZH⟧⟧','THEME':'⟦⟦ISLE_THEME⟧⟧',
      'ENISLE':'⟦⟦ISLE_ENISLE⟧⟧','ENTITLE':'⟦⟦ISLE_ENTITLE⟧⟧','KEY':'⟦⟦ISLE_KEY⟧⟧','SHORTKEY':'⟦⟦ISLE_SHORTKEY⟧⟧',
      'LOCALAUDIO':'⟦⟦ISLE_LOCALAUDIO⟧⟧','EXTRACSS':'⟦⟦ISLE_EXTRACSS⟧⟧','BOSSICON':'⟦⟦ISLE_BOSSICON⟧⟧','BLABEL':'⟦⟦ISLE_BLABEL⟧⟧'}
BMAP = {'DATA':'DATA','BOSSES':'BOSSES','LISTEN':'LISTEN_LEVELS','TYPING':'TYPING_LEVELS','CLOZE':'CLOZE_LEVELS','AVATARS':'avatars'}

def generate(tpl, d):
    t = tpl.replace(PH['SHORTKEY'], d['short_key']).replace(PH['KEY'], d['key'])
    t = t.replace(PH['ENISLE'], d['en_isle']).replace(PH['ENTITLE'], d['en_title'])
    t = t.replace(PH['THEME'], d['theme']).replace(PH['ZH'], d['zh'])
    t = t.replace(PH['LOCALAUDIO'], d['local_audio'] if d.get('local_audio') else 'null')
    t = t.replace(PH['EXTRACSS'], d['extra_css'] if d.get('extra_css') else '')
    # 🔴 挑战BOSS 图标: 默认 boss_arcade.png(全岛共用)·赛季岛单独用 boss_icon 字段(Hansen 只换星海词汇大冒险这一个)
    t = t.replace(PH['BOSSICON'], d.get('boss_icon', 'boss_arcade.png'))
    # 🔴 挑战BOSS 标签字色: 默认 #0f172a(深·配亮黄底)·赛季岛 boss_label_color=#fff(白·配 #0A1228 深底·否则深字看不见)
    t = t.replace(PH['BLABEL'], d.get('boss_label_color', '#0f172a'))
    for n in BMAP:
        t = t.replace(PH[n], d[BMAP[n]])
    return t

def main():
    tpl = open('template.html', encoding='utf-8').read()
    data = json.load(open('island_data.json', encoding='utf-8'))
    for name, ph in PH.items():
        if tpl.count(ph) < 1:
            print("❌ 模板缺占位符: %s (%s)" % (name, ph)); sys.exit(1)
    n = 0
    for key, d in data.items():
        html = generate(tpl, d)
        leftover = sum(html.count(ph) for ph in PH.values())
        if leftover:
            print("❌ %s 生成后占位符残留 %d 处" % (key, leftover)); sys.exit(1)
        if d['zh'] not in html or html.count(d['key']) < 11:
            print("❌ %s 岛名/key 注入异常" % key); sys.exit(1)
        if ("HansenSpellBee.open('%s')" % d['short_key']) not in html:
            print("❌ %s 拼写对战短key注入异常" % key); sys.exit(1)
        open('island_%s.html' % key, 'w', encoding='utf-8').write(html)
        n += 1
    print("  [印章] generate.py: 从 template.html + island_data.json 盖章生成 %d 个岛 (14槽位) ✅" % n)

if __name__ == '__main__':
    main()
