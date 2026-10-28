# 프로젝트2 최종 결과·검증·운영 현황

기준일: **2026-10-28 KST**, 기능 기준 커밋 **e0c7ad8f3f0d551d4b849fa513db34acffcda0a0**.
GitHub PR·현재 소스와 사용자가 전달한 서버 실행 결과를 대조한 기록입니다.
문서 정리 과정에서 공용 DB 쓰기·서버 재배포·기능 테스트를 새로 수행하지 않았습니다.

## 최종 구성과 공개 경로

```text
브라우저 → ngrok HTTPS → Nginx
                       ├─ /       → Next.js 컨테이너
                       ├─ /api/*  → FastAPI 컨테이너 → 같은 서버 PostgreSQL 설치본
                       └─ /api/chat → Next.js Gemini Route Handler
```

- [홈페이지](https://letdown-kilometer-nutcase.ngrok-free.dev/) ·
  [Swagger](https://letdown-kilometer-nutcase.ngrok-free.dev/api/docs) ·
  [OpenAPI](https://letdown-kilometer-nutcase.ngrok-free.dev/api/openapi.json).
- 공개 API에는 `/api`를 붙입니다. 로컬 FastAPI 기본 포트 8000은 `/api` 없이 `/docs`·`/products` 등을 사용합니다.
- 업무 DB·인증은 FastAPI/PostgreSQL이며, 원본 배너 영상 3개만 무료 Supabase Storage에서 제공합니다.
  Supabase SDK·CLI·옛 SQL/타입/예시 데이터는 남아 있으므로 의존성이 완전히 제거됐다는 뜻은 아닙니다.
- 로컬 개발·실패·동시성 검증은 Docker PostgreSQL, 운영 DB는 학원 서버 설치 PostgreSQL입니다.
  API→DB만 내부로 연결했고 팀원용 외부 DB 접근 경로는 유지했습니다.
- 운영 자산·업로드·비밀 환경 파일은 Git 소스와 별도로 보존·백업해야 합니다.
  새 clone에는 기존 운영 이미지 파일·실제 DB·키가 자동으로 포함되지 않습니다.

## 구현 완료 범위와 PR 근거

| 담당 | 완료 범위 | 대표 PR |
| --- | --- | --- |
| P1 노희주 | FastAPI 공통 기반, 일반 회원가입/로그인/내 정보 조회/블랙리스트 로그아웃, 권한·관리자 CLI, Alembic 최초 이력 도입, Google 인증 | [#49](https://github.com/hiju200208-png/KANT_MOA_develop/pull/49), [#63](https://github.com/hiju200208-png/KANT_MOA_develop/pull/63), [#80](https://github.com/hiju200208-png/KANT_MOA_develop/pull/80) |
| P2 이상재 | 공통 재고 도메인·잠금 Repository, 상품/카탈로그/찜/좋아요, 실제 시드·이미지, 화면·최소 인증 연결, 통합 검증·배포·성능 | [#53](https://github.com/hiju200208-png/KANT_MOA_develop/pull/53), [#56](https://github.com/hiju200208-png/KANT_MOA_develop/pull/56), [#66](https://github.com/hiju200208-png/KANT_MOA_develop/pull/66), [#72](https://github.com/hiju200208-png/KANT_MOA_develop/pull/72), [#75](https://github.com/hiju200208-png/KANT_MOA_develop/pull/75), [#79](https://github.com/hiju200208-png/KANT_MOA_develop/pull/79) |
| P3 김여름 | 장바구니/비회원 병합·배송지·주문/모의 결제/취소, 관리자 주문·배송, CI·화면/오류 검수, 칸트봇 연결·정책 보완 | [#54](https://github.com/hiju200208-png/KANT_MOA_develop/pull/54), [#55](https://github.com/hiju200208-png/KANT_MOA_develop/pull/55), [#71](https://github.com/hiju200208-png/KANT_MOA_develop/pull/71), [#76](https://github.com/hiju200208-png/KANT_MOA_develop/pull/76), [#84](https://github.com/hiju200208-png/KANT_MOA_develop/pull/84) |
| P4 장충만 | 관리자 상품/상태/일괄 변경/재고/이미지/공지/대시보드·권한 화면, 비밀번호 재설정 지원 | [#50](https://github.com/hiju200208-png/KANT_MOA_develop/pull/50), [#62](https://github.com/hiju200208-png/KANT_MOA_develop/pull/62), [#82](https://github.com/hiju200208-png/KANT_MOA_develop/pull/82), [#85](https://github.com/hiju200208-png/KANT_MOA_develop/pull/85) |

P3 배송지·관리자 주문/배송과 P4 관리자 상품/재고의 소유권을 구분합니다.
인증 구현은 P1, 기존 인증 API를 상품·찜 화면에서 사용하는 최소 연결은 P2,
추가 비밀번호 재설정 지원은 P4입니다.

## DB 이력과 보존

- 최초 수동 구조: 업무 테이블 18개. 이후 비교·인증 차이 보정을 거쳐 `3f21520f9615` 최초 이력을 도입했습니다.
- 배송 revision `4c726d1a91ab`는 부모 `3f21520f9615` 뒤에 `order_shipments`를 추가합니다.
  운영 적용 결과 `SHIPPING_MIGRATION_SUCCESS`, 기존 업무 데이터·서비스 보존, 당시 배송 행 0개를 확인했습니다.
- 업무 테이블은 **19개**, 이력 관리용 `alembic_version`은 별도입니다.
- 최초 이관 기준: 상품 389개·옵션 642개·상품 이미지 DB 행 1,390개,
  원본 이미지 파일 1,847개(products 1,800 / artists 47). DB 행과 파일 수는 다른 지표입니다.
- 공개 상품은 처음 387개였고 최근 배포 확인은 388개입니다. 숨김 상태·운영 변경에 따라 달라지므로 고정 테스트 기대값으로 삼지 않습니다.
- 공용 DB 초기화·초기 SQL 재실행·최초 baseline 재채택·맹목적 stamp는 하지 않습니다.
  신규 빈 로컬 DB는 Alembic으로 준비하고, 기존 DB 변경은 현재 revision·백업·검토된 후속 이력을 확인합니다.

## 최종 운영 배포 확인

사용자 서버 실행 결과 `LATEST_MAIN_DEPLOY_SUCCESS`·`SSH_EXIT=0`:

| 확인 | 결과 |
| --- | --- |
| API·프론트 기준 | `e0c7ad8`, #83·#84·#85까지 포함 |
| 내부·외부 홈페이지/로그인/Swagger | HTTP 200 |
| 공개 상품 / FastAPI 경로 | 388개 / 51개 (그 점검 시점) |
| 보호 API에 토큰 없음 | 401 |
| Google 인증 설정 | 유지 확인 (전체 실계정 E2E와 구분) |
| 칸트봇 | 실제 AI 응답 200, 공개 답변 98자 확인 |
| 비밀번호 재설정 | 두 화면 200·API 등록, 운영 데모 false 유지 |
| DB·인증·기존 gateway | 동일 DB·데이터 스냅샷 보존·인증 설정 보존·gateway 유지 |

이 최신 코드 배포에서는 SQL·migration·seed를 실행하지 않았습니다.
배송 migration은 그보다 앞선 별도 백업·적용 작업입니다.
전체 서버 응답·HTML 완료 시간은 브라우저 첫 화면·영상 첫 재생 시간과 구분합니다.

## 테스트 증거 읽는 방법

아래는 서로 다른 시점·조건의 **기존 실행 결과**이며 합산하지 않습니다.

| 실행 | 결과 | 범위 |
| --- | --- | --- |
| P1 #49 통합 | 181 passed / 17 skipped | 일반 인증·권한, 선택 실행 DB 검사 제외 |
| P3 #55 | 실제 토큰 API/DB 25개, 서비스↔API 27개 확인 | 브라우저 E2E 개수와 구분 |
| P3 #71 | 기본 423/90, 별도 DB 322/5, 프론트 43 | 표의 숫자는 passed/skipped, 취소/발송 경합·rollback |
| P2 9단계 | 전체 백엔드 515 passed | P1 토큰·P3 주문·P4 조정·P2 재고 통합 |
| P2 #86 | 상품·주문 341 passed | 배송 테이블을 일회용 DB에 준비한 후 회귀 |
| P4 #85 | 프론트 49 tests·lint·타입 검사, 재설정 수동 확인 | 로컬 시연 모드와 운영 비활성 모드 구분 |

기존 TestClient 사용 중단 예고 경고·이미지 원본/로컬 전용 조건에 따른 skip은 각 PR에 기록돼 있습니다.
이번 문서 PR에서 이 숫자를 최신 전체 CI 결과로 다시 주장하지 않습니다.
재현 명령은 [PR 가이드](PR_GUIDE.md), 실패·동시성은 공용 DB가 아닌 일회용 DB에서 수행합니다.

## 성능 개선 결과와 한계

- 정적 파일로도 첫 영상이 느렸던 원인은 서버 업로드·ngrok 경로와 상품/폰트 대기 등이었습니다.
  첫 배너 표시를 상품 요청과 분리하고 재생/선조회·고정 높이를 조정했습니다.
- 저해상도 경량화는 화질 때문에 최종 선택하지 않았습니다. 원본 영상 3개를 외부 Storage로 전달합니다.
- 상품 첫 화면은 필요한 20개만 요청해 이전 100개 과다 조회를 줄였습니다.
- 같은 서버 DB의 외부 터널 왕복은 약 71~144ms, 내부 연결 확인은 약 0.6~1.3ms였습니다.
  내부 상품 HTML 응답 약 0.05초는 외부 브라우저 표시 성능과 동일하지 않습니다.
- 영상 다운로드 측정에는 CDN 캐시 HIT가 포함됐습니다. 캐시 없는 첫 방문 평균이나 무끊김을 보장하지 않습니다.

## 남은 범위

- 내 정보 **수정** API 미연결. `updateProfile`은 안내 오류를 반환하고 Supabase에 쓰지 않습니다.
- 실제 PG·메일 발송·교환/반품 신청·반품 환불·택배사/운송장 연동·재고 변경 이력 조회는 미구현입니다.
- 재설정 시연 모드를 운영에서 켜면 이메일만으로 링크를 받을 수 있으므로 기본 false를 유지합니다.
  화면/API 구현 완료가 메일 기반 본인 확인 완료를 뜻하지 않습니다.
- Google 동일 계정 재로그인·비회원 병합의 실제 화면 E2E는 기존 기록에 미확인으로 남아 있습니다.
- 칸트봇은 공개 상품·정책만 사용하며 회원·주문을 조회하지 않습니다. 답변의 상품 경로는 클릭 링크가 아닌 문자열입니다.
- 일부 배포 도구·상재 인계 수정은 로컬 개인 보관 브랜치에만 있으며 팀 main에 모두 통합된 것으로 취급하지 않습니다.
  특히 원래 배포의 `backend.env`만 보고 현재 API 설정을 덮어쓰지 않습니다.

## 문서 구분

- 현재 안내: 이 문서·[README](../README.md)·[PROJECT2](PROJECT2.md).
- 시점별 운영 이력: [STAGING](STAGING.md)·[배포 구성](../deploy/staging/SITE.md)·[Google 기록](GOOGLE_LOGIN.md).
- [P2 인계](SANGJAE_HANDOFF.md)의 이전 체크리스트·새 채팅 문구는 과거 계획입니다. 1~9단계를 처음부터 재실행하는 지시가 아닙니다.
- 인수한 프로젝트1 README·설계·SQL·작업일지는 역사 자료로 보존합니다.
  과거의 Vercel·Supabase db push·dev→develop 절차를 현재 운영에 적용하지 않습니다.
