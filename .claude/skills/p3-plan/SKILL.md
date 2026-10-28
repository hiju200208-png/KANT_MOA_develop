---
name: p3-plan
description: P3(여름) 기능을 코드 쓰기 전에 계획할 때 사용한다. 새 API·업무 규칙·재고/주문 흐름 변경처럼 여러 파일을 바꾸는 작업이면 먼저 4계층 단위 작업 목록과 검증 방법을 정한다.
---

# P3 계획 세우기

> 출처: [obra/superpowers](https://github.com/obra/superpowers) `writing-plans` + `brainstorming` (commit `2ce8aa1`, MIT). 2조 P3에 맞게 줄이고 바꿨다.
> 우선순위: `CLAUDE.md`·`docs/PROJECT2.md` > `code-rules` > `p3-orders` > 이 파일. 충돌하면 위를 따른다.

## 언제
- 파일 2개 이상, 또는 재고·주문 상태·결제·취소를 건드리는 작업은 **코드보다 계획이 먼저**다.
- 한두 줄 수정·오타는 계획 없이 바로 한다.

## 1. 먼저 아는 것과 모르는 것을 나눈다
- 근거 문서를 먼저 읽는다: `p3-orders` 3~6장, `docs/API_SPEC.md` 4·5·5-1장, P2 재고 계약(`docs/products/P2_STOCK_REPOSITORY.md` 2장).
- 이미 있는 코드를 먼저 본다(`backend/src/orders/`). 같은 일을 하는 함수가 있으면 재사용한다.
- 문서로 답이 안 나오는 것만 사용자에게 묻는다. `p3-orders` 6장의 미확정 항목은 임의로 정하지 않는다.
- 다른 담당 파일(P1 `auth/`·`core/`·`main.py`, P2 `products/`, P4 `admin/`)을 바꿔야 하면 계획 단계에서 담당자 협의 항목으로 적는다.

## 2. 범위 확인
- 서로 독립된 기능 둘 이상이면 계획을 나눈다(예: 장바구니 / 주문). 한 PR에 한 기능.
- 스키마 변경·시드 덮어쓰기·테이블 자동 생성은 계획에 넣지 않는다(책임자 승인 사항).

## 3. 계획 문서 모양
```markdown
# <기능> 구현 계획
목표: 한 문장
근거: p3-orders N장, API_SPEC N장 (파일:줄)
제약: 재고는 P2 함수로만 / 잠금 순서 users → orders → 옵션 id 오름차순 / 서비스가 commit·rollback
미확정: (있으면) 누구에게 확인할지

## 작업 1: [domain] <규칙 이름>
파일: backend/src/orders/domain/<파일>.py, tests/orders/test_<…>_domain.py
- [ ] 실패하는 도메인 테스트 작성 → 실패 확인 (p3-tdd)
- [ ] 최소 구현 → 통과 확인
## 작업 2: [infrastructure] …
## 작업 3: [application] …  (rollback 경로 테스트 포함)
## 작업 4: [presentation] …  (401·403·404·409·422 응답 code 테스트)
## 작업 5: 실제 DB 검증  (P3_RUN_POSTGRES_TESTS=1, 동시성·rollback)
## 작업 6: 화면 + DB 증거 확인 (p3-verification)
```

## 4. 작업 크기
- 한 작업 = 한 계층 또는 한 규칙. 각 단계는 "실행하면 확인 가능한 결과"가 있어야 한다(테스트 통과, 응답 코드, DB 값).
- 순서는 안쪽부터: domain → infrastructure → application → presentation → DB 통합.

## 5. 스스로 점검
- 모든 업무 규칙에 근거(파일:줄)가 붙었는가?
- 실패 경로(남의 데이터 403, 없음 404, 규칙 위반 409, 입력 422)와 rollback·동시성 테스트가 작업에 들어 있는가?
- 공통 파일·다른 담당 폴더 변경이 협의 항목으로 빠짐없이 적혔는가?

계획이 정해지면 사용자에게 보여주고 동의를 받은 뒤 `p3-tdd`로 구현한다.
