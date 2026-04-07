#!/usr/bin/env node
import { execSync } from 'child_process';
import { rmSync, copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

console.log('[price-guard] Cleaning dist...');
rmSync('dist', { recursive: true, force: true });

console.log('[price-guard] Building popup...');
run('vite build');

console.log('[price-guard] Building background service worker...');
run('vite build --config vite.background.config.ts');

console.log('[price-guard] Building content script...');
run('vite build --config vite.content.config.ts');

console.log('[price-guard] Copying manifest...');
copyFileSync('manifest.json', join('dist', 'manifest.json'));

const iconsDir = join('public', 'icons');
if (existsSync(iconsDir)) {
  mkdirSync(join('dist', 'icons'), { recursive: true });
  for (const file of readdirSync(iconsDir)) {
    copyFileSync(join(iconsDir, file), join('dist', 'icons', file));
  }
}

console.log('[price-guard] ✅ Build complete! Load dist/ as unpacked extension in Chrome.');
