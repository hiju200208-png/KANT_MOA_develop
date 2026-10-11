## 2026-10-08 | 메인 배너 색 한 톤 낮추기

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 메인 배너 색이 너무 진해서 한 톤 낮춰 부드럽게

### 한 일
- `MainHeroCarousel.tsx`: 가운데 톤 밝기 0.34 → 0.48, 채도 상한 0.15 → 0.10, 대체 단색 혼합 30% → 45%
- SODAFM·DAYLOG 배너 화면 확인, `npx tsc --noEmit`, eslint 통과

### 결정 사항 / 이유
- 흰 글자 명도 대비(약 6:1)를 지키는 선에서 밝기를 올림 (0.52 넘으면 글자가 흐려짐)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 없음

## 2026-10-08 | 메인 배너·ARTIST 영역 개선, 메인 간격 정리

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 메인 배너: 8초 자동 슬라이드, 크기 축소, 슬라이드 모션, 그룹 시그니처 컬러 배경·좌우 그라데이션, 페이지 마크 클릭 이동, 화살표 크게·테두리 원 제거
- 배너 아래 아티스트 영역을 심플한 카드로 변경, 검색 바 얇게
- 메인 페이지 전체 간격 정리

### 한 일
- `MainHeroCarousel.tsx`: 8초 자동 넘김(마우스 올림·포커스·동작 줄이기·탭 숨김 시 정지), 이미지 2:1, translateX 슬라이드, 그룹 색의 진한 톤 + 좌우 원색 그라데이션(oklab), 마크 버튼, 큰 화살표
- `page.tsx`: 배너에 아티스트 `theme_color` 전달, 섹션 간격 규칙(8px 단위, 섹션 사이 56/80px) 적용
- `ArtistPicker.tsx`: 사진·소개·해시태그 없는 흰 카드(태그라인 + 그룹명), 마우스 올리면 카드 아래 시그니처 컬러 빛, 인기 검색어 제거, 제목 "ARTIST"만 남김, 카드·검색 바 간격 정리
- 1440px·375px에서 간격 실측, `npx tsc --noEmit`, eslint 통과

### 결정 사항 / 이유
- 파스텔 색을 그대로 어둡게 하면 갈색으로 탁해져서 oklch로 채도를 올린 진한 톤 사용
- 모바일은 그라데이션 폭(`--edge`)을 좁혀 글자를 덮지 않게 함
- 태그라인은 DB에 없는 마케팅 문구라 프론트 상수로 둠

### 멈춘 지점 / 보고한 내용
- 장충만 담당 파일(메인)이라 변경 내용 공유 필요

### 남은 일 / TODO
- ORBIT:ON·DAYLOG Storage 히어로 이미지가 placeholder 상태 → 교체 필요

## 2026-10-09 | 과제 규격 Mock 데이터 + DB 장애 시 대체 데이터

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 과제 요구사항 "data/products.ts에 6개 이상 상품, types/product.ts의 Product 규격"을 충족
- 정적 데이터는 DB 장애 시 대체 데이터로 사용

### 한 일
- `src/types/product.ts`: 과제 규격 `interface Product`(id·name·price·category·imageUrl·description·isNew?)와 화면 대체용 `StaticProduct`
- `src/data/products.ts`(DB 상품 21개 사본, 옵션·재고 포함), `src/data/catalog.ts`(아티스트 3·카테고리 7)
- `src/services/fallback.ts`: 정적 데이터로 services와 같은 반환 형태 생성 (정렬·필터·페이지 포함)
- `src/services/products.ts`: `getArtists`·`getArtist`·`getCategories`·`getProducts`·`getProduct`가 DB 에러 시 throw 대신 대체 데이터 반환, `[fallback]` 경고 로그
- README 7·8·9장에 정적 데이터와 DB 장애 대비 설명 추가
- 확인: 잘못된 Supabase URL로 빌드·실행해 메인·상세·카테고리·아티스트 페이지가 정적 데이터로 그려지는 것 확인 (`[fallback]` 로그 35회), 이후 정상 환경으로 다시 빌드. `tsc`, `eslint`, `npm run build` 통과

### 결정 사항 / 이유
- DB를 걷어내지 않고 정적 데이터를 "장애 시 대체"로 둠: 과제 Mock 요구 충족 + 시연 당일 Supabase 일시정지·네트워크 문제 대비
- 장바구니(로그인)·주문·결제는 DB가 필요해 대체하지 않음
- `getArtistMembers`(멤버 소개)는 대체 데이터 없음 → 기존 에러 화면 유지

### 멈춘 지점 / 보고한 내용
- `src/services/`는 jin 담당 영역 → 사용자 판단으로 진행, PR에 이유를 적고 jin을 리뷰어로 지정

### 남은 일 / TODO
- DB 상품이 바뀌면 `src/data/products.ts`도 갱신 필요 (자동 동기화 없음)

## 2026-10-08 | 결제 완료 거품 애니메이션

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- motionsites.ai 같은 애니메이션 중 결제 완료 화면에 거품 애니메이션 추가

### 한 일
- `src/components/order/PaymentSuccessMark.tsx` 생성: 민트 원이 톡 튀어나옴(0~0.45초) → 흰 체크가 그려짐(0.3~0.7초) → 소다 거품 7개가 위로 올라가며 사라짐(0.55~2.9초), 마지막엔 체크만 남음
- `src/components/order/OrderDetail.tsx`: 주문 상태가 `paid`일 때 상태 배지 위에 표시
- 임시 페이지로 띄워 시간대별 값(원 크기, 체크 선, 거품 위치·투명도)이 의도대로 바뀌는지 확인 후 임시 페이지 삭제
- `npx tsc --noEmit`, `eslint src/components/order` 통과

### 결정 사항 / 이유
- `globals.css`(jina 담당 핫스팟)에 keyframes를 넣지 않으려고 SVG `<animate>`로 구현, 새 패키지 없음
- 색은 `text-brand` + `currentColor`로 디자인 토큰을 그대로 사용
- 동작 줄이기 설정 사용자는 `motion-reduce:`로 정지된 체크 아이콘만 표시
- 장식용이라 `aria-hidden`, 결제 완료 문구는 기존 제목이 전달

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 실제 결제 흐름(주문서 → 결제 → 주문 상세)에서 로그인 상태로 한 번 더 확인
- 다른 화면 애니메이션(카드 호버, 히어로 거품, 카트 뱃지)은 담당자에게 제안 예정

## 2026-10-08 | README 초안 작성

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 과제 산출물 기준(프로젝트 소개, 컴포넌트 구조도, 실행 방법, 화면 캡처)으로 README 초안 작성

### 한 일
- `README.md`를 create-next-app 기본 문서에서 프로젝트 문서로 교체
  - 주요 기능, 기술 스택, 실행 방법(clone → install → env → dev, 직접 Supabase 구성 시 순서), 화면·경로표, 사용자 흐름
  - 컴포넌트 구조도(텍스트 트리, 실제 import 기준), 폴더 구조, ERD(mermaid), services 연동 방식
  - 과제 평가표 대응표, 팀원·역할, 협업 방식, 트러블슈팅 4건
- 기능 설명은 코드로 확인 후 작성 (정렬·더보기, 품절·구매 제한, 장바구니 순서 수정, next 복귀 등)

### 결정 사항 / 이유
- 과제의 `data/products.ts` 대신 DB를 쓴 점을 평가표 대응표와 ERD 섹션에 명시 (증빙 항목 #3 대응)
- 화면 캡처는 이미지가 없어 표 자리만 만들고 TODO 주석으로 표시

### 멈춘 지점 / 보고한 내용
- README는 팀 공용 파일 → PR 전에 팀 공유 필요
- 팀원 실명·역할 매칭, 배포 URL, 화면 캡처, 팀원별 트러블슈팅은 TODO로 남김

### 남은 일 / TODO
- `docs/screenshots/`에 캡처 추가 후 표를 이미지로 교체
- 배포 URL 추가

## 2026-10-07 | "상품 보러가기" 404 수정

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 장바구니의 "상품 보러가기"가 404로 가는 문제 수정

### 한 일
- 장바구니 빈 화면, 주문/취소 내역 빈 화면, 주문 상세 "쇼핑 계속하기"의 링크를 `/category/all` → `/`(메인)으로 변경
- 브라우저에서 장바구니 → 상품 보러가기 → 메인 이동 확인

### 결정 사항 / 이유
- 전체 상품 목록 페이지가 없고 `/category/[slug]`는 실제 카테고리만 받아서 `all`은 404. 상품을 둘러볼 수 있는 메인으로 연결

### 멈춘 지점 / 보고한 내용
- `MobileBottomNav.tsx`(jina 담당)의 "아티스트" `/artists`도 목록 페이지가 없어 404 → 아티스트 목록 페이지(chungman) 또는 링크 수정(jina) 필요
- 전체 상품 페이지가 생기면 위 링크를 그쪽으로 바꾸면 됨

## 2026-10-07 | 배송 주소 관리 + 주문서 배송지 선택

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: jin PR #17(addresses) 머지 이후
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 마이페이지 배송 주소 관리, 주문서에서 저장된 배송지 사용

### 한 일
- `src/components/address/`: `addressDraft.ts`(입력값 변환·검증·연락처 하이픈·주문용 주소 문자열), `AddressFields`(입력 칸), `AddressForm`(저장 폼), `AddressSummary`(주소 표시)
- `/mypage/addresses`: 목록(기본 배송지 배지), 추가·수정·삭제·기본으로 설정, 최대 10개, 빈 화면 안내. 마이페이지 메뉴 "준비 중" 해제
- `checkout`:
  - 저장된 배송지가 있으면 기본 배송지(`getAddresses()[0]`)를 카드로 보여주고 "배송지 변경" 모달에서 선택·새로 추가
  - 없으면 입력 칸(이름·연락처는 프로필 기본값) + "기본 배송지로 저장"(기본 체크) → 주문 생성 후 저장
  - 주문에는 `address1 address2` 문자열로 저장 (API_SPEC 5-1장)
- `npm run build`, `tsc`, `eslint` 통과 / 비로그인 시 `/mypage/addresses` 로그인 안내 확인

### 결정 사항 / 이유
- 마이페이지 입력 폼은 칸이 많아 모달 대신 페이지 안에 펼침, 주문서는 흐름을 끊지 않도록 모달에서 선택·추가
- 기본 배송지 해제 기능은 없음 (다른 주소를 기본으로 지정하면 자동 해제) → 이미 기본인 주소 수정 시 체크박스 숨김, 첫 주소는 DB가 자동 기본 지정
- 주소 저장 실패는 주문을 막지 않음
- 우편번호 검색(카카오 우편번호 서비스)은 외부 스크립트라 팀 합의 전까지 직접 입력

### 멈춘 지점 / 보고한 내용
- 로그인 상태 화면(주소 CRUD, 주문서 배송지 선택·저장)은 테스트 계정이 없어 에이전트가 직접 보지 못함 → 사람이 확인 필요

### 남은 일 / TODO
- 우편번호 검색 도입 여부 팀 결정

## 2026-10-07 | 주문 내역 상태 탭 + 메뉴형 마이페이지

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 주문 내역과 취소 내역을 한 화면에서 보기 (상태 탭)
- 위버스샵처럼 마이페이지를 메뉴 목록으로 바꾸고 정보 수정은 별도 페이지로

### 한 일
- `src/components/order/OrderList.tsx` 추가, `/orders`는 Suspense로 감싸기만 함
  - 탭: 전체 / 결제 완료 / 결제 대기 / 취소, 주소 `?status=` 반영(새로고침·뒤로 가기·링크 공유 유지), 탭별 개수, 탭별 빈 화면 문구
  - 전체 탭에서 취소된 주문은 흐리게 표시
- `/mypage`: 프로필 카드(로그아웃) + 메뉴 목록 — 쇼핑(주문/취소 내역 → `/orders`), 내 정보(배송 주소 관리 "준비 중", 내 정보 수정)
- `/mypage/profile` 추가: 기존 정보 수정 폼 이동, 이메일은 읽기 전용
- `npm run build`, `tsc`, `eslint` 통과 / 비로그인 시 `/orders?status=cancelled`, `/mypage/profile` 로그인 안내와 `next` 경로 확인

### 결정 사항 / 이유
- 취소는 별도 절차가 아니라 주문 상태 하나라서 페이지를 나누지 않고 같은 목록을 탭으로 거름
- `?status=`는 클라이언트에서 `useSearchParams()`로 읽고 페이지에서 `<Suspense>`로 감쌈 (`cacheComponents`; 주문 상세와 같은 방식)
- 배송 주소 관리는 백엔드(배송지 테이블) 준비 후 연결, 청구 주소는 가짜 결제라 제외

### 멈춘 지점 / 보고한 내용
- 로그인 상태 화면(탭 목록, 마이페이지 메뉴)은 테스트 계정이 없어 에이전트가 직접 보지 못함 → 사람이 확인 필요

### 남은 일 / TODO
- 배송 주소 관리 (`/mypage/addresses`, 주문서 배송지 선택) — jin의 addresses 테이블·services 이후

## 2026-10-07 | mock → 실제 services 교체

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- develop에 올라온 `src/services/`, `src/types/app.ts`로 장바구니·주문·마이페이지의 mock 교체

### 한 일
- `src/hooks/useCart.ts`: `@/services/cart` 사용. `useAuth()`로 사용자 변경(로그인·로그아웃)을 감지해 장바구니 다시 불러오기. 첫 로드 실패 시 빈 장바구니
- `checkout`: `AuthProvider` 프로필로 받는 분·연락처 기본값, 비로그인 시 로그인 안내, 결제 후 장바구니 새로고침
- `orders`, `orders/[id]`(`OrderDetail`): 비로그인 시 로그인 안내, 조회 실패 메시지 처리, 목록에 "외 N건" 표시(services는 첫 상품명만 반환), 결제·취소 후 장바구니 새로고침
- `mypage`: `AuthProvider` 프로필 사용, `updateProfile`(빈 연락처는 null), 로그아웃 버튼(모바일에서는 헤더 로그아웃이 숨겨짐)
- `src/components/order/LoginRequired.tsx` 추가 (`/login?next=` 이동)
- 장바구니 개발용 "샘플 담기" 버튼과 `src/mocks/` 삭제
- `npm run build`, `tsc`, `eslint` 통과 / 비회원 장바구니(실제 DB 상품) 표시·수량 변경·삭제, 비로그인 시 주문서·주문 내역·주문 상세·마이페이지 로그인 안내 확인

### 결정 사항 / 이유
- 로그인 시 비회원 장바구니 병합은 `onAuthChange`가 `mergeGuestCart` 후 프로필을 넘기므로, `useCart`는 프로필 id가 바뀔 때 `refresh()`만 하면 됨 (`layout.tsx` 수정 불필요)
- 프로필 기본값은 effect에서 setState하지 않고 "사용자가 고친 값 ?? 프로필 값"으로 계산

### 멈춘 지점 / 보고한 내용
- 로그인 상태 흐름(병합·주문·결제·취소·프로필 수정)은 테스트 계정이 필요해서 에이전트가 확인하지 못함 → 사람이 확인 필요
- `services/cart.ts`(jin 담당): 비회원 장바구니에서 수량을 바꾸면 `setQuantity`가 항목을 지우고 끝에 다시 붙여서 목록 순서가 바뀜
- 헤더 카트 뱃지는 여전히 `0` 고정 (`Header.tsx`, jina 담당)

### 남은 일 / TODO
- 로그인 상태 전체 흐름 수동 테스트
- 헤더 뱃지 연동 (jina와 협의)

## 2026-10-07 | 주문서·주문 상세·주문 내역·마이페이지 + 에러 메시지 상수

- 작업자: SUNGHO
- 브랜치: dev/sungho
- 관련 이슈 / PR: 없음
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 담당 페이지(장바구니, 주문서, 결제 완료, 주문 내역, 마이페이지) 완성

### 한 일
- `src/app/(shop)/checkout/page.tsx`: 배송 정보 입력(프로필로 이름·연락처 기본값), 검증, `createOrder` → `payOrder` → `/orders/{id}` 이동
- `src/app/(shop)/orders/page.tsx`: 주문 내역 목록 (상태 배지, 날짜, "상품명 외 N건")
- `src/app/(shop)/orders/[id]/page.tsx` + `src/components/order/OrderDetail.tsx`: 결제 완료/대기/취소 상태별 화면, 다시 결제·주문 취소
- `src/app/(shop)/mypage/page.tsx`: 프로필 확인·수정, 주문 내역 링크
- `src/components/order/OrderStatusBadge.tsx` 추가
- `src/constants/error-messages.ts`: API_SPEC 6장 에러 코드별 메시지, 장바구니 페이지도 이 상수 사용
- `src/mocks/orders.ts`, `src/mocks/errors.ts`: `services/orders.ts`·`auth.ts`(프로필)·`errors.ts`의 임시 구현 (localStorage)
- `npm run build`, `tsc`, `eslint` 통과 / 브라우저에서 장바구니 → 주문서 검증 → 결제 → 주문 상세 → 취소 → 주문 내역, 없는 주문 ID 접근 확인

### 결정 사항 / 이유
- 이 프로젝트는 `cacheComponents: true`라서 라우트 파라미터를 읽는 컴포넌트는 `<Suspense>` 안에 있어야 빌드됨
- 서버 컴포넌트에서 `await params` 후 클라이언트 컴포넌트에 넘기는 방식은 빌드는 되지만 직접 URL 접속·새로고침 시 Suspense 안쪽이 하이드레이션되지 않고 스켈레톤에 머무는 문제가 있었음 → 페이지는 동기 컴포넌트로 `<Suspense>`만 두고, 클라이언트 컴포넌트에서 `useParams()`를 쓰는 방식으로 변경
- 결제 실패 시 주문은 결제 대기로 두고 주문 상세로 이동 (API_SPEC 5장: 주문 상세에서 다시 결제/취소)
- 비로그인(`NOT_AUTHENTICATED`) 처리는 `/login?next=` 이동으로 연결만 해 둠 (로그인 페이지는 jina 담당)

### 멈춘 지점 / 보고한 내용
- 헤더 카트 뱃지가 `0`으로 하드코딩되어 있음 (`src/components/layout/Header.tsx`, jina 담당). `CartBadge`(client) 분리 후 `useCart().totalQuantity` 연결 협의 필요
- 로그인 시 비회원 장바구니 병합: services의 `mergeGuestCart`는 백엔드 자동 처리지만, 로그인 후 `useCart().refresh()` 호출과 `onAuthChange` Provider는 services 머지 후 jina와 협의

### 남은 일 / TODO
- `services/cart.ts`, `orders.ts`, `auth.ts`, `src/types/app.ts` 머지 후 mock 제거 및 import 교체 (`useCart.ts`, checkout/orders/mypage 페이지, `error-messages.ts`)
- 로그아웃 버튼(마이페이지)은 `signOut` 연결 후 추가
- 상품 이미지 연결 (현재 thumbnailUrl 없음 → "이미지 없음" 표시)
- 모바일 화면 확인
