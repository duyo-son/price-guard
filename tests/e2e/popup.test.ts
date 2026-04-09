import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { type Browser, type Page } from 'puppeteer';
import { launchWithExtension, closeBrowser } from './helpers/extension.js';

let browser: Browser;
let extensionId: string;
let page: Page;

beforeAll(async () => {
  const ctx = await launchWithExtension();
  browser = ctx.browser;
  extensionId = ctx.extensionId;
  page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`, {
    waitUntil: 'networkidle0',
  });
}, 60_000);

afterAll(async () => {
  await closeBrowser(browser);
});

beforeEach(async () => {
  await page.evaluate(() => chrome.storage.local.clear());
  await page.reload({ waitUntil: 'networkidle0' });
});

describe('팝업 — 초기 상태', () => {
  it('헤더에 "가격파수꾼" 타이틀이 표시된다', async () => {
    const title = await page.$eval('h1', (el: Element) => el.textContent ?? '');
    expect(title).toBe('가격파수꾼');
  });

  it('빈 상태 메시지가 표시된다', async () => {
    await page.waitForSelector('.empty-state');
    const text = await page.$eval('#product-list', (el: Element) => el.textContent ?? '');
    expect(text).toContain('추적 중인 상품이 없습니다');
  });

  it('"지금 확인" 버튼이 존재한다', async () => {
    const btn = await page.$('#btn-check-now');
    expect(btn).not.toBeNull();
  });

  it('설정 버튼이 존재한다', async () => {
    const btn = await page.$('#btn-settings');
    expect(btn).not.toBeNull();
  });

  it('테스트 모드 버튼이 존재한다', async () => {
    const btn = await page.$('#btn-devtools');
    expect(btn).not.toBeNull();
  });
});

describe('팝업 — 설정 패널', () => {
  it('설정 패널이 처음에는 닫혀 있다', async () => {
    const hasOpen = await page.$eval(
      '#settings-panel',
      (el: Element) => el.classList.contains('open'),
    );
    expect(hasOpen).toBe(false);
  });

  it('설정 버튼 클릭 시 패널이 열린다', async () => {
    await page.click('#btn-settings');
    await page.waitForFunction(
      () => document.getElementById('settings-panel')?.classList.contains('open'),
    );
    const hasOpen = await page.$eval(
      '#settings-panel',
      (el: Element) => el.classList.contains('open'),
    );
    expect(hasOpen).toBe(true);
  });

  it('위치 타일 4개가 존재한다', async () => {
    await page.click('#btn-settings');
    const tiles = await page.$$('[data-pos]');
    expect(tiles.length).toBe(4);
  });

  it('위치 타일 클릭 시 active 클래스가 적용된다', async () => {
    await page.click('#btn-settings');
    await page.click('[data-pos="top-right"]');
    const isActive = await page.$eval(
      '[data-pos="top-right"]',
      (el: Element) => el.classList.contains('active'),
    );
    expect(isActive).toBe(true);
  });
});
