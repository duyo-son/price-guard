import type { SiteDetector, DetectedProduct } from '../detector.js';
import { parsePrice } from '../detector.js';

// 네이버 스마트스토어 / 브랜드스토어 상품 URL: /products/{productNo}
// 지원 도메인: smartstore.naver.com, brand.naver.com
// group1 = store, group2 = productNo
const PRODUCT_URL_PATTERN = /(?:smartstore|brand)\.naver\.com\/([^/]+)\/products\/(\d+)/;

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

      console.log('[PriceGuard] Naver 추출 진단:', {
        name,
        price,
        hasOgTitle: !!doc.querySelector('meta[property="og:title"]'),
        ogTitleContent: doc.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content,
        hasMetaPrice: !!doc.querySelector('meta[property="product:price:amount"]'),
        metaPriceContent: doc.querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')?.content,
        h1Text: doc.querySelector('h1')?.textContent?.trim().slice(0, 50),
        canonicalUrl,
      });

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
  // 1. meta 태그 (스마트스토어가 지원하는 경우)
  const metaPrice = doc
    .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
    ?.content;
  if (metaPrice) {
    const parsed = parsePrice(metaPrice);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 2. JSON-LD structured data (Offer @type)
  const jsonLdPrice = extractPriceFromJsonLd(doc);
  if (jsonLdPrice !== null) return jsonLdPrice;

  // 3. 인라인 script JSON에서 salePrice / discountedSalePrice 추출
  const scriptPrice = extractPriceFromScripts(doc);
  if (scriptPrice !== null) return scriptPrice;

  // 4. DOM 셀렉터 (CSS modules 해시값은 못 잡지만 일반 사이트 폴백)
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
      // 파싱 불가 스크립트 무시
    }
  }
  return null;
}

/**
 * 인라인 <script> 텍스트에서 salePrice / discountedSalePrice 추출.
 * Naver SmartStore는 SSR 데이터를 window.__NUXT__ 또는 script 태그에 JSON으로 주입.
 * shippingPrice 등 오탐 방지를 위해 키 이름을 엄격하게 매칭.
 */
function extractPriceFromScripts(doc: Document): number | null {
  // discountedSalePrice 또는 salePrice 키 (객체 프로퍼티 형식: "key":숫자)
  const PRICE_RE = /"(?:discountedSalePrice|salePrice|finalSalePrice)"\s*:\s*(\d+)/;

  const scripts = doc.querySelectorAll<HTMLScriptElement>('script:not([src]):not([type="application/ld+json"])');
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (!text.includes('Price')) continue; // 빠른 스킵
    const m = PRICE_RE.exec(text);
    if (m?.[1]) {
      const val = parseInt(m[1], 10);
      if (val > 0) return val;
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
    // brand.naver.com URL은 그대로 유지, smartstore는 정규화
    const domain = /brand\.naver\.com/.test(fallbackUrl) ? 'brand.naver.com' : 'smartstore.naver.com';
    return `https://${domain}/${m[1]}/products/${m[2]}`;
  }
  return fallbackUrl;
}
