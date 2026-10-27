---
name: p3-verification
description: P3(여름) 작업을 "완료·통과·고쳤다"고 말하기 전, 커밋·push·PR 전에 반드시 사용한다. 새로 실행한 명령 결과와 화면 결과 + DB 증거(전 → 후 값)로만 완료를 말한다.
---

# P3 완료 전 검증

> 출처: [obra/superpowers](https://github.com/obra/superpowers) `verification-before-completion` (commit `2ce8aa1`, MIT). 2조 PR 템플릿(실제 토큰 검증 + DB 증거)과 CLAUDE.md "직접 실행·검증한 결과만 완료로 기록"에 맞게 바꿨다.
> 우선순위: `CLAUDE.md` > `code-rules` > `p3-orders` > 이 파일.

## 철칙
**지금 새로 실행한 증거 없이 완료라고 말하지 않는다.** "될 거예요", "아마", "보기엔 맞아요"는 금지 표현이다.

## 관문 (모든 완료 주장 전에)
1. 무엇이 이 주장을 증명하는가? (명령, 화면, DB 조회)
2. 그것을 **처음부터 전부** 다시 실행한다 (예전 결과 재사용 금지).
3. 출력 전체를 읽는다: 통과·실패·skipped 개수, 종료 코드.
4. 결과가 주장과 맞으면 증거와 함께 말하고, 아니면 실제 상태를 그대로 말한다.

## 주장별 필요한 증거
| 주장 | 필요한 증거 | 부족한 것 |
|---|---|---|
| 테스트 통과 | `uv run pytest` 출력의 passed/failed/skipped 숫자 | 이전 실행, "통과할 것" |
| 실제 DB 동작 | `P3_RUN_POSTGRES_TESTS=1` 실행 결과 (skipped가 아님을 확인) | 가짜 저장소 테스트만 |
| push 가능 | `uv run python scripts/check.py` (CI backend job과 같음) 통과 | 부분 테스트 |
| API 동작 | **화면 결과 + DB 증거(전 → 후)** 한 쌍 | Swagger 응답만 |
| 버그 수정 | 원래 증상 재현 테스트 통과 + 수정 되돌리면 실패하는 것 확인 | 코드 바꿨으니 됐다 |
| 요구사항 충족 | 계획·이슈를 줄별로 다시 읽고 체크 | 테스트 통과 |
| 에이전트·다른 세션 완료 | `git diff`/`git log`로 실제 변경 확인 | "완료했다"는 보고 |

## 화면 결과 + DB 증거 (전 → 후)
- 로컬 Docker DB 기준으로 한다. `backend/.env`의 `DATABASE_URL`이 localhost인지 먼저 확인한다(공용 DB에 테스트 데이터를 남기지 않는다).
- 요청 **전에** 값을 조회하고, 요청 **후에** 같은 쿼리로 다시 조회해 "전 → 후"로 적는다.
- 바뀌면 안 되는 경우(401·403·409·rollback)도 "변화 없음 (5 → 5)"처럼 전·후를 적는다.
```sql
SELECT id, stock FROM product_variants WHERE id IN (:a, :b);
SELECT status, total_price, shipping_fee, paid_at, cancelled_at FROM orders WHERE id = :order_id;
SELECT variant_id, quantity FROM cart_items WHERE user_id = :user_id ORDER BY variant_id;
SELECT count(*) FROM orders WHERE user_id = :user_id;
```
- 토큰·비밀번호·DB 접속 정보·개인정보는 증거에 적지 않는다.

PR 표 예:
| 시나리오 | 기대 응답 | 실제 응답 | DB 증거 (전 → 후) |
|---|---|---|---|
| 결제 | 200 paid | 200 paid | stock 5 → 3, orders.status pending → paid |
| 같은 주문 재결제 | 409 INVALID_ORDER | 409 | stock 3 → 3 |
| 토큰 없이 주문 | 401 NOT_AUTHENTICATED | 401 | orders 행 수 2 → 2 |
| 남의 주문 취소 | 403 UNKNOWN | 403 | orders.status paid → paid |

## 멈춤 신호
- 검증 전에 "완료!", "됐어요"라고 말하려 함
- 검증 없이 커밋·push·PR 하려 함
- skipped가 섞인 결과를 "전부 통과"라고 말하려 함
- 다른 세션·에이전트의 보고만 믿으려 함
