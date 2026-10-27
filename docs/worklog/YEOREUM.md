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

### 화면 E2E (실제 브라우저 → FastAPI → 로컬 Docker DB)

- 프론트 로그인(`auth.ts`)이 Supabase라 화면에서 FastAPI 토큰이 생기지 않아, 로그인·로그아웃·내 정보만 FastAPI로 바꾼 [PR #64](https://github.com/hiju200208-png/KANT_MOA_develop/pull/64)를 따로 올렸습니다 (P1 파일이라 희주님 리뷰 후 머지). 아래는 #64 적용 상태에서 확인한 결과입니다.
- 실행: `main.py` 서버 + `npx next dev`(로컬 API 주소 지정), 로컬 테스트 회원. 토큰·비밀번호는 기록하지 않았습니다.

| 화면에서 한 일 | 화면 결과 | DB 증거 (전 → 후) |
|---|---|---|
| 비회원 장바구니 (포토카드 A 2, B 1) | 9,500원 + 배송비 3,000원 | 저장 없음 (`/cart/preview`) |
| 로그인 화면에서 로그인 | 헤더 MY·로그아웃, 주문서 이름 자동 입력 | cart_items 0행 → (A 2, B 1) 병합, localStorage 비움 |
| 장바구니 B 수량 + | 2개 | cart_items B 1 → 2 |
| 주문서 배송지 입력 후 결제 | 결제 완료, 16,000원(배송비 3,000) | 재고 A·B 100 → 98, orders paid·paid_at, cart_items 2행 → 0행, 배송지 1행(기본) |
| 주문 상세 새로고침 | 결제 완료 그대로 | 변화 없음 |
| 주문 취소 | 취소됨 | orders cancelled·cancelled_at, 재고 98 → 100 |
| 주문/취소 내역 `취소` 탭 | 1건 | 조회만 |
| 응원봉 5개 바로 구매 (1인 4개) | "옵션당 구매 가능 수량을 초과했어요." | 주문 1 → 1, 재고 5 → 5 |
| 헤더 로그아웃 → 같은 토큰으로 `GET /orders` | 홈 이동, 토큰 삭제 | 401 NOT_AUTHENTICATED, token_blacklist 4 → 5 |

### 트러블슈팅

- **다른 세션이 같은 브랜치에 커밋**: Claude 데스크톱 오른쪽 패널의 탭이 별도 세션이라, 그쪽에서 `yeoreum`에 커밋·push해 PR 내용이 바뀌었습니다. 개발(코드·git)은 한 세션에서만 하고 다른 세션은 조사·초안만 하도록 정했습니다.
- **P1 테스트가 PC마다 결과가 다름**: `test_auth_*`가 `backend/.env`의 실제 DB에 접속해, DB 없이 돌리면 실패했습니다. CI·`check.py`는 쓰고 버리는 DB와 같은 테스트 값을 넣어 결과를 맞췄습니다.
- **Windows curl로 한글 JSON 400**: 콘솔 인코딩 문제라 Python(httpx)이나 브라우저 Swagger로 요청했습니다.
- **`main.py` 충돌**: P2 상품 라우터 등록과 P3 라우터 등록이 같은 줄에서 겹쳐 양쪽을 모두 살렸습니다 (경로 중복 없음 확인).

### 남은 일

- PR #64 희주님 리뷰·머지 후, main 상태로 화면 E2E 한 번 더 확인
- 회원가입·내 정보 수정 화면 전환 (P1 판단)
- `shop_settings`는 P2 시드(50,000원 / 3,000원)가 담당하고 P3는 읽기만 합니다 (상재님 확인).
- Redmine P3 일감 상태 업데이트, 팀 Notion 개인 작업일지에 이 문서 옮기기
