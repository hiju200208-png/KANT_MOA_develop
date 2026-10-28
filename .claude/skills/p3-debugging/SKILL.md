---
name: p3-debugging
description: P3(여름) 작업에서 버그·테스트 실패·예상과 다른 응답(500, 잘못된 재고, 잠금 대기, rollback 안 됨)을 만났을 때 사용한다. 고치기 전에 근본 원인을 먼저 찾는다.
---

# P3 체계적 디버깅

> 출처: [obra/superpowers](https://github.com/obra/superpowers) `systematic-debugging` (commit `2ce8aa1`, MIT). 2조 4계층·PostgreSQL 환경에 맞게 바꿨다.
> 우선순위: `CLAUDE.md` > `code-rules` > `p3-orders` > 이 파일.

## 철칙
**근본 원인을 찾기 전에는 고치지 않는다.** 증상만 덮는 수정은 실패다. 급할수록 이 순서를 지킨다.

## 1단계: 원인 조사 (고치기 전에 반드시)
1. **오류를 끝까지 읽는다**: traceback의 마지막 줄만이 아니라 어느 계층(presentation/application/domain/infrastructure)에서 났는지.
2. **항상 재현되게 만든다**: 재현 안 되면 추측하지 말고 정보를 더 모은다. 재현하는 테스트를 만들면 가장 좋다.
3. **최근 변경을 본다**: `git diff`, `git log -5`, 최근 main 병합(예: P1 인증 병합 후 `JWT_SECRET` 필수화로 테스트 수집 실패).
4. **계층 경계마다 증거를 모은다**: 한 번 실행으로 어디서 끊기는지 찾는다.
   - presentation: 요청 본문·상태 코드·`{code,message}`
   - application: commit/rollback이 불렸는지
   - infrastructure: 실행된 SQL과 결과, 같은 세션을 쓰는지
   - DB: 실제 값(전→후), 잠금 상태
   ```sql
   SELECT id, stock FROM product_variants WHERE id IN (...);
   SELECT status, paid_at, cancelled_at FROM orders WHERE id = '...';
   -- 잠금 대기 확인
   SELECT pid, pg_blocking_pids(pid), wait_event_type, left(query, 80)
   FROM pg_stat_activity WHERE wait_event_type = 'Lock';
   ```
5. **잘못된 값을 거꾸로 따라간다**: 틀린 값이 어디서 왔는지 호출한 쪽으로 올라가 처음 생긴 곳을 고친다.

## 2단계: 비교
- 잘 되는 비슷한 코드를 찾는다(배송지·장바구니 서비스, P2 재고 테스트 `tests/products/test_stock_repository.py`).
- 계약 문서를 **처음부터 끝까지** 읽는다(P2 계약의 savepoint·동일 객체 저장 규칙 등). 훑어보지 않는다.
- 차이를 작은 것까지 모두 적는다.

## 3단계: 가설 하나씩
- "X 때문에 Y가 난다고 본다"를 한 문장으로 적고, 그것만 확인하는 가장 작은 변경을 한다. 여러 개를 한꺼번에 바꾸지 않는다.
- 틀리면 되돌리고 새 가설. 모르면 "모르겠다"고 말하고 사용자에게 묻는다.

## 4단계: 수정
1. 재현하는 실패 테스트를 먼저 만든다 (`p3-tdd`).
2. 원인 하나만 고친다. "고치는 김에" 다른 리팩터링을 섞지 않는다.
3. 테스트 통과 + `tests/orders` 전체 확인 + 필요하면 화면·DB 증거 (`p3-verification`).
4. **3번 고쳐도 안 되면 멈춘다.** 고칠 때마다 다른 곳에서 문제가 나면 구조 문제다. 더 고치지 말고 사용자와 구조를 다시 논의한다.

## P3에서 자주 나오는 원인
| 증상 | 먼저 볼 곳 |
|---|---|
| 테스트 수집 단계 ValidationError | `core/config.py` 필수 설정(`DATABASE_URL`, `JWT_SECRET`)이 `backend/.env`나 테스트 환경에 있는지. `scripts/check.py`는 테스트 전용 값을 넣어 준다 |
| 실패했는데 재고 일부만 바뀜 | 서비스의 try/rollback 범위, 재고·주문이 같은 세션인지 |
| `save_variant` ValueError | 잠금 조회한 같은 객체인지, commit·savepoint 뒤 재사용인지 (P2 계약 2장) |
| 동시 요청에서 대기·데드락 | 잠금 순서 users → orders → 옵션 id 오름차순이 모든 흐름에서 같은지 |
| 409 대신 500 | 도메인 예외가 아닌 예외인지, `presentation/errors.py` 매핑에 있는지 |
| 남의 데이터가 보임 | 서비스의 `ensure_owned_by` 호출 여부, user_id를 요청에서 받는지 |

## 멈춤 신호
"일단 빨리 고치고 나중에 보자", "이것저것 바꿔보자", "아마 X일 거야" → 1단계로 돌아간다.
