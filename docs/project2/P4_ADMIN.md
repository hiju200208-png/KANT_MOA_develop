# P4. 관리자 페이지 · 관리자 API 설계 (초안)

담당: 장충만 · 작성일: 2026-10-23 · 상태: 초안 (팀 합의 후 확정)

> 인수 당시(`takeover-base` = `main` `f446b8a`) 칸트모아에는 **관리자 기능과 역할(role) 구분이 없었어요.**
> 상품·공지는 마이그레이션 SQL로만 관리했어요. P4는 이 부분을 FastAPI로 **새로 만드는** 확장 기능이에요.

---

## 1. 기능 범위

| 구분 | 기능 | 비고 |
|---|---|---|
| **필수** | 관리자 상품 목록 (검색·필터·정렬·페이지네이션, 재고 합계·품절 표시) | 숨김(`hidden`) 상품도 보여요 |
| **필수** | 상품 상세의 옵션별 재고 조회 | 옵션(`product_variants`) 단위 |
| **필수** | 옵션 재고 조정 (입고 +, 수정 −) | 재고 규칙은 P2 상품 도메인 사용 |
| **필수** | 판매 상태 변경 (`on_sale` / `sold_out` / `hidden`) | |
| **필수** | 권한 검증: 비로그인 401, 일반 회원 403 | P1 인증 의존성 사용 |
| 선택 | 재고 변경 이력 조회 | 시간이 남으면 |
| 선택 | 상품 등록 + 대표 이미지 업로드 (`uploads/`) | 시간이 남으면 |
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
- **화면에서 링크를 숨기는 것은 편의일 뿐**이고, 실제 권한 검증은 FastAPI가 매 요청마다 해요 (가이드: 인증은 서버에서).
- 관리자 API는 로그인 토큰이 필요하므로 **클라이언트 컴포넌트에서 호출**해요.

---

## 3. 관리자 API 명세 (초안)

공통
- 기본 경로: `/admin` · 모든 API에 `Authorization: Bearer <JWT>` 필요 · `role = ADMIN`만 허용
- 목록 응답: `{ "items": [...], "total": 0, "page": 1, "size": 20 }` (팀 합의)
- 오류 응답: `{ "code": "...", "message": "..." }` (팀 합의)

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

### 3-6. 오류 코드

| 상황 | 상태 | code |
|---|---|---|
| 토큰 없음·만료·로그아웃(블랙리스트) | 401 | `NOT_AUTHENTICATED` |
| 일반 회원(USER)이 관리자 API 호출 | 403 | `FORBIDDEN` **(신규)** |
| 없는 상품 / 다른 상품의 옵션 id | 404 | `PRODUCT_NOT_FOUND` / `VARIANT_NOT_FOUND` **(신규)** |
| 조정 후 재고가 0 미만 | 409 | `INVALID_STOCK` **(신규)** |
| `change` = 0, 범위 초과, 잘못된 `status`·`sort`·`page` | 422 | FastAPI 기본 검증 |

> 신규 code 4개는 프론트 `src/constants/error-messages.ts`에도 문구를 추가해야 해요.

---

## 4. 업무 규칙 (도메인)

| 규칙 | 어디서 | 위반 시 |
|---|---|---|
| 재고는 0 미만이 될 수 없다 | **P2 상품 도메인** (`increase_stock` / `decrease_stock`) | 409 `INVALID_STOCK` |
| 조정 수량은 0이 아니어야 한다 | P4 `StockAdjustment` (요청 검증) | 422 |
| 옵션은 그 상품에 속해야 한다 | P4 서비스 (조회 후 확인) | 404 |
| 판매 상태는 `on_sale`·`sold_out`·`hidden` 중 하나 | P2 상품 도메인 | 422 |
| 관리자만 접근 | P1 관리자 확인 의존성 | 401 / 403 |

- 재고 조정은 **옵션 행을 잠그고(`SELECT ... FOR UPDATE`) → 도메인 규칙 → 저장 → commit**, 실패하면 rollback해요. P3 결제도 같은 행을 잠그므로 둘이 동시에 와도 순서대로 처리돼요.
- 이전 팀 알려진 문제: "재고가 0이 돼도 `status`가 `sold_out`으로 자동으로 안 바뀜" → 자동 전환을 할지 P2와 정하기 (5장 질문 3).

---

## 5. 다른 담당과 맞출 것

| 상대 | 필요한 것 | 질문 |
|---|---|---|
| **P1** | `users.role` (`USER`/`ADMIN`), 관리자 확인 의존성 (예: `get_current_admin`), 401/403 응답 형식 | 1. 관리자 계정은 시드로 만들까요? (예: `admin@kantmoa.local`, 비밀번호는 `.env`) |
| **P2** | 상품·옵션 ORM 모델, 상품 도메인의 재고 규칙(`increase_stock`/`decrease_stock`), 이미지 URL 규칙(`/static/...`) | 2. 관리자 목록은 숨김 상품까지 보여야 해서 P2 공개 목록과 쿼리가 달라요. 관리자용 조회는 P4 Repository에 따로 둘게요. 괜찮을까요? |
| **P2** | 판매 상태 규칙 | 3. 재고 합계가 0이 되면 `sold_out`으로 자동 전환할까요, 관리자가 직접 바꿀까요? |
| **P3** | 같은 옵션 행 잠금 순서 | 4. 결제와 관리자 조정이 둘 다 `product_variants` 행을 `FOR UPDATE`로 잠그는 걸로 맞출까요? |

---

## 6. 4계층 파일 계획 (`backend/src/admin/`)

| 계층 | 파일 | 하는 일 |
|---|---|---|
| presentation | `router.py` | `/admin/products` 라우터, `Depends(get_current_admin)`, 도메인 예외 → HTTP 상태 |
| presentation | `schemas.py` | `AdminProductListItem`, `AdminProductDetail`, `StockAdjustmentRequest/Response`, `ProductStatusUpdate` |
| application | `service.py` | 목록 조회, 상세 조회, 재고 조정(잠금 → 규칙 → 저장 → commit/rollback), 상태 변경 |
| domain | `stock_adjustment.py` | `StockAdjustment` (change ≠ 0, 범위, 사유 길이), 관리자 도메인 예외 |
| infrastructure | `repositories.py` | 관리자 상품 목록 쿼리(숨김 포함·재고 합계), 옵션 잠금 조회, (선택) 재고 이력 저장 |

---

## 7. 403·권한 검증 시나리오 (월요일 Swagger·화면으로 캡처)

| # | 상황 | 기대 결과 |
|---|---|---|
| 1 | 토큰 없이 `GET /admin/products` | 401 `NOT_AUTHENTICATED` |
| 2 | 일반 회원 토큰으로 `GET /admin/products` | 403 `FORBIDDEN` |
| 3 | 관리자 토큰으로 `GET /admin/products` | 200, 숨김 상품 포함 |
| 4 | 관리자 로그아웃 후 같은 토큰으로 재호출 | 401 (블랙리스트) |
| 5 | 재고 37인 옵션에 `change: -40` | 409 `INVALID_STOCK`, 재고 37 그대로 (rollback 확인) |
| 6 | `change: 0` | 422 |
| 7 | 다른 상품의 옵션 id로 조정 | 404 `VARIANT_NOT_FOUND` |
| 8 | `change: 10` 후 상세 재조회·새로고침 | 재고 47 유지 (DB 반영 확인) |
| 9 | 일반 회원으로 `/admin/products` 화면 접속 | "접근 권한이 없어요" 화면 |

---

## 8. 오늘(10/23) 완료 체크

- [x] `admin/` 4계층 폴더 구조 (`backend/src/admin/`, 각 `__init__.py`)
- [x] 관리자 기능 범위 (1장)
- [x] 관리자 화면 구성·이동 흐름 (2장)
- [x] 관리자 API 요청·응답 명세 초안 (3장)
- [x] 403 검증 시나리오 (7장)
- [ ] P1·P2·P3와 5장 질문 1~4 합의 → 결과를 이 문서에 반영
