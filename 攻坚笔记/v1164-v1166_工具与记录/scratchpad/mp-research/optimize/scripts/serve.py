import http.server, sys, mimetypes, functools
root = sys.argv[2]; port = int(sys.argv[1])
M = {'.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.html':'text/html; charset=utf-8',
     '.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml',
     '.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav',
     '.webmanifest':'application/manifest+json','.ico':'image/x-icon','.gif':'image/gif','.mp4':'video/mp4'}
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, **M}
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
