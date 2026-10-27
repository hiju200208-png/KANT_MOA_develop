---
name: p3-orders
description: P3(여름) 전용 규칙. backend/src/orders/ 안의 장바구니·비회원 병합·배송지·주문·바로 구매·모의 결제·취소, 재고 차감·복구 트랜잭션을 작성·수정·테스트할 때 사용한다. 항상 CLAUDE.md와 code-rules를 먼저 따르고 이 파일은 그 위에 P3 업무 규칙만 더한다.
---

# P3 주문 도메인 규칙 (여름)

## 0. 우선순위 (충돌하면 위가 이긴다)
1. `CLAUDE.md` · `docs/PROJECT2.md` — 팀 공통 계약 (4계층, 트랜잭션, 공통 API·오류·상태 코드)
2. `.claude/skills/code-rules/SKILL.md` — 공통 코딩 규칙 (한국어 주석, 계층별 규칙, 테스트)
3. `docs/products/P2_CONNECTION_CONTRACT.md`, `P2_STOCK_REPOSITORY.md` — P2 재고 연결 계약
4. **이 파일** — P3 업무 규칙
5. 이전 3조 문서·SQL (`docs/BACKEND.md`, `DB_DESIGN.md`, `API_SPEC.md`, `supabase/migrations/*`) — **정책 의미만 참고**. Supabase 구현 방식(RLS·RPC·조건부 UPDATE·`auth.uid()`)은 따르지 않는다.

테이블 구조의 원본은 `backend/sql/001_create_tables.sql`이다 (`DB_DESIGN.md`는 옛 Supabase 기준, 컬럼이 다를 수 있다).

## 1. 범위와 폴더
- 내 폴더: `backend/src/orders/` (presentation / application / domain / infrastructure), 테스트 `backend/tests/orders/`
- 내 테이블: `cart_items`, `addresses`, `orders`, `order_items` (읽기만: `users`, `products`, `product_variants`, `shop_settings`)
- 만지지 않는다: `products/`, `admin/`, `auth/`, `main.py`, `database.py`, `core/`, `compose.yaml`, 스키마 SQL. 필요하면 담당자에게 요청한다.
- 라우터를 `main.py`에 등록하는 일도 공통 파일 수정이므로 P1(희주)과 협의 후 PR로 한다.

## 2. 주문 상태 (근거: DB_DESIGN.md:151-161, BACKEND.md:60-62)
- `pending → paid`, `pending → cancelled`, `paid → cancelled` 만 허용. `cancelled`는 끝 상태.
- 허용 목록 dict는 `domain/order_status.py`의 `ALLOWED_TRANSITIONS` 하나만 쓴다. 다른 곳에 if문으로 다시 만들지 않는다.
- 상태 변경은 `Order.pay(now)` / `Order.cancel(now)`로만 한다. `cancel()`이 `True`를 주면(=paid였음) 재고를 복구한다.

## 3. 업무 흐름 규칙

### 장바구니 (근거: API_SPEC.md:186-202, BACKEND.md:208-214, DB_DESIGN.md:146)
- 한 사람·한 옵션은 한 줄 (`UNIQUE(user_id, variant_id)`). 같은 옵션을 다시 담으면 수량을 **더한다**.
- 담기·수량 변경의 재고·구매 제한 검사는 **안내용**이다. 최종 검증은 결제가 한다.
  - 회원: 장바구니 수량 + 지난 **paid** 수량 ≤ `max_per_user`, 장바구니 수량 ≤ 재고.
- 판매 중(`on_sale`)이 아닌 상품은 담을 수 없다. hidden 상품은 없는 상품처럼 다룬다.

### 비회원 병합 (근거: DB_DESIGN.md:385-428, API_SPEC.md:202)
- 입력 `[{variant_id, quantity}]`. 같은 옵션은 먼저 합친다. 수량 ≤ 0인 줄은 건너뛴다.
- 판매 중이 아니거나 없는 옵션은 오류 없이 건너뛴다.
- 담을 수 있는 최대치 = `min(재고, max_per_user)` (`max_per_user`가 null이면 재고). 서버 수량과 합친 뒤 최대치로 자른다.
- 프론트는 병합 성공 시에만 localStorage를 비운다 → 서버는 실패 시 전체 rollback.

### 배송지 (근거: API_SPEC.md:247-276, DB_DESIGN.md:741-752, 001_create_tables.sql:215-217)
- 기본 배송지는 사람당 최대 1개 (부분 유니크 인덱스). 첫 주소는 자동 기본.
- 기본 배송지 삭제 시 남은 주소 중 최신을 기본으로. 기본 변경은 "기존 해제 → 새로 지정" 순서.
- 주문과 FK 없음. 주문에는 주소 **문자열 스냅샷**을 저장한다.

### 주문 생성 (근거: DB_DESIGN.md:430-509, API_SPEC.md:208,214,219, 20261012000013_add_shipping_fee.sql)
- 현재 장바구니 **전체**를 pending 주문으로 만든다. **재고는 차감하지 않고** 장바구니도 비우지 않는다.
- 빈 장바구니 → `CART_EMPTY`. 판매 중 아님·재고 부족 → `UNAVAILABLE_ITEM`. 구매 제한 초과(사전 안내) → `PURCHASE_LIMIT_EXCEEDED`.
- 가격은 **서버가 DB 값으로 계산**한다. 클라이언트가 보낸 가격·합계를 믿지 않는다 (BACKEND.md:39).
- 상품 금액 = Σ(`price + extra_price`) × 수량. 배송비 = 상품 금액 ≥ `free_shipping_threshold`이면 0, 아니면 `shipping_fee`. 설정 행이 없으면 0.
- `orders.total_price` = 상품 금액 + 배송비, `orders.shipping_fee`에 배송비 따로 저장.
- `order_items`에 상품명·옵션명·단가를 **스냅샷**으로 저장 (BACKEND.md:45).

### 바로 구매 (근거: BACKEND.md:121, 20261013000001_add_direct_order.sql)
- 옵션 하나·수량 하나로 pending 주문 생성, `is_direct = true`. 수량 < 1 → `INVALID_ORDER`.
- 나머지 검사·배송비 계산은 주문 생성과 같다. 결제해도 **장바구니를 건드리지 않는다**.

### 모의 결제 (근거: 20261013000001_add_direct_order.sql:87-160, DB_DESIGN.md:511-591)
한 트랜잭션 안에서 이 순서로 한다.
1. 사용자 행 잠금 → 2. 본인의 **pending** 주문 행 잠금 (아니면 `INVALID_ORDER`)
3. 주문 항목 옵션을 **id 오름차순으로 한 번에** P2 `get_variants_for_update`로 잠금
4. 옵션마다 구매 제한 최종 검증: 지난 paid 수량 + 이번 수량 ≤ `max_per_user` (`PURCHASE_LIMIT_EXCEEDED`)
5. `variant.decrease_stock(q)` → 같은 Repository `save_variant` (부족 → `OUT_OF_STOCK`)
6. `Order.pay(now)`로 paid + `paid_at`
7. `is_direct = false`이면 **결제된 옵션만** 장바구니에서 삭제
8. 서비스가 한 번 commit. 중간 어디서든 실패하면 전부 rollback → 주문은 pending, 장바구니 그대로 (API_SPEC.md:216)

### 취소 (근거: DB_DESIGN.md:593-637, P2_CONNECTION_CONTRACT.md:144-156)
- 본인 주문 행 잠금 후 상태 확인. `cancelled` → `ALREADY_CANCELLED`.
- pending → 상태만 변경 (재고 그대로). paid → `order_items`의 옵션·수량만큼 **한 번** `increase_stock` 복구.
- 상품이 그 사이 hidden/sold_out이 돼도 복구는 하고 상품 status는 바꾸지 않는다.
- 상태 저장과 재고 복구는 같은 트랜잭션. 일부만 복구된 채 남지 않는다.

### 조회 (근거: API_SPEC.md:211-212, CLAUDE.md 공통 API 계약)
- 내 주문 목록은 최신순, `{items,total,page,size}` 형식과 검색·필터·페이지네이션 지원.
- 주문 상세는 본인 것만. (응답 상태 코드는 아래 6장의 확인 필요 항목 참고)

## 4. 재고·잠금 규칙 (근거: CLAUDE.md 절대 규칙·트랜잭션 계약, P2_STOCK_REPOSITORY.md:21-53)
- 재고 SQL을 직접 쓰지 않는다. 반드시 아래 P2 계약만 쓴다.
  ```python
  from products.domain.variant import ProductVariant, InvalidStock, InsufficientStock
  from products.infrastructure.repositories import ProductRepository
  repository = ProductRepository(session)          # 서비스와 같은 세션
  variants = await repository.get_variants_for_update(variant_ids)  # 중복 제거, id 오름차순 FOR UPDATE
  ```
- 반환 목록에 없는 id가 있으면 호출자(P3)가 발견해 업무를 중단·rollback한다.
- 같은 옵션이 여러 줄이면 P3가 **수량을 먼저 합친다**. Repository의 id 중복 제거는 수량 합산이 아니다.
- 요청 전체 옵션을 **한 번에** 잠근다. savepoint를 넘긴 객체나 commit/rollback 뒤 객체로 `save_variant` 하지 않는다.
- 판매 상태·구매 제한·주문 중복은 P2가 아니라 **P3 책임**이다 (P2_STOCK_REPOSITORY.md:40).
- 잠금 순서는 P3 모든 쓰기에서 통일: **users 행 → orders 행 → 옵션 id 오름차순**. 사용자 잠금은 `infrastructure/locks.py`의 `lock_user`를 쓴다. (옛 `pay_order`도 profiles → orders → variant 순서였다.)
- 옛 BACKEND.md:43의 "조건부 UPDATE로만 차감"은 Supabase 방식이다. 지금은 공통 계약(FOR UPDATE + P2 도메인 메서드)을 따른다.

## 5. 오류 코드와 상태 코드 (근거: src/services/errors.ts, error-messages.ts, PROJECT2.md:58-66, P2_CONNECTION_CONTRACT.md:158-172)
- 프론트에 있는 코드만 쓴다: `NOT_AUTHENTICATED CART_EMPTY UNAVAILABLE_ITEM PURCHASE_LIMIT_EXCEEDED OUT_OF_STOCK INVALID_ORDER ALREADY_CANCELLED UNKNOWN`. 새 코드를 만들지 않는다.
- 도메인 예외는 `code`만 들고, 상태 코드 변환은 `presentation/errors.py`의 표에서만 한다.

| 상황 | 상태 | code |
|---|---|---|
| 입력 형식 오류 (수량 0·음수 등) | 422 | UNKNOWN |
| 미로그인·토큰 거부 | 401 | NOT_AUTHENTICATED |
| 남의 주문·배송지 | 403 | UNKNOWN |
| 없는 주문·배송지·장바구니 줄 | 404 | UNKNOWN |
| 요청 옵션 누락 / 숨김 상품 | 404 | UNAVAILABLE_ITEM (현재 코드) |
| 판매 중 아님 | 409 | UNAVAILABLE_ITEM |
| 재고 부족 (P2 InsufficientStock 변환) | 409 | OUT_OF_STOCK |
| 구매 제한 초과 | 409 | PURCHASE_LIMIT_EXCEEDED |
| pending 아닌 주문 결제 | 409 | INVALID_ORDER |
| 이미 취소 | 409 | ALREADY_CANCELLED |
| 빈 장바구니로 주문 | 409 | CART_EMPTY |

- P2 `InsufficientStock`은 P3 `OutOfStock`으로, P2 `InvalidStock`은 입력 오류로 변환한다. 잠그지 않은 객체 저장 같은 `ValueError`(프로그래밍 오류)는 고객 422로 숨기지 않는다.

## 6. 아직 확정 안 된 것 (임의로 정하지 말고 표시한다)
- **남의 주문 응답**: 옛 규칙은 `INVALID_ORDER`/상세는 `null`(API_SPEC.md:212, BACKEND.md:240), 공통 규칙은 403 소유권 검사(CLAUDE.md). 현재 코드는 공통 규칙대로 403/UNKNOWN. 프론트 연결 시 화면 담당과 확인.
- **오류 `detail`(문제 옵션 id)**: 프론트 `AppError.detail`은 있지만 공통 오류 본문은 `{code,message}`뿐이다. 필드 추가는 `core/`(P1) 변경이므로 협의 전에는 넣지 않는다.
- **인증 의존성**: P1 `get_current_user`가 main에 들어오기 전까지 `presentation/dependencies.py`의 임시 의존성(항상 401)을 쓴다.
- **주문 중복 생성**: 생성 요청용 idempotency key 컬럼이 없다. 같은 order_id의 이중 결제·이중 취소만 주문 행 잠금으로 막는다 (P2_CONNECTION_CONTRACT.md:182-186).
- **방치된 pending 정리**: 범위 밖 (DB_DESIGN.md:850).

## 7. 테스트 체크리스트 (근거: BACKEND.md:227-242, code-rules 4장)
도메인은 DB 없이, 서비스·Repository는 실제 PostgreSQL로 확인한다. 공용 DB에서 테스트하지 않는다.
- [ ] 빈 장바구니 주문 → CART_EMPTY / 주문 생성 후 재고 그대로
- [ ] 결제 후 재고 정확히 차감, 결제된 옵션만 장바구니에서 빠짐 (바로 구매는 장바구니 유지)
- [ ] 같은 주문 두 번 결제 → 두 번째 INVALID_ORDER, 재고 한 번만 차감
- [ ] `max_per_user=3`: 2개 결제 후 2개 추가 결제 → PURCHASE_LIMIT_EXCEEDED. 취소 주문은 집계 제외
- [ ] 재고 1개를 두 사람이 동시 결제 → 한 명만 성공, 나머지 OUT_OF_STOCK
- [ ] 두 번째 옵션에서 실패 → 첫 옵션 재고·주문 상태·장바구니 모두 원래대로 (rollback)
- [ ] paid 취소 → 재고 복구 / pending 취소 → 재고 변화 없음 / 다시 취소 → ALREADY_CANCELLED
- [ ] 남의 order_id로 결제·취소·조회 → 403
- [ ] 병합: 서버 2개 + 비회원 2개 → 합산, 제한·재고 초과분은 잘림
- [ ] 배송비: 기준 미만 +3,000원, 이상 0원, `total_price` = 상품 + 배송비
