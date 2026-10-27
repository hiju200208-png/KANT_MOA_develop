import type { Cart, CartItem } from '@/types/app';
import { ApiError, apiAssetUrl, apiFetch, isLoggedIn, jsonBody } from './api';
import { AppError } from './errors';

// 비회원 장바구니: localStorage. 로그인: FastAPI /cart (P3). 같은 함수로 동작
const GUEST_KEY = 'guest_cart';
type GuestCartItem = { variant_id: number; quantity: number };

function readGuest(): GuestCartItem[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeGuest(items: GuestCartItem[]) {
  try {
    if (items.length) localStorage.setItem(GUEST_KEY, JSON.stringify(items));
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // 저장 불가(사생활 보호 모드 등) → 이번 화면에서만 유지
  }
}

// FastAPI 장바구니 응답 (snake_case)
type CartItemResponse = {
  variant_id: number;
  quantity: number;
  product: { id: number; name: string; thumbnail_url: string | null };
  option_name: string;
  unit_price: number;
  stock: number;
  max_per_user: number | null;
  is_available: boolean;
};
type CartResponse = { items: CartItemResponse[]; total_quantity: number; total_price: number };

const toItem = (i: CartItemResponse): CartItem => ({
  variantId: i.variant_id,
  quantity: i.quantity,
  product: { id: i.product.id, name: i.product.name, thumbnailUrl: apiAssetUrl(i.product.thumbnail_url) },
  optionName: i.option_name,
  unitPrice: i.unit_price,
  stock: i.stock,
  maxPerUser: i.max_per_user,
  isAvailable: i.is_available,
});

const toCart = (c: CartResponse): Cart => ({
  items: c.items.map(toItem),
  totalQuantity: c.total_quantity,
  totalPrice: c.total_price,
});

// 비회원 장바구니·바로 구매: 저장하지 않고 옵션 정보만 장바구니 모양으로 받는다 (없거나 숨김이면 빠짐)
const preview = (items: GuestCartItem[]) =>
  apiFetch<CartResponse>('/cart/preview', { method: 'POST', ...jsonBody({ items }) }).then(toCart);

export async function getCart(): Promise<Cart> {
  if (isLoggedIn()) {
    try {
      return toCart(await apiFetch<CartResponse>('/cart'));
    } catch (error) {
      // 저장된 토큰이 만료·로그아웃(401)이면 장바구니·헤더 뱃지가 깨지지 않게 비회원 장바구니로 보여준다 (토큰 정리는 로그인 쪽)
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  }
  const guest = readGuest();
  if (!guest.length) return { items: [], totalQuantity: 0, totalPrice: 0 };
  return preview(guest);
}

// 바로 구매 주문서용: 장바구니에 담지 않고 옵션 하나를 장바구니 항목 모양으로 불러온다. 없거나 숨김이면 null
export async function getDirectItem(variantId: number, quantity: number): Promise<CartItem | null> {
  const cart = await preview([{ variant_id: variantId, quantity }]);
  return cart.items[0] ?? null;
}

// 비회원 담기 단계 체크 (안내용). 회원은 서버가 같은 규칙으로 검사하고, 최종 검증은 결제가 한다
async function checkGuestQuantity(variantId: number, quantity: number) {
  const item = await getDirectItem(variantId, quantity);
  if (!item) throw new AppError('UNAVAILABLE_ITEM', String(variantId));
  if (quantity > item.stock) throw new AppError('OUT_OF_STOCK', String(variantId));
  if (!item.isAvailable) throw new AppError('UNAVAILABLE_ITEM', String(variantId)); // 판매 중 아님
  if (item.maxPerUser != null && quantity > item.maxPerUser) {
    throw new AppError('PURCHASE_LIMIT_EXCEEDED', String(variantId));
  }
}

// 이미 있으면 제자리에서 수량만 변경, 없으면 끝에 추가
function setGuestQuantity(variantId: number, quantity: number) {
  const guest = readGuest();
  const exists = guest.some((g) => g.variant_id === variantId);
  writeGuest(
    exists
      ? guest.map((g) => (g.variant_id === variantId ? { ...g, quantity } : g))
      : [...guest, { variant_id: variantId, quantity }],
  );
}

export async function addToCart(variantId: number, quantity: number): Promise<Cart> {
  if (isLoggedIn()) {
    // 같은 옵션이면 서버가 수량을 더한다
    return toCart(
      await apiFetch<CartResponse>('/cart/items', { method: 'POST', ...jsonBody({ variant_id: variantId, quantity }) }),
    );
  }
  const current = readGuest().find((g) => g.variant_id === variantId)?.quantity ?? 0;
  await checkGuestQuantity(variantId, current + quantity);
  setGuestQuantity(variantId, current + quantity);
  return getCart();
}

export async function updateQuantity(variantId: number, quantity: number): Promise<Cart> {
  if (isLoggedIn()) {
    return toCart(
      await apiFetch<CartResponse>(`/cart/items/${variantId}`, { method: 'PATCH', ...jsonBody({ quantity }) }),
    );
  }
  await checkGuestQuantity(variantId, quantity);
  setGuestQuantity(variantId, quantity);
  return getCart();
}

export async function removeFromCart(variantId: number): Promise<Cart> {
  if (isLoggedIn()) {
    try {
      return toCart(await apiFetch<CartResponse>(`/cart/items/${variantId}`, { method: 'DELETE' }));
    } catch (error) {
      // 이미 빠진 줄(빠른 두 번 클릭 등)은 오류 없이 현재 장바구니를 돌려준다 (API_SPEC: removeFromCart 에러 없음)
      if (!(error instanceof ApiError && error.status === 404)) throw error;
      return getCart();
    }
  }
  writeGuest(readGuest().filter((g) => g.variant_id !== variantId));
  return getCart();
}

// 로그인 직후 호출 (auth.onAuthChange가 자동 호출). 실패 시 localStorage 유지 → 다음 로그인 때 재시도
export async function mergeGuestCart(): Promise<void> {
  const guest = readGuest();
  if (!guest.length || !isLoggedIn()) return;
  try {
    await apiFetch<CartResponse>('/cart/merge', { method: 'POST', ...jsonBody({ items: guest }) });
    writeGuest([]);
  } catch {
    // 서버가 전체 rollback했으므로 브라우저 장바구니를 그대로 둔다
  }
}
