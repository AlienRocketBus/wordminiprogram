#!/usr/bin/env node
/** v943 regression: reduced-motion must never collapse theme actors to (0, 0). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const universalClamp = /\*,\*::before,\*::after\s*\{[^}]*animation-duration\s*:\s*\.0*1?m?s[^}]*animation-iteration-count\s*:\s*1/i;

for (const name of ['index.html', 'hansen_accessibility.js', 'spelling_bee.html', 'land_map.html']) {
  assert.equal(universalClamp.test(read(name)), false,
    `${name}: must not restore the universal one-shot animation clamp`);
}

const executablePath = process.env.HANSEN_CHROMIUM_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });

try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      reducedMotion
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, {
      waitUntil: 'domcontentloaded'
    });
    const expected = { cosmos: 5, pink: 8, ocean: 6, forest: 9, rainbow: 8, peach: 10 };
    const sample = () => page.evaluate(() => Array.from(
      document.querySelectorAll('.flyer[data-flyer-theme]')
    ).filter(element => getComputedStyle(element).display !== 'none').map(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        className: element.className,
        x: box.x,
        y: box.y,
        transform: style.transform,
        durations: style.animationDuration.split(',').map(value => parseFloat(value) || 0),
        iterations: style.animationIterationCount.split(',').map(value => value.trim())
      };
    }));

    for (const [theme, count] of Object.entries(expected)) {
      await page.evaluate(value => {
        try { localStorage.setItem('theme', value); } catch (_) {}
        document.body.dataset.theme = value;
      }, theme);
      await page.waitForTimeout(120);
      const first = await sample();
      await page.waitForTimeout(420);
      const second = await sample();
      assert.equal(first.length, count, `${reducedMotion}/${theme}: actor count changed`);
      const collapsed = first.filter(actor => Math.abs(actor.x) < 1 && Math.abs(actor.y) < 1);
      assert.equal(collapsed.length, 0,
        `${reducedMotion}/${theme}: actors collapsed at the top-left: ${collapsed.map(x => x.className).join(', ')}`);
      assert(first.every(actor => actor.durations.some(seconds => seconds >= 1)),
        `${reducedMotion}/${theme}: theme animation was reduced to an instant`);
      assert(first.every(actor => actor.iterations.includes('infinite')),
        `${reducedMotion}/${theme}: theme animation lost its infinite positioning track`);
      const moved = first.some((actor, index) => {
        const next = second[index];
        return next && (Math.abs(actor.x - next.x) > 0.2 || Math.abs(actor.y - next.y) > 0.2 ||
          actor.transform !== next.transform);
      });
      assert.equal(moved, true, `${reducedMotion}/${theme}: no theme actor moved`);
    }
    assert.equal(errors.length, 0, `${reducedMotion}: page errors: ${errors.join(' | ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log('✅ v943 theme motion regression passed (normal + reduced-motion mobile profiles)');
