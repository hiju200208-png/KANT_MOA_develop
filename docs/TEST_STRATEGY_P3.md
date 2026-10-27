# KANT MOA P3 테스트 적용 계획 (2026-10-27)

> 참고: PIXEL MART 「도구와 테스트」의 계층별 테스트 / DB 격리 / API 계약 / CI 원칙을 KANT MOA에 맞게 변환. **실행 결과가 아닌 테스트 설계 문서**입니다.

## 현재 확인된 저장소 상태 (main 기준)
- `backend/pyproject.toml`: Python >=3.13, FastAPI, SQLAlchemy async, asyncpg, pytest, httpx 포함.
- `backend/tests/conftest.py`: `P1_RUN_LOCAL_DB_TESTS=1`일 때만 `backend/.env`의 `DATABASE_URL`을 로드하며 localhost/127.0.0.1/::1 외 호스트 거부.
- `backend/src/database.py`: `get_session`은 자동 commit하지 않음. 응용 서비스가 commit/rollback 책임.
- `backend/src/main.py`: `auth_router` 등록, `/health` 제공.
- **main에서 `backend/src/orders/presentation/router.py`, `backend/src/orders/application/service.py`를 찾지 못함. 따라서 P3 주문 API 테스트의 실제 라우트, 스키마, 응답을 아직 확정하거나 성공 실행했다고 주장하지 않음.**
- `docs/PROJECT2.md`의 공통 API 계약과 P3 담당 범위를 우선함. 다른 브랜치에 구현이 있을 수 있으므로 통합 전에 최신 대상 브랜치를 재확인할 것.

## 테스트 환경 안전 원칙 (필수)
1. 테스트는 **개인 로컬 Docker의 테스트 전용 PostgreSQL DB**로만 수행. 학원 서버·ngrok·공용 DB 대상으로 실패/동시성/마이그레이션 테스트 금지.
2. 단순히 `DATABASE_URL`의 호스트가 localhost인지 확인하는 것만으로 전용 DB가 증명되지는 않음. 실행 전에 DB 이름 및 Docker 포트도 검증하고 테스트 전용 이름(예: `kantmoa_test`)을 사용. localhost SSH 터널이 공용 서버로 연결돼 있을 수도 있으므로 반드시 확인.
3. 초기 테이블 생성은 *새 빈 로컬 테스트 DB*에서 프로젝트의 Alembic 이력으로 수행. 공용 DB에 `alembic upgrade head`, 재실행 초기 SQL, `drop_all` 등 금지. 기존 로컬 DB에도 마이그레이션 이력 확인 없이 중복 초기화 금지.
4. 실제 결제 승인 대신 모의 결제만 검증. 실사용 계정/전화번호/주소/토큰/DB 비밀키를 테스트 코드·로그·PR에 기록하지 않음.
5. 테스트 케이스별 고유 사용자·상품·옵션·주문 생성 후 정리; 데이터 유실 가능성이 있는 작업은 별도 테스트 DB에서만 실행.
6. 기존 인증 테스트 옵션 `P1_RUN_LOCAL_DB_TESTS`, 상품 테스트 옵션 `P2_RUN_POSTGRES_TESTS`와 충돌하지 않도록 P3 전용 테스트 선택/fixture 협의.

## P3 테스트 범위와 기대 결과

| 계층 | 테스트 | 의존성 | 성공 기준 |
|---|---|---|---|
| Domain | 수량 0/음수 거부 | DB 없음 | 도메인 예외 및 상태 불변 |
| Domain | 재고 1인데 2 주문 거부 | DB 없음 | 재고 음수 불가 (공통 재고 규칙은 P2가 소유) |
| Service | 주문 성공 시 단일 트랜잭션 commit | Fake Repository/Transaction | commit 1회, rollback 0회 |
| Service | 재고 차감 후 주문 저장 실패 | Fake Repository/Transaction | rollback 1회, commit 0회 |
| API | 유효한 로그인 후 주문 생성 | FastAPI + 전용 DB | 팀에서 계약한 200/201과 응답 스키마, 주문 및 재고 반영 |
| API | 인증 없는 보호 API 호출 | FastAPI + 전용 DB | 401 |
| API | 없는 상품/옵션 조회 | FastAPI + 전용 DB | 계약된 404 |
| API | 입력 형식 오류 | FastAPI + 전용 DB | 422 |
| API | 재고 부족/중복 요청 | FastAPI + 전용 DB | **팀 계약에 정의된** 409 등과 DB 일관성 |
| API | 다른 사용자의 주문 조회 | FastAPI + 전용 DB | 팀 정책에 따라 403 또는 404, 정보 유출 금지 |
| API | 주문 취소 | FastAPI + 전용 DB | 상태 변경과 재고 복구가 원자적으로 반영 |
| API | 동일 주문 이중 취소 | FastAPI + 전용 DB | 중복 재고 복구 없음 |
| DB 동시성 | 재고 1개에 동시 주문 2건 | 전용 PostgreSQL | 성공 1건 이하, 재고 음수 없음, DB 잠금/조건부 UPDATE 확인 |
| Infrastructure | DB 연결/세션 종료 | 전용 DB | 트랜잭션 미완료 시 rollback |
| Frontend | 장바구니→주문→모의 결제→취소 | Next.js + FastAPI + 전용 DB | 사용자 화면과 API/DB 결과 일치 |

### 주문 API 구현 전 확인할 계약
- 실제 경로·메서드, 요청/응답 스키마 및 status_code
- 인증 의존성: `auth.presentation.dependencies.get_current_user` / 소유자 판단
- P2의 `decrease_stock`·`increase_stock`과 잠금 계약
- Service가 commit/rollback 소유하며 Repository는 commit하지 않는 규칙
- 결제 상태·취소·재시도·중복요청의 정책 및 오류 코드
- Swagger의 공개 API 경로와 기존 프론트 API 호출 규약

## 권장 테스트 폴더 (실제 모듈명·테스트 fixture 확인 후 생성)
```text
backend/tests/
  test_orders_domain.py
  test_orders_service.py
  test_orders_api.py
  test_cart_api.py
  test_addresses_api.py
  test_payments_api.py
  test_orders_concurrency.py
```
새 테스트를 작성할 때는 우선 실제 코드의 함수·스키마를 import하여 테스트하고, 구현되지 않은 라우트를 억지로 통과시키거나 모의 응답을 '통합 테스트 성공'으로 보고하지 않습니다.

## 실행 / 증빙 절차
1. 각자 로컬 Docker DB 기동 및 **호스트, 포트, DB 이름, SSH 터널 여부** 확인 (비밀값 공유 금지).
2. `backend/.env`가 **테스트 DB**를 가리키는지 확인. 전용 DB를 준비한 뒤에만 Alembic 이력 확인·적용.
3. `backend`에서 `uv sync` (환경이 준비된 경우). `uv run pytest -q`로 DB가 필요 없는 기존 테스트부터 실행.
4. DB 연동 테스트는 로컬 전용 DB 확인 후 팀 합의된 옵션을 명시적으로 켜고 수행. 현재 P1의 예시:
   ```powershell
   $env:P1_RUN_LOCAL_DB_TESTS = "1"
   try { uv run pytest -q } finally {
       Remove-Item Env:P1_RUN_LOCAL_DB_TESTS -ErrorAction SilentlyContinue
   }
   ```
   위 명령은 **P3 안전 검증을 모두 보장하지 않음**. 테스트 DB 분리 확인 전 실행 금지.
5. PR 설명에 테스트 이름, passed/failed/skipped, DB 대상(비밀 제외), 실패 원인, Swagger 스크린샷(개인정보 제외)을 기록.
6. 팀 리뷰 전 `main`이나 공용 DB에 반영하지 않음. P1의 공통파일 소유권 유지.

## 완료 기준
- [ ] P3 구현 브랜치 / 최종 병합 대상에서 실제 주문·장바구니·배송지·모의결제 라우트 확인
- [ ] 정상 및 실패·권한 시나리오 각각 자동 테스트 보유
- [ ] 실제 전용 PostgreSQL에서 API / 트랜잭션 / 동시성 테스트 증빙
- [ ] 기존 pytest 회귀 테스트 통과
- [ ] PR 리뷰와 승인 후 병합
