export const STORAGE_KEYS = {
  PRODUCTS: 'price_guard_products',
} as const;

export const ALARM_NAMES = {
  DAILY_PRICE_CHECK: 'price_guard_daily_check',
} as const;

// 24시간마다 가격 체크 (분 단위)
export const ALARM_PERIOD_MINUTES = 24 * 60;

export const NOTIFICATION_MESSAGES = {
  targetPriceMet: (name: string, price: number) =>
    `"${name}" 가격이 목표가(${price.toLocaleString()}원)에 도달했습니다!`,
  priceDropped: (name: string, from: number, to: number) =>
    `"${name}" 가격이 ${from.toLocaleString()}원 → ${to.toLocaleString()}원으로 내렸습니다!`,
} as const;
