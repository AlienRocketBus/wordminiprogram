#!/usr/bin/env python3
"""发布后清理旧 Release：只保留最新 KEEP 个（含 tag）。

为什么是独立脚本而不是内嵌 CI：
  这段清理逻辑前后失败三次，每次都是"环境假设"出问题而非逻辑错——
    v1051: 依赖 `gh release list` 的列输出格式，新版 gh 首列未必是 tag；
    v1053: 改用 `gh api --jq`，但 --jq 依赖 gh 内建组件，失败时静默返回空；
    v1055: 仍未生效。
  三次都表现为"CI 步骤 success、日志无异常、但什么都没删"。
  独立脚本的好处：只用标准库解析 JSON，可在本地直接跑通验证，
  不受 YAML 缩进与 shell 转义影响，且每步都打印数量便于定位。
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

KEEP = int(os.environ.get("KEEP_RELEASES", "5"))
REPO = os.environ.get("GITHUB_REPOSITORY", "")
TOKEN = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN", "")


def fetch_releases():
    url = f"https://api.github.com/repos/{REPO}/releases?per_page=100"
    req = urllib.request.Request(url, headers={
        "Authorization": f"token {TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "prune-releases",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    if not REPO or not TOKEN:
        print("prune: missing GITHUB_REPOSITORY or token, skip")
        return 0
    try:
        releases = fetch_releases()
    except Exception as exc:                      # 网络问题不该让发版失败
        print(f"prune: fetch failed ({exc}), skip")
        return 0

    tags = [r.get("tag_name", "") for r in releases if isinstance(r, dict)]
    nums = sorted({int(t[1:]) for t in tags if re.fullmatch(r"v\d+", t)}, reverse=True)
    print(f"prune: found {len(releases)} releases, {len(nums)} versioned")
    print(f"prune: keeping newest {KEEP} -> {['v%d' % n for n in nums[:KEEP]]}")

    doomed = [f"v{n}" for n in nums[KEEP:]]
    if not doomed:
        print("prune: nothing to delete")
        return 0
    print(f"prune: deleting {doomed}")

    by_tag = {r.get("tag_name"): r for r in releases if isinstance(r, dict)}
    for tag in doomed:
        if delete_via_gh(tag) or delete_via_api(tag, by_tag.get(tag)):
            print(f"  deleted {tag}")
        else:
            print(f"  FAILED {tag}")
    return 0


def delete_via_gh(tag):
    """优先用 gh CLI（能顺带清 tag）。本地无 gh 时会走下面的 API 兜底。"""
    for args in (["--yes", "--cleanup-tag"], ["--yes"]):
        try:
            done = subprocess.run(["gh", "release", "delete", tag, "--repo", REPO] + args,
                                  capture_output=True, text=True, timeout=60)
            if done.returncode == 0:
                return True
        except (FileNotFoundError, subprocess.SubprocessError):
            return False      # 没有 gh，直接交给 API
    return False


def delete_via_api(tag, rel):
    """纯 API 兜底：删 Release，再删对应 tag。不依赖任何外部命令。"""
    ok = False
    if rel and rel.get("id"):
        ok = _api_delete(f"/repos/{REPO}/releases/{rel['id']}")
    _api_delete(f"/repos/{REPO}/git/refs/tags/{tag}")   # tag 删失败不影响主结果
    return ok


def _api_delete(path):
    req = urllib.request.Request("https://api.github.com" + path, method="DELETE",
                                 headers={"Authorization": f"token {TOKEN}",
                                          "Accept": "application/vnd.github+json",
                                          "User-Agent": "prune-releases"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status in (204, 200)
    except Exception:
        return False


if __name__ == "__main__":
    sys.exit(main())
