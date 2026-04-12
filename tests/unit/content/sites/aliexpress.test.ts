import { describe, it, expect, beforeEach } from 'vitest';
import { createAliExpressDetector } from '../../../../src/content/sites/aliexpress.js';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('AliExpressDetector', () => {
  const PRODUCT_URL = 'https://ja.aliexpress.com/item/1005007975582741.html';
  const PRODUCT_URL_COM = 'https://www.aliexpress.com/item/1005007975582741.html';
  let doc: Document;

  beforeEach(() => {
    doc = makeDoc(`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="canonical" href="https://www.aliexpress.com/item/1005007975582741.html" />
          <meta property="og:title" content="테스트 무선 이어폰 블루투스 5.3" />
          <meta property="og:image" content="https://ae01.alicdn.com/kf/test.jpg" />
          <meta property="og:price:amount" content="15.99" />
        </head>
        <body><h1>테스트 무선 이어폰 블루투스 5.3</h1></body>
      </html>
    `);
  });

  describe('isProductPage()', () => {
    it('ja.aliexpress.com 상품 URL에서 true를 반환한다', () => {
      expect(createAliExpressDetector(doc, PRODUCT_URL).isProductPage()).toBe(true);
    });

    it('www.aliexpress.com 상품 URL에서 true를 반환한다', () => {
      expect(createAliExpressDetector(doc, PRODUCT_URL_COM).isProductPage()).toBe(true);
    });

    it('리스트/카테고리 URL에서 false를 반환한다', () => {
      const listUrl = 'https://www.aliexpress.com/p/calp-plus/index.html';
      expect(createAliExpressDetector(doc, listUrl).isProductPage()).toBe(false);
    });

    it('타 도메인에서 false를 반환한다', () => {
      expect(createAliExpressDetector(doc, 'https://www.coupang.com/').isProductPage()).toBe(false);
    });
  });

  describe('extractProduct()', () => {
    it('og:title에서 상품명을 추출한다', () => {
      const product = createAliExpressDetector(doc, PRODUCT_URL).extractProduct();
      expect(product?.name).toBe('테스트 무선 이어폰 블루투스 5.3');
    });

    it('pdp_npi URL 파라미터에서 할인가를 추출한다', () => {
      const urlWithNpi =
        'https://ja.aliexpress.com/item/1005007975582741.html' +
        '?pdp_npi=6%40dis%21JPY%21660%21223%21%21';
      const d = makeDoc('<meta property="og:title" content="상품명" />');
      const product = createAliExpressDetector(d, urlWithNpi).extractProduct();
      expect(product?.price).toBe(223);
    });

    it('pdp_npi에 할인가 없으면 원가를 추출한다', () => {
      const urlWithNpi =
        'https://ja.aliexpress.com/item/1005007975582741.html' +
        '?pdp_npi=6%40dis%21JPY%21660%21%21%21';
      const d = makeDoc('<meta property="og:title" content="상품명" />');
      const product = createAliExpressDetector(d, urlWithNpi).extractProduct();
      expect(product?.price).toBe(660);
    });

    it('og:price:amount에서 가격을 추출한다', () => {
      const product = createAliExpressDetector(doc, PRODUCT_URL).extractProduct();
      expect(product?.price).toBe(15.99);
    });

    it('og:image URL을 이미지로 추출한다', () => {
      const product = createAliExpressDetector(doc, PRODUCT_URL).extractProduct();
      expect(product?.imageUrl).toBe('https://ae01.alicdn.com/kf/test.jpg');
    });

    it('canonical URL을 상품 URL로 사용한다', () => {
      const product = createAliExpressDetector(doc, PRODUCT_URL).extractProduct();
      expect(product?.url).toBe('https://www.aliexpress.com/item/1005007975582741.html');
    });

    it('canonical 없으면 URL에서 파라미터를 제거한다', () => {
      const dirtyUrl =
        'https://ja.aliexpress.com/item/1005007975582741.html?pvid=xxx&spm=yyy';
      const d = makeDoc(
        '<meta property="og:title" content="상품명" />' +
        '<meta property="og:price:amount" content="9.99" />',
      );
      const product = createAliExpressDetector(d, dirtyUrl).extractProduct();
      expect(product?.url).toBe('https://www.aliexpress.com/item/1005007975582741.html');
    });

    it('인라인 스크립트 minActivityAmount에서 가격을 추출한다', () => {
      const d = makeDoc(`
        <head><meta property="og:title" content="상품명" /></head>
        <body>
          <script>
            window.runParams = {"data":{"priceModule":{"minActivityAmount":{"value":"223","currency":"JPY"}}}};
          </script>
        </body>
      `);
      const product = createAliExpressDetector(d, PRODUCT_URL).extractProduct();
      expect(product?.price).toBe(223);
    });

    it('og:title에서 "- AliExpress NNNNN" suffix를 제거한다', () => {
      const d = makeDoc(
        '<meta property="og:title" content="スタイリッシュなメンズ PU レザーベルト - AliExpress 200000297" />' +
        '<meta property="og:price:amount" content="9.99" />',
      );
      const product = createAliExpressDetector(d, PRODUCT_URL).extractProduct();
      expect(product?.name).toBe('スタイリッシュなメンズ PU レザーベルト');
    });

    it('data-pl=product-title DOM 요소에서 상품명을 추출한다', () => {
      const d = makeDoc(
        '<div data-pl="product-title">React 렌더 상품명</div>' +
        '<meta property="og:price:amount" content="9.99" />',
      );
      const product = createAliExpressDetector(d, PRODUCT_URL).extractProduct();
      expect(product?.name).toBe('React 렌더 상품명');
    });

    it('data-pl=product-price DOM 요소에서 가격을 추출한다 (CSR 렌더)', () => {
      const d = makeDoc(
        '<div data-pl="product-title">상품명</div>' +
        '<div data-pl="product-price">¥ 938</div>',
      );
      const product = createAliExpressDetector(d, PRODUCT_URL).extractProduct();
      expect(product?.price).toBe(938);
    });

    it('class*="price--current" DOM 요소에서 가격을 추출한다', () => {
      const d = makeDoc(
        '<div data-pl="product-title">상품명</div>' +
        '<span class="price--currentPriceText--V8e6ykG">$ 6.72</span>',
      );
      const product = createAliExpressDetector(d, PRODUCT_URL).extractProduct();
      expect(product?.price).toBe(6.72);
    });

    it('상품명이 없으면 null을 반환한다', () => {
      const d = makeDoc('<meta property="og:price:amount" content="9.99" />');
      expect(createAliExpressDetector(d, PRODUCT_URL).extractProduct()).toBeNull();
    });

    it('가격이 없으면 null을 반환한다', () => {
      const d = makeDoc('<meta property="og:title" content="상품명" />');
      expect(createAliExpressDetector(d, PRODUCT_URL).extractProduct()).toBeNull();
    });

    it('상품 페이지가 아니면 null을 반환한다', () => {
      const listUrl = 'https://www.aliexpress.com/p/calp-plus/index.html';
      expect(createAliExpressDetector(doc, listUrl).extractProduct()).toBeNull();
    });
  });
});
