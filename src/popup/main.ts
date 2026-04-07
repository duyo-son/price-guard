import type { TrackedProduct, Message, MessageResponse } from '../shared/types.js';

async function sendMsg<T>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage<Message, MessageResponse<T>>(message);
}

async function loadProducts(): Promise<void> {
  const res = await sendMsg<TrackedProduct[]>({ type: 'PRODUCTS_GET' });
  renderProducts(res.data ?? []);
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
  const lastChecked = product.lastCheckedAt
    ? `마지막 확인: ${new Date(product.lastCheckedAt).toLocaleString('ko-KR')}`
    : '아직 확인되지 않음';

  return `
    <div class="product-card">
      <div class="product-name">${escapeHtml(product.name)}</div>
      <div class="product-price">${product.currentPrice.toLocaleString()}원</div>
      <div class="product-meta">
        ${product.targetPrice ? `목표가: ${product.targetPrice.toLocaleString()}원 · ` : ''}
        ${lastChecked}
      </div>
      <div class="product-footer">
        <button class="btn-remove" data-remove="${product.id}">삭제</button>
      </div>
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

loadProducts().catch((err: unknown) => console.error('[PriceGuard] Popup init error:', err));
