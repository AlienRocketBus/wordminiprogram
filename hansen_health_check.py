#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Portable, fail-closed browser health check for Word Adventure.

Unlike the historical checker, this program never reuses permanent ``done``
files, never kills unrelated browser processes, and never assumes a developer's
home directory or Chromium path. Missing Node, Playwright, Chromium, server
startup, or an unexecuted assertion is a hard failure.

Usage::

    python3 hansen_health_check.py          # all 27 islands
    python3 hansen_health_check.py --quick  # representative three islands

Set ``PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`` only when a non-default Chromium
binary is intentionally required. Normally Playwright resolves its own browser.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request


ROOT = Path(__file__).resolve().parent
QUICK = "--quick" in sys.argv[1:]
BASE_ISLANDS = [
    "action", "adjective", "animal", "body", "city", "clothes", "color",
    "family", "food", "home", "job", "nature", "question", "school",
    "season", "sports", "time", "traffic", "treasure",
]
ALL_PAGES = [f"island_{name}.html" for name in BASE_ISLANDS]
ALL_PAGES.extend(f"island_land{i}.html" for i in range(1, 9))
PAGES = ["island_animal.html", "island_season.html", "island_land1.html"] if QUICK else ALL_PAGES
RESULT_PREFIX = "HANSEN_HEALTH_RESULT="


def _fail(message: str, detail: str = "") -> int:
    print(f"❌ {message}", file=sys.stderr)
    if detail:
        print(detail[-4000:], file=sys.stderr)
    return 1


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_server(url: str, process: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + 12
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"HTTP server exited early with rc={process.returncode}")
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except Exception as exc:  # server may still be binding
            last_error = exc
        time.sleep(0.15)
    raise RuntimeError(f"HTTP server did not become ready: {last_error}")


BROWSER_SCRIPT = r'''const { chromium } = require(process.env.HANSEN_PLAYWRIGHT_MODULE);
const pages = JSON.parse(process.env.HANSEN_HEALTH_PAGES || "[]");
const base = process.env.HANSEN_HEALTH_BASE;
const resultPrefix = "HANSEN_HEALTH_RESULT=";

function die(message, details = []) {
  console.error("HEALTH_CHECK_FAILED: " + message);
  for (const detail of details.slice(0, 30)) console.error("  - " + detail);
  process.exitCode = 1;
}

(async () => {
  if (!base || pages.length === 0) {
    die("invalid runner configuration");
    return;
  }
  const launchOptions = {
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    die("Playwright/Chromium infrastructure unavailable", [String(error)]);
    return;
  }

  const failures = [];
  let assertions = 0;
  let visited = 0;
  try {
    for (const file of pages) {
      const context = await browser.newContext({ viewport: { width: 393, height: 747 } });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on("pageerror", error => runtimeErrors.push("pageerror: " + String(error)));
      page.on("console", message => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (!/favicon|autoplay|NotAllowedError|play\(\) failed/i.test(text)) {
          runtimeErrors.push("console.error: " + text);
        }
      });

      try {
        const response = await page.goto(base + file, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        assertions++;
        if (!response || !response.ok()) {
          failures.push(`${file}: navigation status ${response ? response.status() : "none"}`);
        }
        await page.waitForTimeout(1000);
        const state = await page.evaluate(() => ({
          bodyChildren: document.body ? document.body.children.length : 0,
          bodyText: document.body ? (document.body.innerText || "").trim().length : 0,
          hasSave: typeof window.save === "function",
          hasMarkAnswer: typeof window.markAnswer === "function",
          hasWords: typeof allW !== "undefined" && Array.isArray(allW) && allW.length > 0,
          versionWarning: Array.from(document.querySelectorAll("body *")).some(el => {
            const text = (el.textContent || "").trim();
            return text.length < 180 && /版本.{0,20}(不一致|mismatch)|缓存.{0,20}旧版本/i.test(text);
          }),
        }));
        assertions += 6;
        if (state.bodyChildren === 0 || state.bodyText === 0) failures.push(`${file}: blank page`);
        if (!state.hasSave) failures.push(`${file}: save() was not initialized`);
        if (!state.hasMarkAnswer) failures.push(`${file}: markAnswer() was not initialized`);
        if (!state.hasWords) failures.push(`${file}: allW word data was not initialized`);
        if (state.versionWarning) failures.push(`${file}: runtime version/cache warning is visible`);
        if (runtimeErrors.length) failures.push(`${file}: ${runtimeErrors.slice(0, 3).join(" | ")}`);
        visited++;
        console.log(`✅ ${file} (${state.bodyChildren} body children)`);
      } catch (error) {
        failures.push(`${file}: ${String(error)}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const expectedAssertions = pages.length * 7;
  if (visited !== pages.length) failures.push(`only ${visited}/${pages.length} pages completed`);
  if (assertions !== expectedAssertions) {
    failures.push(`assertion wall incomplete: ${assertions}/${expectedAssertions}`);
  }
  const result = { ok: failures.length === 0, visited, expected: pages.length,
                   assertions, expectedAssertions, failures };
  console.log(resultPrefix + JSON.stringify(result));
  if (failures.length) die(`${failures.length} browser health failure(s)`, failures);
})().catch(error => {
  die("uncaught health-check runner error", [error && error.stack ? error.stack : String(error)]);
});
'''


def main() -> int:
    unknown = [arg for arg in sys.argv[1:] if arg != "--quick"]
    if unknown:
        return _fail(f"unknown health-check arguments: {unknown}")
    print("=" * 68)
    print(f"Hansen health check: {'quick' if QUICK else 'full'} · {len(PAGES)} pages · fail closed")
    print("=" * 68)

    node = shutil.which("node")
    if not node:
        return _fail("Node.js is required; browser assertions were not executed")
    for page in PAGES:
        if not (ROOT / page).is_file():
            return _fail(f"required page is missing: {page}")

    guard = ROOT / "check_resources.py"
    if not guard.is_file():
        return _fail("check_resources.py is missing; static assertions were not executed")
    static = subprocess.run([sys.executable, str(guard)], cwd=ROOT, text=True,
                            capture_output=True, timeout=240)
    if static.returncode != 0:
        return _fail("static guard failed", (static.stdout or "") + (static.stderr or ""))
    print("✅ Static guard completed")

    # Resolve the module before starting a server. A missing npm install must not
    # be presented as a successful or skipped browser check.
    resolve = subprocess.run(
        [node, "-e", "console.log(require.resolve('playwright'))"],
        cwd=ROOT, text=True, capture_output=True, timeout=20,
    )
    if resolve.returncode != 0:
        return _fail(
            "Playwright is not installed; browser assertions were not executed",
            "Run `npm ci` using the checked-in package-lock.json.\n" + (resolve.stderr or ""),
        )
    playwright_module = resolve.stdout.strip().splitlines()[-1]
    if not playwright_module:
        return _fail("Playwright resolved to an empty module path")

    port = _free_port()
    base = f"http://127.0.0.1:{port}/"
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        # A full 27-page run requests thousands of assets.  Leaving the
        # server's access log on an unread PIPE can fill the OS pipe buffer and
        # deadlock the server/browser; discard only this child process's log.
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_server(base, server)
        with tempfile.TemporaryDirectory(prefix="hansen-health-") as tmp:
            runner = Path(tmp) / "health_runner.cjs"
            runner.write_text(BROWSER_SCRIPT, encoding="utf-8")
            env = os.environ.copy()
            env["HANSEN_HEALTH_BASE"] = base
            env["HANSEN_HEALTH_PAGES"] = json.dumps(PAGES)
            env["HANSEN_PLAYWRIGHT_MODULE"] = playwright_module
            run = subprocess.run(
                [node, str(runner)], cwd=ROOT, env=env, text=True,
                capture_output=True, timeout=900,
            )
    except subprocess.TimeoutExpired as exc:
        return _fail("browser health check timed out; assertions are incomplete", str(exc))
    except Exception as exc:
        return _fail("health-check infrastructure failed", str(exc))
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)

    output = (run.stdout or "") + (run.stderr or "")
    print(run.stdout or "", end="")
    result_lines = [line for line in (run.stdout or "").splitlines()
                    if line.startswith(RESULT_PREFIX)]
    if run.returncode != 0:
        return _fail("browser health check failed", output)
    if len(result_lines) != 1:
        return _fail("browser runner returned success without exactly one assertion result", output)
    try:
        result = json.loads(result_lines[0][len(RESULT_PREFIX):])
    except (ValueError, TypeError) as exc:
        return _fail("browser assertion result is invalid", str(exc))
    if not result.get("ok"):
        return _fail("browser runner reported failed assertions", json.dumps(result, ensure_ascii=False))
    if result.get("visited") != len(PAGES) or result.get("assertions") != len(PAGES) * 7:
        return _fail("browser assertions did not all execute", json.dumps(result, ensure_ascii=False))

    print(f"✅ Health check passed: {len(PAGES)} pages · {result['assertions']} assertions executed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
