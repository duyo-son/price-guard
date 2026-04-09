import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrackedProduct } from '../../../src/shared/types.js';

type MessageListener = (
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | void;

type StorageGetFn = (
  keys?: string | string[] | Record<string, unknown> | null,
) => Promise<Record<string, unknown>>;

const mockGet = vi.mocked(chrome.storage.local.get as unknown as StorageGetFn);

let capturedListener: MessageListener | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  capturedListener = null;
  vi.resetModules();
  vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation((fn) => {
    capturedListener = fn as MessageListener;
  });
});

async function loadBackground(): Promise<void> {
  await import('../../../src/background/index.js');
}

function callListener(message: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve) => {
    if (!capturedListener) throw new Error('listener not registered');
    capturedListener(message, {} as chrome.runtime.MessageSender, resolve);
  });
}

// ── PRODUCT_REGISTER ─────────────────────────────────────────────────────────

describe('PRODUCT_REGISTER 메시지 처리', () => {
  it('상품을 저장하고 TrackedProduct를 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = (await callListener({
      type: 'PRODUCT_REGISTER',
      payload: {
        name: '등록 테스트 상품',
        url: 'https://www.coupang.com/vp/products/9999',
        imageUrl: '',
        currentPrice: 50_000,
        targetPrice: 40_000,
        notifyOnDiscount: true,
      },
    })) as { success: boolean; data: TrackedProduct };

    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({
      name: '등록 테스트 상품',
      currentPrice: 50_000,
      targetPrice: 40_000,
    });
    expect(typeof res.data.id).toBe('string');
    expect(res.data.registeredAt).toBeLessThanOrEqual(Date.now());
    expect(res.data.priceHistory).toHaveLength(1);
    expect(res.data.priceHistory[0]?.price).toBe(50_000);
  });

  it('chrome.storage.local.set을 호출한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    await callListener({
      type: 'PRODUCT_REGISTER',
      payload: {
        name: 'Set 호출 테스트',
        url: 'https://www.coupang.com/vp/products/1111',
        imageUrl: '',
        currentPrice: 30_000,
        targetPrice: null,
        notifyOnDiscount: false,
      },
    });

    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
  });
});

// ── PRODUCT_REMOVE ────────────────────────────────────────────────────────────

describe('PRODUCT_REMOVE 메시지 처리', () => {
  it('지정 ID의 상품을 제거하고 success: true를 반환한다', async () => {
    const existing: TrackedProduct = {
      id: 'remove-001', name: '삭제될 상품',
      url: 'https://example.com', imageUrl: '',
      currentPrice: 100, targetPrice: null, notifyOnDiscount: false,
      registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
    };
    mockGet.mockResolvedValue({ price_guard_products: [existing] });
    await loadBackground();

    const res = (await callListener({
      type: 'PRODUCT_REMOVE',
      payload: 'remove-001',
    })) as { success: boolean };

    expect(res.success).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
  });
});

// ── PRODUCTS_GET ─────────────────────────────────────────────────────────────

describe('PRODUCTS_GET 메시지 처리', () => {
  it('저장된 상품 배열을 반환한다', async () => {
    const products: TrackedProduct[] = [
      {
        id: 'get-001', name: '조회 테스트 상품', url: 'https://example.com',
        imageUrl: '', currentPrice: 20_000, targetPrice: null, notifyOnDiscount: false,
        registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
      },
    ];
    mockGet.mockResolvedValue({ price_guard_products: products });
    await loadBackground();

    const res = (await callListener({ type: 'PRODUCTS_GET' })) as {
      success: boolean;
      data: TrackedProduct[];
    };

    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]?.name).toBe('조회 테스트 상품');
  });

  it('상품이 없으면 빈 배열을 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = (await callListener({ type: 'PRODUCTS_GET' })) as {
      success: boolean;
      data: TrackedProduct[];
    };

    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(0);
  });
});

// ── PRICE_CHECK_NOW ───────────────────────────────────────────────────────────

describe('PRICE_CHECK_NOW 메시지 처리', () => {
  it('상품이 없으면 success: true를 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = (await callListener({ type: 'PRICE_CHECK_NOW' })) as { success: boolean };
    expect(res.success).toBe(true);
  });

  it('쿠팡 상품 목표가 달성 시 알림을 발송한다', async () => {
    const product: TrackedProduct = {
      id: 'cpng-price-001', name: '쿠팡 가격 체크 상품',
      url: 'https://www.coupang.com/vp/products/1234567',
      imageUrl: '', currentPrice: 50_000, targetPrice: 40_000, notifyOnDiscount: false,
      registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
    };
    mockGet.mockResolvedValue({ price_guard_products: [product] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: (): Promise<string> => Promise.resolve('{"finalPrice": 38000}'),
    }));
    await loadBackground();

    await callListener({ type: 'PRICE_CHECK_NOW' });

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'target_cpng-price-001',
      expect.objectContaining({ title: '가격파수꾼 — 목표가 달성! 🎉' }),
    );
  });

  it('가격 하락 시 할인 알림을 발송한다', async () => {
    const product: TrackedProduct = {
      id: 'naver-drop-001', name: '네이버 가격 하락 상품',
      url: 'https://smartstore.naver.com/testshop/products/9876543',
      imageUrl: '', currentPrice: 60_000, targetPrice: null, notifyOnDiscount: true,
      registeredAt: Date.now(), lastCheckedAt: null, priceHistory: [],
    };
    mockGet.mockResolvedValue({ price_guard_products: [product] });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: (): Promise<string> => Promise.resolve('{"salePrice": 55000}'),
    }));
    await loadBackground();

    await callListener({ type: 'PRICE_CHECK_NOW' });

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      expect.stringMatching(/^drop_naver-drop-001_/),
      expect.objectContaining({ title: '가격파수꾼 — 가격 하락! 📉' }),
    );
  });
});

// ── Unknown message ──────────────────────────────────────────────────────────

describe('알 수 없는 메시지 처리', () => {
  it('success: false와 error를 반환한다', async () => {
    mockGet.mockResolvedValue({ price_guard_products: [] });
    await loadBackground();

    const res = (await callListener({ type: 'UNKNOWN_TYPE' })) as {
      success: boolean;
      error: string;
    };

    expect(res.success).toBe(false);
    expect(typeof res.error).toBe('string');
  });
});
