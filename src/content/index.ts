import { createGenericDetector } from './detector.js';
import { createCoupangDetector } from './sites/coupang.js';
import { createNaverSmartStoreDetector } from './sites/naver-smartstore.js';
import { showRegisterPanel } from './register-panel.js';

function selectDetector(doc: Document, url: string): ReturnType<typeof createGenericDetector> {
  if (/coupang\.com\/vp\/products\//.test(url)) {
    return createCoupangDetector(doc, url);
  }
  if (/smartstore\.naver\.com\/[^/]+\/products\//.test(url)) {
    return createNaverSmartStoreDetector(doc, url);
  }
  return createGenericDetector(doc, url);
}

function tryDetectAndShow(): void {
  const detector = selectDetector(document, location.href);
  if (!detector.isProductPage()) return;

  const product = detector.extractProduct();
  if (product) {
    showRegisterPanel(product);
  }
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
