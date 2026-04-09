# 가격파수꾼 (Price Guard)

쇼핑몰 상품 가격을 추적하고, 목표가 도달 또는 가격 하락 시 Chrome 알림을 보내는 **Manifest V3** 기반 크롬 확장프로그램입니다.

---

## 목차

1. [주요 기능](#주요-기능)
2. [사용법](#사용법)
3. [기술 스택](#기술-스택)
4. [프로젝트 구조](#프로젝트-구조)
5. [아키텍처 개요](#아키텍처-개요)
6. [개발 환경 설정](#개발-환경-설정)
7. [빌드 & 로드](#빌드--로드)
8. [개발 명령어](#개발-명령어)
9. [데이터 모델](#데이터-모델)
10. [컴포넌트 상세](#컴포넌트-상세)
11. [테스트 모드 (DevTools)](#테스트-모드-devtools)
12. [새 쇼핑몰 지원 추가](#새-쇼핑몰-지원-추가)
13. [백그라운드 가격 조회 구현](#백그라운드-가격-조회-구현)
14. [메시지 통신 구조](#메시지-통신-구조)
15. [테스트](#테스트)
16. [코드 품질 도구](#코드-품질-도구)
17. [빌드 설정 원리](#빌드-설정-원리)
18. [알려진 한계 & TODO](#알려진-한계--todo)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 자동 상품 감지 | 쇼핑몰 상품 페이지 방문 시 자동으로 상품 정보(이름, 가격, 이미지) 감지 |
| 아이콘 배지 | 추적 가능 페이지에서 확장프로그램 아이콘에 배지 표시, 이탈 시 자동 제거 |
| 추적 등록 패널 | 화면 플로팅 패널에서 목표가 설정 후 "추적 시작" 클릭으로 등록 |
| FAB 위치 설정 | 플로팅 버튼 위치를 4곳(좌하단·우하단·좌상단·우상단) 중 선택 가능 |
| 일일 가격 체크 | 백그라운드 서비스 워커가 24시간마다 자동으로 가격 확인 |
| Chrome 알림 | 목표가 달성 또는 가격 하락 시 시스템 알림 발송 |
| 팝업 관리 | 확장프로그램 팝업에서 추적 목록 조회, 삭제, 수동 가격 확인 |
| 가격 이력 | 상품별 가격 변동 이력 저장 (`priceHistory`) |

---

## 사용법

### 1. 상품 추적 시작

1. **쿠팡** 또는 **네이버 스마트스토어** 상품 페이지로 이동합니다.
2. 확장프로그램 아이콘에 배지(`!`)가 표시되면 상품이 감지된 것입니다.
3. 화면 하단에 나타나는 **플로팅 패널**에서 목표가를 입력합니다.
   - **목표가** — 이 가격 이하로 내려가면 알림을 받습니다. (비워두면 미설정)
   - **가격 하락 시 알림** — 체크하면 이전 가격보다 내려갈 때마다 알림을 받습니다.
4. **추적 시작** 버튼을 클릭하면 등록 완료입니다.

### 2. 추적 목록 확인

확장프로그램 아이콘을 클릭하면 팝업이 열립니다.

- **추적 상품 목록** — 등록된 상품과 현재가를 확인합니다.
- **지금 확인** — 수동으로 즉시 가격을 조회합니다.
- **삭제** — 상품 카드의 삭제 버튼으로 추적을 중단합니다.
- **설정(⚙)** — 클릭하면 FAB 위치 설정 패널이 열립니다.

### 3. FAB 위치 변경

팝업의 ⚙ 버튼을 누르면 설정 패널에서 플로팅 버튼 위치를 선택할 수 있습니다.

| 옵션 | 설명 |
|------|------|
| 좌하단 *(기본값)* | 화면 왼쪽 아래 |
| 우하단 | 화면 오른쪽 아래 |
| 좌상단 | 화면 왼쪽 위 |
| 우상단 | 화면 오른쪽 위 |

### 4. 알림 수신

가격 체크는 매일 자동으로 실행됩니다. 아래 조건이 맞으면 Chrome 시스템 알림이 발송됩니다.

| 조건 | 알림 제목 |
|------|---------|
| 현재가 ≤ 목표가 | `가격파수꾼 — 목표가 달성! 🎉` |
| 현재가 < 이전 가격 (가격 하락 알림 ON) | `가격파수꾼 — 가격 하락! 📉` |

---

## 기술 스택

- **TypeScript** (strict 모드) — 전 소스 타입 안전 보장
- **Vite** — popup / background / content script / devtools 각각 별도 빌드
- **Vitest** + **jsdom** — 단위 테스트
- **Puppeteer 22** — E2E 테스트
- **ESLint** (typescript-eslint) — 코드 린팅
- **Prettier** — 코드 포맷
- **Lefthook** — Git 훅 (pre-commit: lint + typecheck + test)
- **Chrome Extensions Manifest V3**

---

## 프로젝트 구조

```
price-guard/
├── manifest.json               # 확장프로그램 선언 (MV3)
├── package.json
├── tsconfig.json               # 소스 코드용 TS 설정
├── tsconfig.node.json          # 빌드 스크립트용 TS 설정
├── tsconfig.e2e.json           # E2E 테스트용 TS 설정
├── vite.config.ts              # Popup 빌드
├── vite.background.config.ts   # Background Service Worker 빌드 (ESM)
├── vite.content.config.ts      # Content Script 빌드 (IIFE)
├── vite.devtools.config.ts     # DevTools 페이지 빌드
├── vitest.config.ts            # 단위 테스트 설정
├── vitest.e2e.config.ts        # E2E 테스트 설정
├── eslint.config.js
├── lefthook.yml                # Git 훅 설정
├── scripts/
│   └── build.mjs               # 전체 빌드 오케스트레이터
├── public/
│   └── icons/                  # 확장프로그램 아이콘
├── src/
│   ├── shared/                 # 브라우저 API 없는 순수 TS
│   │   ├── types.ts            # 공통 타입 정의
│   │   ├── constants.ts        # 상수 (알람명, 스토리지 키, 알림 메시지 등)
│   │   └── storage.ts          # chrome.storage.local 추상화
│   ├── background/             # Service Worker (DOM 사용 불가)
│   │   ├── index.ts            # 진입점: 알람 등록, 메시지 핸들러
│   │   ├── alarm-manager.ts    # chrome.alarms 등록/감지
│   │   ├── notifier.ts         # chrome.notifications 발송
│   │   └── sites/              # 쇼핑몰별 가격 파싱 (fetch + 정규식)
│   │       ├── coupang.ts
│   │       └── naver-smartstore.ts
│   ├── content/                # Content Script (DOM + chrome API)
│   │   ├── index.ts            # 진입점: 감지 실행, SPA 내비게이션 감시
│   │   ├── detector.ts         # SiteDetector 인터페이스 + Generic Detector
│   │   ├── register-panel.ts   # 등록 플로팅 패널 UI + 스타일
│   │   └── sites/              # 쇼핑몰별 Detector 구현
│   │       ├── coupang.ts
│   │       └── naver-smartstore.ts
│   ├── popup/
│   │   ├── index.html          # 팝업 HTML + 스타일
│   │   └── main.ts             # 팝업 로직
│   └── devtools/               # 테스트 모드 (개발용 전용 페이지)
│       ├── index.html          # 테스트 모드 UI
│       └── main.ts             # 테스트 모드 로직
└── tests/
    ├── setup.ts                # Vitest 전역 설정 (chrome API mock)
    ├── unit/
    │   ├── background/
    │   │   ├── alarm-manager.test.ts
    │   │   ├── badge.test.ts
    │   │   ├── message-handlers.test.ts
    │   │   ├── notifier.test.ts
    │   │   └── sites/
    │   │       └── naver-smartstore.test.ts
    │   ├── content/
    │   │   ├── detector.test.ts
    │   │   ├── register-panel.test.ts
    │   │   └── sites/
    │   │       ├── coupang.test.ts
    │   │       └── naver-smartstore.test.ts
    │   ├── popup/
    │   │   └── settings.test.ts
    │   └── shared/
    │       └── storage.test.ts
    └── e2e/
        ├── helpers/
        │   └── extension.ts    # Puppeteer 실행 헬퍼 (launchWithExtension)
        ├── popup.test.ts        # 팝업 E2E 테스트
        └── devtools.test.ts    # 테스트 모드 E2E 테스트
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
└────────────────────────┬────────────────────────────────┘
                         │ chrome.runtime.sendMessage
         ┌───────────────┴──────────────────┐
         │                                  │
┌────────▼────────────┐         ┌───────────▼──────────────┐
│  Popup              │         │  DevTools (테스트 모드)   │
│  popup/index.html   │         │  devtools/index.html      │
│  목록 조회/삭제/    │         │  데이터 직접 조작,        │
│  수동 가격 확인     │         │  시나리오 프리셋          │
└─────────────────────┘         └──────────────────────────┘

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

# Git 훅 활성화 (pre-commit: lint + typecheck + test)
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
├── background.js          # Service Worker
├── content.js             # Content Script
├── icons/
├── popup/
│   ├── index.html
│   └── main.js
└── devtools/
    ├── index.html         # 테스트 모드 페이지
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
# 빌드
npm run build             # 전체 빌드 (dist/ 생성)
npm run build:popup       # Popup만 빌드
npm run build:background  # Background만 빌드
npm run build:content     # Content Script만 빌드

# 테스트
npm test                  # 단위 테스트 1회 실행 (94개)
npm run test:watch        # 테스트 감시 모드
npm run test:coverage     # 커버리지 포함 테스트
npm run test:e2e          # E2E 테스트 (빌드 후 Puppeteer 실행)

# 코드 품질
npm run typecheck         # TypeScript 타입 검사 (src + scripts + e2e)
npm run lint              # ESLint 검사
npm run lint:fix          # ESLint 자동 수정
npm run format            # Prettier 포맷 적용
npm run format:check      # Prettier 포맷 검사
```

---

## 데이터 모델

### `TrackedProduct` — `chrome.storage.local`에 배열로 저장

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
  priceHistory: PriceRecord[]; // { price: number; timestamp: number }[]
}
```

### `FabPosition`

```typescript
type FabPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
```

### 스토리지 키

```typescript
// src/shared/constants.ts
STORAGE_KEYS.PRODUCTS      = 'price_guard_products'
STORAGE_KEYS.FAB_POSITION  = 'price_guard_fab_position'

DEFAULT_FAB_POSITION = 'bottom-left'
```

---

## 컴포넌트 상세

### `src/shared/storage.ts` — StorageService

`chrome.storage.local`을 감싸는 추상화 레이어. 테스트 시 mock으로 교체 가능합니다.

```typescript
const storage = createStorageService();
await storage.getProducts();
await storage.saveProduct(product);   // URL 중복 시 덮어씀
await storage.removeProduct(id);
await storage.updateProduct(product); // id 기반 교체
```

### `src/background/alarm-manager.ts` — AlarmManager

```typescript
await registerDailyAlarm();
onAlarmFired(ALARM_NAMES.DAILY_PRICE_CHECK, checkAllPrices);
```

- 알람 주기: `ALARM_PERIOD_MINUTES = 24 * 60` (분)
- 최초 발화 지연: `delayInMinutes: 1`

### `src/background/notifier.ts` — Notifier

```typescript
notifyTargetPriceMet(product);              // 목표가 달성 알림
notifyPriceDropped(product, previousPrice); // 가격 하락 알림
```

알림 ID 규칙:

| 유형 | ID 형식 | 예시 |
|------|---------|------|
| 목표가 달성 | `target_<id>` | `target_abc123` |
| 가격 하락 | `drop_<id>_<timestamp>` | `drop_abc123_1700000000` |

### `src/content/detector.ts` — SiteDetector 인터페이스

```typescript
export interface SiteDetector {
  isProductPage(): boolean;
  extractProduct(): DetectedProduct | null;
}
```

Generic Detector는 Schema.org 마크업과 공통 CSS 클래스(`.price`, `[itemprop="price"]` 등)로 감지합니다.
쇼핑몰 전용 Detector는 `src/content/sites/`에 추가합니다.

### `src/content/register-panel.ts` — 등록 패널

- `showRegisterPanel(product)` — 플로팅 패널 생성 (중복 생성 방지)
- `hideRegisterPanel()` — 패널 제거
- `showTrackingFab(product)` — "추적 중" FAB 표시
- 등록 버튼 클릭 → `chrome.runtime.sendMessage({ type: 'PRODUCT_REGISTER', payload })`
- FAB 위치: `chrome.storage.local`에서 읽어 적용, `onChanged` 리스너로 실시간 반영

---

## 테스트 모드 (DevTools)

개발 전용 페이지로, `chrome.storage.local` 데이터를 자유롭게 조작해 확장프로그램의 모든 UI 상태를 확인할 수 있습니다.

### 열기

팝업 우측 상단의 🛠 버튼을 클릭합니다. 새 탭에서 `devtools/index.html` 페이지가 열립니다.

### 기능

#### 시나리오 프리셋

버튼 하나로 스토리지에 테스트 데이터를 주입합니다. 팝업 또는 상품 페이지를 새로고침하면 해당 상태가 반영됩니다.

| 프리셋 | 설명 |
|--------|------|
| 비어있음 | 등록 상품 0개 |
| 일반 추적 중 | 목표가 미달 상품 1개 (쿠팡, Sony WH-1000XM5) |
| 가격 하락 중 | 단계적으로 가격이 내려가는 상품 1개 (네이버, AirPods Pro 2) |
| 목표가 달성 | 현재가 ≤ 목표가 상품 1개 (🎯 배지) |
| 역대 최저 | 30일 이력 중 최저가에 도달한 상품 1개 (🏆 배지) |
| 다중 상품 | 위 4가지 + 신규 등록 상품 = 총 5개 |

#### 현재 데이터

현재 스토리지에 있는 상품 목록을 카드 형태로 표시합니다.

- 각 카드에서 **삭제** 또는 **이력 추가** (임의 가격을 직접 삽입) 가능
- 🎯 목표가 도달 / 🏆 역대 최저 배지 표시

#### 상품 직접 추가

상품명, URL, 현재가, 목표가, 가격 하락 알림 ON/OFF를 입력해 직접 등록합니다.

#### FAB 아이콘 위치

4개 타일 클릭으로 `price_guard_fab_position` 값을 변경합니다. `content.js`가 로드된 탭을 새로고침하면 즉시 적용됩니다.

#### 위험 구역

**전체 삭제** 버튼으로 `price_guard_products`를 비웁니다. 확인 없이 즉시 실행되므로 주의하세요.

---

## 새 쇼핑몰 지원 추가

Generic Detector가 인식하지 못하는 쇼핑몰은 전용 Detector를 작성합니다.

### 1단계 — Content Detector 파일 생성

`src/content/sites/<쇼핑몰명>.ts`:

```typescript
import type { SiteDetector, DetectedProduct } from '../detector.js';

export function createExampleDetector(doc: Document, url: string): SiteDetector {
  return {
    isProductPage(): boolean {
      return url.includes('example.com/products/');
    },
    extractProduct(): DetectedProduct | null {
      if (!this.isProductPage()) return null;
      const name = doc.querySelector('h1.product-name')?.textContent?.trim() ?? null;
      const priceText = doc.querySelector('.sale-price')?.textContent ?? null;
      if (!name || !priceText) return null;
      const price = Number(priceText.replace(/[^0-9]/g, ''));
      if (!price) return null;
      const imageUrl =
        doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';
      return { name, price, imageUrl, url };
    },
  };
}
```

### 2단계 — `src/content/index.ts`에 라우팅 추가

```typescript
import { createExampleDetector } from './sites/example.js';

const detector = url.includes('example.com')
  ? createExampleDetector(document, url)
  : createGenericDetector(document, url);
```

### 3단계 — 백그라운드 가격 파싱 추가

`src/background/sites/example.ts`:

```typescript
export async function fetchExamplePrice(url: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();
    // Service Worker에서 DOMParser 사용 불가 → 정규식으로 파싱
    const match = html.match(/"salePrice"\s*:\s*(\d+)/);
    return match?.[1] ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
```

`src/background/index.ts`의 `fetchCurrentPrice()`에 라우팅 추가:

```typescript
async function fetchCurrentPrice(url: string): Promise<number | null> {
  if (url.includes('coupang.com'))       return fetchCoupangPrice(url);
  if (url.includes('smartstore.naver'))  return fetchNaverPrice(url);
  if (url.includes('example.com'))       return fetchExamplePrice(url);
  return null;
}
```

### 4단계 — 테스트 작성

`tests/unit/content/sites/example.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createExampleDetector } from '../../../../src/content/sites/example.js';

describe('ExampleDetector', () => {
  let doc: Document;
  const url = 'https://example.com/products/123';

  beforeEach(() => {
    const dom = new JSDOM(`
      <h1 class="product-name">테스트 상품</h1>
      <span class="sale-price">29,900원</span>
      <meta property="og:image" content="https://example.com/img.jpg" />
    `);
    doc = dom.window.document;
  });

  it('상품 페이지를 감지한다', () => {
    expect(createExampleDetector(doc, url).isProductPage()).toBe(true);
  });

  it('상품명과 가격을 추출한다', () => {
    const product = createExampleDetector(doc, url).extractProduct();
    expect(product?.name).toBe('테스트 상품');
    expect(product?.price).toBe(29900);
  });
});
```

---

## 백그라운드 가격 조회 구현

`src/background/index.ts`의 `fetchCurrentPrice()`가 라우팅 진입점입니다.
실제 가격은 쇼핑몰별 fetch + 정규식 파싱으로 가져옵니다.

> **주의:** Background Service Worker는 `document`, `DOMParser`를 사용할 수 없습니다.
> HTML 파싱이 필요하면 정규식 또는 JSON API 응답을 활용하세요.

현재 구현된 쇼핑몰:

| 쇼핑몰 | 파일 | 파싱 키 |
|--------|------|---------|
| 쿠팡 | `src/background/sites/coupang.ts` | `"finalPrice"` |
| 네이버 스마트스토어 | `src/background/sites/naver-smartstore.ts` | `"salePrice"` |

---

## 메시지 통신 구조

Content Script / Popup / DevTools → Background 방향의 단방향 요청-응답 패턴입니다.

| `type` | 발신 | 설명 | `payload` |
|--------|------|------|-----------|
| `PRODUCT_REGISTER` | Content Script | 상품 등록 | `ProductRegisterPayload` |
| `PRODUCT_REMOVE` | Popup | 상품 삭제 | `string` (id) |
| `PRODUCTS_GET` | Popup | 전체 목록 조회 | 없음 |
| `PRICE_CHECK_NOW` | Popup | 즉시 가격 확인 | 없음 |
| `PRODUCT_DETECTED` | Content Script | 상품 감지 결과 알림 → 배지 표시/제거 | `ProductDetectedPayload` |

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

### 단위 테스트 (Vitest + jsdom)

```bash
npm test                  # 전체 단위 테스트 1회 실행
npm run test:watch        # 감시 모드
npm run test:coverage     # 커버리지 리포트 (coverage/ 폴더)
```

- **환경:** jsdom — 브라우저 DOM 에뮬레이션
- **Chrome API mock:** `tests/setup.ts`에서 전 Chrome API mock 구성
- 총 **11개 테스트 파일, 94개 테스트**

#### 테스트 파일 목록

| 테스트 파일 | 내용 |
|-------------|------|
| `background/alarm-manager.test.ts` | 알람 등록, 중복 방지 |
| `background/badge.test.ts` | PRODUCT_DETECTED 배지 처리 |
| `background/message-handlers.test.ts` | 5가지 메시지 타입 처리 |
| `background/notifier.test.ts` | 목표가/할인 알림 발송 |
| `background/sites/naver-smartstore.test.ts` | 네이버 가격 파싱 |
| `content/detector.test.ts` | Generic Detector |
| `content/register-panel.test.ts` | 패널 표시/숨김, FAB 위치 |
| `content/sites/coupang.test.ts` | 쿠팡 상품 추출 |
| `content/sites/naver-smartstore.test.ts` | 네이버 상품 추출 |
| `popup/settings.test.ts` | FAB 위치 설정, 팝업 초기화 |
| `shared/storage.test.ts` | StorageService CRUD |

### E2E 테스트 (Puppeteer)

```bash
npm run test:e2e          # 빌드 → Puppeteer로 실제 Chrome 실행
```

- **환경:** Node.js + 실제 Chrome (헤드리스)
- `tests/e2e/helpers/extension.ts` — `launchWithExtension()`: `dist/` 로드 후 extensionId 획득
- `tests/e2e/popup.test.ts` — 팝업 UI 요소 확인, 설정 패널 토글
- `tests/e2e/devtools.test.ts` — 프리셋 로드, 상품 추가/삭제, 위치 타일

> E2E는 `npm test`에 포함되지 않습니다. 빌드된 `dist/`가 필요하므로 별도로 실행합니다.

---

## 코드 품질 도구

### Zero-error 정책

코드 작성·수정 후 반드시 아래 세 단계를 순서대로 실행합니다. 에러가 있으면 즉시 수정합니다.

```bash
npm run typecheck   # TS 컴파일 에러 (0개 필수)
npm run lint        # ESLint 에러 (0개 필수)
npm test            # Vitest 단위 테스트 (전부 통과 필수)
```

### ESLint 주요 규칙

| 규칙 | 설명 |
|------|------|
| `no-explicit-any: error` | `any` 타입 금지 |
| `no-unused-vars: error` | 미사용 변수 금지 (`_` prefix 제외) |
| `no-floating-promises: error` | `void` 없이 Promise 반환 금지 |
| `explicit-function-return-type: warn` | 함수 반환 타입 명시 권고 |

흔한 ESLint 에러 패턴:

```typescript
// ❌ no-floating-promises
chrome.action.setBadgeText({ text: '!' });

// ✅ void로 명시
void chrome.action.setBadgeText({ text: '!' });
```

### Lefthook (Git 훅)

`npx lefthook install` 실행 시 활성화됩니다.
`git commit` 전 자동으로 lint → typecheck → test 를 순서대로 실행합니다.

---

## 빌드 설정 원리

MV3는 컴포넌트마다 다른 모듈 형식이 필요하므로 Vite 설정을 4개로 분리합니다.

| 컴포넌트 | 설정 파일 | 출력 형식 | 이유 |
|---------|----------|----------|------|
| Popup | `vite.config.ts` | HTML entry (ESM) | 일반 웹앱과 동일 |
| Background | `vite.background.config.ts` | `lib` / `es` | MV3 SW는 ESM 지원 |
| Content Script | `vite.content.config.ts` | `lib` / `iife` | Content Script는 ESM import 불가 |
| DevTools | `vite.devtools.config.ts` | HTML entry (ESM) | Popup과 동일 패턴 |

모든 설정에서 `@shared` 경로 별칭을 `src/shared/`로 해석합니다.

### 전체 빌드 순서 (`scripts/build.mjs`)

```
1. dist/ 초기화 (rmSync)
2. Popup 빌드       → dist/popup/
3. Background 빌드  → dist/background.js
4. Content 빌드     → dist/content.js
5. DevTools 빌드    → dist/devtools/
6. manifest.json 복사 → dist/
7. public/icons/ 복사 → dist/icons/
```

---

## 알려진 한계 & TODO

- **SPA 감지** — `MutationObserver`로 URL 변경을 감지하지만, hash-only 변경은 미처리
- **가격 이력 UI** — 팝업에 가격 변동 그래프 미구현
- **아이콘 파일** — `public/icons/`에 실제 PNG 아이콘 추가 필요
- **쇼핑몰 확대** — 현재 쿠팡·네이버 스마트스토어 지원. 추가 쇼핑몰은 [새 쇼핑몰 지원 추가](#새-쇼핑몰-지원-추가) 참고
