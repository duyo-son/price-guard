import type { SiteDetector, DetectedProduct } from '../detector.js';
import { parsePrice } from '../detector.js';

// 쿠팡 상품 페이지 URL 패턴: /vp/products/{productId}
const PRODUCT_URL_PATTERN = /coupang\.com\/vp\/products\/(\d+)/;

export function createCoupangDetector(doc: Document, url: string): SiteDetector {
  return {
    isProductPage(): boolean {
      return PRODUCT_URL_PATTERN.test(url);
    },

    extractProduct(): DetectedProduct | null {
      if (!this.isProductPage()) return null;

      const name = extractName(doc);
      const price = extractPrice(doc);
      const imageUrl = extractImage(doc);
      const canonicalUrl = extractCanonicalUrl(doc, url);

      if (!name || price === null) return null;

      return { name, price, imageUrl: imageUrl ?? '', url: canonicalUrl };
    },
  };
}

function extractName(doc: Document): string | null {
  const selectors = [
    '.prod-buy-header__title',
    'h1[class*="title"]',
    '.product-title',
    'h2.prod-buy-header__title',
    'h1',
  ];
  for (const sel of selectors) {
    const text = doc.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 0) return text;
  }
  return null;
}

function extractPrice(doc: Document): number | null {
  // 쿠팡 가격 셀렉터 (할인가 우선, 없으면 정가)
  const selectors = [
    '.total-price strong',      // 최종 결제가
    '.prod-price .total-price', // 총 가격 영역
    '[class*="sale-price"]',
    '[class*="discount-price"]',
    '.prod-sale-price',
    '.price-value',
    '[data-price]',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const raw =
      el.getAttribute('data-price') ??
      el.textContent;
    if (raw) {
      const parsed = parsePrice(raw);
      if (parsed !== null && parsed > 0) return parsed;
    }
  }
  return null;
}

function extractImage(doc: Document): string | null {
  // og:image 메타태그 우선 (고화질 원본)
  const og = doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
  if (og) return og;

  const selectors = [
    '.prod-image__detail',       // 상품 메인 이미지
    '.prod-image__item--active img',
    '.image-container img',
    'img[class*="prod-image"]',
    '.thumbnail-image',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const src =
      el instanceof HTMLImageElement
        ? (el.getAttribute('data-src') ?? el.src)
        : el.getAttribute('src');
    if (src && src.startsWith('http')) return src;
  }
  return null;
}

// 유니크 URL: vendor 파라미터 등 제거하고 productId + vendorItemId만 유지
function extractCanonicalUrl(doc: Document, fallbackUrl: string): string {
  // canonical 링크 태그 우선
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) return canonical;

  // URL에서 productId + vendorItemId만 추출
  const productMatch = PRODUCT_URL_PATTERN.exec(fallbackUrl);
  if (productMatch) {
    const productId = productMatch[1];
    const vendorItemMatch = /vendorItemId=(\d+)/.exec(fallbackUrl);
    const base = `https://www.coupang.com/vp/products/${productId}`;
    return vendorItemMatch ? `${base}?vendorItemId=${vendorItemMatch[1]}` : base;
  }

  return fallbackUrl;
}
