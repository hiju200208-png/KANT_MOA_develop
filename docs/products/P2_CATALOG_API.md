# P2 5단계 · 상품 목록·검색·상세 API

2026-10-27 KST. 로컬 구현·검증 완료. 공용 서버 배포·프론트 연결은 별도다.

## 구현 범위

4단계 커밋 `fc9a4a0`에 포함된 조회 초안을 확인하고, 실행 앱에 상품 라우터를 등록했다.
팀 main `2b7cd3d`는 해당 4단계 PR #56을 병합한 상태이며 코드 차이는 없었다.
공개 상태는 `on_sale`, `sold_out`만 허용하고 입력 범위·Swagger 설명을 보완했다.
P1 인증 라우터와 기존 오류 처리·세션 의존성은 그대로 재사용한다.

| API | 기능 |
|---|---|
| `GET /products` | 목록·검색·필터·정렬·페이지와 전체 건수 |
| `GET /products/{product_id}` | 상품·아티스트·분류·옵션·이미지 상세 |
| `GET /categories` | 활성 분류만 `sort_order ASC, id ASC` 순서로 조회 |

세 API는 비로그인 조회가 가능하다. 상품 흐름은 presentation → CatalogService →
CatalogRepository → Product/ProductVariant 도메인 → 응답 스키마로 이어진다.

## 요청·응답 계약

- `page`: 기본 1, 1..2,147,483,647. `size`: 기본 20, 1..100.
- `q`: 최대 100자. 생략하면 전체, 빈 문자열·공백이면 빈 결과.
  양끝 공백을 제거하고 상품명·아티스트 영문/한글명을 대소문자 무관하게 부분 검색한다.
  `%`, `_`, 역슬래시는 문자 그대로 검색하고 SQL 값은 바인딩한다.
- `artist`, `category`: 최대 100자 slug로 필터. `exclude_id`: 양의 PostgreSQL bigint.
- `sort`: `latest` = `created_at DESC, id DESC`,
  `price_asc` = `price ASC, id ASC`, `price_desc` = `price DESC, id ASC`.
  가격 정렬은 상품 기본 가격 기준이다.
- 목록 응답은 `{items,total,page,size}`. `total`은 동일 필터·검색·제외 조건을 적용한 뒤
  페이지 제한 전에 계산한다. 범위를 지난 페이지는 `items=[]`이며 전체 건수를 유지한다.
- 상세는 기본 가격·아티스트·분류·설명·한정/예약 여부·발매일·대표 이미지,
  `gallery_paths`, `detail_paths`, `variants`, `has_options`를 반환한다.
  옵션은 추가금·기본 가격+추가금인 `price`·재고·구매 제한을 제공한다.
  옵션·이미지는 `sort_order ASC, id ASC`로 정렬한다.
- 기존 화면과 같이 옵션 1개가 `기본`인 경우 `has_options=false`다.
  `max_per_user=null`은 무제한이다. 조회 API가 구매 한도나 주문을 집행하지는 않는다.
- 이미지 경로는 `/static/...`, `/uploads/...` 상대 경로다. 프론트의 API origin 결합은 7단계다.
- `hidden`은 목록에서 제외하고 상세에서 없는 상품과 동일하게 404를 반환한다.
  판매자 지정 `sold_out`은 조회 가능하다. `on_sale`이어도 양수 재고 옵션이 없으면
  `is_sold_out=true`이며 DB status를 변경하지 않는다. 옵션별 품절 표시는 옵션 재고 기준이다.
- 상세 404: `{"code":"UNKNOWN","message":"상품을 찾을 수 없어요."}`.
  잘못된 page/size/sort/ID와 너무 긴 검색어는 공통 422 `{code,message}`다.

## 검증

공용 DB·기존 개발 DB와 분리된 임의 이름의 새 Docker PostgreSQL 18에서 실행했다.
기존 `.env`를 수정하지 않도록 무시되는 검증 사본에 로컬 DB 설정을 만들었다.
신규 상품 API 테스트는 별도 Docker DB를 사용하며 각 데이터 준비 트랜잭션을 rollback한다.

- 신규 `tests/products/test_catalog_api.py`: **36 passed**.
- P1 인증·P4 관리자·P2 재고·시드·상품 API 전체: **246 passed, 0 skipped**, 23.87초.
- 새 로컬 DB에서 `alembic upgrade head` 성공, head `3f21520f9615`.
- `alembic check`: **No new upgrade operations detected**. migration 수정 없음.
- 실제 카탈로그 389개를 로컬 DB에 넣어 공개 387개를 전 페이지 조회,
  ID 중복·누락 없음 확인. 공개 387개 상세의 옵션 ID·최종 가격·품절 계산·이미지 순서를
  원본 스냅샷과 대조하고 hidden 2개 상세 404 확인.
- 별도 테스트 상품으로 한글/영문 검색, 공백·100자 경계·특수문자·SQL 구문 검색,
  검색/slug/제외 복합 조건, 동일 가격/시간 정렬, 정확한 total·마지막/빈 페이지 검증.
- 옵션 없음·재고 0·판매자 지정 품절·기본 옵션·무제한 구매 제한 검증.
- 목록은 페이지 크기 1과 100 모두 SELECT 3회, 상세도 SELECT 3회.
  옵션·이미지 JOIN으로 목록 건수가 늘거나 직렬화 중 lazy load가 발생하지 않음 확인.
- API GET 경로에서 flush/commit 호출 없음, 조회 전후 DB status·재고 유지 확인.
- 실제 `main.app`의 `/docs` 200과 OpenAPI에 세 API 등록·인증 불필요 계약 확인.
  브라우저에서 Swagger를 수동 조작한 검증과 구분한다.
- 기존 TestClient 관련 Starlette/httpx 사용 중단 예고 경고 1개. 테스트 실패 없음.

검증 로그: 로컬 `backend/.venv/p2-stage5-review/backend/stage5-pytest.log`,
`stage5-alembic-check.log` (Git 제외). 테스트용 컨테이너는 검증 종료 후 삭제했다.

## 팀원 로컬 재현

Docker Desktop을 켜고 `backend`에서 실행한다. 실제 카탈로그 상세 대조 테스트까지
수행하려면 4단계 문서대로 원본 이미지 ZIP을 먼저 준비한다. 이미지가 없으면 해당
실데이터 테스트만 이유와 함께 skip되고 나머지 API 테스트는 실행된다.

```powershell
$env:P1_RUN_LOCAL_DB_TESTS = '0'
$env:DATABASE_URL = 'postgresql+asyncpg://unused:unused@127.0.0.1/unused'
$env:JWT_SECRET = 'local-catalog-test-secret-with-at-least-32-characters'
$env:P2_RUN_POSTGRES_TESTS = '1'
uv run pytest tests/products/test_catalog_api.py -q
```

위 URL에는 접속하지 않는다. API 테스트가 생성한 Docker DB 세션을 실행 앱에 주입한다.
실제 비밀번호나 공용 DB URL을 넣지 않는다.

## 변경 경계·다음 단계

- 공통 파일 변경은 `backend/src/main.py`의 상품 라우터 import·등록 **2줄**이며 P1 리뷰 때 공유한다.
- 공용 DB 데이터·스키마·Alembic 이력·서버 실행 코드는 이번 단계에서 변경하지 않았다.
- 커밋·push·배포는 수행하지 않았다. 공개 ngrok 주소에 이번 API가 배포됐다는 의미가 아니다.
- **5단계에서 정지**. 6단계 찜·인증, 7단계 프론트 연결은 아직 진행하지 않았다.
