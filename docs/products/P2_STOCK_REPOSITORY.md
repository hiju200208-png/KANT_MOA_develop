# P2 3단계: ORM·공통 재고 Repository 검증

기록일: 2026-10-26 KST. 상태: **P2 구현·로컬 검증 및 P1/P4 Draft PR 대조 완료, 운영 재고 adapter 통합 대기**.
이 기록은 인수인계 11장의 3단계다. 시드·상품 API·찜·프론트·서버 배포로 진행하지 않았다.

## 1. 제공 코드와 책임

```python
from products.domain.variant import ProductVariant, InvalidStock, InsufficientStock
from products.infrastructure.models import (
    ArtistModel, CategoryModel, ProductModel, ProductVariantModel, ProductImageModel,
)
from products.infrastructure.repositories import ProductRepository
```

- 모든 ORM은 기존 `database.Base`를 사용한다. P4는 이 모델을 재사용하고 같은 테이블을 중복 정의하지 않는다.
- Repository는 주입받은 AsyncSession으로 조회·ORM↔Domain 변환·flush만 한다.
  세션을 새로 만들거나 commit/rollback하지 않는다. Application 서비스가 업무 전체를 commit/rollback한다.
- 상품·옵션·아티스트·카테고리·이미지의 기존 스키마를 매핑했다. users ORM은 P1 소유라 새로 만들지 않았다.

## 2. 재고 인터페이스

| 호출 | 계약 |
|---|---|
| `ProductRepository(session)` | 주문·관리자 서비스가 사용하는 바로 그 AsyncSession 주입 |
| `await repository.get_variants_for_update(ids)` | 양의 int ID iterable, bool 거부. 중복 제거, ID 오름차순 FOR UPDATE. 반환 list[ProductVariant] |
| 빈 목록 | [] 반환, 잠금 SQL 없음 |
| 없는 옵션 | 반환 목록에서 제외. 서비스가 전체 요청 ID와 비교해 누락을 발견하면 업무 중단·rollback |
| 조회 결과 | ORM이 아닌 순수 ProductVariant. 옵션·추가금·재고·구매 제한·정렬 정보 포함 |
| `variant.increase_stock(q)` / `decrease_stock(q)` | 도메인 검증 후 증감, 변경 재고 int 반환 |
| `await repository.save_variant(variant)` | 같은 Repository가 잠금 조회한 동일 객체의 stock만 저장·flush. 반환 None |

- 오래된 identity map 객체가 있어도 `populate_existing=True`로 잠금 획득 후 최신 재고를 읽는다.
- 전체 옵션을 한 번에 잠근다. ID를 나누어 잠그는 호출도 업무 전체의 잠금 순서가 역전되지 않아야 한다.
- 다른 Repository의 객체, 복제 객체, commit/rollback 후 객체는 저장할 수 없다.
- **savepoint 경계를 넘은 객체도 저장을 거부한다.** savepoint 종료 후에는 다시 잠금 조회한다.
  rollback은 savepoint 안에서 획득한 행 잠금을 풀 수 있으므로 root transaction만 비교해서는 충분하지 않다.
  보수적으로 savepoint commit 후에도 다시 조회하도록 한다.
- 반복 조회한 동일 ID는 마지막으로 받은 객체를 사용한다.
- 구매 가능 상태·사용자별 구매 제한 집계·주문 중복 처리는 P3 책임이며 이 Repository가 대신하지 않는다.

누락 확인과 저장의 최소 예시(서비스의 try/rollback 및 최종 commit 안에서 수행):

```python
repository = ProductRepository(session)
variants = await repository.get_variants_for_update(quantities)
if {variant.id for variant in variants} != set(quantities):
    raise LookupError("존재하지 않는 옵션이 있어요.")
for variant in variants:
    variant.decrease_stock(quantities[variant.id])
    await repository.save_variant(variant)
# 같은 session의 주문 저장 등 업무를 모두 마친 후 서비스가 한 번 commit한다.
```

## 3. 추가 검증으로 발견하고 고친 문제

### 무제한 구매 제한이 기본값 4로 저장됨

ORM에서 max_per_user=None을 지정했는데 server_default 때문에 INSERT에서 빠져 4가 저장되는 것을 재현했다.
`Integer().evaluates_none()`으로 명시적인 None은 SQL NULL, 생략은 기본값 4가 되도록 수정했다.
데이터베이스 스키마 변경은 없다. 옵션의 전체 정보·NULL·재고 변경 후 보존을 실제 DB로 검증했다.

### savepoint rollback 이후 풀린 잠금의 객체 저장 허용

기존 검사는 root transaction만 비교하므로 savepoint rollback 뒤에도 예전 객체 저장을 허용했다.
잠금 조회 시 root와 nested transaction을 함께 기록하고 저장 시 둘 다 같은지 확인하도록 수정했다.
동일 root 안에서도 이미 종료된 savepoint에서 조회한 객체는 저장을 거부하는 회귀 테스트가 통과했다.

### PostgreSQL 기동 검사

Docker 초기화 중 소켓으로만 열리는 임시 서버를 준비 완료로 오인한 실패도 재현됐다.
테스트 fixture의 pg_isready에 TCP host 127.0.0.1을 지정해 최종 서버 준비 후 초기 SQL을 적용한다.

## 4. 실제 DB 검증 방법과 결과

```powershell
cd C:\dev\KANT_MOA_develop\backend
$env:P2_RUN_POSTGRES_TESTS='1'
.venv/Scripts/python.exe -m pytest -q --tb=short
```

- 최종 결과: **75 passed**, 4.58초. P2 테스트 28개와 기존 공통/P4 테스트 47개다.
- 기존 FastAPI/Starlette TestClient의 httpx 사용 중단 예정 경고 1개가 있으며 실패는 없다.
  이번 작업에서 공통 의존성은 변경하지 않았다.
- fixture가 매 실행 새 `kant-p2-test-...` Docker PostgreSQL 18을 만들고 로컬 임의 포트에만 연결한다.
  기존 DATABASE_URL·Compose DB·공용 DB를 테스트 대상으로 쓰지 않는다.
- 초기 SQL은 fixture가 만든 빈 DB에만 한 번 실행한다. 테스트 종료 후 그 컨테이너와 볼륨만 제거한다.

검증 항목:

- 초기 SQL의 public 테이블과 ORM으로 만든 별도 p2_orm_contract 스키마를 PostgreSQL에서 직접 비교했다.
  P2 5개 테이블의 자료형·NULL·기본값·identity 설정·PK·UNIQUE·FK/ondelete·CHECK가 일치했다.
  기존 users.id의 UUID도 확인했으며 P1 모델은 중복 정의하지 않았다.
- ID 중복 제거·빈 입력·누락 옵션·정렬, 옵션 전체 정보의 ORM↔Domain 변환.
- flush 직후 다른 세션에는 변경 전 값이 보임: Repository가 commit하지 않음.
- rollback으로 재고 복구, commit/rollback 이후 이전 객체 저장 거부.
- 독립 세션의 실제 잠금 대기를 pg_blocking_pids로 관찰한 뒤 commit/rollback으로 해제.
- 잠금 대기 전 재고 5를 읽은 세션도 잠금 획득 후 최신 재고 1을 읽고 과다 차감 거부.
- 7개 동시 차감 후 최종 재고 0으로 유실 없음.
- 첫 옵션을 flush한 뒤 다음 옵션에서 부족이 발생하면 두 옵션 재고 모두 원복.
- 높은 ID 옵션을 다른 세션이 보유한 상태에서 역순 입력으로 조회해도 먼저 낮은 ID 잠금을 획득함을
  세 번째 세션의 실제 대기와 blocking PID로 확인했다. 단순 반환 정렬이나 우연한 동시 실행만 확인한 것이 아니다.
- timeout을 둔 DB 잠금 상태 관찰로 실행 순서를 제어했다. 짧은 polling sleep은 상태 관찰 간격이며 성공 근거가 아니다.

## 5. P4 연결 예시 검증

실행 가능한 테스트용 adapter는 [test_stock_repository.py](../../backend/tests/products/test_stock_repository.py)의
`ExampleAdminStockAdapter`다. P4 운영 adapter를 중복 구현한 것이 아니라 연결 계약을 검증하는 테스트 예시다.

- 현재 main의 실제 AdminStockService에 이 adapter와 동일 AsyncSession을 주입했다.
- 정상 입고·차감은 서비스가 commit하고 다른 세션에서 결과를 확인했다.
- P2 InsufficientStock → P4 InsufficientStock → 기존 mapper의 409 변환과 rollback을 확인했다.
- P2 InvalidStock → P4 InvalidStockAdjustment → 422 변환을 확인했다.
- 없는 옵션·다른 상품 옵션은 P4 VariantNotFound → 404, rollback 후 재고 유지였다.
- 테스트 예시는 DB 재고 흐름과 예외 mapper를 검증했다. P1 실제 토큰·HTTP 인증·P4 운영 adapter 통합 완료를 뜻하지 않는다.

## 6. 파일과 남은 경계

- [ORM](../../backend/src/products/infrastructure/models.py)
- [Repository](../../backend/src/products/infrastructure/repositories.py)
- [초기 SQL 대조 테스트](../../backend/tests/products/test_model_schema.py)
- [재고·동시성·P4 연결 예시 테스트](../../backend/tests/products/test_stock_repository.py)
- [전용 Docker fixture](../../backend/tests/products/conftest.py)
- [팀 연결 계약과 답변 기록](P2_CONNECTION_CONTRACT.md)

후속 fetch로 P1 #49·P4 #50을 확인해 모델·인증·조회/상태 변경 코드를 대조했다.
P1은 같은 Base의 인증 ORM, P4는 중복 ORM 없이 raw SQL 조회를 사용한다. P2 테이블 중복 모델은 발견하지 않았다.
P4 운영 adapter·P2 ORM 재사용은 여전히 PR의 미완료 항목이다. [PR 대조 기록](P1_P4_PR_REVIEW.md)을 참고한다.
P4 운영 adapter·P3 결제/취소의 실제 통합은 후속 구현·로컬 DB 검증이 필요하다.
그 범위를 완료로 체크하지 않는다. 공용 스키마 직접 비교·Alembic·공통 파일·배포도 이번 작업에서 수행하지 않았다.
