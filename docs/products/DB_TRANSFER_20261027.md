# 기존 학원 Docker DB → 외부 접속 DB 이전

기록일: 2026-10-27 KST. **백업 복원·사후 비교 및 API의 새 DB 전환 완료.**

## 원본과 대상

- 원본: 학원 서버 `dbresting-db-1`, DB/사용자 `kant_moa`, 스키마 `public`.
- 대상: `0.tcp.jp.ngrok.io:12799`, DB/사용자 `kant-moa`, 스키마 `public`.
  이름의 밑줄과 하이픈을 구분한다. 비밀번호는 기록하지 않는다.
- 대상 PostgreSQL: 18.6. 백업 생성 서버/pg_dump: PostgreSQL 18.6.
- 백업: 사용자가 서버에서 생성하고 PC Downloads로 복사한
  `kant_moa-before-move-20261027.dump`, 39,773 bytes, CUSTOM 형식.
- SHA256: `ed0577e47b9392c1ed09d2be9cbfaace3fba3d91d038a50409e8e2cc5e26e719`.
- 백업/DB 비밀번호/로컬 검증 DB 파일은 Git에 추가하지 않는다.

## 실제 수행

1. 대상의 사용자 테이블·시퀀스·함수가 없는 것을 읽기 전용으로 확인했다.
2. 백업 TOC에서 18개 테이블과 데이터 항목, 시퀀스 상태 12개를 확인했다.
3. Docker 엔진 기동이 되지 않아 설치된 PostgreSQL 18로 격리된 로컬 임시 DB를 생성하고 먼저 복원했다.
4. 대상이 여전히 비어 있고 다른 대상 세션도 없는 것을 다시 확인했다.
5. `pg_restore --single-transaction --exit-on-error --no-owner --no-acl`로 대상 DB에 복원했다.
   --clean/DROP/초기 SQL 재실행/migration/stamp/추가 시드는 사용하지 않았다.
6. 백업의 로컬 복원본과 대상의 컬럼·자료형·기본값·NULL·identity·제약·인덱스,
   테이블별 행 수·행 내용 SHA256 및 시퀀스 last_value/is_called를 비교해 모두 일치했다.
7. 첫 검증 보고서 저장의 bytes 직렬화 오류를 수정했다. 복원은 반복하지 않았고,
   대상은 읽기 전용으로 재검증해 보고서 저장을 완료했다. 임시 로컬 PostgreSQL은 종료했다.

## 결과

- public 테이블 **18개**, 시퀀스 **12개**, 테이블 소유자 **kant-moa**.
- 테이블: addresses, artist_banners, artist_likes, artist_members, artists, cart_items,
  categories, home_banners, notices, order_items, orders, product_images,
  product_variants, products, shop_settings, token_blacklist, users, wishlists.
- **원본 백업의 모든 테이블은 0행이며 대상도 모두 0행이다.** 누락된 상품·회원 데이터를 임의 생성하지 않았다.
- **백업에 alembic_version이 없어 대상에도 없다.** P1 로컬 migration head 적용 완료로 보지 않는다.
- 무소유자 복원 옵션으로 원본의 kant_moa 역할을 새 서버에 만들지 않고 대상 kant-moa 역할이 객체를 소유한다.
- 원본 Docker DB는 변경·삭제하지 않았다. FastAPI 환경변수·컨테이너·ngrok도 변경하지 않았다.

## 남은 단계

- P1: 새 DB와 migration의 스키마 차이를 대조하고 최초 Alembic 이력·필요 변경 절차를 결정한다.
  테이블이 이미 있으므로 최초 생성 revision을 그대로 실행하거나 head로 곧바로 stamp하지 않는다.
- 이전 직후에는 시드가 없었다. 이후 사용자 승인으로 P2 실제 전체 카탈로그를 적용했다.
  [공용 카탈로그·이미지 적용 결과](P2_CATALOG_SEED.md)를 참고한다. 데모 7개 방식은 폐기했다.
- FastAPI의 새 DB 전환은 아래 후속 실행 결과대로 완료했다. 인증·상품 API 기능 배포 완료와는 구분한다.
- DB dump는 파일 시스템의 assets/uploads를 옮기지 않는다. 이미지 파일과 프론트 배포는 별도다.

## API DB 연결 전환 (2026-10-27, 복원 후 후속 실행)

사용자가 준비된 스크립트를 PC PowerShell에서 SSH로 실행하고 다음 결과를 공유했다.
서버 비밀번호는 사용자가 SSH 입력창에서 직접 입력했으며 Git·문서에 기록하지 않았다.

- 변경 전 기존 API 컨테이너에서 새 DB 접속 사전 확인 성공.
- 서버 backend.env의 DATABASE_URL만 변경하고 API 컨테이너만 재생성했다.
  원본 Docker DB·다른 서비스·ngrok는 변경하지 않았다.
- 변경 후 실제 API 컨테이너의 설정으로 접속한 결과:
  DB `kant-moa`, host `0.tcp.jp.ngrok.io`, port `12799`, public 테이블 18개.
- Internal health: OK, Public health: OK, `DB_SWITCH_SUCCESS` 확인.
- 이전 환경 파일 백업:
  `/home/kant/kant-moa/backups/backend.env-before-db-switch-20261027T004649690493Z`.
  이 파일은 비밀값이 있는 서버 전용 백업이며 외부 공유·Git 추가 대상이 아니다.
- 이 결과는 사용자가 실행한 스크립트 출력 기준이다. 새 DB migration/stamp/시드는 추가 적용하지 않았다.
- 이제 공개 API는 새 DB를 사용한다. 원본 DB와 새 DB는 자동 동기화되지 않는다.
- PC에 만든 자격 증명 포함 임시 전환 스크립트와 실행용 launcher는 실행 확인 후 제거했다.
