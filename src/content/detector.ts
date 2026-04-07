// 상품 페이지 감지 및 상품 정보 추출 모듈
// 각 쇼핑몰은 SiteDetector 인터페이스를 구현하여 src/content/sites/ 에 추가

export interface DetectedProduct {
  name: string;
  price: number;
  imageUrl: string;
  url: string;
}

export interface SiteDetector {
  isProductPage(): boolean;
  extractProduct(): DetectedProduct | null;
}

// URL과 Document를 받아 Generic 감지기 생성 (Schema.org / 공통 CSS 기반)
export function createGenericDetector(doc: Document, url: string): SiteDetector {
  return {
    isProductPage(): boolean {
      return hasProductSchema(doc) || hasPriceElement(doc);
    },

    extractProduct(): DetectedProduct | null {
      if (!this.isProductPage()) return null;

      const name = extractProductName(doc);
      const price = extractProductPrice(doc);
      const imageUrl = extractProductImage(doc) ?? '';

      if (!name || price === null) return null;

      return { name, price, imageUrl, url };
    },
  };
}

function hasProductSchema(doc: Document): boolean {
  return doc.querySelectorAll('[itemtype*="schema.org/Product"]').length > 0;
}

function hasPriceElement(doc: Document): boolean {
  const selectors = ['[itemprop="price"]', '.price', '#price', '[class*="price"]'];
  return selectors.some((sel) => doc.querySelector(sel) !== null);
}

function extractProductName(doc: Document): string | null {
  const selectors = [
    '[itemprop="name"]',
    'h1[class*="product"]',
    'h1[class*="title"]',
    'h1[class*="name"]',
    'h1',
  ];
  for (const sel of selectors) {
    const text = doc.querySelector(sel)?.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function extractProductPrice(doc: Document): number | null {
  const selectors = [
    '[itemprop="price"]',
    'meta[property="product:price:amount"]',
    '[class*="sale-price"]',
    '[class*="selling-price"]',
    '[class*="final-price"]',
    '[class*="price"]',
    '#price',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const raw =
      el.getAttribute('content') ??
      el.getAttribute('data-price') ??
      el.textContent;
    if (raw) {
      const parsed = parsePrice(raw);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function extractProductImage(doc: Document): string | null {
  const selectors = [
    'meta[property="og:image"]',
    '[itemprop="image"]',
    '.product-image img',
    'img[class*="product"]',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const src =
      el.getAttribute('content') ??
      el.getAttribute('src') ??
      (el instanceof HTMLImageElement ? el.src : null);
    if (src) return src;
  }
  return null;
}

// 한국 원화 표기 포함 가격 파싱 ("50,000원" → 50000)
export function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || cleaned === '' ? null : num;
}
