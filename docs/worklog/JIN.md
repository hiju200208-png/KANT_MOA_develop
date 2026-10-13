## 2026-10-13 | 열린 이슈 검증 (#49 #89 #92 외) · 모바일 호버 잔류 수정

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: #49 #53 #54 #85 #89 #90 #91 #92 #93 #94 #96 / -
- 에이전트 사용: O (Claude Code)

### 검증 방법
- 배포 사이트(kant-moa.vercel.app)를 headless Chrome으로 직접 조작, DB는 `supabase db query --linked`로 확인
- 이미지: DB에 등록된 경로 전부(상품 대표·상세, 아티스트 로고·대표 사진, 멤버, 아티스트 배너)를 Storage 공개 URL로 요청
- E2E: 테스트 계정(`e2e-…@example.com`)으로 가입부터 주문 취소까지 화면을 순서대로 조작 (운영 DB는 이메일 인증 OFF라 메일 발송 없음)

### 결과
| 이슈 | 결과 |
|---|---|
| #92 이미지 경로 | 통과: 1,819개 전부 200, 404 0건. 캐시 문제는 새 파일명으로 교체하는 방식(`logo-v2.webp`)으로 처리 |
| #89 로그인 E2E | 통과 19/19: 비회원 장바구니 병합 · 새로고침 후 세션·헤더 수량 유지 · 배송지 추가 2·수정·기본 설정·삭제 · 주문 생성→결제→내역→취소 · 결제 후 장바구니에서 제거 · 재고 차감(150,200→149,199)과 취소 후 복구(→150,200) · 로그아웃·재로그인 |
| #49 인증·병합 | 통과: 가입 즉시 로그인, 로그인·로그아웃, 비회원 장바구니 자동 병합(localStorage 비움 확인), 새로고침 후 세션·수량 유지 |
| #90 배포 | 부분: 배포·라우트·이미지 정상. README에 배포 URL 없음 (#52와 함께) |
| #91 운영 설정 | 부분: 프로젝트 ACTIVE_HEALTHY, 이메일 인증 OFF. 앱에 비밀번호 재설정·소셜 로그인이 없어 Redirect URL은 현재 영향 없음. 유출 비밀번호 차단은 대시보드에서 확인 필요 |
| #53 Storage·배포 | 부분: 이미지·배포 완료. 정적 예비 데이터(`src/data`)가 기존 3팀 상품 47개뿐, 새 8팀 미반영 |
| #85 모바일 QA | 수정: 사용자 정의 `:hover` 3개가 터치 후 남음 → `@media (hover: hover)`로 감쌈. 포커스 표시 정상, 하단 내비 제거로 모달 겹침 없음 |
| #93 `/products` | 미완료: 배포 사이트 404 |
| #94 상품 없음 404 | 부분: 공통 404 화면은 나옴. "상품 목록으로" CTA 없음 (`/products` 없음) |
| #96 metadata | 미완료: 제목 있는 곳은 아티스트 목록·로그인·회원가입·최근 본 상품·404뿐. 상품 상세·아티스트별·장바구니·주문·마이페이지는 "KANT MOA"만 |

### 한 일
- 모바일 호버 잔류 수정 (`globals.css`): 마우스 기기는 기존과 같고, 터치 에뮬레이션에서 `:hover` 상태여도 효과가 안 보이는 것 확인
- E2E 테스트 데이터 정리: 테스트 계정 3개(중간 실패 2회 포함)와 취소된 주문 1·장바구니 4·배송지 1 삭제. 결제 상태 주문 없음을 먼저 확인하고 롤백 트랜잭션으로 사전 검증. 재고는 원래 값 그대로

### 남은 일 / TODO
- #93 `/products` 페이지, #94 상품 404 CTA, #96 페이지별 metadata (chungman·jina)
- 정적 예비 데이터에 새 8팀 반영 (#53)
- README 배포 URL (#52), 유출 비밀번호 차단 설정 확인 (#91)
- 메인 배너가 마우스를 올리면 멈추는데, 휴대폰에서 탭하면 다른 곳을 탭할 때까지 멈춰 있음 (사소함)

---

## 2026-10-12 (2) | 리디자인 백엔드 · 배송비 · DAYLOG 전달본 · 이미지 교체

- 작업자: jin
- 브랜치: dev/jin, ui/polish
- 관련 이슈 / PR: chungman 백엔드 요청서 / -
- 에이전트 사용: O (Claude Code)

### 한 일
- 리디자인 요청 9건 반영 (`20261012000010`~`000013`): 상품 배지 칸, tagline, product_images.kind, home_banners, notices(목 10건 이전), shop_settings, wishlists, get_best_products RPC
- 서비스: searchProducts, getBestProducts, getHomeBanners, excludeId, wishlist.ts, notices.ts, settings.ts
- 배송비 실제 부과: orders.shipping_fee, create_order 수정, 장바구니·주문서·주문 상세에 배송비 표시 (useShippingFee)
- DAYLOG 전달본 반영 (`000009`): 가격·이름·카테고리, 옵션 정리, 상세 이미지 재등록, 로고·히어로. 이미지 116개 업로드
- SODAFM 배너 2종 추가 (`000008`), 기존 3종 이미지 교체
- 이미지 교체: ORBIT:ON 대표 8, SODAFM 텀블러·인형, SODAFM 누끼 10 (기존 사진은 main-photo.webp로 백업)
- ui/polish: 메인·상품 상세 위버스샵 수치로 축소, Recommended Artist 로고 타일, 카드 캡션

### 결정 사항 / 이유
- 배송비는 표시만이 아니라 create_order에서 계산 (표시 금액 = 결제 금액). 설정이 없으면 0
- 인기 순위는 security definer로 집계하되 상품 id·순위만 반환 (주문 정보 비노출)
- 마스코트 이름은 상품 이미지 표기(지야·주야) 유지, 단일 옵션은 '기본' 유지
- 마이그레이션은 전부 롤백 트랜잭션으로 사전 검증 (배송비: 6,000원 주문 → 9,000원, 59,000원 → 무료)

### 남은 일 / TODO
- db push (000008~000013) 후 database.ts 재생성·비교, 정적 데이터 재생성
- home_banners 내용·이미지, 갤러리 이미지 (chungman)
- 이미지 스타일: 회색 배경으로 통일 결정 → SODAFM·DAYLOG 회색 배경 버전 필요

---

## 2026-10-12 | SODAFM 이미지·볼캡 판매 · 구매 제한 기본 4 · 배포 · SODAFM 배너

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: #102 등 / -
- 에이전트 사용: O (Claude Code)

### 한 일
- SODAFM 상품 대표·상세 20장, 멤버 사진 4장 업로드. 상세 이미지 9종 DB 연결 (`20261012000002`)
- SODAFM 볼캡 판매 시작, 재고 80 (`20261012000003`)
- ORBIT:ON 마스코트 인형 키링 → 인형 카테고리 (`20261012000004`)
- 구매 제한 없던 옵션 28개 → 1인 4개, 컬럼 기본값 4 (`20261012000005`). 5개 주문 차단 검증
- 정적 상품 데이터 DB 기준 갱신
- Vercel 배포 (https://kant-moa.vercel.app) 점검: 페이지 20개, 이미지 최적화, 칸트봇, 브라우저 번들 Supabase 주소 포함·Gemini 키 미노출
- 스켈레톤 로딩 펄스 → 쉬머 (`motion.css`, `ui/Skeleton.tsx`), Vercel 함수 리전 서울(icn1) 고정
- DAYLOG 이미지 94장 업로드. 신규 상품 22종, 후드 → 데일리 후드 집업(색상×사이즈), 하트 리본 키링 → 인형 키링(마스코트 4종), 상세 이미지 62장 (`20261012000007`). 가격은 이미지에 없어 다른 그룹 기준으로 임의 책정
- 정적 상품 데이터 47개로 재생성
- 아티스트 배너: `artist_banners` 테이블 + SODAFM 3종 (`20261012000006`), `getArtistBanners`, `ArtistBanners.tsx`에서 등록 배너 우선 사용

### 결정 사항 / 이유
- 배너는 hero 교체 대신 별도 테이블 (hero는 멤버 소개 페이지 상단에도 쓰임, 다른 그룹은 기존 방식 유지)
- 배너 이미지는 글씨 없는 버전 사용 (화면이 제목·부제를 겹쳐 그려 글씨 중복 방지)
- DAYLOG 기존 옵션 행은 주문 이력이 참조해 삭제하지 않고 이름만 변경
- 배너 조회 실패 시 기본 구성으로 대체 → PR 머지와 db push 순서와 무관하게 안전

### 남은 일 / TODO
- Supabase Auth URL Configuration에 배포 주소 등록
- DAYLOG 로고 (팀원 전달 예정)

## 2026-10-12 | AI 챗봇(칸트봇) 백엔드 · Gemini 연동

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: sungho 칸트봇 UI(키워드 답변) → AI 연동 / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 칸트봇에 AI 답변 연결 (Gemini 무료 API)

### 한 일
- `@google/genai` 설치, `.env.example`에 `GEMINI_API_KEY`
- `src/lib/kantbot.ts`: DB 상품 목록(5분 캐시) + 쇼핑몰 정책을 시스템 지시로 넣어 Gemini 호출. `gemini-3.5-flash`, 429면 `gemini-3.5-flash-lite`
- `src/app/api/chat/route.ts`: 입력 검사(500자, 이전 대화 10개), IP당 1분 10회 제한, 실패 시 503
- `src/services/chat.ts` + `components/chatbot/kantBotReply.ts`: AI 호출, 실패 시 기존 키워드 답변으로 대체
- 문서: SETUP 2장·BACKEND에 Route Handler 예외, API_SPEC 5-2장
- 테스트: 가격·구매 제한, 품절, 대화 문맥, 관계없는 질문 거절, 개인정보 안내, 추천+링크, 입력 검사(400), 요청 제한(429)

### 결정 사항 / 이유
- 상품이 25개뿐이라 검색 도구 없이 전체 목록을 프롬프트에 포함
- Gemini 무료 티어는 입력이 학습·사람 검토에 쓰일 수 있어 회원·주문 정보는 보내지 않음
- 무료 한도는 프로젝트 전체 합산 → 한도 초과 시 lite 모델, 그래도 실패하면 키워드 답변
- gemini-2.5 계열은 신규 사용자에게 제공 종료(404)라 3.5 사용
- 요청 제한은 서버 메모리 기준 (ponytail 주석: 여러 인스턴스에선 느슨함)

### 남은 일 / TODO
- Vercel 배포 시 `GEMINI_API_KEY` 환경 변수 등록
- 칸트봇 화면에 "개인정보는 입력하지 마세요" 안내 문구 (sungho)
- 답변의 `/products/번호`를 클릭 가능한 링크로 표시 (sungho, 선택)

## 2026-10-12 | ORBIT:ON 이미지 교체 · 아크릴 키링 숨김

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: chungman 이미지 수정본 / -
- 에이전트 사용: O (Claude Code)

### 한 일
- 수정본 폴더 비교: 대표·로고·멤버는 동일, 상세 8장 교체(webp 1200px), hero 신규
- Storage 업로드 9장 (hero 1920×720 webp 변환, 상세 8장은 원본 그대로), 바이트 일치 확인
- `20261012000001_hide_orbit_on_acrylic_keyring.sql`: ORBIT:ON 아크릴 키링 숨김 (마스코트 인형 키링으로 대체, 팀 결정)
- `src/data/products.ts` 재생성 (25개, 아크릴 키링 제외)

### 남은 일 / TODO
- PR 머지 후 db push (순서 지키기)
- 남은 이미지: DAYLOG logo·hero·멤버 4·인형 상세, SODAFM 멤버 4·구 상품 3종

## 2026-10-11 | ORBIT:ON 이미지·상품 반영 · 보안 어드바이저 · PR #33 리뷰 · 정적 데이터 갱신

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: #33(sungho, 리뷰), #36·#37 / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 남은 백엔드 작업 점검
- PR #33(과제 규격 정적 데이터 + DB 장애 대체) 리뷰
- ORBIT:ON 이미지 폴더 업로드 및 상품 반영
- 정적 상품 데이터(src/data/products.ts)를 DB 기준으로 갱신 (sungho 대신)

### 한 일
- `supabase db lint` 이상 없음, `supabase db advisors` 점검
  - `20261008000002_revoke_trigger_functions.sql`: 트리거 전용 함수 4개(handle_new_user, addresses_*, rls_auto_enable) 외부 RPC 실행 권한 회수
- PR #33 리뷰: 정적 상품 21개를 DB와 전 필드 대조(일치), tsc·lint 통과 → 승인
- ORBIT:ON 이미지 22장 변환·업로드 (로고, 멤버 5명 얼굴 crop 1080², 상품 8종 대표·상세), 원본 바이트 일치 22/22
- `20261011000001_update_orbit_on_products.sql`: 로고 후드티 → 유니폼 져지, 신규 5종(마스코트 인형 키링·멤버십 카드·볼캡·스티커 세트·팔찌), 상세 이미지 7장 연결, 앨범 detail-2 제거
- `src/data/products.ts`: DB에서 자동 생성해 26개로 갱신 (isNew: 최신 6개)
- 검증: 신규 상품·옵션·이미지, 권한 회수 후 회원가입·프로필 자동 생성, 트리거 함수 외부 호출 차단 (PGRST202)

### 결정 사항 / 이유
- 어드바이저의 auth_rls_initplan(성능) 경고는 현재 데이터 규모에서 영향 없어 보류
- 주문·장바구니·주소 RPC의 authenticated 실행 경고는 의도된 설계 (함수 내부에서 본인 확인)
- ORBIT:ON 아크릴 키링, SODAFM 슬로건 타올·볼캡·머그컵은 유지 (임시 이미지)
- 멤버 사진은 프로필 카드(글씨 포함)에서 얼굴만 crop (멤버 정보는 DB에 있어 화면이 따로 표시)
- 정적 데이터는 손으로 고치지 않고 DB에서 생성 (id·옵션 id 불일치 방지)

### 멈춘 지점 / 보고한 내용
- db push를 PR 머지 전에 실행함 → 직후 머지되어 리포·DB 일치 확인, 문제 없음
- 회원가입 확인용 테스트 계정 추가: kantmoa-test-c-1791720936011@mailinator.com (주문 없음, 삭제 가능)

### 남은 일 / TODO
- 남은 이미지: ORBIT:ON hero(1920×720)·아크릴 키링, DAYLOG logo·hero·멤버 4·인형 상세, SODAFM 멤버 4·구 상품 3종
- DB 상품이 바뀌면 src/data/products.ts 재생성
- 시연 전 Supabase 프로젝트 일시정지 여부 확인 (무료 플랜 비활성 시 일시정지)
- Vercel 배포, Supabase Auth URL 등록, 이메일 인증·유출 비밀번호 차단 운영 설정 결정

## 2026-10-08 | 이미지 업로드 · 신규 상품 9종 · 파비콘 · 테마 색상 확정

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: 팀원 이미지 zip 3개, chungman 이미지 요청 / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 팀원이 보낸 이미지 zip을 Storage에 업로드, DB에 없는 신규 상품 등록
- 이미지 규격 확정 (위버스샵 기준)
- KANT MOA 로고로 파비콘·사이트 아이콘 교체
- DAYLOG·SODAFM 테마 색상 확정 반영

### 한 일
- Storage: 임시 이미지 21장 업로드 → 실제 이미지 16장으로 교체·추가 (DAYLOG 상품 4, SODAFM hero·logo·멤버십 카드, 신규 상품 9)
- `supabase/migrations/20261007000010_add_daylog_sodafm_products.sql`: DAYLOG 3종·SODAFM 6종 상품·옵션 등록 → db push (jin 실행)
- `next.config.ts`: next/image에 Supabase Storage 도메인 허용
- DB_DESIGN 6-9: 이미지 규격표 (상품 main 1440², detail 가로 1200, logo·멤버 1080², hero 1920×720)
- `src/app/favicon.ico`(16·32·48), `src/app/apple-icon.png`(180): 로고의 거품 + 보라 그라데이션 배경
- `supabase/migrations/20261008000001_update_theme_colors.sql`: DAYLOG `#F4C2C2`(베이비핑크), SODAFM `#87CEEB`(스카이블루)

### 결정 사항 / 이유
- 이미지는 팀원이 폴더 구조(= Storage 경로)대로 zip 전달 → jin이 경로 검증·변환·업로드
- 파비콘은 K 글자가 A와 붙어 있어 분리 불가 → 로고의 독립된 거품 사용, 16px 가독성 위해 보라 배경
- Storage 교체 후 화면 반영 안 되는 원인: next/image 캐시(최소 4시간). `.next/dev/cache/images` 삭제 + 서버 재시작 필요 (Ctrl+Shift+R로는 안 됨)
- 이미지 교체 시 CLI는 덮어쓰기 불가 → rm 후 cp. Windows에서는 cp 원본을 상대경로로 (드라이브 문자가 URL로 오인)

### 멈춘 지점 / 보고한 내용
- chungman `storage-upload` 폴더는 실제로 전달되지 않음 → 재요청 필요

### 남은 일 / TODO
- 남은 이미지 (2026-10-08 기준): ORBIT:ON 상품 7·logo·hero(1920×720)·멤버 5, DAYLOG logo·hero·멤버 4·인형 상세, SODAFM 멤버 4
- SODAFM 슬로건 타올·볼캡·머그컵 유지/숨김 결정
- 브라우저에서 비회원 장바구니·로그인 병합·주문 흐름 점검
- Vercel 배포, Supabase Auth URL 등록

## 2026-10-07 | 아티스트 멤버 소개(artist_members) · 테마 색상

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: chungman 요청 (아티스트 페이지 멤버 소개) / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- artist_members 테이블, getArtistMembers(slug), 멤버 이미지 경로 규칙

### 한 일
- `supabase/migrations/20261007000009_add_artist_members.sql`: 테이블·RLS + 13명 데이터 + DAYLOG/SODAFM 테마 색상 + 앨범명 [LIFTOFF] → db push (jin 실행)
- `getArtistMembers` (services/products.ts), `ArtistMember` 타입, database.ts 재생성
- API_SPEC 2장, DB_DESIGN 2장 정책·ERD·6-12 반영
- 실제 DB 검증 6항목 통과

### 결정 사항 / 이유
- 굿즈 멤버 옵션은 기존 option_name 유지, 멤버 테이블은 소개 전용 (FK 없음)
- description·tags 컬럼 추가 (DAYLOG·SODAFM 화면에 한 줄 소개·해시태그 존재)
- 이미지 파일명은 영문 소문자 (`members/sunwoo.webp`)
- DAYLOG·SODAFM 마스코트·생일·MBTI는 컨셉에 맞춰 임의 작성 (jin 승인)
- seed.sql은 수정하지 않음 (변경 시 --include-seed 재실행되면 중복 에러)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 멤버 사진 zip 받아서 업로드 (ORBITON 폴더는 chungman PC)

## 2026-10-07 | 배송지(addresses) 추가 · 비회원 장바구니 순서 버그

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: sungho 요청 (마이페이지 배송 주소 관리) / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- addresses 테이블, services/addresses.ts, Address 타입, API_SPEC 반영
- 비회원 장바구니 수량 변경 시 항목이 맨 아래로 내려가는 버그

### 한 일
- `supabase/migrations/20261007000008_add_addresses.sql` (테이블·RLS·트리거·set_default_address RPC) → db push (jin 실행)
- `src/services/addresses.ts`, `src/types/app.ts` (Address, AddressInput), `src/types/database.ts` 재생성
- `src/services/cart.ts` 비회원 setQuantity 제자리 수정
- API_SPEC v1.1 (5-1장), DB_DESIGN (ERD, 6-11), BACKEND (RPC 목록)
- 실제 DB 검증 13항목 통과 (자동 기본, 기본 변경, 기본 삭제 재지정, 남의 주소 차단, is_default 직접 수정 차단)

### 결정 사항 / 이유
- 첫 주소 자동 기본·기본 삭제 시 재지정은 services가 아닌 DB 트리거로 처리 (요청 중단돼도 기본 0개/2개 방지)
- is_default 컬럼 update 권한 회수 → RPC로만 변경
- set_default_address에서 해제 → 지정 순서 (부분 유니크 인덱스가 행 단위 즉시 검사)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- sungho 마이페이지·주문서 연동 후 브라우저 확인

## 2026-10-07 | 백엔드 B1~B6 (마이그레이션·seed·services)

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: - / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 프론트가 mock 없이 실제 데이터로 작업할 수 있도록 백엔드 전체 완료

### 한 일
- `supabase/migrations/` 7개 (테이블, 트리거, RLS, merge_cart, 주문 RPC, 실행 권한, Storage 버킷) + `supabase/seed.sql` → `db push --include-seed` (jin 실행)
- `src/types/database.ts` 생성, `src/lib/supabase/client.ts`
- `src/services/` products, auth, cart, orders, storage 작성
- 실제 DB 검증: 카탈로그 13항목, BACKEND.md 10장 시나리오 포함 22항목 전부 통과

### 결정 사항 / 이유
- 카탈로그는 세션 없는 공개 클라이언트 → 서버/클라이언트 컴포넌트 모두 사용 가능
- 로그인 필요한 함수는 클라이언트 전용, server.ts·proxy.ts는 필요해질 때 추가 (API_SPEC 3장 반영)

### 멈춘 지점 / 보고한 내용
- 이메일 인증이 켜져 있어 테스트 가입 실패 → jin이 대시보드에서 끔

### 남은 일 / TODO
- 브라우저에서 비회원 장바구니(localStorage)·로그인 병합 흐름 확인 (프론트 연동 시)
- ~~Storage 이미지 업로드~~ 일부 완료 (2026-10-08 기록 참고), ~~DAYLOG·SODAFM theme_color~~ ✅ 2026-10-08 반영

## 2026-10-07 | 초기 세팅 · API 명세 · 공용 타입(B0)

- 작업자: jin
- 브랜치: dev/jin
- 관련 이슈 / PR: - / -
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- Next.js + Supabase 초기 세팅, 팀원 이름·브랜치 문서 반영
- 백엔드 작업 계획 수립 및 API 명세서 작성
- chungman 요청: 아티스트 배경 이미지 필드 추가
- B0: services 반환 타입 작성

### 한 일
- 프로젝트 생성(Next.js 16.4), Supabase init/link, main·develop·dev/jin 브랜치 생성
- `docs/API_SPEC.md` 작성 (v1.0 확정)
- SETUP/BACKEND/FRONTEND/DB_DESIGN: proxy.ts, auth.ts, app.ts, Auth 에러 코드, 브랜치 규칙 반영
- `artists.hero_image_path` / `Artist.heroImageUrl` 추가, hero 이미지 1920×720 예외 규칙
- `src/types/app.ts`, `src/services/errors.ts` 작성

### 결정 사항 / 이유
- 이메일 인증 OFF (개발 편의, 운영 전 재검토)
- Next.js 16에서 middleware → proxy 이름 변경, `src/proxy.ts` 사용
- errors.ts는 의존성이 없어 B0에 같이 포함 (프론트 error-messages.ts가 AppErrorCode를 import)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- ~~Supabase 대시보드에서 Confirm email 끄기~~ ✅ 완료
- ~~DAYLOG, SODAFM theme_color 전달받기~~ ✅ 2026-10-08 반영
- ~~B1: 테이블·트리거 마이그레이션~~ ✅ 완료
