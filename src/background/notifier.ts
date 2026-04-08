import type { TrackedProduct } from '../shared/types.js';
import { NOTIFICATION_MESSAGES } from '../shared/constants.js';

export function notifyTargetPriceMet(product: TrackedProduct): void {
  chrome.notifications.create(`target_${product.id}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '가격파수꾼 — 목표가 달성! 🎉',
    message: NOTIFICATION_MESSAGES.targetPriceMet(product.name, product.currentPrice),
  });
}

export function notifyPriceDropped(
  product: TrackedProduct,
  previousPrice: number,
): void {
  chrome.notifications.create(`drop_${product.id}_${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: '가격파수꾼 — 가격 하락! 📉',
    message: NOTIFICATION_MESSAGES.priceDropped(
      product.name,
      previousPrice,
      product.currentPrice,
    ),
  });
}
