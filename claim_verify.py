#!/usr/bin/env python3
"""claim_verify.py — 断言取证器（断言门禁协议 第1条 的可执行形态，v970）

用途：在做出任何 L2 负向断言（"缺少/没有/未实现/是bug"）之前，必须运行本工具
并出示其报告。工具替代"凭印象搜一下"，对仓库做四通道穷尽扫描：

  A. 文件名通道 —— 资源/代码/文档的文件名本身（音频、图片命名即证据）
  B. 文本通道   —— 代码 / 文档 / 数据原文的多变体全文检索
  C. 数据本体   —— island_data.json 深度解析（含 DATA 代码串内部）逐值搜索
  D. 结论闸门   —— 四通道全零时，输出协议第5条提醒：只许提问，不许宣判

用法：python3 claim_verify.py 变体1 变体2 变体3 ...
     （至少 3 个命名变体：英文名/中文名/缩写/后缀，如 sentence 例句 ex _ex_）
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SKIP_DIRS = {".git", "node_modules", "__pycache__", "releases", "release-assets",
             ".evolution_backups", "evolution_reports", "map8", "newboss"}
TEXT_EXT = {".js", ".mjs", ".html", ".md", ".json", ".py", ".css", ".txt", ".yml"}


def iter_files():
    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        yield p


def channel_filenames(variants):
    hits = {}
    for p in iter_files():
        name = p.name.lower()
        for v in variants:
            if v.lower() in name:
                hits.setdefault(v, []).append(str(p.relative_to(ROOT)))
    return hits


def channel_text(variants):
    hits = {v: {"count": 0, "files": {}} for v in variants}
    for p in iter_files():
        if p.suffix.lower() not in TEXT_EXT:
            continue
        try:
            raw = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        low = raw.lower()
        for v in variants:
            c = low.count(v.lower())
            if c:
                hits[v]["count"] += c
                hits[v]["files"][str(p.relative_to(ROOT))] = c
    return hits


def _walk(node, variants, found, trail=""):
    if isinstance(node, dict):
        for k, val in node.items():
            for v in variants:
                if v.lower() in str(k).lower():
                    found.setdefault(v, []).append(f"{trail}/{k} (键名)")
            _walk(val, variants, found, f"{trail}/{k}")
    elif isinstance(node, list):
        for i, val in enumerate(node[:2000]):
            _walk(val, variants, found, f"{trail}[{i}]")
    elif isinstance(node, str):
        low = node.lower()
        for v in variants:
            if v.lower() in low:
                found.setdefault(v, []).append(f"{trail} ≈ {node[:60]!r}")


def channel_data_body(variants):
    found = {}
    f = ROOT / "island_data.json"
    if f.exists():
        try:
            _walk(json.loads(f.read_text(encoding="utf-8")), variants, found, "island_data")
        except Exception as e:  # noqa: BLE001
            found["__error__"] = [f"island_data.json 解析失败: {e}"]
    return found


def main():
    variants = [a for a in sys.argv[1:] if a.strip()]
    if len(variants) < 3:
        print("❌ 协议第1条：至少提供 3 种命名变体（英文/中文/缩写或后缀）")
        sys.exit(2)
    print("═" * 62)
    print("断言取证报告 · claim_verify v970")
    print("变体:", " | ".join(variants))
    print("═" * 62)

    total = 0

    fn = channel_filenames(variants)
    print("\n【A 文件名通道】")
    for v in variants:
        lst = fn.get(v, [])
        total += len(lst)
        print(f"  {v}: {len(lst)} 个文件", ("→ " + ", ".join(lst[:4]) + (" …" if len(lst) > 4 else "")) if lst else "")

    tx = channel_text(variants)
    print("\n【B 文本通道】")
    for v in variants:
        h = tx[v]
        total += h["count"]
        top = sorted(h["files"].items(), key=lambda x: -x[1])[:4]
        print(f"  {v}: {h['count']} 处，分布 {len(h['files'])} 文件",
              ("→ " + ", ".join(f"{k}×{c}" for k, c in top)) if top else "")

    db = channel_data_body(variants)
    print("\n【C 数据本体通道（island_data 深解析，含 DATA 串内部）】")
    any_c = False
    for v in variants:
        lst = db.get(v, [])
        total += len(lst)
        if lst:
            any_c = True
        print(f"  {v}: {len(lst)} 处", ("→ " + lst[0][:90]) if lst else "")
    if "__error__" in db:
        print("  ⚠", db["__error__"][0])

    print("\n【D 结论闸门】")
    if total == 0:
        print("  四通道全零。按《断言门禁协议》第5条：")
        print("  ➜ 只允许以【提问】形式提出（'这块我没搜到，你做过吗？'），禁止宣判'缺失'。")
        sys.exit(1)
    print(f"  合计 {total} 处证据。可作为 L1 正向发现引用；若要做 L2 负向断言，")
    print("  必须解释为何以上证据不构成该能力（并在回复中附本报告）。")


if __name__ == "__main__":
    main()
