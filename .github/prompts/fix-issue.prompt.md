---
description: "Price Guard의 버그·문제를 수정. 오류 수정, 로직 버그, 타입 문제, 테스트 실패 등에 사용"
argument-hint: "수정할 문제 설명 (예: 쿠팡 가격 파싱 오류, 알림이 중복 발송됨, 스토리지 저장 실패)"
agent: "agent"
tools: ["codebase", "search", "editFiles", "runCommands"]
---

Price Guard Chrome 확장프로그램에서 다음 문제를 수정해 주세요: $ARGUMENTS

## 컨텍스트 파일

수정 전 아래 파일을 반드시 읽으세요:

- [.github/copilot-instructions.md](../copilot-instructions.md) — 프로젝트 규칙
- [src/shared/types.ts](../../src/shared/types.ts) — 공유 타입
- 문제와 관련된 소스 파일 및 테스트 파일

## 수정 절차

### 1단계 — 문제 분석
- 관련 코드 및 테스트 파일 탐색
- 문제의 근본 원인 파악
- 수정 범위 결정 (최소 변경 원칙 준수)

### 2단계 — 수정 구현
- TypeScript strict — `any` 타입 금지, `unknown` + 타입 가드 사용
- 기존 패턴 준수 (의존성 주입, named export)
- 사용자 노출 문자열은 한국어
- 에러는 `try/catch` + `console.error` 처리
- 수정으로 인해 다른 기능이 깨지지 않도록 주의

### 3단계 — 진단 서브에이전트 실행 (필수)
수정 완료 후 `Explore` 서브에이전트를 호출하여 아래 항목을 검토:
- 수정 내용이 문제 원인을 올바르게 해결했는지
- 기존 코드와 충돌이 없는지
- 누락된 연결(import, 라우팅, 타입 등)은 없는지
- 서브에이전트 리포트에서 문제 발견 시 즉시 재수정

### 4단계 — 전체 테스트 실행 (필수, lefthook 기준)
아래 세 가지를 **순서대로** 모두 실행하여 에러가 0개임을 확인:

```bash
npm run typecheck   # TypeScript 컴파일 에러 검사
npm run lint        # ESLint 에러 검사
npm test            # Vitest 단위 테스트 전체 실행
```

- 실패한 테스트가 있으면 즉시 수정 후 재실행
- 세 단계 모두 통과해야 작업 완료

## 수정 체크리스트

- [ ] 문제 근본 원인 파악 완료
- [ ] 최소 변경으로 수정 (불필요한 리팩터링 금지)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과
- [ ] `npm test` 전체 통과
- [ ] `Explore` 서브에이전트 검토 완료 및 지적 사항 반영
