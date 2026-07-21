/**
 * Portable Playwright/Chromium loader used by every browser probe.
 *
 * Resolution order:
 *   1. HANSEN_PLAYWRIGHT_MODULE (optional explicit module path/specifier)
 *   2. the repository's normal `playwright` dependency (CI/local npm install)
 *   3. the legacy global install, only as a backwards-compatible fallback
 *
 * Chromium can be selected with HANSEN_CHROMIUM_PATH. Invalid hard-coded
 * paths passed by an old probe are discarded so Playwright can use its own
 * installed browser instead of failing on a machine-specific path.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function moduleSpecifier(value) {
  if (!value) return null;
  if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) {
    return pathToFileURL(value).href;
  }
  return value;
}

const moduleCandidates = [
  moduleSpecifier(process.env.HANSEN_PLAYWRIGHT_MODULE || ''),
  'playwright',
  'playwright-core',
  'file:///home/claude/.npm-global/lib/node_modules/playwright/index.mjs',
].filter(Boolean);

let loaded = null;
let lastError = null;
for (const candidate of moduleCandidates) {
  try {
    loaded = await import(candidate);
    if (loaded && loaded.chromium) break;
  } catch (error) {
    lastError = error;
  }
}
if (!loaded || !loaded.chromium) {
  throw new Error(
    'Playwright is unavailable. Run `npm install --no-save playwright` or set ' +
    'HANSEN_PLAYWRIGHT_MODULE. Last error: ' + (lastError?.message || 'unknown')
  );
}

const nativeChromium = loaded.chromium;

function commandPath(name) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return '';
  return (result.stdout || '').split(/\r?\n/).find(Boolean) || '';
}

function usableBrowser(requested) {
  const candidates = [
    process.env.HANSEN_CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
    requested,
  ];
  try { candidates.push(nativeChromium.executablePath()); } catch (_) {}
  candidates.push(commandPath('chromium'), commandPath('chromium-browser'), commandPath('google-chrome'));
  return candidates.find(path => path && existsSync(path)) || '';
}

async function launch(options = {}) {
  const finalOptions = { ...options };
  const executablePath = usableBrowser(finalOptions.executablePath);
  if (executablePath) finalOptions.executablePath = executablePath;
  else delete finalOptions.executablePath;
  return nativeChromium.launch(finalOptions);
}

export const chromium = new Proxy(nativeChromium, {
  get(target, property) {
    if (property === 'launch') return launch;
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export const playwright = loaded;
