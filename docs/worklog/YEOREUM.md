## 2026-10-27 | P3 기능 통합·CI·프론트 서비스 전환

- 작업자: 여름 (P3) / 브랜치: `yeoreum`
- PR: [#54](https://github.com/hiju200208-png/KANT_MOA_develop/pull/54) CI·검사 도구 · [#55](https://github.com/hiju200208-png/KANT_MOA_develop/pull/55) P3 전체 · [#60](https://github.com/hiju200208-png/KANT_MOA_develop/pull/60) 배송비 안내·문서
- 작업 방식: Claude Code로 구현하고, 아래 결과는 모두 직접 실행한 명령·서버 응답·DB 조회 기준으로 기록합니다.

### 구현한 내용

- **배송지·장바구니·비회원 병합·주문·바로 구매·모의 결제·취소·조회**를 `backend/src/orders/` 4계층으로 구현했습니다.
  - 재고는 P2 `get_variants_for_update` + `decrease_stock`/`increase_stock` + `save_variant`만 사용합니다. 재고 SQL은 직접 쓰지 않았습니다.
  - 잠금 순서는 users 행 → orders 행 → 옵션 id 오름차순 `FOR UPDATE`입니다. 서비스가 한 번 commit하고, 실패하면 전체 rollback합니다.
  - 결제 직전에 판매 상태와 1인 구매 제한을 다시 확인합니다.
- 희주님 합의대로 `main.py`에 P3 라우터 3개를 등록하고, 임시 인증을 제거해 P1 `get_current_user`를 직접 씁니다. 남의 주문·배송지는 403 + `UNKNOWN`, 오류 본문은 `{code, message}`입니다.
- 로그인 없이 쓰는 API 2개를 추가했습니다: `POST /cart/preview`(비회원 장바구니·바로 구매 주문서), `GET /orders/shipping-policy`(배송비 안내).
- 프론트 `src/services/cart.ts` · `orders.ts` · `addresses.ts`와 `useShippingFee`를 Supabase에서 FastAPI로 바꿨습니다. 공통 호출부는 `src/services/api.ts`이고, 토큰은 관리자 화면과 같은 localStorage `kantmoa.accessToken`에서 읽습니다. 함수 이름·반환 모양은 유지해 화면 코드는 바꾸지 않았습니다.

### CI와 검사 도구 (#54)

- GitHub Actions에 `backend` job을 추가했습니다. CI 전용 임시 PostgreSQL에 `alembic upgrade head` → 전체 pytest → P2·P3 Docker DB 테스트 순서입니다. 기존 `frontend` job은 그대로입니다.
- `backend/scripts/check.py`: 각자 PC에서 CI와 같은 조건으로 검사합니다. 쓰고 버리는 DB를 쓰고 끝나면 지웁니다.
- `.githooks/pre-commit`(`.env` 커밋 차단), `.githooks/pre-push`(main 직접 push 차단, 바뀐 쪽만 백엔드·프론트 검사). 설치는 clone마다 `git config core.hooksPath .githooks` 한 번입니다. 안내는 [PR 가이드](../PR_GUIDE.md)에 있습니다.
- 희주님이 main 브랜치 보호를 켜서 `frontend`·`backend` CI가 통과해야 머지됩니다.

### 검증 결과

| 구분 | 결과 |
|---|---|
| GitHub CI (#54, #55, #60) | `backend` · `frontend` 통과 |
| `check.py` 백엔드 (마이그레이션 DB / Docker DB) | 397 passed · 70 skipped / 292 passed · 5 skipped |
| P3 테스트 (`tests/orders`, 실제 DB 포함) | 221 passed (동시 결제·rollback·동시 담기·동시 첫 배송지 포함) |
| 실제 토큰 E2E (`main.py` + 로컬 Docker DB) | 25/25. 응답과 DB 전 → 후 값은 #55 본문에 기록 |
| 프론트 서비스 ↔ FastAPI 연동 | 27/27 (컴파일한 서비스 코드를 Node에서 실행해 실제 서버에 요청) |

- skipped는 다음 단계에서 실행되는 DB 테스트, P4 로컬 전용 테스트, P2 원본 이미지가 필요한 테스트입니다. 통과 수에 넣지 않았습니다.
- 모든 실패·동시성 테스트는 로컬 일회용 DB에서만 실행했습니다. 공용 DB에서는 실행하지 않았습니다.
- 테스트 전략과 안전 수칙: [TEST_STRATEGY_P3.md](../TEST_STRATEGY_P3.md)

### 남은 일

- **브라우저 화면 E2E**: 프론트 로그인(`auth.ts`)이 아직 Supabase라 FastAPI 토큰이 저장되지 않습니다. 희주님께 로그인 시 `kantmoa.accessToken` 저장, 로그인 직후 `mergeGuestCart()` 호출, 로그아웃 시 키 삭제를 요청했습니다. 이후 장바구니 → 주문 → 결제 → 취소를 화면에서 확인합니다.
- `shop_settings`는 P2 시드(50,000원 / 3,000원)가 담당하고 P3는 읽기만 합니다 (상재님 확인).
- Redmine P3 일감 상태 업데이트.
