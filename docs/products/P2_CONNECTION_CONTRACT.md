# P2 1단계: 최신 코드와 연결 계약 확인

확인일: 2026-10-26 KST. 이 문서는 코드로 확인한 사실, 기존 합의, P2 제안, 팀원 확인 대기를 구분한다.
에이전트가 외부 메시지를 발송하지는 않았다. 사용자가 요청 문안을 팀원에게 전달했고 P1·P3·P4 답변을 공유했다.
이 문서 작성만으로 미확인 세부 합의나 서버 적용이 완료되지는 않는다.

후속 확인: P1 [PR #49](https://github.com/hiju200208-png/KANT_MOA_develop/pull/49),
P4 [PR #50](https://github.com/hiju200208-png/KANT_MOA_develop/pull/50)이 공개돼 실제 코드를 대조했다.
아래 최초 확인 시점의 미공개 상태와 구분하며 최신 결과는 [PR 대조 기록](P1_P4_PR_REVIEW.md)을 따른다.

## 1. 확인 기준과 변경 보존

- 팀 저장소: `hiju200208-png/KANT_MOA_develop`, PR 대상: 이 저장소의 `main`.
- 최신 fetch 기준 `origin/main`: `20edbcf` ([재고 PR #42 병합](https://github.com/hiju200208-png/KANT_MOA_develop/pull/42)).
- `feature/sangjae`를 `20edbcf`로 fast-forward했다. 강제 reset·미검증 코드 병합은 하지 않았다.
- 재고 구현 커밋: `39da138`. 순수 도메인과 Repository·의존 ORM·테스트가 함께 포함됐다.
- `docs/STAGING.md`, `deploy/staging/README.md`, `docs/SANGJAE_HANDOFF.md`의 미커밋 내용은 보존했다.
  이번 인계 문서 수정 전에도 원본을 임시 디렉터리에 추가 백업했다.
- 미검증 상품 조회 파일(application, presentation, domain/product.py, infrastructure/catalog.py)은 로컬에만 있다.
  공통 앱 등록·인증·Alembic·공용 DB·배포는 이번 작업에서 변경하지 않았다.

| 담당 | 실제 원격에서 확인한 코드 | 아직 확인되지 않은 코드 |
|---|---|---|
| P1 | `main`·`heeju(0df4154)`의 공통 기반과 auth 패키지 구조, PR #2·#3 병합 | 회원/JWT 구현, 인증 dependencies, Alembic 설정·revision |
| P3 | `yeoreum(4d25ff6)`의 주문 상태 도메인·단위 테스트 | 결제 Application·재고 adapter·Repository |
| P4 | PR #1의 재고 조정 서비스·port·라우터. `feature/chungman(71cbf38)`에는 추가 품절 계산·응답 스키마 | 보고받은 목록·상세 Repository·상태 변경 구현. 원격 infrastructure에는 __init__.py만 있음 |

P4 추가 브랜치는 검토만 했고 통합하지 않았다. 최신 로컬 구현이 별도로 존재할 수 있으므로 미구현이라고 단정하지 않는다.

## 2. P1 인증: 확인된 계약과 실제 코드 검증 구분

2026-10-26 사용자가 전달한 P1 답변으로 아래 계약을 확인했고, 이후 PR #49의 실제 코드에서도 일치를 확인했다.

```python
from auth.presentation.dependencies import CurrentUser, get_current_user, require_admin
```

- get_current_user와 require_admin은 모두 CurrentUser를 반환한다.
- CurrentUser는 Pydantic BaseModel이며 필드는 id: UUID, email: str, nickname: str, role: str이다.
  Python 내부 id는 uuid.UUID, JSON에서는 UUID 문자열이다. role은 "USER" 또는 "ADMIN"이다.
- role은 JWT의 역할 값이 아니라 DB에서 조회한 현재 회원 정보를 기준으로 확인한다. 비밀번호 해시는 반환하지 않는다.
  DB users.id는 UUID, users.role은 TEXT + USER/ADMIN CHECK이다. P2 소유 데이터는 current_user.id를 사용한다.
- P1 로컬 구현 보고: 일반 회원가입·로그인·내 정보·블랙리스트 로그아웃·관리자 생성 CLI·권한 의존성.
  전체 테스트 18개 통과, Swagger 가입/로그인/내 정보, 로그아웃 후 같은 토큰 401,
  토큰 없음 401 / USER 403 / ADMIN 200을 확인했다고 보고했다.
  이는 **P1의 로컬 검증 보고**이며 P2가 원격 코드·실제 토큰으로 독립 재검증한 결과는 아니다.
- 실제 dependencies.py·반환 클래스·JWT/blacklist 구현은 PR #49에서 코드 대조를 마쳤다.
  실제 DB 인증 통합 테스트의 이번 독립 재실행은 Docker 준비 문제로 미완료다.
  Google 로그인 완료는 이번 답변으로 확인되지 않았다.
- Swagger에서 확인된 API 전달 방식은 Authorization: Bearer <access_token>이다.
  **프론트 토큰 저장·복원·화면 연결은 P1도 미구현·미확정이라고 답했다.**
  현재 프론트의 Supabase Auth 세션을 P1 FastAPI 토큰으로 그대로 인정하지 않는다.
- 공통 오류는 `{code,message}`. 미인증 401/NOT_AUTHENTICATED, 권한 부족 403/UNKNOWN,
  없음 404/UNKNOWN, 입력 오류 422/UNKNOWN을 사용한다. 401은 WWW-Authenticate: Bearer를 포함한다.
  P1 실제 구현에서 누락·위조·만료·블랙리스트·없는 사용자의 401을 추가 확인해야 한다.
- 찜 소유자는 검증된 사용자 객체에서만 구한다. 요청의 user_id나 검증하지 않은 JWT payload를 믿지 않는다.

## 3. P3/P4 재고: 현재 제공 계약

아래 경로와 동작은 `39da138` 코드로 확인됐다. P3는 Repository·재고 메서드 재사용과 같은 세션·트랜잭션,
전체 항목 검증 후 한 번 commit·중간 오류 rollback 방향에 동의했다(사용자가 전달한 답변 기준).
P3의 취소·예외·구매 제한·중복 처리 세부 합의와 최신 연결 코드는 대기다.
P4는 아래 잠금·누락·소속 확인·동일 객체 저장·세션·예외 변환 계약을 수락했다(사용자가 전달한 답변 기준).

```python
from products.domain.variant import ProductVariant, InvalidStock, InsufficientStock
from products.infrastructure.repositories import ProductRepository
from products.infrastructure.models import (
    ArtistModel, CategoryModel, ProductModel, ProductVariantModel, ProductImageModel,
)
```

| 함수 | 현재 계약 |
|---|---|
| `ProductRepository(session)` | 호출 서비스의 AsyncSession 그대로 주입. 내부 세션 생성·commit·rollback 없음 |
| `get_variants_for_update(variant_ids)` | 양의 int ID iterable → `list[ProductVariant]`. 중복 제거, id 오름차순 FOR UPDATE. 빈 입력은 [] |
| 누락 ID | 해당 객체를 반환하지 않음. 호출자가 요청 ID 집합과 비교해 전체 업무를 중단·rollback해야 함 |
| 옵션 객체 | id/product_id/stock/option_name/extra_price/max_per_user/sort_order. ORM이 아닌 순수 도메인 객체 |
| `variant.increase_stock(quantity)` / `decrease_stock(quantity)` | 양의 int만 허용(bool 제외). 변경한 재고 int 반환. 실패 시 재고 유지 |
| `save_variant(variant)` | 같은 Repository·root/nested 트랜잭션에서 잠금 조회한 바로 그 객체를 저장·flush. 반환 None |
| 예외 | 잘못된 수량·재고·정수 범위 초과: InvalidStock. 부족: InsufficientStock. 잘못된 ID·잠그지 않은 객체 저장: ValueError |

- 동일 ID를 다시 잠금 조회하면 마지막으로 반환된 객체를 사용한다. commit/rollback 후 예전 객체로 저장하지 않는다.
- 3단계 후속 검증에서 savepoint 경계 보호를 추가했다. savepoint commit/rollback 후에도 다시 잠금 조회해야 한다.
  명시적 max_per_user=None의 NULL 저장도 보완했다. [3단계 검증 기록](P2_STOCK_REPOSITORY.md)에 수정·테스트 결과를 기록했다.
- 요청 전체의 옵션을 한 번에 잠근다. 여러 번 나누어 잠글 때도 업무 전체에서 ID 순서가 뒤집히지 않아야 한다.
  이 규칙이 다른 테이블까지 포함한 모든 deadlock을 없애는 것은 아니다.
- P3는 주문·옵션 소속·판매 가능 상태·구매 제한을 확인하고 주문 저장과 재고 저장을 같은 세션에서 처리한다.
  재고 메서드는 판매 상태나 사용자별 누적 구매량을 판단하지 않는다.

P3 서비스 흐름 예시(실제 결제 구현이 아님):

```python
async def decrease_items(session, quantities):
    # quantities: 요청 검증·중복 수량 집계가 끝난 dict[variant_id, quantity]
    repository = ProductRepository(session)
    try:
        variants = await repository.get_variants_for_update(quantities)
        if {variant.id for variant in variants} != set(quantities):
            raise LookupError("존재하지 않는 옵션이 있어요.")
        for variant in variants:
            variant.decrease_stock(quantities[variant.id])
            await repository.save_variant(variant)
        # 실제 P3에서는 주문 저장도 이 session에서 수행한 뒤 한 번 commit한다.
        await session.commit()
    except BaseException:
        await session.rollback()
        raise
```

P4 adapter 작성 계약(구현 위치는 P4 infrastructure, 이번 단계에서는 구현하지 않음):

| P4 port | P2 연결 |
|---|---|
| `lock_variant(id)` | `get_variants_for_update([id])`의 첫 객체 또는 None |
| `increase_stock(variant, quantity)` | 도메인 increase → save_variant → 변경 재고 반환 |
| `decrease_stock(variant, quantity)` | 도메인 decrease → save_variant → 변경 재고 반환 |
| P2 InsufficientStock | P4 `admin.domain.stock_adjustment.InsufficientStock`으로 변환 → 기존 409/UNKNOWN |
| P2 InvalidStock | P4 `InvalidStockAdjustment`로 변환 → 기존 422/UNKNOWN |
| 트랜잭션 | `AdminStockService(stock=adapter, transaction=session)`, adapter도 동일 session 사용 |

P4 port 주석의 'P2 예외를 그대로 올린다'와 기존 HTTP mapper(P4 예외만 처리)는 그대로 연결하면 충돌한다.
P4가 adapter에서 위 예외 변환을 수행하기로 수락했다. P2에 P4 HTTP 의존성을 넣지 않는다.

P4 수락 내용 및 후속 코드 확인 대상(사용자가 전달한 2026-10-26 답변):

- `get_variants_for_update([variant_id])`에 요청 ID가 없거나 다른 상품의 옵션이면 404 + rollback.
- 도메인 증감 후 같은 Repository 인스턴스의 save_variant로 flush하며,
  AdminStockService가 같은 session에서 commit/rollback한다.
- P2 InsufficientStock → P4 InsufficientStock(409), P2 InvalidStock → P4 InvalidStockAdjustment(422).
- 옵션 없는 on_sale도 재고 합계 0으로 is_sold_out=true. DB status는 자동 변경하지 않는다.
- 브랜치 `feature/chungman`, 코드 위치는 아래와 같다고 P4가 보고했다.
  - 조회: `backend/src/admin/infrastructure/product_queries.py`
  - 상태 변경: `backend/src/admin/infrastructure/product_status.py`, `backend/src/admin/application/product_service.py`
  - 재고 서비스: `backend/src/admin/application/stock_service.py`
  - P2 adapter: P4 infrastructure에 추가 예정이며 정확한 파일명은 아직 미공유.
- P4는 오늘 push 예정이며 연결 완료 후 PR에 테스트 결과를 공유하겠다고 답했다.
  **계약 수락은 확인했지만 위 최신 파일의 push·실제 코드·테스트 성공은 아직 검증하지 않았다.**

### 3-1. P3 추가 질문과 P2 답변 제안

다음 내용은 기존 명세·코드를 근거로 만든 답장 초안이다. P3가 이 세부 항목까지 수락했다고 기록하지 않는다.

**취소 시 재고 복구**

- 주문 생성은 pending이며 재고를 예약·차감하지 않는다. 결제 성공 전이에서만 차감한다.
- pending → cancelled: 상태만 변경하고 재고를 늘리지 않는다.
- paid → cancelled: 저장된 order_items의 옵션·수량만큼 한 번 복구한다.
  상품이 이후 hidden/sold_out으로 바뀌어도 취소 복구는 수행하되 상품 status는 그대로 둔다.
- 이미 cancelled인 주문: 추가 복구 없이 409/ALREADY_CANCELLED를 제안한다.
- 주문 상태 확인과 변경에 주문 행 잠금도 필요하다. 도메인의 상태 검사만으로 동시 취소·결제 중복을 막을 수 없다.
  주문 행 → 요청 전체 옵션 ID 오름차순 순서를 결제·취소에서 통일하는 방안을 P3에게 제안한다.
  P3가 사용자 행 잠금도 사용한다면 다른 흐름과 순서를 먼저 맞춘다.
- 취소 상태 저장·재고 복구는 같은 트랜잭션이다. 일부 복구·flush 후 오류라도 전부 rollback한다.
- 근거: `docs/BACKEND.md` 4·9장, `origin/yeoreum(4d25ff6)`의 Order.cancel()은 paid일 때만 True를 반환한다.
  실제 Repository·결제/취소 서비스의 잠금·저장은 아직 확인되지 않았다.

**예외·HTTP 매핑 제안 (P3 presentation 책임)**

| 상황 | P2/업무 판단 | P3 제안 응답 |
|---|---|---|
| 요청 옵션 누락 | 잠금 반환 ID와 요청 ID 비교 후 P3에서 없음 예외 | 404/UNKNOWN |
| 재고 부족 | P2 InsufficientStock을 P3 업무 예외로 변환 | 409/OUT_OF_STOCK |
| 요청 수량이 0·음수·정수 아님 | 입력 경계에서 검증, P2 InvalidStock도 방어적으로 처리 | 422/UNKNOWN |
| 구매 제한 초과 | P3 누적 구매량 검증 | 409/PURCHASE_LIMIT_EXCEEDED |
| 이미 결제했거나 결제 불가 상태 | P3 주문 잠금 후 상태 검사 | 409/INVALID_ORDER |
| 이미 취소됨 | P3 주문 잠금 후 상태 검사 | 409/ALREADY_CANCELLED |
| 판매 불가 상품 | P3 상품 상태 검사 | 409/UNAVAILABLE_ITEM |

모든 응답은 기존 `{code,message}` 계약을 사용하고 새 오류 코드를 만들지 않는다.
P2 도메인에서 HTTP를 import하지 않는다. 잠그지 않은 객체 저장 등 프로그래밍 오류나 내부 재고 불일치를
무조건 고객의 422 오류로 바꾸지는 않는다. P4의 재고 부족 409/UNKNOWN과 P3 주문용 OUT_OF_STOCK은 구분한다.

**옵션별 구매 제한과 주문 중복**

- 기존 의미는 사용자별·옵션별 누적 **paid 수량 + 이번 결제 수량 <= max_per_user**다.
  pending·cancelled는 제외, 기간 제한은 없으며 null은 무제한, 기본값은 4다.
  주문 생성/장바구니 검사는 사전 안내이고 결제 직전에 최종 검증한다.
- 같은 옵션이 요청에 여러 번 나오면 P3가 수량을 합쳐 검증한다. Repository의 ID 중복 제거가 수량 집계를 대신하지 않는다.
- 옵션 잠금 획득 후 최신 구매 제한·paid 집계·재고를 검증한다. 같은 사용자의 동시 결제가 제한을 우회하지 않는지
  P3 로컬 DB에서 검증해야 한다(격리 수준과 사용자 잠금 여부 포함).
- 같은 order_id의 반복/동시 결제는 주문 행 잠금 후 pending → paid 한 번만 허용하고 재고도 한 번만 차감한다.
  취소 역시 한 번만 복구한다. 버튼 비활성화나 order_items UNIQUE만으로 해결하지 않는다.
- **서로 다른 order_id의 중복 생성**은 별도 문제다. 현재 스키마에는 생성 요청용 idempotency key가 없다.
  동일 입력 재전송 시 자동으로 같은 주문을 반환한다고 보장하지 않는다. 그런 요구가 있으면 P3가 명세를 정하고
  스키마 변경 필요 시 P1과 협의한다. 이번 단계에서 새 컬럼·migration은 만들지 않는다.
- 근거: `supabase/migrations/20261013000001_add_direct_order.sql`의 최신 pay_order,
  `20261012000013_add_shipping_fee.sql`, `docs/BACKEND.md` 4·9장.
  기존 SQL은 정책 확인용으로만 읽었고 공용 PostgreSQL에서 실행하지 않았다.

## 4. 상품 상태·모델 소유권

- [PR #1 상재 답변](https://github.com/hiju200208-png/KANT_MOA_develop/pull/1#issuecomment-6406167182):
  DB status는 재고 때문에 자동 변경하지 않는다. on_sale이고 재고 합계 0이면 조회에서 품절로 계산한다.
  수동 sold_out과 hidden은 재입고해도 유지한다. 일반 조회는 hidden 제외, hidden 상세도 404이다.
- P2 조회 기준: 옵션이 없는 on_sale 상품도 합계 0으로 품절 표시하고 구매할 수 없게 한다.
  조회 중 기본 옵션을 자동 생성하지 않는다. 정상 시드에는 기본 또는 선택 옵션이 있어야 한다.
  P4 원격 계산도 total_stock=0이면 on_sale을 품절로 계산한다. P4는 사용자에게 전달한 답변에서 이 경계 정책도 수락했다.
- P4 hidden은 공개 품절 표시와 구분한다. hidden의 관리자 표시를 P2 공개 응답으로 노출하지 않는다.
- 위 5개 ORM은 모두 `database.Base`를 공유한다. P4 조회도 이 모델을 import하고 같은 테이블을 재정의하지 않는다.
- 초기 SQL 기준 bigint GENERATED ALWAYS IDENTITY, 원 단위 integer, timezone-aware created_at,
  FK·NULL·CHECK·기본값을 매핑했다. P1/P4 최신 미공개 모델과 실제 공용 DB 전체 스키마 비교는 미완료다.
- P4 `product_status.py`와 공통 상태 변경 함수의 최종 소유권은 최신 코드 확인 후 정한다.

## 5. Alembic·시드: P1 현황과 공용 기준 합의 대기

- P1 답변(사용자 전달): 최초 revision이자 로컬 head는 `cd2b7db3c89b`, down_revision=None,
  생성 대상은 users·token_blacklist·블랙리스트 만료 인덱스이며 후속 revision은 없다.
  P1 로컬 Docker DB에만 적용했고 공용 DB의 Alembic 이력은 확인하지 않았다.
  아직 미커밋이므로 실제 revision 코드·DDL은 P1 PR에서 대조해야 한다.
- 공용 DB에는 이미 초기 SQL로 18개 테이블이 있다. 초기 생성 revision 재실행·비교 없는 stamp는 하지 않는다.
- P1에게 추가로 필요한 자료: 초기 revision 코드와 이후 변경 시 단일 head, 실제 공용 alembic_version 여부,
  users.role 자료형·인증 수단 CHECK·이메일 CHECK·blacklist 인덱스 변경 내역.
- P1이 수락한 안전 절차: 공용 기준 스키마 대조 → 초기 이력 처리 합의 → 필요한 차이만 후속 migration.
  검증 없는 stamp·초기 SQL 재실행을 하지 않는다.
- P1 migrations/env.py는 현재 인증 모델만 수집한다는 보고다. 통합 시
  `products.infrastructure.models`를 포함한 전체 모델 수집을 함께 맞추기로 했다.
  전체 모델 수집 전 공용 18개 테이블에 autogenerate하지 않겠다고 답했다.
  기존 테이블이 metadata에 없다는 이유로 삭제 migration이 생성되지 않도록 검토한다.
- 최초 공용 기준·전체 모델 수집·시드 진입점은 P1·P2·배포 담당자가 함께 정한다는 방향에 동의했다.
  구체적 최초 기준 처리·최종 revision 계보·진입점 명령은 아직 미확정이다.
- 먼저 로컬 빈 DB에서 migration 결과와 초기 SQL의 컬럼·제약·기본값·인덱스를 비교한다.
  이후 실제 공용 스키마·이력을 읽기 전용 비교하고 기준 등록/후속 적용 절차를 결정한다.
- 초기화 소유권은 회원·관리자 P1, 카탈로그 P2로 확인됐다. 통합 실행 순서는 함께 맞춘다.
  시드 진입점 명령은 확인 대기다. P2 제안은 `python -m products.infrastructure.seed`이며 현재 파일은 없다.
  공통 시드가 이미 있으면 거기에 연결하고, seed 함수는 주입받은 session을 쓰며 최상위 실행부가 commit한다.
  타 담당 데이터 삭제·주문/회원 덮어쓰기는 하지 않는다. 재실행 식별 기준은 4단계에서 검증한다.

## 6. 실제 화면 호출과 P2 API 작업 기준

현재 호출은 Supabase이며 아래 FastAPI 경로는 후속 구현 기준이다. 배포·인증 연결 완료 명세가 아니다.

| 현재 호출·사용처 | 입력/반환 | FastAPI 연결 기준 |
|---|---|---|
| getProducts: ProductListSection, 홈·아티스트 영역 | artistSlug/categorySlug/sort/limit/offset/excludeId → items,total | GET /products?artist=&category=&sort=&page=&size=&exclude_id= |
| searchProducts: /search | q/limit/offset → items,total | GET /products?q=... + 같은 목록 형식 |
| getProduct: /products/[id] | id → ProductDetail 또는 null | GET /products/{id}, 404만 null로 변환 |
| getCategories: 상품·카테고리 탭 | Category[] | GET /categories, 활성 항목을 sort_order/id 순서로 반환 |
| getWishlist: LikedProducts | 최근 찜한 ProductSummary[] | GET /wishlist?page=&size=, 현재 사용자·hidden 제외 |
| getWishedIds/isWished: 하트·최근 본 상품 | number[] / boolean | GET /wishlist/ids, 현재 사용자·hidden 제외 |
| toggleWishlist: LikeButton | productId → 변경 후 boolean | PUT/DELETE /wishlist/{product_id}로 원하는 상태 지정(후속 구현 제안) |

- 목록은 `{items,total,page,size}`, page>=1, size=1..100. 필터 후 전체 수를 total로 반환한다.
- 공개 응답은 snake_case, services가 기존 camelCase로 변환한다. 상세는 이미지 종류별 정렬 경로,
  옵션 추가금·최종 가격·재고·구매 제한을 제공한다. 상대 이미지 경로는 API origin과 결합한다.
- **페이지 변환 주의:** 현재 '더 보기'는 offset=0, limit=20/40/.../500이며 parseLimit는 25 같은 값도 허용한다.
  단순히 page=offset/limit+1, size=limit로 보내면 size>100과 비정렬 offset에서 깨진다.
  services에서 고정 size=100의 필요한 페이지를 조회·결합 후 요청 offset/limit 구간을 잘라 기존 화면을 유지한다.
  size를 초과한 나머지 결과를 조용히 버리지 않으며 이 변환은 7단계에서 별도 검증한다.
- 검색은 상품명·아티스트 영문/한글명 부분 일치. q가 없으면 전체, 명시된 q가 공백이면 빈 결과.
  q 최대 100자, %/_는 리터럴로 escape, 값은 바인딩한다. 기존 특수문자 제거 정책과 달라지는 점을 명세에 남긴다.
- latest는 created_at DESC/id DESC, 가격순은 price ASC 또는 DESC/id ASC. GET은 상태를 수정하지 않는다.
- 찜 제안: PUT 중복 추가·DELETE 반복 해제는 멱등, 없는/hidden 상품 추가는 404,
  hidden 기존 찜은 조회에서 제외하되 해제 가능. user_id는 요청에서 받지 않는다.
  현재 toggleWishlist 호출은 후속 화면 단계에서 원하는 상태를 전달하는 방식으로 맞춰야 한다.
- 공개 조회 캐시와 인증된 찜 캐시는 분리한다. API 오류를 fallback 상품으로 덮지 않는다.
  현재 products.ts의 fallback, Supabase Storage 변환, AuthProvider를 연결 완료로 간주하지 않는다.

## 7. 최초 팀원 확인 요청 문안 (사용자가 전달, 후속 답변은 2·3·5장에 반영)

**P1 희주님**

> P2 재고 PR #42가 main에 병합됐습니다. 인증 구현 PR/커밋과 get_current_user 반환 클래스·id 타입·role 표현,
> Bearer 토큰의 프론트 저장·복원 방식을 알려주세요. Alembic 최초/후속 revision과 head, 공용 이력 여부도 필요합니다.
> P2 ORM import는 products.infrastructure.models입니다. 최초 공용 기준·모델 수집·시드 진입점을 같이 맞추고 싶습니다.
> 아직 공통 파일·migration·공용 DB는 변경하지 않았습니다.

**P3 여름님 / P4 충만님**

> P2 ProductRepository(session).get_variants_for_update(ids)는 id 오름차순 list[ProductVariant]를 반환합니다.
> 빈 입력은 [], 누락 ID는 제외하므로 호출자가 전체 요청 ID와 비교해 rollback해주세요.
> 반환 객체의 increase_stock/decrease_stock 후 같은 Repository.save_variant(객체)로 flush하고,
> 서비스가 같은 session에서 commit/rollback하는 계약으로 연결해도 될까요?
> P4는 P2 InsufficientStock/InvalidStock을 기존 P4 예외로 변환해야 합니다.
> 최신 조회·상태 변경/결제 코드 위치와 이 계약의 수락 여부를 알려주세요.
> 옵션 없는 on_sale은 재고 0과 같이 품절·구매 불가로 처리하고, DB status는 자동 변경하지 않겠습니다.

## 8. 1단계 완료 판단

- 완료: 변경 보존, 원격 재확인·병합 반영, 기존 합의 근거 확인, import·재고 동작 문서화,
  실제 프론트 호출 및 페이지/필드/이미지 변환 명세, 팀원에게 전달할 구체적 요청 문안 준비.
- 추가 확인: 사용자가 팀에 요청 문안을 전달했다. P3는 같은 세션·트랜잭션에서 재고를 재사용하고
  전체 항목 검증 후 한 번 commit, 중간 오류 rollback하는 방향에 동의했다.
- P4 계약 확인 완료: 잠금·누락·다른 상품 옵션 404/rollback, 같은 객체 save/flush, 같은 세션의 서비스 트랜잭션,
  예외 변환 및 옵션 없는 상품의 품절 계산에 동의했다. 코드 위치는 보고받았으며 push·PR·실제 테스트는 확인 대기다.
- P1 계약 확인 완료: CurrentUser import·필드·UUID/role 타입·DB 기준 권한·Bearer 인증,
  로컬 최초 revision과 적용 범위, 공용 스키마 대조 후 초기 이력 처리 방향, 회원/카탈로그 초기화 소유권.
- 후속 PR 대조·로컬 조합 검증 완료: P1 #49·P4 #50과 P2 재고를 조합해 전체 171개 테스트가 통과했다.
  P1 revision과 ORM의 차이·auth 전용 metadata의 삭제안은 별도 로컬 DB에서 재현했다. [PR 검토 기록](P1_P4_PR_REVIEW.md) 참고.
- 대기: P1 migration 보정·프론트 토큰 저장·복원·최초 공용 Alembic 처리·전체 모델 수집·시드 진입점,
  P3 추가 질문(취소·예외·구매 제한·중복)의 세부 합의 및 최신 코드,
  P4 P2 ORM 재사용·운영 재고 adapter 구현 및 해당 연결의 통합 테스트 확인.
- **따라서 1단계 전체 완료는 아니다.** 답변을 받은 뒤 코드와 대조해 남은 체크를 완료한다.
