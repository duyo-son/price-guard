---
description: "Price Guard에 새 기능 또는 쇼핑몰 지원 추가. 새 사이트 Detector, 팝업 기능, 알림 로직 확장 등에 사용"
argument-hint: "추가할 기능 설명 (예: 쿠팡 상품 감지기, 팝업 가격 그래프, 알림 재알림 기능)"
agent: "agent"
tools: ["codebase", "search"]
---

Price Guard Chrome 확장프로그램에 다음 기능을 추가해 주세요: $ARGUMENTS

## 컨텍스트 파일

구현 전 아래 파일을 반드시 읽으세요:

- [.github/copilot-instructions.md](../copilot-instructions.md) — 프로젝트 규칙
- [src/shared/types.ts](../../src/shared/types.ts) — 공유 타입
- [src/content/detector.ts](../../src/content/detector.ts) — SiteDetector 인터페이스 패턴

## 구현 요구사항

1. TypeScript strict — `any` 타입 금지, `unknown` + 타입 가드 사용
2. `tests/unit/` 에 단위 테스트 추가 (엣지 케이스 포함)
3. 기존 패턴 준수 (의존성 주입, named export)
4. 사용자 노출 문자열은 한국어
5. 에러는 `try/catch` + `console.error` 처리

## 새 쇼핑몰 Detector 추가 체크리스트

- [ ] `src/content/sites/<site-name>.ts` 에 `SiteDetector` 구현
- [ ] `src/content/index.ts` 에서 URL 패턴 분기 처리
- [ ] `tests/unit/content/sites/<site-name>.test.ts` 작성
- [ ] 실제 상품 페이지 HTML 기반 테스트 케이스 포함
