import { describe, it, expect } from 'vitest';
import { parsePriceFromHtml } from '../../../../src/background/sites/naver-smartstore.js';

describe('parsePriceFromHtml()', () => {
  it('salePrice 필드를 추출한다', () => {
    const html = `<script>{"salePrice": 39000, "productNo": 123}</script>`;
    expect(parsePriceFromHtml(html)).toBe(39000);
  });

  it('discountedSalePrice를 salePrice보다 우선하지 않는다 (정의 순서 우선)', () => {
    // patterns 배열에서 salePrice가 먼저이므로 salePrice가 반환됨
    const html = `{"salePrice":29900,"discountedSalePrice":24900}`;
    expect(parsePriceFromHtml(html)).toBe(29900);
  });

  it('salePrice 없을 때 discountedSalePrice를 추출한다', () => {
    const html = `{"discountedSalePrice":24900,"originalPrice":39000}`;
    expect(parsePriceFromHtml(html)).toBe(24900);
  });

  it('product:price:amount 메타태그에서 추출한다', () => {
    const html = `<meta property="product:price:amount" content="15000" />`;
    expect(parsePriceFromHtml(html)).toBe(15000);
  });

  it('content 속성이 앞에 오는 메타태그에서도 추출한다', () => {
    const html = `<meta content="18000" property="product:price:amount" />`;
    expect(parsePriceFromHtml(html)).toBe(18000);
  });

  it('JSON-LD Offer 타입의 price를 추출한다', () => {
    const html = `{"@type":"Offer","availability":"InStock","price":"55000","priceCurrency":"KRW"}`;
    expect(parsePriceFromHtml(html)).toBe(55000);
  });

  it('0원은 무효값으로 null을 반환한다', () => {
    const html = `{"salePrice": 0}`;
    expect(parsePriceFromHtml(html)).toBeNull();
  });

  it('가격 정보가 없으면 null을 반환한다', () => {
    const html = `<html><body><p>일반 텍스트</p></body></html>`;
    expect(parsePriceFromHtml(html)).toBeNull();
  });

  it('shippingPrice 등 다른 price 키에 오탐되지 않는다', () => {
    // salePrice/discountedSalePrice/originalPrice 없이 순수 "price" 키만 있을 때
    // Offer 타입 없이는 매칭되지 않아야 함
    const html = `{"shippingPrice": 3000, "basePrice": 5000}`;
    expect(parsePriceFromHtml(html)).toBeNull();
  });
});
