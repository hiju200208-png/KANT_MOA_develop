# 발표자료 P3 (여름) — 장바구니·배송지·주문·모의 결제·취소

> 팀 발표자료(PPT/PDF)에 옮길 P3 부분 초안. 숫자는 모두 실제 실행 결과 ([작업일지](../worklog/YEOREUM.md)).

## 슬라이드 1. 인수 당시 → 지금

| | 인수 당시 (3조) | 지금 (2조) |
|---|---|---|
| 장바구니·주문·배송지 | Supabase 테이블 직접 조회 + RPC(`create_order`·`pay_order`·`cancel_order`·`merge_cart`·`set_default_address`), RLS로 권한 | FastAPI `orders/` 4계층 + 로컬 Docker PostgreSQL |
| 재고 차감 | DB 함수 안 조건부 UPDATE | P2 `decrease_stock`/`increase_stock` + `FOR UPDATE` 잠금, 서비스가 commit/rollback |
| 권한 | RLS (DB가 판단) | JWT `get_current_user` + 서버 소유권 검사(403) |
| 검증 | 화면 수동 확인 | 자동 테스트 221개(실제 DB 동시성 포함), CI 필수 검사, 화면 E2E + DB 증거 |

## 슬라이드 2. 구조와 요청 흐름

```
주문서 화면 → services/orders.ts → POST /orders/{id}/pay
  → presentation(order_router: 요청 검증·예외→HTTP)
  → application(OrderService.pay: 잠금 → 규칙 → 저장 → commit / 실패 시 rollback)
  → domain(Order.pay 상태 전이, ensure_payable 판매 상태·구매 제한)
  → infrastructure(OrderRepository, P2 ProductRepository) → PostgreSQL
```

- 잠금 순서 통일: users 행 → orders 행 → 옵션 id 오름차순 (데드락 방지)
- 도메인은 FastAPI·SQLAlchemy·Pydantic을 import하지 않음 → DB 없이 규칙 테스트

## 슬라이드 3. 업무 규칙

- 주문 생성: 장바구니 전체를 pending으로, 재고는 그대로. 가격·배송비는 서버가 DB 값으로 계산 (5만 원 미만 +3,000원)
- 결제: 판매 상태·1인 구매 제한 재확인 → 재고 차감 → paid → 결제된 옵션만 장바구니에서 제거. 중간 실패 시 전부 원래대로
- 취소: pending은 상태만, paid는 재고 복구. 이미 취소면 409 `ALREADY_CANCELLED`
- 상태 전이: pending → paid / cancelled, paid → cancelled만

## 슬라이드 4. 시연 순서 (화면 + Swagger + 블랙리스트 401)

1. 비회원으로 포토카드 담기 → 장바구니 합계·배송비
2. 로그인 → 장바구니 자동 병합 (DB `cart_items` 행 보여주기)
3. 주문서 결제 → 결제 완료 → **DB 재고 100 → 98**
4. 새로고침 → 그대로 / 주문 취소 → **재고 98 → 100**
5. 응원봉 5개 바로 구매 → "옵션당 구매 가능 수량을 초과했어요" (409, 주문 안 생김)
6. Swagger: Authorize → 남의 주문 조회 403, 재고 1개 동시 결제는 테스트 결과로 (한 명만 성공)
7. 로그아웃 → 같은 토큰으로 `GET /orders` → **401** (블랙리스트)

## 슬라이드 5. 트러블슈팅

- 동시 요청: 잠금을 빼고 돌려 보니 이중 결제·장바구니 수량 유실이 실제로 재현 → 잠금 순서 통일로 해결, 테스트로 고정
- PC마다 다른 테스트 결과 → CI에 백엔드 검사 추가, push 전 같은 조건 검사(`check.py`·git hook), main 브랜치 보호
- 프론트 로그인이 Supabase라 화면에서 토큰이 안 생김 → 로그인·로그아웃·내 정보 전환 PR(#64), P1 리뷰

## 슬라이드 6. 회고 (본인 작성)

- 잘한 점:
- 아쉬운 점:
- 다음에 하고 싶은 것:
