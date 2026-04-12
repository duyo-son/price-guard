import { describe, it, expect, vi, beforeEach } from 'vitest';

type StorageGetFn = (
  keys?: string | string[] | Record<string, unknown> | null,
) => Promise<Record<string, unknown>>;
type SendMsgFn = (...args: unknown[]) => Promise<unknown>;

const mockGet = vi.mocked(chrome.storage.local.get as unknown as StorageGetFn);
const mockSend = vi.mocked(chrome.runtime.sendMessage as unknown as SendMsgFn);

function setupDOM(): void {
  document.body.innerHTML = `
    <div id="product-list"></div>
    <div id="status-bar"></div>
    <button id="btn-check-now"></button>
    <button id="btn-devtools"></button>
    <button id="btn-settings"></button>
    <div id="settings-panel" class="settings-panel">
      <button class="pos-tile" data-pos="top-left">↖ 왼쪽 위</button>
      <button class="pos-tile" data-pos="top-right">↗ 오른쪽 위</button>
      <button class="pos-tile" data-pos="bottom-left">↙ 왼쪽 아래</button>
      <button class="pos-tile" data-pos="bottom-right">↘ 오른쪽 아래</button>
      <button class="pos-tile" data-interval="24h">하루 1회</button>
      <button class="pos-tile" data-interval="6h">6시간</button>
      <button class="pos-tile" data-interval="3h">3시간</button>
      <button class="pos-tile" data-interval="paused">일시정지</button>
      <button class="pos-tile" data-fab-toggle="on">표시</button>
      <button class="pos-tile" data-fab-toggle="off">숨기기</button>
    </div>`;
}

beforeEach(() => {
  vi.resetModules();
  setupDOM();
  mockGet.mockResolvedValue({});
  mockSend.mockResolvedValue({ success: true, data: [] });
});

describe('팝업 초기화 — 설정 패널', () => {
  it('저장된 위치가 없으면 bottom-left 타일이 active다', async () => {
    mockGet.mockResolvedValue({});
    await import('../../../src/popup/main.js');

    await vi.waitFor(
      () => {
        const tile = document.querySelector('[data-pos="bottom-left"]');
        expect(tile?.classList.contains('active')).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('저장된 위치 top-right가 있으면 해당 타일이 active다', async () => {
    mockGet.mockResolvedValue({ price_guard_fab_position: 'top-right' });
    await import('../../../src/popup/main.js');

    await vi.waitFor(
      () => {
        const tile = document.querySelector('[data-pos="top-right"]');
        expect(tile?.classList.contains('active')).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('설정 버튼 클릭 시 패널에 open 클래스가 추가된다', async () => {
    await import('../../../src/popup/main.js');
    await vi.waitFor(
      () => {
        expect(
          document.querySelector('[data-pos="bottom-left"]')?.classList.contains('active'),
        ).toBe(true);
      },
      { timeout: 3000 },
    );

    document.getElementById('btn-settings')?.click();
    expect(document.getElementById('settings-panel')?.classList.contains('open')).toBe(true);
  });

  it('위치 타일 클릭 시 chrome.storage.local.set이 호출된다', async () => {
    await import('../../../src/popup/main.js');
    await vi.waitFor(
      () => {
        expect(
          document.querySelector('[data-pos="bottom-left"]')?.classList.contains('active'),
        ).toBe(true);
      },
      { timeout: 3000 },
    );

    vi.mocked(chrome.storage.local.set).mockReset();
    document.querySelector<HTMLButtonElement>('[data-pos="top-left"]')?.click();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      price_guard_fab_position: 'top-left',
    });
  });
});

describe('팝업 초기화 — 상품 목록', () => {
  it('PRODUCTS_GET 메시지로 상품을 불러온다', async () => {
    await import('../../../src/popup/main.js');
    await vi.waitFor(() => expect(mockSend).toHaveBeenCalled(), { timeout: 5000 });

    const hasProductsGet = mockSend.mock.calls.some(
      (c) => (c[0] as Record<string, unknown>)?.['type'] === 'PRODUCTS_GET',
    );
    expect(hasProductsGet).toBe(true);
  });

  it('상품이 없으면 빈 상태 메시지가 표시된다', async () => {
    mockSend.mockResolvedValue({ success: true, data: [] });
    await import('../../../src/popup/main.js');

    await vi.waitFor(
      () => {
        expect(document.querySelector('.empty-state')).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });
});

describe('팝업 — 최저가 상품 상단 정렬', () => {
  it('현재가 = 역대 최저가인 상품이 상단에 표시된다', async () => {
    const now = Date.now();
    const lowestNow = {
      id: 'low-001', name: '지금 최저 상품', url: 'https://example.com/1', imageUrl: '',
      currentPrice: 10_000, targetPrice: null, notifyOnDiscount: false,
      registeredAt: now, lastCheckedAt: now,
      priceHistory: [{ price: 15_000, timestamp: now - 1000 }, { price: 10_000, timestamp: now }],
    };
    const notLowest = {
      id: 'not-001', name: '최저 아닌 상품', url: 'https://example.com/2', imageUrl: '',
      currentPrice: 20_000, targetPrice: null, notifyOnDiscount: false,
      registeredAt: now, lastCheckedAt: now,
      priceHistory: [{ price: 10_000, timestamp: now - 1000 }, { price: 20_000, timestamp: now }],
    };
    // 의도적으로 최저 아닌 상품을 먼저 배치
    mockSend.mockResolvedValue({ success: true, data: [notLowest, lowestNow] });
    await import('../../../src/popup/main.js');

    await vi.waitFor(
      () => {
        const cards = document.querySelectorAll('.product-card');
        expect(cards.length).toBe(2);
        // 첫 번째 카드가 최저가 상품이어야 함
        expect(cards[0]?.querySelector('.product-name')?.textContent).toBe('지금 최저 상품');
      },
      { timeout: 5000 },
    );
  });
});
