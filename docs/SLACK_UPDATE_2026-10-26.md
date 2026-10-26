# Slack 공유 문안 · 2026-10-26

아래는 복사해서 공유할 문안입니다. Slack에 자동 전송하지 않았습니다.
이 문서·SQL·배포 파일을 push한 뒤 공유해주세요.

---

KANT-MOA 공용 DB와 학원 서버 FastAPI 기본 실행 환경 준비했습니다!

**완료**
- 기존 서비스와 분리된 `kant_moa` DB·계정 생성
- 테이블 18개 생성, 소유자 모두 `kant_moa` 확인
- FastAPI Docker 실행·DB 연결 확인, 외부 Swagger 접속 확인
- 일반 로그인 + 구글 로그인 병행용 회원 컬럼 준비 (`google_sub`, nullable `password_hash`)

**주소**
- Swagger: https://letdown-kilometer-nutcase.ngrok-free.dev/docs
- 상태 확인: https://letdown-kilometer-nutcase.ngrok-free.dev/health

**팀원/에이전트 참고 문서**
https://github.com/hiju200208-png/KANT_MOA_develop/blob/main/docs/STAGING.md

초기 스키마는 `backend/sql/001_create_tables.sql`, 서버 실행 파일은 `deploy/staging/`에 정리했습니다.
공용 DB에는 이미 적용했으니 초기 SQL 재실행·테이블 초기화는 하지 말아주세요.
개인 로컬 테스트 DB는 같은 SQL로 별도 준비할 수 있습니다.

**아직 안 된 것**
- 현재 공개된 기능 API는 `/health`뿐입니다. 인증·상품·주문·관리자 API 등록/통합과 프론트 연동은 각자 이어서 진행해야 합니다.
- 시드·이미지·재고 잠금·JWT/권한 검증은 아직입니다.
- 공용 DB의 팀원 PC 직접 접속은 아직 설정하지 않았습니다. 위 ngrok 주소는 웹/API용이며 DB 접속 주소가 아닙니다.
- ngrok은 현재 터미널에서 실행 중이라 SSH 종료 시 끊길 수 있습니다. 상시 실행 설정은 후속 작업입니다.

각 담당자분은 문서의 테이블·FK·NULL·자료형과 본인 모델을 맞춰주세요.
P1은 인증 두 방식과 회원 제약, P2/P3/P4는 공통 재고 함수·동일 세션·트랜잭션 계약을 확인 부탁드립니다.
스키마 변경은 후속 마이그레이션으로 공유하고 적용 담당자를 맞춰 진행하면 좋겠습니다.
비밀번호·토큰은 문서나 Slack에 올리지 않습니다.
