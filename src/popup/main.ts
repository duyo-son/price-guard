import type { TrackedProduct, FabPosition, Message, MessageResponse, PriceRecord, CheckInterval } from '../shared/types.js';
import { STORAGE_KEYS, DEFAULT_FAB_POSITION, AFFILIATE_CODES, DEFAULT_CHECK_INTERVAL, CHECK_INTERVAL_MINUTES, isCheckInterval } from '../shared/constants.js';

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

async function loadProducts(skipBlankState = false): Promise<void> {
  if (!skipBlankState) setLoading(true);
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

  // 현재가 = 역대 최저가인 상품을 상단으로 정렬
  const sorted = [...products].sort((a, b) => {
    const aLow = a.priceHistory.length > 0 ? Math.min(...a.priceHistory.map(h => h.price)) : a.currentPrice;
    const bLow = b.priceHistory.length > 0 ? Math.min(...b.priceHistory.map(h => h.price)) : b.currentPrice;
    const aIsLowest = a.currentPrice <= aLow;
    const bIsLowest = b.currentPrice <= bLow;
    if (aIsLowest && !bIsLowest) return -1;
    if (!aIsLowest && bIsLowest) return 1;
    return 0;
  });

  container.innerHTML = sorted.map(productCardHTML).join('');

  // CSP 제약 때문에 inline onerror 불가 — JS로 처리
  container.querySelectorAll<HTMLImageElement>('img.product-thumb').forEach((img) => {
    img.addEventListener('error', () => {
      const placeholder = img.nextElementSibling as HTMLElement | null;
      img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
    });
  });

  container.querySelectorAll<HTMLElement>('[data-url]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-remove]')) return;
      const url = card.dataset['url']!;
      void chrome.tabs.create({ url: buildProductUrl(url) });
    });
  });

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
    : '미확인';

  const thumb = product.imageUrl.trim()
    ? `<img class="product-thumb" src="${escapeAttr(product.imageUrl)}" alt="" loading="lazy">`+
      `<div class="product-thumb-placeholder" style="display:none">🛒</div>`
    : `<div class="product-thumb-placeholder">🛒</div>`;

  const graph = drawPriceGraph(history, product.id);

  return `
    <div class="product-card" data-url="${escapeAttr(product.url)}">
      <div class="product-card-inner">
        ${thumb}
        <div class="product-body">
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
            <span class="product-meta"><span class="checking-spinner"></span>${product.targetPrice ? `목표가 ${product.targetPrice.toLocaleString()}원 · ` : ''}<span class="last-checked">${lastChecked}</span></span>
            <button class="btn-remove" data-remove="${product.id}">삭제</button>
          </div>
        </div>
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

/** 추천인 코드가 등록된 경우 ?ref= 파라미터를 추가한다 */
function buildProductUrl(url: string): string {
  try {
    const u = new URL(url);
    const code = AFFILIATE_CODES[u.hostname];
    if (code) u.searchParams.set('ref', code);
    return u.toString();
  } catch {
    return url;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

document.getElementById('btn-check-now')?.addEventListener('click', () => {
  setStatus('가격 확인 중...');
  document.querySelectorAll<HTMLElement>('.product-card').forEach(card => {
    card.classList.add('is-checking');
  });
  void sendMsg({ type: 'PRICE_CHECK_NOW' })
    .then(() => loadProducts(true))
    .then(() => {
      setStatus('확인 완료');
      setTimeout(() => setStatus('\u00a0'), 2500);
    });
});
// ── 테스트 모드 ─────────────────────────────────────────────────────
document.getElementById('btn-devtools')?.addEventListener('click', () => {
  window.open(chrome.runtime.getURL('devtools/index.html'));
});
// ── 설정 패널 ─────────────────────────────────────────────────────────────────

function isFabPosition(val: unknown): val is FabPosition {
  return val === 'bottom-right' || val === 'bottom-left' || val === 'top-right' || val === 'top-left';
}

function markActivePosition(pos: FabPosition): void {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.querySelectorAll<HTMLButtonElement>('[data-pos]').forEach((tile) => {
    tile.classList.toggle('active', tile.dataset['pos'] === pos);
  });
}

function markActiveInterval(interval: CheckInterval): void {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((tile) => {
    tile.classList.toggle('active', tile.dataset['interval'] === interval);
  });
}

function markActiveFabToggle(enabled: boolean): void {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.querySelectorAll<HTMLButtonElement>('[data-fab-toggle]').forEach((tile) => {
    tile.classList.toggle('active', tile.dataset['fabToggle'] === (enabled ? 'on' : 'off'));
  });
}

async function initSettings(): Promise<void> {
  const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement | null;
  const settingsPanel = document.getElementById('settings-panel');
  if (!btnSettings || !settingsPanel) return;

  const res = await chrome.storage.local.get([
    STORAGE_KEYS.FAB_POSITION,
    STORAGE_KEYS.CHECK_INTERVAL,
    STORAGE_KEYS.FAB_ENABLED,
  ]);

  const rawPos: unknown = res[STORAGE_KEYS.FAB_POSITION];
  markActivePosition(isFabPosition(rawPos) ? rawPos : DEFAULT_FAB_POSITION);

  const rawInterval: unknown = res[STORAGE_KEYS.CHECK_INTERVAL];
  markActiveInterval(isCheckInterval(rawInterval) ? rawInterval : DEFAULT_CHECK_INTERVAL);

  const fabEnabled = res[STORAGE_KEYS.FAB_ENABLED] !== false;
  markActiveFabToggle(fabEnabled);

  btnSettings.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.toggle('open');
    btnSettings.classList.toggle('active', isOpen);
  });

  settingsPanel.querySelectorAll<HTMLButtonElement>('[data-pos]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const pos = tile.dataset['pos'];
      if (!isFabPosition(pos)) return;
      markActivePosition(pos);
      void chrome.storage.local.set({ [STORAGE_KEYS.FAB_POSITION]: pos });
    });
  });

  settingsPanel.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const interval = tile.dataset['interval'];
      if (!isCheckInterval(interval)) return;
      markActiveInterval(interval);
      void chrome.storage.local.set({ [STORAGE_KEYS.CHECK_INTERVAL]: interval });
      // 주기 변경 시 상태바에 피드백
      const label = CHECK_INTERVAL_MINUTES[interval] === null
        ? '가격 확인 일시정지됨'
        : `확인 주기: ${tile.textContent?.trim() ?? interval}`;
      setStatus(label);
      setTimeout(() => setStatus('\u00a0'), 2500);
    });
  });

  settingsPanel.querySelectorAll<HTMLButtonElement>('[data-fab-toggle]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const val = tile.dataset['fabToggle'];
      if (val !== 'on' && val !== 'off') return;
      const enabled = val === 'on';
      markActiveFabToggle(enabled);
      void chrome.storage.local.set({ [STORAGE_KEYS.FAB_ENABLED]: enabled });
    });
  });
}

// 팝업 시작 시 스토리지 진단 → PRODUCTS_GET 시도
diagStorage()
  .then(() => loadProducts())
  .catch((err: unknown) => console.error('[PriceGuard] Popup init error:', err));

void initSettings().catch((err: unknown) => console.error('[PriceGuard] Settings init error:', err));
