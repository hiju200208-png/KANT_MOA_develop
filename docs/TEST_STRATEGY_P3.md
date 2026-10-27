# KANT MOA P3 테스트 전략과 로컬 DB 안전 수칙 (2026-10-27 갱신)

> P3(여름) 배송지·장바구니·비회원 병합·주문·바로 구매·모의 결제·취소의 테스트 구조, 실행 방법, 검증 결과를 정리한다.
> PIXEL MART 「도구와 테스트」의 계층별 테스트 / DB 격리 / API 계약 / CI 원칙을 KANT MOA에 맞게 적용했다.
> 숫자는 모두 실제 실행 결과다. 실행하지 않은 것은 "남은 일"에 둔다.

## 현재 상태 (main 기준)

- P3 4계층 코드: `backend/src/orders/` (presentation `address_router.py` · `cart_router.py` · `order_router.py` / application `address_service.py` · `cart_service.py` · `order_service.py` / domain / infrastructure). `main.py`에 라우터 3개 등록 (#55).
- 인증: `auth.presentation.dependencies.get_current_user` (P1 실제 JWT). 남의 주문·배송지는 403 + `UNKNOWN`, 오류 본문은 `{code, message}`.
- 재고: P2 `get_variants_for_update`(옵션 id 오름차순 `FOR UPDATE`) + `decrease_stock`/`increase_stock` + `save_variant`만 쓴다. 조건부 UPDATE(옛 Supabase 방식)는 쓰지 않는다.
- 잠금 순서: users 행 → orders 행 → 옵션 id 오름차순. 서비스가 한 번 commit, 실패하면 전체 rollback.
- 프론트 `src/services/cart.ts` · `orders.ts` · `addresses.ts`는 FastAPI를 호출한다 (Supabase 호출 없음). 화면 동작은 P1 프론트 로그인이 토큰을 저장한 뒤 확인한다.

## 테스트 환경 안전 원칙 (필수)

1. 테스트는 **개인 로컬 Docker의 테스트 전용 PostgreSQL**로만 한다. 학원 서버·ngrok·공용 DB 대상으로 실패·동시성·마이그레이션 테스트를 하지 않는다.
2. `DATABASE_URL` 호스트가 localhost라는 것만으로 전용 DB가 증명되지 않는다. localhost SSH 터널이 공용 서버로 연결돼 있을 수 있으므로 **DB 이름과 Docker 포트**까지 확인한다.
3. 테이블 생성은 *새 빈 로컬 DB*에서만 한다. 공용 DB에 `alembic upgrade head`, 초기 SQL 재실행, `drop_all`을 하지 않는다. 기존 로컬 DB도 이력 확인 없이 중복 초기화하지 않는다.
4. 실제 결제 대신 모의 결제만 검증한다. 실사용 계정·전화번호·주소·토큰·DB 비밀값을 테스트 코드·로그·PR에 남기지 않는다.
5. 데이터가 사라질 수 있는 테스트는 쓰고 버리는 DB에서만 한다. P3 DB 테스트는 매번 새 컨테이너를 만들고 끝나면 지운다.
6. 테스트 옵션은 담당별로 나뉜다: P1 `P1_RUN_LOCAL_DB_TESTS`, P2 `P2_RUN_POSTGRES_TESTS`, P3 `P3_RUN_POSTGRES_TESTS`, P4 `ADMIN_DB_TEST`.

## 계층별 테스트 (`backend/tests/orders/`)

| 계층 | 파일 | 의존성 | 확인하는 것 |
|---|---|---|---|
| Domain | `test_order_status.py`, `test_checkout_domain.py`, `test_cart_domain.py`, `test_address_domain.py` | DB 없음 | 상태 전이(pending→paid/cancelled, paid→cancelled만), 수량·받는 분 검사, 배송비 기준, 구매 제한, 병합 상한, 기본 배송지 규칙 |
| Service | `test_order_service.py`, `test_cart_service.py`, `test_address_service.py` | 가짜 저장소·트랜잭션 (`conftest.py`, `order_fakes.py`) | commit 1회 / 실패 시 rollback, 잠금 순서(user → order → 옵션), 두 번째 옵션 실패 시 전체 rollback, 이중 결제·취소, 결제 직전 판매 상태·구매 제한 재확인 |
| API | `test_order_router.py`, `test_cart_router.py`, `test_address_router.py` | FastAPI TestClient + 가짜 저장소 | 상태 코드(200·201·204·401·403·404·409·422)와 오류 `code`, 응답 모양(snake_case), 로그인 불필요 API(`/cart/preview`, `/orders/shipping-policy`) |
| 실제 DB | `test_order_db.py`, `test_cart_db.py`, `test_address_db.py` | 일회용 `postgres:17` (`P3_RUN_POSTGRES_TESTS=1`) | 주문→결제→취소 재고 흐름, 결제 중간 실패 rollback, **재고 1개 동시 결제 → 한 명만 성공**, 동시 담기 수량 유실 없음, 동시 첫 배송지 → 기본 1개 |

## 실행 방법

- **push 전 전체 검사 (권장, CI와 같은 조건)**: `backend`에서 `uv run python scripts/check.py`. 쓰고 버리는 DB로 `alembic upgrade head` → 전체 pytest → P2·P3 Docker DB 테스트를 돌리고 컨테이너를 지운다. `git config core.hooksPath .githooks`를 해 두면 push 때 자동 실행된다 ([PR 가이드](PR_GUIDE.md)).
- **P3만 빠르게**: `uv run pytest tests/orders` (DB 테스트는 건너뜀)
- **P3 실제 DB 테스트**: PowerShell에서
  ```powershell
  $env:P3_RUN_POSTGRES_TESTS = "1"
  try { uv run pytest tests/orders } finally { Remove-Item Env:P3_RUN_POSTGRES_TESTS -ErrorAction SilentlyContinue }
  ```
  `kant.p3.test=true` 라벨의 임시 컨테이너를 만들고 001 SQL을 적용한 뒤 끝나면 지운다. 내 로컬 DB·공용 DB는 건드리지 않는다.

## 검증 결과 (2026-10-27)

| 구분 | 결과 |
|---|---|
| GitHub CI (#55, #60) | `backend` · `frontend` 통과 |
| `check.py` 백엔드 (마이그레이션 DB / Docker DB) | 397 passed · 70 skipped / 292 passed · 5 skipped (skip은 다음 단계에서 도는 DB 테스트, P4 로컬 전용, P2 원본 이미지 필요) |
| 실제 토큰 E2E (`main.py` + 로컬 Docker DB) | 25/25. 응답과 DB 전 → 후 값은 #55 본문에 기록 |
| 프론트 서비스 ↔ FastAPI 연동 (컴파일한 `cart.ts`·`orders.ts`·`addresses.ts`를 Node에서 실행) | 27/27. #55·#60 본문에 기록 |

## 완료 기준

- [x] main에서 실제 주문·장바구니·배송지·모의 결제 라우트 확인
- [x] 정상 및 실패·권한 시나리오 자동 테스트 보유
- [x] 실제 전용 PostgreSQL에서 API·트랜잭션·동시성 테스트 증빙
- [x] 기존 pytest 회귀 테스트 통과 (CI 필수 검사)
- [x] PR과 CI 통과 후 병합 (#55)
- [x] 브라우저 화면 E2E: 로그인 → 장바구니 병합 → 주문 → 모의 결제 → 새로고침 → 취소 → 로그아웃 401 (프론트 로그인 전환 적용 상태 — main은 #66, 결과는 [작업일지](worklog/YEOREUM.md))
- [x] main(#66) 상태로 로그인 → 비회원 장바구니 병합 화면 재확인

## AI 협업 검사 방식 (10/27)

P3 테스트는 [PR 가이드 6장](PR_GUIDE.md)의 방식으로 했다.

1. **지시문 고정**: `CLAUDE.md` → `docs/PROJECT2.md` → `code-rules` → `p3-orders` skill 순서로 규칙을 고정하고 작업마다 먼저 읽었다.
2. **통과할 때까지 반복**: 테스트 실패 → 원인 수정 → `check.py`·`pytest tests/orders` 재실행. CI 두 개가 초록색이 된 뒤에만 머지했다.
3. **검증 단계에서 놓친 것 찾기**: API_SPEC·작업 가이드·업무분장과 코드를 대조해 오류 처리 4건(detail 의미, 서버 연결 실패 시 주문 없음 오표시, 중복 삭제 404, 만료 토큰)과 화면 E2E 누락을 찾아 고쳤다.
4. **기억은 파일에**: 결과는 PR 본문·[작업일지](worklog/YEOREUM.md)·이 문서에 남겼다.
5. **판단은 사람이**: 머지, P1 파일(`auth.ts`) 변경 여부, 다른 담당자에게 보낼 요청은 여름이 결정했다. 화면 결과는 DB 값(재고·주문 상태·장바구니 행)으로 직접 확인했다.
