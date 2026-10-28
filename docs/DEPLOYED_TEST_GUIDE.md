# 배포한 사이트 테스트 가이드 · 2조 공통 (2026-10-28)

> 로컬에서 다 통과해도 배포한 곳에서 같은 코드가 같은 설정으로 돌고 있는지는 따로 확인해야 한다.
> 다만 배포 환경은 **팀이 같이 쓰는 진짜 데이터**다. 그래서 "무엇을 어디서 테스트하는가"를 먼저 나눈다.
> 접속 주소·서버 구성은 [STAGING.md](STAGING.md), 로컬 검사는 [PR 가이드](PR_GUIDE.md)를 따른다.

## 최종 배포 기준

홈페이지는 공개 `/`, FastAPI는 `/api`, 칸트봇 `/api/chat`은 Next.js가 처리한다. 최근 확인은 main e0c7ad8·공개 상품 388개·FastAPI 51개 경로이며 고정 상품 수가 아니라 [최종 현황](FINAL_STATUS.md)의 시점별 결과다. 아래 5장은 과거 기록으로 보존한다.

## 1. 어디서 무엇을 테스트하나

| 테스트 | 로컬 일회용 DB (`check.py`·CI) | 로컬 Docker DB + 화면 | 배포(학원 서버·공용 DB) |
| --- | --- | --- | --- |
| 도메인·서비스·API 통합 (4계층 테스트) | ✅ 전부 | - | ❌ |
| 실패·동시성·rollback (재고 1개 동시 결제 등) | ✅ | ✅ 필요하면 | ❌ **금지** |
| 정상 흐름 화면 E2E (로그인 → 주문 → 취소) | - | ✅ DB 전 → 후 기록 | ⚠️ 팀 합의 후, 내 테스트 계정·소량만 |
| 배포 확인·스모크 (살아 있나, 어떤 버전인가) | - | - | ✅ 읽기만 |
| 인증 계약 (토큰 없이 401, 없는 데이터 404, 잘못된 입력 422) | ✅ | ✅ | ✅ 데이터가 바뀌지 않는 요청만 |

원칙: **배포 환경에서는 읽기와 "데이터가 안 바뀌는 실패"만** 한다. 재고·주문을 바꾸는 테스트는 로컬에서 끝내고, 배포에서 꼭 해야 하면 팀 채널에 알리고 내 테스트 계정으로 한 건 → 바로 취소해 재고를 원래대로 돌리고 전 → 후를 기록한다.

## 2. 순서 (배포할 때마다)

1. **무엇이 배포됐나 확인**: `/health`가 `{"status":"ok","database":"ok"}`인지, `/api/openapi.json`의 경로 목록에 이번에 머지한 API가 있는지. 없으면 서버가 옛 코드다 → 테스트 전에 재배포.
2. **스모크 (읽기)**: `/api/docs` 열림, 공개 목록 API(`/api/products`, `/api/categories`, `/api/orders/shipping-policy`)가 200이고 값이 시드와 같은지.
3. **계약 (데이터 안 바뀜)**: 토큰 없이 보호 API → 401 `NOT_AUTHENTICATED`, 없는 id → 404, 형식 오류 → 422, 응답 본문이 `{code, message}`인지.
4. **화면 (근거와 함께)**: 브라우저 개발자 도구 **Network 탭**을 켜고 화면을 누른다. 상품·인증·주문 등 업무 요청이 배포 FastAPI 주소를 사용하는지 확인한다. 배너 영상의 Supabase Storage 요청은 의도된 구성이므로 업무 DB·인증 미이전으로 단정하지 않는다. 로딩·빈 화면·오류 표시도 본다.
5. **기록**: 아래 표에 요청·기대·실제·근거(Network 요청, DB 값, 캡처)를 적는다. 토큰·비밀번호·접속 정보·개인정보는 적지 않는다.

## 3. 명령 예시 (읽기만)

ngrok 무료 주소는 안내 페이지를 띄우므로 헤더를 붙인다.

```bash
curl -s -H "ngrok-skip-browser-warning: true" https://letdown-kilometer-nutcase.ngrok-free.dev/health
```
```bash
curl -s -H "ngrok-skip-browser-warning: true" https://letdown-kilometer-nutcase.ngrok-free.dev/api/openapi.json
```
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "ngrok-skip-browser-warning: true" https://letdown-kilometer-nutcase.ngrok-free.dev/api/orders
```

## 4. 기록 양식

| 시각 | 환경 (로컬/배포) | 요청 또는 화면 동작 | 기대 | 실제 | 근거 (Network·DB 전 → 후·캡처) |
| --- | --- | --- | --- | --- | --- |

## 5. 2026-10-27 배포 확인 결과 (여름, 읽기만)

| 확인 | 결과 |
| --- | --- |
| `/health` | `{"status":"ok","database":"ok"}` |
| `/openapi.json` 경로 | 25개: 인증 4, 상품·카테고리 3, 찜 3, P3 배송지 3·장바구니 5·주문 6, health. **관리자 API는 없음** (#62 미머지) |
| `/products` | total 387 (P2 시드) |
| `/orders/shipping-policy` | 50,000원 / 3,000원 (P2 시드의 `shop_settings`) |
| 토큰 없이 `/orders` | 401 |

- 배포 프론트: `kant-moa.vercel.app`(200 응답)이 어느 저장소·커밋을 배포하는지는 아직 확인하지 못했다. 인수 당시(3조, Supabase) 사이트일 수 있으므로, Network 탭으로 요청 주소를 확인하기 전까지 FastAPI 화면 검증은 로컬 프론트로 한다.
