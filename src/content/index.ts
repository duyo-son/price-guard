import { createGenericDetector } from './detector.js';
import { showRegisterPanel } from './register-panel.js';

function tryDetectAndShow(): void {
  const detector = createGenericDetector(document, location.href);
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
