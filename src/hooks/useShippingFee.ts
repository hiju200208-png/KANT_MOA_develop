"use client";

import { useEffect, useState } from "react";
import { calcShippingFee } from "@/lib/shipping";
import { getShippingPolicy } from "@/services/orders";
import type { ShopSettings } from "@/types/app";

type FeeRule = Pick<ShopSettings, "freeShippingThreshold" | "shippingFee">;

// 설정은 거의 안 바뀌어서 한 번만 불러와 공유 (FastAPI /orders/shipping-policy). 실패하면 배송비 0 (서버도 설정이 없으면 0)
let cached: Promise<FeeRule | null> | null = null;
const loadRule = () =>
  (cached ??= getShippingPolicy().catch(() => {
    cached = null; // 다음 화면에서 다시 시도
    return null;
  }));

// 장바구니·주문서 표시용 배송비. 실제 결제 금액은 서버가 같은 규칙으로 계산
export function useShippingFee(itemsPrice: number) {
  const [rule, setRule] = useState<FeeRule | null>(null);

  useEffect(() => {
    let active = true;
    loadRule().then((loaded) => {
      if (active) setRule(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const shippingFee = rule ? calcShippingFee(itemsPrice, rule) : 0;
  return {
    shippingFee,
    total: itemsPrice + shippingFee,
    freeShippingThreshold: rule?.freeShippingThreshold ?? null,
  };
}
