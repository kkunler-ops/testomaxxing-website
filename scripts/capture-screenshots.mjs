#!/usr/bin/env node
/**
 * Captures phone-framed screenshots from the Figma Make app (sibling folder ../Figma Make).
 *
 * Requires: valid .env in Figma Make (VITE_SUPABASE_*), npm install there, and a browser:
 *   - Google Chrome (recommended — we try `channel: 'chrome'` first), or
 *   - Playwright’s bundled Chromium: run `npx playwright install chromium`
 *
 * We avoid `networkidle` because Supabase/long-polling often prevents it from ever firing.
 *
 * Run from website root: npm run capture-screenshots
 * Env: FIGMA_MAKE_DIR=/absolute/path/to/Figma Make
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(WEBSITE_ROOT, 'public', 'mockups');
const DEFAULT_FIGMA = path.resolve(WEBSITE_ROOT, '..', 'Figma Make');
const FIGMA_MAKE_DIR = process.env.FIGMA_MAKE_DIR || DEFAULT_FIGMA;
const BASE = 'http://127.0.0.1:5199';
const CAPTURES = [
  { path: '/home', file: 'home.png', caption: 'Home & score' },
  { path: '/checkin/1', file: 'checkin.png', caption: 'Daily check-in' },
  { path: '/trends', file: 'trends.png', caption: 'Trends' },
];

function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok || res.status === 404) {
          resolve();
          return;
        }
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server did not respond at ${url} within ${timeoutMs}ms`));
        return;
      }
      setTimeout(tryOnce, 500);
    };
    tryOnce();
  });
}

async function launchBrowser() {
  const tries = [
    () => chromium.launch({ channel: 'chrome' }),
    () => chromium.launch({ channel: 'msedge' }),
    () => chromium.launch(),
    () => firefox.launch(),
    () => webkit.launch(),
  ];
  let lastErr;
  for (const fn of tries) {
    try {
      const b = await fn();
      return b;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (!existsSync(path.join(FIGMA_MAKE_DIR, 'package.json'))) {
    console.error(
      `Figma Make project not found at:\n  ${FIGMA_MAKE_DIR}\nSet FIGMA_MAKE_DIR to the folder that contains package.json`,
    );
    process.exit(1);
  }

  console.log('Starting Figma Make dev server with VITE_DEMO_SCREENSHOTS=true …');
  console.log('cwd:', FIGMA_MAKE_DIR);

  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
    cwd: FIGMA_MAKE_DIR,
    env: { ...process.env, VITE_DEMO_SCREENSHOTS: 'true' },
    stdio: 'inherit',
  });

  try {
    await waitForServer(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 2000));

    const browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const shot of CAPTURES) {
      const url = `${BASE}${shot.path}`;
      console.log('Screenshot:', url);
      await page.goto(url, { waitUntil: 'load', timeout: 120000 });
      await new Promise((r) => setTimeout(r, 3500));
      const outPath = path.join(OUT_DIR, shot.file);
      await page.screenshot({ path: outPath, type: 'png' });
      console.log('  →', outPath);
    }

    await browser.close();
    console.log('Done. Images are in public/mockups/');
  } finally {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
