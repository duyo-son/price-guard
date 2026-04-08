import type { DetectedProduct } from './detector.js';
import type { ProductRegisterPayload } from '../shared/types.js';

const PANEL_ID = 'price-guard-panel';

export function showRegisterPanel(product: DetectedProduct): void {
  if (document.getElementById(PANEL_ID)) return;
  const panel = buildPanel(product);
  document.body.appendChild(panel);
}

export function hideRegisterPanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}

function buildPanel(product: DetectedProduct): HTMLElement {
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = renderHTML(product);
  applyStyles(panel);

  const header = panel.querySelector<HTMLElement>('[data-pg="header"]');
  if (header) makeDraggable(panel, header);

  panel.querySelector<HTMLButtonElement>('[data-pg="close"]')?.addEventListener('click', hideRegisterPanel);
  panel.querySelector<HTMLButtonElement>('[data-pg="register"]')?.addEventListener('click', () => {
    void handleRegister(panel, product);
  });

  return panel;
}

function renderHTML(product: DetectedProduct): string {
  return `
    <div data-pg="header" style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:12px 14px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;cursor:grab;user-select:none">
      <span style="font-weight:600;font-size:14px">💰 가격파수꾼</span>
      <button data-pg="close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1">✕</button>
    </div>
    <div style="padding:14px">
      <p style="font-size:13px;font-weight:500;margin-bottom:6px;word-break:break-all">${escapeHtml(product.name)}</p>
      <p style="font-size:15px;font-weight:700;color:#e53e3e;margin-bottom:12px">
        현재가: ${product.price.toLocaleString()}원
      </p>
      <label style="display:block;font-size:12px;color:#555;margin-bottom:8px">
        목표가 (원)
        <input data-pg="target-price" type="number" min="0"
          placeholder="미입력 시 할인 감지만"
          style="display:block;width:100%;margin-top:4px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px" />
      </label>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#555;margin-bottom:14px;cursor:pointer">
        <input data-pg="notify-discount" type="checkbox" checked />
        가격 하락 시 알림
      </label>
      <button data-pg="register"
        style="width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">
        추적 시작
      </button>
    </div>
  `;
}

function applyStyles(panel: HTMLElement): void {
  Object.assign(panel.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '270px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    zIndex: '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '14px',
    color: '#333',
    overflow: 'hidden',
  });
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    // 닫기 버튼 클릭이면 드래그 무시
    if ((e.target as HTMLElement).closest('[data-pg="close"]')) return;

    const rect = panel.getBoundingClientRect();
    // bottom/right → top/left 좌표로 전환
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    handle.style.cursor = 'grabbing';

    const onMove = (ev: MouseEvent): void => {
      const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ev.clientX - startX));
      const newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ev.clientY - startY));
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    };

    const onUp = (): void => {
      handle.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}

async function handleRegister(panel: HTMLElement, product: DetectedProduct): Promise<void> {
  const targetInput = panel.querySelector<HTMLInputElement>('[data-pg="target-price"]');
  const discountInput = panel.querySelector<HTMLInputElement>('[data-pg="notify-discount"]');

  const payload: ProductRegisterPayload = {
    name: product.name,
    url: product.url,
    imageUrl: product.imageUrl,
    currentPrice: product.price,
    targetPrice: targetInput?.value ? Number(targetInput.value) : null,
    notifyOnDiscount: discountInput?.checked ?? true,
  };

  try {
    await chrome.runtime.sendMessage({ type: 'PRODUCT_REGISTER', payload });
    const body = panel.querySelector<HTMLElement>('div:last-child');
    if (body) {
      body.innerHTML = '<p style="text-align:center;padding:20px 14px;font-size:14px">✅ 추적이 시작되었습니다!</p>';
    }
    setTimeout(hideRegisterPanel, 1800);
  } catch (err) {
    console.error('[PriceGuard] Failed to register product:', err);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
