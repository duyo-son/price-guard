import { describe, it, expect, beforeEach } from 'vitest';
import { createCoupangDetector } from '../../../../src/content/sites/coupang.js';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('CoupangDetector', () => {
  const PRODUCT_URL = 'https://www.coupang.com/vp/products/7978016571?vendorItemId=94597320861';
  let doc: Document;

  beforeEach(() => {
    doc = makeDoc(`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="canonical" href="https://www.coupang.com/vp/products/7978016571?vendorItemId=94597320861" />
          <meta property="og:image" content="https://thumbnail7.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/test.jpg" />
        </head>
        <body>
          <h1 class="prod-buy-header__title">테스트 무선 이어폰 블루투스 5.3</h1>
          <div class="prod-price">
            <div class="total-price">
              <strong>29,900</strong>
            </div>
          </div>
          <img class="prod-image__detail" src="https://thumbnail7.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/test.jpg" />
        </body>
      </html>
    `);
  });

  describe('isProductPage()', () => {
    it('쿠팡 상품 URL에서 true를 반환한다', () => {
      const detector = createCoupangDetector(doc, PRODUCT_URL);
      expect(detector.isProductPage()).toBe(true);
    });

    it('쿠팡 검색 페이지에서 false를 반환한다', () => {
      const detector = createCoupangDetector(doc, 'https://www.coupang.com/np/search?q=이어폰');
      expect(detector.isProductPage()).toBe(false);
    });

    it('타 도메인에서 false를 반환한다', () => {
      const detector = createCoupangDetector(doc, 'https://www.naver.com/');
      expect(detector.isProductPage()).toBe(false);
    });
  });

  describe('extractProduct()', () => {
    it('상품명을 추출한다', () => {
      const detector = createCoupangDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.name).toBe('테스트 무선 이어폰 블루투스 5.3');
    });

    it('가격을 숫자로 추출한다 (쉼표 제거)', () => {
      const detector = createCoupangDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.price).toBe(29900);
    });

    it('og:image URL을 메인 이미지로 추출한다', () => {
      const detector = createCoupangDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.imageUrl).toBe(
        'https://thumbnail7.coupangcdn.com/thumbnails/remote/492x492ex/image/retail/images/test.jpg',
      );
    });

    it('canonical URL을 상품 URL로 사용한다', () => {
      const detector = createCoupangDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.url).toBe(
        'https://www.coupang.com/vp/products/7978016571?vendorItemId=94597320861',
      );
    });

    it('canonical 없으면 URL에서 productId+vendorItemId만 추출한다', () => {
      const docNoCanonical = makeDoc(
        '<h1 class="prod-buy-header__title">상품명</h1>' +
        '<div class="total-price"><strong>10,000</strong></div>',
      );
      const detector = createCoupangDetector(
        docNoCanonical,
        'https://www.coupang.com/vp/products/7978016571?vendorItemId=94597320861&sourceType=HOME_PERSONALIZED_ADS&clickEventId=abc',
      );
      const product = detector.extractProduct();
      expect(product?.url).toBe(
        'https://www.coupang.com/vp/products/7978016571?vendorItemId=94597320861',
      );
    });

    it('상품 페이지가 아니면 null을 반환한다', () => {
      const detector = createCoupangDetector(doc, 'https://www.coupang.com/np/search?q=이어폰');
      expect(detector.extractProduct()).toBeNull();
    });

    it('상품명이 없으면 null을 반환한다', () => {
      const d = makeDoc('<div class="total-price"><strong>29,900</strong></div>');
      const detector = createCoupangDetector(d, PRODUCT_URL);
      expect(detector.extractProduct()).toBeNull();
    });

    it('가격이 없으면 null을 반환한다', () => {
      const d = makeDoc('<h1 class="prod-buy-header__title">상품명</h1>');
      const detector = createCoupangDetector(d, PRODUCT_URL);
      expect(detector.extractProduct()).toBeNull();
    });
  });
});
