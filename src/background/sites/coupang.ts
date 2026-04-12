// 쿠팡 상품 페이지에서 현재 가격을 가져옵니다.
// Service Worker 환경이므로 DOM API 사용 불가 → 정규식으로 파싱

import { RateLimitError } from '../errors.js';

export async function fetchCoupangPrice(url: string): Promise<number | null> {
  // vendorItemId를 포함한 정규화된 URL로 요청
  const targetUrl = normalizeCoupangUrl(url);

  let html: string;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://www.coupang.com/',
      },
    });
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  return parsePriceFromHtml(html);
}

function normalizeCoupangUrl(url: string): string {
  const productMatch = /coupang\.com\/vp\/products\/(\d+)/.exec(url);
  const vendorMatch = /vendorItemId=(\d+)/.exec(url);
  if (!productMatch) return url;
  const base = `https://www.coupang.com/vp/products/${productMatch[1]}`;
  return vendorMatch ? `${base}?vendorItemId=${vendorMatch[1]}` : base;
}

// HTML에서 가격 추출 (JSON 데이터 && 텍스트 패턴 복수 시도)
function parsePriceFromHtml(html: string): number | null {
  // 1순위: JSON-LD 또는 인라인 JSON의 finalPrice / price 필드
  const patterns: RegExp[] = [
    /"finalPrice"\s*:\s*(\d+)/,
    /"salePrice"\s*:\s*(\d+)/,
    /"price"\s*:\s*(\d+)/,
    /class="total-price"[^>]*>[\s\S]*?<strong[^>]*>([\d,]+)<\/strong>/,
    /"discountPrice"\s*:\s*(\d+)/,
    /data-price="(\d+)"/,
  ];

  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      const num = Number(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}
