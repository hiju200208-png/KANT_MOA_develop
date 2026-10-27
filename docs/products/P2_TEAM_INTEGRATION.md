# P2 9단계 · 팀 통합·배포 전 검증

기준: 2026-10-27. 8단계 코드 `992d0f1`, 최신 병합 main `adfc4e6` 반영.
**로컬 팀 통합 검증과 홈페이지·API 공개 배포 완료. 9단계 테스트·배포 구성·기록을 별도 변경으로 정리한다.**
8단계 PR #72는 병합됐다. 이번 변경은 그 이후의 팀 통합 검사와 운영 배포 구성이다.
공용 DB에 실패·동시성 테스트, 초기화, SQL·시드·migration 실행을 하지 않았다.

## 코드 연결 확인

- P3 `orders.presentation.dependencies.get_order_service`: 주문·장바구니·재고·트랜잭션에 동일 AsyncSession 전달.
- P3 `ProductStockAdapter`: P2 ProductRepository 한 인스턴스에서 옵션 전체 ID를 잠금 조회하고
  동일 ProductVariant 객체의 decrease/increase_stock → save_variant를 호출한다.
- P4 `P2VariantStockAdapter`: 같은 세션/Repository로 단일 옵션 잠금·도메인 증감·flush를 처리한다.
- P2 Repository는 ID 오름차순 FOR UPDATE, 최신 값 재조회, 동일 트랜잭션·저장점·객체 검증을 한다.
  Repository가 commit/rollback하지 않고 P3/P4 서비스가 성공 시 commit, 실패 시 rollback한다.
- 구매 제한은 P3가 회원별·옵션별 paid 주문 수량만 집계한다. pending/cancelled는 제외한다.
  paid 취소는 재고를 한 번 복구하고 상품이 hidden이어도 취소를 허용한다. P2가 주문 계산을 중복 구현하지 않는다.

## 신규 실제 토큰 API 통합 검사

`backend/tests/products/test_team_integration.py` 4개. 기존 P1 회원가입/로그인과 실제 앱·DB를 사용한다.
관리자는 테스트 DB의 실제 회원 role을 ADMIN으로 설정해 P1 DB 권한 검사를 통과시킨다.
인증을 dependency override로 생략하거나 별도 관리자 JWT를 만들지 않는다.

| 시나리오 | 실제 결과·DB 증거 |
| --- | --- |
| 결제 2개와 관리자 +5 동시 실행 | 둘 다 200, 재고 10 → 13. 취소 후 15 |
| 마지막 1개를 결제·관리자 -1 동시 차감 | 200 한 건·409 한 건, 재고 0. 결제 성공 여부와 paid/pending 일치 |
| 재고·주문 저장 후 실제 DB CHECK 오류 | 전체 rollback, 두 옵션 총재고 20 유지·주문 pending·paid_at NULL·장바구니 2행 유지 |
| 오류 후 같은 주문 재시도 | 정상 결제, 두 옵션 총재고 20 → 18 |
| 미인증/일반 회원 관리자 조회 | 401 / 403 |
| 구매 제한 2개 결제 후 추가 구매 | 409 PURCHASE_LIMIT_EXCEEDED |
| P4 상태 변경 후 공개 상세 | hidden 변경 200, 일반 상품 조회 404, 재고 8 유지 |
| hidden 상태에서 paid 주문 취소·재취소 | 첫 취소 재고 8 → 10, status hidden 유지. 재취소 409·재고 10 유지 |
| 취소 후 구매 제한 재확인 | 동일 옵션 2개 주문 재생성 성공 |
| 관리자 과도한 차감·다른 상품 옵션·잘못된 상태 | 409 / 404 / 422, 재고 유지 |

기존 P3/P2 테스트도 다중 옵션 부족·동시 결제·이중 결제/취소·부분 flush 후 실패·잠금 해제·세션 재사용을 검증한다.
위 결과는 배포 DB가 아닌 fixture가 만든 새로운 Docker DB에서만 확인했다.

## 전체 검증

별도 소스 사본에 임시 PostgreSQL 18 DB를 만들고 P1/P2/P3/ADMIN DB 테스트를 모두 활성화했다.
기존 개발용 backend/.env는 사용하거나 변경하지 않았다. 검증 사본의 임시 .env와 테스트 DB는 종료 시 정리했다.

- 신규 통합 검사: **4 passed / 0 skipped**.
- 전체 백엔드: **515 passed / 0 skipped**, 기존 Starlette/httpx 사용 중단 예고 경고 1개.
- 빈 로컬 DB의 기존 Alembic 3개 적용 성공. head `3f21520f9615`.
- 전체 검사 후 Alembic check: **No new upgrade operations detected**.
- 515개 결과는 배포 구성 추가 전 통합 검사다. 이후 Next.js standalone·Nginx 배포 구성을 추가했고,
  Swagger OAuth2 tokenUrl을 `auth/login` 상대 경로로 바꿔 `/api` 뒤에서도 인증하도록 했다.
  변경 후 공통 회귀 검사 **2 passed**. Linux Docker의 API·프론트 이미지 빌드와 프록시 HTTP 검사 통과.
  실제 브라우저에서 원본 이미지·회원가입·자동 로그인·찜·새로고침 유지 확인. 상세는 [배포 구성](../../deploy/staging/SITE.md).
  기존 프론트 테스트 34개·lint·typecheck·build와
  PC/모바일 실제 화면은 [8단계 검증](P2_DISCOVERY_API.md)을 참조하며 이번 단계 신규 결과와 구분한다.

### 다른 팀원의 집중 검사 재현

Docker Desktop을 실행하고 backend 폴더에서 아래처럼 테스트 전용 환경값으로 실행한다.
새 PowerShell 창에서 실행해 개발 환경변수와 섞지 않는다. URL은 실제 DB가 아닌 사용하지 않는 로컬 placeholder이며,
테스트 fixture가 별도로 만든 Docker DB에 API 세션을 연결한다.

```powershell
$env:DATABASE_URL = 'postgresql+asyncpg://unused:unused@127.0.0.1:1/unused'
$env:JWT_SECRET = 'local-integration-test-only-not-for-deployment-000000000'
$env:P2_RUN_POSTGRES_TESTS = '1'
try {
    uv run pytest tests/products/test_team_integration.py -q
} finally {
    Remove-Item Env:P2_RUN_POSTGRES_TESTS -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue
}
```

전체 기본/전용 DB 회귀는 기존 `uv run python scripts/check.py`로 실행한다.
이 공식 스크립트는 관리자 DB 옵션을 끄므로 515개 전부 활성화한 별도 검사와 숫자가 다르다.
9단계 최종 공식 검사 결과: 마이그레이션 DB **414 passed / 101 skipped**,
P2/P3 별도 일회용 Docker DB **329 passed / 0 skipped**. 기본 검사의 skipped는 별도 DB 옵션이 필요한 검사다.
프론트 lint·typecheck·테스트 **34 passed**도 최종 재확인했다.
복구 모의 검사는 저장소 루트에서 `python deploy/staging/check_site_switch.py`로 실행한다.

## 배포 전 공개 서버 읽기 전용 확인

사용자가 배포 완료를 전달한 공개 ngrok API에 GET만 요청했다. 테스트 계정·주문·재고를 만들거나 바꾸지 않았다.

| 요청 | 실제 결과 |
| --- | --- |
| /health | 200, status ok / database ok |
| /openapi.json | 200, 경로 25개. /artists 미등록 |
| /products?size=1 | 200, 공개 상품 total 387 |
| /wishlist/ids (토큰 없음) | 401 NOT_AUTHENTICATED |
| /admin/products | 404 UNKNOWN — 최신 관리자 API가 아직 미반영 |
| /products/9223372036854775807 | 404 UNKNOWN |
| /products?page=0 | 422 UNKNOWN |
| /artists | 404 UNKNOWN — 8단계 미반영 |

위 표는 이번 배포 전 기록이며, 아래 전환 후 결과와 구분한다.

## 홈페이지·API 공개 전환 완료

사용자 실행 결과 `SITE_CANDIDATE_READY` 후 `SITE_DEPLOY_SUCCESS`, `SSH_EXIT=0` 확인.
release `site-20261027T112518Z-602d436c`, 기준 main `adfc4e6`에 배포 구성·Swagger 수정이 포함된 소스다.
소스 SHA256과 관리·복구 경로는 [배포 기록](../../deploy/staging/SITE.md)을 참조한다.

- 내부·공개 홈페이지·Swagger 200, API 경로 45개, 공개 상품 387개.
- 토큰 없는 보호 API 401, DB 전후 내용 동일(`database_unchanged=true`).
- 홈페이지 `/`, API `/api/`, Swagger `/api/docs`로 동일 ngrok 주소를 사용한다.
- 공개 브라우저에서 홈페이지·상품 상세·원본 이미지 렌더링을 확인했다. 공개 계정 생성·찜·주문 등 쓰기 검사는 하지 않았다.
- 기존 API 이미지·설정 백업 완료. 복구 흐름은 로컬 모의 검사에서 확인했고 실제 전환은 복구 없이 성공했다.
- 공개 환경에 회원·주문·재고 쓰기 테스트나 SQL·시드·마이그레이션은 실행하지 않았다.

## 남은 배포·제출 확인

- [x] P2/P3/P4 재고·트랜잭션·구매 제한 계약 대조
- [x] 실제 토큰 API의 정상·실패·동시성·rollback과 DB 전후 증거
- [x] 전체 515개 검사·스키마 추가 변경 없음
- [x] 공개 서버 GET 스모크와 미반영 범위 기록
- [x] 8단계 PR #72 병합·최신 main 반영
- [x] 프론트 미배포 확인, 동일 서버 Nginx `/`·`/api` 방식 사용자 승인 및 로컬 검증
- [x] SHA256으로 식별한 API·프론트 소스 배포 후 health·OpenAPI·공개 카탈로그·미인증 401 확인
- [ ] PR/일지에 최종 배포 커밋·시각·결과 기록

마이그레이션·시드 변경이 없으므로 초기 SQL·시드를 다시 실행하지 않는다. 기존 원본 이미지·업로드·환경값을 보존한다.
배포 전후 DB 값 기록과 복구용 이미지 태그를 확보한다. 기존 stage5/catalog/백업 폴더를 임의 삭제하지 않는다.
공용 최초 이력 등록(PR #63)은 P1 담당의 별도 절차이며 이번 배포와 혼합하지 않는다.

9단계 산출물은 이 문서·통합 검사·배포 구성이다. 8단계 산출물은 [PR #72](https://github.com/hiju200208-png/KANT_MOA_develop/pull/72).
