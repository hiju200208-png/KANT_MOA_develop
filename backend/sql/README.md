# 공용 PostgreSQL 테이블 준비

`001_create_tables.sql`은 새 DB에 18개 업무 테이블을 만드는 초기 SQL 초안입니다.
기존 Supabase 테이블을 기반으로 `profiles`를 `users`로 대체하고
`token_blacklist`와 후속 마이그레이션의 컬럼 변경을 반영했습니다.

**10/26 공용 서버 `kant_moa` DB에 적용 완료했습니다.** 테이블 18개와 소유자
`kant_moa`를 사용자 실행 결과로 확인했습니다. [실제 적용 기록](../../docs/STAGING.md)을
먼저 확인하고, 이 SQL은 새 개인 개발 DB에만 적용합니다. 공용 DB에서 다시 실행하지 않습니다.

## 포함 범위

- 테이블, 컬럼, PK/FK, 기존 UNIQUE/CHECK와 기본값
- 기존 사용자별 기본 배송지 최대 1개 제약
- Google 로그인 연결용 `users.google_sub`
- 일반 로그인 병행을 위한 nullable `users.password_hash`

사용자는 일반 로그인과 Google 로그인을 병행하기로 결정했습니다. 적용 SQL은
두 방식을 수용하며 인증 함수나 로그인 기능은 구현하지 않습니다. 회원마다 두 인증 필드 중
하나 이상 필요하다는 조건, 이메일 정규화·계정 연결 등의 검증은 P1과 후속으로 맞춥니다.
SQL 파일의 작성 당시 초안 주석은 보존했으며, 현재 적용 상태는 위 실행 기록을 기준으로 합니다.

시드, 비즈니스 로직, 행 잠금, RPC/트리거, RLS/GRANT, 서버 계정·네트워크 설정,
추가 조회 인덱스는 포함하지 않습니다. 비동기 Repository는 각 담당자가 구현합니다.

## 적용

서버 담당자가 대상 데이터베이스를 마련하고 원격 접속을 허용한 뒤,
**대상 DB와 public 스키마에 기존 업무 테이블이 없는지 먼저 확인**합니다.
PostgreSQL 13 이상과 대상 스키마에 테이블을 생성할 권한이 필요합니다.

다음 명령의 HOST, PORT, USER, DBNAME을 실제 대상으로 바꿉니다.
저장소 루트에서 실행하며 비밀번호는 `-W` 프롬프트에 입력합니다.

```powershell
psql -X -h HOST -p PORT -U USER -d DBNAME -W -v ON_ERROR_STOP=1 -f backend/sql/001_create_tables.sql
```

이 파일은 데이터베이스 자체를 생성하지 않습니다. 기존 객체가 있으면 실패하며,
트랜잭션 전체가 롤백됩니다. 반복 적용용 마이그레이션이 아니므로 `IF NOT EXISTS`로
오류를 숨기거나 기존 테이블을 삭제해서 재실행하지 않습니다.

적용 후 확인:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

대상 18개 테이블, 주요 컬럼·FK를 확인하고 적용 커밋·담당자·시각을 팀 문서에
기록합니다. 원격 DB 적용 여부는 실제 실행 결과로 확인해야 합니다.
