#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
⭐ v927 全库发音总锁 (Hansen: "所有的例句从头到尾能不能正常发音…每一个单词是不是真人发音…全都上锁")

背景 / 为什么需要这把锁
------------------------------------------------------------------
游戏里【单词发音】和【例句发音】的解析链路:
  单词: __ISLAND_LOCAL_AUDIO(岛内) → WORD_MAP(全局) → 都没有就【联网 TTS 合成】
  例句: __HANSEN_EX_AUDIO(星海240·按【规范化例句】做key) → SENTENCE_MAP(常规岛·按【例句原文精确匹配】)
        → 都没有就【联网 TTS 合成】

这条链路有三种【静默失效】—— 出问题时按钮还在、页面不报错, 只是偷偷变回机器合成音, 没人会发现:
  ① 例句文字被改动一个字符 → SENTENCE_MAP 是【原文精确匹配】, key 立刻对不上 → 掉去联网合成
  ② 某个词的音频映射被删/被覆盖(8个星域岛就曾被塞成同一份 land1 的表) → 掉去联网合成
  ③ 音频文件被替换/损坏/删除 → 掉去联网合成 (且 ?v215 是写死的长期缓存令牌, 换文件不改名用户还会听到旧的)

所以本锁把【整张发音解析表】+【每一个音频文件的指纹】全部钉死:
  · resolution: 每个岛 · 每个词 → 它的单词音频文件 + 例句音频文件 (精确到文件名)
  · files     : 每个被引用的音频文件 → sha256 + 字节数
只要有任何一项对不上, check_resources 立即 ❌ 拒绝打包, 并指出是哪个岛的哪个词。

用法
------------------------------------------------------------------
  python3 hansen_audio_lock.py --verify    # 校验(check_resources 每次 build 都会跑)
  python3 hansen_audio_lock.py --rebuild   # 【故意】增删音频后, 重新生成基线

⚠️ --rebuild 只在【确实要改音频】时用。平时任何一次失败都不是误报, 是真的有东西被动了。
"""
import os, re, sys, json, glob, hashlib

LOCK = "hansen_audio_lock.json"


def _norm(t):
    """例句规范化(与 speak() 里 __HANSEN_EX_AUDIO 的 key 算法完全一致): 只留字母和空格, 小写"""
    t = t.replace("\u2019", "'")
    t = re.sub(r"[^A-Za-z ]", "", t)
    return re.sub(r"\s+", " ", t).strip().lower()


def _load_maps():
    wm = dict(re.findall(r'"([^"]+)"\s*:\s*"(words/[^"]+\.mp3)"',
                         open("word_map.js", encoding="utf-8", errors="replace").read()))
    sm_raw = open("sentence_map.js", encoding="utf-8", errors="replace").read()
    sm = json.loads(sm_raw[sm_raw.index("{"):sm_raw.rindex("}") + 1])
    ex_raw = open("hansen_ex_audio.js", encoding="utf-8", errors="replace").read()
    ex = dict(re.findall(r'"([^"]+)":\s*"(words/[^"]+\.mp3)"',
                         ex_raw.split("__HANSEN_EX_AUDIO_BY_WORD")[0]))
    return wm, sm, ex


def _parse_island(f):
    s = open(f, encoding="utf-8", errors="replace").read()
    if "const DATA=[" not in s:
        return None, None
    i = s.index("const DATA=["); d = 0; j = i + len("const DATA=")
    end = len(s)
    for k in range(j, len(s)):
        if s[k] == '[':
            d += 1
        elif s[k] == ']':
            d -= 1
            if d == 0:
                end = k + 1
                break
    words = []
    for _cat, body in re.findall(r'\{cat:"([^"]+)",words:\[(.*?)\n\]\}', s[j:end], re.S):
        for r in re.findall(r'\{en:"(.*?)",pn:"[^"]*",cn:"[^"]*",emoji:"[^"]*",ex:"(.*?)",exCn:"[^"]*"\}', body):
            words.append({"en": r[0], "ex": r[1].replace('\\"', '"').replace("\\'", "'")})
    m = re.search(r"__ISLAND_LOCAL_AUDIO\s*=\s*(\{.*?\})\s*;", s, re.S)
    la = dict(re.findall(r"([A-Za-z][A-Za-z '\-]*)\s*:\s*'(words/[^']+\.mp3)'", m.group(1))) if m else {}
    return words, la


def build_resolution():
    """按【游戏里真实的查找顺序】算出: 每个岛的每个词, 单词发音和例句发音分别会播哪个文件。
       返回 (resolution, problems)。problems 非空 = 有词/句会掉去联网合成。"""
    wm, sm, ex = _load_maps()
    resolution, problems = {}, []
    for f in sorted(glob.glob("island_*.html")):
        words, la = _parse_island(f)
        if not words:
            continue
        isl = {}
        for w in words:
            lw = w["en"].lower()
            # 单词: 岛内映射 → 全局 WORD_MAP
            wp = la.get(lw) or la.get(w["en"]) or wm.get(lw)
            if not (wp and os.path.exists(wp)):
                problems.append("%s 的单词【%s】解析不到本地音频 → 会联网合成" % (f, w["en"]))
                wp = None
            # 例句: 星海规范化表 → 常规岛原文精确匹配表
            k = _norm(w["ex"])
            sp = None
            if k in ex and os.path.exists(ex[k]):
                sp = ex[k]
            elif w["ex"] in sm:
                cand = "sentences/sentence_%s.mp3" % str(sm[w["ex"]]).zfill(4)
                if os.path.exists(cand):
                    sp = cand
            if not sp:
                problems.append("%s 的【%s】的例句解析不到本地音频 → 会联网合成: 「%s」"
                                % (f, w["en"], w["ex"][:44]))
            isl[w["en"]] = {"w": wp, "s": sp}
        resolution[f] = isl
    return resolution, problems


def _sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(resolution):
    """给【所有被引用到的】音频文件按内容算指纹(改一个字节都会被发现)"""
    used = set()
    for isl in resolution.values():
        for v in isl.values():
            if v["w"]:
                used.add(v["w"])
            if v["s"]:
                used.add(v["s"])
    return {p: {"sha256": _sha(p), "size": os.path.getsize(p)} for p in sorted(used)}


def rebuild():
    resolution, problems = build_resolution()
    if problems:
        print("❌ 有 %d 处会掉去联网合成, 先修好再上锁:" % len(problems))
        for p in problems[:10]:
            print("   - " + p)
        return 1
    files = fingerprint(resolution)
    n_words = sum(len(v) for v in resolution.values())
    json.dump({
        "_说明": "全库发音总锁: 每个岛每个词的单词/例句音频文件 + 每个音频文件的 sha256。"
                 "任何一项对不上 → check_resources 拒绝打包。故意改音频后用 "
                 "python3 hansen_audio_lock.py --rebuild 重新生成。",
        "岛数": len(resolution), "词数": n_words, "音频文件数": len(files),
        "resolution": resolution, "files": files,
    }, open(LOCK, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("✅ 已上锁: %d 个岛 · %d 个词 · %d 个音频文件(含 sha256 指纹)" % (len(resolution), n_words, len(files)))
    return 0


def verify():
    """返回问题列表(空 = 全部合格)"""
    bad = []
    if not os.path.exists(LOCK):
        return ["hansen_audio_lock.json 丢失(全库发音总锁的基线不见了)"]
    lock = json.load(open(LOCK, encoding="utf-8"))
    resolution, problems = build_resolution()
    bad += problems[:6]

    old, new = lock["resolution"], resolution
    for isl in old:
        if isl not in new:
            bad.append("岛 %s 不见了(锁里有)" % isl)
            continue
        for w, v in old[isl].items():
            if w not in new[isl]:
                bad.append("%s 的词【%s】不见了" % (isl, w))
                continue
            cur = new[isl][w]
            if cur["w"] != v["w"]:
                bad.append("%s 的单词【%s】发音文件变了: 锁=%s 现在=%s(音频映射被改动)"
                           % (isl, w, v["w"], cur["w"]))
            if cur["s"] != v["s"]:
                bad.append("%s 的【%s】例句发音文件变了: 锁=%s 现在=%s"
                           "(多半是例句文字被改过 → key 对不上 → 会偷偷变回机器合成音)"
                           % (isl, w, v["s"], cur["s"]))
    for isl in new:
        if isl not in old:
            bad.append("多出一个岛 %s(锁里没有, 需 --rebuild)" % isl)

    for p, meta in lock["files"].items():
        if not os.path.exists(p):
            bad.append("音频文件被删了: %s" % p)
            continue
        if os.path.getsize(p) != meta["size"] or _sha(p) != meta["sha256"]:
            bad.append("音频文件内容被改过: %s(⚠️ URL 上的 ?v215 是写死的长期缓存令牌 —— "
                       "原地换文件不改名, 用户只会继续听到旧音频)" % p)
    return bad


if __name__ == "__main__":
    if "--rebuild" in sys.argv:
        sys.exit(rebuild())
    issues = verify()
    if issues:
        print("❌ 全库发音总锁: %d 处异常" % len(issues))
        for i in issues[:12]:
            print("   - " + i)
        sys.exit(1)
    print("✅ 全库发音总锁: 全部合格")
    sys.exit(0)
