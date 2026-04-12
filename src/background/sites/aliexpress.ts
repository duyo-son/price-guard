// 알리익스프레스 상품 페이지에서 현재 가격을 가져옵니다.
// Service Worker 환경이므로 DOM API 사용 불가 → 정규식으로 파싱

import { RateLimitError } from '../errors.js';

const ITEM_URL_PATTERN = /aliexpress\.[a-z.]+\/item\/(\d+)\.html/;

export async function fetchAliExpressPrice(url: string): Promise<number | null> {
  const targetUrl = normalizeAliExpressUrl(url);

  let html: string;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://www.aliexpress.com/',
      },
    });
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) return null;
    html = await res.text();
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    return null;
  }

  return parsePriceFromHtml(html);
}

function normalizeAliExpressUrl(url: string): string {
  const m = ITEM_URL_PATTERN.exec(url);
  if (!m) return url;
  return `https://www.aliexpress.com/item/${m[1]}.html`;
}

export function parsePriceFromHtml(html: string): number | null {
  // 1. og:price:amount 메타태그
  const ogMeta = /property="og:price:amount"\s+content="([\d.]+)"/.exec(html)
    ?? /content="([\d.]+)"\s+property="og:price:amount"/.exec(html);
  if (ogMeta?.[1]) {
    const val = parseFloat(ogMeta[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. window.runParams 내 minActivityAmount/minAmount
  const amountRe =
    /"(?:minActivityAmount|minAmount|salePrice|currentPrice)"\s*:\s*\{[^}]*"value"\s*:\s*"?([\d.]+)"?/;
  const m2 = amountRe.exec(html);
  if (m2?.[1]) {
    const val = parseFloat(m2[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. JSON-LD Offer price
  const jsonLdRe = /"@type"\s*:\s*"Offer"[\s\S]{0,300}?"price"\s*:\s*"?([\d.]+)"?/;
  const m3 = jsonLdRe.exec(html);
  if (m3?.[1]) {
    const val = parseFloat(m3[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}
