# 굿즈샵 프로젝트 초기 세팅 & 협업 가이드

> 이 문서는 팀원과 코딩 에이전트가 함께 참고하는 기준 문서입니다.
> 에이전트는 작업 전에 이 문서와 담당 영역 문서(`docs/FRONTEND.md` 또는 `docs/BACKEND.md`), 필요 시 `docs/DB_DESIGN.md`를 먼저 읽고 규칙을 따릅니다.

## 1. 프로젝트 개요

- 아이돌 그룹 3개 ORBIT:ON(오르빗온), DAYLOG(데이로그), SODAFM(소다에프엠)의 굿즈샵
- 기능 범위: 회원가입/로그인, 상품(카테고리·옵션), 비회원/회원 장바구니, 주문, 가짜 결제, 주문 취소
- 관리자 페이지 없음 (상품·재고는 Supabase 대시보드 / seed SQL로 관리)

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (App Router, TypeScript) |
| 스타일 | Tailwind CSS |
| BaaS | Supabase (Auth, Postgres, RLS, RPC) |
| Supabase 클라이언트 | `@supabase/supabase-js`, `@supabase/ssr` |
| DB 마이그레이션 | Supabase CLI (`supabase/migrations`) |
| 배포 | Vercel |
| 패키지 매니저 | npm (팀 전원 동일하게 사용, lock 파일 커밋) |

별도 API 서버와 Next.js API Route는 사용하지 않습니다. 주문·결제·재고처럼 신뢰가 필요한 로직은 전부 Supabase RPC(Postgres 함수)로 처리합니다.

**예외: AI 챗봇(칸트봇)** — Gemini API 키를 브라우저에 노출하지 않기 위해 `src/app/api/chat/route.ts` 하나만 Route Handler로 둡니다. 키는 `GEMINI_API_KEY`(서버 전용, `NEXT_PUBLIC_` 아님)로 `.env.local`·Vercel 환경 변수에 등록합니다.

## 3. 역할 분담

팀 구성: 백엔드 1명(jin), 프론트엔드 3명(jina, chungman, sungho) — 총 4명

| 담당 | 소유 영역 |
|---|---|
| 백엔드 | `supabase/` 전체, `src/lib/supabase/`, `src/services/`, `src/proxy.ts`, `src/types/database.ts`, `src/types/app.ts`, `docs/DB_DESIGN.md`, `docs/BACKEND.md` |
| 프론트엔드 | `src/app/`, `src/components/`, `src/hooks/`, `src/constants/`, `src/mocks/`, `public/`, 스타일 (사람별 세부 담당은 `docs/FRONTEND.md` 1장) |
| 공동 | `docs/SETUP.md`, `src/types/` 중 database.ts·app.ts 외 공용 타입 |

다른 담당 영역의 파일은 수정하지 않습니다. 꼭 필요하면 먼저 담당자와 합의하고, PR 설명에 이유를 적고 해당 담당자를 리뷰어로 지정합니다.

## 4. 폴더 구조

```
KANT_MOA/
├─ docs/
│  ├─ SETUP.md            # 이 문서
│  ├─ FRONTEND.md         # 프론트엔드 작업 규칙 (에이전트용)
│  ├─ BACKEND.md          # 백엔드 작업 규칙 (에이전트용)
│  ├─ DB_DESIGN.md        # ERD, 정책, 마이그레이션 SQL 원본
│  └─ worklog/            # 사람별 작업 기록 (<이름>.md)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/         # 타임스탬프_이름.sql (적용된 파일은 수정 금지)
│  └─ seed.sql            # 아티스트·카테고리·샘플 상품
├─ src/
│  ├─ app/
│  │  ├─ (shop)/          # 상품 목록·상세·장바구니·주문 페이지
│  │  ├─ (auth)/          # 로그인·회원가입
│  │  └─ layout.tsx
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  │  └─ supabase/
│  │     ├─ client.ts     # 브라우저용 클라이언트
│  │     ├─ server.ts     # 서버 컴포넌트용 클라이언트 (cookies 사용)
│  │     └─ proxy.ts      # 세션 갱신 헬퍼
│  ├─ services/           # Supabase 호출 래퍼 (프론트는 여기만 import, 명세: docs/API_SPEC.md)
│  │  ├─ storage.ts       # Storage 경로 → 공개 URL 변환
│  │  ├─ products.ts      # 아티스트·카테고리·상품 조회
│  │  ├─ auth.ts          # 회원가입·로그인·프로필
│  │  ├─ cart.ts          # 서버 장바구니 + 비회원 장바구니 + 병합
│  │  ├─ orders.ts
│  │  └─ errors.ts        # RPC·Auth 에러 코드 → 앱 에러 변환
│  ├─ types/
│  │  ├─ database.ts      # supabase gen types 결과 (직접 수정 금지)
│  │  └─ app.ts           # services 반환 타입 (백엔드 작성, 프론트는 import만)
│  └─ proxy.ts            # 세션 갱신 (Next.js 16부터 middleware → proxy)
├─ .env.example
└─ .github/
   └─ pull_request_template.md
```

프론트엔드는 컴포넌트에서 `supabase.from(...)`이나 `supabase.rpc(...)`를 직접 호출하지 않고 `src/services/`의 함수만 사용합니다. 이렇게 하면 DB 구조가 바뀌어도 수정 범위가 services로 한정됩니다.

## 5. 최초 세팅 (리포 생성자 1명만)

```bash
# 1) Next.js 프로젝트 생성
npx create-next-app@latest goods-shop \
  --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
cd goods-shop

# 2) Supabase 패키지
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase

# 3) Supabase 프로젝트 연결
npx supabase init
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

# 4) 문서 배치
mkdir docs   # SETUP.md, BACKEND.md, DB_DESIGN.md 복사

# 5) GitHub 리포 연결
git init
git add .
git commit -m "chore: 프로젝트 초기 세팅"
git branch -M main
git remote add origin <REPO_URL>
git push -u origin main
git checkout -b develop
git push -u origin develop
```

이미지 정책: 상품·아티스트 이미지는 Supabase Storage에서 불러오고, 로고·배너·아이콘 등 디자인 고정 이미지만 `public/`에 둡니다. `next/image`를 쓰려면 `next.config`의 `images.remotePatterns`에 `<PROJECT_REF>.supabase.co`의 `/storage/v1/object/public/**` 경로를 등록합니다.

Supabase 클라이언트(`client.ts`, `server.ts`, `proxy.ts`) 코드는 Supabase 공식 문서의 "Next.js Server-Side Auth" 가이드를 기준으로 작성합니다. 패키지 버전에 따라 API가 달라질 수 있으므로 블로그 예제보다 공식 문서를 우선합니다.

## 6. 팀원 로컬 세팅

```bash
git clone https://github.com/jin-park0115/KANT_MOA.git
cd KANT_MOA
git checkout develop
npm install
cp .env.example .env.local   # 값은 팀 채널에서 공유받기
npm run dev
```

## 7. 환경 변수

`.env.example` (커밋 O)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # 또는 프로젝트에 따라 ANON_KEY
```

규칙

- `.env.local`은 절대 커밋하지 않습니다 (`.gitignore` 확인).
- **service role / secret key는 프론트 코드와 `.env.local`에 넣지 않습니다.** 이 프로젝트는 서버 측 관리자 로직이 없으므로 필요하지 않습니다.
- Vercel 배포 시 같은 키를 Vercel 프로젝트 환경 변수에 등록합니다.

`.gitignore`에 추가로 확인할 항목

```
.env*.local
supabase/.temp
supabase/.branches
```

## 8. Git 브랜치 전략 (이름별 브랜치)

기능별 브랜치 대신 **사람마다 개인 브랜치 하나**를 사용합니다.

```
main          ← 배포 브랜치 (develop에서만 머지)
develop       ← 통합 브랜치 (개인 브랜치 PR 대상)
dev/<이름>    ← 개인 작업 브랜치 (본인만 커밋)
```

팀 브랜치: `dev/jin`(백엔드), `dev/jina`, `dev/chungman`, `dev/sungho` (영문 소문자, worklog 파일은 `docs/worklog/<대문자 이름>.md`)

### 작업 흐름

1. 처음 한 번: `git checkout develop && git pull && git checkout -b dev/<이름> && git push -u origin dev/<이름>`
2. **작업 시작 전 매번** develop을 내 브랜치에 합치기
   ```bash
   git checkout dev/<이름>
   git fetch origin
   git merge origin/develop
   ```
   충돌이 나면 혼자 해결하지 말고 `git merge --abort` 후 관련 담당자와 상의합니다.
3. 작업 & 커밋 (커밋은 작게, 컨벤션 준수)
4. 기능 하나가 끝나면 `dev/<이름>` → `develop` PR 생성 (이슈 연결 `Closes #12`)
5. PR 템플릿을 채우고 CI(린트 · 타입 검사 · 테스트) 통과를 확인한 뒤 **머지 커밋(Create a merge commit)** 으로 머지 (개인 브랜치는 삭제하지 않음)
   - 2026.10.13 이전에는 리뷰 승인 없이 머지한 PR이 많습니다. 이후로는 다른 담당 영역을 건드린 PR은 해당 담당자 승인을 받습니다.
6. 머지 직후 다시 2번으로 동기화

### 규칙

- 다른 사람의 `dev/*` 브랜치에 커밋하지 않습니다. 예외: PR 충돌을 대신 해결할 때 저장소 관리자가 `develop` 병합 커밋만 올리고, 브랜치 주인에게 `git pull`을 하라고 알립니다.
- 개인 브랜치를 오래 쌓아두지 않습니다. **최소 이틀에 한 번은 PR**을 올려 develop과의 차이를 작게 유지합니다.
- `git push --force`는 개인 브랜치에서도 사용하지 않습니다.
- 같은 파일을 여러 명이 동시에 수정해야 하면 작업 전에 팀 채널에서 순서를 정합니다.

### 브랜치 보호 (GitHub Settings → Branches)

- `main`: 직접 push 금지, PR 필수, CI 통과 필수 (2026.10.13 적용)
- `develop`: PR로 머지, CI 통과 확인 (보호 규칙은 걸지 않음: 개발 막바지 충돌 해결 속도 때문)

## 9. 커밋 컨벤션

```
<type>: <요약 (한글 가능, 50자 이내)>
```

| type | 용도 |
|---|---|
| feat | 기능 추가 |
| fix | 버그 수정 |
| refactor | 동작 변화 없는 코드 개선 |
| style | 포맷팅, 세미콜론 등 |
| docs | 문서 |
| chore | 설정, 패키지 |
| db | 마이그레이션, RLS, RPC 변경 |
| test | 테스트 |

예시: `db: pay_order 구매 제한 체크 추가`, `feat: 비회원 장바구니 localStorage 저장`

## 10. PR 템플릿

`.github/pull_request_template.md`

```markdown
## 작업 내용
-

## 작업 기록
- [ ] `docs/worklog/<이름>.md` 추가 (에이전트 사용 시 필수)

## 관련 이슈
Closes #

## 변경 유형
- [ ] 프론트엔드
- [ ] 백엔드 (services)
- [ ] DB (마이그레이션 / RLS / RPC)
- [ ] 문서 / 설정

## DB 변경 시 체크
- [ ] 새 마이그레이션 파일로 추가 (기존 파일 수정 X)
- [ ] 새 테이블에 RLS 활성화 + 정책 추가
- [ ] `src/types/database.ts` 재생성 후 커밋
- [ ] `docs/DB_DESIGN.md` 반영

## 확인 방법
-

## 스크린샷 (UI 변경 시)
```

## 11. DB 변경 협업 규칙

DB는 팀 전체가 공유하는 Supabase 프로젝트 하나를 사용하므로 아래 규칙을 지킵니다.

- 스키마 변경은 **대시보드에서 직접 하지 않고** 마이그레이션 파일로만 합니다.
  ```bash
  npx supabase migration new add_wishlist
  # supabase/migrations/<timestamp>_add_wishlist.sql 작성
  npx supabase db push
  ```
- 이미 push된 마이그레이션 파일은 수정하지 않고, 수정 사항도 새 마이그레이션으로 추가합니다.
- 스키마가 바뀌면 타입을 재생성해서 같은 PR에 포함합니다.
  ```bash
  npx supabase gen types typescript --linked > src/types/database.ts
  ```
- `db push`는 PR이 develop에 머지된 뒤 백엔드 담당이 실행합니다 (동시에 여러 명이 push하면 순서가 꼬임).
- 예외: 상품·재고 데이터 입력/수정은 대시보드에서 해도 됩니다 (스키마가 아닌 데이터이므로).

## 12. 배포

- Vercel에 GitHub 리포 연결, Production Branch = `main`
- PR마다 Preview 배포가 자동 생성되므로 리뷰 시 활용
- Supabase Auth → URL Configuration에 Vercel 도메인(프로덕션, 프리뷰)을 Redirect URL로 등록

## 13. 코딩 에이전트 사용 규칙

- 에이전트에게 작업을 맡길 때는 이슈 번호, 작업자 이름, 그리고 "docs/SETUP.md와 docs/FRONTEND.md(또는 BACKEND.md) 규칙을 따를 것"을 명시합니다.
- 에이전트는 작업자의 `dev/<이름>` 브랜치에서만 작업합니다. `main`, `develop`, 다른 사람의 브랜치에 커밋하지 않습니다.
- 에이전트가 만든 코드도 반드시 사람이 PR 리뷰 후 머지합니다.
- 에이전트에게 `.env.local` 내용이나 secret key를 붙여넣지 않습니다.
- 에이전트가 `supabase db push`, `git push --force`, 브랜치 삭제, 패키지 설치 같은 명령을 실행하기 전에는 사람이 확인합니다.
- 충돌 가능성이 보이거나 담당 영역 밖의 파일을 수정해야 하면 **즉시 멈추고** 사람에게 보고합니다. (세부 기준: `docs/FRONTEND.md` 3장)
- 에이전트와 작업한 세션은 14장 형식으로 **반드시 기록**합니다.

## 14. 작업 기록 (worklog)

에이전트와 함께 작업했다면 세션이 끝날 때 에이전트가 직접 기록을 남깁니다. 에이전트 없이 작업한 경우에도 남기는 것을 권장합니다.

### 위치

- 기본: 리포의 `docs/worklog/<이름>.md` (사람마다 파일을 따로 써서 기록끼리 충돌하지 않음)
- 최신 기록을 **파일 맨 위**에 추가합니다.
- 팀에서 Notion을 함께 쓰는 경우, 같은 형식으로 Notion "작업 로그" 페이지에도 남기고 PR 설명에 링크합니다. 단, 리포의 기록이 기준입니다.
- 작업 기록은 해당 작업 커밋과 같은 PR에 포함합니다.

### 형식

```markdown
## 2026-10-07 | 장바구니 수량 변경 UI

- 작업자: <이름>
- 브랜치: dev/<이름>
- 관련 이슈 / PR: #12 / #15
- 에이전트 사용: O (Claude Code)

### 요청한 작업
- 장바구니 페이지에서 수량 +/- 버튼과 삭제 버튼 구현

### 한 일
- `src/app/(shop)/cart/page.tsx` 수량 조절 UI 추가
- `src/components/cart/QuantityStepper.tsx` 생성

### 결정 사항 / 이유
- 수량 변경은 디바운스 300ms 후 services 호출 (연타 시 요청 폭주 방지)

### 멈춘 지점 / 보고한 내용
- 없음 (또는 [STOP] 내용 요약)

### 남은 일 / TODO
- 품절 옵션 표시 디자인 확인 필요
```

### 규칙

- 다른 사람의 작업 기록 파일은 수정하지 않습니다.
- 기록에 `.env` 값, 키, 개인정보를 적지 않습니다.
- 에이전트 사용 PR에 작업 기록이 없으면 리뷰어는 머지하지 않습니다.