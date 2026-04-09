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
  await page.goto(`chrome-extension://${extensionId}/devtools/index.html`, {
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

describe('테스트 모드 — 페이지 로드', () => {
  it('"테스트 모드" 타이틀이 표시된다', async () => {
    const title = await page.$eval('h1', (el: Element) => el.textContent ?? '');
    expect(title).toBe('테스트 모드');
  });

  it('프리셋 버튼 6개가 존재한다', async () => {
    const btns = await page.$$('[data-preset]');
    expect(btns.length).toBe(6);
  });

  it('초기 상품 수가 0이다', async () => {
    const count = await page.$eval('#product-count', (el: Element) => el.textContent ?? '');
    expect(count).toBe('0');
  });
});

describe('테스트 모드 — 프리셋', () => {
  it('"정상 추적 중" 프리셋: 1개 상품이 표시된다', async () => {
    await page.click('[data-preset="normal"]');
    await page.waitForSelector('.tm-product-card');
    const count = await page.$$eval('.tm-product-card', (cards) => cards.length);
    expect(count).toBe(1);
    const countBadge = await page.$eval('#product-count', (el: Element) => el.textContent ?? '');
    expect(countBadge).toBe('1');
  });

  it('"다수 상품" 프리셋: 5개 상품이 표시된다', async () => {
    await page.click('[data-preset="multi"]');
    await page.waitForSelector('.tm-product-card');
    const count = await page.$$eval('.tm-product-card', (cards) => cards.length);
    expect(count).toBe(5);
  });

  it('"초기 상태" 프리셋: 빈 상태로 리셋된다', async () => {
    await page.click('[data-preset="multi"]');
    await page.waitForSelector('.tm-product-card');
    await page.click('[data-preset="empty"]');
    await page.waitForFunction(
      () => document.querySelectorAll('.tm-product-card').length === 0,
    );
    const count = (await page.$$('.tm-product-card')).length;
    expect(count).toBe(0);
  });

  it('"목표가 도달" 프리셋: 🎯 상태 뱃지가 표시된다', async () => {
    await page.click('[data-preset="target-met"]');
    await page.waitForSelector('.tm-product-card');
    const text = await page.$eval('#products-list', (el: Element) => el.textContent ?? '');
    expect(text).toContain('🎯');
  });
});

describe('테스트 모드 — 상품 추가/삭제', () => {
  beforeEach(async () => {
    await page.click('[data-preset="empty"]');
    await page.waitForFunction(
      () => document.querySelector('.tm-product-card') === null,
    );
  });

  it('폼으로 상품을 추가할 수 있다', async () => {
    await page.type('#input-name', '테스트 헤드폰');
    await page.type('#input-url', 'https://www.coupang.com/vp/products/99999');
    await page.type('#input-price', '50000');
    await page.click('#btn-add-product');
    await page.waitForSelector('.tm-product-card');
    const count = await page.$$eval('.tm-product-card', (cards) => cards.length);
    expect(count).toBe(1);
  });

  it('상품명과 URL 없이 제출하면 토스트 경고가 표시된다', async () => {
    await page.click('#btn-add-product');
    await page.waitForSelector('#toast.show');
    const toastText = await page.$eval('#toast', (el: Element) => el.textContent ?? '');
    expect(toastText).toContain('⚠');
  });

  it('상품을 삭제할 수 있다', async () => {
    await page.type('#input-name', '삭제할 상품');
    await page.type('#input-url', 'https://www.coupang.com/vp/products/11111');
    await page.type('#input-price', '30000');
    await page.click('#btn-add-product');
    await page.waitForSelector('.btn-delete');
    await page.click('.btn-delete');
    await page.waitForFunction(
      () => document.querySelector('.tm-product-card') === null,
    );
    const count = (await page.$$('.tm-product-card')).length;
    expect(count).toBe(0);
  });
});

describe('테스트 모드 — FAB 위치', () => {
  it('위치 타일 4개가 존재한다', async () => {
    const tiles = await page.$$('[data-pos]');
    expect(tiles.length).toBe(4);
  });

  it('위치 타일 클릭 시 active가 변경된다', async () => {
    await page.click('[data-pos="top-right"]');
    await page.waitForFunction(
      () => document.querySelector('[data-pos="top-right"]')?.classList.contains('active'),
    );
    const isActive = await page.$eval(
      '[data-pos="top-right"]',
      (el: Element) => el.classList.contains('active'),
    );
    expect(isActive).toBe(true);
  });
});
