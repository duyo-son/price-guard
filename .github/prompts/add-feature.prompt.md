---
description: "Price Guard에 새 기능 또는 쇼핑몰 지원 추가. 새 사이트 Detector, 팝업 기능, 알림 로직 확장 등에 사용"
argument-hint: "추가할 기능 설명 (예: 쿠팡 상품 감지기, 팝업 가격 그래프, 알림 재알림 기능)"
agent: "agent"
tools: ["codebase", "search", "editFiles", "runCommands"]
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
- [ ] `src/background/sites/<site-name>.ts` 에 `fetch<Site>Price` 구현
- [ ] `src/content/index.ts` 에서 URL 패턴 분기 처리 (리스트 페이지 차단 포함)
- [ ] `src/background/index.ts` 의 `fetchCurrentPrice` 라우터에 패턴 추가
- [ ] `tests/unit/content/sites/<site-name>.test.ts` 작성
- [ ] 실제 상품 페이지 HTML 기반 테스트 케이스 포함

## 전체 테스트 실행 (구현 완료 후 필수 — 생략 절대 금지)

아래 세 가지를 **순서대로** 실행하고 **터미널 출력을 직접 확인**하여 에러가 0개임을 검증한다.
결과를 확인하지 않고 작업 완료를 선언하면 안 된다.

```bash
npm run typecheck   # TypeScript 컴파일 에러 검사
npm run lint        # ESLint 에러 검사
npm test            # Vitest 단위 테스트 전체 실행
```

- 실패한 테스트가 있으면 즉시 수정 후 재실행
- 세 단계 모두 통과해야 작업 완료

## 완료 체크리스트

- [ ] 문제 근본 원인 파악 완료
- [ ] 최소 변경으로 구현 (불필요한 리팩터링 금지)
- [ ] `npm run typecheck` 통과 (터미널 출력 직접 확인)
- [ ] `npm run lint` 통과 (터미널 출력 직접 확인)
- [ ] `npm test` 전체 통과 (터미널 출력 직접 확인)
