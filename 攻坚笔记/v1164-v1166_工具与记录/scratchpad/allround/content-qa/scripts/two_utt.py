import json, subprocess, numpy as np, re
S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
res=json.load(open(B+'out/audio_resolution.json'))
w2en={}
for r in res:
  if r['w']: w2en[r['w']]=r['en']
out=[]
for f,en in sorted(w2en.items()):
  b=subprocess.run(['ffmpeg','-v','error','-i',S+f,'-ac','1','-ar','16000','-f','s16le','-'],stdout=subprocess.PIPE).stdout
  a=np.frombuffer(b,dtype=np.int16).astype(np.float32)/32768
  n=a.size//160; e=np.sqrt(np.mean(a[:n*160].reshape(n,160)**2,axis=1))
  on=e>10**(-38/20)
  segs=[];i=0
  while i<n:
    if on[i]:
      j=i
      while j<n and on[j]: j+=1
      segs.append([i,j]); i=j
    else: i+=1
  merged=[]
  for s in segs:
    if merged and s[0]-merged[-1][1]<8: merged[-1][1]=s[1]
    else: merged.append(s)
  big=[]
  for x,y in merged:
    seg=a[x*160:y*160]; rms=20*np.log10(np.sqrt(np.mean(seg**2))+1e-9)
    if (y-x)>=25 and rms>-24: big.append((round(x/100,2),round(y/100,2),round(float(rms),1)))
  multiword=' ' in en or '-' in en
  if len(big)>=2 and not multiword:
    out.append(dict(file=f,word=en,segments=big))
json.dump(out,open(B+'out/two_utterances.json','w'),indent=1)
print('single-word clips with >=2 loud separate segments:',len(out))
for o in out: print(o)
