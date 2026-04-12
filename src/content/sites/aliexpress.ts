import type { SiteDetector, DetectedProduct } from '../detector.js';
import { parsePrice } from '../detector.js';

// 알리익스프레스 상품 페이지 URL 패턴: /item/{itemId}.html
// 지원 도메인: aliexpress.com, ja.aliexpress.com 등 서브도메인/지역 도메인 포함
const PRODUCT_URL_PATTERN = /aliexpress\.[a-z.]+\/item\/(\d+)\.html/;

export function createAliExpressDetector(doc: Document, url: string): SiteDetector {
  return {
    isProductPage(): boolean {
      return PRODUCT_URL_PATTERN.test(url);
    },

    extractProduct(): DetectedProduct | null {
      if (!this.isProductPage()) return null;

      const name = extractName(doc);
      // URL 파라미터(pdp_npi)에서 가장 먼저 시도 — React 렌더 대기 불필요
      const price = extractPriceFromUrlParam(url) ?? extractPrice(doc);
      const imageUrl = extractImage(doc);
      const canonicalUrl = extractCanonicalUrl(doc, url);

      console.log('[PriceGuard] AliExpress 추출 진단:', { name, price, canonicalUrl });

      if (!name || price === null) return null;

      return { name, price, imageUrl: imageUrl ?? '', url: canonicalUrl };
    },
  };
}

function extractName(doc: Document): string | null {
  // 1. React 렌더 후 data-pl 속성 (pdp-pc 신 아키텍처)
  const dataPlTitle = doc.querySelector('[data-pl="product-title"]')?.textContent?.trim();
  if (dataPlTitle && dataPlTitle.length > 0) return dataPlTitle;

  // 2. og:title — "AliExpress NNNNNN" 또는 "- aliexpress" suffix 제거
  const ogTitle = doc
    .querySelector<HTMLMetaElement>('meta[property="og:title"]')
    ?.content?.trim();
  if (ogTitle && ogTitle.length > 0) {
    const cleaned = ogTitle
      .replace(/\s*[-–]\s*AliExpress\s*\d*\s*$/i, '')
      .replace(/\s*[-–]\s*aliexpress\.?\s*$/i, '')
      .trim();
    return cleaned.length > 0 ? cleaned : ogTitle;
  }

  // 3. h1 폴백
  const h1 = doc.querySelector('h1')?.textContent?.trim();
  if (h1 && h1.length > 0) return h1;

  return null;
}

function extractPriceFromUrlParam(url: string): number | null {
  // pdp_npi 파라미터 형식: "6@dis!{currency}!{originalPrice}!{discountedPrice}!!"
  // 예: pdp_npi=6%40dis%21JPY%21660%21223%21%21 → 할인가 223, 원가 660
  try {
    const u = new URL(url);
    const npi = u.searchParams.get('pdp_npi');
    if (!npi) return null;
    const parts = npi.split('!');
    // parts[3]: 할인가, parts[2]: 원가
    const discounted = parts[3] !== undefined ? parseFloat(parts[3]) : NaN;
    if (!isNaN(discounted) && discounted > 0) return discounted;
    const original = parts[2] !== undefined ? parseFloat(parts[2]) : NaN;
    if (!isNaN(original) && original > 0) return original;
  } catch {
    // URL 파싱 실패 무시
  }
  return null;
}

function extractPrice(doc: Document): number | null {
  // 1. og:price:amount 메타태그
  const ogPrice = doc
    .querySelector<HTMLMetaElement>('meta[property="og:price:amount"]')
    ?.content;
  if (ogPrice) {
    const parsed = parsePrice(ogPrice);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 2. product:price:amount 메타태그
  const productPrice = doc
    .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
    ?.content;
  if (productPrice) {
    const parsed = parsePrice(productPrice);
    if (parsed !== null && parsed > 0) return parsed;
  }

  // 3. JSON-LD structured data (Offer.price)
  const jsonLdPrice = extractPriceFromJsonLd(doc);
  if (jsonLdPrice !== null) return jsonLdPrice;

  // 4. 인라인 스크립트 (window.runParams 내 skuModule / priceModule)
  const scriptPrice = extractPriceFromScripts(doc);
  if (scriptPrice !== null) return scriptPrice;

  // 5. React 렌더 후 DOM 셀렉터 (pdp-pc 신 아키텍처)
  const domPrice = extractPriceFromDom(doc);
  if (domPrice !== null) return domPrice;

  return null;
}

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
          const priceStr =
            typeof priceRaw === 'string' || typeof priceRaw === 'number'
              ? String(priceRaw)
              : '';
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
 * 알리익스프레스 인라인 스크립트에서 가격 추출.
 * window.runParams.data.skuModule 또는 priceModule에
 * minActivityAmount.value / minAmount.value 형태로 포함.
 */
function extractPriceFromScripts(doc: Document): number | null {
  // {"minActivityAmount":{"value":"223"}} 또는 {"minAmount":{"value":"660"}}
  const AMOUNT_RE =
    /"(?:minActivityAmount|minAmount|salePrice|currentPrice)"\s*:\s*\{[^}]*"value"\s*:\s*"?([\d.]+)"?/;
  // "formatedActivityPrice":"¥223" 등 포맷된 가격 문자열
  const FORMATTED_RE =
    /"(?:formatedActivityPrice|formatedPrice|discountedPrice)"\s*:\s*"([^"]+)"/;

  const scripts = doc.querySelectorAll<HTMLScriptElement>(
    'script:not([src]):not([type="application/ld+json"])',
  );
  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (!text.includes('Price') && !text.includes('price') && !text.includes('Amount')) continue;

    const m1 = AMOUNT_RE.exec(text);
    if (m1?.[1]) {
      const val = parseFloat(m1[1]);
      if (!isNaN(val) && val > 0) return val;
    }

    const m2 = FORMATTED_RE.exec(text);
    if (m2?.[1]) {
      const parsed = parsePrice(m2[1]);
      if (parsed !== null && parsed > 0) return parsed;
    }
  }
  return null;
}

function extractImage(doc: Document): string | null {
  return (
    doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? null
  );
}

/**
 * React 렌더 후 DOM에서 가격 추출 (pdp-pc 신 아키텍처).
 * AliExpress는 CSR이므로 content script의 재시도 로직이 DOM 완성 후 호출될 때 이 함수로 추출.
 */
function extractPriceFromDom(doc: Document): number | null {
  // data-pl 속성 기반 (신 pdp-pc)
  const dataPlEl = doc.querySelector('[data-pl="product-price"]');
  if (dataPlEl) {
    const raw = dataPlEl.textContent?.trim();
    if (raw) {
      const parsed = parsePrice(raw);
      if (parsed !== null && parsed > 0) return parsed;
    }
  }

  // CSS module 클래스 패턴 (해시 포함 대응)
  const selectors = [
    '[class*="price--current"]',
    '[class*="currentPrice"]',
    '[class*="trade--price"]',
    '[class*="price-sale"]',
    '[class*="uniform-banner-box-price"]',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (!el) continue;
    const raw = el.textContent?.trim();
    if (!raw) continue;
    const parsed = parsePrice(raw);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

function extractCanonicalUrl(doc: Document, fallbackUrl: string): string {
  const canonical = doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) return canonical;

  const m = PRODUCT_URL_PATTERN.exec(fallbackUrl);
  if (m) {
    return `https://www.aliexpress.com/item/${m[1]}.html`;
  }
  return fallbackUrl;
}
