# 내 정보 수정 연결 (2026-10-29)

## 원인과 변경

기존 화면은 저장 버튼이 있었지만 `services/auth.ts`의 updateProfile이 항상 안내 오류를 발생시켰습니다. 서버에는 수정 경로가 없었고 getProfile은 연락처를 무조건 null로 바꿨습니다.

`PATCH /auth/me`를 추가해 인증된 본인의 닉네임·연락처를 저장합니다. 화면 저장 후 공통 인증 변경 이벤트로 프로필을 다시 읽고, 조회·새로고침에도 DB 연락처를 유지합니다. 일반·Google 회원·관리자가 자신의 정보를 같은 방식으로 수정합니다.

## 계약

- Authorization: 기존 Bearer JWT. 사용자 ID는 get_current_user에서만 가져옵니다.
- 요청: `{ "nickname": "새 닉네임", "phone": "010-1234-5678" }`. 일부 필드만 보내면 나머지는 유지합니다.
- nickname: 앞뒤 공백 제거 후 1~50자. null·공백만 있는 값 거부.
- phone: 선택 값. null 또는 빈 문자열로 삭제하며, 미전송 시 유지합니다. 숫자·공백·하이픈만 허용하고 구분자를 제외하면 01로 시작하는 10~11자리, 전체 20자 이하입니다.
- 빈 요청과 email·id·user_id·role·password_hash·google_sub 등 미허용 필드는 422. 다른 회원을 지정하는 입력이나 경로는 제공하지 않습니다.
- 응답: `{id,email,nickname,role,phone}`. GET /auth/me에도 phone을 추가합니다. 비밀번호 해시와 google_sub는 반환하지 않습니다.
- 인증 없음·잘못된 토큰·만료·로그아웃 토큰·없는 회원은 기존 401 정책. 입력 오류는 422 UNKNOWN과 메시지입니다. ADMIN 승격·이메일·로그인 수단 변경 기능은 아닙니다.

## 계층과 데이터 보존

- Domain: 허용 필드·닉네임·연락처를 모두 검증한 후 반영합니다. 전화번호 오류가 있을 때 닉네임만 먼저 변경하지 않습니다.
- Application: 본인 조회 → 도메인 검증 → Repository UPDATE → commit, 실패 시 rollback.
- Infrastructure: 해당 UUID의 전달된 프로필 컬럼만 UPDATE RETURNING. 임의 commit 없음.
- Presentation: 요청 스키마·get_current_user·공통 HTTP 오류 변환. UI는 기존 저장 흐름과 인증 이벤트를 사용합니다.
- 기존 users 컬럼만 사용하므로 migration·시드·초기화는 없습니다. 이메일·role·비밀번호·Google sub와 다른 회원 데이터는 유지합니다.

## 검증과 적용 상태

- 대상 단위·HTTP·기존 Google 검사: 22 passed, 기존 TestClient 경고 1개.
- 실제 JWT·일회용 PostgreSQL 검증: 1 passed. 저장·재조회·부분 수정·null 삭제·다른 회원 보존·금지 필드 거부·UPDATE 후 강제 실패 rollback·로그아웃 토큰 401 확인.
- 전체 일회용 DB 검사: migration 4개 적용 성공, 기본 451 passed / 105 skipped, 별도 Docker DB 336 passed / 6 skipped. 각 pytest에 기존 TestClient 경고 1개. 마지막 6개는 이미지 원본 부재입니다.
- 프론트 typecheck·lint 통과, npm test 51 passed. 연락처 매핑·입력 오류·삭제 회귀 검사 포함.
- 로컬 코드 검증 결과이며, 공용 배포·실제 사용자 화면 저장은 아직 대기입니다. 공용 DB에서 실패 테스트나 임의 회원 수정은 하지 않았습니다.
