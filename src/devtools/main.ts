import type { TrackedProduct, FabPosition } from '../shared/types.js';
import { STORAGE_KEYS, DEFAULT_FAB_POSITION } from '../shared/constants.js';

const DAY_MS = 86_400_000;

// ── ID / 데이터 생성 유틸리티 ──────────────────────────────────────────────────

function makeId(): string {
  return `tm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

function makeHistory(
  startPrice: number,
  endPrice: number,
  days: number,
  fromTs: number,
): Array<{ price: number; timestamp: number }> {
  const hist: Array<{ price: number; timestamp: number }> = [];
  const step = days > 1 ? (endPrice - startPrice) / (days - 1) : 0;
  for (let i = 0; i < days; i++) {
    hist.push({ price: Math.round(startPrice + step * i), timestamp: fromTs + i * DAY_MS });
  }
  return hist;
}

function makeNormal(): TrackedProduct {
  const base = Date.now() - 7 * DAY_MS;
  return {
    id: makeId(), url: 'https://www.coupang.com/vp/products/7814592301',
    name: 'Sony WH-1000XM5 무선 노이즈 캔슬링 헤드폰', imageUrl: '',
    currentPrice: 298_000, targetPrice: 270_000, notifyOnDiscount: true,
    registeredAt: base, lastCheckedAt: Date.now() - 3_600_000,
    priceHistory: makeHistory(320_000, 298_000, 4, base),
  };
}

function makeDropping(): TrackedProduct {
  const base = Date.now() - 7 * DAY_MS;
  return {
    id: makeId(), url: 'https://smartstore.naver.com/airsound/products/8023485912',
    name: 'Apple AirPods Pro 2세대 MagSafe 충전 케이스', imageUrl: '',
    currentPrice: 229_000, targetPrice: 220_000, notifyOnDiscount: true,
    registeredAt: base, lastCheckedAt: Date.now() - 1_800_000,
    priceHistory: makeHistory(290_000, 229_000, 6, base),
  };
}

function makeTargetMet(): TrackedProduct {
  const base = Date.now() - 5 * DAY_MS;
  return {
    id: makeId(), url: 'https://www.coupang.com/vp/products/3211048567',
    name: 'Samsung Galaxy Buds 3 Pro 무선 이어버드', imageUrl: '',
    currentPrice: 149_000, targetPrice: 150_000, notifyOnDiscount: false,
    registeredAt: base, lastCheckedAt: Date.now() - 900_000,
    priceHistory: makeHistory(179_000, 149_000, 3, base),
  };
}

function makeLowestEver(): TrackedProduct {
  const base = Date.now() - 30 * DAY_MS;
  return {
    id: makeId(), url: 'https://smartstore.naver.com/techstore/products/6789012345',
    name: 'LG 그램 노트북 16인치 2024년형', imageUrl: '',
    currentPrice: 1_290_000, targetPrice: null, notifyOnDiscount: true,
    registeredAt: base, lastCheckedAt: Date.now() - 600_000,
    priceHistory: makeHistory(1_590_000, 1_290_000, 5, base),
  };
}

function makeNewProduct(): TrackedProduct {
  return {
    id: makeId(), url: 'https://www.coupang.com/vp/products/99887766',
    name: '새로 등록된 상품 (가격 이력 없음)', imageUrl: '',
    currentPrice: 35_000, targetPrice: 30_000, notifyOnDiscount: true,
    registeredAt: Date.now() - DAY_MS, lastCheckedAt: null,
    priceHistory: [{ price: 35_000, timestamp: Date.now() - DAY_MS }],
  };
}

const PRESETS: Record<string, TrackedProduct[]> = {
  empty: [],
  normal: [makeNormal()],
  dropping: [makeDropping()],
  'target-met': [makeTargetMet()],
  'lowest-ever': [makeLowestEver()],
  multi: [makeNormal(), makeDropping(), makeTargetMet(), makeLowestEver(), makeNewProduct()],
};

// ── 스토리지 헬퍼 ──────────────────────────────────────────────────────────────

async function getAllProducts(): Promise<TrackedProduct[]> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.PRODUCTS);
  return (res[STORAGE_KEYS.PRODUCTS] as TrackedProduct[] | undefined) ?? [];
}

async function setAllProducts(products: TrackedProduct[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PRODUCTS]: products });
}

async function getFabPosition(): Promise<FabPosition> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.FAB_POSITION);
  const val: unknown = res[STORAGE_KEYS.FAB_POSITION];
  const positions: FabPosition[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  for (const p of positions) {
    if (val === p) return p;
  }
  return DEFAULT_FAB_POSITION;
}

async function setFabPosition(pos: FabPosition): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.FAB_POSITION]: pos });
}

// ── 토스트 알림 ────────────────────────────────────────────────────────────────

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string): void {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
    toastTimer = null;
  }, 2200);
}

// ── 상품 목록 렌더링 ──────────────────────────────────────────────────────────

function isFabPosition(val: unknown): val is FabPosition {
  return (
    val === 'bottom-right' ||
    val === 'bottom-left' ||
    val === 'top-right' ||
    val === 'top-left'
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getProductStatus(product: TrackedProduct): string {
  const allPrices = product.priceHistory.map(h => h.price);
  const lowest = allPrices.length > 0 ? Math.min(...allPrices) : product.currentPrice;
  const isLowest = product.currentPrice <= lowest && allPrices.length > 1;
  const isTargetMet = product.targetPrice !== null && product.currentPrice <= product.targetPrice;

  if (isTargetMet) return '<span class="tm-status target">🎯 목표가 도달</span>';
  if (isLowest) return '<span class="tm-status lowest">🏆 역대 최저</span>';
  return '';
}

function renderProductCard(product: TrackedProduct): string {
  const histCount = product.priceHistory.length;
  const targetText =
    product.targetPrice !== null
      ? `목표가 ${product.targetPrice.toLocaleString()}원`
      : '목표가 없음';
  const status = getProductStatus(product);

  return `
    <div class="tm-product-card" data-id="${escapeHtml(product.id)}">
      <div class="tm-card-info">
        <div class="tm-card-name">${escapeHtml(product.name)}${status}</div>
        <div class="tm-card-meta">
          <span>현재가 <strong>${product.currentPrice.toLocaleString()}원</strong></span>
          <span>${targetText}</span>
          <span>이력 ${histCount}건</span>
          <span>${product.notifyOnDiscount ? '🔔 알림 ON' : '🔕 알림 OFF'}</span>
        </div>
        <div class="history-form-container"></div>
      </div>
      <div class="tm-card-actions">
        <button class="btn-add-history" data-add-history="${escapeHtml(product.id)}">+ 이력 추가</button>
        <button class="btn-delete" data-delete="${escapeHtml(product.id)}">삭제</button>
      </div>
    </div>`;
}

async function renderProducts(): Promise<void> {
  const products = await getAllProducts();
  const container = document.getElementById('products-list');
  const countBadge = document.getElementById('product-count');
  if (!container) return;
  if (countBadge) countBadge.textContent = String(products.length);

  if (products.length === 0) {
    container.innerHTML =
      '<div class="empty-hint">추적 상품이 없습니다.<br>위 프리셋을 선택하거나 직접 추가하세요.</div>';
    return;
  }

  container.innerHTML = products.map(renderProductCard).join('');

  // 삭제 버튼
  container.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['delete'] ?? '';
      void (async () => {
        const all = await getAllProducts();
        await setAllProducts(all.filter(p => p.id !== id));
        showToast('🗑 상품이 삭제되었습니다.');
        await renderProducts();
      })();
    });
  });

  // 가격 이력 추가 버튼
  container.querySelectorAll<HTMLButtonElement>('[data-add-history]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset['addHistory'] ?? '';
      const card = container.querySelector<HTMLElement>(
        `[data-id="${id}"] .history-form-container`,
      );
      if (!card) return;
      if (card.innerHTML !== '') {
        card.innerHTML = '';
        return;
      }
      card.innerHTML = `
        <div class="history-form">
          <input type="number" class="hist-price" placeholder="가격 (원)" min="1" />
          <input type="date" class="hist-date" />
          <button class="btn-history-submit" data-hist-submit="${escapeHtml(id)}">추가</button>
        </div>`;
      const dateInput = card.querySelector<HTMLInputElement>('.hist-date');
      if (dateInput) dateInput.valueAsDate = new Date();

      card.querySelector<HTMLButtonElement>('[data-hist-submit]')?.addEventListener('click', () => {
        const priceInput = card.querySelector<HTMLInputElement>('.hist-price');
        const price = Number(priceInput?.value);
        const dateVal = dateInput?.value ?? '';
        if (!price || price <= 0 || !dateVal) {
          showToast('⚠ 가격과 날짜를 입력하세요.');
          return;
        }
        const timestamp = new Date(dateVal).getTime();
        void (async () => {
          const all = await getAllProducts();
          const target = all.find(p => p.id === id);
          if (target) {
            target.priceHistory.push({ price, timestamp });
            target.priceHistory.sort((a, b) => a.timestamp - b.timestamp);
            await setAllProducts(all);
            showToast('✅ 가격 이력이 추가되었습니다.');
          }
          await renderProducts();
        })();
      });
    });
  });
}

// ── 프리셋 ────────────────────────────────────────────────────────────────────

document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset['preset'] ?? '';
    const data = PRESETS[key];
    if (!data) return;
    void (async () => {
      await setAllProducts(data.map(p => ({ ...p, id: makeId() })));
      const labelEl = btn.querySelector('.label');
      showToast(`✅ "${labelEl?.textContent ?? key}" 프리셋이 로드되었습니다.`);
      await renderProducts();
    })();
  });
});

// ── 상품 추가 폼 ──────────────────────────────────────────────────────────────

document.getElementById('add-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const nameEl = document.getElementById('input-name') as HTMLInputElement | null;
  const urlEl = document.getElementById('input-url') as HTMLInputElement | null;
  const priceEl = document.getElementById('input-price') as HTMLInputElement | null;
  const targetEl = document.getElementById('input-target') as HTMLInputElement | null;
  const imageEl = document.getElementById('input-image') as HTMLInputElement | null;
  const historyDaysEl = document.getElementById('input-history-days') as HTMLInputElement | null;
  const notifyEl = document.getElementById('input-notify') as HTMLInputElement | null;

  const name = nameEl?.value.trim() ?? '';
  const url = urlEl?.value.trim() ?? '';
  const currentPrice = Number(priceEl?.value);
  const targetPrice = targetEl?.value ? Number(targetEl.value) : null;
  const imageUrl = imageEl?.value.trim() ?? '';
  const historyDays = Math.max(0, Math.min(90, Number(historyDaysEl?.value ?? 0)));
  const notifyOnDiscount = notifyEl?.checked ?? true;

  if (!name || !url || !currentPrice || currentPrice <= 0) {
    showToast('⚠ 상품명, URL, 현재가는 필수입니다.');
    return;
  }

  const registeredAt = Date.now() - historyDays * DAY_MS;
  const priceHistory =
    historyDays > 0
      ? makeHistory(
          Math.round(currentPrice * (1 + historyDays * 0.01)),
          currentPrice,
          historyDays,
          registeredAt,
        )
      : [{ price: currentPrice, timestamp: registeredAt }];

  const product: TrackedProduct = {
    id: makeId(), name, url, imageUrl, currentPrice, targetPrice, notifyOnDiscount,
    registeredAt, lastCheckedAt: historyDays > 0 ? Date.now() - DAY_MS : null, priceHistory,
  };

  void (async () => {
    const all = await getAllProducts();
    all.push(product);
    await setAllProducts(all);
    showToast('✅ 상품이 추가되었습니다.');
    if (nameEl) nameEl.value = '';
    if (urlEl) urlEl.value = '';
    if (priceEl) priceEl.value = '';
    if (targetEl) targetEl.value = '';
    if (imageEl) imageEl.value = '';
    if (historyDaysEl) historyDaysEl.value = '0';
    await renderProducts();
  })();
});

// ── FAB 위치 ──────────────────────────────────────────────────────────────────

function markActivePosButton(pos: FabPosition): void {
  document.querySelectorAll<HTMLButtonElement>('[data-pos]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset['pos'] === pos);
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-pos]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const pos = btn.dataset['pos'];
    if (!isFabPosition(pos)) return;
    markActivePosButton(pos);
    void setFabPosition(pos).then(() => showToast(`✅ FAB 위치: ${pos}`));
  });
});

// ── 전체 삭제 ─────────────────────────────────────────────────────────────────

document.getElementById('btn-clear-all')?.addEventListener('click', () => {
  if (!confirm('정말로 모든 추적 데이터를 삭제하시겠습니까?')) return;
  void (async () => {
    await chrome.storage.local.clear();
    showToast('🗑 전체 데이터가 삭제되었습니다.');
    await renderProducts();
    markActivePosButton(DEFAULT_FAB_POSITION);
  })();
});

// ── 초기화 ────────────────────────────────────────────────────────────────────

void (async () => {
  await renderProducts();
  const pos = await getFabPosition();
  markActivePosButton(pos);
})();
