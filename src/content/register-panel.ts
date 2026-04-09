import type { DetectedProduct } from './detector.js';
import type { FabPosition, ProductRegisterPayload } from '../shared/types.js';
import { DEFAULT_FAB_POSITION, STORAGE_KEYS } from '../shared/constants.js';

const PANEL_ID = 'price-guard-panel';
const FAB_ID = 'price-guard-fab';
const STYLE_ID = 'price-guard-styles';

const GRADIENT_DEFAULT = 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
const GRADIENT_TRACKING = 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)';

// 현재 적용 중인 위치 — loadFabPosition·storage.onChanged 양쪽에서 동기화
let activePosition: FabPosition = DEFAULT_FAB_POSITION;

// Material Design path data (Apache 2.0) — price-tag & checkmark
const PATH_PRICE_TAG =
  'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 ' +
  '.55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 ' +
  '1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42z' +
  'M5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z';
const PATH_CHECK = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z';

function makeSvg(path: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"` +
    ` fill="white" style="pointer-events:none;flex-shrink:0"><path d="${path}"/></svg>`
  );
}

// ── Position helpers ──────────────────────────────────────────────────────────

function fabPositionCSS(pos: FabPosition): string {
  const vert = pos.startsWith('top') ? 'top:28px;bottom:auto;' : 'bottom:28px;top:auto;';
  const horiz = pos.endsWith('left') ? 'left:28px;right:auto;' : 'right:28px;left:auto;';
  return vert + horiz;
}

function panelPositionCSS(pos: FabPosition): string {
  const vert = pos.startsWith('top') ? 'top:102px;bottom:auto;' : 'bottom:102px;top:auto;';
  const horiz = pos.endsWith('left') ? 'left:28px;right:auto;' : 'right:28px;left:auto;';
  return vert + horiz;
}

async function loadFabPosition(): Promise<FabPosition> {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEYS.FAB_POSITION);
    const val: unknown = res[STORAGE_KEYS.FAB_POSITION];
    if (val === 'bottom-right' || val === 'bottom-left' || val === 'top-right' || val === 'top-left') {
      activePosition = val;
      return val;
    }
  } catch {
    // 무시
  }
  activePosition = DEFAULT_FAB_POSITION;
  return DEFAULT_FAB_POSITION;
}

// ── Style injection ─────────────────────────────────────────────────────────

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent =
    `@keyframes pg-pulse{0%{box-shadow:0 0 0 0 rgba(102,126,234,.65),0 8px 28px rgba(102,126,234,.4)}` +
    `70%{box-shadow:0 0 0 14px rgba(102,126,234,0),0 8px 28px rgba(102,126,234,.4)}` +
    `100%{box-shadow:0 0 0 0 rgba(102,126,234,0),0 8px 28px rgba(102,126,234,.4)}}` +
    `@keyframes pg-pulse-g{0%{box-shadow:0 0 0 0 rgba(17,153,142,.65),0 8px 28px rgba(17,153,142,.4)}` +
    `70%{box-shadow:0 0 0 14px rgba(17,153,142,0),0 8px 28px rgba(17,153,142,.4)}` +
    `100%{box-shadow:0 0 0 0 rgba(17,153,142,0),0 8px 28px rgba(17,153,142,.4)}}` +
    `@keyframes pg-pop{0%{opacity:0;transform:scale(.45) rotate(-10deg)}` +
    `65%{transform:scale(1.12) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}` +
    `@keyframes pg-slide-up{from{opacity:0;transform:translateY(20px) scale(.95)}` +
    `to{opacity:1;transform:translateY(0) scale(1)}}` +
    `@keyframes pg-slide-down{from{opacity:0;transform:translateY(-20px) scale(.95)}` +
    `to{opacity:1;transform:translateY(0) scale(1)}}` +
    `#${FAB_ID}{transition:transform .18s cubic-bezier(.34,1.56,.64,1)!important}` +
    `#${FAB_ID}:hover{transform:scale(1.1)!important}` +
    `#${FAB_ID}:active{transform:scale(.92)!important}` +
    `.pg-reg-btn{transition:box-shadow .15s,transform .15s!important}` +
    `.pg-reg-btn:hover{box-shadow:0 8px 28px rgba(102,126,234,.55)!important;transform:translateY(-1px)}` +
    `.pg-close-btn:hover{background:rgba(255,255,255,.3)!important}` +
    `.pg-input:focus{border-color:#764ba2!important;box-shadow:0 0 0 3px rgba(118,75,162,.15)!important;outline:none}`;
  document.head.appendChild(s);
}

// ── FAB ────────────────────────────────────────────────────────────────────

function buildFab(isTracking: boolean, position: FabPosition): HTMLButtonElement {
  const fab = document.createElement('button');
  fab.id = FAB_ID;

  const gradient = isTracking ? GRADIENT_TRACKING : GRADIENT_DEFAULT;
  const pulse = isTracking
    ? 'pg-pulse-g 2.2s ease-in-out infinite'
    : 'pg-pulse 2.2s ease-in-out infinite';

  fab.style.cssText =
    `position:fixed;${fabPositionCSS(position)}width:62px;height:62px;` +
    `border-radius:50%;background:${gradient};border:none;cursor:pointer;` +
    `display:flex;align-items:center;justify-content:center;` +
    `z-index:2147483647;outline:none;padding:0;overflow:visible;` +
    `animation:pg-pop .42s cubic-bezier(.34,1.56,.64,1) both;`;

  fab.innerHTML = makeSvg(isTracking ? PATH_CHECK : PATH_PRICE_TAG);

  if (isTracking) {
    const badge = document.createElement('span');
    badge.textContent = '추적중';
    badge.style.cssText =
      `position:absolute;top:-6px;right:-6px;` +
      `background:linear-gradient(135deg,#f093fb,#f5576c);` +
      `color:#fff;font-size:9px;font-weight:700;padding:3px 6px;` +
      `border-radius:10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;` +
      `line-height:1.4;letter-spacing:.04em;white-space:nowrap;` +
      `border:2px solid #fff;pointer-events:none;box-shadow:0 2px 6px rgba(245,87,108,.4);`;
    fab.appendChild(badge);
  }

  // entrance → pulse
  setTimeout(() => {
    if (document.getElementById(FAB_ID) === fab) fab.style.animation = pulse;
  }, 450);

  return fab;
}

// ── Dialog panel ────────────────────────────────────────────────────────────

function buildPanel(product: DetectedProduct, isTracking: boolean, lowestPrice?: number, registeredAt?: number, position: FabPosition = DEFAULT_FAB_POSITION): HTMLElement {
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  const slideAnim = position.startsWith('top') ? 'pg-slide-down' : 'pg-slide-up';
  panel.style.cssText =
    `position:fixed;${panelPositionCSS(position)}width:312px;` +
    `background:#fff;border-radius:20px;` +
    `box-shadow:0 12px 48px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.06);` +
    `z-index:2147483646;overflow:hidden;` +
    `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;` +
    `font-size:14px;color:#1a1a2e;border:1px solid rgba(0,0,0,.06);` +
    `animation:${slideAnim} .3s cubic-bezier(.22,1,.36,1) both;`;

  panel.innerHTML = isTracking ? renderTrackingHTML(product, lowestPrice, registeredAt) : renderRegisterHTML(product);

  const header = panel.querySelector<HTMLElement>('[data-pg="header"]');
  if (header) makeDraggable(panel, header);

  return panel;
}

function headerRow(isTracking: boolean): string {
  const gradient = isTracking ? GRADIENT_TRACKING : GRADIENT_DEFAULT;
  const icon = makeSvg(isTracking ? PATH_CHECK : PATH_PRICE_TAG);
  const title = isTracking ? '추적 중' : '가격파수꾼';
  const live = isTracking
    ? `<span style="background:rgba(255,255,255,.25);font-size:10px;font-weight:700;` +
      `padding:2px 8px;border-radius:20px;letter-spacing:.04em">LIVE</span>`
    : '';
  return (
    `<div data-pg="header" style="background:${gradient};color:#fff;padding:14px 16px;` +
    `border-radius:20px 20px 0 0;display:flex;justify-content:space-between;` +
    `align-items:center;cursor:grab;user-select:none">` +
    `<div style="display:flex;align-items:center;gap:10px">${icon}` +
    `<span style="font-weight:700;font-size:15px;letter-spacing:-.03em">${title}</span>${live}</div>` +
    `<button class="pg-close-btn" style="background:rgba(255,255,255,.18);border:none;color:#fff;` +
    `cursor:pointer;font-size:14px;width:28px;height:28px;border-radius:50%;` +
    `display:flex;align-items:center;justify-content:center;transition:background .15s">✕</button></div>`
  );
}

function priceCard(product: DetectedProduct, isTracking: boolean): string {
  const bg = isTracking
    ? 'linear-gradient(135deg,#f0fff4 0%,#e6fffa 100%)'
    : 'linear-gradient(135deg,#f0f0ff 0%,#faf0ff 100%)';
  const labelColor = isTracking ? '#38a169' : '#764ba2';
  const priceColor = isTracking ? '#1a4731' : '#44337a';
  const border = isTracking ? 'rgba(56,161,105,.25)' : 'rgba(118,75,162,.2)';
  const mb = isTracking ? '4px' : '14px';
  return (
    `<div style="background:${bg};border-radius:12px;padding:13px 15px;margin-bottom:${mb};` +
    `border:1.5px solid ${border}">` +
    `<div style="font-size:11px;font-weight:700;color:${labelColor};letter-spacing:.08em;margin-bottom:3px;text-transform:uppercase">현재가</div>` +
    `<div style="font-size:26px;font-weight:800;color:${priceColor};letter-spacing:-.04em;line-height:1.1">` +
    `${product.price.toLocaleString()}<span style="font-size:15px;font-weight:600;margin-left:3px;opacity:.7">원</span></div></div>`
  );
}

function thumbHTML(product: DetectedProduct): string {
  if (!product.imageUrl) return '';
  return (
    `<div style="width:100%;height:120px;border-radius:12px;background:#f8f9fc;overflow:hidden;` +
    `margin-bottom:13px;display:flex;align-items:center;justify-content:center">` +
    `<img src="${escapeAttr(product.imageUrl)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"/></div>`
  );
}

function productNameHTML(product: DetectedProduct): string {
  return (
    `<p style="font-size:13px;font-weight:500;margin:0 0 12px;word-break:break-all;` +
    `color:#4a4a68;line-height:1.55">${escapeHtml(product.name)}</p>`
  );
}

function renderTrackingHTML(product: DetectedProduct, lowestPrice?: number, registeredAt?: number): string {
  const isAllTimeLow = lowestPrice !== undefined && product.price <= lowestPrice;
  const lowestCard = lowestPrice !== undefined
    ? `<div style="background:linear-gradient(135deg,#fff8e7 0%,#fff3cd 100%);border-radius:12px;` +
      `padding:13px 15px;margin-bottom:4px;border:1.5px solid rgba(237,177,27,.35);">` +
      `<div style="font-size:11px;font-weight:700;color:#b7791f;letter-spacing:.08em;margin-bottom:3px;text-transform:uppercase">` +
      `역대 최저가${isAllTimeLow ? ' 🎉 현재 최저!' : ''}</div>` +
      `<div style="font-size:22px;font-weight:800;color:#744210;letter-spacing:-.04em;line-height:1.1">` +
      `${lowestPrice.toLocaleString()}<span style="font-size:14px;font-weight:600;margin-left:3px;opacity:.7">원</span></div>` +
      `</div>`
    : '';
  const sinceText = registeredAt !== undefined
    ? `<p style="font-size:11px;color:#9b9bb5;margin:10px 0 0;text-align:right">` +
      `추적 시작: ${new Date(registeredAt).toLocaleDateString('ko-KR')}</p>`
    : '';
  return (
    headerRow(true) +
    `<div style="padding:16px 16px 20px">` +
    thumbHTML(product) +
    productNameHTML(product) +
    priceCard(product, true) +
    lowestCard +
    sinceText +
    `</div>`
  );
}

function renderRegisterHTML(product: DetectedProduct): string {
  return (
    headerRow(false) +
    `<div style="padding:16px 16px 20px">` +
    thumbHTML(product) +
    productNameHTML(product) +
    priceCard(product, false) +
    `<label style="display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:10px">목표가 (원)` +
    `<input class="pg-input" data-pg="target-price" type="number" min="0"` +
    ` placeholder="미입력 시 할인 감지만"` +
    ` style="display:block;width:100%;margin-top:5px;padding:9px 11px;border:1.5px solid #e8e8f0;` +
    `border-radius:10px;font-size:13px;box-sizing:border-box;color:#1a1a2e;background:#fafafa;` +
    `transition:border-color .15s,box-shadow .15s"/></label>` +
    `<label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;` +
    `color:#666;margin-bottom:16px;cursor:pointer">` +
    `<input data-pg="notify-discount" type="checkbox" checked` +
    ` style="width:16px;height:16px;accent-color:#764ba2;cursor:pointer"/>가격 하락 시 알림</label>` +
    `<button class="pg-reg-btn" data-pg="register"` +
    ` style="width:100%;padding:13px;background:${GRADIENT_DEFAULT};color:#fff;border:none;` +
    `border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:-.01em;` +
    `box-shadow:0 4px 18px rgba(102,126,234,.4)">🚀 추적 시작</button>` +
    `</div>`
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function showRegisterPanel(product: DetectedProduct): Promise<void> {
  if (document.getElementById(FAB_ID)) return;
  injectStyles();
  const initialPos = await loadFabPosition();
  const fab = buildFab(false, initialPos);
  document.body.appendChild(fab);

  fab.addEventListener('click', () => {
    if (document.getElementById(PANEL_ID)) { hideDialog(); return; }
    // activePosition: 클릭 시점의 최신 위치를 사용 (클로저 아님)
    const panel = buildPanel(product, false, undefined, undefined, activePosition);
    panel.querySelector<HTMLButtonElement>('.pg-close-btn')?.addEventListener('click', hideDialog);
    panel.querySelector<HTMLButtonElement>('.pg-reg-btn')?.addEventListener('click', () => {
      void handleRegister(panel, product);
    });
    document.body.appendChild(panel);
  });
}

export async function showTrackingFab(product: DetectedProduct, lowestPrice?: number, registeredAt?: number): Promise<void> {
  if (document.getElementById(FAB_ID)) return;
  injectStyles();
  const initialPos = await loadFabPosition();
  const fab = buildFab(true, initialPos);
  document.body.appendChild(fab);

  fab.addEventListener('click', () => {
    if (document.getElementById(PANEL_ID)) { hideDialog(); return; }
    // activePosition: 클릭 시점의 최신 위치를 사용 (클로저 아님)
    const panel = buildPanel(product, true, lowestPrice, registeredAt, activePosition);
    panel.querySelector<HTMLButtonElement>('.pg-close-btn')?.addEventListener('click', hideDialog);
    document.body.appendChild(panel);
  });
}

export function hideRegisterPanel(): void {
  hideDialog();
  document.getElementById(FAB_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

// ── Private helpers ─────────────────────────────────────────────────────────

function hideDialog(): void {
  document.getElementById(PANEL_ID)?.remove();
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.pg-close-btn')) return;

    const rect = panel.getBoundingClientRect();
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
      body.innerHTML =
        `<p style="text-align:center;padding:24px 14px;font-size:15px;font-weight:600">` +
        `✅ 추적이 시작되었습니다!</p>`;
    }
    // 패널 닫고 FAB을 추적중 상태로 전환
    setTimeout(() => transitionToTrackingFab(product), 1800);
  } catch (err) {
    console.error('[PriceGuard] Failed to register product:', err);
  }
}

/** 등록 완료 후 FAB을 미등록(보라) → 추적중(초록) 으로 부드럽게 전환 */
function transitionToTrackingFab(product: DetectedProduct): void {
  hideDialog();

  const oldFab = document.getElementById(FAB_ID);
  if (oldFab instanceof HTMLElement) {
    // 축소 페이드 아웃
    oldFab.style.transition = 'transform .25s ease, opacity .25s ease';
    oldFab.style.transform = 'scale(0)';
    oldFab.style.opacity = '0';
    setTimeout(() => {
      oldFab.remove();
      // 추적중 FAB 팝인
      const newFab = buildFab(true, activePosition);
      document.body.appendChild(newFab);

      newFab.addEventListener('click', () => {
        if (document.getElementById(PANEL_ID)) { hideDialog(); return; }
        // 등록 시점 현재가를 최저가로 표시 (이후 가격 확인 전까지 최선)
        const panel = buildPanel(product, true, product.price, Date.now(), activePosition);
        panel.querySelector<HTMLButtonElement>('.pg-close-btn')?.addEventListener('click', hideDialog);
        document.body.appendChild(panel);
      });
    }, 260);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ── Real-time position sync ──────────────────────────────────────────────────

function isFabPositionVal(val: unknown): val is FabPosition {
  return val === 'bottom-right' || val === 'bottom-left' || val === 'top-right' || val === 'top-left';
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(STORAGE_KEYS.FAB_POSITION in changes)) return;
  const rawNew: unknown = changes[STORAGE_KEYS.FAB_POSITION]?.newValue;
  const pos: FabPosition = isFabPositionVal(rawNew) ? rawNew : DEFAULT_FAB_POSITION;
  // 모듈 변수 동기화 — 이후 패널 생성 시 항상 최신 위치 사용
  activePosition = pos;

  const fab = document.getElementById(FAB_ID);
  if (fab instanceof HTMLElement) {
    fab.style.top = pos.startsWith('top') ? '28px' : 'auto';
    fab.style.bottom = pos.startsWith('top') ? 'auto' : '28px';
    fab.style.left = pos.endsWith('left') ? '28px' : 'auto';
    fab.style.right = pos.endsWith('left') ? 'auto' : '28px';
  }

  const panel = document.getElementById(PANEL_ID);
  if (panel instanceof HTMLElement) {
    panel.style.top = pos.startsWith('top') ? '102px' : 'auto';
    panel.style.bottom = pos.startsWith('top') ? 'auto' : '102px';
    panel.style.left = pos.endsWith('left') ? '28px' : 'auto';
    panel.style.right = pos.endsWith('left') ? 'auto' : '28px';
  }
});
