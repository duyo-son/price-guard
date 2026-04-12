// 추적 상품 모델
export interface TrackedProduct {
  id: string;
  url: string;
  name: string;
  imageUrl: string;
  currentPrice: number;
  targetPrice: number | null;      // 목표가 (이 가격 이하면 알림)
  notifyOnDiscount: boolean;       // 가격 하락 시 알림 여부
  registeredAt: number;            // 등록 시각 (timestamp)
  lastCheckedAt: number | null;    // 마지막 확인 시각
  priceHistory: PriceRecord[];     // 가격 이력
}

export interface PriceRecord {
  price: number;
  timestamp: number;
}

export type FabPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type CheckInterval = '24h' | '6h' | '3h' | 'paused';

// 메시지 타입
export type MessageType =
  | 'PRODUCT_REGISTER'
  | 'PRODUCT_REMOVE'
  | 'PRODUCTS_GET'
  | 'PRICE_CHECK_NOW'
  | 'PRODUCT_DETECTED';

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ProductRegisterPayload {
  name: string;
  url: string;
  imageUrl: string;
  currentPrice: number;
  targetPrice: number | null;
  notifyOnDiscount: boolean;
}

export interface ProductDetectedPayload {
  detected: boolean;
  name?: string;
  url?: string;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
