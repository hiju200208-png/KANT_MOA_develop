# 첫 영상 배너 로딩 개선

2026-10-27 KST 로컬 구현·검증 후 **2026-10-28 공개 배포 완료**. 아래에 준비·완료 기록을 구분한다.

## 확인한 원인과 변경

- 기존 MP4 3개는 이미 `public/sources/`의 정적 파일이다. 용량 약 2.3~5MB,
  재생 메타데이터가 파일 앞부분에 있고 공개 응답의 Range 요청도 206으로 동작했다.
- 기존 MainHero는 아티스트·좋아요 수와 아티스트별 상품/인기 상품 조회가 끝나야 배너를 렌더했다.
  이제 영상 배너는 아티스트 정보만 준비되면 렌더하고, 상품 슬라이드 Promise는 기다리지 않고 전달한다.
- 상품 슬라이드는 좋아요 순서·NEW/BEST 선정 규칙을 유지하면서 준비되는 대로 뒤에 추가한다.
  영상 슬라이드를 위한 상품 선정 요청은 제거했다. 영상이 없는 경우는 기존 상품 배너 방식으로 동작한다.
- 같은 carousel에 상품을 추가하므로 영상 DOM을 교체하지 않는다. 슬라이드 복제 칸·영상 1개만 있는 경우의
  위치를 보정하고 추가 시 전환 애니메이션을 끄므로 현재 영상이 다른 배너로 바뀌지 않는다.
- 현재 영상 재생이 시작된 후에만 다음 영상 메타데이터를 선조회한다.
- 외부 Pretendard CSS는 마운트 후 로드하고 준비 전에는 기존 대체 글꼴을 사용한다.
  기존 `precedence` stylesheet는 React가 Suspense 내용을 표시하기 전에 해당 CSS를 기다리게 했다.
  [React stylesheet 동작](https://react.dev/reference/react-dom/components/link).
- 영상 파일·음소거/소리 버튼·자동 재생과 기존 배너 디자인은 유지한다. DB·API·Nginx 변경 없음.

## 검증

- lint·typecheck 통과, 기존 프론트 테스트 **34 passed / 0 failed**.
- 최종 코드의 Linux Next.js standalone 운영 이미지 빌드 통과.
- 로컬 가짜 API에서 모든 상품 응답을 보류해도 첫 영상 HTML이 먼저 스트리밍되는 것을 확인했다.
- 브라우저에서도 상품 영역이 대기 중일 때 영상 배너·문구·메뉴 표시를 확인했다.
  응답 해제 후 상품 배너 추가 → 상품 배너 선택 → 영상 복귀 확인.
- 상품 API 503 실패 시에도 첫 영상 배너 스트리밍이 유지되는 회귀 검사 통과.
- 로컬 검사 서버는 종료했다. 공용 DB나 서버에 테스트 데이터·실패 요청을 만들지 않았다.

재현 (저장소 루트, 개발 서버가 꺼진 상태):

```powershell
node scripts/check-home-hero.mjs
node scripts/check-home-hero.mjs --fail-products
```

브라우저 검사는 `--hold`로 실행하고 출력된 로컬 주소를 연다. 출력된 가짜 API 주소의
`/__release`로 상품 응답 보류를 풀고, 확인 후 `/__stop`으로 검사를 종료한다.
가짜 API·Next 개발 서버만 생성하며 DB를 사용하지 않는다.

상품 응답이 첫 배너 표시를 막지 않는다는 검증이다. 공개 서버의 첫 방문이 몇 초로 줄었는지는
배포 후 새 브라우저 세션에서 별도로 측정해야 하며, 위 로컬 결과를 공개 성능 수치로 표현하지 않는다.

## 2026-10-28 홈페이지 단독 배포 준비

사용자 배포 요청에 따라 `deploy/staging/deploy_web.py`를 준비했다.
기존 운영 API의 Docker 네트워크에서 새 홈페이지 후보만 검증하고, 운영 Compose의 web 이미지만 교체한다.
기존 web 환경값과 이미지·실행 관리 파일은 백업하고, 실패하면 이전 web 이미지로 복구한다.
Nginx 설정은 바꾸지 않고 web 컨테이너 IP 갱신을 위해 reload만 실행한다.
API 컨테이너 ID·이미지와 DB 내용의 전후 동일 여부를 확인한다. DB 초기화·migration·seed 실행은 없다.
성공·실패 복구 모의 검사는 `python deploy/staging/check_deploy_web.py`로 재현한다.
이는 배포 준비 기록이며, 실제 서버 실행 결과를 받기 전에는 배포 완료로 표시하지 않는다.

## 2026-10-28 공개 배포 완료

- 사용자 실행 결과 `WEB_DEPLOY_SUCCESS`, `SSH_EXIT=0`, 복구 없이 성공.
- 배포 커밋 `cf82ef72a09b1fd91578126117062accec294a93`, [PR #78](https://github.com/hiju200208-png/KANT_MOA_develop/pull/78).
- 소스 SHA256 `77964cdf7f348abaa347c9ef69c4626741b6803f65c1a10378d0229a2e1939e4`.
- release `~/kant-moa/web-releases/web-20261027T231624Z-cf82ef7`.
- backup `~/kant-moa/backups/before-web-20261027T231624Z-cf82ef7`.
- 홈페이지·로그인 200. 첫 영상 HTML 도착은 후보 0.564초, 공개 주소 0.984초.
  이는 서버 실행기의 단일 요청 측정이며 영상 재생 시작·화면 표시·전체 로딩 완료 시간이나 캐시 없는 방문의 평균이 아니다.
- `api_container_unchanged=true`, `database_unchanged=true` 확인.
- 별도 공개 브라우저에서도 상품 영역이 준비되는 동안 영상 배너와 메뉴가 표시되고 영상 프레임이 재생되는 것을 확인했다.
- 성공 후 `active-site.json`에 web release·commit·override 경로가 기록됐다.
  공개 홈페이지: https://letdown-kilometer-nutcase.ngrok-free.dev/
