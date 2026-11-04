import sys,re
s=open('/home/user/wordminiprogram/vendor_cloudbase_esm_v965.js',encoding='utf-8').read()
pat=sys.argv[1]; w=int(sys.argv[2]) if len(sys.argv)>2 else 150; mx=int(sys.argv[3]) if len(sys.argv)>3 else 30
n=0
for m in re.finditer(pat,s):
    a=max(0,m.start()-w); b=min(len(s),m.end()+w)
    print(f"@{m.start()}: ...{s[a:b]}...\n")
    n+=1
    if n>=mx: break
print("count",len(re.findall(pat,s)))
