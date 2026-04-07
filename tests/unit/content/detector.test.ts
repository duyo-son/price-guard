import { describe, it, expect } from 'vitest';
import { createGenericDetector, parsePrice } from '../../../src/content/detector.js';

// ── parsePrice ──────────────────────────────────────────────────────────────

describe('parsePrice()', () => {
  it('Korean 원화 포맷 파싱', () => {
    expect(parsePrice('50,000원')).toBe(50000);
    expect(parsePrice('1,234,567원')).toBe(1234567);
  });

  it('숫자만 있는 문자열 파싱', () => {
    expect(parsePrice('29900')).toBe(29900);
  });

  it('숫자가 없으면 null 반환', () => {
    expect(parsePrice('무료')).toBeNull();
    expect(parsePrice('')).toBeNull();
  });
});

// ── createGenericDetector ───────────────────────────────────────────────────

function makeDoc(body: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><head></head><body>${body}</body></html>`,
    'text/html',
  );
}

describe('createGenericDetector()', () => {
  describe('isProductPage()', () => {
    it('Schema.org Product 마크업이 있으면 true', () => {
      const doc = makeDoc('<div itemtype="https://schema.org/Product">Product</div>');
      expect(createGenericDetector(doc, 'https://example.com').isProductPage()).toBe(true);
    });

    it('price 클래스가 있으면 true', () => {
      const doc = makeDoc('<span class="price">50,000원</span>');
      expect(createGenericDetector(doc, 'https://example.com').isProductPage()).toBe(true);
    });

    it('상품 관련 요소 없으면 false', () => {
      const doc = makeDoc('<p>일반 블로그 글</p>');
      expect(createGenericDetector(doc, 'https://example.com').isProductPage()).toBe(false);
    });
  });

  describe('extractProduct()', () => {
    it('완전한 상품 정보 추출', () => {
      const doc = makeDoc(`
        <h1 itemprop="name">테스트 상품</h1>
        <span itemprop="price" content="50000">50,000원</span>
        <meta property="og:image" content="https://example.com/img.jpg" />
      `);
      const product = createGenericDetector(doc, 'https://example.com/p/1').extractProduct();

      expect(product).not.toBeNull();
      expect(product?.name).toBe('테스트 상품');
      expect(product?.price).toBe(50000);
      expect(product?.imageUrl).toBe('https://example.com/img.jpg');
      expect(product?.url).toBe('https://example.com/p/1');
    });

    it('상품 페이지가 아니면 null 반환', () => {
      const doc = makeDoc('<p>블로그 글</p>');
      expect(createGenericDetector(doc, 'https://blog.example.com').extractProduct()).toBeNull();
    });

    it('이름만 있고 가격이 없으면 null 반환', () => {
      const doc = makeDoc('<h1 itemprop="name">이름만 있는 페이지</h1>');
      expect(createGenericDetector(doc, 'https://example.com').extractProduct()).toBeNull();
    });
  });
});
