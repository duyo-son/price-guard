// 네이버 스마트스토어 상품 페이지에서 현재 가격을 가져옵니다.
// Service Worker 환경이므로 DOM API 사용 불가 → 정규식으로 파싱

const PRODUCT_URL_PATTERN = /smartstore\.naver\.com\/([^/]+)\/products\/(\d+)/;

export async function fetchNaverSmartStorePrice(url: string): Promise<number | null> {
  const targetUrl = normalizeSmartstoreUrl(url);

  let html: string;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Referer: 'https://smartstore.naver.com/',
      },
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  return parsePriceFromHtml(html);
}

function normalizeSmartstoreUrl(url: string): string {
  const m = PRODUCT_URL_PATTERN.exec(url);
  if (!m) return url;
  return `https://smartstore.naver.com/${m[1]}/products/${m[2]}`;
}

// 네이버 스마트스토어 HTML에 포함된 JSON 데이터에서 가격 추출
export function parsePriceFromHtml(html: string): number | null {
  // 1순위: 네이버 스마트스토어 인라인 JSON 필드 (salePrice, discountedSalePrice)
  const patterns: RegExp[] = [
    /"salePrice"\s*:\s*(\d+)/,
    /"discountedSalePrice"\s*:\s*(\d+)/,
    /"originalPrice"\s*:\s*(\d+)/,
    // og:price meta 태그 HTML 파싱
    /property="product:price:amount"\s+content="([\d.]+)"/,
    /content="([\d.]+)"\s+property="product:price:amount"/,
    // JSON-LD Offer개 한정한 price 필드 (배송비 등 다른 price 키 오탐 방지)
    /"@type"\s*:\s*"Offer"[\s\S]{0,200}?"price"\s*:\s*"?(\d+)"?/,
  ];

  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) {
      const num = Math.round(Number(m[1].replace(/,/g, '')));
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}
