import type { TrackedProduct, Message, MessageResponse, PriceRecord } from '../shared/types.js';

async function sendMsg<T>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage<Message, MessageResponse<T>>(message);
}

// ── 스토리지 직접 진단 ──────────────────────────────────────────────────────
async function diagStorage(): Promise<void> {
  const raw = await chrome.storage.local.get(null);
  console.log('[PriceGuard] 스토리지 전체 덤프:', raw);
  const products = (raw['price_guard_products'] as TrackedProduct[] | undefined) ?? [];
  console.log(`[PriceGuard] 등록 상품 수: ${products.length}`, products);
}
// ──────────────────────────────────────────────────────────────────────────────

function setLoading(on: boolean): void {
  const container = document.getElementById('product-list');
  if (!container) return;
  if (on) {
    container.innerHTML = '<div class="empty-state"><p>불러오는 중...</p></div>';
  }
}

async function loadProducts(): Promise<void> {
  setLoading(true);
  // MV3 Service Worker 콜드 스타트 시 1회 실패가 흔함 → 1초 간격으로 재시도
  const MAX = 3;
  for (let attempt = 0; attempt < MAX; attempt++) {
    console.log(`[PriceGuard] PRODUCTS_GET 시도 ${attempt + 1}/${MAX}`);
    try {
      const res = await sendMsg<TrackedProduct[]>({ type: 'PRODUCTS_GET' });
      console.log('[PriceGuard] 응답:', res);
      // success: false 또는 응답 자체가 없는 경우도 재시도
      if (res?.success === true) {
        renderProducts(res.data ?? []);
        return;
      }
      console.warn('[PriceGuard] success !== true, 재시도:', res);
    } catch (err) {
      console.warn('[PriceGuard] 연결 실패 (SW 비활성?), 재시도:', err);
    }
    if (attempt < MAX - 1) {
      await new Promise<void>(r => setTimeout(r, 1000));
    }
  }
  console.error('[PriceGuard] PRODUCTS_GET 최종 실패');
  const container = document.getElementById('product-list');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <p>불러오기 실패</p>
        <p style="font-size:12px;margin-top:6px">팝업을 다시 열어주세요.</p>
      </div>`;
  }
}

function renderProducts(products: TrackedProduct[]): void {
  const container = document.getElementById('product-list')!;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>추적 중인 상품이 없습니다.</p>
        <p style="font-size:12px;margin-top:6px">쇼핑몰 상품 페이지에서 추적을 시작하세요.</p>
      </div>`;
    return;
  }

  container.innerHTML = products.map(productCardHTML).join('');

  container.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['remove']!;
      void sendMsg({ type: 'PRODUCT_REMOVE', payload: id }).then(() => loadProducts());
    });
  });
}

function productCardHTML(product: TrackedProduct): string {
  const history = product.priceHistory;
  const lowestPrice = history.length > 0
    ? Math.min(...history.map(h => h.price))
    : product.currentPrice;
  const isCurrentLowest = product.currentPrice <= lowestPrice;

  const lastChecked = product.lastCheckedAt
    ? new Date(product.lastCheckedAt).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '아직 확인 안 됨';

  const graph = drawPriceGraph(history, product.id);

  return `
    <div class="product-card">
      <div class="product-name">${escapeHtml(product.name)}</div>
      <div class="price-row">
        <div class="price-item">
          <span class="price-label">현재가</span>
          <span class="price-val price-current${isCurrentLowest ? ' price-lowest' : ''}">${product.currentPrice.toLocaleString()}원</span>
        </div>
        <div class="price-item">
          <span class="price-label">최저가</span>
          <span class="price-val price-lowest">${lowestPrice.toLocaleString()}원</span>
        </div>
      </div>
      ${graph}
      <div class="product-footer">
        <span class="product-meta">${product.targetPrice ? `목표가 ${product.targetPrice.toLocaleString()}원 · ` : ''}${lastChecked}</span>
        <button class="btn-remove" data-remove="${product.id}">삭제</button>
      </div>
    </div>`;
}

/** 일별 가격 SVG 미니 라인 차트 */
function drawPriceGraph(history: PriceRecord[], productId: string): string {
  if (history.length < 2) return '';

  const W = 280, H = 56, pad = 4;
  const prices = history.map(h => h.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const n = history.length;

  const toX = (i: number): number => pad + (i / (n - 1)) * (W - pad * 2);
  const toY = (p: number): number => H - pad - ((p - minP) / range) * (H - pad * 2);

  const pts = history.map((h, i) => `${toX(i).toFixed(1)},${toY(h.price).toFixed(1)}`).join(' ');

  const lastEntry = history[n - 1];
  const lx = toX(n - 1).toFixed(1);
  const ly = lastEntry !== undefined ? toY(lastEntry.price).toFixed(1) : String(H / 2);
  const fx = toX(0).toFixed(1);
  const gradId = `pg-g-${productId}`;

  return `
    <div class="price-graph">
      <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#667eea" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#667eea" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="${pts} ${lx},${H} ${fx},${H}" fill="url(#${gradId})"/>
        <polyline points="${pts}" fill="none" stroke="#667eea" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${lx}" cy="${ly}" r="2.5" fill="#667eea"/>
      </svg>
    </div>`;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

document.getElementById('btn-check-now')?.addEventListener('click', () => {
  setStatus('가격 확인 중...');
  void sendMsg({ type: 'PRICE_CHECK_NOW' })
    .then(() => loadProducts())
    .then(() => {
      setStatus('확인 완료');
      setTimeout(() => setStatus('\u00a0'), 2500);
    });
});

// 팝업 시작 시 스토리지 진단 → PRODUCTS_GET 시도
diagStorage()
  .then(() => loadProducts())
  .catch((err: unknown) => console.error('[PriceGuard] Popup init error:', err));
