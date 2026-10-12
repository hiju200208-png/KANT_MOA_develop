"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { addToCart, getCart, removeFromCart, updateQuantity } from "@/services/cart";
import type { Cart } from "@/types/app";

type CartState = { cart: Cart; loaded: boolean };

const EMPTY_CART: Cart = { items: [], totalQuantity: 0, totalPrice: 0 };
const SERVER_STATE: CartState = { cart: EMPTY_CART, loaded: false };

// 헤더 뱃지, 상세 페이지, 장바구니 페이지가 같은 상태를 보도록 모듈 단위로 하나만 둔다.
let state: CartState = SERVER_STATE;
let loading = false;
const listeners = new Set<() => void>();

function setCart(cart: Cart) {
  state = { cart, loaded: true };
  listeners.forEach((listener) => listener());
}

async function refresh() {
  setCart(await getCart());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!state.loaded && !loading) {
    loading = true;
    refresh()
      .catch(() => setCart(EMPTY_CART))
      .finally(() => {
        loading = false;
      });
  }
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

// 로그인·로그아웃으로 사용자가 바뀌면 장바구니를 다시 불러온다.
// 로그인 시 비회원 장바구니 병합(mergeGuestCart)은 onAuthChange가 프로필을 넘기기 전에 끝난다.
// undefined = 아직 인증 상태를 모름 (첫 로드는 subscribe에서 이미 불러옴)
let lastUserId: string | null | undefined;

function syncUser(userId: string | null) {
  if (lastUserId === undefined) {
    lastUserId = userId;
    return;
  }
  if (lastUserId === userId) return;
  lastUserId = userId;
  refresh().catch(() => setCart(EMPTY_CART));
}

// 실패 시 AppError(OUT_OF_STOCK 등)가 그대로 던져지므로 호출하는 쪽에서 catch해서 메시지를 보여준다.
const actions = {
  addItem: async (variantId: number, quantity = 1) => setCart(await addToCart(variantId, quantity)),
  updateQuantity: async (variantId: number, quantity: number) => setCart(await updateQuantity(variantId, quantity)),
  removeItem: async (variantId: number) => setCart(await removeFromCart(variantId)),
  refresh,
};

export function useCart() {
  const { cart, loaded } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;

  useEffect(() => {
    if (initialized) syncUser(userId);
  }, [initialized, userId]);

  return { ...cart, loaded, ...actions };
}
