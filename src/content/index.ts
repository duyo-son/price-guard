import { createGenericDetector } from './detector.js';
import { createCoupangDetector } from './sites/coupang.js';
import { createNaverSmartStoreDetector } from './sites/naver-smartstore.js';
import { showRegisterPanel, showTrackingFab, hideRegisterPanel } from './register-panel.js';
import type { ProductDetectedPayload } from '../shared/types.js';

const LOG = '[PriceGuard]';
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 1000;

function selectDetector(doc: Document, url: string): ReturnType<typeof createGenericDetector> {
  if (/coupang\.com\/vp\/products\//.test(url)) {
    return createCoupangDetector(doc, url);
  }
  if (/smartstore\.naver\.com\/[^/]+\/products\//.test(url)) {
    return createNaverSmartStoreDetector(doc, url);
  }
  return createGenericDetector(doc, url);
}

/**
 * background에 PRODUCT_DETECTED 메시지를 보내고
 * 이미 등록된 상품인지 여부(isRegistered)를 반환한다.
 */
interface DetectedResult {
  isRegistered: boolean;
  lowestPrice?: number;
  registeredAt?: number;
}

async function sendDetectedMessage(
  detected: boolean,
  name?: string,
  url?: string,
): Promise<DetectedResult> {
  const payload: ProductDetectedPayload = { detected, name, url };
  try {
    const res: { success: boolean; data?: DetectedResult } | undefined =
      await chrome.runtime.sendMessage({ type: 'PRODUCT_DETECTED', payload });
    return res?.data ?? { isRegistered: false };
  } catch {
    // Service Worker 비활성 시 무시
    return { isRegistered: false };
  }
}

/**
 * 상품 페이지 감지 및 패널 표시.
 * React/동적 렌더링 사이트는 가격을 나중에 주입하므로 실패 시 재시도.
 * targetHref: 시작 시점의 URL (SPA 내비게이션으로 변경되면 즉시 취소)
 */
async function attemptDetect(targetHref: string, retryCount: number): Promise<void> {
  try {
    // URL이 이미 바뀌었으면 중단 (SPA 이동)
    if (location.href !== targetHref) return;

    const detector = selectDetector(document, targetHref);

    if (!detector.isProductPage()) {
      console.log(LOG, '비상품 페이지:', targetHref);
      void sendDetectedMessage(false);
      return;
    }

    console.log(LOG, `상품 페이지 — 정보 추출 시도 (${retryCount + 1}/${MAX_RETRIES + 1})`);
    const product = detector.extractProduct();

    if (product) {
      console.log(LOG, '추출 성공:', product.name, product.price);
      const result = await sendDetectedMessage(true, product.name, product.url);
      if (!result.isRegistered) {
        void showRegisterPanel(product);
      } else {
        void showTrackingFab(product, result.lowestPrice, result.registeredAt);
      }
    } else if (retryCount < MAX_RETRIES) {
      console.log(LOG, `추출 실패 (재시도 ${RETRY_DELAY_MS}ms 후)...`);
      setTimeout(() => { void attemptDetect(targetHref, retryCount + 1); }, RETRY_DELAY_MS);
    } else {
      console.log(LOG, '상품 정보 추출 최종 실패 — 패널 미표시');
      void sendDetectedMessage(false);
    }
  } catch (err) {
    console.error(LOG, '감지 오류:', err);
    void sendDetectedMessage(false);
  }
}

function tryDetectAndShow(): void {
  // SPA 이동 시 이전 패널 제거
  hideRegisterPanel();
  void attemptDetect(location.href, 0);
}

// DOM 준비 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryDetectAndShow);
} else {
  tryDetectAndShow();
}

// SPA(싱글 페이지 앱) 내비게이션 감지
let lastHref = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    tryDetectAndShow();
  }
});
observer.observe(document.documentElement, { subtree: true, childList: true });
