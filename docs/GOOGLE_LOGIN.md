# Google 로그인 구현·설정

> **후속 배포 반영:** 아래는 Google 도입 당시의 코드·웹 보존 기록입니다. 이후 API·웹 모두 e0c7ad8로 배포했고 인증 설정을 유지했습니다. 실제 공용 Google 전체 E2E 미확인 범위는 [최종 현황](FINAL_STATUS.md)과 구분합니다.

2026-10-28. **로컬 구현·자동 검사·실제 Google 로그인과 공용 배포 완료. 실제 공용 Google 계정 로그인은 사용자 확인 대기입니다.**

## 공용 배포 결과 (10/28 KST)

- [PR #80](https://github.com/hiju200208-png/KANT_MOA_develop/pull/80) CI 성공·변경 최종 확인 후 main에 병합했습니다. Google 코드 기준은 `f5b11c99b3ddd4ae4da863db2b5bafcdab87fe4a`입니다.
- 당시 실행 중인 웹은 상재님 커밋 `2f1b772d28121c3a7a14cc98809aa334cc393a03`이었습니다. main보다 앞서 배포된 배너·상품 로딩 개선 18개 파일을 새 release에도 보존했습니다. 따라서 실행 소스는 main 단독과 같다고 표현하지 않습니다. 서버 `google-source.json`에 두 커밋과 보존 파일 SHA256을 남겼습니다.
- 기존 API·웹·게이트웨이를 읽기 전용 점검하고, 별도 후보 스택에서 빌드·health·페이지·카탈로그·Google 설정을 검증한 뒤 공개 포트를 전환했습니다. 기존 서버 app 체크아웃을 덮어쓰지 않았습니다.
- 최종 결과 `GOOGLE_SITE_DEPLOYED`, rollback 없음. 홈페이지·로그인·health·API 명세·상품 목록·Google 설정 모두 200이며 공개 상품은 387개입니다(숨김 포함 DB 상품 389개와 구분).
- 배포 전후 DB 행 내용 지문·행 수·시퀀스 값이 같고, JWT_SECRET·DATABASE_URL 동일 여부를 내부 비교했습니다. 상품 이미지 1,800개·아티스트 이미지 47개와 기존 업로드 마운트를 유지했습니다. SQL·migration·seed는 실행하지 않았습니다.
- 공용 Google 설정의 클라이언트 ID 일치·nonce·Secure/HttpOnly/SameSite 쿠키·no-store를 확인했습니다. 브라우저에서 [공용 로그인](https://letdown-kilometer-nutcase.ngrok-free.dev/login)의 Google 버튼 표시도 확인했습니다.
- release: `/home/kant/kant-moa/site-releases/google-20261028T013909Z-f5b11c9`. 복구 정보: `/home/kant/kant-moa/backups/before-google-20261028T013909Z-f5b11c9`. 과거 스택은 복구용으로 보존했습니다.
- 이 Google 배포 당시 `/home/kant/kant-moa/active-site.json`이 새 Compose 프로젝트·release·env 경로를 가리켰습니다. 후속 배포는 이 파일을 기준으로 하며 과거 compose.backend.yml로 서비스를 중복 실행하지 않습니다. 실제 env·DB 지문 파일은 서버에서만 관리합니다.
- 공용 실제 Google 계정 선택·로그인·새로고침·로그아웃은 사용자 확인 대기입니다. 배포 스모크 검증 중 테스트 회원 생성·주문·재고 쓰기는 하지 않았습니다.

## 실제 로컬 확인 결과

- 로컬 backend/.env에 클라이언트 ID와 HTTP 개발용 쿠키 설정을 연결했습니다. 프론트 API도 localhost로 통일했습니다. 비밀 설정 파일은 Git에서 제외합니다.
- 사용자가 Google 계정을 선택한 뒤 `/auth/google` 200, `/auth/me` 200을 확인했습니다.
- 브라우저 새로고침 후에도 `/auth/me` 200이고 마이페이지에 로그인한 회원 정보가 표시됐습니다. 회원 개인정보는 문서에 기록하지 않습니다.
- 화면 로그아웃 시 `/auth/logout` 204, 이후 마이페이지에 '로그인이 필요해요'가 표시되는 것을 확인했습니다.
- 실제 계정의 두 번째 Google 로그인·동일 회원 유지와 비회원 장바구니 데이터 병합은 별도 화면 검증이 남습니다. 자동 테스트에서 재로그인은 검증했습니다.
- 로컬 카탈로그 데이터가 비어 있고 `/shop-settings`가 503이므로 상품·설정 화면 정상화를 이번 인증 성공과 혼동하지 않습니다. 공용 DB·배포는 변경하지 않았습니다.

## 동작과 계정 정책

- 일반 로그인 화면에서 Google Identity Services 공식 버튼을 사용합니다. 관리자 로그인 화면은 기존 이메일·비밀번호 방식을 유지합니다.
- `GET /auth/google/config`가 공개 클라이언트 ID와 로그인 시도 nonce를 반환하고, 동일 nonce를 HttpOnly·SameSite=Lax 쿠키(5분)에 저장합니다. 설정이 없으면 두 값은 null이고 버튼은 숨깁니다. 응답은 `Cache-Control: no-store`입니다.
- Google 팝업의 callback에서 받은 ID 토큰과 nonce를 JSON으로 `POST /auth/google`에 보냅니다. 요청은 쿠키를 포함하고, 쿠키·본문·Google 토큰의 nonce가 일치해야 합니다. 성공 후 nonce 쿠키를 지웁니다. 여러 탭에서 동시 로그인하거나 5분이 지나면 화면을 새로고침합니다.
- 서버 Infrastructure가 Google 공식 `google-auth`로 서명·aud·iss·exp를 검증하고, 이메일 인증과 nonce도 검사합니다. 동기 네트워크 검증은 스레드에서 실행하고 공개키 요청 대기에 10초 제한을 둡니다. 토큰을 로그에 남기지 않습니다.
- Domain은 검증된 `GoogleIdentity`만 표현합니다. Application은 sub 조회·신규 가입·트랜잭션을 담당하고 기존 Repository·JWT 발급을 재사용합니다.
- 기존 Google 회원은 이메일 대신 고유 `sub`로 찾습니다. Google의 이메일 변경을 기존 계정 이메일에 자동 반영하지 않습니다.
- 신규 Google 회원은 USER, password_hash=NULL로 생성합니다. 기존 google_sub 컬럼·제약을 사용하므로 스키마 migration은 없습니다.
- 같은 이메일의 일반 회원·관리자가 있으면 **409 UNKNOWN**으로 거부합니다. 이메일 일치만으로 자동 연결하거나 관리자 권한을 부여하지 않습니다. 로그인 후 명시적 계정 연결·비밀번호 설정·이메일 변경은 이번 범위에 없습니다.
- 응답은 기존 `{ access_token, token_type, expires_in }`. 프론트는 공통 세션 키·상태 변경 이벤트·비회원 장바구니 병합을 재사용합니다. 복원·로그아웃은 기존 `/auth/me`, `/auth/logout`을 사용합니다.
- 쿠키/토큰 검증 실패 401, 충돌/미설정 409, 요청 형식 오류 422. 공통 `{code,message}` 계약을 유지합니다.

## Google Cloud 설정 순서

1. Google Cloud Console에서 프로젝트를 선택하거나 생성하고 Google Auth Platform의 브랜딩·지원 이메일을 입력합니다.
2. 대상은 프로젝트 용도에 맞춰 설정하고 테스트 모드라면 시연할 Google 계정을 테스트 사용자로 등록합니다.
3. 클라이언트에서 **웹 애플리케이션** OAuth 클라이언트를 생성합니다.
4. 승인된 JavaScript 원본에 다음을 등록합니다. 경로(`/login`, `/api`)는 붙이지 않습니다.
   - `http://localhost`
   - `http://localhost:3000`
   - `https://letdown-kilometer-nutcase.ngrok-free.dev`
5. 이 구현은 팝업의 JavaScript callback을 사용하므로 별도 승인된 리디렉션 URI·클라이언트 시크릿을 사용하지 않습니다. Google이 생성하는 시크릿을 Git이나 채팅에 복사하지 않습니다.
6. 발급된 `...apps.googleusercontent.com` 클라이언트 ID를 아래 서버 설정에 넣습니다. 프론트의 `/auth/google/config`도 같은 ID를 읽습니다.

공식 근거: [클라이언트 생성·JavaScript 원본](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [서버 ID 토큰 검증](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [callback·nonce](https://developers.google.com/identity/gsi/web/reference/js-reference).

## 로컬·공용 실행

backend/.env (Git 제외)에 설정합니다.

```dotenv
GOOGLE_CLIENT_ID=발급받은_웹_클라이언트_ID
GOOGLE_COOKIE_SECURE=false
```

- localhost HTTP 개발에서만 false를 사용합니다. 로컬 Next.js와 API 모두 `localhost`로 접속해 동일 사이트 쿠키가 전달되게 합니다(Next.js localhost, API 127.0.0.1 혼용 금지).
- 공용 HTTPS에서는 `GOOGLE_COOKIE_SECURE=true`, `CORS_ORIGINS`에 실제 프론트 원본을 정확히 설정합니다. nonce 쿠키 전달을 위해 공통 CORS의 allow_credentials를 true로 변경했습니다. 와일드카드 원본은 사용하지 않습니다.
- 설정 변경 후 FastAPI를 재시작합니다. 공용 배포는 기존 API env 파일에 두 값을 추가하고 최신 소스로 API·웹을 빌드해야 합니다. 기존 운영 env를 통째로 덮어쓰지 않습니다.
- 일반 JWT_SECRET·DATABASE_URL은 기존 값을 유지합니다. 로컬 개발용 .env를 공용 DB로 바꾸지 않습니다.

## 완료 전 실제 검증

실제 Google 계정으로 최초 USER 가입 → 두 번째 로그인 동일 사용자 → 새로고침 복원 → 비회원 장바구니 병합 → 로그아웃을 확인합니다. 기존 이메일 충돌은 로컬 테스트 계정으로 검증합니다. Google 계정·토큰을 기록하지 않고 결과만 남깁니다. 브라우저 팝업·FedCM 정책은 실제 배포 원본에서 확인해야 합니다.

자동 검사·로컬 검증 단계에서는 공용 서버·DB에 접근하지 않았으며, 이후 공용 배포 결과는 이 문서 상단에 별도로 기록했습니다. 자동 테스트의 Google 토큰은 테스트 RSA 키로 서명한 값이고 실제 Google 로그인을 대체하지 않습니다.
