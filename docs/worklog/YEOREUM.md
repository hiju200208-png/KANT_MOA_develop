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

### 오후 추가 (로그인 전환·API 통합 테스트·배포 확인)

- 로그인 전환: 상재님 [#66](https://github.com/hiju200208-png/KANT_MOA_develop/pull/66)이 같은 내용(로그인·로그아웃·내 정보·회원가입 FastAPI, `session.ts`)을 먼저 머지했다. #64는 main과 차이가 0줄이 되어 머지할 내용이 없다. main(#66) 코드로 로그인 → 비회원 장바구니 병합을 화면에서 다시 확인했다 (cart_items B 2).
- 4계층 테스트 ③ API 통합: `tests/orders/test_order_api_db.py` 추가 (#65). 실제 회원가입·로그인 토큰 → 주문 → 남의 주문 403 → 결제(재고 5 → 3) → 취소(5 복구) → 로그아웃 후 401. 취소 재고 복구를 일부러 지우면 `assert 3 == 5`로 실패하는 것도 확인. CI 3단계에서 실행.
- 배포(학원 서버) 확인, 읽기만: `/openapi.json`에 P3 API 포함 25개 경로, `/products` 387개, 배송비 50,000원 / 3,000원, 토큰 없이 `/orders` 401. 관리자 API는 #62 미머지로 아직 없음. 방법은 [배포 사이트 테스트 가이드](../DEPLOYED_TEST_GUIDE.md).

### 진행 방향 (10/27 저녁 → 10/28 제출)

1. 로컬 프론트 + 로컬 Docker DB에서 화면별로 "우리가 바꾼 곳"을 Network 요청(FastAPI vs Supabase)으로 근거를 남기며 여름이 직접 조작해 확인한다.
2. 배포 환경은 읽기·계약(401·404·422)만 확인한다. 주문·재고를 바꾸는 테스트는 공용 DB에서 하지 않는다.
3. 발표: 시연은 로컬(화면 + Swagger + 블랙리스트 401), 배포 Swagger로 같은 API가 서버에 올라가 있음을 보여 준다.
4. 남은 팀 의존: 관리자 API 등록(#62), 회원 정보 수정 API(P1).

### 남은 일

- 로그인 전환은 #66으로 main에 반영됨 → #64 닫기
- 회원가입·내 정보 수정 화면 전환 (P1 판단)
- `shop_settings`는 P2 시드(50,000원 / 3,000원)가 담당하고 P3는 읽기만 합니다 (상재님 확인).
- Redmine P3 일감 상태 업데이트, 팀 Notion 개인 작업일지에 이 문서 옮기기

### 저녁 추가 — P3 잔업 마감 재검증

- 최신 main `65bf153` 반영. 주문 내역을 최신 100건만 읽던 문제를 수정하고, API 페이지를 끝까지 조회하도록 변경했다. 회귀 테스트 7개 추가.
- 새 일회용 DB에서 `check.py`: 413 passed / 89 skipped, 실제 P2·P3 Docker DB 단계 311 passed / 5 skipped. 프론트 38 passed, typecheck·lint 통과. skipped 이유와 기존 경고는 상세 기록 참조.
- 가상 계정·전용 DB에서 비회원 병합, 배송지 추가·수정·기본 전환·기본 삭제 후 재지정, 43,000원 모의 결제와 새로고침을 화면·DB로 재확인했다. 재고 5→3, 장바구니 1→0. 취소 API 후 재고 3→5.
- 주문 101건에서 전체 101·결제 대기 100·취소 1과 화면 카드 101개 확인. 가장 오래된 취소 주문도 표시된다. 로그아웃 후 블랙리스트 1행 확인.
- 배포는 읽기만: health 200, OpenAPI 25경로(P3 포함), 토큰 없는 orders 401. 관리자 경로는 아직 배포에 없음.
- 취소 확인창은 브라우저 도구가 처리하지 못해 취소 버튼 E2E 완료로 기록하지 않는다. 임시 webpack 사본의 CSS 미적용도 있어 디자인 검수와 구분한다.
- 상세 검증·3분 시연 순서·외부 기록 제한: [P3 마감 기록](../P3_CLOSEOUT_2026-10-27.md). 팀 Notion 원본 접근 불가. PR 병합은 CI·리뷰 및 사용자 확인 후 진행한다.

### Slack 확인 후 추가 — 관리자 주문·배송 구현

- KANT MOA의 16:09 충만님 질문(관리자 주문 목록·배송 상태 필요 여부)을 확인했고, 여름이 이번 제출에 추가하도록 승인했다.
- 19:09 희주님 요청은 현재 시드 포함 최신 백업 확인 후 최초 이력 적용이다. 서버 BatchMode 읽기 접속은 인증 실패하여 백업 존재를 확인했다고 기록하지 않는다. 공용 DB 변경·재배포는 수행하지 않았다.
- 관리자 주문 목록·검색·결제/배송 필터·페이지 조회, 발송·배송 완료 UI/API를 P3 4계층으로 추가했다. ADMIN 401/403, 업무 전이409·입력422·없는 주문404를 검증한다.
- 결제 상태와 배송 상태를 분리하고 발송 이후 고객 취소를 막았다. 취소·발송 동시 요청은 하나만 성공하며, 배송 commit 실패 시 기록이 rollback된다. 재고·P2 규칙은 변경하지 않는다.
- 전용 DB 화면에서 pending 주문에는 배송 버튼 없음, paid 주문은 준비→발송→배송 완료와 필터 이동 확인. 배송 기록 0→1, shipped_at/delivered_at/처리 관리자 저장, 재고4 유지·결제paid 유지. 상세 결과는 기존 P3 마감 기록에 추가한다.
- `check.py`: 기본 423 passed/90 skipped, 실제 DB 322 passed/5 skipped. 프론트 43 passed, typecheck·lint 통과. 최초 baseline 도구는 고정 기준3f를 유지하면서 알려진 단일 후속 배송head만 허용하고 나머지는 거부하도록 보완했다.
- 기존 PR #71을 이번 최종 범위에 맞춰 갱신한다. 공용 적용은 최신 백업→baseline→배송migration→코드배포 순서로 별도 리뷰·승인 후 진행한다.
