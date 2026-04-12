import { createGenericDetector } from './detector.js';
import { createAliExpressDetector } from './sites/aliexpress.js';
import { createCoupangDetector } from './sites/coupang.js';
import { createNaverSmartStoreDetector } from './sites/naver-smartstore.js';
import { showRegisterPanel, showTrackingFab, hideRegisterPanel } from './register-panel.js';
import type { ProductDetectedPayload } from '../shared/types.js';
import { STORAGE_KEYS } from '../shared/constants.js';

const LOG = '[PriceGuard]';
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
// SPA 이동 후 Naver가 DOM/replaceState를 안정화할 때까지 기다리는 초기 지연
const SPA_INITIAL_DELAY_MS = 5000;

// 상품 페이지가 아닌 네이버 도메인 패턴 (검색·리스트 등)
const NAVER_NON_PRODUCT_PATTERN = /(?:search\.shopping\.naver\.com|search\.naver\.com|shopping\.naver\.com\/search)/;

/** URL이 상품 페이지가 아닌 리스트/홈 등으로 판단되면 true를 반환한다 (테스트 가능하도록 export) */
export function isBlockedUrl(url: string): boolean {
  if (/shop\.coupang\.com/.test(url)) return true;
  if (NAVER_NON_PRODUCT_PATTERN.test(url)) return true;
  if (/(?:smartstore|brand)\.naver\.com/.test(url) && !/\/products\//.test(url)) return true;
  if (/aliexpress\./.test(url) && !/aliexpress\.[a-z.]+\/item\/\d+\.html/.test(url)) return true;
  return false;
}

function selectDetector(doc: Document, url: string): ReturnType<typeof createGenericDetector> {
  if (isBlockedUrl(url)) {
    return { isProductPage: () => false, extractProduct: () => null };
  }
  if (/coupang\.com\/vp\/products\//.test(url)) {
    return createCoupangDetector(doc, url);
  }
  if (/(?:smartstore|brand)\.naver\.com\/[^/]+\/products\//.test(url)) {
    return createNaverSmartStoreDetector(doc, url);
  }
  if (/aliexpress\.[a-z.]+\/item\/\d+\.html/.test(url)) {
    return createAliExpressDetector(doc, url);
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
  lastCheckedAt?: number | null;
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
 * detectId: tryDetectAndShow 호출마다 증가 — 이전 체인의 setTimeout 리트라이를 무효화한다
 */
let currentDetectId = 0;

async function attemptDetect(targetHref: string, retryCount: number, detectId: number): Promise<void> {
  try {
    // 새 navigation이 시작됐으면 이 체인 전체 취소
    if (detectId !== currentDetectId) return;
    // pathname이 달라졌으면 중단 (다른 페이지로 이동)
    // 쿼리 파라미터 변경(Naver replaceState 등)은 같은 상품 페이지로 간주
    if (new URL(location.href).pathname !== new URL(targetHref).pathname) return;

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
      // FAB 감지 아이콘 표시 여부 확인
      const fabRes = await chrome.storage.local.get(STORAGE_KEYS.FAB_ENABLED);
      const fabEnabled = fabRes[STORAGE_KEYS.FAB_ENABLED] !== false;
      if (fabEnabled) {
        if (!result.isRegistered) {
          void showRegisterPanel(product);
        } else {
          void showTrackingFab(product, result.lowestPrice, result.registeredAt, result.lastCheckedAt ?? null);
        }
      }
    } else if (retryCount < MAX_RETRIES) {
      console.log(LOG, `추출 실패 (재시도 ${RETRY_DELAY_MS}ms 후)...`);
      setTimeout(() => { void attemptDetect(targetHref, retryCount + 1, detectId); }, RETRY_DELAY_MS);
    } else {
      console.log(LOG, '상품 정보 추출 최종 실패 — 패널 미표시');
      void sendDetectedMessage(false);
    }
  } catch (err) {
    console.error(LOG, '감지 오류:', err);
    void sendDetectedMessage(false);
  }
}

function tryDetectAndShow(initialDelay = 0): void {
  // SPA 이동 시 이전 패널 제거 + 이전 리트라이 체인 모두 취소
  hideRegisterPanel();
  const detectId = ++currentDetectId;
  setTimeout(() => { void attemptDetect(location.href, 0, detectId); }, initialDelay);
}

// DOM 준비 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { tryDetectAndShow(); });
} else {
  tryDetectAndShow();
}

// SPA(싱글 페이지 앱) 내비게이션 감지
// pathname이 바뀔 때만 트리거 — Naver의 replaceState(쿼리 파라미터 추가 등)는 무시
let lastPathname = location.pathname;
const observer = new MutationObserver(() => {
  if (location.pathname !== lastPathname) {
    lastPathname = location.pathname;
    // URL 변경 후 5초 대기 — Naver SPA가 새 DOM/replaceState를 완전히 안정화하도록
    tryDetectAndShow(SPA_INITIAL_DELAY_MS);
  }
});
observer.observe(document.documentElement, { subtree: true, childList: true });

// FAB 감지 아이콘 설정 변경 시 즉시 반영
chrome.storage.onChanged.addListener((changes) => {
  if (STORAGE_KEYS.FAB_ENABLED in changes) {
    const enabled = changes[STORAGE_KEYS.FAB_ENABLED]?.newValue !== false;
    if (!enabled) {
      hideRegisterPanel();
    } else {
      // 표시로 전환 시 현재 페이지를 다시 감지·표시
      tryDetectAndShow();
    }
  }
});
