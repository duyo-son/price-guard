import type { SiteDetector, DetectedProduct } from '../detector.js';
import { parsePrice } from '../detector.js';

// 네이버 스마트스토어 상품 URL: /products/{productNo}
// group1 = store, group2 = productNo
const PRODUCT_URL_PATTERN = /smartstore\.naver\.com\/([^/]+)\/products\/(\d+)/;

export function createNaverSmartStoreDetector(doc: Document, url: string): SiteDetector {
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
  // og:title (스마트스토어는 "상품명 : 스토어명" 형식일 수 있어 콜론 이전만 사용)
  const ogTitle = doc
    .querySelector<HTMLMetaElement>('meta[property="og:title"]')
    ?.content?.trim();
  if (ogTitle) {
    // " : 스토어명" 또는 " | 스토어명" 패턴 제거
    const cleaned = ogTitle.replace(/\s*[:|]\s*[^:|]+$/, '').trim();
    if (cleaned.length > 0) return cleaned;
    return ogTitle;
  }

  // 폴백: 네이버 스마트스토어 공통 셀렉터
  const selectors = [
    '._3oDjSvLwq8',        // 상품명 클래스 (빈번히 변경되므로 폴백)
    '[class*="product_title"]',
    '[class*="productTitle"]',
    'h3[class*="title"]',
    'h2[class*="title"]',
    'h1',
  ];
  for (const sel of selectors) {
    const text = doc.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 0) return text;
  }
  return null;
}

function extractPrice(doc: Document): number | null {
  // og:price는 스마트스토어가 잘 지원함
  const metaPrice = doc
    .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
    ?.content;
  if (metaPrice) {
    const parsed = parsePrice(metaPrice);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 폴백: 할인가 우선
  const selectors = [
    '[class*="sale_price"]',
    '[class*="salePrice"]',
    '[class*="discount_price"]',
    '[class*="final_price"]',
    '[class*="price"] strong',
    '[class*="price"] em',
    '[class*="price"]',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const raw = el.getAttribute('data-price') ?? el.textContent;
    if (raw) {
      const parsed = parsePrice(raw);
      if (parsed !== null && parsed > 0) return parsed;
    }
  }
  return null;
}

function extractImage(doc: Document): string | null {
  // og:image가 가장 신뢰도 높음
  const og = doc
    .querySelector<HTMLMetaElement>('meta[property="og:image"]')
    ?.content;
  if (og) return og;

  const selectors = [
    '[class*="product_image"] img',
    '[class*="productImage"] img',
    '[class*="thumb"] img',
    '.main_image img',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!(el instanceof HTMLImageElement)) continue;
    const src = el.getAttribute('data-src') ?? el.src;
    if (src && src.startsWith('http')) return src;
  }
  return null;
}

// 유니크 URL: 추적/광고 파라미터 제거, productNo만 유지
function extractCanonicalUrl(doc: Document, fallbackUrl: string): string {
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) return canonical;

  const m = PRODUCT_URL_PATTERN.exec(fallbackUrl);
  if (m) {
    // group1 = store, group2 = productNo
    return `https://smartstore.naver.com/${m[1]}/products/${m[2]}`;
  }
  return fallbackUrl;
}
