import http.server, os, sys, mimetypes
REPO='/home/user/wordminiprogram'
SCR=os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map={**http.server.SimpleHTTPRequestHandler.extensions_map,'.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.html':'text/html; charset=utf-8'}
    def translate_path(self, path):
        p=path.split('?',1)[0].split('#',1)[0]
        if p.startswith('/__s/'):
            return os.path.join(SCR, p[len('/__s/'):])
        return os.path.join(REPO, p.lstrip('/'))
    def log_message(self,*a): pass
    def end_headers(self):
        self.send_header('Cache-Control','no-store'); super().end_headers()
port=int(sys.argv[1])
http.server.ThreadingHTTPServer(('127.0.0.1',port),H).serve_forever()
