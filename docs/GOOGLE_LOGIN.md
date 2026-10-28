# Google 로그인 구현·설정

2026-10-28. **로컬 구현·자동 검증 단계입니다. Google Cloud의 기존 웹 클라이언트와 공용 원본 등록을 확인했으며, 서버 설정 연결·실제 Google 계정 검증과 공용 배포는 아직 하지 않았습니다.**

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

공용 서버·DB에는 이번 구현을 배포하거나 테스트 데이터를 넣지 않았습니다. 자동 테스트의 Google 토큰은 테스트 RSA 키로 서명한 값이고 실제 Google 로그인을 대체하지 않습니다.
