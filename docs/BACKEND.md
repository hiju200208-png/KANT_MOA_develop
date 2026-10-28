# 백엔드 작업 가이드 (에이전트용)

> **프로젝트1 인수 자료입니다.** 아래 Supabase·Vercel·옛 역할/브랜치·RPC 설명은 당시 기준으로 보존합니다. 현재 프로젝트2의 실행·개발 계약은 [README](../README.md)·[PROJECT2](PROJECT2.md), 최종 구현/운영은 [FINAL_STATUS](FINAL_STATUS.md)를 따릅니다. 이 문서의 초기 SQL·Supabase db push를 현재 공용 DB에 실행하지 않습니다.

> 이 문서는 굿즈샵 백엔드(Supabase) 작업 시 코딩 에이전트가 따라야 할 규칙입니다.
> 스키마·정책·RPC의 원본은 `docs/DB_DESIGN.md`이며, 이 문서와 충돌하면 DB_DESIGN.md를 기준으로 하고 사람에게 알립니다.
> 공통 협업 규칙(브랜치, 커밋, PR)은 `docs/SETUP.md`를 따릅니다.

## 1. 백엔드 범위

- `supabase/migrations/` : 테이블, 인덱스, 트리거, RLS, RPC 함수
- `supabase/seed.sql` : 아티스트·카테고리·샘플 상품
- `src/lib/supabase/` : Supabase 클라이언트 생성
- `src/services/` : 프론트가 호출하는 데이터 접근 함수 (명세: `docs/API_SPEC.md`)
- `src/types/app.ts` : services 반환 타입 (프론트와 공유)
- `src/proxy.ts` : 세션 갱신 (Next.js 16의 Proxy, 구 middleware)
- `src/lib/kantbot.ts`, `src/app/api/chat/route.ts`, `src/services/chat.ts` : AI 챗봇(칸트봇) 서버 로직·API·호출 함수
- `src/types/database.ts` : 자동 생성 타입 (직접 편집 금지)

`src/app/`, `src/components/`는 프론트 담당 영역이므로 수정하지 않습니다.

## 2. 아키텍처 요약

```
[브라우저 / 서버 컴포넌트]
        │  services/*.ts 만 호출
        ▼
[Supabase]
  ├─ 단순 조회      → supabase.from(...).select()   (RLS로 보호)
  ├─ 장바구니 CRUD  → supabase.from('cart_items')    (RLS: 본인 것만)
  └─ 주문/결제/취소 → supabase.rpc(...)              (SECURITY DEFINER 함수)
```

- 별도 API 서버 없음. Next.js API Route는 AI 챗봇 `src/app/api/chat/route.ts` 하나만 예외 (Gemini API 키 보호)
- 관리자 없음. 카탈로그 테이블에는 쓰기 정책을 만들지 않음
- 결제는 가짜 결제 (`pay_order` 호출 = 결제 완료)

## 3. 반드시 지킬 원칙

1. **돈·재고·구매 제한이 걸린 쓰기는 RPC로만.** `orders`, `order_items`, `product_variants.stock`에 대한 INSERT/UPDATE 정책을 절대 추가하지 않습니다.
2. **가격은 항상 DB에서 계산.** 클라이언트가 보낸 가격·합계를 신뢰하지 않습니다.
3. **모든 새 테이블은 RLS 활성화 + 정책 작성**을 같은 마이그레이션에 포함합니다. RLS 없는 테이블은 머지하지 않습니다.
4. **SECURITY DEFINER 함수**는 반드시 `set search_path = public`을 지정하고, 함수 첫 부분에서 `auth.uid()`가 null이면 `NOT_AUTHENTICATED`를 던집니다.
5. RPC 실행 권한은 `public`, `anon`에서 revoke하고 `authenticated`에만 grant합니다.
6. 재고 차감은 `UPDATE ... SET stock = stock - n WHERE id = ? AND stock >= n` 형태의 조건부 update로만 합니다. 조회 후 계산해서 update하는 방식은 금지합니다.
7. 여러 행을 잠그는 함수는 항상 같은 순서(`order by variant_id`)로 처리합니다.
8. 주문 상품 정보(상품명, 옵션명, 단가)는 `order_items`에 스냅샷으로 저장합니다.
9. 상품은 삭제하지 않고 `status = 'hidden'`으로 숨깁니다.

## 4. 도메인 규칙

| 항목 | 규칙 |
|---|---|
| 옵션 | 모든 상품은 1개 이상의 variant를 가짐. 옵션 없는 상품은 `option_name = '기본'` |
| 카테고리 | 앨범, 응원용품, 인형, 액세서리, 의류, 생활용품, 멤버십 7개 고정. 새 카테고리 추가 금지 (사람 확인 필요) |
| 멤버별 굿즈 | 멤버는 별도 테이블 없이 variant의 `option_name`으로 표현 |
| 멤버십 카드 | 일반 상품으로 처리, variant `max_per_user = 1` |
| 아티스트 | ORBIT:ON(`orbit-on`), DAYLOG(`daylog`), SODAFM(`sodafm`) 3개 고정 |
| 이미지 | Storage public 버킷(`products`, `artists`). DB에는 경로만 저장 (`*_path` 컬럼). variant별 이미지 없음 |
| 재고 | variant 단위 |
| 1인 구매 제한 | variant 단위 `max_per_user` (기본 4개, null = 무제한), **paid 주문만 집계** |
| 주문 생성 | `create_order` → pending, 재고 차감 없음, 장바구니 유지 |
| 결제 | `pay_order` → 구매 제한 검증, 재고 차감, paid, 결제된 옵션만 장바구니에서 제거 |
| 취소 | pending: 상태만 변경 / paid: 재고 복구 |
| 비회원 장바구니 | localStorage, 로그인 시 `merge_cart`로 병합 (재고·구매 제한 한도로 수량 보정) |

## 5. 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|---|---|---|
| 테이블 | snake_case 복수형 | `cart_items` |
| 컬럼 | snake_case | `max_per_user` |
| RPC 함수 | 동사_목적어 | `pay_order` |
| 함수 파라미터 | `p_` 접두사 | `p_order_id` |
| 함수 내부 변수 | `v_` 접두사 | `v_uid` |
| RLS 정책 | `테이블_동작_대상` | `orders_select_own` |
| 에러 코드 | 대문자 스네이크 | `OUT_OF_STOCK` |
| 마이그레이션 파일 | `supabase migration new <동사_대상>` | `add_wishlist`, `update_pay_order_limit` |
| services 함수 | camelCase | `payOrder`, `mergeGuestCart` |

## 6. 마이그레이션 작업 절차

```bash
# 1) 새 마이그레이션 생성
npx supabase migration new <name>

# 2) SQL 작성 (DB_DESIGN.md 기준)

# 3) 사람 확인 후 원격 적용
npx supabase db push

# 4) 타입 재생성
npx supabase gen types typescript --linked > src/types/database.ts

# 5) DB_DESIGN.md 반영 + 커밋 (type: db)
```

- 이미 적용된 마이그레이션 파일은 수정하지 않습니다.
- 함수 수정은 새 마이그레이션에서 `create or replace function`으로 합니다.
- **`db push`는 에이전트가 직접 실행하지 않고 사람에게 요청합니다.**

### 초기 마이그레이션 분할

DB_DESIGN.md 6장의 SQL을 아래 순서로 나눠서 커밋합니다.

| 순서 | 파일 이름 | 내용 (DB_DESIGN.md) |
|---|---|---|
| 1 | `init_tables` | 6-1 테이블 + 인덱스 |
| 2 | `profiles_trigger` | 6-2 회원가입 트리거 |
| 3 | `rls_policies` | 6-3 RLS |
| 4 | `rpc_cart` | 6-4 merge_cart |
| 5 | `rpc_orders` | 6-5 create_order, 6-6 pay_order, 6-7 cancel_order |
| 6 | `rpc_grants` | 6-8 실행 권한 |
| 7 | `storage_buckets` | 6-9 Storage 버킷 |
| - | `supabase/seed.sql` | 6-10 초기 데이터 |

## 7. RPC 목록 & 에러 코드

| 함수 | 파라미터 | 반환 | 발생 가능 에러 |
|---|---|---|---|
| `merge_cart` | `p_items jsonb` (`[{variant_id, quantity}]`) | void | NOT_AUTHENTICATED |
| `create_order` | `p_recipient_name`, `p_recipient_phone`, `p_address` | uuid (order_id) | NOT_AUTHENTICATED, CART_EMPTY, UNAVAILABLE_ITEM, PURCHASE_LIMIT_EXCEEDED |
| `create_direct_order` | `p_variant_id`, `p_quantity`, `p_recipient_name`, `p_recipient_phone`, `p_address` | uuid (order_id). 바로 구매: 장바구니와 상관없이 옵션 하나만 주문 (`orders.is_direct = true`, 결제해도 장바구니 유지) | NOT_AUTHENTICATED, INVALID_ORDER, UNAVAILABLE_ITEM, PURCHASE_LIMIT_EXCEEDED |
| `pay_order` | `p_order_id uuid` | void | NOT_AUTHENTICATED, INVALID_ORDER, PURCHASE_LIMIT_EXCEEDED, OUT_OF_STOCK |
| `cancel_order` | `p_order_id uuid` | void | NOT_AUTHENTICATED, INVALID_ORDER, ALREADY_CANCELLED |
| `set_default_address` | `p_address_id bigint` | void | NOT_AUTHENTICATED, INVALID_ADDRESS (→ 앱에서는 UNKNOWN) |

Supabase Auth 에러는 `services/auth.ts`에서 아래 코드로 변환합니다 (RPC 아님).

| 함수 | 코드 |
|---|---|
| `signIn` | INVALID_CREDENTIALS |
| `signUp` | EMAIL_ALREADY_EXISTS, WEAK_PASSWORD |

에러는 `raise exception '<CODE>' using detail = '<부가정보>'` 형태로 던집니다. supabase-js에서는 `error.message`에 코드, `error.details`에 부가정보(variant_id 등)가 들어옵니다. **새 에러 코드를 추가하면 이 표와 `src/services/errors.ts`를 함께 갱신**합니다.

## 8. services 레이어 규칙

- 프론트는 `src/services/`만 import합니다.
- 각 함수는 타입이 지정된 입력/출력을 가지며 `src/types/database.ts`의 타입을 사용합니다.
- Supabase 에러는 그대로 던지지 않고 `errors.ts`에서 앱 에러로 변환합니다.

```ts
// src/services/errors.ts
export const APP_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'CART_EMPTY',
  'UNAVAILABLE_ITEM',
  'PURCHASE_LIMIT_EXCEEDED',
  'OUT_OF_STOCK',
  'INVALID_ORDER',
  'ALREADY_CANCELLED',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_EXISTS',
  'WEAK_PASSWORD',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number] | 'UNKNOWN';

export class AppError extends Error {
  constructor(public code: AppErrorCode, public detail?: string) {
    super(code);
  }
}

export function toAppError(error: { message: string; details?: string | null }) {
  const code = (APP_ERROR_CODES as readonly string[]).includes(error.message)
    ? (error.message as AppErrorCode)
    : 'UNKNOWN';
  return new AppError(code, error.details ?? undefined);
}
```

```ts
// src/services/orders.ts (형태 예시)
export async function payOrder(orderId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('pay_order', { p_order_id: orderId });
  if (error) throw toAppError(error);
}
```

### 이미지 URL

- DB의 `*_path` 값을 프론트에 그대로 넘기지 않고, services에서 공개 URL로 변환해서 반환합니다.

```ts
// src/services/storage.ts
export function getImageUrl(bucket: 'products' | 'artists', path: string | null) {
  if (!path) return null;
  const supabase = createClient();
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
```

### 이미지 업로드 규칙 (2026-10-16~)

- **캐시 1년**: Supabase CLI는 기본값이 `max-age=3600`(1시간)이라 반드시 지정합니다.
  ```bash
  npx supabase storage cp -r --experimental --linked --cache-control "public, max-age=31536000" <로컬 폴더> ss:///products/<경로>
  ```
- **교체는 새 파일명으로**: 캐시가 1년이고 Next 이미지 최적화 캐시도 지울 방법이 없어서, 같은 경로에 덮어쓰면 방문자에게 최대 1년간 예전 이미지가 보입니다. 바꿀 때는 `logo-v2.webp`처럼 새 이름으로 올리고 DB 경로를 마이그레이션으로 바꿉니다. (같은 그림을 용량만 줄여 다시 올릴 때만 덮어쓰기 허용)
- **용량·크기 기준** (webp, 품질 75~80):
  | 종류 | 최대 크기(px) | 용량 기준 |
  |---|---|---|
  | 상품 대표(`main.webp`) | 720 × 720 | 60KB 이하 |
  | 상품 상세(`detail-N.webp`) | 가로 1080 | 150KB 이하 |
  | 아티스트 대표 사진(`hero`) | 가로 1920 | 250KB 이하 |

### 장바구니 (services/cart.ts) 요구사항

- 로그인 여부에 따라 같은 인터페이스로 동작: `getCart()`, `addToCart(variantId, qty)`, `updateQuantity(...)`, `removeFromCart(...)`
- 비회원: localStorage 키 `guest_cart`, 형식 `{ variant_id: number; quantity: number }[]`
- 로그인 직후(`onAuthStateChange`의 `SIGNED_IN`) `mergeGuestCart()` 호출 → `merge_cart` RPC 성공 시 localStorage 비우기
- 병합 실패 시 localStorage를 지우지 않음 (다음 로그인 때 재시도 가능)
- 담기 단계의 재고·구매 제한 체크는 UX 안내용이며, 최종 검증은 `pay_order`가 담당

## 9. 백엔드 작업 마일스톤

| 단계 | 작업 | 완료 기준 |
|---|---|---|
| B1 | 테이블·인덱스·트리거 마이그레이션 | 회원가입 시 profiles 자동 생성 확인 |
| B2 | RLS 정책 | anon으로 hidden 상품 안 보임, 타인 장바구니·주문 조회 불가 |
| B3 | seed 데이터 | 3개 그룹, 고정 카테고리 7개, 옵션 있는/없는 상품 각각 존재 |
| B4 | RPC (cart, orders) | 8장 테스트 시나리오 통과 |
| B5 | 타입 생성 + services 레이어 | 프론트가 services만으로 전체 흐름 구현 가능 |
| B6 | 비회원 장바구니 + 병합 | 비회원 담기 → 로그인 → 서버 장바구니에 합쳐짐 |

## 10. 테스트 시나리오

RPC 작업 후 아래를 확인합니다 (SQL Editor 또는 테스트 계정 2개로 앱에서).

- [ ] 장바구니가 비어 있으면 `create_order`가 `CART_EMPTY`
- [ ] 주문 생성 후 재고가 줄지 않음
- [ ] 결제 후 재고가 정확히 차감되고 장바구니에서 해당 옵션만 사라짐
- [ ] 같은 주문 `pay_order` 두 번 호출 시 두 번째는 `INVALID_ORDER`
- [ ] `max_per_user = 3`인 옵션: 2개 결제 후 2개 추가 결제 시 `PURCHASE_LIMIT_EXCEEDED`
- [ ] 취소된 주문은 구매 제한 집계에서 제외됨
- [ ] 재고 1개 옵션을 두 계정이 각각 주문 → 먼저 결제한 쪽만 성공, 나머지 `OUT_OF_STOCK`
- [ ] 결제 실패 시 재고·주문 상태가 하나도 바뀌지 않음 (롤백)
- [ ] paid 주문 취소 시 재고 복구, pending 취소 시 재고 변화 없음
- [ ] 다른 사람의 order_id로 `pay_order` / `cancel_order` 호출 시 `INVALID_ORDER`
- [ ] `merge_cart`: 서버에 2개 있는 옵션에 비회원 2개 병합 시 합산, 단 제한·재고 초과분은 잘림
- [ ] 클라이언트에서 `orders`에 직접 insert 시도 → RLS로 거부

## 11. 에이전트 체크리스트

작업 시작 전

- [ ] `docs/SETUP.md`, `docs/BACKEND.md`, `docs/DB_DESIGN.md`를 읽었다
- [ ] 연결된 이슈 번호와 작업 범위를 확인했다
- [ ] `dev/<이름>` 브랜치에서 작업 중이고, `origin/develop`을 머지해 최신 상태로 맞췄다

작업 중

- [ ] 담당 영역(1장) 밖의 파일은 수정하지 않았다
- [ ] 3장 원칙을 위반하는 정책·코드를 추가하지 않았다
- [ ] DB_DESIGN.md에 없는 테이블·컬럼을 추가하려면 먼저 사람에게 확인했다

작업 후

- [ ] 마이그레이션은 새 파일로 추가했다
- [ ] 타입 재생성, DB_DESIGN.md, 7장 에러 표를 갱신했다
- [ ] 커밋 메시지가 컨벤션을 따른다
- [ ] PR 템플릿의 DB 변경 체크리스트를 채웠다
- [ ] `db push`가 필요하면 PR 설명에 명시하고 사람에게 요청했다