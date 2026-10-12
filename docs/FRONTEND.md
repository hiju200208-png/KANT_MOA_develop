# 프론트엔드 작업 가이드 (에이전트용)

> 프론트엔드 작업 시 사람과 코딩 에이전트가 따라야 할 규칙입니다.
> 공통 규칙(브랜치, 커밋, PR, 작업 기록)은 `docs/SETUP.md`, 데이터 구조는 `docs/DB_DESIGN.md`를 따릅니다.
> 이 문서의 **멈춤 규칙(3장)** 에 해당하면 에이전트는 즉시 작업을 멈추고 사람에게 보고합니다.

## 1. 프론트엔드 범위와 소유 영역

### 프론트엔드 전체 영역

- `src/app/` : 페이지, 레이아웃
- `src/components/` : UI 컴포넌트
- `src/hooks/` : 커스텀 훅
- `src/constants/` : 에러 메시지, 라벨 등 상수
- `src/mocks/` : 백엔드 준비 전 임시 목 데이터
- `public/` : 로고, 배너, 아이콘 등 디자인 고정 이미지

### 사람별 담당 (프론트엔드 3명)

| 담당자 | 개인 브랜치 | 담당 페이지 / 폴더 |
|---|---|---|
| jina | `dev/jina` | 공통 레이아웃(헤더·푸터·네비), `src/components/ui/`, 전역 스타일·디자인 토큰, 로그인·회원가입 |
| chungman | `dev/chungman` | 메인, 아티스트 페이지, 카테고리·상품 목록, 상품 상세 |
| sungho | `dev/sungho` | 장바구니, 주문서, 결제 완료, 주문 내역, 마이페이지 |

- jina는 초반에 공용 UI 컴포넌트(버튼, 입력, 모달, 스켈레톤)와 레이아웃을 먼저 만들어 develop에 올려야 chungman, sungho가 막히지 않습니다. 그 전까지 두 사람은 자기 폴더 안에서 임시 마크업으로 작업하고 나중에 공용 컴포넌트로 교체합니다.
- 상품 상세의 "장바구니 담기" 버튼은 chungman이 화면을 만들고, 장바구니 로직은 `src/hooks/useCart.ts`(sungho 담당)를 가져다 씁니다.

- 자기 담당 폴더 밖의 파일은 수정하지 않습니다.
- 담당이 겹치는 작업이 생기면 먼저 팀 채널에서 누가 할지 정하고 이 표를 갱신합니다.

### 공용 핫스팟 파일 (변경 전 반드시 팀 공지)

여러 명이 동시에 고치면 충돌이 거의 확실한 파일들입니다. **지정된 담당자만 수정**하고, 다른 사람은 요청만 합니다.

| 파일 | 수정 권한 |
|---|---|
| `package.json`, `package-lock.json` | 누구나 가능하나 **의존성 추가는 PR 하나에 단독으로**, 팀 공지 후 |
| `src/app/layout.tsx`, `src/app/globals.css` | jina |
| `tailwind.config.*`, `next.config.*` | jina |
| `src/proxy.ts` | 백엔드 |
| `src/services/`, `src/lib/supabase/`, `src/types/database.ts`, `src/types/app.ts` | 백엔드 |
| `docs/SETUP.md` | 팀 합의 후 누구나 |

## 2. 브랜치 규칙 (이름별 브랜치)

기능별 브랜치 대신 **사람마다 하나의 개인 브랜치**를 사용합니다. 자세한 흐름은 `docs/SETUP.md` 8장 참고.

```
main ← develop ← dev/<이름>
```

- 내 작업은 항상 `dev/<내이름>`에서만 합니다. 다른 사람의 `dev/*` 브랜치에 커밋하거나 checkout해서 수정하지 않습니다.
- 작업 시작 전 매번 `develop`을 내 브랜치에 합칩니다.
  ```bash
  git checkout dev/<내이름>
  git fetch origin
  git merge origin/develop
  ```
- 기능 하나가 끝나면 바로 PR을 올립니다. 개인 브랜치를 오래 쌓아둘수록 충돌이 커집니다. **최소 이틀에 한 번은 PR** 을 목표로 합니다.
- PR이 머지되면 즉시 `git merge origin/develop`으로 다시 동기화합니다.
- 개인 브랜치라도 `git push --force`는 사용하지 않습니다.

## 3. 멈춤 규칙 (충돌 방지)

에이전트는 아래 상황 중 하나라도 해당하면 **코드를 수정하지 말고 멈춘 뒤, 상황과 관련 파일을 사람에게 보고**합니다.

1. `git merge origin/develop` 중 충돌이 발생했다
   → `git merge --abort`로 되돌리고 충돌 파일 목록을 보고합니다. 충돌을 임의로 해결하지 않습니다.
2. 수정하려는 파일이 1장 기준 **다른 사람의 담당 영역**이다
3. 수정하려는 파일이 **공용 핫스팟 파일**이다
4. 수정하려는 파일을 **다른 사람이 아직 머지되지 않은 브랜치에서 수정 중**이다
   ```bash
   git fetch origin
   # 다른 개인 브랜치들이 develop 이후 해당 파일을 건드렸는지 확인
   for b in $(git branch -r | grep 'origin/dev/' | grep -v "dev/<내이름>"); do
     git log --oneline origin/develop..$b -- <수정할 파일> | sed "s|^|$b: |"
   done
   ```
   출력이 있으면 멈춥니다.
5. 필요한 데이터나 함수가 `src/services/`에 없다 (→ 7장 방식으로 백엔드에 요청)
6. 작업 범위가 요청받은 것보다 커지고 있다 (리팩터링, 폴더 구조 변경, 라이브러리 교체 등)
7. 새 패키지를 설치해야 한다

보고 형식

```
[STOP] <멈춘 이유 번호와 요약>
- 관련 파일:
- 확인한 내용:
- 제안하는 다음 행동:
```

## 4. 영역 침범 금지

- 컴포넌트·페이지에서 `supabase.from(...)`, `supabase.rpc(...)`, `createClient()`를 **직접 호출하지 않습니다.** 데이터는 `src/services/` 함수로만 가져옵니다.
- `src/services/`, `src/types/database.ts`, `supabase/`는 수정하지 않습니다. 필요하면 7장 방식으로 요청합니다.
- 다른 사람이 만든 컴포넌트를 내 페이지에 맞추려고 수정하지 않습니다. 필요한 변형이 있으면 props 추가를 담당자에게 요청하거나, 내 폴더 안에 별도 컴포넌트를 만듭니다.
- 다른 사람의 작업 기록(`docs/worklog/<다른 사람>.md`)은 수정하지 않습니다.

## 5. 작업 기록

에이전트와 작업한 세션은 **반드시** 기록을 남깁니다. 형식과 위치는 `docs/SETUP.md` 14장을 따릅니다. 기록이 없는 에이전트 작업 PR은 머지하지 않습니다.

## 6. 코드 규칙

### 폴더 & 네이밍

```
src/
├─ app/
│  ├─ (shop)/
│  │  ├─ page.tsx                      # 메인
│  │  ├─ artists/[slug]/page.tsx       # 아티스트 페이지 1개로 3그룹 처리 (slug 예: orbit-on / daylog / sodafm)
│  │  ├─ category/[slug]/page.tsx      # 카테고리 페이지 1개로 7개 처리 (slug 예: album / doll)
│  │  ├─ products/[id]/page.tsx        # 상품 상세
│  │  ├─ cart/page.tsx
│  │  ├─ checkout/page.tsx
│  │  └─ orders/...
│  └─ (auth)/login, signup
├─ components/
│  ├─ ui/          # 버튼, 입력, 모달 등 공용 (담당: jina)
│  ├─ layout/      # 헤더, 푸터
│  ├─ product/     # 상품 카드, 옵션 선택 등
│  ├─ cart/
│  └─ order/
├─ hooks/
├─ constants/
└─ mocks/
```

| 대상 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 파일·이름 | PascalCase | `ProductCard.tsx` |
| 훅 | `use` + camelCase | `useCart.ts` |
| 라우트 폴더 | kebab-case | `order-complete/` |
| 상수 | UPPER_SNAKE_CASE | `ERROR_MESSAGES` |
| 이벤트 핸들러 | `handle` + 동작 | `handleAddToCart` |

### 컴포넌트

- 기본은 Server Component. 상태·이벤트·브라우저 API(localStorage 등)가 필요할 때만 `'use client'`를 붙입니다.
- 장바구니처럼 비회원 localStorage를 다루는 부분은 Client Component입니다.
- 새 공용 컴포넌트를 만들기 전에 `src/components/ui/`에 비슷한 것이 있는지 먼저 확인합니다.
- 한 파일이 200줄을 넘으면 분리를 검토합니다.

### 스타일

- Tailwind만 사용합니다. 인라인 `style`과 별도 CSS 파일은 지양합니다.
- 색상·간격·폰트는 Tailwind 설정의 디자인 토큰을 사용하고, 임의 값(`text-[#1a2b3c]`)은 피합니다.
- 아티스트별 테마 색은 하드코딩하지 않고 `artists.theme_color` 데이터를 사용합니다.
- 모바일 우선으로 작성하고 `sm`, `md`, `lg` 순으로 확장합니다.

### 데이터 & 하드코딩 금지

- 가격, 재고, 상품명, 옵션, 카테고리 목록, 아티스트·멤버 이름은 **항상 데이터에서** 가져옵니다.
- 가격 표시는 `price + extra_price`로 계산하고, 금액 포맷은 공용 유틸(`formatPrice`) 하나만 사용합니다.
- 화면에 표시하는 가격은 안내용이며, 실제 결제 금액은 서버(`create_order`)가 계산합니다. 프론트에서 계산한 금액을 서버에 보내지 않습니다.

### 이미지

- 상품·아티스트 이미지는 services가 반환한 URL을 `next/image`로 표시합니다.
- 모든 이미지에 의미 있는 `alt`를 넣습니다. (예: `"ORBIT:ON 아크릴 키링"`)
- 디자인 고정 이미지(로고·배너·아이콘)만 `public/`에 둡니다.

### 상태 처리

모든 데이터 화면은 네 가지 상태를 갖춰야 합니다.

| 상태 | 예시 |
|---|---|
| 로딩 | 스켈레톤 또는 스피너 |
| 빈 상태 | "장바구니가 비어 있어요" + 상품 보러가기 버튼 |
| 에러 | 에러 메시지 + 다시 시도 |
| 정상 | |

### 에러 메시지

- services가 던지는 `AppError.code`를 `src/constants/error-messages.ts`의 메시지로 변환해 보여줍니다. 컴포넌트마다 메시지를 따로 쓰지 않습니다.

```ts
// src/constants/error-messages.ts
import type { AppErrorCode } from '@/services/errors';

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NOT_AUTHENTICATED: '로그인이 필요해요.',
  CART_EMPTY: '장바구니가 비어 있어요.',
  UNAVAILABLE_ITEM: '판매가 중단되었거나 재고가 부족한 상품이 있어요.',
  PURCHASE_LIMIT_EXCEEDED: '1인 구매 가능 수량을 초과했어요.',
  OUT_OF_STOCK: '결제 중에 품절된 상품이 있어요.',
  INVALID_ORDER: '결제할 수 없는 주문이에요.',
  ALREADY_CANCELLED: '이미 취소된 주문이에요.',
  UNKNOWN: '잠시 후 다시 시도해 주세요.',
};
```

### 폼

- 배송지·회원가입 폼은 클라이언트 검증(필수값, 전화번호 형식)을 하되, 최종 검증은 서버가 한다고 가정합니다.
- 제출 중에는 버튼을 비활성화해 중복 요청을 막습니다. 특히 "결제하기" 버튼은 반드시 처리합니다.

### 접근성

- 클릭 가능한 요소는 `<button>` 또는 `<a>`를 사용합니다. `<div onClick>` 금지.
- 옵션 선택, 수량 조절 등 폼 요소에 `label`을 연결합니다.

## 7. 백엔드에 요청하는 법

필요한 데이터나 함수가 services에 없을 때

1. GitHub Issue 생성, 라벨 `backend-request`
2. 필요한 함수 이름, 입력, 기대하는 반환 형태를 적습니다.
   ```
   함수: getProductsByArtist(slug: string)
   반환: { id, name, price, thumbnailUrl, categorySlug }[]
   사용처: src/app/(shop)/artists/[slug]/page.tsx
   ```
3. 기다리는 동안은 `src/mocks/`에 같은 반환 형태의 목 데이터를 만들어 화면을 개발합니다.
4. 목 데이터 사용 부분에는 `// TODO(mock): #이슈번호` 주석을 남기고, services가 준비되면 교체 후 목을 삭제합니다.

## 8. PR 전 확인

```bash
npm run lint
npx tsc --noEmit
npm run build
```

- 세 가지 모두 통과해야 PR을 올립니다.
- UI 변경은 PR에 스크린샷(모바일·데스크톱)을 첨부합니다.
- `console.log`, 사용하지 않는 import, 주석 처리된 코드 블록을 지웁니다.
- 남아 있는 `TODO(mock)`은 PR 설명에 목록으로 적습니다.

## 9. 에이전트 체크리스트

작업 시작 전

- [ ] `docs/SETUP.md`, `docs/FRONTEND.md`를 읽었고, 데이터 관련이면 `docs/DB_DESIGN.md`도 읽었다
- [ ] 지금 브랜치가 `dev/<작업자 이름>`인지 확인했다
- [ ] `git merge origin/develop`을 했고 충돌이 없었다 (있으면 3장 멈춤)
- [ ] 이번 작업에서 수정할 파일 목록을 정하고, 3장 4번 명령으로 다른 브랜치와 겹치는지 확인했다

작업 중

- [ ] 담당 영역과 핫스팟 규칙을 지켰다
- [ ] supabase를 직접 호출하지 않고 services만 사용했다
- [ ] 가격·재고·이름 등을 하드코딩하지 않았다
- [ ] 로딩·빈·에러 상태를 구현했다
- [ ] 새 패키지를 설치하지 않았다 (필요하면 멈춤)

작업 후

- [ ] lint, 타입 체크, 빌드를 통과했다
- [ ] 커밋 메시지가 컨벤션을 따른다
- [ ] `docs/worklog/<작업자 이름>.md`에 작업 기록을 추가했다
- [ ] PR 설명에 작업 기록 링크(또는 Notion 링크)와 남은 TODO를 적었다