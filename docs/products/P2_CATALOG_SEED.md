# P2 4단계 · 실제 프로젝트 카탈로그·원본 이미지 이관 준비

기록일: 2026-10-27 KST. **기존 프로젝트 전체 데이터의 로컬 검증 및 사용자 승인 후 공용 DB·서버 이미지 적용 완료.**
P1 공통 실행 파일 연결·5단계 상품 API는 별도 후속이다. 이번 작업에서 Git push는 하지 않았다.

## 범위와 원본

사용자가 제공한 `kant-moa-storage (1).zip`은 원본 WebP **1,847개, 193,475,618 bytes**다.
이는 7개 상품용 이미지 묶음이 아니다. 앞선 데모 7개·선택 이미지 20개 방식은 폐기하고 전체 기준으로 교체했다.

ZIP에는 상품명·가격·재고를 담은 DB 데이터가 없다. 앞서 이전한 학원 Docker DB dump도 모든 테이블이 0행이었다.
따라서 **저장소의 실제 프로젝트 SQL 데이터**를 원본으로 재구성했다.
`supabase/seed.sql`을 먼저 적용하고, 이후 migration 25개에 있는 카탈로그 DML을 순서대로 적용했다.
총 26개 파일·75개 INSERT/UPDATE/DELETE 문이다. PostgreSQL 파서 pglast 8.7로 문장을 분리·분류해
문자열·공지 본문의 세미콜론과 dollar quote를 보존했다.

- 새 로컬 Docker DB에서만 원본 DML을 재생했다. 사용자 DB 주소를 받는 옵션이 없다.
- Supabase 인증·회원·RLS·GRANT·RPC·트리거·테이블 생성 migration은 추출하지 않았다.
- 재구성 대상 스키마 준비에는 새 로컬 컨테이너에서만 기존 초기 SQL을 사용했다.
- 이것은 원본 **SQL 이력의 최종 상태**이며, 원격 Supabase의 현재 DB를 직접 export한 것은 아니다.
  SQL 밖에서 수정된 값이나 원격 회원·주문은 이 자료로 복원할 수 없다.
  명시되지 않은 created_at 기본값은 재구성 당시 시각이다. 해당 한계를 실제 운영 이력과 구분한다.
- 원본 초기 공지의 고정 product_id는 재구성 상품 ID와 논리적으로 맞지 않는 경우가 있었다.
  `catalog_notice_links.json`의 명확한 공지 제목 → 원본 SKU 경로 9개를 대조해 실제 연결이 달랐던 8건을 보정했다.
  상품·공지 ID, 제목·본문·가격·재고는 유지하고 공지의 product_id만 올바른 실제 상품으로 정렬했다.
  스냅샷에는 원래/보정 ID 목록도 기록한다. 단순 FK 존재 여부 검증과 상품 의미 일치를 구분한다.

## 실제 전체 데이터

| 테이블 | 행 수 |
|---|---:|
| artists | 11 |
| categories | 7 |
| products | 389 |
| product_variants | 642 |
| product_images | 1,390 |
| artist_members | 13 |
| artist_banners | 5 |
| home_banners | 0 |
| notices | 35 |
| shop_settings | 1 |

총 10개 테이블 2,493행이다. 원본의 상품 상태는 on_sale 387개 / hidden 2개다.
sold_out이나 옵션 없는 가짜 상품을 추가하지 않았다. 원본의 옵션명·가격·재고·구매 제한·NULL·배지·발매일·
공지 본문·배송비 설정을 유지했다. home_banners는 원본 데이터가 없어 빈 상태를 그대로 유지한다.

## 원본 이미지

- ZIP 전체 1,847개를 `backend/assets/artists/`, `backend/assets/products/`에 원본 그대로 풀었다.
- 리사이즈·재인코딩·파일명 변경 없음. 경로 탈출·심볼릭 링크·중복 이름과 WebP 매직 바이트를 검사했다.
- DB의 버킷 상대 경로만 `/static/artists/...`, `/static/products/...`로 변환했다.
- 카탈로그에서 참조하는 이미지 누락 **0개**.
- `backend/assets/catalog-image-manifest.json`에 전체 경로·크기·SHA256을 기록했다.
- ZIP SHA256: `01f2c6d12c576f3822dfb31ab3b5c8737ebc010124199455aba9624f7a97f6b1`.
- 193MB 원본 이미지는 assets/.gitignore로 Git에서 제외했다. JSON 목록과 준비 스크립트는 코드로 관리한다.
  팀원·배포 환경에는 원본 ZIP을 별도로 전달해 이미지를 먼저 준비해야 한다.
- 사용자 승인 후 현재 서버에도 원본 묶음을 배포했다. 상세는 아래 공용 적용 결과를 참고한다.
  이후 별도 환경에서 앱을 빌드할 때도 assets 준비가 필요하다.

### 팀원이 이미지만 준비하는 명령

저장소 루트에서 실행한다. uv와 원본 ZIP이 필요하며 DB에는 접속하지 않는다.
카탈로그 JSON·정식 manifest를 다시 생성하지 않는다.

```powershell
uv run --script backend/scripts/build_catalog_snapshot.py --images-only --archive "$env:USERPROFILE\Downloads\kant-moa-storage (1).zip"
```

### 원본 SQL부터 다시 재구성하는 명령

개인 로컬 Docker에서만 수행한다. 재구성 시각 기본값 등이 달라질 수 있으므로 단순 환경 준비에는 위 images-only를 쓴다.
공유 데이터 원본이 바뀐 경우에만 결과를 리뷰한 뒤 스냅샷을 갱신한다.

```powershell
uv run --script backend/scripts/build_catalog_snapshot.py --archive "$env:USERPROFILE\Downloads\kant-moa-storage (1).zip"
```

## 입력 방법·재실행 정책

- 스냅샷: `backend/src/products/infrastructure/catalog_snapshot.json`.
  원본 SQL 파일별 SHA256·적용 문장 수·ZIP 버전·모든 카탈로그 행을 포함한다.
- 함수: `await products.infrastructure.seed.seed_catalog(session)`.
- 일반 DATABASE_URL을 사용하지 않는 로컬 CLI: `python -m products.infrastructure.seed`.
  P2_SEED_DATABASE_URL에 준비된 개인 로컬 DB를 명시해야 한다.
  localhost/127.0.0.1/::1의 postgresql+asyncpg만 허용하며 추가 접속 query 옵션은 거부한다.
- 첫 적용은 카탈로그 10개 테이블이 비어 있어야 한다. 회원·주문 등 나머지 테이블은 변경하지 않는다.
- 원본 ID를 `OVERRIDING SYSTEM VALUE`로 유지하므로 FK·공지 product_id·배너 /products/ID 링크가 일치한다.
  identity sequence는 기존값·입력 MAX(id) 중 큰 값으로 앞으로만 진행해 일반 INSERT 충돌을 방지한다.
- 원본 ID 전체와 아티스트/카테고리 slug·상품 소속이 이미 있으면 기존 행을 변경하지 않고 종료한다.
  재고·가격·판매 상태·이미지·관리자 추가 상품 등을 그대로 보존한다.
- 부분 입력·ID 충돌·앞선 데모 DB 등은 오류로 중단한다. 자동 병합·삭제·초기화·덮어쓰기를 하지 않는다.
  해당 경우 별도 빈 개인 DB에서 준비하거나 별도의 검토된 이관 절차가 필요하다.
- 원본 이미지가 없거나 내용이 다르면 DB 쓰기 전에 중단한다. 예비 SVG로 대체하지 않는다.
- advisory transaction lock으로 동일 시드 동시 실행을 직렬화한다.
- 함수는 commit하지 않는다. 호출자가 같은 트랜잭션을 commit/rollback한다. CLI는 session.begin을 사용한다.
- PostgreSQL sequence 값은 일반적으로 rollback되지 않는다. rollback 검증의 행 원복과 구분한다.

## 실제 검증

팀 main 172409b + 이번 시드·전체 스냅샷·이미지·테스트만 추출한 별도 복사본에서 수행했다.
미커밋 상품 API 초안은 포함하지 않았다.

1. 새 로컬 Docker PostgreSQL 18의 빈 DB를 P1 Alembic head 3f21520f9615로 준비했다.
2. 최초 전체 backend 테스트 **209 passed / 0 skipped**, 21.37초.
   공지 SKU 연결 보정과 회귀 테스트 추가 후 최종 **210 passed / 0 skipped**, 13.76초(기존 198개 + 이번 12개).
   기존 TestClient 사용 중단 예정 경고 1개가 남는다.
3. 원본 이미지 **1,847개 모두** HTTP 200·image/webp·바이트 수·SHA256 일치 확인.
4. 첫 입력 후 10개 테이블 모든 행·모든 필드를 원본 스냅샷과 비교해 일치 확인.
5. 일반 ORM INSERT가 기존 ID와 충돌하지 않는지 확인.
6. 재고·가격·숨김·업로드 이미지 경로 변경 및 관리자 상품 추가 후 재실행해 값 보존 확인.
7. 다른 세션에는 미커밋 시드가 보이지 않고 호출자 rollback 후 카탈로그 행이 모두 원복됨을 확인.
8. 다른/부분 카탈로그 덮어쓰기 거부, 원본 이미지 누락 시 쓰기 거부, 비로컬 CLI 주소 거부 확인.
9. 실제 CLI를 두 번 실행하고 commit 후 상품·옵션·이미지 등 핵심 5개 테이블 전체 값·ID가 동일함을 비교.
   나머지 카탈로그 테이블도 첫 입력의 전체 필드 일치를 검증했다.
10. 시드 후 alembic check: No new upgrade operations detected. users·orders는 0행 유지.

이미지 ZIP이 준비되지 않은 다른 개발/CI 환경에서는 원본 이미지에 의존하는 테스트를 이유와 함께 skip한다.
실제 시드 실행은 이미지 누락을 오류로 처리한다. 이 환경에서는 전체 이미지를 준비해 skip 없이 검증했으며,
최종 선택 실행 처리 보완 후 시드 테스트 11개도 새 로컬 DB에서 다시 통과했다(9.15초).
images-only 명령이 카탈로그 JSON을 바꾸지 않는 것과 SQL의 quoted semicolon·함수 본문 제외도 별도로 확인했다.

위 실패·rollback 테스트는 모두 로컬에서 수행했다. 이후 사용자 승인으로 진행한 실제 공용 적용은 아래와 구분한다.
모든 테스트용 Docker 컨테이너는 종료 후 제거했다. 앞선 데모 코드는 .venv 아래 참고용 백업으로만 보존했다.

## 남은 범위

- P1 공통 시드 진입점·실행 순서 연결 확인은 남아 있다. 현재는 P2 단독 함수/CLI를 제공한다.
- 실제 공용 데이터·이미지 적용은 아래 후속 실행으로 완료했다. 이 코드는 공용 migration/stamp를 대신하지 않는다.
- 상품 API·찜·프론트 연결과 Git push·PR 생성은 진행하지 않았다.

## 공용 적용 승인 후 준비 상태 (2026-10-27, 별도 후속 작업)

사용자가 공용 DB·이미지 적용을 승인한 뒤 현재 공용 DB를 다시 읽기 전용으로 확인했다.
18개 테이블이 모두 0행이며 다른 세션은 idle이었다.

- 적용 전 전체 DB 백업: `.venv/shared-catalog-backups/kant-moa-before-catalog-20261027T022303Z.dump`.
  39,853 bytes, 데이터 섹션 18개, pg_restore --list 검증 완료.
- SHA256: `4e4dd67f50b04d1d32f9060cc6fed7b8930aad245ddcc247b897a896f7c14240`.
- 백업과 일회성 실행 파일은 Git 제외 경로에 보관한다. 접속 비밀번호는 기록하지 않는다.
- 준비된 작업은 SSH를 통한 원본 ZIP 전송 → 원본 이미지·해시 검증 → 현재 앱 이미지에 이미지 레이어만 추가
  → API 재생성 → 내부 이미지 1847개 확인 → 카탈로그 잠금·빈 상태 재확인 → 단일 트랜잭션 입력·원본 전체 필드 비교
  → 내부·외부 health 및 공개 이미지 표본 확인 순서다.
- 현재 실행 중인 앱 코드를 기준으로 이미지 레이어를 만들며, 로컬의 미검증 상품 API 초안을 배포하지 않는다.
- 공용 데이터는 적용 전 재검사한다. 다른/부분 데이터가 있거나 잠금 충돌이 나면 덮어쓰지 않고 중단한다.
- 사용자가 SSH 비밀번호를 직접 입력해 실행했다. 아래 결과로 준비 상태를 갱신한다.

## 공용 적용 최종 결과

- 서버 작업 기록: `/home/kant/kant-moa/catalog-20261027T022946Z-f4846b/report.json`.
- ZIP 전송은 약 192MB이며 초기 실행기는 진행률 없이 전송했다. OS I/O 증가로 전송을 확인한 후
  서버의 Preparing/Building/Verified 로그와 CATALOG_DEPLOY_SUCCESS를 확인했다.
  다음 실행부터는 PC 전송 MB/%를 표시하도록 실행기를 보완했다.
- 기존 실행 앱 이미지를 기반으로 원본 이미지 레이어만 추가하고 API만 재생성했다.
  학원 서버의 다른 서비스·기존 Docker DB·ngrok는 변경하지 않았다.
- 원본 이미지를 서버 source assets에도 보존해 다음 정상 이미지 빌드에도 포함되도록 준비했다.
- 서버 내부 HTTP로 WebP **1847개 전부** 해시 일치를 확인했다.
- 카탈로그 테이블 잠금·빈 상태 재확인 후 **10개 테이블 2493행**을 한 트랜잭션으로 입력했다.
  원본 스냅샷의 모든 필드를 비교한 뒤 commit했다.
- DB명·사용자는 kant-moa, 스키마 public. 테이블 생성·초기 SQL 재실행·Alembic migration/stamp는 하지 않았다.
- 적용 후 PC에서 공용 DB를 별도로 읽기 전용 조회해 전체 카탈로그 일치를 확인했다.
- 내부·외부 health 정상. 외부 원본 로고·상품 썸네일·상세 이미지 표본 3개도 HTTP 200/해시 일치 확인.
- 홈페이지·상품 API 배포 완료를 뜻하지 않는다. 이번 API 이미지는 기존 앱 코드에 이미지 레이어만 추가했다.

### 원본 공지 연결 보정

적용 직후 의미 검증에서 원본 고정 ID 공지 6건이 다른 아티스트 상품을 가리키고,
추가 2건은 같은 아티스트의 다른 상품을 가리키는 것을 발견했다.
명확한 제목·SKU 경로 9건의 매핑을 만들고, 연결이 달랐던 **공지 ID 1·3·4·5·6·8·9·10**의 product_id만 보정했다.
원본 경로 대응 검증을 추가해 로컬 전체 210개 테스트를 통과한 후 공용에 반영했다.

- 보정 전 전체 DB 추가 백업:
  `.venv/shared-catalog-backups/kant-moa-before-notice-links-20261027T024205Z.dump`, 74547 bytes.
- SHA256: `5ecf00831d68ed803808168bf5488ccb52cc695bc96ef4b3d6394d752fae5feb`.
- 해당 공지 행이 적용 직후 상태 그대로인지 확인하고 notices/products를 잠근 단일 트랜잭션으로 8건만 수정했다.
- 공지 아티스트와 연결 상품 아티스트 불일치 0건 및 명시적 SKU 경로 매핑 일치를 검증했다.
- 보정 후 카탈로그 전체 필드를 최종 스냅샷과 다시 비교해 일치 확인했다.
- 상세 사후 검증 결과는 Git 제외 `.venv/shared-catalog-final-verification.json`에 남겼다.
  서버 최초 report의 데이터 적용 이후 이루어진 보정이므로 이 사후 기록과 함께 본다.
