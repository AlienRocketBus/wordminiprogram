import json, re, collections
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
rows=json.load(open(B+'data/master.json'))
cmu=collections.defaultdict(list)
for ln in open(B+'refdata_dl/cmu/cmudict.dict', encoding='utf-8'):
  ln=ln.split('#')[0].strip()
  if not ln: continue
  w,*ph=ln.split()
  w=re.sub(r'\(\d+\)$','',w)
  cmu[w].append(ph)
VOW_A={'AA','AE','AH','AO','AW','AY','EH','ER','EY','IH','IY','OW','OY','UH','UW'}
CONS_A={'B':'b','CH':'tʃ','D':'d','DH':'ð','F':'f','G':'ɡ','HH':'h','JH':'dʒ','K':'k','L':'l','M':'m','N':'n','NG':'ŋ','P':'p','R':'r','S':'s','SH':'ʃ','T':'t','TH':'θ','V':'v','W':'w','Y':'j','Z':'z','ZH':'ʒ'}
def cmu_info(ph):
  vows=[p for p in ph if p[:2] in VOW_A]
  nsyl=len(vows)
  prim=[i for i,p in enumerate(vows) if p.endswith('1')]
  # skeleton
  sk=[]
  for i,p in enumerate(ph):
    base=re.sub(r'\d','',p)
    if base in VOW_A:
      if base=='ER': pass
      continue
    c=CONS_A[base]
    if c=='r':
      nxt=ph[i+1] if i+1<len(ph) else None
      if not (nxt and re.sub(r'\d','',nxt) in VOW_A and re.sub(r'\d','',nxt)!='ER'): continue
    if c in ('j','h','w'): continue
    sk.append(c)
  return nsyl,(prim[0] if prim else None),''.join(sk)
VOWELS='iɪeæɑɒɔʊuʌɜəaoɛ'
OBSTR=set(['p','b','t','d','k','ɡ','f','v','s','z','ʃ','ʒ','θ','ð','m','n'])
def ipa_tokens(s):
  t=[];i=0
  while i<len(s):
    if s[i:i+2] in ('tʃ','dʒ'): t.append(s[i:i+2]); i+=2; continue
    t.append(s[i]); i+=1
  return t
def ipa_info(p):
  s=p.strip('/').replace(' ','')
  toks=ipa_tokens(s)
  nuclei=0; prim=None; sk=[]; prevV=False
  for i,tk in enumerate(toks):
    if tk=='ˈ': prim=nuclei; prevV=False; continue
    if tk in ('ˌ','ː','.'): continue
    if tk[0] in VOWELS:
      if not prevV: nuclei+=1
      prevV=True; continue
    # consonant
    if tk in ('l','n','m') and i>0:
      # syllabic if previous token is obstruent consonant and next is consonant/end
      prv=None
      for k in range(i-1,-1,-1):
        if toks[k] not in ('ˈ','ˌ','ː'): prv=toks[k]; break
      nxt=None
      for k in range(i+1,len(toks)):
        if toks[k] not in ('ˈ','ˌ','ː'): nxt=toks[k]; break
      if prv and prv not in VOWELS and prv[0] not in VOWELS and prv in OBSTR|{'tʃ','dʒ'} and prv!=tk and (nxt is None or nxt[0] not in VOWELS) and not (tk=='m'):
        nuclei+=1
    prevV=False
    if tk in ('j','h','w'): continue
    if tk=='r':
      # keep only prevocalic r
      nxt=toks[i+1] if i+1<len(toks) else None
      if not (nxt and nxt[0] in VOWELS): continue
    sk.append(tk)
  return nuclei,prim,''.join(sk)
out=[]
fmt=[]
for r in rows:
  p=r['pn']; en=r['en']
  if not (p.startswith('/') and p.endswith('/')): fmt.append((r['id'],en,p,'not slash-delimited'))
  if re.search(r'[ːˈˌ]{2}',p): fmt.append((r['id'],en,p,'double mark'))
  # postvocalic r (rhotic)
  s=p.strip('/')
  if re.search(r'[iɪeæɑɒɔʊuʌɜəa]ː?r(?![iɪeæɑɒɔʊuʌɜəa])',s): fmt.append((r['id'],en,p,'post-vocalic r (rhotic, AmE?)'))
  if 'oʊ' in s or 'ɚ' in s or 'ɝ' in s: fmt.append((r['id'],en,p,'AmE vowel symbol'))
  ws=en.lower().replace('-',' ').split()
  parts=s.split(' ')
  if len(ws)!=len(parts):
    # compare whole
    pass
  for wi,w in enumerate(ws):
    wp=parts[wi] if len(ws)==len(parts) else None
    if wp is None: continue
    wclean=re.sub(r"[^a-z']",'',w)
    c=cmu.get(wclean)
    n,pr,sk=ipa_info('/'+wp+'/')
    if n>=2 and 'ˈ' not in wp and len(ws)==1:
      fmt.append((r['id'],en,p,'multi-syllable without stress mark (%d syl)'%n))
    if not c: out.append((r['id'],en,p,'NOT IN CMU',w)); continue
    best=None
    for ph in c:
      cn,cp,csk=cmu_info(ph)
      score=(cn==n)+(cp==pr or n<2)+(csk==sk)
      if best is None or score>best[0]: best=(score,cn,cp,csk,' '.join(ph))
    score,cn,cp,csk,phs=best
    if score<3:
      out.append((r['id'],en,p,'MISMATCH syl %d/%d stress %s/%s skel %s/%s'%(n,cn,pr,cp,sk,csk),phs))
json.dump({'fmt':fmt,'cmp':out},open(B+'data/ipa_auto.json','w'),ensure_ascii=False,indent=1)
print('format issues',len(fmt))
for f in fmt: print('FMT',f)
print('cmu mismatches',len(out))
for o in out: print('CMP',o)
