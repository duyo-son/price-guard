# Price Guard — Copilot Instructions

## 프로젝트 개요
Price Guard는 Chrome Extension (Manifest V3) 기반의 쇼핑몰 가격 추적기입니다.
상품 페이지 방문 시 상품을 등록하고, 매일 가격을 확인하여 목표가/할인 발생 시 Chrome 알림을 전송합니다.

## 아키텍처

### Extension 구성 요소

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| Background Service Worker | `src/background/` | 알람 스케줄링, 가격 확인, 알림 발송 |
| Content Script | `src/content/` | 상품 페이지 감지, 등록 패널 UI |
| Popup | `src/popup/` | 추적 목록 조회, 수동 확인 |
| Shared | `src/shared/` | 타입, 스토리지, 상수 |

### 사용 Chrome API
- `chrome.storage.local` — 상품 데이터 영속 저장
- `chrome.alarms` — 일일 가격 체크 스케줄링
- `chrome.notifications` — 가격 알림
- `chrome.runtime.sendMessage` — 컴포넌트 간 통신

## 개발 규칙

1. **TypeScript strict 모드** — 모든 코드 엄격 타입 적용, `any` 금지
2. **Background는 DOM 없음** — Service Worker는 `document`, `window` 사용 불가
3. **Background는 ES module**, Content Script는 **IIFE** (MV3 제약)
4. **사용자 노출 문자열은 한국어**
5. 에러는 `try/catch` + `console.error` 처리

## 새 쇼핑몰 지원 추가 방법

1. `src/content/sites/<site>.ts` 에 `SiteDetector` 인터페이스 구현
2. `src/content/index.ts` 에서 URL 패턴 매칭 후 해당 Detector 사용
3. `tests/unit/content/sites/<site>.test.ts` 단위 테스트 추가

## 빌드 & 배포

```bash
npm run build          # dist/ 빌드 (Chrome 확장프로그램으로 로드)
npm test               # Vitest 단위 테스트
npm run typecheck      # TypeScript 검사
npm run lint           # ESLint
```

`dist/` 폴더를 크롬에서 `chrome://extensions` → 개발자 모드 → 압축 해제 로드

## 파일 구조 규칙

```
src/
  background/   # Service Worker — DOM API 사용 불가
  content/      # DOM + chrome API 사용 가능
    sites/      # 쇼핑몰별 Detector 구현
  popup/        # 일반 웹앱 + chrome API
  shared/       # 순수 TypeScript, 브라우저 API 없음
tests/
  unit/         # Vitest 단위 테스트
```
