import { describe, it, expect, vi, beforeEach } from 'vitest';

// background/index.ts는 모듈 로드 시 chrome API에 리스너를 등록하므로
// onMessage.addListener mock 콜백을 직접 캡처하여 handleMessage를 테스트한다.

type MessageListener = (
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

// chrome.storage.local.get: @types/chrome 마지막 오버로드가 callback→void이므로 캐스팅
type StorageGetFn = (
  keys?: string | string[] | Record<string, unknown> | null,
) => Promise<Record<string, unknown>>;
const mockGet = vi.mocked(chrome.storage.local.get as unknown as StorageGetFn);

// chrome.runtime.MessageSender의 tab은 완전한 Tab 타입이라 unknown으로 캐스팅
function makeSender(tabId?: number): chrome.runtime.MessageSender {
  if (tabId === undefined) return {} as chrome.runtime.MessageSender;
  return { tab: { id: tabId } as chrome.tabs.Tab } as chrome.runtime.MessageSender;
}

let capturedListener: MessageListener | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  capturedListener = null;
  vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((fn) => {
    capturedListener = fn as MessageListener;
  });
  // 모듈 캐시를 초기화하여 리스너를 다시 등록
  vi.resetModules();
});

async function loadBackground(): Promise<void> {
  await import('../../../src/background/index.js');
}

function callListener(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender = {} as chrome.runtime.MessageSender,
): Promise<unknown> {
  return new Promise((resolve) => {
    if (!capturedListener) throw new Error('listener not registered');
    capturedListener(message, sender, resolve);
  });
}

// ── PRODUCT_DETECTED ────────────────────────────────────────────────────────

describe('PRODUCT_DETECTED 메시지 처리', () => {
  it('미등록 상품 감지 시 setBadgeText("!")와 주황색을 설정한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: true, name: '테스트 상품', url: 'https://example.com/product/1' } },
      makeSender(42),
    );

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!', tabId: 42 });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#f6ad55',
      tabId: 42,
    });
    expect(res).toEqual({ success: true, data: { isRegistered: false } });
  });

  it('이미 등록된 상품이면 setBadgeText("✓")와 그레이를 설정한다', async () => {
    const registeredProduct = {
      id: 'abc',
      url: 'https://example.com/product/1',
      name: '테스트 상품',
      imageUrl: '',
      currentPrice: 10000,
      targetPrice: null,
      notifyOnDiscount: true,
      registeredAt: Date.now(),
      lastCheckedAt: null,
      priceHistory: [],
    };
    mockGet.mockResolvedValue({ price_guard_products: [registeredProduct] });
    await loadBackground();

    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: true, name: '테스트 상품', url: 'https://example.com/product/1' } },
      makeSender(42),
    );

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '✓', tabId: 42 });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: '#9e9e9e',
      tabId: 42,
    });
    expect(res).toMatchObject({
      success: true,
      data: { isRegistered: true, lowestPrice: 10000 },
    });
  });

  it('detected:true이지만 url이 없으면 미등록으로 처리한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: true, name: '상품' } },
      makeSender(99),
    );

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!', tabId: 99 });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f6ad55', tabId: 99 });
    expect(res).toEqual({ success: true, data: { isRegistered: false } });
  });

  it('detected:false이면 setBadgeText("")으로 배지를 지운다', async () => {
    await loadBackground();

    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: false } },
      makeSender(7),
    );

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '', tabId: 7 });
    expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, data: { isRegistered: false } });
  });

  it('sender.tab이 없으면 chrome.action을 호출하지 않는다', async () => {
    await loadBackground();

    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: true, name: '상품' } },
      makeSender(), // tab 없음
    );

    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    expect(chrome.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, data: { isRegistered: false } });
  });

  it('sender.tab.id가 undefined이면 chrome.action을 호출하지 않는다', async () => {
    await loadBackground();

    // tab은 있지만 id 없는 경우
    const senderNoId = { tab: {} as chrome.tabs.Tab } as chrome.runtime.MessageSender;
    const res = await callListener(
      { type: 'PRODUCT_DETECTED', payload: { detected: true } },
      senderNoId,
    );

    expect(chrome.action.setBadgeText).not.toHaveBeenCalled();
    expect(res).toEqual({ success: true, data: { isRegistered: false } });
  });
});

// ── 기존 메시지 타입 회귀 테스트 ────────────────────────────────────────────

describe('기존 메시지 타입 회귀', () => {
  it('PRODUCTS_GET은 스토리지에서 상품 목록을 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = await callListener({ type: 'PRODUCTS_GET' });

    expect(res).toEqual({ success: true, data: [] });
  });

  it('PRODUCT_REMOVE는 성공 응답을 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    await loadBackground();

    const res = await callListener({ type: 'PRODUCT_REMOVE', payload: 'some-id' });

    expect(res).toEqual({ success: true });
  });

  it('알 수 없는 메시지 타입은 에러 응답을 반환한다', async () => {
    await loadBackground();

    const res = await callListener({ type: 'UNKNOWN_TYPE' });

    expect(res).toEqual({ success: false, error: 'Unknown message type' });
  });
});

// ── updateAlertBadge ─────────────────────────────────────────────────────────

describe('updateAlertBadge — 목표가 달성 배지', () => {
  it('목표가 달성 상품이 있으면 달성 수를 전역 배지로 표시한다', async () => {
    const products = [
      {
        id: 'a1', name: '달성 상품', url: 'https://example.com/1', imageUrl: '',
        currentPrice: 39_000, targetPrice: 40_000, notifyOnDiscount: false,
        registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
      },
      {
        id: 'a2', name: '미달성 상품', url: 'https://example.com/2', imageUrl: '',
        currentPrice: 80_000, targetPrice: 50_000, notifyOnDiscount: false,
        registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
      },
    ];
    mockGet.mockResolvedValue({ price_guard_products: products });
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    await loadBackground();

    await callListener({ type: 'PRODUCT_REGISTER', payload: {
      name: '신규', url: 'https://example.com/3', imageUrl: '',
      currentPrice: 10_000, targetPrice: null, notifyOnDiscount: false,
    }});

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#e53e3e' });
  });

  it('목표가 달성 상품이 없으면 전역 배지를 지운다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined);
    await loadBackground();

    await callListener({ type: 'PRODUCT_REGISTER', payload: {
      name: '신규', url: 'https://example.com/9', imageUrl: '',
      currentPrice: 100_000, targetPrice: null, notifyOnDiscount: false,
    }});

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });
});
