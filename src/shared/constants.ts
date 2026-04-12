import type { CheckInterval } from './types.js';

export const STORAGE_KEYS = {
  PRODUCTS: 'price_guard_products',
  FAB_POSITION: 'price_guard_fab_position',
  CHECK_INTERVAL: 'price_guard_check_interval',
  FAB_ENABLED: 'price_guard_fab_enabled',
} as const;

export const DEFAULT_FAB_POSITION = 'bottom-left' as const;

export const DEFAULT_CHECK_INTERVAL: CheckInterval = '24h';

// 확인 주기별 알람 주기 (분 단위). null = 일시정지 (알람 삭제)
export const CHECK_INTERVAL_MINUTES: Record<CheckInterval, number | null> = {
  '24h': 24 * 60,
  '6h': 6 * 60,
  '3h': 3 * 60,
  'paused': null,
} as const;

export function isCheckInterval(val: unknown): val is CheckInterval {
  return val === '24h' || val === '6h' || val === '3h' || val === 'paused';
}

export const ALARM_NAMES = {
  DAILY_PRICE_CHECK: 'price_guard_daily_check',
} as const;

// 24시간마다 가격 체크 (분 단위)
export const ALARM_PERIOD_MINUTES = 24 * 60;

// 상품 간 요청 간격 (ms) — 쇼핑몰 차단 방지
export const REQUEST_INTERVAL_MS = 3_000;

// 수동 확인 시 최소 재확인 간격 (1시간) — 연속 클릭 방지
export const MIN_MANUAL_CHECK_INTERVAL_MS = 60 * 60 * 1_000;

// 쇼핑몰별 추천인/제휴 코드 — 호스트명을 키로, 코드를 값으로 등록
// 등록된 코드는 상품 URL 클릭 시 ?ref=<코드> 파라미터로 자동 추가됨
// 예시:
//   'www.coupang.com': 'AF1234567',
//   'smartstore.naver.com': 'ABC123',
export const AFFILIATE_CODES: Readonly<Record<string, string>> = {
  // 여기에 추천인 코드를 등록하세요
} as const;

export const NOTIFICATION_MESSAGES = {
  targetPriceMet: (name: string, price: number) =>
    `"${name}" 가격이 목표가(${price.toLocaleString()}원)에 도달했습니다!`,
  priceDropped: (name: string, from: number, to: number) =>
    `"${name}" 가격이 ${from.toLocaleString()}원 → ${to.toLocaleString()}원으로 내렸습니다!`,
} as const;
