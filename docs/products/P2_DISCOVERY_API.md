# P2 8단계 · 잔여 카탈로그 계약

2026-10-27. 팀 main `65bf153` 기준. 구현·로컬 검증 완료. 사용자 요청으로 커밋·push 후 팀 main 대상 PR을 생성한다.
기존 화면을 유지하고 Supabase 조회/RPC를 FastAPI로 대체한다. 공용 DB·배포는 별도 담당자 범위다.

## 조회·쓰기 계약

- `GET /artists`, `/artists/{slug}`, `/artists/{slug}/members`, `/artists/{slug}/banners`: 기존 ID·정렬·이미지 경로 유지.
- `GET /artists/like-counts`: 공개 집계만 반환. `/artists/{slug}/like` GET·PUT·DELETE는 P1 인증과 본인 ID만 사용한다.
  PUT·DELETE는 멱등, 복합 PK 충돌만 중복 처리, 서비스에서 commit/rollback한다. 개인 응답은 private/no-store.
- `GET /products/best?days=7&limit=8&artist=slug`: 기간 내 `orders.status='paid'` 수량을 상품별로 합산한다.
  pending·cancelled·미래 결제 제외. 공개 상품만, 판매량 DESC → created_at DESC → id DESC. 판매 0개도 최신순으로 채움.
- `GET /home-banners`: is_active와 starts_at/ends_at에 따른 현재 노출만 반환. 시작 포함·종료 제외, sort_order·id 순.
  아티스트 배너에는 활성·기간 컬럼이 없으므로 해당 필터를 가정하거나 스키마를 바꾸지 않는다.
- `GET /notices?artist=slug&limit=20`, `/notices/{id}?artist=slug`, `/notices/topbar`: 미래 게시 제외,
  고정 우선·최신·id 순. artist 지정은 해당 아티스트 공지만. 다른 아티스트/미게시 상세는 404.
  연결 상품이 hidden이면 product_id는 null. 본문은 공개 공지 원문을 유지한다.
- `GET /shop-settings`: 기존 공개 배송/사업자/고객센터 필드만 반환. 설정 없음은 503이며 임의 기본값을 만들지 않는다.
  P3 배송비 계산·`/orders/shipping-policy`는 변경하지 않는다. 상품·회원·주문을 시드로 덮어쓰지 않는다.

기본 공개 조회는 no-store. 오류를 예비 상품/아티스트로 덮지 않는다. 챗봇의 상품 정보도 공개 API를 사용한다.
기존 테이블만 조회/artist_likes 저장에 사용하며 migration·최초 Alembic 이력은 변경하지 않는다.

## 화면 연결과 데이터 경계

기존 디자인·레이아웃을 유지했다. artistCatalog·artists·notices·settings·인기 상품/홈 배너 서비스와
챗봇의 상품 정보 조회를 공개 FastAPI로 바꿨다. 기존 ArtistLikeButton에 연타 차단·상태 조회 전 쓰기 차단·
계정 전환 중 이전 응답 무시·오류/재시도를 적용했다. 상품의 개인 찜과 아티스트 좋아요는 서로 다른 테이블이다.
아티스트·멤버·배너·홈 상품 이미지는 기존 압축 원본을 사용하며 이미지 컴포넌트에서 unoptimized로 표시한다.

기존 홈 메인 배너는 상품과 HERO_VIDEOS로 구성된다. 홈 배너 테이블의 원본 시드는 0행이며,
이번에 조회 API와 서비스 계약을 전환했다. 기존 디자인에 없던 배너 영역을 임의 추가하지 않았다.
상단 공지 조회도 API·서비스를 전환했으며 기존 화면에서 사용하지 않는 영역을 새로 만들지 않았다.

실제 원본 데이터: 아티스트 11·멤버 13·아티스트 배너 5·상품 389·옵션 642·상품 이미지 행 1390.
기존 ID·멤버/이미지 관계·공지 상품 링크는 기존 시드를 사용한다. 공개 상품은 hidden 2개를 제외한 387개다.
GET은 commit·flush를 하지 않으며 원본 데이터·시퀀스를 변경하지 않는다.

P3의 주문 계산·배송비 정책 경로와 P4의 관리자 공지/상품 변경 코드는 수정하지 않았다.
공개 공지 조회만 P2에서 제공한다. 사업자·고객센터 정보는 기존 공개 shop_settings 필드이며 회원/주문 정보는 반환하지 않는다.
챗봇은 공개 상품명·가격·품절·링크만 읽는다. 옵션/구매 제한은 상세 화면으로 안내한다.
Gemini 비밀키가 없는 로컬 환경에서는 외부 AI 호출을 실행하지 않았으며 AI 응답 품질 검증과 구분한다.

기존 Supabase SDK·호환 파일은 제거하지 않았다. 남아 있는 미사용 storage/productRows/fallback/lib/supabase 파일은
실제 카탈로그·인증 서비스 경로에서 호출하지 않는다. 8단계는 SDK 패키지 삭제 작업을 포함하지 않는다.

## 검증 결과

공용 DB 설정을 읽지 않는 별도 소스 사본과 새 로컬 Docker DB만 사용했다.

| 검사 | 결과 |
| --- | --- |
| 신규 잔여 카탈로그 API | 9 passed / 0 skipped |
| 공식 check.py · 마이그레이션 DB | 414 passed / 97 skipped |
| 공식 check.py · P2/P3 일회용 Docker DB | 325 passed / 0 skipped |
| 프론트 단위 테스트 | 34 passed / 0 skipped (이번 매핑 테스트 3개 추가) |
| lint·typecheck·production build | 통과 |
| 새 로컬 DB Alembic check | No new upgrade operations detected |

두 백엔드 단계는 테스트 일부가 겹치므로 합산한 고유 테스트 수로 표시하지 않는다.
첫 단계는 관리자 DB 2개와 P2/P3 전용 DB 테스트를 실행 옵션 때문에 제외한다.
P2/P3 검사는 두 번째 단계에서 모두 실행했다. 이번 환경에는 원본 이미지를 준비해 이미지 관련 skip도 없다.
기존 Starlette/httpx 사용 중단 예고 경고 1개와 Node 모듈 형식 경고는 테스트 실패와 구분한다.

### 확인한 실패·경계·DB 동작

- 공개 아티스트 목록/상세·멤버·배너, 없는 slug 404, 원본 이미지 경로.
- 활성/시작·종료 기간별 홈 배너 필터, 미래 공지 제외, 고정 우선순위,
  다른 아티스트의 공지 404, hidden 관련 상품 링크 null, 설정 없음 503.
- 결제 완료 수량을 여러 옵션에서 상품별로 합산. pending·cancelled·기간 이전·미래 결제·hidden 상품 제외,
  artist 필터·연속 rank·판매 0개 채움 및 입력 범위 422.
- 실제 P1 회원가입·로그인 토큰, 비로그인 401, 타 회원 좋아요 분리, 반복 PUT/DELETE 멱등,
  로그아웃 토큰 재사용 401, 개인 캐시 private/no-store.
- 같은 회원의 동시 PUT 8개 후 행 1개, 동시 DELETE 8개 성공.
- 저장 직후 실제 DB CHECK 오류 발생 시 좋아요 rollback, 같은 세션 재사용 성공.
- 공개 설정의 배송비 3000원·무료배송 기준 50000원이 P3 shipping-policy와 일치.

### 빌드된 앱의 실제 화면 검증

Next.js production build를 next start로 실행했다. Supabase 주소·키 없이 로컬 API만 사용했다.

- 홈의 아티스트 11개·상품 패널·원본 이미지·사업자 정보 표시.
- ORBIT:ON 아티스트 → 멤버 5명 → 선우 프로필 모달의 이미지·생일·태그 표시.
- 공지 상세의 본문·게시일·관련 상품 `/products/2` 링크 표시.
- 비로그인 아티스트 좋아요 → 로그인 복귀 → 추가 → 새로고침 후 선택·count 1 유지 → 해제.
- PC·모바일 390px 확인. 모바일 문서 너비 375px로 가로 넘침 없음.
- 로컬 DB 중단 중 좋아요 실패 시 미선택 유지·오류/재시도 표시.
  DB 복구 뒤 재시도·추가 성공, 해당 테스트 회원 artist_likes 행 0 → 1 확인.

검증용 컨테이너·서버를 종료·정리했다. 공용 DB·서버 배포는 하지 않았다. 9단계·배포는 보류 상태다.
공용 배포는 별도 담당자가 최신 코드·프론트 API 주소·CORS·이미지를 확인해 진행한다.
