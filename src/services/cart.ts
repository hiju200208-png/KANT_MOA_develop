import { createClient } from '@/lib/supabase/client';
import type { Cart, CartItem } from '@/types/app';
import { AppError, toAppError } from './errors';
import { getImageUrl } from './storage';

// 비회원 장바구니: localStorage. 로그인: cart_items 테이블. 같은 함수로 동작
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

async function getUserId() {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}

const VARIANT_COLUMNS =
  'id, option_name, extra_price, stock, max_per_user, products(id, name, price, status, thumbnail_path)';

type VariantRow = {
  id: number;
  option_name: string;
  extra_price: number;
  stock: number;
  max_per_user: number | null;
  products: { id: number; name: string; price: number; status: string; thumbnail_path: string | null };
};

const toItem = (v: VariantRow, quantity: number): CartItem => ({
  variantId: v.id,
  quantity,
  product: {
    id: v.products.id,
    name: v.products.name,
    thumbnailUrl: getImageUrl('products', v.products.thumbnail_path),
  },
  optionName: v.option_name,
  unitPrice: v.products.price + v.extra_price,
  stock: v.stock,
  maxPerUser: v.max_per_user,
  isAvailable: v.products.status === 'on_sale' && v.stock >= quantity,
});

function toCart(items: CartItem[]): Cart {
  return {
    items,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    totalPrice: items.filter((i) => i.isAvailable).reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
  };
}

export async function getCart(): Promise<Cart> {
  const supabase = createClient();

  if (await getUserId()) {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`quantity, product_variants(${VARIANT_COLUMNS})`)
      .order('created_at');
    if (error) throw toAppError(error);
    const rows = data as unknown as { quantity: number; product_variants: VariantRow | null }[];
    // 숨김 상품은 RLS로 variant가 null → 화면에서 제외
    return toCart(rows.filter((r) => r.product_variants).map((r) => toItem(r.product_variants!, r.quantity)));
  }

  const guest = readGuest();
  if (!guest.length) return toCart([]);
  const { data, error } = await supabase
    .from('product_variants')
    .select(VARIANT_COLUMNS)
    .in('id', guest.map((g) => g.variant_id));
  if (error) throw toAppError(error);
  const byId = new Map((data as unknown as VariantRow[]).map((v) => [v.id, v]));
  return toCart(guest.filter((g) => byId.has(g.variant_id)).map((g) => toItem(byId.get(g.variant_id)!, g.quantity)));
}

// 담기 단계 체크는 안내용. 최종 검증은 pay_order
async function checkQuantity(variantId: number, quantity: number, userId: string | null) {
  const supabase = createClient();
  const { data: v, error } = await supabase
    .from('product_variants')
    .select('stock, max_per_user, products(status)')
    .eq('id', variantId)
    .maybeSingle();
  if (error) throw toAppError(error);
  if (!v || v.products?.status !== 'on_sale') throw new AppError('UNAVAILABLE_ITEM', String(variantId));
  if (quantity > v.stock) throw new AppError('OUT_OF_STOCK', String(variantId));
  if (v.max_per_user == null) return;

  let bought = 0;
  if (userId) {
    const { data: paid, error: paidError } = await supabase
      .from('order_items')
      .select('quantity, orders!inner(status)')
      .eq('variant_id', variantId)
      .eq('orders.status', 'paid');
    if (paidError) throw toAppError(paidError);
    bought = paid.reduce((sum, r) => sum + r.quantity, 0);
  }
  if (bought + quantity > v.max_per_user) throw new AppError('PURCHASE_LIMIT_EXCEEDED', String(variantId));
}

async function setQuantity(variantId: number, quantity: number, userId: string | null) {
  if (userId) {
    const { error } = await createClient()
      .from('cart_items')
      .upsert({ user_id: userId, variant_id: variantId, quantity }, { onConflict: 'user_id,variant_id' });
    if (error) throw toAppError(error);
    return;
  }
  // 이미 있으면 제자리에서 수량만 변경, 없으면 끝에 추가
  const guest = readGuest();
  const exists = guest.some((g) => g.variant_id === variantId);
  writeGuest(
    exists
      ? guest.map((g) => (g.variant_id === variantId ? { ...g, quantity } : g))
      : [...guest, { variant_id: variantId, quantity }],
  );
}

export async function addToCart(variantId: number, quantity: number): Promise<Cart> {
  const userId = await getUserId();
  const current = (await getCart()).items.find((i) => i.variantId === variantId)?.quantity ?? 0;
  await checkQuantity(variantId, current + quantity, userId);
  await setQuantity(variantId, current + quantity, userId);
  return getCart();
}

export async function updateQuantity(variantId: number, quantity: number): Promise<Cart> {
  const userId = await getUserId();
  await checkQuantity(variantId, quantity, userId);
  await setQuantity(variantId, quantity, userId);
  return getCart();
}

export async function removeFromCart(variantId: number): Promise<Cart> {
  if (await getUserId()) {
    const { error } = await createClient().from('cart_items').delete().eq('variant_id', variantId);
    if (error) throw toAppError(error);
  } else {
    writeGuest(readGuest().filter((g) => g.variant_id !== variantId));
  }
  return getCart();
}

// 로그인 직후 호출 (auth.onAuthChange가 자동 호출). 실패 시 localStorage 유지 → 다음 로그인 때 재시도
export async function mergeGuestCart(): Promise<void> {
  const guest = readGuest();
  if (!guest.length) return;
  const { error } = await createClient().rpc('merge_cart', { p_items: guest });
  if (!error) writeGuest([]);
}
