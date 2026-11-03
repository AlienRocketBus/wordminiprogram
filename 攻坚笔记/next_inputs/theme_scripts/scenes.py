# Static seasonal "scene" decorations (SVG data URIs) appended to mockups/common.css. Zero animation.
import urllib.parse
TV = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual'
def uri(svg): return "url(\"data:image/svg+xml," + urllib.parse.quote(svg.strip().replace('\n', ' ')) + "\")"
def lantern(x, y, s):
    return (f'<g transform="translate({x} {y}) scale({s})">'
            '<line x1="0" y1="-60" x2="0" y2="0" stroke="#FFD24A" stroke-width="2"/>'
            '<rect x="-12" y="-4" width="24" height="8" rx="2" fill="#FFB020"/>'
            '<ellipse cx="0" cy="30" rx="30" ry="27" fill="#E5262F"/>'
            '<path d="M-14 6 Q-26 30 -14 54 M0 4 V56 M14 6 Q26 30 14 54" stroke="#FFB020" stroke-width="2" fill="none" opacity=".75"/>'
            '<ellipse cx="-9" cy="22" rx="7" ry="11" fill="#fff" opacity=".18"/>'
            '<rect x="-12" y="54" width="24" height="8" rx="2" fill="#FFB020"/>'
            '<path d="M-6 62 V82 M0 62 V86 M6 62 V82" stroke="#FFD24A" stroke-width="2.5"/></g>')
LANTERN = ('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="150" viewBox="0 0 390 150">'
           + lantern(364, 44, .8) + lantern(326, 30, .55) + lantern(296, 22, .42) +
           '<g fill="#FFD24A" opacity=".55"><circle cx="90" cy="20" r="2"/><circle cx="250" cy="14" r="1.6"/><circle cx="200" cy="34" r="1.2"/></g></svg>')
def flake(x, y, r, o):
    arms = ''.join(f'<line x1="0" y1="0" x2="0" y2="{-r}" transform="rotate({a})"/>' for a in range(0, 360, 60))
    return f'<g transform="translate({x} {y})" stroke="#9CC9F5" stroke-width="2" stroke-linecap="round" opacity="{o}">{arms}</g>'
SNOW = ('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="160" viewBox="0 0 390 160">'
        + flake(352, 22, 10, .9) + flake(318, 70, 6, .6) + flake(372, 96, 5, .5) + flake(284, 30, 7, .7) + flake(250, 10, 4, .5) +
        '</svg>')
DRIFT = ('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="60" viewBox="0 0 390 60" preserveAspectRatio="none">'
         '<path d="M0 34 Q60 10 120 30 T240 26 T390 22 V60 H0z" fill="#fff"/><path d="M0 44 Q90 26 180 42 T390 38 V60 H0z" fill="#EAF4FF"/></svg>')
def balloon(x, y, c, s=1):
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="M0 40 Q-6 60 4 80" stroke="#7E22CE" stroke-width="1.5" fill="none" opacity=".6"/>'
            f'<ellipse cx="0" cy="18" rx="17" ry="21" fill="{c}"/><path d="M-3 39 L3 39 L0 34z" fill="{c}"/><ellipse cx="-6" cy="10" rx="4" ry="7" fill="#fff" opacity=".45"/></g>')
FLAGS = ''.join(f'<path d="M{x} 0 L{x+26} 0 L{x+13} 24z" fill="{c}"/>' for x, c in zip(range(-4, 400, 30), ['#FF6B9D', '#FFC93C', '#38BDF8', '#22C55E', '#A855F7'] * 3))
KIDS = ('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="150" viewBox="0 0 390 150">'
        '<path d="M-4 2 Q195 22 394 2" stroke="#7E22CE" stroke-width="1.5" fill="none" opacity=".35"/>' + FLAGS +
        balloon(332, 38, '#FF6B9D') + balloon(362, 54, '#FFC93C', .8) + balloon(300, 64, '#38BDF8', .7) + '</svg>')
css = f'''
/* ---------- seasonal scene packs (static SVG; no animation; pointer-events:none) ---------- */
.scene{{position:fixed;left:0;right:0;top:0;height:170px;pointer-events:none;z-index:0;background-repeat:no-repeat;background-position:center top;background-size:390px auto}}
.app>*:not(.topbar){{position:relative;z-index:1}}
[data-theme="lantern"] .scene{{background-image:{uri(LANTERN)};top:58px}}
[data-theme="snow"] .scene{{background-image:{uri(SNOW)};top:60px}}
[data-theme="snow"] .scene::after{{content:"";position:fixed;left:0;right:0;bottom:60px;height:46px;background:{uri(DRIFT)} center bottom/100% 100% no-repeat}}
[data-theme="kidsday"] .scene{{background-image:{uri(KIDS)};top:62px}}
'''
open(TV + '/mockups/common.css', 'a').write(css)
print(len(css), 'bytes of scene CSS')
