export const STORAGE_KEYS = {
  PRODUCTS: 'price_guard_products',
  FAB_POSITION: 'price_guard_fab_position',
} as const;

export const DEFAULT_FAB_POSITION = 'bottom-left' as const;

export const ALARM_NAMES = {
  DAILY_PRICE_CHECK: 'price_guard_daily_check',
} as const;

// 24시간마다 가격 체크 (분 단위)
export const ALARM_PERIOD_MINUTES = 24 * 60;

// 상품 간 요청 간격 (ms) — 쇼핑몰 차단 방지
export const REQUEST_INTERVAL_MS = 3_000;

// 수동 확인 시 최소 재확인 간격 (1시간) — 연속 클릭 방지
export const MIN_MANUAL_CHECK_INTERVAL_MS = 60 * 60 * 1_000;

export const NOTIFICATION_MESSAGES = {
  targetPriceMet: (name: string, price: number) =>
    `"${name}" 가격이 목표가(${price.toLocaleString()}원)에 도달했습니다!`,
  priceDropped: (name: string, from: number, to: number) =>
    `"${name}" 가격이 ${from.toLocaleString()}원 → ${to.toLocaleString()}원으로 내렸습니다!`,
} as const;
