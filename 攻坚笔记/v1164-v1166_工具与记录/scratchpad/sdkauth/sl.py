import sys
s=open('/home/user/wordminiprogram/vendor_cloudbase_esm_v965.js',encoding='utf-8').read()
cmd=sys.argv[1]
if cmd=='find':
    pat=sys.argv[2]; i=0; n=0
    lim=int(sys.argv[3]) if len(sys.argv)>3 else 50
    while True:
        i=s.find(pat,i)
        if i<0 or n>=lim: break
        print(i, repr(s[max(0,i-80):i+120])); i+=1; n+=1
elif cmd=='sl':
    a=int(sys.argv[2]); b=int(sys.argv[3]); print(s[a:b])
