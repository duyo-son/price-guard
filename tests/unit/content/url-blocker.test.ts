import { describe, it, expect } from 'vitest';
import { isBlockedUrl } from '../../../src/content/index.js';

describe('isBlockedUrl()', () => {
  // ── 차단해야 하는 URL ─────────────────────────────────────────────────────
  it('쿠팡 브랜드스토어 홈은 차단', () => {
    expect(isBlockedUrl('https://shop.coupang.com/brandstore/abc')).toBe(true);
  });

  it('네이버 쇼핑 검색은 차단', () => {
    expect(isBlockedUrl('https://search.shopping.naver.com/search/all?query=의자')).toBe(true);
  });

  it('네이버 통합 검색은 차단', () => {
    expect(isBlockedUrl('https://search.naver.com/search.naver?query=의자')).toBe(true);
  });

  it('smartstore 스토어 홈은 차단', () => {
    expect(isBlockedUrl('https://smartstore.naver.com/thebale')).toBe(true);
  });

  it('smartstore 카테고리 리스트는 차단', () => {
    expect(isBlockedUrl('https://smartstore.naver.com/thebale/category/1')).toBe(true);
  });

  it('brand.naver.com 스토어 홈은 차단', () => {
    expect(isBlockedUrl('https://brand.naver.com/somebrand')).toBe(true);
  });

  it('알리익스프레스 카테고리 페이지는 차단', () => {
    expect(isBlockedUrl('https://www.aliexpress.com/category/200003498/earphones.html')).toBe(true);
  });

  // ── 통과해야 하는 URL ─────────────────────────────────────────────────────
  it('쿠팡 상품 페이지는 통과', () => {
    expect(isBlockedUrl('https://www.coupang.com/vp/products/1234567')).toBe(false);
  });

  it('smartstore 상품 페이지는 통과', () => {
    expect(isBlockedUrl('https://smartstore.naver.com/thebale/products/3894760006')).toBe(false);
  });

  it('brand.naver.com 상품 페이지는 통과', () => {
    expect(isBlockedUrl('https://brand.naver.com/somebrand/products/123456')).toBe(false);
  });

  it('알리익스프레스 상품 페이지는 통과', () => {
    expect(isBlockedUrl('https://www.aliexpress.com/item/1005006789012345.html')).toBe(false);
  });

  it('일반 외부 사이트는 통과', () => {
    expect(isBlockedUrl('https://example.com/product/999')).toBe(false);
  });
});
