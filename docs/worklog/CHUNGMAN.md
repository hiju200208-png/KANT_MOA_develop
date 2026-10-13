## 2026-10-13 | dev/chunga: 상품·아티스트 좋아요, 상품 공유, 상품 검색

- 작업자: chungman
- 브랜치: dev/chunga (develop `ec47430` 반영)
- 관련 이슈 / PR: 아티스트 좋아요 backend-request (JIN, 등록 예정) / (PR 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 아티스트·상품 좋아요. 상품 좋아요는 최근 본 상품 옆 버튼으로 목록 보기, 아티스트 좋아요는 많은 순으로 메인 배너 노출
- 상품 공유 링크 버튼, 상품 검색

### 한 일
- 상품 좋아요 (기존 `services/wishlist.ts` 사용)
  - `LikeButton`: 상품 상세 가격 오른쪽 하트. 비로그인은 로그인 페이지로
  - 최근 본 상품 동그라미를 누르면 오는 페이지(`/recently-viewed`)를 "내 상품"으로 바꾸고 탭 2개: 최근 본 상품 · 좋아요(`?tab=likes`, `LikedProductList`, 로그인 필요·빈 상태·오류 상태)
  - 처음엔 동그라미 옆에 하트 버튼을 따로 만들었다가, 요청대로 버튼 없이 탭으로 수정. `/likes`는 좋아요 탭으로 이동
  - 최근 본 상품 동그라미: 최근 본 상품이 없어도 좋아요한 상품이 있으면 하트로 보이고 좋아요 탭으로 이동 (`useLikedCount`, 상세에서 좋아요를 누르면 바로 반영)
- 아티스트 좋아요 (목 데이터, `src/mocks/artistLikes.ts` TODO(mock))
  - 아티스트 페이지 이름 옆 `ArtistLikeButton`(좋아요 수 표시, 로그인 필요, 이 브라우저에만 저장)
  - 메인 배너: 아티스트를 좋아요 많은 순으로 정렬 (영상 슬라이드는 HomeSpotlight 규칙대로 맨 앞)
- 상품 공유 `ShareButton`: 휴대폰은 기기 공유 창, 컴퓨터는 링크 복사 + "링크를 복사했어요" 안내
- 상품 검색: `/search?q=` 페이지 (`searchProducts`, 상품명·아티스트명, 더 보기, 결과 없음 안내), `SearchForm`, 상단 줄에 검색 아이콘
- 확인: localhost에서 검색(응원봉 18개), 상품 좋아요 → /likes 표시 → 취소(테스트 후 원래대로), 아티스트 좋아요 버튼, 모바일 390px 상세·메인, eslint·tsc 통과

### 멈춘 지점 / 보고한 내용
- [STOP 5] 아티스트 좋아요 테이블·집계 함수가 없음 → JIN에게 backend-request, 그동안 목 데이터
- [STOP 2] `layout/TopBar.tsx`(검색 아이콘, jina 영역) 수정 → 사용자 요청, jina 공유 필요

### 남은 일 / TODO
- 아티스트 좋아요 백엔드 연결 후 `src/mocks/artistLikes.ts` 삭제, services로 교체
- 상품 카드에도 하트 표시할지 팀과 결정
- Windows `npm run build`

## 2026-10-13 | dev/chunga: 전체 상품 목록(/products)·상품 없음 404 (#93 #94)

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: #93, #94 (상위 #54) / (PR 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- GitHub 이슈 중 CHUNGMAN 담당 확인 후 해결

### 한 일
- #93 `/products` 전체 상품 목록 페이지 추가: `getProducts()` 전체 조회, 정렬·더 보기(`ProductListSection` 재사용), 로딩·오류 상태, 제목 metadata "전체 상품"
- 카테고리 탭 맨 앞에 "전체"(→ `/products`) 추가: `ALL_CATEGORY`(popularCategory.ts), `CategoryTabs`에 선택 `href` 지원
- 더 보기 최대 개수 100 → 500 (`listParams.ts`, 상품 387개라 100개에서 더 보기가 멈추던 문제)
- #94 `products/[id]/not-found.tsx`: "상품을 찾을 수 없어요" + "전체 상품 보기"·"홈으로 가기"
- 확인: localhost `/products`(387개·탭·정렬), `/products/999999`(상품 전용 404), `/category/album`(전체 탭), eslint·tsc 통과

### 멈춘 지점 / 보고한 내용
- #54의 metadata는 #96(JINA) 담당이라 손대지 않음 (`/products`·상품 404 title만 추가)
- 이미지 이슈 #50 #86 #87 #88은 최종 이미지 파일·Storage 업로드(JIN)가 필요해 코드 작업 없음

### 남은 일 / TODO
- `npm run build`, 모바일에서 `/products` 확인
- 이미지 최종본 확보 후 #86~#88 진행

## 2026-10-13 | dev/chunga: formatPrice → lib, PageTitle → ui, 주문서 페이지 200줄 이하로 분리

- 작업자: chungman
- 브랜치: dev/chunga (develop `be2ebd5` 반영)
- 관련 이슈 / PR: - / (PR 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 코드 리뷰 B 항목 중 3·4·5번: formatPrice 공용화, PageTitle 공용 UI로 이동, `checkout/page.tsx` 분리

### 한 일
- `components/product/formatPrice.ts` → `src/lib/formatPrice.ts`. 가격을 `toLocaleString("ko-KR")원`으로 직접 쓰던 곳(장바구니·주문서·주문 목록/상세·CartItemRow·CheckoutItems)을 모두 `formatPrice`로 교체 (표시 결과 동일)
- `components/order/PageTitle.tsx` → `components/ui/PageTitle.tsx`, `ui/index.ts`에서 export. 쓰던 8개 페이지 import를 `@/components/ui`로 합침
- `checkout/page.tsx` 302줄 → 199줄. 동작은 그대로 두고 나눔
  - `order/useDirectItem.ts`: 바로 구매 파라미터(parseDirect)·상품 불러오기
  - `order/useCheckoutAddresses.ts`: 저장된 배송지 불러오기·다시 불러오기
  - `order/CheckoutAddressCard.tsx`: 1단계 배송지 카드
  - `order/CheckoutSummary.tsx`: 결제 금액 카드·결제 버튼
  - `order/CheckoutEmpty.tsx`: 주문할 상품 없음 / 바로 구매 불가 화면 (장바구니로 가기는 버튼 클릭 이동 → 링크)
  - `order/StepNumber.tsx`
- 확인: 옛 경로 import 0건, eslint 통과, `tsc --noEmit` 에러 없음, 미머지 dev 브랜치 중 같은 파일 수정 중인 곳 없음

### 멈춘 지점 / 보고한 내용
- [STOP 2] sungho(장바구니·주문·마이페이지)·jina(`components/ui`) 영역 수정 → 사용자 승인 후 진행, 두 사람에게 공유 필요

### 남은 일 / TODO
- Windows에서 `npm run build`, 주문서(장바구니 주문·바로 구매·배송지 없음/있음) 직접 확인

## 2026-10-13 | dev/chunga: 컴포넌트 폴더 정리 (product → home·artist 분리, 안 쓰는 배너 코드 삭제)

- 작업자: chungman
- 브랜치: dev/chunga (develop `a8d4e58` 반영, 원격 미푸시)
- 관련 이슈 / PR: - / (PR 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 코드 리뷰에서 나온 A 항목: 안 쓰는 메인 배너 코드 삭제, `components/product/` 폴더를 역할별로 나누기

### 한 일
- 삭제: `product/MainHeroCarousel.tsx`·`product/heroSlides.ts` (HomeSpotlight로 바뀐 뒤 import하는 곳 없음)
- `components/home/`: ArtistPicker, ArtistShowcase, HomeSpotlight, heroVideos
- `components/artist/`: ArtistBannerCarousel, ArtistBanners, ArtistCategoryTabs, ArtistLogo, ArtistNotices, MemberCard, MemberGallery, NoticeTrack, artistTheme
- `components/product/`에는 상품 카드·목록·상세·공용 함수(formatPrice, useSwipe 등) 17개만 남김
- import 경로만 수정 (화면 동작 변경 없음): 메인, `/artists`, `/artists/[slug]`, `/artists/[slug]/about`, 옮긴 컴포넌트끼리의 상대 경로 → `@/components/...`
- 다른 사람 담당 파일은 수정 없음, 미머지 dev 브랜치 중 같은 파일 수정 중인 곳 없음 확인
- 확인: 옛 경로 import 0건, eslint 통과, `tsc --noEmit` src 에러 없음 (`.next/types`의 예전 빌드 타입 에러만 있음)

### 멈춘 지점 / 보고한 내용
- [STOP 6] 폴더 구조 변경 → 사용자 요청으로 진행

### 남은 일 / TODO
- Windows에서 `npm run build` 확인 (작업 환경에서는 SWC 바이너리 문제로 빌드 불가)
- README 폴더 구조의 `product/ … 아티스트 배너` 설명을 home·artist 폴더로 바꿀지 팀과 정리

## 2026-10-12 | dev/chunga: 메인 배너를 파스텔 스포트라이트 슬라이드로 · 상단 줄(헤더) 가운데 로고

- 작업자: chungman
- 브랜치: dev/chunga (develop `bcbc3cf` 반영, 원격 미푸시). dev/chunga-redesign·dev/chunga-banner-c는 그대로 둠
- 관련 이슈 / PR: - / (검증 후 PR 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 스크린샷(시안 C)대로 메인 배너 수정, 헤더도 함께 수정, 배너는 슬라이드 방식 유지

### 한 일
- `HomeSpotlight.tsx`(banner-c에서 가져와 슬라이드로 변경): 아티스트마다 한 장(문구·겹친 인기 상품 3개·아래 상품 카드 3개), 7초 자동 넘김, 마우스 끌기·손가락 밀기(`useSwipe`), 위 아티스트 버튼으로 이동, 배경 톤이 아티스트 색으로 전환
- `page.tsx`: 기존 `MainHeroCarousel` 배너 → `HomeSpotlight` (아티스트별 `getBestProducts` 3개). 아래 Recommended Artist·아티스트별 굿즈·최근 본 상품은 그대로
- `TopBar.tsx`·`Header.tsx`: 버블 로고 칸 → 왼쪽 바로가기 · 가운데 "KANT·MOA"(Fredoka) · 오른쪽 장바구니·로그인. 메인은 배너 안에 같은 줄이 있어 헤더를 CSS(`:has`)로 숨김
- 카테고리 "인기 굿즈"(`/category/best`, 상단 줄 "카테고리" 연결): `popularCategory.ts`, `PopularProductList.tsx`, 카테고리 탭 맨 앞
- `badgeRules.ts` 가져옴 (아래 카드 배지)
- 수정(두 번째 스크린샷 기준): 상단 줄 왼쪽 바로가기(아티스트·카테고리) 제거, 배너의 버튼 2개(컬렉션 보러 가기·전체 아티스트)와 아래 상품 카드 3개 제거 → 문구 + 겹친 상품만
- 확인: 1440×900·390×844 배너 표시, 아티스트 버튼으로 슬라이드 이동, 상세 등 다른 페이지 상단 줄, `/category/best`, `npx tsc --noEmit`·eslint 통과

### 멈춘 지점 / 보고한 내용
- [STOP 2] `Header.tsx`·`TopBar.tsx`는 jina 영역 → 사용자 요청으로 수정, jina 공유 필요

### 남은 일 / TODO
- 메인은 헤더를 숨겨서 스크롤을 내리면 상단 줄이 없음 (모바일은 하단 메뉴 있음) → 필요하면 고정 방식 검토
- 쓰지 않게 된 `MainHeroCarousel.tsx`·`heroSlides.ts` 정리 여부
- 로컬 `npm run build` 확인 후 푸시·PR

## 2026-10-12 | 메인 아티스트 굿즈 패널·아티스트 페이지 배너 마우스 드래그

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 메인 화면 아티스트별 굿즈 패널(Now 아티스트)을 마우스로 끌어서 넘기기
- 아티스트 상품 페이지 상단 배너도 메인 배너처럼 마우스로 끌어서 넘기기 (2개씩 보이는 형태는 유지)

### 한 일
- 작업 전 develop 최신화(`241456f` → `0af385c`, jin PR #105 artist_banners 반영, fast-forward), 다른 브랜치와 겹치는 파일 없음 확인
- `ProductCarousel.tsx`: 페이지(4개씩)를 가로로 이어 붙인 트랙으로 바꾸고 `useSwipe`로 끌어서 넘기기, 화살표도 슬라이드 이동, 첫·마지막 페이지 바깥쪽은 덜 끌리게, 안 보이는 페이지는 `inert`
- `ArtistBannerCarousel.tsx`: 마우스로 끌면 손을 따라 스크롤, 놓으면 다음/이전으로 이동(조금만 끌면 제자리), 끄는 중과 이동 중에는 스냅 끔. 터치는 기존 브라우저 스크롤 그대로
- `useSwipe.ts`: `onCancel`(넘길 만큼 안 끌었을 때), `mouseOnly`(터치는 무시) 옵션 추가
- `npx tsc --noEmit`, eslint 통과

### 결정 사항 / 이유
- 아티스트 배너는 scroll-snap 기반이라 터치는 그대로 두고 마우스만 직접 처리 (터치 이중 처리 방지)
- 상품 카드 hover 그림자가 잘리지 않게 패널은 가로 방향만 자르기(`overflow-x-clip`)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 실제 브라우저에서 드래그 동작 확인 후 `npm run build`, PR 생성 (모바일·데스크톱 스크린샷 첨부)

## 2026-10-12 | 작업 마무리: 병합 반영 확인·공지 목 데이터 유지·마스코트 인형 키링 이미지 시안(미적용)

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / PR #101 (dev/chunga → develop, 팀원 승인 후 병합)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 아티스트 배너·영어 카테고리 탭·배너 리팩터링 PR 병합 후 develop 최신화
- 공지(Notice) backend-request 이슈 작성 방법 정리
- 마스코트 인형 키링 대표·상세 이미지 수정 (영어 라벨 → DB 마스코트 이름, "마스코트당 1인 2개 한정" 문구 추가)

### 한 일
- PR #101 병합 후 dev/chunga를 develop(`241456f`)과 맞춤, 원격과 동기화 확인
- jin이 마스코트 인형 키링 카테고리 이동(accessory → doll) 완료한 것 확인
- 공지 이슈 작성 방법(backend-request 템플릿, 필요한 테이블·함수, `TODO(mock)` 번호 기입 위치) 정리해 공유
- 마스코트 인형 키링 이미지 시안 제작 (리포 밖 작업)
  - 대표 이미지(1440×1440): 영어 라벨 지우고 쏠리·블루·찌릿·모찌·포포 라벨로 교체
  - 상세 이미지(1200×8186): 마스코트별 라인업, 1인 2개 한정 안내(배지·사양·상품 정보·주의 문구), 고리 디테일 사진 다시 자르기

### 결정 사항 / 이유
- Notice는 지금처럼 목 데이터(`src/mocks/notices.ts`)로 유지, 공지 이슈는 당장 만들지 않음
- 마스코트 인형 키링 시안은 기대보다 완성도가 낮아 적용하지 않고 기존 이미지 유지 (`products/orbit-on/mascot-doll/` 변경 없음)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 공지 기능이 필요해지면 backend-request 이슈 생성 → `TODO(mock): #이슈번호` 기입 → 목 데이터 교체
- 상세 이미지의 소재·사이즈 등 예시 값은 실제 스펙 나오면 교체

## 2026-10-12 | 아티스트 페이지 배너 이미지·카테고리 영어 탭, 메인 배너 코드 정리

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 아티스트 페이지 카테고리 탭을 영어로
- 아티스트 페이지 배너는 이전처럼 2개씩 유지하고, 상품 이미지(1:1)만 메인 배너처럼 보이게
- 인형 키링 카테고리 이동(accessory → doll) 담당 확인

### 한 일
- 작업 전 develop 최신화(`b48875f` → `7d2c2ee`, sungho PR #45 모션 반영, fast-forward), sungho 미병합 브랜치와 `MainHeroCarousel.tsx` 겹침 확인 후 병합될 때까지 대기(STOP 4)
- `ArtistCategoryTabs.tsx`: 탭 이름을 DB slug 기반 영어(All·Album·Cheering·Doll·Accessory·Apparel·Living·Membership)로, 스크린리더용 aria-label에 한글 이름 병기
- `ArtistBannerCarousel.tsx`: 상품 배너의 정사각형 이미지를 메인 배너처럼 카드 오른쪽에 띄우고 그림자·반사 효과 (레이아웃·2개 노출은 이전 그대로)
- 메인 배너 정리: 스와이프 로직을 `useSwipe.ts` 훅으로 분리, 배너 데이터 형태 `heroSlides.ts`(`HeroSlide`, `productToSlide`) 추가 → `MainHeroCarousel.tsx` 243 → 187줄 (화면·동작 동일)
- `npm run lint`(에이전트), `npx tsc --noEmit`, `npm run build` 통과

### 결정 사항 / 이유
- 카테고리 영어 이름은 하드코딩 금지 규칙에 맞춰 DB slug를 변환해 표시 (자연스러운 이름이 필요하면 categories에 영어 이름 칸 필요)
- 아티스트 페이지에만 영어 탭 적용, `/category` 페이지 탭은 한글 유지

### 멈춘 지점 / 보고한 내용
- [STOP 4] sungho 미병합 커밋이 `MainHeroCarousel.tsx` 수정 중 → PR #45 병합 후 진행
- 인형 키링 카테고리 이동은 DB(`supabase/migrations/`)·정적 데이터(`src/data/`) 변경이라 jin 담당 → jin에게 요청

### 남은 일 / TODO
- jin: 마스코트 인형 키링 카테고리 accessory → doll (마이그레이션 + `src/data/products.ts`)
- 공지 backend-request 이슈 생성 후 `TODO(mock)` 번호 기입
- PR 생성 (모바일·데스크톱 스크린샷 첨부)

## 2026-10-12 | 메인 배너 개편(아티스트별 랜덤·스와이프)·아티스트 페이지 카테고리·Notice 추가

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 공지 데이터 backend-request 이슈 생성 예정 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 메인 배너: 정사각형 상품 이미지를 위버스샵 배너처럼 카드 가운데에 띄우고, 카드 여백 비율을 위버스샵에 맞추기
- 메인 배너: 아티스트별 상품을 하나씩 무작위로 보여주기, 마우스로 끌거나 손가락으로 밀어서 넘기기
- 아티스트 상품 페이지: 위버스샵처럼 카테고리 탭과 Notice 영역 추가

### 한 일
- 작업 전 `git merge origin/develop`(5eab5ca → 00a8f27, fast-forward), 다른 브랜치와 겹치는 파일 없음 확인
- `MainHeroCarousel.tsx`
  - 상품 이미지를 카드 높이의 60%로 가운데 배치, 그림자 + 아래 반사 효과
  - 카드:글자 비율 50:50 → 35:65, 데스크톱 카드 비율 2:1 → 4:3 (모바일은 2:1 유지), 페이지 표시 위치 조정
  - 포인터 이벤트로 끌어서 넘기기 (50px 이상 끌면 이동, 끄는 중 자동 넘김 정지, 끌어서 넘긴 경우 상세 이동 막음, 세로 이동은 스크롤로 처리)
- `src/app/(shop)/page.tsx`: 최신 상품 8개 → 아티스트별 판매 중 상품 1개 무작위 (`connection()` 후 선택, 모두 품절이면 품절 상품 중에서)
- `src/app/(shop)/artists/[slug]/page.tsx`: 왼쪽 Products(카테고리 탭 + 상품 목록), 오른쪽 Notice 2열 레이아웃, 모바일은 세로 배치
- `ArtistCategoryTabs.tsx` 추가 (`?category=slug`, 전체 + `getCategories()` 목록), `listParams.buildListHref`가 기존 쿼리를 유지하도록 수정
- `ArtistNotices.tsx` + `src/mocks/notices.ts` 추가 (목 데이터, `TODO(mock)`)
- `npx tsc --noEmit`, eslint 통과 (에이전트 환경), `npm run build`는 로컬 확인 필요

### 결정 사항 / 이유
- 무작위 선택은 React 규칙(렌더 중 `Math.random` 금지)에 맞춰 컴포넌트 밖 함수(`pickHeroProducts`)에서 하고, 요청마다 바뀌도록 `connection()` 사용
- 카테고리 선택은 URL 쿼리로 처리해 새로고침·공유 시에도 유지
- 공지 데이터가 services에 없어 멈춤 규칙 5에 따라 목 데이터로 화면만 구현

### 멈춘 지점 / 보고한 내용
- [STOP 5] 공지사항 테이블·`getArtistNotices` 함수 없음 → jin에게 backend-request 이슈로 요청 예정, 그동안 `src/mocks/notices.ts` 사용
- `MainHeroCarousel.tsx`가 243줄로 200줄을 넘음 → 스와이프 로직 훅 분리 검토

### 남은 일 / TODO
- backend-request 이슈 생성 후 `TODO(mock): #이슈번호`에 번호 기입, 함수가 생기면 목 데이터 교체
- `npm run build` 확인 후 PR 생성 (모바일·데스크톱 스크린샷 첨부)
- 스와이프 로직 `useSwipe` 훅으로 분리 검토

## 2026-10-12 | ORBIT:ON 이미지 경로 정리·배경 이미지·상세 이미지 화질 개선

- 작업자: chungman
- 브랜치: dev/chunga (이미지는 리포 밖 작업)
- 관련 이슈 / PR: 없음 / worklog PR (dev/chunga → develop, jin 승인 후 병합)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- worklog PR 올리고 병합 후 develop 최신화
- jin이 등록한 ORBIT:ON 상품 경로에 맞춰 이미지 정리
- 아티스트 배경 이미지를 1920×720으로 다시 제작
- 상세 이미지 가로 1200px 유지, 화질 개선

### 한 일
- worklog PR 생성 → jin 승인·병합 후 `git fetch origin` → `git merge origin/develop` (fast-forward, 충돌 없음)
- develop에 반영된 `20261011000001_update_orbit_on_products.sql` 확인, 이미지 폴더명을 DB 경로에 맞춤
  - `character-keyring` → `mascot-doll`, `mascot-sticker` → `planet-sticker`, `bracelet` → `planet-bracelet`
  - 그대로: `1st-mini-launch`, `light-stick`, `jersey`, `membership-card`, `ball-cap`
- DB 경로가 `.webp`라 모든 이미지를 webp로 변환 (main 1440×1440, detail-1 가로 1200)
- 아티스트 로고 `artists/orbit-on/logo.webp`(1080×1080) 변환
- 아티스트 배경 `artists/orbit-on/hero.webp` 1920×720 제작 (기존 단체 사진 1200×450을 업스케일, 얼굴 변경 없음)
- 상세 이미지 8종 화질 개선: 내부 사진을 업스케일 모델(ESPCN ×4)로 다시 키우고, 페이지를 2배 해상도로 렌더링 후 1200px로 축소, webp 품질 90 → 95
  - 대상: ball-cap, planet-sticker, jersey, planet-bracelet, 1st-mini-launch, membership-card, light-stick, mascot-doll
- 최종본을 `kantmoa-images/` 구조로 zip 정리해 jin에게 전달 (상품 8종 + logo + hero)
- 10-12: 다른 PC에서 `5eab5ca` → `00a8f27`(develop 최신) fast-forward, 충돌 없음

### 결정 사항 / 이유
- 폴더명·확장자는 DB(`thumbnail_path`, `product_images.image_path`) 경로를 기준으로 맞춤 → 경로가 한 글자라도 다르면 화면에 안 나옴
- 멤버 얼굴 인형은 멤버별 마스코트 인형 키링(`mascot-doll`)으로 대체, plush-doll 이미지는 사용하지 않음 (아크릴 키링도 숨김 처리됨, jin 마이그레이션 `20261012000001`)
- 멤버 소개 합본(1200×5000)은 들어갈 자리가 없어 업로드 대상에서 제외 (jin 확인)
- 상세 이미지는 글자 선명도를 위해 2배 렌더링 후 축소하는 방식으로 통일

### 멈춘 지점 / 보고한 내용
- 로고 경로(`artists/orbit-on/logo.webp`)는 마이그레이션에 없어 jin에게 실제 경로 확인 요청

### 남은 일 / TODO
- jin: 최종 zip(상품 8종 + logo + hero) Storage 업로드/교체 후 화면 확인 (옛날 이미지가 보이면 `Ctrl+Shift+R`)
- 마스코트 인형 키링(mascot-doll) 상세 이미지의 캐릭터 이름을 DB 옵션명(쏠리·블루·모찌·찌릿·포포)으로, "마스코트당 1인 2개 한정" 반영
- 팔찌·멤버십 카드 등 상세 이미지의 예시 스펙(소재·사이즈·혜택)을 실제 값으로 교체
- 원본이 작은 볼캡은 고화질 원본 확보 시 재작업

## 2026-10-11 | ORBIT:ON 이미지 생성 (2일차)

- 작업자: chungman
- 브랜치: dev/chunga (이미지는 리포 밖 작업)
- 관련 이슈 / PR: 없음 / 없음
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- ORBIT:ON 이미지 생성 이어서 진행
- 굿즈별 상품 대표 이미지(main)·상세 이미지(detail-1) 제작, 실물 느낌 이미지로 교체
- 신규 굿즈(팔찌·멤버십 카드) 디자인 시안, ORBIT:ON 로고 시안

### 한 일
- Canva 커넥터 연결, AI 이미지 생성·편집에 사용
- jin이 공유한 이미지 전달 규칙(`kantmoa-images/` 폴더 구조·이름·사이즈 규격)을 스킬(`kantmoa-image-upload`)로 정리
- 팀원 규격(main 1440×1440, detail 가로 1200)에 맞춰 상품 이미지 제작, `kantmoa-images/products/orbit-on/<상품>/` 구조로 zip 정리
  - `1st-mini-launch`(CD 앨범), `jersey`, `mascot-sticker`: 실물 느낌 이미지로 다시 만들어 main·detail 교체
  - `light-stick`, `ball-cap`, `plush-doll`, `character-keyring`: 원본 이미지 업스케일·누끼 후 main·detail 제작
  - `bracelet`: 원본 참고 없이 "다섯 행성, 하나의 궤도" 콘셉트로 새 디자인 → main·detail 제작
  - `membership-card`: 시안 3종(아크릴 궤도 카드 / 우주 탑승권 / 밤하늘 회전 디스크) → 불투명 카드 + 슬리브로 확정 → main·detail 제작
- 멤버 소개 이미지 5장(선우·이안·하루·제이·리온, 1200×1000) + 세로 합본 제작
- ORBIT:ON 로고 시안 3종 제작(A 궤도 워드마크 / B 원 궤도 엠블럼 / C O:O 모노그램), 밝은·어두운·투명 배경 PNG
- 로고 C안 확정 → 최종 파일 제작: 아티스트 로고 `artists/orbit-on/logo.png`(1080×1080, 원형 크롭 안전 영역) + 세로형·가로형·심볼·단색(남색·실버)·흰색 버전 PNG/SVG
- PR 전 검사: `npm run lint`, `npx tsc --noEmit`, `npm run build` 모두 통과 (사람이 로컬에서 실행)

### 결정 사항 / 이유
- ORBIT:ON 굿즈 공통 무드: 라벤더 오로라 배경, 멤버 컬러 5색(피치·블루·라벤더·라임·민트), 실버 궤도 라인, 네 꼭지 별, 홀로그램
- 상세 이미지 공통 구성: 메인 비주얼 → 소개·포인트 → 디테일 → 상품 정보 → 배송·교환 (상품마다 톤 통일)
- 로고는 철자 정확도를 위해 AI 생성 대신 도형·글자로 직접 제작, C안(두 개의 O가 겹친 궤도 + 다섯 멤버 행성)으로 확정
- 다른 브랜드 디자인으로 보이는 요소(참고 이미지의 손글씨 코인, 클로버 로고)는 가져오지 않음

### 멈춘 지점 / 보고한 내용
- 작업 환경에서 Canva로 파일 업로드·원본 다운로드가 네트워크 정책으로 막힘 → 참고 이미지는 글로 설명해 생성, 고해상도 원본은 사람이 Canva에서 받아 첨부
- AI 생성 이미지는 작은 글씨("ORBIT:ON")가 틀리게 나오는 경우가 많아 확인 후 재생성
- 노트북 연결이 끊겨 이 기록은 업로드받은 파일로 작성

### 남은 일 / TODO
- seed 상품 목록에 없는 상품(ball-cap, jersey, mascot-sticker, plush-doll, character-keyring, bracelet, membership-card)은 이미지 전달 전 DB 상품 등록 요청 필요 (jin), 폴더명은 임시
- 상세 이미지의 소재·사이즈·제조국·멤버십 혜택 등 예시 값 → 실제 스펙으로 교체
- 원본 해상도가 낮은 상품(응원봉·볼캡·인형·키링)은 고화질 원본 확보 시 재작업
- AI 시안(팔찌·멤버십 카드)은 실물 사진 나오면 교체, 그 전엔 "실제 상품과 다를 수 있음" 문구 권장
- 로고(`logo.png`) Storage 업로드 요청 (jin), 경로가 `logo.webp`이면 webp 변환 필요
- 생성한 이미지 규격(사이즈·webp) 맞춰 Storage 업로드 요청 (jin)

## 2026-10-10 | ORBIT:ON 이미지 생성

- 작업자: chungman
- 브랜치: dev/chunga (이미지는 리포 밖 작업)
- 관련 이슈 / PR: 없음 / 없음
- 에이전트 사용: 확인 필요

### 요청한 작업
- 굿즈샵에 쓸 ORBIT:ON 이미지 생성

### 한 일
- ORBIT:ON 이미지 생성 시작

### 결정 사항 / 이유
- 없음

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 10-11에 이어서 진행

## 2026-10-09 | 배너 관련 사이트 수정

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: 확인 필요

### 요청한 작업
- 메인·아티스트 페이지 배너 관련 화면 수정

### 한 일
- 배너 관련 사이트 수정

### 결정 사항 / 이유
- 없음

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- `npm run lint`, `npx tsc --noEmit`, `npm run build` 확인 후 PR 생성

## 2026-10-08 | 이미지 초안 작업

- 작업자: chungman
- 브랜치: dev/chunga (이미지는 리포 밖 작업)
- 관련 이슈 / PR: 없음 / 없음
- 에이전트 사용: 확인 필요

### 요청한 작업
- 굿즈샵에 쓸 이미지 초안 작업

### 한 일
- 이미지 초안 작업

### 결정 사항 / 이유
- 없음

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 초안 확정 후 최종 이미지 생성 (10-10~11 진행)

## 2026-10-08 | 메인 상단 배너·Recommended Artist·아티스트 검색 추가

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 메인 디자인을 위버스샵 메인처럼 변경 (상단 전체 폭 배너 → Recommended Artist → 아티스트별 굿즈)
- 아티스트 검색 기능, 아티스트 로고 클릭 시 아티스트 굿즈 페이지로 이동

### 한 일
- 작업 전 develop 최신 상태(PR #24까지) 확인, 다른 브랜치와 겹치는 파일 없음 확인
- `MainHeroCarousel.tsx`: 최신 상품 8개를 한 장씩 넘기는 전체 폭 배너 (상품 사진·아티스트·상품명·카테고리·가격, 좌우 화살표, `01 | 08` 표시, 클릭 시 상품 상세)
- `ArtistPicker.tsx`: Recommended Artist 영역. 로고 클릭 시 `/artists/[slug]`, "아티스트" 버튼으로 검색 창(jina `Modal`·`Input` 사용) 열기, 이름·한글명·slug로 바로 필터링
- `ArtistLogo.tsx`: 로고 타일 (로고가 없으면 테마 색 + 이름 첫 글자)
- `src/app/(shop)/page.tsx`: 기존 검은 소개 박스를 상단 배너로 교체, 화면에 보이지 않는 h1 유지
- `npx tsc --noEmit`, lint 통과

### 결정 사항 / 이유
- 아티스트 수가 적어(3팀) 검색은 서버 요청 없이 이미 받아온 `getArtists()` 결과를 브라우저에서 필터링
- 상단 배너는 별도 배너 데이터가 없어 최신 상품(`getProducts({ limit: 8 })`)으로 구성, 실패 시 배너만 숨김
- 검색 아이콘은 jina의 `SearchIcon`을 수정 없이 가져다 씀

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- `npm run build`는 사람이 로컬에서 확인 (에이전트 환경은 Google Fonts 접속이 막혀 빌드 불가)
- 아티스트 로고(`logo.webp`) 업로드 필요 (없으면 첫 글자 타일로 표시)

## 2026-10-07 | 아티스트 멤버 소개 페이지 추가

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 아티스트 페이지 첫 번째 배너(단체 사진)를 누르면 멤버 소개 화면으로 이동

### 한 일
- 작업 전 `git fetch origin` → develop과 동일 상태 확인 (PR #22: `artist_members` 테이블, `getArtistMembers` 반영됨), 다른 브랜치와 겹치는 파일 없음 확인
- `src/app/(shop)/artists/[slug]/about/page.tsx` 추가: 단체 사진 배너(`heroImageUrl`) + 멤버 카드 목록 (`getArtist`, `getArtistMembers`)
- `src/components/product/MemberCard.tsx` 추가: 프로필 사진, 이름·영문명, 포지션, 한 줄 소개, 생일·MBTI·마스코트, 태그, 멤버 컬러 표시
- `ArtistBanners.tsx`: 첫 배너 링크를 `#artist-products` → `/artists/[slug]/about`, 문구를 "멤버 소개 보기"로 변경
- 로딩(스켈레톤)·빈(EmptyState)·에러(LoadError)·정상 상태 구현, `npx tsc --noEmit`, lint 통과
- 멤버 프로필 사진을 `artist_members.image_path` 경로에 맞춰 1080×1080 webp로 준비 (리포 밖 `ORBITON/storage-upload/artists/orbit-on/members/`)

### 결정 사항 / 이유
- 모달 대신 별도 주소(`/about`)로 만들어 새로고침·공유·뒤로가기가 자연스럽게 동작하도록 함
- 멤버 컬러는 데이터라 CSS 변수(`--member-color`)로만 넘기고, 글자색에는 쓰지 않음 (밝은 색은 대비가 부족해서 점·하단 띠로만 표시)

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 멤버 사진·단체 사진(hero.webp) Storage 업로드/교체 요청 (jin)

## 2026-10-07 | 아티스트 페이지 상단을 배너 2개 캐러셀로 변경

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 위버스샵 아티스트 페이지처럼 상단 이미지 영역을 2개(배너 2장 나란히)로 변경

### 한 일
- 작업 전 `git fetch origin` 후 develop과 동일 상태 확인, 다른 브랜치와 겹치는 파일 없음 확인
- `ArtistBanners.tsx`(서버) + `ArtistBannerCarousel.tsx`(클라이언트) 추가: 데스크톱 2장·모바일 1장, 좌우 화살표, 하단 페이지 표시
- 배너 1 = 아티스트 대표 이미지(`heroImageUrl`, 없으면 테마 색 그라데이션), 배너 2~4 = 해당 아티스트 최신 상품 3개(상품 이미지·이름·카테고리·가격, 클릭 시 상세)
- 전체 폭 `ArtistHero.tsx` 삭제, 아티스트 페이지에 화면에 보이지 않는 h1 추가 (제목 구조 유지)
- `npx tsc --noEmit`, `npm run lint` 통과

### 결정 사항 / 이유
- 배너 전용 테이블·API가 없어서 기존 services(`getArtist`, `getProducts`) 데이터만으로 배너를 구성 → 백엔드 변경 없이 하드코딩 없이 구현
- 상품 조회가 실패해도 아티스트 배너는 보여주고, 에러 안내는 아래 상품 목록에서 처리

### 멈춘 지점 / 보고한 내용
- 없음

### 남은 일 / TODO
- 프로모션용 배너(제목·문구·이미지)를 따로 운영하려면 배너 데이터(테이블 또는 고정 설정) 필요 → 팀과 논의
- 대표 이미지(1200×450)가 16:9 카드에 들어가면서 양 끝 멤버가 조금 잘릴 수 있음, 업로드 후 화면 확인 필요

## 2026-10-07 | 메인·아티스트·카테고리·상품 상세 페이지 구현

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / (PR 생성 예정)
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- FRONTEND.md 1장 chungman 담당 4개 페이지 구현 (메인, 아티스트, 카테고리·상품 목록, 상품 상세)
- 최신 develop 기준으로 다른 팀원 작업과 충돌 없이 진행

### 한 일
- 작업 전 `git fetch origin` → `git merge origin/develop` (fast-forward, 충돌 없음)
- 3장 4번 명령으로 dev/jin, dev/jina, dev/sungho가 수정할 파일과 겹치지 않는지 확인 (겹침 없음)
- 페이지 추가
  - `src/app/(shop)/page.tsx`: 메인 (소개 배너, 아티스트 목록 `getArtists`, 신상품 8개 `getProducts({ limit: 8 })`)
  - `src/app/(shop)/artists/[slug]/page.tsx`: 아티스트 배경 영역 + 아티스트별 상품 목록
  - `src/app/(shop)/category/[slug]/page.tsx`: 카테고리 탭(7개, `getCategories`) + 카테고리별 상품 목록
  - `src/app/(shop)/products/[id]/page.tsx`: 상품 상세 (이미지, 가격, 옵션 선택, 수량, 장바구니 담기, 상세 설명·이미지)
- `src/components/product/` 추가: ProductCard, ProductGrid(+스켈레톤), ProductImage, ProductListSection(정렬·더 보기), SortTabs, CategoryTabs, ArtistHero, ArtistCard, OptionSelector, ProductPurchasePanel, LoadError, listParams, artistTheme, formatPrice(임시)
- 기본 템플릿 `src/app/page.tsx` 삭제 (`(shop)/page.tsx`와 같은 "/" 주소라 빌드 충돌)
- 모든 데이터 화면에 로딩(Suspense + 스켈레톤)·빈(EmptyState)·에러(LoadError, `getErrorMessage`)·정상 상태 구현
- `npx tsc --noEmit`, `npm run lint` 통과
- (추가 요청) 메인에 위버스샵 아티스트 섹션처럼 아티스트별 패널 추가: 상단 배경 띠(heroImageUrl, 없으면 테마 색) + 아티스트 이름 링크 + 상품 4개씩 넘기는 캐러셀(최대 3페이지)
  - `ArtistShowcase.tsx`, `ProductCarousel.tsx` 추가, 쓰지 않게 된 `ArtistCard.tsx` 삭제
- (추가 요청) 바탕화면 ORBITON 이미지로 seed.sql 경로에 맞춘 Storage 업로드용 webp 8장 준비 (리포 밖, `ORBITON/storage-upload/`): artists/orbit-on/hero.webp, products/orbit-on/{1st-mini-launch, light-stick, acrylic-keyring, logo-hoodie}/…

### 결정 사항 / 이유
- 데이터는 `src/services/products.ts`만 사용, supabase 직접 호출 없음
- cacheComponents 사용 중이라 params·searchParams를 읽는 부분과 services 호출을 Suspense 안 비동기 컴포넌트로 분리
- 정렬·더 보기는 URL 쿼리(`?sort=`, `?limit=`)로 처리: 서버 컴포넌트로 유지하고 새로고침·공유 시에도 상태 유지
- 아티스트 테마 색(`themeColor`)은 데이터라 Tailwind 클래스로 만들 수 없어 CSS 변수(`--artist-color`) 한 곳에만 style 사용. 값이 없으면 `--brand`로 대체
- 배경 이미지(`heroImageUrl`)가 없으면 테마 색 그라데이션 표시 (jina 제안안 반영)
- 장바구니 담기는 `useCart().addItem`을 사용하고, 수량 조절은 sungho의 `QuantityStepper`를 수정 없이 가져다 씀
- 공용 컴포넌트(`src/components/ui/`)와 다른 사람 파일은 수정하지 않음

### 멈춘 지점 / 보고한 내용
- `formatPrice` 공용 유틸이 없어 `src/components/product/formatPrice.ts`에 임시로 만들고 jina에게 공용 유틸 요청
- `next.config.ts`의 Supabase 이미지 도메인 설정은 dev/jin에 있고 develop에는 아직 미반영 → 머지 전에는 실제 이미지가 있는 상품에서 next/image 오류 가능
- `npm run build`는 작업 환경에 Windows용 SWC만 설치돼 있어 에이전트가 실행하지 못함 → 사람이 로컬에서 실행 필요

### 남은 일 / TODO
- `npm run build` 통과 확인 후 PR 생성 (모바일·데스크톱 스크린샷 첨부)
- 공용 `formatPrice`가 생기면 교체하고 임시 파일 삭제
- 헤더의 `/artists`, `/category/all`, `/search` 링크는 담당 미정 (현재 404)
- Storage 업로드는 대시보드(service role)에서만 가능 → `ORBITON/storage-upload/` 파일을 jin(또는 대시보드 권한자)이 같은 경로로 업로드 필요. 업로드 전에는 이미지가 깨져 보임
- ORBIT:ON 로고(`orbit-on/logo.webp`)용 이미지는 아직 없음

## 2026-10-07 | ORBIT:ON 아티스트 세계관·굿즈 소스 준비, 메인 화면 Figma 시안

- 작업자: chungman
- 브랜치: dev/chunga
- 관련 이슈 / PR: 없음 / 없음
- 에이전트 사용: O (Claude, Cowork)

### 요청한 작업
- 굿즈샵에 들어갈 가상 아이돌 그룹 기획, 이미지·굿즈 데이터 준비, 메인 화면 시안 제작

### 한 일
- 가상 그룹 ORBIT:ON(5인조) 기획: 멤버 5명의 컬러·마스코트, 앨범 3장 정의
- 바탕화면 `ORBITON/` 폴더(리포 밖)에 그룹·굿즈 데이터(JSON, md), 앨범 커버, 멤버·단체·굿즈 사진 정리
- Figma 파일 `ORBIT:ON 굿즈샵`에 Weverse Shop 구조를 참고한 메인 화면 시안 제작

### 결정 사항 / 이유
- 굿즈 이미지는 몽환적인 톤(더스티 파스텔, 홀로그램)으로 통일

### 멈춘 지점 / 보고한 내용
- Figma 시안에 사진 자동 삽입 실패 (작업 환경 네트워크가 figma.com 업로드 차단)
- SETUP.md 팀 브랜치 표기(`dev/chungman`)와 실제 브랜치(`dev/chunga`)가 다름, 보고만 함

### 남은 일 / TODO
- Figma 시안 사진 채우기
- 브랜치 이름 표기 팀과 맞추기

