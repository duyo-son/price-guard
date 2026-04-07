import { createStorageService } from '../shared/storage.js';
import type { Message, ProductRegisterPayload, TrackedProduct } from '../shared/types.js';
import { ALARM_NAMES } from '../shared/constants.js';
import { registerDailyAlarm, onAlarmFired } from './alarm-manager.js';
import { notifyTargetPriceMet, notifyPriceDropped } from './notifier.js';

const storage = createStorageService();

// 설치/시작 시 일일 알람 등록
chrome.runtime.onInstalled.addListener(() => {
  registerDailyAlarm().catch((err: unknown) =>
    console.error('[PriceGuard] Failed to register alarm:', err),
  );
});

chrome.runtime.onStartup.addListener(() => {
  registerDailyAlarm().catch((err: unknown) =>
    console.error('[PriceGuard] Failed to register alarm on startup:', err),
  );
});

// 알람 이벤트 → 가격 체크
onAlarmFired(ALARM_NAMES.DAILY_PRICE_CHECK, checkAllPrices);

// Content script / Popup 메시지 처리
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: unknown) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ success: false, error: String(err) }));
    return true; // 비동기 응답 허용
  },
);

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'PRODUCT_REGISTER': {
      const payload = message.payload as ProductRegisterPayload;
      const product: TrackedProduct = {
        id: crypto.randomUUID(),
        ...payload,
        registeredAt: Date.now(),
        lastCheckedAt: null,
        priceHistory: [{ price: payload.currentPrice, timestamp: Date.now() }],
      };
      await storage.saveProduct(product);
      return { success: true, data: product };
    }

    case 'PRODUCT_REMOVE': {
      await storage.removeProduct(message.payload as string);
      return { success: true };
    }

    case 'PRODUCTS_GET': {
      const products = await storage.getProducts();
      return { success: true, data: products };
    }

    case 'PRICE_CHECK_NOW': {
      await checkAllPrices();
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function checkAllPrices(): Promise<void> {
  const products = await storage.getProducts();

  for (const product of products) {
    try {
      const newPrice = await fetchCurrentPrice(product.url);
      if (newPrice === null) continue;

      const previousPrice = product.currentPrice;
      product.currentPrice = newPrice;
      product.lastCheckedAt = Date.now();
      product.priceHistory.push({ price: newPrice, timestamp: Date.now() });

      await storage.updateProduct(product);

      if (product.targetPrice !== null && newPrice <= product.targetPrice) {
        notifyTargetPriceMet(product);
      } else if (product.notifyOnDiscount && newPrice < previousPrice) {
        notifyPriceDropped(product, previousPrice);
      }
    } catch (err) {
      console.error(`[PriceGuard] Failed to check price for ${product.url}:`, err);
    }
  }
}

// TODO: 쇼핑몰별 가격 파싱 구현 (현재는 placeholder)
// 각 쇼핑몰 지원 추가 시 src/background/sites/ 디렉토리에 구현
function fetchCurrentPrice(_url: string): Promise<number | null> {
  return Promise.resolve(null);
}
