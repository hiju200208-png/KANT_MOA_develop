# API 명세 (services 레이어)

> 프론트가 호출하는 유일한 데이터 인터페이스는 `src/services/`입니다. 이 문서는 그 함수들의 입력·출력·에러를 정의합니다.
> 별도 REST API는 없습니다. 내부적으로는 Supabase(`from().select()`, `rpc()`)를 호출합니다.
> 스키마·RPC 원본은 `docs/DB_DESIGN.md`, 백엔드 규칙은 `docs/BACKEND.md`를 따릅니다.
> 상태: **확정 (v1.2, 리디자인 요청 반영: 배지·검색·인기·찜·메인 배너·공지·쇼핑몰 설정·배송비)** — 프론트 3명 리뷰 완료. 변경 시 이 문서를 먼저 고치고 PR에서 프론트 담당자를 리뷰어로 지정합니다.

## 0. 공통 규칙

- 반환 객체의 필드는 **camelCase**입니다 (DB의 snake_case는 services에서 변환).
- 이미지는 Storage 경로가 아니라 **공개 URL**(`string | null`)로 반환합니다.
- 가격은 원 단위 정수(`number`)입니다. 화면 표시용 합계는 services가 계산해 주지만, **실제 결제 금액은 DB(`create_order`)가 계산**합니다.
- 실패 시 `AppError`를 던집니다 (`error.code`로 분기, 메시지 변환은 `src/constants/error-messages.ts`).
- 조회 함수에서 대상이 없으면 에러가 아니라 `null`을 반환합니다.
- "호출 위치" — `서버`: 서버 컴포넌트에서 호출 가능, `클라이언트`: `'use client'` 컴포넌트에서 호출.

## 1. 공용 타입

```ts
// src/types/app.ts (백엔드가 작성, 프론트는 import만)

type ProductStatus = 'on_sale' | 'sold_out';          // hidden은 조회되지 않음
type OrderStatus = 'pending' | 'paid' | 'cancelled';

type Artist = {
  id: number;
  name: string;          // 'ORBIT:ON'
  nameKo: string;        // '오르빗온'
  slug: string;          // 'orbit-on'
  logoUrl: string | null;
  heroImageUrl: string | null;  // 아티스트 페이지 상단 배경 (1920×720)
  themeColor: string | null;
};

type ArtistMember = {
  id: number;
  name: string;          // '선우' (상품 옵션명과 동일)
  nameEn: string;        // 'SUNWOO'
  position: string | null;
  color: string | null;  // 멤버 컬러 '#FF8A3D'
  mascot: string | null;
  birthday: string | null;       // 'YYYY-MM-DD'
  mbti: string | null;
  description: string | null;    // 한 줄 소개
  tags: string[];                // 해시태그 ('#' 없이)
  imageUrl: string | null;       // 정사각형 1080×1080
};

type Category = {
  id: number;
  name: string;          // '앨범'
  slug: string;          // 'album'
};

type ProductSummary = {
  id: number;
  name: string;
  price: number;                 // 기본가 (옵션 추가금 제외)
  status: ProductStatus;
  isSoldOut: boolean;            // status === 'sold_out' 이거나 모든 옵션 재고 0
  thumbnailUrl: string | null;
  artist: Pick<Artist, 'slug' | 'name' | 'nameKo'>;
  category: Pick<Category, 'slug' | 'name'>;
};

type Variant = {
  id: number;
  optionName: string;            // '리온', 'M', 'A버전', '기본'
  extraPrice: number;
  price: number;                 // 상품 기본가 + extraPrice
  stock: number;
  maxPerUser: number | null;     // 기본 4 (null = 무제한, 현재 없음)
  isSoldOut: boolean;            // stock === 0
};

type ProductDetail = ProductSummary & {
  description: string | null;
  imageUrls: string[];           // 상세 이미지 (sort_order 순)
  variants: Variant[];           // 1개 이상. 옵션 없는 상품은 optionName '기본' 1개
  hasOptions: boolean;           // variants가 '기본' 1개뿐이면 false → 옵션 선택 UI 숨김
};

type CartItem = {
  variantId: number;
  quantity: number;
  product: Pick<ProductSummary, 'id' | 'name' | 'thumbnailUrl'>;
  optionName: string;
  unitPrice: number;             // 현재 가격 (기본가 + 추가금)
  stock: number;
  maxPerUser: number | null;
  isAvailable: boolean;          // 판매 중이고 재고 >= quantity
};

type Cart = {
  items: CartItem[];
  totalQuantity: number;         // 헤더 뱃지용
  totalPrice: number;            // 표시용 (isAvailable 항목만 합산)
};

type OrderItem = {
  variantId: number;
  productName: string;           // 주문 당시 스냅샷
  optionName: string;            // 주문 당시 스냅샷
  unitPrice: number;             // 주문 당시 스냅샷
  quantity: number;
};

type OrderSummary = {
  id: string;                    // uuid
  status: OrderStatus;
  totalPrice: number;
  itemCount: number;
  firstItemName: string;         // 목록 표시용: "아크릴 키링 외 2건"
  createdAt: string;             // ISO
};

type Order = OrderSummary & {
  recipientName: string;
  recipientPhone: string;
  address: string;
  paidAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
};

type Profile = {
  id: string;
  email: string;
  nickname: string;
  phone: string | null;
};
```

## 2. 카탈로그 — `services/artists.ts` · `services/products.ts`

`getArtists`·`getArtist`·`getArtistBanners`·`getArtistMembers`는 `services/artists.ts`, 나머지(카테고리·상품·검색·인기·홈 배너)는 `services/products.ts`.

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getArtists()` | - | `Artist[]` (sort_order 순) | 서버 | - |
| `getArtist(slug)` | `string` | `Artist \| null` | 서버 | - |
| `getArtistBanners(slug)` | `string` | `ArtistPromoBanner[]` (sort_order 순, 등록된 배너 없으면 빈 배열 → 화면은 hero + 최신 상품으로 구성) | 서버 | - |
| `getArtistMembers(slug)` | `string` | `ArtistMember[]` (sort_order 순, 없는 slug면 빈 배열) | 서버 | - |
| `getCategories()` | - | `Category[]` (sort_order 순, 7개) | 서버 | - |
| `getProducts(params?)` | `ProductQuery` | `{ items: ProductSummary[]; total: number }` | 서버 | - |
| `getProduct(id)` | `number` | `ProductDetail \| null` (`galleryUrls` 상단 갤러리, `detailUrls` 아래 상세. `imageUrls` = `detailUrls`) | 서버 | - |
| `searchProducts(params)` | `{ q; limit?; offset? }` | `ProductList` (상품명·아티스트명 영문/한글 부분 일치, 최신순. 빈 검색어는 빈 결과) | 서버/클라이언트 | - |
| `getBestProducts(params?)` | `{ days? = 7; limit? = 8; artistSlug? }` | `BestProduct[]` (= `ProductSummary & { rank }`. 최근 days일 결제 수량 순, 판매 없으면 최신순으로 채움) | 서버 | - |
| `getHomeBanners()` | - | `{ main: HomeBanner[]; side: HomeBanner[] }` (활성 + 노출 기간 안, sort_order 순. 없으면 빈 배열) | 서버 | - |

```ts
type ProductQuery = {
  artistSlug?: string;
  categorySlug?: string;
  sort?: 'latest' | 'price_asc' | 'price_desc';   // 기본 'latest'
  limit?: number;                                 // 기본 20
  offset?: number;                                // 기본 0
  excludeId?: number;                             // 이 상품 제외 (상세의 '함께 보면 좋은 굿즈')
};
```

- `ProductSummary`에 배지 값 포함: `isLimited`(한정), `isPreorder`(예약 판매), `releaseDate`('YYYY-MM-DD' | null), `createdAt`(NEW 배지는 프론트에서 계산).
- `Artist`에 `tagline`(섹션 한 줄 소개, 없으면 null).

- 화면 매핑: 메인(`getArtists`, `getProducts({ limit: 8 })`), 아티스트 페이지(`getArtist` + `getProducts({ artistSlug })`), 카테고리 페이지(`getProducts({ categorySlug })`), 상품 상세(`getProduct`).
- hidden 상품, 없는 id → `null` (상세 페이지는 `notFound()` 처리).

## 3. 인증·회원 — `services/auth.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `signUp(input)` | `{ email; password; nickname }` | `void` | 클라이언트 | `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD` |
| `signIn(input)` | `{ email; password }` | `void` | 클라이언트 | `INVALID_CREDENTIALS` |
| `signOut()` | - | `void` | 클라이언트 | - |
| `getProfile()` | - | `Profile \| null` (비로그인 시 null) | 클라이언트 | - |
| `updateProfile(input)` | `{ nickname?; phone? }` | `Profile` | 클라이언트 | `NOT_AUTHENTICATED` |
| `onAuthChange(cb)` | `(profile: Profile \| null) => void` | `() => void` (구독 해제) | 클라이언트 | - |

- 로그인 직후 비회원 장바구니 병합(`mergeGuestCart`)은 **services 내부에서 자동 처리**합니다. 프론트는 앱 최상단 클라이언트 Provider에서 `onAuthChange`를 한 번 구독만 하면 됩니다.
- 로그인이 필요한 함수(auth·cart·orders)는 **클라이언트 컴포넌트 전용**입니다. 세션은 브라우저 클라이언트가 자동 갱신하므로 현재 `src/proxy.ts`는 없습니다. 서버 컴포넌트에서 로그인 정보가 필요해지면 백엔드에 요청하세요 (server.ts + proxy.ts 추가).
- **이메일 인증 OFF**: 가입 즉시 로그인 상태가 됩니다 (`signUp` 성공 = 로그인 완료). 운영 전 재검토.

## 4. 장바구니 — `services/cart.ts`

로그인 여부와 관계없이 **같은 함수**를 호출합니다. 비로그인이면 localStorage(`guest_cart`), 로그인이면 `cart_items` 테이블을 사용합니다. 모든 항목은 `variantId`로 식별합니다.

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getCart()` | - | `Cart` | 클라이언트 | - |
| `addToCart(variantId, quantity)` | `number, number` | `Cart` | 클라이언트 | `OUT_OF_STOCK`, `PURCHASE_LIMIT_EXCEEDED`, `UNAVAILABLE_ITEM` |
| `updateQuantity(variantId, quantity)` | `number, number` (1 이상) | `Cart` | 클라이언트 | `OUT_OF_STOCK`, `PURCHASE_LIMIT_EXCEEDED` |
| `removeFromCart(variantId)` | `number` | `Cart` | 클라이언트 | - |
| `mergeGuestCart()` | - | `void` | (내부용) | - |

- `addToCart`: 이미 담긴 옵션이면 수량을 **더합니다**.
- 담기·수량 변경 시 재고/구매 제한 체크는 **안내용**입니다. 비회원은 `maxPerUser`와 장바구니 수량만 비교하고, 회원은 지난 결제 수량까지 포함합니다. 최종 검증은 `payOrder`가 합니다.
- 변경 함수는 갱신된 `Cart` 전체를 반환하므로, 별도로 `getCart()`를 다시 부를 필요가 없습니다.
- 숨김 처리된 상품이 비회원 장바구니에 남아 있으면 `getCart()`에서 자동으로 제외합니다.
- `mergeGuestCart`: `merge_cart` RPC 호출. 성공 시 localStorage 비움, 실패 시 유지 (다음 로그인 때 재시도).

## 5. 주문·결제 — `services/orders.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `createOrder(input)` | `{ recipientName; recipientPhone; address }` | `string` (orderId) | 클라이언트 | `NOT_AUTHENTICATED`, `CART_EMPTY`, `UNAVAILABLE_ITEM`, `PURCHASE_LIMIT_EXCEEDED` |
| `payOrder(orderId)` | `string` | `void` | 클라이언트 | `NOT_AUTHENTICATED`, `INVALID_ORDER`, `PURCHASE_LIMIT_EXCEEDED`, `OUT_OF_STOCK` |
| `cancelOrder(orderId)` | `string` | `void` | 클라이언트 | `NOT_AUTHENTICATED`, `INVALID_ORDER`, `ALREADY_CANCELLED` |
| `getOrders()` | - | `OrderSummary[]` (최신순) | 클라이언트 | `NOT_AUTHENTICATED` |
| `getOrder(orderId)` | `string` | `Order \| null` (남의 주문이면 null) | 클라이언트 | `NOT_AUTHENTICATED` |

- `createOrder`는 **현재 장바구니 전체**를 주문합니다 (선택 주문 없음).
- 주문서 "결제하기" 흐름: `createOrder` → `payOrder` → `/orders/{id}` (결제 완료) 이동.
- `payOrder`가 실패하면 주문은 `pending`으로 남고, 장바구니도 그대로 유지됩니다. 주문 상세에서 "다시 결제" 또는 "취소"를 할 수 있습니다.
- 결제 성공 시 결제된 옵션만 장바구니에서 빠집니다.
- 취소: `pending` → 상태만 변경, `paid` → 재고 복구. 버튼 노출 조건은 `status !== 'cancelled'`.
- **배송비**: 상품 금액이 `shop_settings.free_shipping_threshold`(5만 원) 미만이면 `shipping_fee`(3,000원)를 더해 주문합니다 (DB `create_order`에서 계산). `Order.totalPrice` = 실제 결제 금액(상품 + 배송비), `itemsPrice`·`shippingFee`는 따로 제공. 장바구니·주문서 표시는 `getShopSettings()` + `calcShippingFee(itemsPrice, settings)`로 같은 규칙을 계산합니다.

## 5-0. 찜 — `services/wishlist.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getWishlist()` | - | `ProductSummary[]` (최근 찜한 순, 판매 종료 상품 제외) | 클라이언트 | `NOT_AUTHENTICATED` |
| `getWishedIds()` | - | `number[]` (카드 여러 개의 하트 상태를 한 번에. 비로그인은 빈 배열) | 클라이언트 | - |
| `isWished(productId)` | `number` | `boolean` (비로그인은 false) | 클라이언트 | - |
| `toggleWishlist(productId)` | `number` | `boolean` (바뀐 뒤 상태, true = 찜함) | 클라이언트 | `NOT_AUTHENTICATED` |

## 5-3. 공지 — `services/notices.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getNotices(params?)` | `{ artistSlug?; limit? = 20 }` | `Notice[]` (상단 고정 먼저, 최신순. artistSlug가 있으면 그 아티스트 공지만) | 서버 | - |
| `getNotice(id, artistSlug?)` | `number, string?` | `Notice \| null` (다른 아티스트 공지면 null) | 서버 | - |
| `getTopbarNotice()` | - | `Notice \| null` (맨 위 공지 띠) | 서버 | - |

- `Notice.body`는 줄 배열 (`src/mocks/notices.ts`와 같은 규칙: `## ` 섹션, `- ` 목록, `※ ` 주의, `< >` 소제목). `isNew`는 게시 7일 이내.

## 5-4. 쇼핑몰 설정 — `services/settings.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getShopSettings()` | - | `ShopSettings` (배송비 기준·금액, 출고 안내, 사업자 정보) | 서버 | - |
| `calcShippingFee(itemsPrice, settings)` | `number, ShopSettings` | `number` (표시용. 0원 장바구니는 0) | 어디서나 | - |

## 5-1. 배송지 — `services/addresses.ts`

```ts
type Address = {
  id: number;
  label: string | null;          // '집', '회사'
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;              // 기본주소
  address2: string | null;       // 상세주소
  isDefault: boolean;
};
type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };
```

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `getAddresses()` | - | `Address[]` (기본 배송지 맨 앞, 나머지 최신순) | 클라이언트 | `NOT_AUTHENTICATED` |
| `createAddress(input)` | `AddressInput` | `Address` | 클라이언트 | `NOT_AUTHENTICATED` |
| `updateAddress(id, input)` | `number, AddressInput` | `Address` | 클라이언트 | `NOT_AUTHENTICATED` |
| `deleteAddress(id)` | `number` | `void` | 클라이언트 | `NOT_AUTHENTICATED` |
| `setDefaultAddress(id)` | `number` | `void` | 클라이언트 | `NOT_AUTHENTICATED` |

- 기본 배송지는 사용자당 항상 1개입니다 (주소가 1개 이상일 때).
  - 첫 주소는 `isDefault`와 관계없이 자동으로 기본 배송지가 됩니다.
  - 기본 배송지를 삭제하면 남은 주소 중 최신 주소가 기본이 됩니다.
  - `isDefault: true`로 생성·수정하면 기존 기본 배송지는 자동 해제됩니다. `isDefault: false`는 무시합니다 (기본 해제는 다른 주소를 기본으로 지정해서).
- 주문은 기존처럼 주소 문자열을 받습니다: `createOrder({ ..., address: \`${address1} ${address2 ?? ''}\`.trim() })`. 주소록을 고쳐도 지난 주문 배송지는 바뀌지 않습니다.
- 남의 주소 id를 넘기면 수정·삭제는 아무 일도 일어나지 않고, `setDefaultAddress`/`updateAddress`는 `UNKNOWN` 에러를 던집니다 (화면에서 남의 id를 넘길 일은 없음).

## 5-2. AI 챗봇 — `services/chat.ts`

| 함수 | 입력 | 반환 | 호출 위치 | 에러 |
|---|---|---|---|---|
| `askKantBot(message, history)` | `string`(1~500자), `{ role: 'user' \| 'bot'; text }[]` (이번 질문 이전 대화) | `string` (답변) | 클라이언트 | 실패 시 `Error` throw → 화면에서 키워드 답변으로 대체 |

- 내부적으로 `POST /api/chat` → `src/lib/kantbot.ts` → Gemini(`gemini-3.5-flash`, 한도 초과 시 `gemini-3.5-flash-lite`).
- 답변 근거: DB 상품 목록(이름·가격·옵션·품절·구매 제한, 5분 캐시) + 쇼핑몰 정책. 상품 추천 시 `상품 페이지: /products/{id}` 형식으로 링크를 붙임.
- **개인정보·주문 정보는 AI에 보내지 않음** (Gemini 무료 티어는 입력이 학습·사람 검토에 쓰일 수 있음). 주문 조회 질문엔 마이페이지 안내.
- 제한: 질문 500자, 이전 대화 최근 10개, IP당 1분 10회.

`/api/chat` 응답

| HTTP | 본문 | 의미 |
|---|---|---|
| 200 | `{ reply: string }` | 정상 |
| 400 | `{ error: 'INVALID_INPUT' }` | 빈 질문, 500자 초과, 형식 오류 |
| 429 | `{ error: 'RATE_LIMITED' }` | 1분 10회 초과 |
| 503 | `{ error: 'AI_UNAVAILABLE' }` | Gemini 한도 초과·장애 |

## 6. 에러 코드 — `services/errors.ts`

```ts
class AppError extends Error {
  code: AppErrorCode;
  detail?: string;    // OUT_OF_STOCK, PURCHASE_LIMIT_EXCEEDED → 문제된 variantId
}
```

| 코드 | 발생 함수 | 화면 처리 |
|---|---|---|
| `NOT_AUTHENTICATED` | 주문·프로필·배송지 전체 | 로그인 페이지로 이동 (`?next=` 현재 경로) |
| `CART_EMPTY` | createOrder | "장바구니가 비어 있어요" → 장바구니로 |
| `UNAVAILABLE_ITEM` | createOrder, addToCart | 판매 중지·재고 부족 상품 포함 → 장바구니 확인 유도 |
| `PURCHASE_LIMIT_EXCEEDED` | createOrder, payOrder, addToCart, updateQuantity | 옵션당 구매 한도 초과 (`detail` = variantId) |
| `OUT_OF_STOCK` | payOrder, addToCart, updateQuantity | 품절 (`detail` = variantId) |
| `INVALID_ORDER` | payOrder, cancelOrder | 결제/취소할 수 없는 주문 |
| `ALREADY_CANCELLED` | cancelOrder | 이미 취소된 주문 |
| `INVALID_CREDENTIALS` | signIn | 이메일 또는 비밀번호 오류 |
| `EMAIL_ALREADY_EXISTS` | signUp | 이미 가입된 이메일 |
| `WEAK_PASSWORD` | signUp | 비밀번호 규칙 미달 |
| `UNKNOWN` | 전체 | "잠시 후 다시 시도해주세요" |

`INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `WEAK_PASSWORD`는 RPC가 아니라 Supabase Auth 에러를 변환한 코드입니다.

## 7. 페이지별 사용 함수

| 페이지 | 담당 | 사용 함수 |
|---|---|---|
| 칸트봇 (전체 화면 공통) | sungho | `askKantBot` (`components/chatbot/kantBotReply.ts` 경유) |
| 공통 헤더 | jina | `getProfile`, `onAuthChange`, `getCart().totalQuantity`, `getArtists`, `getCategories` |
| 로그인 / 회원가입 | jina | `signIn`, `signUp` |
| 메인 | chungman | `getArtists`, `getProducts` |
| 아티스트 `/artists/[slug]` | chungman | `getArtist`, `getArtistMembers`, `getProducts({ artistSlug })` |
| 카테고리 `/category/[slug]` | chungman | `getCategories`, `getProducts({ categorySlug })` |
| 상품 상세 `/products/[id]` | chungman | `getProduct`, `addToCart` (`useCart` 경유) |
| 장바구니 | sungho | `getCart`, `updateQuantity`, `removeFromCart` |
| 주문서 | sungho | `getCart`, `getProfile`, `getAddresses`, `createOrder`, `payOrder` |
| 결제 완료 / 주문 상세 | sungho | `getOrder`, `payOrder`, `cancelOrder` |
| 주문 내역 | sungho | `getOrders` |
| 마이페이지 | sungho | `getProfile`, `updateProfile`, `getAddresses`, `createAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress` |

## 8. 결정된 기본 방침 (필요해지면 변경 요청)

1. **`UNAVAILABLE_ITEM`의 detail**: 현재 RPC는 어떤 상품이 문제인지 알려주지 않습니다. 필요하면 `create_order`에 `detail = variant_id` 추가.
2. **주문서 배송 정보 기본값**: 기본 배송지(`getAddresses()[0]`)로 자동 입력. 주문에는 주소 문자열 스냅샷 저장 (5-1장).
3. **목록 페이지네이션**: limit/offset 방식(더보기 버튼)으로 충분한지.
4. **`sold_out` 표시**: `status`는 대시보드에서 수동 관리. 재고가 0이 되어도 자동 변경되지 않으므로 `isSoldOut`(재고 기반)을 화면 기준으로 사용.
