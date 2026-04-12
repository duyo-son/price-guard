import { createStorageService } from '../shared/storage.js';
import type { Message, ProductRegisterPayload, TrackedProduct, ProductDetectedPayload } from '../shared/types.js';
import { ALARM_NAMES, REQUEST_INTERVAL_MS, MIN_MANUAL_CHECK_INTERVAL_MS } from '../shared/constants.js';
import { registerDailyAlarm, onAlarmFired } from './alarm-manager.js';
import { notifyTargetPriceMet, notifyPriceDropped } from './notifier.js';
import { fetchAliExpressPrice } from './sites/aliexpress.js';
import { fetchCoupangPrice } from './sites/coupang.js';
import { fetchNaverSmartStorePrice } from './sites/naver-smartstore.js';
import { RateLimitError } from './errors.js';

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

// 알람 이벤트 → 가격 체크 (일일 알람: 전체 강제 확인)
onAlarmFired(ALARM_NAMES.DAILY_PRICE_CHECK, () => checkAllPrices(true));

// Content script / Popup 메시지 처리
chrome.runtime.onMessage.addListener(
  (message: Message, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ success: false, error: String(err) }));
    return true; // 비동기 응답 허용
  },
);

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case 'PRODUCT_DETECTED': {
      const { detected, name, url } = message.payload as ProductDetectedPayload;
      const tabId = sender.tab?.id;

      // 스토리지 조회는 detected=true이고 url이 있을 때만
      let isRegistered = false;
      let lowestPrice: number | undefined;
      let registeredAt: number | undefined;
      if (detected && url !== undefined) {
        const products = await storage.getProducts();
        const matched = products.find(p => p.url === url);
        isRegistered = matched !== undefined;
        if (matched !== undefined) {
          const allPrices = [matched.currentPrice, ...matched.priceHistory.map(r => r.price)];
          lowestPrice = Math.min(...allPrices);
          registeredAt = matched.registeredAt;
        }
      }

      if (tabId !== undefined) {
        if (detected) {
          if (isRegistered) {
            void chrome.action.setBadgeText({ text: '✓', tabId });
            void chrome.action.setBadgeBackgroundColor({ color: '#9e9e9e', tabId });
            console.log(`[PriceGuard] 이미 추적 중: ${name ?? url ?? ''}`);
          } else {
            void chrome.action.setBadgeText({ text: '!', tabId });
            void chrome.action.setBadgeBackgroundColor({ color: '#f6ad55', tabId });
            console.log(`[PriceGuard] 추적 가능: ${name ?? ''}`);
          }
        } else {
          void chrome.action.setBadgeText({ text: '', tabId });
        }
      }
      // isRegistered + 최저가 정보를 content script에 반환
      return {
        success: true,
        data: isRegistered
          ? { isRegistered, lowestPrice, registeredAt }
          : { isRegistered },
      };
    }
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
      // 수동 확인: 최근 1시간 내 확인된 상품은 건너뜀
      await checkAllPrices(false);
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * 전체 상품 가격 확인
 * @param forceAll true = 일일 알람 (전체 확인), false = 수동 확인 (최근 확인 스킵)
 */
async function checkAllPrices(forceAll = true): Promise<void> {
  const products = await storage.getProducts();
  const now = Date.now();

  for (let i = 0; i < products.length; i++) {
    const product = products[i]!;

    // 수동 확인 시 MIN_MANUAL_CHECK_INTERVAL_MS 이내 확인된 상품은 스킵
    if (
      !forceAll &&
      product.lastCheckedAt !== null &&
      now - product.lastCheckedAt < MIN_MANUAL_CHECK_INTERVAL_MS
    ) {
      console.log(`[PriceGuard] 최근 확인됨, 스킵: ${product.name}`);
      continue;
    }

    // 2번째 상품부터 요청 간격 대기 (쇼핑몰 차단 방지)
    if (i > 0) {
      await new Promise<void>((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    }

    try {
      const newPrice = await fetchCurrentPrice(product.url);
      if (newPrice === null) continue;

      const previousPrice = product.currentPrice;
      product.currentPrice = newPrice;
      product.lastCheckedAt = now;
      product.priceHistory.push({ price: newPrice, timestamp: now });

      await storage.updateProduct(product);

      if (product.targetPrice !== null && newPrice <= product.targetPrice) {
        notifyTargetPriceMet(product);
      } else if (product.notifyOnDiscount && newPrice < previousPrice) {
        notifyPriceDropped(product, previousPrice);
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.warn(`[PriceGuard] 요청 차단됨 (429) — 나머지 확인 중단`);
        break;
      }
      console.error(`[PriceGuard] Failed to check price for ${product.url}:`, err);
    }
  }
}

// 쇼핑몰별 가격 조회 라우터
function fetchCurrentPrice(url: string): Promise<number | null> {
  if (/coupang\.com\/vp\/products\//.test(url)) {
    return fetchCoupangPrice(url);
  }
  if (/(?:smartstore|brand)\.naver\.com\/[^/]+\/products\//.test(url)) {
    return fetchNaverSmartStorePrice(url);
  }
  if (/aliexpress\.[a-z.]+\/item\/\d+\.html/.test(url)) {
    return fetchAliExpressPrice(url);
  }
  return Promise.resolve(null);
}
