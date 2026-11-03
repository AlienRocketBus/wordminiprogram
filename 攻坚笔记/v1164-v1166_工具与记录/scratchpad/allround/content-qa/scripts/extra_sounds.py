# For every word clip: find separate voiced segments; report clips that contain a second clearly audible
# segment (>= 80 ms, RMS > -30 dBFS) separated from the main word by > 0.25 s -> possible extra word / click / breath.
import json, subprocess, numpy as np
S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/'
B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/'
res=json.load(open(B+'out/audio_resolution.json'))
files=sorted(set(r['w'] for r in res if r['w']))
out=[]
for f in files:
  b=subprocess.run(['ffmpeg','-v','error','-i',S+f,'-ac','1','-ar','16000','-f','s16le','-'],stdout=subprocess.PIPE).stdout
  a=np.frombuffer(b,dtype=np.int16).astype(np.float32)/32768
  n=a.size//160
  e=np.sqrt(np.mean(a[:n*160].reshape(n,160)**2,axis=1))
  on=e>10**(-45/20)
  segs=[];i=0
  while i<n:
    if on[i]:
      j=i
      while j<n and on[j]: j+=1
      segs.append([i,j]); i=j
    else: i+=1
  merged=[]
  for s in segs:
    if merged and s[0]-merged[-1][1]<25: merged[-1][1]=s[1]
    else: merged.append(s)
  info=[]
  for x,y in merged:
    seg=a[x*160:y*160]; rms=20*np.log10(np.sqrt(np.mean(seg**2))+1e-9); pk=20*np.log10(np.max(np.abs(seg))+1e-9)
    info.append((round(x/100,2),round(y/100,2),round(float(rms),1),round(float(pk),1)))
  main=max(info,key=lambda t:(t[1]-t[0])*10**(t[2]/20))
  extra=[t for t in info if t is not main and (t[1]-t[0])>=0.08 and t[2]>-30]
  if extra: out.append(dict(file=f,dur=round(a.size/16000,2),main=main,extra=extra))
json.dump(out,open(B+'out/extra_sounds.json','w'),indent=1)
print('word clips',len(files),'with an extra audible segment',len(out))
for o in out: print(o)
