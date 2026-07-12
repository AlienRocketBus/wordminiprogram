"""贴近 CloudBase CDN 的本地测试服务器:
   - 多线程(并行处理请求) —— python -m http.server 是单线程串行的, 会把"脚本多"的影响夸大好几倍
   - gzip 压缩文本资源(CDN 默认开) —— 不压的话 JS 体积虚高 3~4 倍
   - 长缓存头
"""
import gzip, io, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = sys.argv[2] if len(sys.argv) > 2 else "."
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
TEXT = (".js", ".html", ".css", ".json", ".svg", ".map")


class H(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def translate_path(self, path):
        p = path.split("?", 1)[0].split("#", 1)[0]
        return os.path.join(ROOT, p.lstrip("/"))

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            self.send_error(404)
            return
        with open(path, "rb") as f:
            body = f.read()
        ctype = self.guess_type(path)
        hdrs = {}
        if path.endswith(TEXT) and "gzip" in (self.headers.get("Accept-Encoding") or ""):
            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6) as g:
                g.write(body)
            body = buf.getvalue()
            hdrs["Content-Encoding"] = "gzip"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in hdrs.items():
            self.send_header(k, v)
        self.send_header("Cache-Control", "public, max-age=31536000")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    srv.daemon_threads = True
    print(f"gzip+threading server on {PORT} root={ROOT}", flush=True)
    srv.serve_forever()
