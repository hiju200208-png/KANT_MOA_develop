# 새 공용 DB 최초 Alembic 이력 등록 절차

작성일: 2026-10-27. **로컬 검증 완료, 공용 DB에는 미적용인 검토안입니다.**

## 대상과 사전 합의

- 현재 공용 DB/계정은 `kant-moa`, 스키마는 `public`입니다. 이전 `kant_moa` DB와 구분합니다.
- [DB 이전 기록](products/DB_TRANSFER_20261027.md)과 [현재 카탈로그 적용 기록](products/P2_CATALOG_SEED.md)을 함께 확인합니다. 최초 이전 시에는 0행이었지만 이후 상품 시드가 적용됐으므로 비어 있다고 가정하지 않습니다.
- 최초 이력 테이블이 없고 업무 테이블 18개가 존재하는 DB만 대상으로 합니다.
- 팀에 변경 내용·시점을 공유하고 PR 리뷰·병합 후 한 명이 적용합니다. 시드·배포·다른 migration과 동시에 실행하지 않습니다.
- 적용 직전 담당자가 새 DB의 현재 백업을 확보합니다. 예전 이전용 백업에는 이후 시드가 포함되지 않을 수 있습니다. 백업은 Git·공유 문서에 올리지 않습니다.

## 변경 범위

기존 생성 revision은 재실행하지 않습니다. `scripts/adopt_shared_baseline.py`가 다음을 처리합니다.

1. 비교 기준인 로컬 DB가 head `3f21520f9615`인지 확인합니다. 로컬 주소만 허용합니다.
2. 대상 DB·계정을 명시한 값과 비교하고 기존 Alembic 이력이 있으면 중단합니다.
3. 18개 테이블 전체의 컬럼·자료형·NULL·기본값·identity, PK/FK/UNIQUE/CHECK, 인덱스, 시퀀스 정의, 사용자 트리거를 비교합니다.
4. 허용하는 차이는 아래 네 가지뿐입니다. 예상 밖의 차이는 중단하고 담당자와 협의합니다.
   - 로그인 수단 필수 `ck_users_login_method` 없음
   - 이메일 정규화 `ck_users_email_normalized` 없음
   - 만료 인덱스 `ix_token_blacklist_expires_at` 없음
   - role CHECK 이름이 `users_role_check`이고 로컬은 `ck_users_role`
5. 회원의 로그인 수단·이메일 정규화 위반과 정규화 후 중복 이메일을 다시 조회합니다.
6. 적용 모드에서는 CHECK 2개·만료 인덱스를 추가하고 role CHECK 이름을 맞춥니다. 전체 구조를 재비교한 후 동일 트랜잭션에서 Alembic head를 등록합니다.

테이블·기존 행·시드·시퀀스 현재값은 삭제하거나 재생성하지 않습니다. users.role은 이미 TEXT, UUID 기본값도 이미 있으므로 변경하지 않습니다. 의미가 같은 TEXT/VARCHAR의 중복 문자열 캐스트만 비교 시 정규화합니다. 소유자·컬럼 순서는 환경 차이로 비교에서 제외합니다. 함수 본문·뷰·권한·확장 등은 이 도구의 비교 범위가 아니며 추가 변경이 있다면 별도 확인해야 합니다.

## 1. 로컬 기준 DB 확인

`heeju`에서 최신 main을 반영하고 로컬 Docker DB가 실행 중인지 확인합니다. `backend/.env`는 로컬 DB 주소로 유지합니다.

backend 폴더에서:

```powershell
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic heads
```

비교용 DB의 current는 고정 기준 `3f21520f9615`여야 합니다. 저장소 heads는 기준 revision 또는 검토된 배송 후속 `4c726d1a91ab` 단일 head만 허용합니다. 그 밖의 head·분기는 중단합니다. 이미 후속 migration이 적용된 개인 DB는 되돌리지 말고 별도 기준 DB를 준비합니다. 비교 기준은 `BASELINE_REFERENCE_URL` 환경변수가 있으면 그것을, 없으면 로컬 `backend/.env`의 DATABASE_URL을 읽습니다.

## 2. 읽기 전용 비교

최신 검토 코드가 있는 backend 폴더에서 실행합니다.

```powershell
.\.venv\Scripts\python.exe scripts/adopt_shared_baseline.py --target-host 0.tcp.jp.ngrok.io --target-port 12799 --expected-database kant-moa --expected-user kant-moa
```

프롬프트에서 별도로 전달받은 DB 비밀번호를 입력합니다. 입력은 숨겨지며 명령어·파일·출력에 저장하지 않습니다. `BASELINE_TARGET_URL`이 설정돼 있으면 그 주소를 우선하므로 의도하지 않은 값이 없는지 확인합니다. 로컬 개발용 `.env`를 공용 주소로 바꾸지 않습니다.

성공 결과는 `CHECK_OK`, `changed: false`입니다. 기본 모드는 READ ONLY 트랜잭션이므로 DB 변경이 없습니다. `STOPPED`라면 임의 수정·stamp를 하지 않고 차이를 확인합니다. 접속 주소가 변경됐다면 담당자가 안내한 현재 주소를 사용합니다.

## 3. 적용: 리뷰·병합·백업·팀 공지 후에만

위 비교 결과와 적용 시간을 팀에 공유합니다. 아래 명령은 **실제로 공용 DB를 변경**하므로 사전 절차 완료 후 지정 담당자만 실행합니다.

```powershell
.\.venv\Scripts\python.exe scripts/adopt_shared_baseline.py --target-host 0.tcp.jp.ngrok.io --target-port 12799 --expected-database kant-moa --expected-user kant-moa --apply
```

- 트랜잭션 동안 업무 테이블에 짧게 SHARE 잠금을 획득하며 인증 DDL은 더 강한 잠금을 요구합니다. 쓰기 요청과 겹치지 않게 진행합니다.
- 잠금 대기는 5초, 개별 SQL은 30초 제한입니다. 잠금·검증·DDL·이력 등록에 실패하면 전체를 rollback합니다.
- 사후 구조 검증이 끝난 뒤에만 `public.alembic_version`을 만들고 head를 기록합니다. 맹목적인 `alembic stamp head`를 대신하지 않습니다.
- 성공 결과는 `ADOPTED`, `revision: 3f21520f9615`입니다. 네트워크가 끊겨 결과가 불확실하면 다시 적용하기 전에 DB를 읽기 전용으로 확인합니다.
- 이미 이력이 있으면 반복 실행을 거부합니다. `downgrade base`, 테이블 삭제, 초기 SQL 재실행으로 되돌리지 않습니다.

## 4. 적용 후 기록과 서버 배포

DBeaver에서 조회합니다.

```sql
SELECT current_database(), current_user;
SELECT version_num FROM public.alembic_version;
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid='public.users'::regclass ORDER BY conname;
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='token_blacklist' ORDER BY indexname;
```

적용 커밋·담당자·시각·revision·검증 결과를 남깁니다. 시드와 기존 데이터가 보존됐는지도 백업/사전 기록과 대조합니다. 이후 최신 main 서버 배포는 배포 담당자가 별도로 진행하고 실제 토큰으로 회원가입·로그인·내 정보·로그아웃 후 401, 일반 회원 관리자 접근 403을 확인합니다. Google·프론트 연결 완료와 구분합니다.

## 로컬 자동 검증

```powershell
$env:P2_RUN_POSTGRES_TESTS = "1"
try {
    .\.venv\Scripts\python.exe -m pytest tests/products/test_baseline_adoption.py -q
} finally {
    Remove-Item Env:P2_RUN_POSTGRES_TESTS -ErrorAction SilentlyContinue
}
```

일회용 PostgreSQL 18 컨테이너 안에 서로 다른 기준·대상 DB를 만들며 실제 공용 DB·개인 개발 DB는 사용하지 않습니다. 검증 항목은 읽기 전용 확인, 잘못된 대상 및 예상 밖 컬럼 거부, 사후 검증 실패 시 전체 rollback, 회원·상품·블랙리스트 행 보존, 정상 최초 이력 등록, 재실행 거부, 추가 CHECK 동작입니다. 검증용 DB·컨테이너는 종료 시 정리합니다.

## 배송 후속 revision이 있는 저장소에서의 주의 (10/27)

현재 검토 중인 배송 head는 `4c726d1a91ab`이며 부모는 기존 기준 `3f21520f9615`다. 최초 baseline 비교·채택 기준은 변경하지 않는다. 비교용 **별도 빈 로컬 DB**를 `alembic upgrade 3f21520f9615`로 준비하고 `BASELINE_REFERENCE_URL`로 지정한다. 이미 배송 head까지 올라간 개인 개발 DB를 비교 기준으로 쓰거나 되돌리지 않는다.

도구는 기존 기준 head 또는 검토된 단일 배송 head/정확한 부모만 허용하며, 미검토 head·복수 head·잘못된 부모는 거부한다. DB version·18개 테이블·허용 차이 검사는 기존 baseline 기준 그대로다.

최신 백업·읽기 비교·팀 공지 후 baseline 채택(3f21520f9615)을 마친 다음, 별도 승인된 배송 migration(4c726d1a91ab)을 적용하고 API를 배포한다. 이 후속 migration과 신규 관리자 기능은 아직 공용에 적용하지 않았다.
