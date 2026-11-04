import json,re,glob,os,sys
ROOT='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot'
ach=json.load(open('ach_list.json'))['ach']
ids=[a['id'] for a in ach]
def strip_func(src, name):
    m=re.search(r'\nfunction '+name+r'\(\)\{', src)
    if not m: return src, None
    i=m.end(); depth=1
    while depth and i<len(src):
        ch=src[i]
        if ch=='{': depth+=1
        elif ch=='}': depth-=1
        i+=1
    return src[:m.start()]+'\n/*DEAD*/\n'+src[i:], (m.start(), i)
isl=open(os.path.join(ROOT,'island_animal.html'),encoding='utf-8').read()
isl2,span=strip_func(isl,'checkAch')
# remove the ACHIEVEMENTS definition array and catIcon map etc: drop lines that define {id:'...',...cat:
isl2=re.sub(r"\{id:'[A-Za-z0-9_]+',[^\n]*?cat:'[^']*'[^\n]*?\}", '', isl2)
srcs={'island_animal.html(live part)':isl2}
for f in sorted(glob.glob(os.path.join(ROOT,'hansen_*.js')))+[os.path.join(ROOT,x) for x in ['index.html','boss_hall.html','spelling_bee.html','spelling_pk.html','season_showcase.html','land_map.html','island_land1.html']]:
    try: s=open(f,encoding='utf-8').read()
    except: continue
    if f.endswith('island_land1.html'):
        s,_=strip_func(s,'checkAch')
        s=re.sub(r"\{id:'[A-Za-z0-9_]+',[^\n]*?cat:'[^']*'[^\n]*?\}", '', s)
    srcs[os.path.basename(f)]=s
# in hansen_island_upgrade.js, getAchProgress map mentions ids as keys (not unlock). Only count unlock-ish usage:
pat_tpl=r"(?:unlockAch|HansenAch\.unlock|unlock)\(\s*['\"]{id}['\"]"
alive={}; mention={}
for i in ids:
    for name,s in srcs.items():
        if re.search(pat_tpl.format(id=re.escape(i)), s):
            alive.setdefault(i,[]).append(name)
        elif re.search(r"['\"]"+re.escape(i)+r"['\"]", s):
            mention.setdefault(i,[]).append(name)
dead=[i for i in ids if i not in alive]
print('total',len(ids),'alive(direct unlock call)',len(alive),'dead',len(dead))
bycat={}
for a in ach:
    if a['id'] in dead: bycat.setdefault(a['cat'],[]).append(a['id'])
for k,v in bycat.items(): print(k,len(v),' '.join(v))
print('--- dead ids that are still mentioned (quoted) somewhere live (might be array-driven unlock):')
for i in dead:
    if i in mention: print(i, mention[i])
print('--- alive:')
for i in ids:
    if i in alive: print(i, alive[i])
print('dead span', span)
