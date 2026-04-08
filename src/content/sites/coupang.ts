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

      console.log('[PriceGuard] Coupang 추출 진단:', {
        name,
        price,
        hasOgTitle: !!doc.querySelector('meta[property="og:title"]'),
        ogTitleContent: doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content,
        hasTotalPrice: !!doc.querySelector('.total-price strong'),
        h1Text: doc.querySelector('h1')?.textContent?.trim().slice(0, 60),
        prodBuyHeaderTitle: doc.querySelector('.prod-buy-header__title')?.textContent?.trim().slice(0, 60),
      });

      if (!name || price === null) return null;

      return { name, price, imageUrl: imageUrl ?? '', url: canonicalUrl };
    },
  };
}

function extractName(doc: Document): string | null {
  // 1. CSS 셀렉터
  const selectors = [
    '.prod-buy-header__title',
    'h1[class*="title"]',
    '.product-title',
    'h2.prod-buy-header__title',
  ];
  for (const sel of selectors) {
    const text = doc.querySelector(sel)?.textContent?.trim();
    if (text && text.length > 0) return text;
  }

  // 2. og:title 메타태그 (쿠팡은 SSR로 제공하는 경우 多)
  const ogTitle = doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content?.trim();
  if (ogTitle && ogTitle.length > 0) return ogTitle;

  // 3. h1 폴백
  const h1 = doc.querySelector('h1')?.textContent?.trim();
  if (h1 && h1.length > 0) return h1;

  return null;
}

function extractPrice(doc: Document): number | null {
  // 1. 쿠팡 가격 셀렉터 (할인가 우선, 없으면 정가)
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

  // 2. JSON-LD structured data (Offer.price)
  const jsonLdPrice = extractPriceFromJsonLd(doc);
  if (jsonLdPrice !== null) return jsonLdPrice;

  // 3. 인라인 script JSON에서 가격 키 추출
  const scriptPrice = extractPriceFromScripts(doc);
  if (scriptPrice !== null) return scriptPrice;

  return null;
}

/** JSON-LD <script type="application/ld+json"> Offer.price 추출 */
function extractPriceFromJsonLd(doc: Document): number | null {
  const scripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      const nodes: unknown[] = Array.isArray((json as { '@graph'?: unknown[] })['@graph'])
        ? (json as { '@graph': unknown[] })['@graph']
        : [json];
      for (const node of nodes) {
        const item = node as Record<string, unknown>;
        const offersRaw = item['offers'];
        if (!offersRaw) continue;
        const offers = Array.isArray(offersRaw) ? offersRaw : [offersRaw];
        for (const offer of offers) {
          const priceRaw = (offer as Record<string, unknown>)['price'];
          const priceStr = typeof priceRaw === 'string' || typeof priceRaw === 'number' ? String(priceRaw) : '';
          const val = parseFloat(priceStr);
          if (!isNaN(val) && val > 0) return val;
        }
      }
    } catch {
      // 파싱 불가 무시
    }
  }
  return null;
}

/**
 * 인라인 <script> 텍스트에서 가격 키 추출.
 * 쿠팡은 SSR 데이터에 "salePrice", "originalPrice" 등을 주입.
 */
function extractPriceFromScripts(doc: Document): number | null {
  const PRICE_RE = /"(?:salePrice|discountPrice|finalPrice|originalPrice|basePrice)"\s*:\s*(\d+)/;

  const scripts = doc.querySelectorAll<HTMLScriptElement>('script:not([src]):not([type="application/ld+json"])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (!text.includes('Price') && !text.includes('price')) continue;
    const m = PRICE_RE.exec(text);
    if (m?.[1]) {
      const val = parseInt(m[1], 10);
      if (val > 0) return val;
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
