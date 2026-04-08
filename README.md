# Price Guard

쇼핑몰 상품 가격을 추적하고, 목표가 도달 또는 가격 하락 시 Chrome 알림을 보내는 **Manifest V3** 기반 크롬 확장프로그램입니다.

---

## 목차

1. [주요 기능](#주요-기능)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [아키텍처 개요](#아키텍처-개요)
5. [개발 환경 설정](#개발-환경-설정)
6. [빌드 & 로드](#빌드--로드)
7. [개발 명령어](#개발-명령어)
8. [데이터 모델](#데이터-모델)
9. [컴포넌트 상세](#컴포넌트-상세)
10. [새 쇼핑몰 지원 추가](#새-쇼핑몰-지원-추가)
11. [백그라운드 가격 조회 구현](#백그라운드-가격-조회-구현)
12. [메시지 통신 구조](#메시지-통신-구조)
13. [테스트](#테스트)
14. [코드 품질 도구](#코드-품질-도구)
15. [빌드 설정 원리](#빌드-설정-원리)
16. [알려진 한계 & TODO](#알려진-한계--todo)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 자동 상품 감지 | 쇼핑몰 상품 페이지 방문 시 자동으로 상품 정보(이름, 가격, 이미지) 감지 |
| 아이콘 배지 | 추적 가능 페이지에서 확장프로그램 아이콘에 초록색 `ON` 배지 표시, 이탈 시 자동 제거 |
| 추적 등록 패널 | 화면 우하단 플로팅 패널에서 목표가 설정 후 "추적 시작" 버튼 클릭으로 등록 |
| 일일 가격 체크 | 백그라운드 서비스 워커가 24시간마다 자동으로 가격 확인 |
| Chrome 알림 | 목표가 달성 또는 가격 하락 시 시스템 알림 발송 |
| 팝업 관리 | 확장프로그램 팝업에서 추적 목록 조회, 삭제, 수동 가격 확인 |
| 가격 이력 | 상품별 가격 변동 이력 저장 (`priceHistory`) |

---

## 기술 스택

- **TypeScript** (strict 모드) — 전 소스 타입 안전 보장
- **Vite** — popup / background / content script 각각 별도 빌드
- **Vitest** + **jsdom** — 단위 테스트
- **ESLint** (typescript-eslint) — 코드 린팅
- **Prettier** — 코드 포맷
- **Lefthook** — Git 훅 (pre-commit lint + typecheck)
- **Chrome Extensions Manifest V3**

---

## 프로젝트 구조

```
price-guard/
├── manifest.json               # 확장프로그램 선언 (MV3)
├── package.json
├── tsconfig.json               # 소스 코드용 TS 설정
├── tsconfig.node.json          # 빌드 스크립트용 TS 설정
├── vite.config.ts              # Popup 빌드
├── vite.background.config.ts   # Background Service Worker 빌드 (ESM)
├── vite.content.config.ts      # Content Script 빌드 (IIFE)
├── vitest.config.ts
├── eslint.config.js
├── lefthook.yml                # Git 훅 설정
├── scripts/
│   └── build.mjs               # 전체 빌드 오케스트레이터
├── public/
│   └── icons/                  # 확장프로그램 아이콘
├── src/
│   ├── shared/                 # 브라우저 API 없는 순수 TS
│   │   ├── types.ts            # 공통 타입 정의
│   │   ├── constants.ts        # 상수 (알람명, 스토리지 키, 메시지 등)
│   │   └── storage.ts          # chrome.storage.local 추상화
│   ├── background/             # Service Worker (DOM 사용 불가)
│   │   ├── index.ts            # 진입점: 알람 등록, 메시지 핸들러
│   │   ├── alarm-manager.ts    # chrome.alarms 등록/감지
│   │   └── notifier.ts         # chrome.notifications 발송
│   ├── content/                # Content Script (DOM + chrome API)
│   │   ├── index.ts            # 진입점: 감지 실행, SPA 내비게이션 감시
│   │   ├── detector.ts         # 상품 정보 추출 (Generic + SiteDetector 인터페이스)
│   │   ├── register-panel.ts   # 등록 플로팅 패널 UI
│   │   └── sites/              # (확장 위치) 쇼핑몰별 Detector 구현
│   └── popup/
│       ├── index.html          # 팝업 HTML + 스타일
│       └── main.ts             # 팝업 로직
└── tests/
    ├── setup.ts                # Vitest 전역 설정 (chrome mock)
    └── unit/
        ├── background/
        │   └── alarm-manager.test.ts
        ├── content/
        │   └── detector.test.ts
        └── shared/
            └── storage.test.ts
```

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────┐
│  쇼핑몰 페이지                                           │
│  ┌──────────────────────┐                               │
│  │  Content Script      │  DOM 파싱 → 상품 감지         │
│  │  (IIFE, content.js)  │  플로팅 패널 표시             │
│  └──────────┬───────────┘                               │
│             │ chrome.runtime.sendMessage                 │
└─────────────┼───────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────┐
│  Background Service Worker (background.js, ESM)          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ alarm-manager│  │  notifier    │  │  storage      │  │
│  │ (24h 스케줄) │  │ (알림 발송)  │  │(상품 데이터)  │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────┬───────────────────────────┘
                              │ chrome.runtime.sendMessage
┌─────────────────────────────▼───────────────────────────┐
│  Popup (popup/index.html + main.ts)                      │
│  목록 조회 / 삭제 / 수동 가격 확인                       │
└─────────────────────────────────────────────────────────┘

공통 저장소: chrome.storage.local  ←→  모든 컴포넌트
```

### MV3 핵심 제약사항

| 제약 | 영향 |
|------|------|
| Background는 Service Worker | `document`, `window` 사용 불가. 비활성 시 자동 종료됨 |
| Content Script는 ESM import 불가 | Vite로 IIFE 번들링 필수 |
| Background는 ESM 가능 | `manifest.json`에 `"type": "module"` 선언 |

---

## 개발 환경 설정

**요구사항:** Node.js 18+, npm

```bash
# 저장소 클론
git clone https://github.com/duyo-son/price-guard.git
cd price-guard

# 의존성 설치
npm install

# Git 훅 활성화 (pre-commit: lint + typecheck)
npx lefthook install
```

---

## 빌드 & 로드

```bash
# 전체 빌드 (dist/ 생성)
npm run build
```

빌드 결과물 구조:
```
dist/
├── manifest.json
├── background.js       # Service Worker
├── content.js          # Content Script
├── icons/
└── popup/
    ├── index.html
    └── main.js
```

### Chrome에 로드하는 법

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `dist/` 폴더 선택

코드 수정 후에는 `npm run build` 재실행 → Chrome에서 확장프로그램 새로고침(🔄)

---

## 개발 명령어

```bash
npm run build             # 전체 빌드 (dist/ 생성)
npm run build:popup       # Popup만 빌드
npm run build:background  # Background만 빌드
npm run build:content     # Content Script만 빌드

npm test                  # 단위 테스트 1회 실행
npm run test:watch        # 테스트 감시 모드
npm run test:coverage     # 커버리지 포함 테스트

npm run typecheck         # TypeScript 타입 검사 (src + scripts)
npm run lint              # ESLint 검사
npm run lint:fix          # ESLint 자동 수정
npm run format            # Prettier 포맷 적용
npm run format:check      # Prettier 포맷 검사
```

---

## 데이터 모델

### `TrackedProduct` (chrome.storage.local에 배열로 저장)

```typescript
interface TrackedProduct {
  id: string;                  // crypto.randomUUID()
  url: string;                 // 상품 페이지 URL
  name: string;
  imageUrl: string;
  currentPrice: number;        // 가장 최근 확인된 가격
  targetPrice: number | null;  // 목표가 (이 가격 이하면 알림)
  notifyOnDiscount: boolean;   // 가격 하락 시 알림 여부
  registeredAt: number;        // 등록 시각 (timestamp ms)
  lastCheckedAt: number | null;
  priceHistory: PriceRecord[]; // { price, timestamp }[]
}
```

### 스토리지 키

```typescript
// src/shared/constants.ts
STORAGE_KEYS.PRODUCTS = 'price_guard_products'
```

---

## 컴포넌트 상세

### `src/shared/storage.ts` — StorageService

`chrome.storage.local`을 감싸는 추상화 레이어. 테스트 시 mock으로 교체 가능.

```typescript
const storage = createStorageService();
await storage.getProducts();
await storage.saveProduct(product);   // URL 중복 시 덮어씀
await storage.removeProduct(id);
await storage.updateProduct(product); // id 기반 교체
```

### `src/background/alarm-manager.ts` — AlarmManager

```typescript
// 이미 등록된 경우 중복 등록 방지
await registerDailyAlarm();

// 알람 발화 시 핸들러 연결
onAlarmFired(ALARM_NAMES.DAILY_PRICE_CHECK, checkAllPrices);
```

- 알람 주기: `ALARM_PERIOD_MINUTES = 24 * 60` (분)
- 최초 발화 지연: `delayInMinutes: 1`

### `src/background/notifier.ts` — Notifier

```typescript
notifyTargetPriceMet(product);              // 목표가 달성 알림
notifyPriceDropped(product, previousPrice); // 가격 하락 알림
```

### `src/content/detector.ts` — SiteDetector

```typescript
export interface SiteDetector {
  isProductPage(): boolean;
  extractProduct(): DetectedProduct | null;
}
```

Generic Detector는 Schema.org 마크업과 공통 CSS 클래스(`.price`, `[itemprop="price"]` 등)로 감지.
쇼핑몰 전용 Detector는 `src/content/sites/`에 추가.

### `src/content/register-panel.ts` — 등록 패널

- `showRegisterPanel(product)` — 화면 우하단에 플로팅 패널 생성 (중복 생성 방지)
- `hideRegisterPanel()` — 패널 제거
- 등록 버튼 클릭 → `chrome.runtime.sendMessage({ type: 'PRODUCT_REGISTER', payload })`

---

## 새 쇼핑몰 지원 추가

Generic Detector가 인식하지 못하는 쇼핑몰은 전용 Detector를 작성합니다.

### 1단계 — Detector 파일 생성

`src/content/sites/<쇼핑몰명>.ts` 파일을 만들고 `SiteDetector`를 구현:

```typescript
// src/content/sites/coupang.ts
import type { SiteDetector, DetectedProduct } from '../detector.js';

export function createCoupangDetector(doc: Document, url: string): SiteDetector {
  return {
    isProductPage(): boolean {
      // 쿠팡 상품 페이지 URL 패턴 또는 DOM 요소로 판단
      return url.includes('coupang.com/vp/products/');
    },

    extractProduct(): DetectedProduct | null {
      if (!this.isProductPage()) return null;

      const name = doc.querySelector('.prod-buy-header__title')?.textContent?.trim() ?? null;
      const priceText = doc.querySelector('.total-price strong')?.textContent ?? null;

      if (!name || !priceText) return null;

      const price = Number(priceText.replace(/[^0-9]/g, ''));
      if (isNaN(price)) return null;

      const imageUrl = doc.querySelector<HTMLImageElement>('.prod-image__detail')?.src ?? '';

      return { name, price, imageUrl, url };
    },
  };
}
```

### 2단계 — `src/content/index.ts`에 라우팅 추가

```typescript
import { createGenericDetector } from './detector.js';
import { createCoupangDetector } from './sites/coupang.js'; // 추가
import { showRegisterPanel } from './register-panel.js';

function tryDetectAndShow(): void {
  const url = location.href;

  // 쇼핑몰별 Detector 선택
  const detector = url.includes('coupang.com')
    ? createCoupangDetector(document, url)
    : createGenericDetector(document, url);

  if (!detector.isProductPage()) return;
  const product = detector.extractProduct();
  if (product) showRegisterPanel(product);
}
```

### 3단계 — 테스트 작성

`tests/unit/content/sites/coupang.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createCoupangDetector } from '../../../../src/content/sites/coupang.js';

describe('CoupangDetector', () => {
  let doc: Document;
  const url = 'https://www.coupang.com/vp/products/123456';

  beforeEach(() => {
    const dom = new JSDOM(`
      <h1 class="prod-buy-header__title">테스트 상품</h1>
      <div class="total-price"><strong>29,900</strong></div>
      <img class="prod-image__detail" src="https://example.com/img.jpg" />
    `);
    doc = dom.window.document;
  });

  it('쿠팡 상품 페이지를 감지한다', () => {
    const detector = createCoupangDetector(doc, url);
    expect(detector.isProductPage()).toBe(true);
  });

  it('상품 정보를 추출한다', () => {
    const detector = createCoupangDetector(doc, url);
    const product = detector.extractProduct();
    expect(product?.name).toBe('테스트 상품');
    expect(product?.price).toBe(29900);
  });
});
```

---

## 백그라운드 가격 조회 구현

현재 `src/background/index.ts`의 `fetchCurrentPrice()`는 placeholder입니다.
실제 가격을 가져오려면 쇼핑몰별 구현이 필요합니다.

### 구현 위치

`src/background/sites/<쇼핑몰명>.ts` 디렉토리를 생성하고 fetch 로직을 작성합니다.

```typescript
// src/background/sites/coupang.ts
export async function fetchCoupangPrice(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    // DOMParser는 Service Worker에서 사용 불가 → 정규식 또는 별도 파싱
    const match = html.match(/"finalPrice"\s*:\s*(\d+)/);
    return match?.[1] ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
```

> **주의:** Background Service Worker는 DOM API(`document`, `DOMParser`)를 사용할 수 없습니다.
> HTML 파싱이 필요하면 정규식 또는 별도 Worker를 사용하세요.

`fetchCurrentPrice()`에 라우팅 추가:

```typescript
async function fetchCurrentPrice(url: string): Promise<number | null> {
  if (url.includes('coupang.com')) return fetchCoupangPrice(url);
  // 필요 시 다른 쇼핑몰 추가
  return null;
}
```

---

## 메시지 통신 구조

Content Script / Popup → Background 방향의 단방향 요청-응답 패턴.

| `type` | 발신 | 설명 | `payload` |
|--------|------|------|-----------|
| `PRODUCT_REGISTER` | Content Script | 상품 등록 | `ProductRegisterPayload` |
| `PRODUCT_REMOVE` | Popup | 상품 삭제 | `string` (id) |
| `PRODUCTS_GET` | Popup | 전체 목록 조회 | 없음 |
| `PRICE_CHECK_NOW` | Popup | 즉시 가격 확인 | 없음 |
| `PRODUCT_DETECTED` | Content Script | 상품 감지 결과 알림 → 아이콘 배지 표시/제거 | `ProductDetectedPayload` (`detected: boolean, name?: string`) |

**응답 형식:**

```typescript
interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## 테스트

```bash
npm test                  # 전체 단위 테스트
npm run test:coverage     # 커버리지 리포트 (coverage/ 폴더)
```

- **환경:** jsdom (브라우저 DOM 에뮬레이션)
- **Chrome API mock:** `tests/setup.ts`에서 `chrome.storage`, `chrome.alarms`, `chrome.notifications` mock 구성
- **커버리지 대상:** `src/**/*.ts` (단, `src/popup/**` 제외)

### 테스트 파일 위치 규칙

```
tests/unit/
  background/   ← src/background/ 의 단위 테스트
  content/
    sites/      ← 쇼핑몰 Detector 테스트
  shared/       ← src/shared/ 의 단위 테스트
```

---

## 코드 품질 도구

### ESLint 주요 규칙

- `@typescript-eslint/no-explicit-any: error` — `any` 타입 금지
- `@typescript-eslint/no-unused-vars: error` — 미사용 변수 금지 (`_` prefix 제외)
- `@typescript-eslint/explicit-function-return-type: warn` — 함수 반환 타입 명시 권고

### Lefthook (Git 훅)

`npm install` 후 `npx lefthook install` 실행 시 활성화됩니다.
`git commit` 전 자동으로 lint + typecheck를 실행합니다.

```yaml
# lefthook.yml 요약
pre-commit:
  - npm run lint
  - npm run typecheck
```

---

## 빌드 설정 원리

MV3는 컴포넌트마다 다른 모듈 형식이 필요하므로 Vite 설정을 3개로 분리합니다.

| 컴포넌트 | 출력 형식 | 이유 |
|---------|----------|------|
| Popup | Vite 기본 (HTML entry) | 일반 웹앱과 동일, ESM 지원 |
| Background | `lib` 모드, `formats: ['es']` | MV3 Service Worker는 ESM 지원 |
| Content Script | `lib` 모드, `formats: ['iife']` | Content Script는 ESM `import` 불가 |

모든 설정에서 `@shared` 경로 별칭을 `src/shared/`로 해석합니다.

### 전체 빌드 순서 (`scripts/build.mjs`)

```
1. dist/ 초기화 (rmSync)
2. Popup 빌드 → dist/popup/
3. Background 빌드 → dist/background.js
4. Content Script 빌드 → dist/content.js
5. manifest.json 복사 → dist/
6. public/icons/ 복사 → dist/icons/
```

---

## 알려진 한계 & TODO

- **`fetchCurrentPrice()` 미구현** — 쇼핑몰별 가격 파싱 로직 추가 필요 (`src/background/sites/`)
- **Content Script Generic Detector** — Schema.org 마크업이 없는 사이트에서 오감지 가능. 전용 Detector 추가로 개선
- **SPA 감지** — `MutationObserver`로 URL 변경을 감지하지만, hash-only 변경은 미처리
- **가격 이력 UI** — 팝업에 가격 변동 그래프 미구현
- **아이콘 파일** — `public/icons/`에 실제 PNG 아이콘 추가 필요
