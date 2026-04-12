import { describe, it, expect, beforeEach } from 'vitest';
import { createNaverSmartStoreDetector } from '../../../../src/content/sites/naver-smartstore.js';

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('NaverSmartStoreDetector', () => {
  const PRODUCT_URL =
    'https://smartstore.naver.com/thebale/products/3894760006';
  let doc: Document;

  beforeEach(() => {
    doc = makeDoc(`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="canonical" href="https://smartstore.naver.com/thebale/products/3894760006" />
          <meta property="og:title" content="테스트 고양이 숨숨집 : 더베일" />
          <meta property="og:image" content="https://shop-phinf.pstatic.net/test/product.jpg" />
          <meta property="product:price:amount" content="39000" />
          <meta property="product:price:currency" content="KRW" />
        </head>
        <body>
          <h3 class="product_title">테스트 고양이 숨숨집</h3>
        </body>
      </html>
    `);
  });

  describe('isProductPage()', () => {
    it('스마트스토어 상품 URL에서 true를 반환한다', () => {
      const detector = createNaverSmartStoreDetector(doc, PRODUCT_URL);
      expect(detector.isProductPage()).toBe(true);
    });

    it('스마트스토어 메인 URL에서 false를 반환한다', () => {
      const detector = createNaverSmartStoreDetector(
        doc,
        'https://smartstore.naver.com/thebale',
      );
      expect(detector.isProductPage()).toBe(false);
    });

    it('타 도메인에서 false를 반환한다', () => {
      const detector = createNaverSmartStoreDetector(doc, 'https://www.coupang.com/');
      expect(detector.isProductPage()).toBe(false);
    });

    it('brand.naver.com 상품 URL에서 true를 반환한다', () => {
      const detector = createNaverSmartStoreDetector(
        doc,
        'https://brand.naver.com/oralbkr/products/5949880606',
      );
      expect(detector.isProductPage()).toBe(true);
    });

    it('search.shopping.naver.com에서 false를 반환한다', () => {
      const detector = createNaverSmartStoreDetector(
        doc,
        'https://search.shopping.naver.com/ns/search?query=oralb',
      );
      expect(detector.isProductPage()).toBe(false);
    });
  });

  describe('extractProduct()', () => {
    it('og:title에서 스토어명을 제거하고 상품명을 추출한다', () => {
      const detector = createNaverSmartStoreDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.name).toBe('테스트 고양이 숨숨집');
    });

    it('product:price:amount 메타태그에서 가격을 추출한다', () => {
      const detector = createNaverSmartStoreDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.price).toBe(39000);
    });

    it('og:image URL을 메인 이미지로 추출한다', () => {
      const detector = createNaverSmartStoreDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.imageUrl).toBe(
        'https://shop-phinf.pstatic.net/test/product.jpg',
      );
    });

    it('canonical URL을 상품 URL로 사용한다', () => {
      const detector = createNaverSmartStoreDetector(doc, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product?.url).toBe(
        'https://smartstore.naver.com/thebale/products/3894760006',
      );
    });

    it('canonical 없어도 name/price가 있으면 정상 추출한다', () => {
      const dirtyUrl =
        'https://smartstore.naver.com/thebale/products/3894760006' +
        '?NaPm=ct%3Dmnp6hpdd%7Cci%3Dshopn&site_preference=device';
      const d = makeDoc(
        '<meta property="og:title" content="상품명" />' +
        '<meta property="product:price:amount" content="10000" />',
      );
      const detector = createNaverSmartStoreDetector(d, dirtyUrl);
      // canonical 없어도 name/price가 있으면 추출 가능
      const product = detector.extractProduct();
      expect(product).not.toBeNull();
      expect(product?.price).toBe(10000);
    });

    it('brand.naver.com URL은 도메인을 유지하고 파라미터를 제거한다', () => {
      const brandUrl =
        'https://brand.naver.com/oralbkr/products/5949880606' +
        '?NaPm=ct%3Dmnv3gt6q%7Cci%3DER3c533aac&nacn=ZYK4B8Qqv56K';
      const d = makeDoc(
        '<link rel="canonical" href="https://brand.naver.com/oralbkr/products/5949880606" />' +
        '<meta property="og:title" content="오랄비 전동칫솔" />' +
        '<meta property="product:price:amount" content="55000" />',
      );
      const detector = createNaverSmartStoreDetector(d, brandUrl);
      const product = detector.extractProduct();
      expect(product?.url).toBe(
        'https://brand.naver.com/oralbkr/products/5949880606',
      );
    });

    it('상품 페이지가 아니면 null을 반환한다', () => {
      const detector = createNaverSmartStoreDetector(
        doc,
        'https://smartstore.naver.com/thebale',
      );
      expect(detector.extractProduct()).toBeNull();
    });

    it('상품명이 없으면 null을 반환한다', () => {
      const d = makeDoc('<meta property="product:price:amount" content="39000" />');
      const detector = createNaverSmartStoreDetector(d, PRODUCT_URL);
      expect(detector.extractProduct()).toBeNull();
    });

    it('가격이 없으면 null을 반환한다', () => {
      // canonical을 포함해 DOM 준비됨을 나타내되, price:amount는 없음
      const d = makeDoc(
        '<link rel="canonical" href="https://smartstore.naver.com/thebale/products/3894760006" />' +
        '<meta property="og:title" content="상품명" />',
      );
      const detector = createNaverSmartStoreDetector(d, PRODUCT_URL);
      expect(detector.extractProduct()).toBeNull();
    });

    it('SPA 전환 직후 canonical이 리스트 URL이면 null을 반환한다 (재시도 대기)', () => {
      // URL은 이미 상품 페이지이지만 DOM canonical은 아직 리스트 페이지
      const d = makeDoc(`
        <head>
          <link rel="canonical" href="https://smartstore.naver.com/thebale" />
          <meta property="og:title" content="리스트 페이지 타이틀" />
          <script>{"salePrice":99000}</script>
        </head>
      `);
      const detector = createNaverSmartStoreDetector(d, PRODUCT_URL);
      expect(detector.extractProduct()).toBeNull();
    });


    it('og:url의 productNo가 일치하면 정상 추출한다', () => {
      const d = makeDoc(`
        <head>
          <meta property="og:url" content="https://smartstore.naver.com/thebale/products/3894760006" />
          <meta property="og:title" content="og url 테스트 상품" />
          <meta property="product:price:amount" content="25000" />
        </head>
      `);
      const detector = createNaverSmartStoreDetector(d, PRODUCT_URL);
      const product = detector.extractProduct();
      expect(product).not.toBeNull();
      expect(product?.price).toBe(25000);
    });
  });
});
