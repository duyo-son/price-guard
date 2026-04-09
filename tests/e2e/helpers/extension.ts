import puppeteer, { type Browser, TargetType } from 'puppeteer';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DIST_PATH = resolve(__dirname, '../../../dist');

export interface ExtensionContext {
  browser: Browser;
  extensionId: string;
}

function assertDistExists(): void {
  if (!existsSync(resolve(DIST_PATH, 'manifest.json'))) {
    throw new Error(
      `[E2E] dist/manifest.json not found. Run 'npm run build' first.`,
    );
  }
}

export async function launchWithExtension(): Promise<ExtensionContext> {
  assertDistExists();

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--load-extension=${DIST_PATH}`,
      `--disable-extensions-except=${DIST_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  // Service Worker가 등록될 때까지 최대 10초 대기
  for (let i = 0; i < 20; i++) {
    const targets = browser.targets();
    const sw = targets.find(
      (t) => t.type() === TargetType.SERVICE_WORKER && t.url().startsWith('chrome-extension://'),
    );
    if (sw) {
      const url = sw.url();
      const parts = url.split('/');
      const extensionId = parts[2] ?? '';
      if (extensionId) return { browser, extensionId };
    }
    await new Promise<void>((r) => setTimeout(r, 500));
  }

  await browser.close();
  throw new Error('[E2E] Extension service worker not found within timeout.');
}

export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}
