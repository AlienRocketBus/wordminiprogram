import json, re, collections
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
rows=json.load(open(B+'data/master.json'))
cmu=collections.defaultdict(list)
for ln in open(B+'refdata_dl/cmu/cmudict.dict', encoding='utf-8'):
  ln=ln.split('#')[0].strip()
  if not ln: continue
  w,*ph=ln.split(); w=re.sub(r'\(\d+\)$','',w); cmu[w].append(ph)
UNITS=['iː','ɑː','ɔː','uː','ɜː','aɪ','aʊ','eɪ','əʊ','ɔɪ','ɪə','eə','ʊə','i','ɪ','e','æ','ɒ','ʊ','u','ʌ','ə','a','ɔ','ɑ','o','ɛ']
VCH='iɪeæɑɒɔʊuʌɜəaoɛ'
OBSTR=set('pbtdkɡfvszʃʒθð')|{'tʃ','dʒ'}
def nuclei(p):
  s=p.strip('/').replace(' ','').replace('ˌ','').replace('ˈ','')
  out=[];i=0;prevC=None
  while i<len(s):
    if s[i] in VCH:
      for u in UNITS:
        if s.startswith(u,i): out.append(u); i+=len(u); break
      else: out.append(s[i]); i+=1
      prevC=None; continue
    c=s[i:i+2] if s[i:i+2] in ('tʃ','dʒ') else s[i]
    # syllabic l/n after obstruent, not followed by vowel
    if c in ('l','n') and prevC in OBSTR and not (i+1<len(s) and s[i+1] in VCH):
      out.append('syl')
    prevC=c; i+=len(c)
  return out
ALLOW={
 'AA':{'ɑː','ɒ','ɔː','ə','æ'}, 'AE':{'æ','ɑː','ə','e','ɪ'}, 'AH':{'ʌ','ɒ','ə','ɪ','ʊ','syl','i','e','æ'},
 'AO':{'ɔː','ɒ','ɑː','ʊə','ə'}, 'AW':{'aʊ'}, 'AY':{'aɪ','ɪ'}, 'EH':{'e','eə','ɪ','ə','æ','eɪ'},
 'ER':{'ɜː','ə','ʌ','eə','ɪə','ʊə','ɔː','ɑː','syl'}, 'EY':{'eɪ','eə','e','ɪ','i'}, 'IH':{'ɪ','ɪə','i','ə','iː','aɪ','e'},
 'IY':{'iː','i','ɪ','ɪə','e'}, 'OW':{'əʊ','ɔː','ɒ','ʊə','ə'}, 'OY':{'ɔɪ'}, 'UH':{'ʊ','ʊə','ɔː','uː','ə'}, 'UW':{'uː','u','ʊ','ʊə','ə','juː'}
}
res=[]
for r in rows:
  en=r['en']; p=r['pn']
  ws=en.lower().replace('-',' ').split(); parts=p.strip('/').split(' ')
  if len(ws)!=len(parts): continue
  for w,wp in zip(ws,parts):
    w=re.sub(r"[^a-z']",'',w)
    c=cmu.get(w)
    if not c: continue
    nu=nuclei('/'+wp+'/')
    best=None
    for ph in c:
      vs=[re.sub(r'\d','',x) for x in ph if re.sub(r'\d','',x) in ALLOW]
      # R-colored merges: vowel + R (no following vowel) -> keep as vowel (already single)
      if len(vs)!=len(nu): continue
      bad=[(i,vs[i],nu[i]) for i in range(len(vs)) if nu[i] not in ALLOW[vs[i]]]
      if best is None or len(bad)<len(best[0]): best=(bad,' '.join(ph))
    if best and best[0]:
      res.append((r['id'],r['island'],en,p,best[1],best[0]))
for x in res: print(x)
print(len(res))
