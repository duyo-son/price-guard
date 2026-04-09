import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrackedProduct } from '../../../src/shared/types.js';

const mockProduct: TrackedProduct = {
  id: 'notif-test-001',
  url: 'https://www.coupang.com/vp/products/1234',
  name: '테스트 노이즈 캔슬링 헤드폰',
  imageUrl: '',
  currentPrice: 45_000,
  targetPrice: 50_000,
  notifyOnDiscount: true,
  registeredAt: 1_700_000_000_000,
  lastCheckedAt: null,
  priceHistory: [{ price: 45_000, timestamp: 1_700_000_000_000 }],
};

beforeEach(() => {
  vi.mocked(chrome.notifications.create).mockReset();
});

describe('notifyTargetPriceMet()', () => {
  it('target_<id> 형태의 알림 ID로 생성한다', async () => {
    const { notifyTargetPriceMet } = await import('../../../src/background/notifier.js');
    notifyTargetPriceMet(mockProduct);

    expect(chrome.notifications.create).toHaveBeenCalledOnce();
    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    expect(call?.[0]).toBe('target_notif-test-001');
  });

  it('목표가 달성 타이틀을 사용한다', async () => {
    const { notifyTargetPriceMet } = await import('../../../src/background/notifier.js');
    notifyTargetPriceMet(mockProduct);

    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    expect((call?.[1] as chrome.notifications.NotificationOptions).title).toBe(
      '가격파수꾼 — 목표가 달성! 🎉',
    );
  });

  it('메시지에 상품명과 현재가를 포함한다', async () => {
    const { notifyTargetPriceMet } = await import('../../../src/background/notifier.js');
    notifyTargetPriceMet(mockProduct);

    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    const msg = (call?.[1] as chrome.notifications.NotificationOptions).message;
    expect(msg).toContain('테스트 노이즈 캔슬링 헤드폰');
    expect(msg).toContain('45,000');
  });

  it('알림 타입이 basic이다', async () => {
    const { notifyTargetPriceMet } = await import('../../../src/background/notifier.js');
    notifyTargetPriceMet(mockProduct);

    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    expect((call?.[1] as chrome.notifications.NotificationOptions).type).toBe('basic');
  });
});

describe('notifyPriceDropped()', () => {
  it('drop_<id>_<timestamp> 형태의 알림 ID로 생성한다', async () => {
    const { notifyPriceDropped } = await import('../../../src/background/notifier.js');
    notifyPriceDropped(mockProduct, 55_000);

    expect(chrome.notifications.create).toHaveBeenCalledOnce();
    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    expect(call?.[0]).toMatch(/^drop_notif-test-001_\d+$/);
  });

  it('가격 하락 타이틀을 사용한다', async () => {
    const { notifyPriceDropped } = await import('../../../src/background/notifier.js');
    notifyPriceDropped(mockProduct, 55_000);

    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    expect((call?.[1] as chrome.notifications.NotificationOptions).title).toBe(
      '가격파수꾼 — 가격 하락! 📉',
    );
  });

  it('메시지에 이전 가격과 현재 가격을 포함한다', async () => {
    const { notifyPriceDropped } = await import('../../../src/background/notifier.js');
    notifyPriceDropped(mockProduct, 55_000);

    const call = vi.mocked(chrome.notifications.create).mock.calls[0];
    const msg = (call?.[1] as chrome.notifications.NotificationOptions).message;
    expect(msg).toContain('55,000');
    expect(msg).toContain('45,000');
  });

  it('매번 고유한 알림 ID를 사용한다', async () => {
    const { notifyPriceDropped } = await import('../../../src/background/notifier.js');
    let tick = 0;
    const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => 1_000_000 + tick++);
    notifyPriceDropped(mockProduct, 60_000);
    notifyPriceDropped(mockProduct, 65_000);
    dateSpy.mockRestore();

    const ids = vi.mocked(chrome.notifications.create).mock.calls.map(c => c[0]);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
