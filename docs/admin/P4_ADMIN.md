# P4. 관리자 페이지 · 관리자 API 설계 (초안)

담당: 장충만 · 작성일: 2026-10-23 · 상태: 초안 (팀 합의 후 확정)

> 기준 문서: [`docs/PROJECT2.md`](../PROJECT2.md) (P1 공통 기반·개발 계약). 이 문서와 다르면 **PROJECT2.md가 우선**이에요.
>
> 인수 당시(`takeover-base` = `main` `f446b8a`) 칸트모아에는 **관리자 기능과 역할(role) 구분이 없었어요.**
> 상품·공지는 마이그레이션 SQL로만 관리했어요. P4는 이 부분을 FastAPI로 **새로 만드는** 확장 기능이에요.

---

## 1. 기능 범위

| 구분 | 기능 | 비고 |
|---|---|---|
| **필수** | 관리자 상품 목록 (검색·필터·정렬·페이지네이션, 재고 합계·품절 표시) | 숨김(`hidden`) 상품도 보여요 |
| **필수** | 상품 상세의 옵션별 재고 조회 | 옵션(`product_variants`) 단위 |
| **필수** | 옵션 재고 조정 (입고 +, 수정 −) | 재고 규칙은 P2 상품 도메인 `increase_stock` / `decrease_stock` 사용 |
| **필수** | 판매 상태 변경 (`on_sale` / `sold_out` / `hidden`) | |
| **필수** | 권한 검증: 비로그인 401, 일반 회원 403 | P1 `require_admin` 의존성 사용 (P1 구현 후) |
| 선택 | 재고 변경 이력 조회 | 시간이 남으면 |
| 선택 | 상품 등록 + 대표 이미지 업로드 (`backend/uploads/` → `/uploads/`) | 시간이 남으면. 업로드 검사(형식·용량·서버 생성 파일명)는 아직 아무도 구현 안 함 → 하게 되면 P4가 같이 구현 |
| 선택 | 공지 등록·수정·삭제 | 시간이 남으면 |

---

## 2. 관리자 화면 흐름 (Next.js)

```
헤더 MY 메뉴 ─(ADMIN만 "관리자" 링크 노출)─▶ /admin  ─▶ /admin/products  (상품 목록)
                                                              │ 행 클릭
                                                              ▼
                                                     /admin/products/[id]  (옵션별 재고·판매 상태)
```

| 화면 | 구성 | 상태 처리 |
|---|---|---|
| `/admin/products` | 검색창(상품명), 필터(아티스트·카테고리·판매 상태·재고: 전체/품절/부족), 정렬(최신·재고 적은 순), 표(썸네일·상품명·아티스트·가격·판매 상태·재고 합계), 페이지 이동 | 로딩 · 빈 결과 · 오류 |
| `/admin/products/[id]` | 상품 정보, 판매 상태 선택, 옵션 표(옵션명·현재 재고·구매 제한), 옵션마다 "재고 조정" 입력(+/− 수량, 사유) | 저장 중 버튼 비활성, 성공 안내, 409·404 오류 메시지 |

- 접근 처리: 비로그인 → `/login?next=/admin/...`, 일반 회원 → "접근 권한이 없어요" 화면
- **화면에서 링크를 숨기는 것은 편의일 뿐**이고, 실제 권한 검증은 FastAPI가 매 요청마다 해요. ADMIN 여부는 **서버가 검증한 사용자 정보** 기준이에요 (PROJECT2.md 인증 계약).
- 관리자 API는 로그인 토큰이 필요하므로 **클라이언트 컴포넌트에서 호출**해요.
- 프론트는 아직 Supabase에 연결돼 있어요. `NEXT_PUBLIC_API_URL` 연결·토큰 저장 방식이 정해지면(P1 후속) 관리자 화면을 그 방식에 맞춰 붙여요. 그 전에는 Swagger(`http://localhost:8000/docs`)로 API부터 검증해요.

---

## 3. 관리자 API 명세 (초안)

공통 (PROJECT2.md 공통 API 계약 따름)
- 기본 주소 `http://localhost:8000`, 경로 접두사 `/admin` (`/api` 접두사 없음)
- 모든 API에 `Authorization: Bearer <JWT>` 필요, `role = ADMIN`만 허용 (`Depends(require_admin)`)
- 목록 응답: `core.schemas.PageResponse` → `{ "items": [...], "total": 0, "page": 1, "size": 20 }`. `total`은 필터 후·페이지 적용 전 개수
- 오류 응답: `{ "code": "...", "message": "..." }`. 표현 계층에서 도메인 예외를 `core.errors.ApiError`로 바꿔 던져요

### 3-1. 상품 목록

`GET /admin/products`

| 쿼리 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `q` | string | - | 상품명 부분 일치 |
| `artist` | string | - | 아티스트 slug |
| `category` | string | - | 카테고리 slug |
| `status` | `on_sale` \| `sold_out` \| `hidden` | - | 판매 상태 |
| `stock` | `out` \| `low` | - | `out`: 재고 합계 0, `low`: 옵션 중 하나라도 재고 ≤ 5 |
| `sort` | `latest` \| `stock_asc` \| `name` | `latest` | 정렬 |
| `page` | int ≥ 1 | 1 | |
| `size` | int 1~100 | 20 | |

응답 `200`
```json
{
  "items": [
    {
      "id": 12,
      "name": "BTS 공식 응원봉 SE",
      "artist": { "slug": "bts", "name": "BTS" },
      "category": { "slug": "cheering", "name": "응원용품" },
      "price": 45000,
      "status": "on_sale",
      "thumbnail_url": "/static/products/bts/.../main.webp",
      "total_stock": 37,
      "variant_count": 1,
      "is_sold_out": false
    }
  ],
  "total": 387,
  "page": 1,
  "size": 20
}
```

- `thumbnail_url`은 DB에 저장된 **상대 경로**(`/static/...` 또는 `/uploads/...`) 그대로 내려주고, 프론트가 API origin과 조합해요 (PROJECT2.md 이미지 계약).
- `is_sold_out` 계산 (10/26 상재님 확정): `status`가 `sold_out`이면 true, `on_sale`이고 옵션 재고 합계가 0이면 true, 그 밖(`hidden` 포함)은 false. DB `status`는 재고 때문에 자동으로 바뀌지 않아요.
- `stock=low` 필터는 옵션 중 하나라도 재고가 5 이하인 상품이에요 (`LOW_STOCK_THRESHOLD = 5`).
- 상품 `id` 타입(정수/UUID)은 P2 상품 테이블을 따라요. 위 예시는 정수로 가정했어요.

### 3-2. 상품 상세 (옵션별 재고)

`GET /admin/products/{product_id}`

응답 `200`
```json
{
  "id": 12,
  "name": "BTS 공식 응원봉 SE",
  "artist": { "slug": "bts", "name": "BTS" },
  "category": { "slug": "cheering", "name": "응원용품" },
  "price": 45000,
  "status": "on_sale",
  "thumbnail_url": "/static/products/bts/.../main.webp",
  "variants": [
    { "id": 301, "option_name": "기본", "extra_price": 0, "stock": 37, "max_per_user": 4 }
  ]
}
```

### 3-3. 옵션 재고 조정

`POST /admin/products/{product_id}/variants/{variant_id}/stock-adjustments`

- 재고를 "몇 개로 바꾼다"가 아니라 **"몇 개 늘리거나 줄인다"(증감)** 로 받아요.
  같은 순간에 주문(P3)이 재고를 빼도, 관리자가 본 예전 숫자로 덮어써서 주문 수량이 사라지는 일이 없어요.

요청
```json
{ "change": 10, "reason": "입고" }
```

| 필드 | 규칙 |
|---|---|
| `change` | 정수, 0 불가, -10000 ~ 10000 |
| `reason` | 선택, 최대 100자 (예: 입고, 불량, 재고 실사) |

응답 `200`
```json
{ "variant_id": 301, "before": 37, "after": 47, "change": 10 }
```

### 3-4. 판매 상태 변경

`PATCH /admin/products/{product_id}`

요청 `{ "status": "hidden" }` → 응답 `200` 상품 상세(3-2와 같은 형식)

### 3-5. (선택) 재고 변경 이력

`GET /admin/products/{product_id}/stock-adjustments?page=&size=` → `{ items: [{ variant_id, change, before, after, reason, admin_id, created_at }], total, page, size }`

- `admin_id`는 사용자 UUID (PROJECT2.md 인증 계약의 `users.id`)

### 3-6. 오류 코드

PROJECT2.md 기준: 코드명은 기존 `src/constants/error-messages.ts` / `src/services/errors.ts`를 따르고, **신규 코드는 임의로 추가하지 않아요.** 없는 경우는 `UNKNOWN` + 의미 있는 메시지를 써요.

| 상황 | 상태 | 지금 쓰는 code (현재 계약) | 추가 제안 code (합의 필요) |
|---|---|---|---|
| 토큰 없음·서명 실패·만료·블랙리스트·없는 사용자 | 401 | `NOT_AUTHENTICATED` (기존) | - |
| 일반 회원(USER)이 관리자 API 호출 | 403 | `UNKNOWN` · "접근 권한이 없어요." | `FORBIDDEN` |
| 없는 상품 / 다른 상품의 옵션 id | 404 | `UNKNOWN` · "상품을 찾을 수 없어요." / "옵션을 찾을 수 없어요." | `PRODUCT_NOT_FOUND` / `VARIANT_NOT_FOUND` |
| 조정 후 재고가 0 미만 | 409 | `UNKNOWN` · "재고는 0개보다 적을 수 없어요." | `INVALID_STOCK` |
| `change` = 0, 범위 초과, 잘못된 `status`·`sort`·`page` | 422 | `UNKNOWN` · "입력 형식을 확인해주세요." (P1 공통 핸들러) | - |

> 추가 제안 code는 팀이 합의하면 `src/services/errors.ts`의 `APP_ERROR_CODES`, `src/constants/error-messages.ts`, 백엔드 코드를 **한 PR에서 같이** 바꿔요. 합의 전에는 위 "지금 쓰는 code"로 구현해요.
> 기존 `OUT_OF_STOCK`("품절된 상품이 있어요")은 주문용 문구라 관리자 재고 조정 409에는 쓰지 않아요.

---

## 4. 업무 규칙 (도메인)

| 규칙 | 어디서 | 위반 시 |
|---|---|---|
| 재고는 0 미만이 될 수 없다 | **P2 상품 도메인** (`increase_stock` / `decrease_stock`) | 409 |
| 조정 수량은 0이 아니어야 하고 범위 안이어야 한다 | P4 `StockAdjustment` (도메인) + 요청 스키마 | 422 |
| 옵션은 그 상품에 속해야 한다 | P4 서비스 (조회 후 확인) | 404 |
| 판매 상태는 `on_sale`·`sold_out`·`hidden` 중 하나 | P2 상품 도메인 | 422 |
| 관리자만 접근 | P1 `require_admin` | 401 / 403 |

트랜잭션 (PROJECT2.md 구조·트랜잭션 계약)
- `get_session`은 자동 commit하지 않아요. **commit/rollback은 P4 응용 서비스(`service.py`)가** 하나의 업무 단위에서 해요.
- Repository는 commit하지 않고 필요하면 flush만 해요. ORM ↔ 도메인 객체 변환도 Repository가 해요.
- 재고 조정 흐름: 옵션 행 잠금 조회 → 도메인 규칙(`increase_stock`/`decrease_stock`) → 저장 → commit, 실패하면 rollback.
- 잠금 방식 **합의 (10/25 여름)**: `SELECT ... FOR UPDATE`.
  - 잠금 조회는 **P2 repository의 `get_variants_for_update(variant_ids)` 한 곳**(`with_for_update()`)만 쓰고 P3 결제·P4 재고 조정이 같이 호출해요. 재고 코드 한 곳 원칙 유지.
  - 여러 옵션을 잠글 때는 **항상 id 오름차순**(`ORDER BY id`)으로 잠가 데드락을 막아요.
  - 잠금은 commit/rollback 때 풀리므로 트랜잭션은 각 서비스에서 짧게 가져가요.
- 도메인(`admin/domain/`)은 FastAPI·SQLAlchemy·Pydantic을 import하지 않아요.
- 이전 팀 알려진 문제: "재고가 0이 돼도 `status`가 `sold_out`으로 자동으로 안 바뀜" → **10/26 확정**: DB status는 자동으로 바꾸지 않고, 조회할 때 `is_sold_out`을 계산해서 내려준다 (5장 질문 3).

---

## 5. 다른 담당과 맞출 것

| 상대 | 필요한 것 | 질문 / 상태 |
|---|---|---|
| **P1 (희주)** | `auth.presentation.dependencies.require_admin`, `users.role`(USER/ADMIN), 사용자 UUID | 1. **답변 완료 (10/24 희주)**: 관리자는 공개 회원가입 불가, 로컬 초기화 명령으로 생성(고정 비밀번호 저장소 금지). `get_current_user`·`require_admin`·초기화 명령은 **월요일(10/26)** 구현·공유. import 경로는 `from auth.presentation.dependencies import get_current_user, require_admin`으로 확정. 그 전까지 P4는 테스트에서 `require_admin`을 가짜 의존성으로 바꿔 검증하고, 실제 토큰 401·일반 회원 403·관리자 성공·로그아웃 토큰 차단은 인증 연결 후 검증. |
| **P1 (희주)** | 공통 파일 `main.py`에 관리자 라우터 등록 | 5. **답변 완료 (10/24 희주)**: 관리자 라우터 import와 `app.include_router(...)`는 P4 구현 PR에 포함해도 됨(협의 완료). 인증 의존성이 main에 들어오기 전에는 import 때문에 서버 실행이 깨지지 않게 **통합 시점을 인증 PR 이후로** 맞추고, PR에서 희주님께 리뷰 요청. |
| **P2 (상재)** | 상품·옵션 ORM 모델, 상품 도메인 재고 규칙, 상품 id 타입 | 2. **답변 완료 (10/26 상재, PR #1)**: 숨김 포함 관리자 조회는 P4 Repository에 **조회 전용**으로 둔다. 상품·옵션 ORM 모델은 **P2 모델을 재사용**(P4가 따로 만들지 않음). |
| **P2 (상재)** | 판매 상태 규칙 | 3. **답변 완료 (10/26 상재, PR #1)**: 재고 0이어도 DB `status`는 **자동 변경하지 않음**. 품절은 **조회 시 계산**: 판매 중(`on_sale`)인데 옵션 재고 합계 0이면 `is_sold_out=true`. 관리자가 정한 `hidden`·수동 `sold_out`은 유지. → `admin/domain/product_view.py`의 `is_sold_out`으로 구현 |
| **P2·P3 (상재·여름)** | 재고 잠금 방식 | 4. **답변 완료 (10/25 여름, 10/26 상재 확정)**: `FOR UPDATE`. P2가 `get_variants_for_update`와 도메인 재고 증감·저장을 제공하고, P4는 infrastructure에서 `VariantStockPort`에 연결하며 **같은 AsyncSession**을 쓴다. commit/rollback은 각 응용 서비스가 담당. 여러 옵션은 id 오름차순으로 잠금. |
| **전원** | 신규 오류 code | 6. **P1 의견 (10/24 희주)**: 우선 현재 공통 계약대로 `UNKNOWN` + 상황별 메시지, HTTP 상태는 403·404·409·422로 구분. 신규 code(`FORBIDDEN` 등)는 필요하면 팀 합의 후 프론트 오류 매핑·백엔드·문서를 함께 수정. → P4는 3-6 "지금 쓰는 code"로 구현 |

---

## 6. 4계층 파일 계획 (`backend/src/admin/`)

PROJECT2.md 구조: `presentation/router.py + schemas.py → application/service.py → domain/ → infrastructure/models.py + repositories.py`

| 계층 | 파일 | 하는 일 |
|---|---|---|
| presentation | `router.py` | `/admin` 라우터, 라우터 전체에 `Depends(require_admin)`. **재고 조정 `POST .../stock-adjustments` 구현 (10/25)**, 목록·상세·상태 변경은 P2 모델 후 |
| presentation | `errors.py` | 도메인 예외 → `ApiError(상태, "UNKNOWN", 메시지)`: 잘못된 조정 422, 상품·옵션 없음 404, 재고 부족 409 |
| presentation | `dependencies.py` | P1 `require_admin` 사용(통합 전엔 모든 요청 401로 차단하는 대체 함수), `get_admin_stock_service`(P2 연결 전엔 503) |
| presentation | `schemas.py` | 재고 조정 `StockAdjustmentRequest/Response`, `ProductStatusUpdate`, **목록·상세 응답 `AdminProductListItem`·`AdminProductDetail`·`AdminVariantItem`, 목록 쿼리 `AdminProductQuery` (10/26)**. 목록은 `PageResponse[AdminProductListItem]` |
| application | `ports.py` | 바깥에 기대하는 모양: `VariantStockPort`(잠금 조회·증감), `TransactionPort`(commit/rollback). 실제 연결은 infrastructure에서 P2 함수로 |
| application | `stock_service.py` | **재고 조정** `AdminStockService.adjust`: 잠금 조회 → 상품 소속 확인 → P2 증감 → commit, 실패 시 rollback (10/25 구현) |
| application | `service.py` | 목록 조회, 상세 조회, 상태 변경 (P2 모델 확정 후) |
| domain | `stock_adjustment.py` | `StockAdjustment` (change ≠ 0, 범위, 사유 길이), 관리자 도메인 예외(`InvalidStockAdjustment`·`ProductNotFound`·`VariantNotFound`·`InsufficientStock`) |
| domain | `product_view.py` | 품절 계산 `is_sold_out(status, total_stock)`, 재고 요약 `summarize_stock`(합계·옵션 수·부족 여부) (10/26) |
| infrastructure | `repositories.py` | 관리자 상품 목록 쿼리(숨김 포함·재고 합계, 조회 전용), (선택) 재고 이력 저장. 옵션 잠금 조회는 P2 `get_variants_for_update` 사용. commit 안 함 |
| infrastructure | `models.py` | (선택) 재고 이력 `stock_adjustments` 테이블만. 상품·옵션 모델은 P2 것을 import, `database.Base` 공유 |

---

## 7. 403·권한 검증 시나리오 (월요일 Swagger·화면으로 캡처)

자동 테스트는 `backend`에서 `uv run pytest`. 실제 DB 확인은 `docker compose up -d db` 후 `http://localhost:8000/docs`.

| # | 상황 | 기대 결과 |
|---|---|---|
| 1 | 토큰 없이 `GET /admin/products` | 401 `NOT_AUTHENTICATED` |
| 2 | 일반 회원 토큰으로 `GET /admin/products` | 403 (code는 3-6 합의 결과에 따름) |
| 3 | 관리자 토큰으로 `GET /admin/products` | 200, 숨김 상품 포함 |
| 4 | 관리자 로그아웃 후 같은 토큰으로 재호출 | 401 (블랙리스트) |
| 5 | 재고 37인 옵션에 `change: -40` | 409, 재고 37 그대로 (rollback 확인) |
| 6 | `change: 0` | 422 |
| 7 | 다른 상품의 옵션 id로 조정 | 404 |
| 8 | `change: 10` 후 상세 재조회·새로고침 | 재고 47 유지 (DB 반영 확인) |
| 9 | 일반 회원으로 `/admin/products` 화면 접속 | "접근 권한이 없어요" 화면 |

---

## 8. 진행 체크

10/23
- [x] `admin/` 4계층 폴더 구조 (`backend/src/admin/`, 각 `__init__.py`)
- [x] 관리자 기능 범위 (1장)
- [x] 관리자 화면 구성·이동 흐름 (2장)
- [x] 관리자 API 요청·응답 명세 초안 (3장)
- [x] 403 검증 시나리오 (7장)
- [x] `docs/PROJECT2.md` 공통 계약 반영 (오류 code, `require_admin`, 트랜잭션, 이미지 경로, 관리자 생성 방식)
- [x] 5장 질문 1·5·6 답변 반영 (P1)
- [x] 5장 질문 4 답변 반영 (10/25 여름: FOR UPDATE, 잠금 조회 P2 한 곳, id 오름차순)
- [x] 5장 질문 2·3·4 상재님 답변 반영 (10/26, PR #1 댓글) → 5장 질문 1~6 모두 답변 완료

10/24~25
- [x] 로컬 실행 확인: Docker DB healthy, FastAPI 서버 시작 시 DB 연결 성공
  - 5432 포트가 Windows에서 막혀 호스트 포트 5433 사용 (루트 `.env`·`backend/.env` 둘 다)
  - Windows 앱 제어가 SQLAlchemy 속도용 `.pyd`를 차단 → `.venv\Lib\site-packages\sqlalchemy`의 `*.pyd`만 삭제(같은 기능의 `.py`로 동작), 서버는 `uv run --no-sync ...`로 실행

다음 (P1 인증·P2 상품 모델 의존)
- [x] 도메인 `StockAdjustment`·`StockAdjustmentResult`·관리자 도메인 예외 + 단위 테스트 (10/25, `backend/tests/admin/`)
- [x] 요청 스키마 `StockAdjustmentRequest`·`ProductStatusUpdate`, 응답 `StockAdjustmentResponse` + 422 검증 테스트 (10/25)
- [x] 재고 조정 서비스 `AdminStockService` + 가짜 저장소 테스트 5개 (10/25: 증가·감소 commit, 0 미만 rollback·재고 유지, 없는 옵션·다른 상품 옵션 404 rollback)
- [ ] P2 `get_variants_for_update`·`increase_stock`/`decrease_stock` 나오면 `VariantStockPort` 실제 연결
- [x] 품절 계산·재고 요약 도메인, 관리자 목록·상세 응답과 목록 쿼리 스키마 + 테스트 11개 (10/26) → `uv run pytest` 58 passed
- [ ] P2 상품 모델 나오면 관리자 목록·상세 Repository(조회 전용, P2 모델 재사용)·Service·라우터
- [x] 재고 조정 라우터·오류 변환·의존성 + API 테스트 10개 (10/25: 관리자 200, 비로그인 401, 일반 회원 403, 0 미만 409·rollback, 다른 상품 옵션 404, 잘못된 입력 422, 통합 전 대체 의존성 차단) → `uv run pytest` 47 passed
- [ ] P1 `require_admin` main 반영 후 `main.py`에 `app.include_router(admin_router)` 추가, 희주님 리뷰 요청
- [ ] P2 재고 부족 예외 → `InsufficientStock`(409)로 바꾸는 연결부 작성
- [ ] 관리자 화면 (프론트 API 연결 방식 확정 후)
