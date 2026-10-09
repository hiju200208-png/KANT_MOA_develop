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
