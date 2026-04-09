import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DetectedProduct } from '../../../src/content/detector.js';

const mockProduct: DetectedProduct = {
  name: 'Sony WH-1000XM5',
  url: 'https://www.coupang.com/vp/products/123456',
  imageUrl: 'https://example.com/img.jpg',
  price: 298_000,
};

type StorageGetFn = (
  keys?: string | string[] | Record<string, unknown> | null,
) => Promise<Record<string, unknown>>;

const mockGet = vi.mocked(chrome.storage.local.get as unknown as StorageGetFn);

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  document.getElementById('price-guard-styles')?.remove();
  mockGet.mockResolvedValue({});
  vi.mocked(chrome.storage.onChanged.addListener).mockReset();
});

// ── showRegisterPanel ──────────────────────────────────────────────────────

describe('showRegisterPanel()', () => {
  it('FAB 버튼을 DOM에 추가한다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);

    const fab = document.getElementById('price-guard-fab');
    expect(fab).not.toBeNull();
    expect(fab?.tagName).toBe('BUTTON');
  });

  it('이미 FAB이 있으면 중복 추가하지 않는다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);
    await showRegisterPanel(mockProduct);

    const fabs = document.querySelectorAll('#price-guard-fab');
    expect(fabs.length).toBe(1);
  });

  it('FAB 클릭 시 등록 패널이 열린다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);
    document.getElementById('price-guard-fab')?.click();

    const panel = document.getElementById('price-guard-panel');
    expect(panel).not.toBeNull();
  });

  it('패널에 "가격파수꾼" 헤더가 표시된다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);
    document.getElementById('price-guard-fab')?.click();

    const panelHTML = document.getElementById('price-guard-panel')?.innerHTML ?? '';
    expect(panelHTML).toContain('가격파수꾼');
  });

  it('FAB 재클릭 시 패널이 닫힌다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);
    document.getElementById('price-guard-fab')?.click(); // 열기
    document.getElementById('price-guard-fab')?.click(); // 닫기

    const panel = document.getElementById('price-guard-panel');
    expect(panel).toBeNull();
  });

  it('storage.local.get으로 위치를 로드한다', async () => {
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);

    expect(mockGet).toHaveBeenCalledWith('price_guard_fab_position');
  });

  it('저장된 위치(top-right) 적용 시 FAB 스타일에 반영된다', async () => {
    mockGet.mockResolvedValue({ price_guard_fab_position: 'top-right' });
    const { showRegisterPanel } = await import('../../../src/content/register-panel.js');
    await showRegisterPanel(mockProduct);

    const fab = document.getElementById('price-guard-fab');
    expect(fab?.style.top).toBe('28px');
    expect(fab?.style.right).toBe('28px');
  });
});

// ── showTrackingFab ────────────────────────────────────────────────────────

describe('showTrackingFab()', () => {
  it('"추적중" 뱃지 텍스트가 있는 FAB을 추가한다', async () => {
    const { showTrackingFab } = await import('../../../src/content/register-panel.js');
    await showTrackingFab(mockProduct, 298_000, Date.now());

    const fab = document.getElementById('price-guard-fab');
    expect(fab).not.toBeNull();
    expect(fab?.textContent).toContain('추적중');
  });

  it('클릭 시 추적 패널(역대 최저가 포함)이 열린다', async () => {
    const { showTrackingFab } = await import('../../../src/content/register-panel.js');
    await showTrackingFab(mockProduct, 250_000, Date.now());
    document.getElementById('price-guard-fab')?.click();

    const panelHTML = document.getElementById('price-guard-panel')?.innerHTML ?? '';
    expect(panelHTML).toContain('역대 최저가');
    expect(panelHTML).toContain('250,000');
  });

  it('현재가가 최저가와 같으면 🎉 뱃지가 표시된다', async () => {
    const { showTrackingFab } = await import('../../../src/content/register-panel.js');
    await showTrackingFab({ ...mockProduct, price: 200_000 }, 200_000, Date.now());
    document.getElementById('price-guard-fab')?.click();

    const panelHTML = document.getElementById('price-guard-panel')?.innerHTML ?? '';
    expect(panelHTML).toContain('🎉');
  });
});

// ── hideRegisterPanel ─────────────────────────────────────────────────────

describe('hideRegisterPanel()', () => {
  it('FAB과 패널과 스타일을 DOM에서 제거한다', async () => {
    const { showRegisterPanel, hideRegisterPanel } = await import(
      '../../../src/content/register-panel.js'
    );
    await showRegisterPanel(mockProduct);
    document.getElementById('price-guard-fab')?.click();
    hideRegisterPanel();

    expect(document.getElementById('price-guard-fab')).toBeNull();
    expect(document.getElementById('price-guard-panel')).toBeNull();
    expect(document.getElementById('price-guard-styles')).toBeNull();
  });
});

// ── storage.onChanged listener ────────────────────────────────────────────

describe('chrome.storage.onChanged 리스너', () => {
  it('모듈 임포트 시 addListener가 호출된다', async () => {
    await import('../../../src/content/register-panel.js');
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledOnce();
  });
});
