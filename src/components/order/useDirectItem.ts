"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "@/constants/error-messages";
import { getDirectItem } from "@/services/cart";
import type { CartItem } from "@/types/app";

// 바로 구매: /checkout?variant=12&qty=2. variant가 없으면 장바구니 전체를 주문한다.
export type DirectBuy = { variantId: number; quantity: number };
type LoadedDirect = { key: string; item: CartItem | null; error: string | null };

export function parseDirect(params: URLSearchParams): DirectBuy | null {
  const variantId = Number(params.get("variant"));
  if (!Number.isInteger(variantId) || variantId <= 0) return null;
  const quantity = Number(params.get("qty") ?? 1);
  return { variantId, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1 };
}

// 바로 구매할 상품을 불러온다. 반환값이 null이면 아직 불러오는 중(또는 바로 구매가 아님)이다.
export function useDirectItem(direct: DirectBuy | null) {
  const directKey = direct ? `${direct.variantId}:${direct.quantity}` : null;
  const [state, setState] = useState<LoadedDirect | null>(null);

  useEffect(() => {
    if (!direct || !directKey) return;
    let active = true;
    getDirectItem(direct.variantId, direct.quantity)
      .then((item) => active && setState({ key: directKey, item, error: null }))
      .catch((error) => active && setState({ key: directKey, item: null, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
    // directKey가 같으면 direct도 같은 값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directKey]);

  return state?.key === directKey ? state : null;
}
