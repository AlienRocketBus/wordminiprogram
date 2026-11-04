import re,glob,os,sys
S=sys.argv[1]
t=open(os.path.join(S,'template.html'),encoding='utf-8').read()
i=t.index('const ACHIEVEMENTS=['); j=t.index('];',i)
ids=re.findall(r"\{id:'([A-Za-z0-9_]+)',cat:'([^']+)'",t[i:j])
# checkAch body
a=t.index('function checkAch(){')
# find matching brace
depth=0;k=a
while True:
    c=t[k]
    if c=='{': depth+=1
    elif c=='}':
        depth-=1
        if depth==0: break
    k+=1
body=t[a:k]
rest=t[:a]+t[k:]
rest=rest[:i]+rest[j:] if i<a else rest  # remove ACH definition block
others=''
for f in glob.glob(os.path.join(S,'hansen_*.js'))+[os.path.join(S,x) for x in ['index.html','spelling_bee.html','boss_hall.html','season_showcase.html','land_map.html','spelling_pk.html']]:
    others+=open(f,encoding='utf-8',errors='ignore').read()
pat=lambda x: re.compile(r"(unlockAch|unlock|_unlockAch|grantAch|achUnlock)\(\s*['\"]"+re.escape(x)+r"['\"]")
dead=[];alive=[]
from collections import Counter
for x,cat in ids:
    inbody=("'"+x+"'") in body
    other=bool(pat(x).search(rest)) or bool(pat(x).search(others)) or ("'"+x+"'" in others and x not in ('',))
    if inbody and not other: dead.append((x,cat))
    elif not inbody and not other: dead.append((x,cat+'*nowhere'))
    else: alive.append(x)
print('total',len(ids),'alive',len(alive),'dead(only in template checkAch / nowhere)',len(dead))
print(Counter(c for _,c in dead))
print([x for x,_ in dead][:200])
